#!/usr/bin/env python3
"""
Glass Defect Detection System - Raspberry Pi 5 with Hailo AI Accelerator

This script:
1. Captures video from Raspberry Pi camera (768x768)
2. Runs YOLOv8m segmentation model on Hailo 8 accelerator
3. Streams annotated frames (with detection overlays) via WebSocket
4. Saves detected defects to Supabase database
5. Uploads defect images to Supabase storage

Dependencies: degirum, picamera2, supabase-py, websocket-client, opencv-python, pytz

NOTE: This is a Raspberry Pi-specific script. Platform-specific imports (degirum, picamera2)
will show Pylance warnings when editing on non-Pi systems. This is expected and safe.
The # type: ignore comments suppress these IDE errors while keeping the code functional.
"""

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
    print(f"❌ ERROR: Failed to import configuration: {e}")
    print("❌ Make sure modules/config.py and modules/fps.py exist")
    exit(1)

try:
    import degirum as dg  # type: ignore
except ImportError:
    print("❌ ERROR: degirum not installed. Install with: pip install degirum")
    exit(1)

try:
    from picamera2 import Picamera2  # type: ignore
except ImportError:
    print("❌ ERROR: picamera2 not installed. Install with: pip install picamera2")
    exit(1)

try:
    from supabase import create_client  # type: ignore
except ImportError:
    print("❌ ERROR: supabase not installed. Install with: pip install supabase")
    exit(1)

try:
    import websocket  # type: ignore
except ImportError:
    print("❌ ERROR: websocket-client not installed. Install with: pip install websocket-client")
    exit(1)


# ============================================================================
# MODE STATE - Track detection state
# ============================================================================

# Detection is always in automatic mode (no GUI)
detecting = True


# ============================================================================
# CONFIG - Configuration imported from config.py
# ============================================================================

TIMEZONE = "UTC"  # Change to your timezone (e.g., "Asia/Manila", "America/New_York")

# Use config.py for all configuration settings
# This keeps the configuration centralized and easy to modify

# ============================================================================
# INIT - Initialization with error handling
# ============================================================================

# ✅ FUNCTIONALITY CHECK 1: Supabase Connection
supabase = None
try:
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    print("✅ Supabase client initialized (database + storage ready)")
except Exception as e:
    print(f"❌ Supabase initialization failed: {e}")
    print("⚠️  Continuing without Supabase (detections won't be saved)")

# Setup timezone
local_tz = pytz.UTC
try:
    local_tz = pytz.timezone(TIMEZONE)
    print(f"✅ Timezone set to {TIMEZONE}")
except Exception as e:
    print(f"⚠️  Invalid timezone '{TIMEZONE}': {e}")
    print("⚠️  Using UTC instead")
    local_tz = pytz.UTC


def get_timestamp():
    """Get current timestamp in local timezone with ISO format"""
    return datetime.now(local_tz)


# ✅ FUNCTIONALITY CHECK 2: AI Model Loading
model = None
try:
    model = dg.load_model(
        model_name=MODEL_NAME,
        inference_host_address="@local",
        zoo_url=ZOO_PATH,
        device_type=DEVICE_TYPE,
    )
    model.overlay_show_probabilities = False
    print("✅ AI Model loaded on Hailo accelerator")
except Exception as e:
    print(f"❌ AI Model loading failed: {e}")
    print("❌ Cannot continue without model. Exiting.")
    exit(1)

# ============================================================================
# SUPABASE HELPERS
# ============================================================================


def upload_image_async(frame, defect_type, ts):
    """Async upload defect image to Supabase storage (runs in thread pool)"""
    if not supabase:
        return None, None

    try:
        # Lower quality (60 vs 90) for faster upload
        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 60])
        image_bytes = buf.tobytes()

        unique_id = uuid.uuid4().hex
        filename = f"{ts.strftime('%Y%m%d_%H%M%S_%f')}_{unique_id}.jpg"
        path = f"defects/{defect_type}/{filename}"

        supabase.storage.from_(BUCKET_NAME).upload(
            path, image_bytes, {"content-type": "image/jpeg"}
        )

        url = supabase.storage.from_(BUCKET_NAME).get_public_url(path)
        return url, path
    except Exception as e:
        # Silently fail (don't block detection)
        return None, None


def save_defect(defect_type, ts, image_url, image_path, confidence):
    """Save defect record to Supabase database"""
    if not supabase:
        return  

    try:
        supabase.table("defects").insert(
            {
                "defect_type": defect_type,
                "detected_at": ts.isoformat(),
                "image_url": image_url,
                "image_path": image_path,
                "status": "pending",
                "confidence": confidence,
            }
        ).execute()
    except Exception as e:
        print(f"⚠️  Database save failed: {e}")


# ============================================================================
# WEBSOCKET VIDEO STREAM
# ============================================================================

ws_connection = None
ws_lock = threading.Lock()
ws_retry_count = 0
WS_MAX_RETRIES = 5
ws_last_heartbeat = time.time()
WS_HEARTBEAT_INTERVAL = 30  # Send heartbeat every 30 seconds

# Async queues for non-blocking I/O
frame_queue = Queue(maxsize=3)  # Keep only 3 frames in queue (drop old frames)
defect_queue = Queue(maxsize=10)  # Defect metadata queue
upload_executor = ThreadPoolExecutor(max_workers=2)  # Thread pool for uploads
ws_send_active = True

# HTTP fallback configuration
http_session = requests.Session()
retry_strategy = Retry(
    total=2,
    backoff_factor=0.1,
    status_forcelist=[500, 502, 503, 504],
    allowed_methods=["POST", "GET"]
)
adapter = HTTPAdapter(max_retries=retry_strategy)
http_session.mount("http://", adapter)
http_session.mount("https://", adapter)

# Track connection mode
connection_mode = "unknown"  # 'websocket' or 'http'
ws_error_count = 0  # Track consecutive WebSocket errors
WS_ERROR_THRESHOLD = 3  # Switch to HTTP after 3 consecutive errors


def get_websocket_url():
    """Convert backend URL to WebSocket URL"""
    url = BACKEND_URL.strip()
    
    if not url:
        raise ValueError("BACKEND_URL is not configured in config.py")
    
    # Remove any existing protocols and paths
    url = url.replace("http://", "").replace("https://", "").replace("wss://", "").replace("ws://", "").strip("/")
    
    # Remove port if present (will use the same port as the base URL)
    if ":" in url:
        url = url.split(":")[0]
    
    # Add wss:// (secure WebSocket) - will use default HTTPS port (443)
    # or ws:// for local dev
    protocol = "wss" if "railway" in BACKEND_URL or "https" in BACKEND_URL else "ws"
    
    # Connect to /ws endpoint (not root)
    url = f"{protocol}://{url}/ws"
    
    return url


def connect_websocket():
    """Establish WebSocket connection with fallback to HTTP"""
    global ws_connection, ws_retry_count, connection_mode

    # Allow disabling WebSocket via environment variable
    disable_websocket = os.getenv('DISABLE_WEBSOCKET', '').lower() in ('true', '1', 'yes')
    
    if disable_websocket:
        print(f"⚠️  WebSocket disabled via DISABLE_WEBSOCKET environment variable")
        print(f"🔄 Using HTTP fallback directly...")
        return connect_http_fallback()

    try:
        ws_url = get_websocket_url()
        print(f"🔄 Connecting to WebSocket: {ws_url}")

        ws_connection = websocket.create_connection(ws_url, timeout=5)
        ws_retry_count = 0
        connection_mode = "websocket"

        # Send device registration with device ID
        msg = json.dumps({"type": "device_register", "device_id": DEVICE_ID})
        ws_connection.send(msg)
        print(f"📡 Device '{DEVICE_ID}' registered with backend")
        print(f"✅ WebSocket connected to {ws_url}")
        return True
        
    except Exception as ws_error:
        ws_retry_count += 1
        print(f"⚠️  WebSocket connection error: {ws_error}")
        ws_connection = None
        
        # Try HTTP fallback instead
        return connect_http_fallback()


def connect_http_fallback():
    """Establish HTTP fallback connection"""
    global ws_retry_count, connection_mode
    
    try:
        print(f"🔄 Attempting HTTP fallback connection...")
        http_url = BACKEND_URL.rstrip('/') + "/api/device/register"
        headers = {'x-device-id': DEVICE_ID}
        response = http_session.post(http_url, headers=headers, json={'device_id': DEVICE_ID}, timeout=5)
        response.raise_for_status()
        
        connection_mode = "http"
        print(f"✅ HTTP fallback connected to {BACKEND_URL}")
        print(f"📡 Device '{DEVICE_ID}' registered via HTTP")
        ws_retry_count = 0
        return True
        
    except Exception as http_error:
        print(f"❌ HTTP fallback also failed: {http_error}")
        connection_mode = "unknown"
        
        if ws_retry_count < WS_MAX_RETRIES:
            print(f"🔄 Retrying in 5 seconds...")
            time.sleep(5)
            return connect_websocket()
        else:
            print("❌ All connection attempts failed. Continuing in offline mode...")
            return False


def send_frame(frame):
    """Queue frame for async WebSocket streaming (non-blocking)"""
    try:
        frame_queue.put_nowait(frame)
        return True
    except Full:
        return False


def websocket_send_worker():
    """Background thread: sends frames from queue to WebSocket or HTTP"""
    global ws_connection, connection_mode, ws_error_count
    
    while ws_send_active:
        try:
            try:
                frame = frame_queue.get(timeout=1)
            except:
                continue
            
            # Lower quality for speed (50 vs 85)
            _, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 50])
            frame_data = base64.b64encode(buffer).decode("utf-8")
            
            if connection_mode == "websocket" and ws_connection:
                # Send via WebSocket
                try:
                    msg = json.dumps({"type": "frame", "frame": frame_data})
                    with ws_lock:
                        if ws_connection:
                            ws_connection.send(msg)
                    ws_error_count = 0  # Reset error counter on success
                except Exception as e:
                    ws_error_count += 1
                    if "timeout" in str(e).lower() or "write" in str(e).lower():
                        print(f"⚠️  WebSocket write timeout ({ws_error_count}/{WS_ERROR_THRESHOLD}): {e}")
                    else:
                        print(f"⚠️  WebSocket send error: {e}")
                    
                    # Switch to HTTP fallback if too many errors
                    if ws_error_count >= WS_ERROR_THRESHOLD:
                        print(f"🔄 Too many WebSocket errors ({ws_error_count}), switching to HTTP...")
                        connection_mode = "http"
                        ws_error_count = 0
                    
            elif connection_mode == "http":
                # Send via HTTP POST
                try:
                    http_url = BACKEND_URL.rstrip('/') + "/api/device/frames"
                    headers = {'x-device-id': DEVICE_ID}
                    http_session.post(http_url, headers=headers, json={'frame': frame_data}, timeout=5)
                except Exception as e:
                    print(f"⚠️  HTTP frame send error: {e}")
                    
        except Exception as e:
            pass


def send_defect(defect_type, confidence, timestamp):
    """Queue defect metadata for async WebSocket send"""
    try:
        defect_queue.put_nowait({
            "type": "detection",
            "defect_type": defect_type,
            "confidence": float(confidence),
            "timestamp": timestamp.isoformat(),
        })
        return True
    except Full:
        return False


def websocket_defect_worker():
    """Background thread: sends defect metadata from queue via WebSocket or HTTP"""
    global ws_connection, connection_mode, ws_error_count
    
    while ws_send_active:
        try:
            try:
                defect_data = defect_queue.get(timeout=1)
            except:
                continue
            
            if connection_mode == "websocket" and ws_connection:
                # Send via WebSocket
                try:
                    msg = json.dumps(defect_data)
                    with ws_lock:
                        if ws_connection:
                            ws_connection.send(msg)
                    ws_error_count = 0  # Reset on success
                except Exception as e:
                    ws_error_count += 1
                    print(f"⚠️  WebSocket detection send error: {e}")
                    
                    # Switch to HTTP fallback if too many errors
                    if ws_error_count >= WS_ERROR_THRESHOLD:
                        print(f"🔄 Switching detection to HTTP (WebSocket issues)...")
                        connection_mode = "http"
                        ws_error_count = 0
                    
            elif connection_mode == "http":
                # Send via HTTP POST
                try:
                    http_url = BACKEND_URL.rstrip('/') + "/api/device/detections"
                    headers = {'x-device-id': DEVICE_ID}
                    http_session.post(http_url, headers=headers, json=defect_data, timeout=5)
                except Exception as e:
                    print(f"⚠️  HTTP detection send error: {e}")
                    
        except Exception as e:
            pass


def check_websocket_health():
    """Periodic health check - reconnect if needed (for Railway stability)"""
    global ws_connection, ws_last_heartbeat
    
    try:
        now = time.time()
        
        # Check if heartbeat interval has passed
        if now - ws_last_heartbeat > WS_HEARTBEAT_INTERVAL:
            with ws_lock:
                if ws_connection:
                    try:
                        # Send keepalive ping
                        msg = json.dumps({"type": "ping"})
                        ws_connection.send(msg)
                        ws_last_heartbeat = now
                    except Exception as e:
                        print(f"⚠️  WebSocket ping failed: {e}")
                        ws_connection = None
    except Exception as e:
        print(f"⚠️  Health check error: {e}")


def reconnect_websocket_if_needed():
    """Check connection and reconnect if necessary"""
    global ws_connection
    
    try:
        with ws_lock:
            if not ws_connection:
                print("⚠️  WebSocket disconnected, attempting to reconnect...")
                connect_websocket()
    except Exception as e:
        print(f"⚠️  Reconnection error: {e}")



# ============================================================================
# CAMERA INITIALIZATION
# ============================================================================

# ✅ FUNCTIONALITY CHECK 4: Camera Initialization
picam2 = None
try:
    picam2 = Picamera2()
    print("✅ Picamera2 initialized")

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
    print(f"✅ Camera running at {WIDTH}x{HEIGHT} with fixed parameters")

except Exception as e:
    print(f"❌ Camera initialization failed: {e}")
    print("❌ Cannot continue without camera. Exiting.")
    exit(1)

# Initialize WebSocket for video streaming
if not connect_websocket():
    print("⚠️  Initial WebSocket connection failed. Will retry in main loop.")
else:
    print("✅ WebSocket streaming enabled")

# Start background worker threads for async sends
ws_frame_thread = threading.Thread(target=websocket_send_worker, daemon=True)
ws_defect_thread = threading.Thread(target=websocket_defect_worker, daemon=True)
ws_frame_thread.start()
ws_defect_thread.start()
print("✅ Async WebSocket workers started")

# Small delay to ensure all threads are ready
time.sleep(1)

# ============================================================================
# MAIN LOOP
# ============================================================================

print("\n" + "=" * 70)
print("✅ Detection loop starting...")
print("=" * 70)
print("Detecting glass defects and streaming live...")
print(f"Device: {DEVICE_ID}")
print(f"Backend: {BACKEND_URL}")
print(f"Camera: {WIDTH}x{HEIGHT} @ Hailo Accelerator")
print(f"Min Confidence: {MIN_CONFIDENCE}")
print(f"Connection Mode: {connection_mode.upper()}")
print("Status: CONTINUOUS DETECTION ACTIVE")
print("=" * 70)
print()

# Initialize FPS counter
fps = FPS()

# Defect history tracking for spatial uniqueness
sent_history = deque(maxlen=15)
last_upload_time = 0
reconnect_counter = 0  # Track frames since last reconnection attempt

try:
    for result in model.predict_batch((picam2.capture_array() for _ in iter(int, 1))):
        try:
            # Update FPS counter
            fps.update()
            
            # Periodic WebSocket health check and reconnection (every 30 frames)
            reconnect_counter += 1
            if reconnect_counter % 30 == 0:
                check_websocket_health()
                reconnect_websocket_if_needed()
            
            # Get annotated frame from model
            annotated = result.image_overlay
            if annotated is None:
                #print("⚠️  Frame is None, skipping...")
                continue
            
            # Draw FPS on frame
            fps.draw(annotated)
            
            now = time.time()
            
            # STEP 1: Stream frame to WebSocket (continuous)
            frame_sent = send_frame(annotated)
            if not frame_sent and reconnect_counter % 10 == 0:
                # Attempt reconnection if frames aren't sending
                reconnect_websocket_if_needed()

            # STEP 2: Filter results by confidence
            valid_hits = [r for r in result.results if r.get("confidence", 0) >= MIN_CONFIDENCE]

            # STEP 3: Process detections (always in automatic mode)
            if valid_hits and (now - last_upload_time > UPLOAD_COOLDOWN):
                ts = get_timestamp()
                
                for hit in valid_hits:
                    label = hit.get("label", "Unknown")
                    conf = hit.get("confidence", 0.0)
                    bbox = hit.get("bbox", [0, 0, 0, 0])
                    
                    # Optimized spatial check: use squared distance, no numpy
                    center_x = (bbox[0] + bbox[2]) / 2
                    center_y = (bbox[1] + bbox[3]) / 2
                    dist_sq = SPATIAL_DIST ** 2
                    
                    # Fast check: does NOT match any recent detection
                    is_new_defect = not any(
                        (center_x - past[0])**2 + (center_y - past[1])**2 < dist_sq
                        for past in sent_history
                    )
                    
                    if is_new_defect:
                        print(f"🔍 DEFECT DETECTED: {label} ({conf:.2%})")
                        
                        # Track this defect location (tuple instead of array)
                        sent_history.append((center_x, center_y))
                        last_upload_time = now
                        
                        # STEP 4: Broadcast to dashboard (async)
                        send_defect(label, conf, ts)
                        
                        # STEP 5: Upload image async (non-blocking)
                        def async_upload():
                            url, path = upload_image_async(annotated, label, ts)
                            if url:
                                save_defect(label, ts, url, path, conf)
                                print(f"💾 Saved: {label}")
                        
                        upload_executor.submit(async_upload)

            # Skip local display - causes lag on headless systems
            # Uncomment only for debugging on desktop:
            # cv2.imshow("Glass Defect Detection", annotated)
            # if cv2.waitKey(1) & 0xFF == ord("q"):
            #     print("\n⏹️  Shutdown requested...")
            #     break
        
        except Exception as e:
            print(f"⚠️  Error processing frame: {e}")
            continue

except KeyboardInterrupt:
    print("\n⏹️  Interrupted by user...")
except Exception as e:
    print(f"\n❌ Error in model inference loop: {e}")

# Cleanup
finally:
    print("\n🔄 Cleaning up...")
    
    # Stop async workers
    ws_send_active = False
    ws_frame_thread.join(timeout=2)
    ws_defect_thread.join(timeout=2)
    upload_executor.shutdown(wait=False)
    print("✅ Async workers stopped")
    
    # Stop camera
    if picam2:
        try:
            picam2.stop()
            print("✅ Camera stopped")
        except Exception as e:
            print(f"⚠️  Error stopping camera: {e}")
    
    # Close video window
    try:
        cv2.destroyAllWindows()
        print("✅ Video window closed")
    except:
        pass
    
    # Close WebSocket
    if ws_connection:
        try:
            ws_connection.close()
            print("✅ WebSocket closed")
        except Exception as e:
            print(f"⚠️  Error closing WebSocket: {e}")
    
    print("✅ Cleanup complete")

print("\n" + "=" * 70)
print("DETECTION SESSION SUMMARY")
print("=" * 70)
print("✅ 1. Supabase - {}".format("ENABLED" if supabase else "DISABLED"))
print("✅ 2. AI Model (Hailo) - LOADED")
print("✅ 3. WebSocket Backend - {}".format("CONNECTED" if ws_connection else "DISCONNECTED"))
print("✅ 4. Picamera2 - STOPPED")
print("✅ 5. Detection Loop - STOPPED")
print("=" * 70)
print("Thank you for using Glass Defect Detection! 🎬\n")

