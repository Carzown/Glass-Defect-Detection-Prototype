#!/usr/bin/env python3

import cv2
import time
import base64
import uuid
import json
import os
import numpy as np
from datetime import datetime
import pytz
from collections import deque
import sys
import threading
from queue import Queue, Full
from concurrent.futures import ThreadPoolExecutor
import requests
from urllib3.util.retry import Retry
from requests.adapters import HTTPAdapter

# Add modules to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'modules'))

try:
    from fps import FPS
    from config import (
        DEVICE_ID, BACKEND_URL, MIN_CONFIDENCE, UPLOAD_COOLDOWN, 
        SPATIAL_DIST, WIDTH, HEIGHT, MODEL_NAME, ZOO_PATH, DEVICE_TYPE,
        SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BUCKET_NAME
    )
except ImportError as e:
    print(f"ERROR: Failed to import configuration: {e}")
    print("ERROR: Make sure modules/config.py and modules/fps.py exist")
    exit(1)

try:
    import degirum as dg
except ImportError:
    print("ERROR: degirum not installed.")
    exit(1)

try:
    from picamera2 import Picamera2
except ImportError:
    print("ERROR: picamera2 not installed.")
    exit(1)

try:
    from supabase import create_client
except ImportError:
    print("ERROR: supabase not installed.")
    exit(1)

try:
    import websocket
except ImportError:
    print("ERROR: websocket-client not installed.")
    exit(1)


# ============================================================================
# CONFIG & STATE
# ============================================================================

detecting = True
ENABLE_DISPLAY = os.getenv('ENABLE_DISPLAY', 'true').lower() in ('true', '1', 'yes')
SKIP_FRAMES = int(os.getenv('SKIP_FRAMES', '0'))
TIMEZONE = "UTC"
local_tz = pytz.UTC
try:
    local_tz = pytz.timezone(TIMEZONE)
except:
    local_tz = pytz.UTC

def get_timestamp():
    return datetime.now(local_tz)

# ============================================================================
# INIT CLIENTS
# ============================================================================

supabase = None
try:
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    print("Supabase client initialized")
except Exception as e:
    print(f"Supabase initialization failed: {e}")

model = None
try:
    model = dg.load_model(
        model_name=MODEL_NAME,
        inference_host_address="@local",
        zoo_url=ZOO_PATH,
        device_type=DEVICE_TYPE,
    )
    model.overlay_show_probabilities = False
    print("AI Model loaded")
except Exception as e:
    print(f"AI Model failed: {e}")
    exit(1)

# ============================================================================
# SUPABASE HELPERS
# ============================================================================

def upload_image_async(frame, defect_type, ts):
    if not supabase: return None, None
    try:
        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 60])
        image_bytes = buf.tobytes()
        unique_id = uuid.uuid4().hex
        filename = f"{ts.strftime('%Y%m%d_%H%M%S_%f')}_{unique_id}.jpg"
        path = f"defects/{defect_type}/{filename}"
        supabase.storage.from_(BUCKET_NAME).upload(path, image_bytes, {"content-type": "image/jpeg"})
        return supabase.storage.from_(BUCKET_NAME).get_public_url(path), path
    except: return None, None

def save_defect(defect_type, ts, image_url, image_path, confidence):
    if not supabase: return
    try:
        supabase.table("defects").insert({
            "defect_type": defect_type,
            "confidence": confidence,
            "image_url": image_url,
            "image_path": image_path,
            "detected_at": ts.isoformat(),
        }).execute()
    except Exception as e:
        print(f"Database save failed: {e}")

# ============================================================================
# DEVICE STATUS HELPERS
# ============================================================================

def set_device_status(is_online: bool):
    """Upsert the device online/offline row in the device_status table."""
    if not supabase:
        return
    try:
        now = datetime.now(local_tz).isoformat()
        supabase.table("device_status").upsert({
            "device_id": DEVICE_ID,
            "is_online": is_online,
            "last_seen": now,
        }, on_conflict="device_id").execute()
        status_str = "ONLINE" if is_online else "OFFLINE"
        print(f"Device status set to {status_str}")
    except Exception as e:
        print(f"Device status update failed: {e}")

def heartbeat_worker():
    """Background thread: sends a heartbeat to device_status every 30 seconds."""
    while ws_send_active:
        time.sleep(30)
        if ws_send_active:
            set_device_status(True)

# ============================================================================
# WEBSOCKET & NETWORKING
# ============================================================================

ws_connection = None
ws_lock = threading.Lock()
ws_retry_count = 0
WS_MAX_RETRIES = 5
ws_last_heartbeat = time.time()
WS_HEARTBEAT_INTERVAL = 30
ws_send_active = True
ws_error_count = 0
WS_ERROR_THRESHOLD = 3
connection_mode = "unknown"

http_session = requests.Session()
retry_strategy = Retry(total=2, backoff_factor=0.1, status_forcelist=[500, 502, 503, 504], allowed_methods=["POST", "GET"])
adapter = HTTPAdapter(max_retries=retry_strategy)
http_session.mount("http://", adapter)
http_session.mount("https://", adapter)

frame_queue = Queue(maxsize=3)
defect_queue = Queue(maxsize=10)
upload_executor = ThreadPoolExecutor(max_workers=2)

def get_websocket_url():
    url = BACKEND_URL.strip()
    if not url: raise ValueError("BACKEND_URL not set")
    url = url.replace("http://", "").replace("https://", "").replace("wss://", "").replace("ws://", "").strip("/")
    if ":" in url: url = url.split(":")[0]
    protocol = "wss" if "railway" in BACKEND_URL or "https" in BACKEND_URL else "ws"
    return f"{protocol}://{url}/ws"

def connect_websocket():
    global ws_connection, ws_retry_count, connection_mode
    if os.getenv('DISABLE_WEBSOCKET', '').lower() in ('true', '1', 'yes'):
        return connect_http_fallback()

    try:
        ws_url = get_websocket_url()
        print(f"Connecting to WebSocket: {ws_url}")
        ws_connection = websocket.create_connection(ws_url, timeout=5)
        ws_retry_count = 0
        connection_mode = "websocket"
        ws_connection.send(json.dumps({"type": "device_register", "device_id": DEVICE_ID}))
        print(f"WebSocket connected")
        return True
    except Exception as e:
        ws_retry_count += 1
        return connect_http_fallback()

def connect_http_fallback():
    global ws_retry_count, connection_mode
    try:
        http_url = BACKEND_URL.rstrip('/') + "/api/device/register"
        http_session.post(http_url, headers={'x-device-id': DEVICE_ID}, json={'device_id': DEVICE_ID}, timeout=5)
        connection_mode = "http"
        print(f"HTTP fallback connected")
        ws_retry_count = 0
        return True
    except:
        return False

def check_websocket_health():
    global ws_connection, ws_last_heartbeat
    try:
        now = time.time()
        if now - ws_last_heartbeat > WS_HEARTBEAT_INTERVAL:
            with ws_lock:
                if ws_connection:
                    try:
                        ws_connection.send(json.dumps({"type": "ping"}))
                        ws_last_heartbeat = now
                    except:
                        ws_connection = None
    except: pass

def reconnect_websocket_if_needed():
    global ws_connection
    try:
        with ws_lock:
            if not ws_connection:
                print("Reconnecting WebSocket...")
                connect_websocket()
    except: pass

def send_frame(frame):
    try: frame_queue.put_nowait(frame); return True
    except Full: return False

def send_defect(defect_type, confidence, timestamp):
    try: defect_queue.put_nowait({"type": "detection", "defect_type": defect_type, "confidence": float(confidence), "timestamp": timestamp.isoformat()}); return True
    except Full: return False

def websocket_send_worker():
    global ws_connection, connection_mode, ws_error_count
    while ws_send_active:
        try:
            frame = frame_queue.get(timeout=1)
            _, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 50])
            frame_data = base64.b64encode(buffer).decode("utf-8")
            
            if connection_mode == "websocket" and ws_connection:
                try:
                    with ws_lock: ws_connection.send(json.dumps({"type": "frame", "frame": frame_data}))
                    ws_error_count = 0
                except:
                    ws_error_count += 1
                    if ws_error_count >= WS_ERROR_THRESHOLD: connection_mode = "http"; ws_error_count = 0
            elif connection_mode == "http":
                try: http_session.post(BACKEND_URL.rstrip('/') + "/api/device/frames", headers={'x-device-id': DEVICE_ID}, json={'frame': frame_data}, timeout=5)
                except: pass
        except: pass

def websocket_defect_worker():
    global ws_connection, connection_mode, ws_error_count
    while ws_send_active:
        try:
            data = defect_queue.get(timeout=1)
            if connection_mode == "websocket" and ws_connection:
                try:
                    with ws_lock: ws_connection.send(json.dumps(data))
                    ws_error_count = 0
                except:
                    ws_error_count += 1
                    if ws_error_count >= WS_ERROR_THRESHOLD: connection_mode = "http"; ws_error_count = 0
            elif connection_mode == "http":
                try:
                    payload = {"detections": [{"defect_type": data["defect_type"], "confidence": data["confidence"], "type": "detection"}], "timestamp": data["timestamp"]}
                    http_session.post(BACKEND_URL.rstrip('/') + "/api/device/detections", headers={'x-device-id': DEVICE_ID}, json=payload, timeout=5)
                except: pass
        except: pass

# ============================================================================
# CAMERA INITIALIZATION
# ============================================================================
picam2 = None
try:
    picam2 = Picamera2()
    
    # Camera settings
    camera_config = picam2.create_video_configuration(
        main={"size": (WIDTH, HEIGHT), "format": "RGB888"},
        controls=dict(**{"AeEnable": False, "AwbEnable": False}, **{
            "ExposureTime": 8000,
            "AnalogueGain": 4.0,
            "ColourGains": (2.85, 1.05),
            "NoiseReductionMode": 0,
            "Sharpness": 1.0,
        }),
    )
    
    picam2.configure(camera_config)
    picam2.start()
    time.sleep(1)
    print(f"Camera running with CUSTOM SETTINGS (Exp:8000, Gain:4.0)")
except Exception as e:
    print(f"Camera initialization failed: {e}")
    exit(1)

# Start Workers
if not connect_websocket():
    print("Initial connection failed, will retry.")
threading.Thread(target=websocket_send_worker, daemon=True).start()
threading.Thread(target=websocket_defect_worker, daemon=True).start()

# Mark device ONLINE and start heartbeat
set_device_status(True)
threading.Thread(target=heartbeat_worker, daemon=True).start()

# ============================================================================
# MAIN LOOP (STATIONARY MODE)
# ============================================================================

print("\nSYSTEM READY - STATIONARY MODE")
print(f"Defects are uploaded ONLY ONCE per session.")
print("="*70)

fps = FPS()
reconnect_counter = 0
frame_skip_counter = 0

# PERMANENT REGISTRY: Stores {'x': 123, 'y': 456, 'label': 'bubble'}
uploaded_defects_registry = [] 

try:
    for result in model.predict_batch((picam2.capture_array() for _ in iter(int, 1))):
        fps.update()
        
        # WebSocket Health Check
        reconnect_counter += 1
        if reconnect_counter % 30 == 0:
            check_websocket_health()
            reconnect_websocket_if_needed()

        annotated = result.image_overlay
        if annotated is None: continue
        
        fps.draw(annotated)
        
        # Stream Video
        frame_sent = send_frame(annotated)
        if not frame_sent and reconnect_counter % 10 == 0:
            reconnect_websocket_if_needed()

        # Check Detections
        valid_hits = [r for r in result.results if r.get("score", r.get("confidence", 0)) >= MIN_CONFIDENCE]

        if valid_hits:
            ts = get_timestamp()
            
            for hit in valid_hits:
                label = hit.get("label", "Unknown")
                conf = hit.get("score", hit.get("confidence", 0.0))
                bbox = hit.get("bbox", [0, 0, 0, 0])
                
                # Get Center Point
                cx = (bbox[0] + bbox[2]) / 2
                cy = (bbox[1] + bbox[3]) / 2
                
                # DUPLICATE CHECK
                # We check this new point against the PERMANENT registry
                is_duplicate = False
                dist_threshold_sq = SPATIAL_DIST ** 2
                
                for past_defect in uploaded_defects_registry:
                    dist_sq = (cx - past_defect['x'])**2 + (cy - past_defect['y'])**2
                    if dist_sq < dist_threshold_sq:
                        is_duplicate = True
                        break
                
                # ACTION: Only process if it is NOT a duplicate
                if not is_duplicate:
                    print(f"NEW DETECT: {label} ({conf:.1%}) at x={int(cx)}, y={int(cy)}")
                    
                    # 1. Register it immediately so we don't send it again
                    uploaded_defects_registry.append({'x': cx, 'y': cy, 'label': label})
                    
                    # 2. Upload Data
                    send_defect(label, conf, ts)
                    
                    # 3. Upload Image (Async)
                    def async_upload():
                        url, path = upload_image_async(annotated, label, ts)
                        if url:
                            save_defect(label, ts, url, path, conf)
                            print(f"Saved to DB: {label}")
                    upload_executor.submit(async_upload)

        if ENABLE_DISPLAY:
            cv2.imshow("Glass Defect", annotated)
            if cv2.waitKey(1) & 0xFF == ord("q"): break
            
        if SKIP_FRAMES > 0:
            frame_skip_counter += 1
            if frame_skip_counter < SKIP_FRAMES: continue
            frame_skip_counter = 0

except KeyboardInterrupt: pass
finally:
    ws_send_active = False
    set_device_status(False)
    picam2.stop()
    cv2.destroyAllWindows()
    if ws_connection: ws_connection.close()
    print("\nSystem Stopped")

