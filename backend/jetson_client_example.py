#!/usr/bin/env python3
# Jetson client: live preview (Socket.IO) + defect upload to Supabase Storage
# Requirements:
#   pip install python-socketio[client] websocket-client opencv-python requests

import os
import cv2
import time
import base64
import requests
import socketio
from datetime import datetime

# ==== CONFIG (edit these or set as env vars) ====
# Your backend (Express + Socket.IO) URL.
# If the Jetson is on the same LAN, use the backend machine's IP (e.g., http://192.168.1.10:5000).
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5000")

# Your Supabase Edge Function URL for defects-upload.
# Project ref is kfeztemgrbkfwaicvgnk, so the function URL is:
FUNCTION_URL = os.getenv(
    "FUNCTION_URL",
    "https://kfeztemgrbkfwaicvgnk.functions.supabase.co/defects-upload"
)

# Device identity and token (must match the DEVICE_INGEST_TOKEN set in the Edge Function's env).
DEVICE_ID    = os.getenv("DEVICE_ID", "cam-1")
DEVICE_TOKEN = os.getenv("DEVICE_TOKEN", "REPLACE_WITH_A_STRONG_RANDOM_DEVICE_TOKEN")

# Video source: 0 for default camera, or a path/URL (rtsp/http).
VIDEO_SOURCE = os.getenv("VIDEO_SOURCE", "0")
try:
    VIDEO_SOURCE = int(VIDEO_SOURCE)
except ValueError:
    pass

# Stream preview FPS and image size (to Node backend)
PREVIEW_FPS      = float(os.getenv("PREVIEW_FPS", "5"))       # preview ~5 fps
PREVIEW_MAX_SIDE = int(os.getenv("PREVIEW_MAX_SIDE", "640"))  # resize to keep bandwidth low

# Simulated detection cadence for demo; replace with your real model trigger.
# Every Nth frame we'll upload as a "Crack" defect.
DEFECT_EVERY_N   = int(os.getenv("DEFECT_EVERY_N", "30"))     # ~every 2s at 30fps

# ============================

def now_iso():
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"

def time_text():
    # Dashboard displays this if present
    return "[" + datetime.now().strftime("%H:%M:%S") + "]"

def resize_max_side(img, max_side):
    h, w = img.shape[:2]
    scale = max_side / max(h, w)
    if scale >= 1.0:
        return img
    nh, nw = int(h * scale), int(w * scale)
    return cv2.resize(img, (nw, nh), interpolation=cv2.INTER_AREA)

def jpeg_bytes(img, quality=80):
    ok, enc = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not ok:
        raise RuntimeError("JPEG encode failed")
    return enc.tobytes()

def upload_defect_to_supabase(image_bytes, defect_type="Defect"):
    """
    Uploads an image (multipart/form-data) to the Edge Function, which:
      - stores it in Storage bucket 'defects'
      - inserts a row into public.defects with image_url + metadata
      - triggers Realtime for the website
    Returns: { ok: true, defect: {...} } on success
    """
    files = {
        "file": ("frame.jpg", image_bytes, "image/jpeg"),
    }
    data = {
        "defect_type": defect_type,
        "device_id": DEVICE_ID,
        "time_text": time_text(),
    }
    headers = { "x-device-token": DEVICE_TOKEN }
    resp = requests.post(FUNCTION_URL, files=files, data=data, headers=headers, timeout=20)
    try:
        js = resp.json()
    except Exception:
        js = {"error": f"non-json response: {resp.text[:200]}..."}
    if not resp.ok:
        raise RuntimeError(f"Upload failed: HTTP {resp.status_code} {js}")
    if not js.get("ok"):
        raise RuntimeError(f"Upload failed: {js}")
    return js

def main():
    # Socket.IO connection for live preview (to Node backend)
    sio = socketio.Client(reconnection=True, reconnection_attempts=0, logger=False)
    connected = {"ok": False}
    # Device state controlled by dashboard via server relays
    running = False     # start/stop controls preview streaming
    detecting = True    # pause/resume controls defect uploads

    @sio.event
    def connect():
        connected["ok"] = True
        print("Connected to backend")
        sio.emit("jetson:register", {"deviceId": DEVICE_ID})

    @sio.event
    def disconnect():
        connected["ok"] = False
        print("Disconnected from backend")

    @sio.on("jetson:start")
    def on_start(payload):
        nonlocal running
        running = True
        print("Received start:", payload)

    @sio.on("jetson:stop")
    def on_stop(payload):
        nonlocal running
        running = False
        print("Received stop:", payload)

    @sio.on("jetson:pause")
    def on_pause(payload):
        nonlocal detecting
        detecting = False
        print("Received pause:", payload)

    @sio.on("jetson:resume")
    def on_resume(payload):
        nonlocal detecting
        detecting = True
        print("Received resume:", payload)

    print("Connecting to", BACKEND_URL)
    sio.connect(BACKEND_URL, transports=["websocket"])

    cap = cv2.VideoCapture(VIDEO_SOURCE)
    if not cap.isOpened():
        raise RuntimeError(f"Failed to open video source: {VIDEO_SOURCE}")

    last_preview_ts = 0.0
    frame_idx = 0
    try:
        while True:
            # If not running, idle and wait for start
            if not running:
                time.sleep(0.05)
                continue

            ok, frame = cap.read()
            if not ok:
                time.sleep(0.05)
                continue

            frame_idx += 1

            # Live preview to backend at PREVIEW_FPS
            now = time.time()
            if running and connected["ok"] and (now - last_preview_ts) >= (1.0 / max(1e-3, PREVIEW_FPS)):
                prev = resize_max_side(frame, PREVIEW_MAX_SIDE)
                jpeg = jpeg_bytes(prev, quality=70)
                sio.emit("jetson:frame", {
                    "image": base64.b64encode(jpeg).decode("ascii"),
                    "mime": "image/jpeg",
                    "time": now_iso(),
                    "deviceId": DEVICE_ID
                })
                last_preview_ts = now

            # Demo: every Nth frame, upload as a "Crack" defect (replace with your detector trigger)
            if running and detecting and DEFECT_EVERY_N > 0 and (frame_idx % DEFECT_EVERY_N == 0):
                try:
                    img_bytes = jpeg_bytes(frame, quality=90)  # higher quality for storage
                    result = upload_defect_to_supabase(img_bytes, defect_type="Crack")
                    print("Uploaded defect:", result.get("defect", {}))
                except Exception as e:
                    print("Upload error:", e)

            time.sleep(0.005)

    finally:
        try: cap.release()
        except Exception: pass
        try: sio.disconnect()
        except Exception: pass

if __name__ == "__main__":
    main()
