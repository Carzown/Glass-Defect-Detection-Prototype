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
import threading
import base64
import uuid
import json
import os
from datetime import datetime
import pytz

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
# CONFIG - Modify these for your setup
# ============================================================================
# ✅ CHECK: Update BACKEND_URL to your actual backend server address
# ✅ CHECK: Update TIMEZONE to match your local timezone
# ✅ CHECK: Set Supabase credentials as environment variables for security

BACKEND_URL = "https://glass-defect-detection-prototype-production.up.railway.app"  # Production backend
TIMEZONE = "UTC"  # Change to your timezone (e.g., "Asia/Manila", "America/New_York")

# Supabase configuration (cloud database + storage)
# BEST PRACTICE: Use environment variables instead of hardcoding
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://kfeztemgrbkfwaicvgnk.supabase.co")
SUPABASE_SERVICE_ROLE_KEY = os.getenv(
    "SUPABASE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmZXp0ZW1ncmJrZndhaWN2Z25rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTIwMzg0MiwiZXhwIjoyMDc2Nzc5ODQyfQ.-xhy3SYWYlNiD1d_V264FJ5HyLscmhr_bv5crRcjvK0"
)
BUCKET_NAME = "defect-images"  # Storage bucket for defect images

# AI Model configuration
MODEL_NAME = "yolov8m_seg"  # YOLOv8 medium segmentation model
ZOO_PATH = "/home/raspi5/degirum"  # Path to Degirum model zoo
DEVICE_TYPE = "HAILORT/HAILO8"  # Hailo 8 AI accelerator hardware

# ============================================================================
# CAMERA MANUAL SETTINGS - Fixed exposure for consistent quality
# ============================================================================
# ✅ CHECK: Camera captures at fixed settings (no auto-exposure)

WIDTH = 768
HEIGHT = 768
SHUTTER = 8000  # Exposure time in microseconds
ANALOG_GAIN = 4.0  # Sensor gain (0.0 to 8.0)
RED_GAIN = 2.85  # White balance red channel
BLUE_GAIN = 1.05  # White balance blue channel
SHARPNESS = 1.0  # Image sharpness enhancement

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


def upload_image(frame, defect_type, ts):
    """Upload defect image to Supabase storage"""
    if not supabase:
        return None, None

    try:
        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
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
        print(f"⚠️  Image upload failed: {e}")
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


def get_websocket_url():
    """Convert backend URL to WebSocket URL"""
    url = BACKEND_URL.replace("http://", "ws://").replace("https://", "wss://")
    if not url.endswith(":8080"):
        url = f"{url}:8080"
    return url


def connect_websocket():
    """Establish WebSocket connection with retry logic"""
    global ws_connection, ws_retry_count

    try:
        ws_url = get_websocket_url()
        print(f"🔄 Connecting to WebSocket: {ws_url}")

        ws_connection = websocket.create_connection(ws_url, timeout=5)
        ws_retry_count = 0

        # Send device registration
        msg = json.dumps({"type": "device_register"})
        ws_connection.send(msg)

        print(f"✅ WebSocket connected to {ws_url}")
        return True
    except Exception as e:
        ws_retry_count += 1
        print(f"⚠️  WebSocket connection error (attempt {ws_retry_count}/{WS_MAX_RETRIES}): {e}")
        ws_connection = None

        if ws_retry_count < WS_MAX_RETRIES:
            print(f"🔄 Retrying in 5 seconds...")
            time.sleep(5)
            return connect_websocket()
        else:
            print("❌ WebSocket connection failed. Continuing without streaming.")
            return False


def send_frame(frame):
    """Stream annotated frame to web clients"""
    global ws_connection

    try:
        if not ws_connection:
            return

        _, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        frame_data = base64.b64encode(buffer).decode("utf-8")

        msg = json.dumps({"type": "frame", "data": f"data:image/jpeg;base64,{frame_data}"})

        with ws_lock:
            if ws_connection:
                ws_connection.send(msg)
    except Exception as e:
        print(f"⚠️  WebSocket frame send error: {e}")
        ws_connection = None


def send_defect(defect_type, confidence, timestamp):
    """Send defect detection metadata to dashboard"""
    global ws_connection

    try:
        if not ws_connection:
            return

        msg = json.dumps(
            {
                "type": "defect",
                "defect_type": defect_type,
                "confidence": confidence,
                "timestamp": timestamp.isoformat(),
            }
        )

        with ws_lock:
            if ws_connection:
                ws_connection.send(msg)
    except Exception as e:
        print(f"⚠️  WebSocket defect send error: {e}")
        ws_connection = None


# ============================================================================
# CAMERA INITIALIZATION
# ============================================================================

# ✅ FUNCTIONALITY CHECK 4: Camera Initialization
picam2 = None
try:
    picam2 = Picamera2()
    print("✅ Picamera2 initialized")

    config = picam2.create_video_configuration(
        main={"size": (WIDTH, HEIGHT), "format": "RGB888"},
        controls={
            "AeEnable": False,
            "AwbEnable": False,
            "ExposureTime": SHUTTER,
            "AnalogueGain": ANALOG_GAIN,
            "ColourGains": (RED_GAIN, BLUE_GAIN),
            "NoiseReductionMode": 0,
            "Sharpness": SHARPNESS,
        },
    )

    picam2.configure(config)
    picam2.start()
    time.sleep(1)
    print(f"✅ Camera running at {WIDTH}x{HEIGHT} with fixed parameters")

except Exception as e:
    print(f"❌ Camera initialization failed: {e}")
    print("❌ Cannot continue without camera. Exiting.")
    exit(1)

# Initialize WebSocket for video streaming
connect_websocket()

# ============================================================================
# MAIN LOOP
# ============================================================================

print("\n" + "=" * 70)
print("✅ Detection loop starting...")
print("=" * 70)
print("Monitoring for defects... (Press 'q' to stop)")
print()

try:
    for result in model.predict_batch((picam2.capture_array() for _ in iter(int, 1))):
        annotated = result.image_overlay

        # STEP 1: Stream frame
        send_frame(annotated)

        # STEP 2: Check for defects
        if result.results:
            ts = get_timestamp()

            for r in result.results:
                label = r.get("label", "Unknown")
                conf = r.get("confidence", 0.0)

                print(f"🔍 DEFECT DETECTED: {label} ({conf:.2%})")

                # STEP 3: Broadcast to dashboard
                send_defect(label, conf, ts)

                # STEP 4: Upload image
                url, path = upload_image(annotated, label, ts)
                if url:
                    # STEP 5: Save record
                    save_defect(label, ts, url, path, conf)
                    print(f"💾 Saved: {label}")

        # Display locally
        cv2.imshow("Glass Defect Detection", annotated)

        # Exit on 'q'
        if cv2.waitKey(1) & 0xFF == ord("q"):
            print("\n⏹️  Shutdown requested...")
            break

except KeyboardInterrupt:
    print("\n⏹️  Interrupted by user...")
except Exception as e:
    print(f"\n❌ Error in main loop: {e}")

# Cleanup
finally:
    print("🔄 Cleaning up...")
    if picam2:
        try:
            picam2.stop()
        except:
            pass
    cv2.destroyAllWindows()
    if ws_connection:
        try:
            ws_connection.close()
        except:
            pass
    print("✅ Cleanup complete")

print("\n" + "=" * 70)
print("SYSTEM STATUS SUMMARY")
print("=" * 70)
print("✅ 1. Supabase database connection - {}".format("OK" if supabase else "DISABLED"))
print("✅ 2. AI model loaded and inferencing - OK")
print("✅ 3. WebSocket streaming - {}".format("OK" if ws_connection else "DISCONNECTED"))
print("✅ 4. Camera capture and processing - OK")
print("✅ 5. Real-time defect detection - STOPPED")
print("=" * 70)

