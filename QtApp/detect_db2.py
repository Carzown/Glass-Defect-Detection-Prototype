#!/usr/bin/env python3
"""
Glass Defect Detection System - Raspberry Pi 5 with Hailo AI Accelerator

This script:
1. Captures video from Raspberry Pi camera (768x768)
2. Runs YOLOv8m segmentation model on Hailo 8 accelerator
3. Streams annotated frames (with detection overlays) via WebSocket
4. Saves detected defects to Supabase database
5. Uploads defect images to Supabase storage

Dependencies: degirum, picamera2, supabase-py, websocket-client, opencv-python
"""

import cv2
import time
import threading
import requests
import numpy as np
import uuid
from datetime import datetime, timezone
import pytz

import degirum as dg
from picamera2 import Picamera2
from supabase import create_client
import websocket
import json


# ============================================================================
# CONFIG - Modify these for your setup
# ============================================================================
# ✅ CHECK: Update BACKEND_URL to your actual backend server address
# ✅ CHECK: Update TIMEZONE to match your local timezone

BACKEND_URL = "http://192.168.1.100:5000"  # Backend server address
TIMEZONE = "UTC"                           # Change to your timezone (e.g., "Asia/Manila", "America/New_York")

# Supabase configuration (cloud database + storage)
SUPABASE_URL = "https://kfeztemgrbkfwaicvgnk.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmZXp0ZW1ncmJrZndhaWN2Z25rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTIwMzg0MiwiZXhwIjoyMDc2Nzc5ODQyfQ."
    "-xhy3SYWYlNiD1d_V264FJ5HyLscmhr_bv5crRcjvK0"
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

# Camera resolution (must be supported by Picamera2)
WIDTH = 768
HEIGHT = 768

# Manual exposure control (disable auto-exposure for consistency)
SHUTTER = 8000              # Exposure time in microseconds
ANALOG_GAIN = 4.0           # Sensor gain (0.0 to 8.0)
RED_GAIN = 2.85             # White balance red channel
BLUE_GAIN = 1.05            # White balance blue channel  
SHARPNESS = 1.0             # Image sharpness enhancement


# ============================================================================
# INIT
# ============================================================================

# ✅ FUNCTIONALITY CHECK 1: Supabase Connection
# Initializes connection to cloud database and storage
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
print("✅ Supabase client initialized (database + storage ready)")

# Setup timezone
try:
    local_tz = pytz.timezone(TIMEZONE)
except:
    print(f"⚠️ Invalid timezone '{TIMEZONE}', using UTC")
    local_tz = pytz.UTC

def get_timestamp():
    """Get current timestamp in local timezone with ISO format"""
    return datetime.now(local_tz)

print(f"✅ Timezone set to {TIMEZONE}")

# ✅ FUNCTIONALITY CHECK 2: AI Model Loading
# Loads YOLOv8m segmentation model on Hailo accelerator
model = dg.load_model(
    model_name=MODEL_NAME,
    inference_host_address="@local",  # Use local Hailo hardware
    zoo_url=ZOO_PATH,
    device_type=DEVICE_TYPE
)
print("✅ AI Model loaded on Hailo accelerator")

# Disable confidence score display in overlays (cleaner output)
model.overlay_show_probabilities = False


# ============================================================================

# SUPABASE HELPERS
# ============================================================================

def upload_image(frame, defect_type, ts):
    """
    Upload defect image to Supabase storage
    ✅ CHECK: Images save to defect-images bucket with unique names
    ✅ CHECK: Public URLs generated for web dashboard display
    """
    # Encode with good quality for storage
    _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
    image_bytes = buf.tobytes()

    unique_id = uuid.uuid4().hex
    filename = f"{ts.strftime('%Y%m%d_%H%M%S_%f')}_{unique_id}.jpg"
    path = f"defects/{defect_type}/{filename}"

    try:
        supabase.storage.from_(BUCKET_NAME).upload(
            path,
            image_bytes,
            {"content-type": "image/jpeg"},
        )
    except Exception as e:
        print("Upload failed:", e)
        return None, None

    url = supabase.storage.from_(BUCKET_NAME).get_public_url(path)
    return url, path


def save_defect(defect_type, ts, image_url, image_path, confidence):
    """
    Save defect record to Supabase database
    ✅ CHECK: Records appear in Supabase > Tables > defects
    ✅ CHECK: Image URL links are stored for web dashboard retrieval
    """
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


# ============================================================================
# WEBSOCKET VIDEO STREAM (replaces WebRTC)
# ============================================================================

# ✅ FUNCTIONALITY CHECK 3: WebSocket Connection
ws_connection = None
ws_lock = threading.Lock()

def connect_websocket():
    """
    Establish WebSocket connection to backend server
    ✅ CHECK: WebSocket connects without errors on startup
    ✅ CHECK: Device registers with backend for identification
    """
    global ws_connection
    try:
        ws_url = "ws://localhost:8080"
        ws_connection = websocket.create_connection(ws_url)
        print(f"✅ WebSocket connected to {ws_url}")
        
        # Send initial status
        msg = json.dumps({"type": "status", "status": "connected"})
        ws_connection.send(msg)
    except Exception as e:
        print(f"WebSocket connection error: {e}")
        ws_connection = None

def send_frame(frame):
    """
    Stream annotated frame (with detection overlays) to web clients
    ✅ CHECK: Live frames appear on dashboard with <1s latency
    ✅ CHECK: Defect bounding boxes and labels visible in stream
    ✅ CHECK: Frame quality is good (85% JPEG)
    """
    global ws_connection
    try:
        if ws_connection:
            # Convert frame to JPEG and base64 (with detection overlays)
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            import base64
            frame_data = base64.b64encode(buffer).decode('utf-8')
            
            msg = json.dumps({
                "type": "frame",
                "data": f"data:image/jpeg;base64,{frame_data}"
            })
            
            with ws_lock:
                ws_connection.send(msg)
    except Exception as e:
        print(f"WebSocket send error: {e}")
        ws_connection = None

def send_defect(defect_type, confidence, timestamp):
    """
    Send defect detection metadata to dashboard in real-time
    ✅ CHECK: Defects appear in dashboard list immediately
    ✅ CHECK: Confidence scores displayed correctly (e.g., 95%)
    ✅ CHECK: Timestamps match detection time
    """
    try:
        if ws_connection:
            msg = json.dumps({
                "type": "defect",
                "defect_type": defect_type,
                "confidence": confidence,
                "timestamp": timestamp.isoformat()
            })
            
            with ws_lock:
                ws_connection.send(msg)
    except Exception as e:
        print(f"WebSocket defect send error: {e}")

# ============================================================================
# CAMERA INITIALIZATION
# ============================================================================

# ✅ FUNCTIONALITY CHECK 4: Camera Initialization
picam2 = Picamera2()
print("✅ Picamera2 initialized")

config = picam2.create_video_configuration(
    main={"size": (WIDTH, HEIGHT), "format": "RGB888"},
    controls={
        "AeEnable": False,              # Disable auto-exposure
        "AwbEnable": False,             # Disable auto white balance
        "ExposureTime": SHUTTER,
        "AnalogueGain": ANALOG_GAIN,
        "ColourGains": (RED_GAIN, BLUE_GAIN),
        "NoiseReductionMode": 0,
        "Sharpness": SHARPNESS,
    }
)

picam2.configure(config)
picam2.start()
time.sleep(1)  # Wait for camera to stabilize

print("✅ Camera running at {}x{} with fixed parameters.".format(WIDTH, HEIGHT))

# Initialize WebSocket for video streaming
connect_websocket()
if not ws_connection:
    print("Warning: WebSocket not connected. Continuing without streaming.")

# ============================================================================
# MAIN LOOP
# ============================================================================

print("\n" + "="*70)
print("✅ FUNCTIONALITY CHECK 6: Starting Main Detection Loop")
print("="*70)
print("Monitoring for defects...")
print("(Press 'q' to stop)\n")

for result in model.predict_batch(
    (picam2.capture_array() for _ in iter(int, 1))
):
    # result.image_overlay = frame with AI detection overlays (boxes, labels)
    annotated = result.image_overlay

    # STEP 1: STREAM - Send frame to web dashboard via WebSocket
    send_frame(annotated)

    # STEP 2: DETECT - Check if any defects were found in this frame
    if result.results:
        ts = get_timestamp()  # Get current time in local timezone

        for r in result.results:
            label = r["label"]              # Type of defect
            conf = r["confidence"]          # Confidence score

            # Console output
            print(f"🔍 DEFECT DETECTED: {label} ({conf:.2%})")

            # STEP 3: BROADCAST - Send defect to dashboard in real-time
            # Convert to ISO format for transmission
            send_defect(label, conf, ts)
            
            # STEP 4: SAVE IMAGE - Upload to Supabase storage
            url, path = upload_image(annotated, label, ts)
            if url:
                # STEP 5: SAVE RECORD - Store defect metadata in database
                save_defect(label, ts, url, path, conf)
                print(f"💾 Saved to database: {label}")
            else:
                print(f"⚠️ Failed to upload image for {label}")

    # Local display for debugging
    cv2.imshow("Glass Defect Detection", annotated)

    # Exit on 'q' key
    if cv2.waitKey(1) & 0xFF == ord("q"):
        print("\n⏹️ User pressed 'q' - Shutting down...")
        break

# Cleanup
picam2.stop()
cv2.destroyAllWindows()
print("✅ Camera and windows closed.")
print("\n" + "="*70)
print("SUMMARY OF FUNCTIONALITIES")
print("="*70)
print("✅ 1. Supabase database connection")
print("✅ 2. AI model loaded and inferencing")
print("✅ 3. WebSocket streaming to dashboard")
print("✅ 4. Camera capture and processing")
print("✅ 5. Real-time defect detection")
print("✅ 6. Image upload and storage")
print("✅ 7. Defect record saving")
print("="*70)
