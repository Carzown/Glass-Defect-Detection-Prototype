"""
Jetson client example

Responsibilities
- Connect to the backend via Socket.IO
- Wait for dashboard control (jetson:start / jetson:stop) to toggle streaming
- Stream camera frames to backend for the website preview (Socket.IO)
- Optionally upload detected defect frames to Supabase (Edge Function -> Storage + DB)

Install (on Jetson / dev machine)
    pip install opencv-python python-socketio[client] requests

Basic usage
    python jetson_client_example.py --url http://<server-ip>:5000 --device-id cam-1

With Storage + DB ingest via Edge Function (sample defect every 60 frames)
    set FUNCTION_URL=https://<project-ref>.functions.supabase.co/ingest_defect_with_image
    set DEVICE_TOKEN=REPLACE_WITH_LONG_RANDOM_TOKEN
    python jetson_client_example.py --url http://<server-ip>:5000 --device-id cam-1 --defect-every-n 60
"""

import argparse
import base64
import os
import time
from typing import Optional

import cv2  # camera frames
import socketio  # Socket.IO client for live preview stream
import requests  # HTTP to call the Supabase Edge Function


def post_defect_to_function(function_url: Optional[str], device_token: Optional[str], device_id: str, defect_type: str, image_bytes: bytes, mime: str):
    """Upload a single defect snapshot to Supabase via Edge Function.

    Inputs
    - function_url: Full URL to the deployed function (ingest_defect_with_image)
    - device_token: Per-device secret (matches device_api_keys.token)
    - device_id: Camera or device identifier (e.g., cam-1)
    - defect_type: Name/label of defect (e.g., Scratch)
    - image_bytes: Encoded image bytes (JPEG/PNG)
    - mime: Content type (image/jpeg or image/png)

    Returns: requests.Response | None
    """
    if not function_url or not device_token:
        return None
    files = {
        "file": (f"frame.{ 'png' if mime.endswith('png') else 'jpg' }", image_bytes, mime or "application/octet-stream"),
    }
    data = {"device_id": device_id, "defect_type": defect_type}
    headers = {"X-Device-Token": device_token}
    try:
        resp = requests.post(function_url, headers=headers, data=data, files=files, timeout=30)
        if not resp.ok:
            print("Function ingest failed:", resp.status_code, resp.text)
        return resp
    except Exception as e:
        print("Function ingest error:", e)
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://localhost:5000", help="Backend server URL")
    parser.add_argument("--device-id", default="jetson-1", help="Device ID label")
    parser.add_argument("--source", default=0, help="OpenCV video source index or path")
    parser.add_argument("--fps", type=float, default=10.0, help="Frame rate to send")
    parser.add_argument("--width", type=int, default=640)
    parser.add_argument("--height", type=int, default=480)
    parser.add_argument("--function-url", default=os.getenv("FUNCTION_URL"), help="Supabase Edge Function URL for ingest_defect_with_image (optional)")
    parser.add_argument("--device-token", default=os.getenv("DEVICE_TOKEN"), help="Device token for Edge Function (optional)")
    parser.add_argument("--defect-every-n", type=int, default=0, help="If >0, send a sample defect to Supabase every N frames")
    args = parser.parse_args()

    # Socket.IO client and run state
    sio = socketio.Client()
    running = False  # toggled by dashboard via jetson:start/jetson:stop
    frame_count = 0  # used to optionally send sample defects every N frames

    @sio.event
    def connect():
        print("Connected to backend")
        sio.emit("jetson:register", {"deviceId": args.device_id})

    @sio.event
    def disconnect():
        print("Disconnected from backend")

    # Control: start streaming (from dashboard)
    @sio.on("jetson:start")
    def on_start(payload):
        nonlocal running
        running = True
        print("▶️  Start received", payload)

    # Control: stop streaming (from dashboard)
    @sio.on("jetson:stop")
    def on_stop(payload):
        nonlocal running
        running = False
        print("⏹️  Stop received", payload)

    sio.connect(args.url, transports=["websocket"])  # prefer websocket

    cap = cv2.VideoCapture(args.source)
    if args.width and args.height:
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, args.width)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, args.height)

    # Main loop frequency (FPS)
    interval = 1.0 / max(args.fps, 0.1)
    try:
        while True:
            if not running:
                time.sleep(0.1)
                continue

            ok, frame = cap.read()
            if not ok:
                print("Failed to read frame")
                break

            # Detection hook: replace with your real defect detection
            defects = []  # e.g., [{"type": "Scratch"}] when detected

            # Encode as JPEG and base64 for Socket.IO live preview
            ok, buf = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
            if not ok:
                continue
            jpg_bytes = buf.tobytes()
            b64 = base64.b64encode(jpg_bytes).decode('ascii')
            payload = {
                "image": b64,
                "mime": "image/jpeg",
                "time": time.strftime('%Y-%m-%dT%H:%M:%S'),
                "defects": defects,
                "deviceId": args.device_id,
            }
            sio.emit("jetson:frame", payload)  # send to backend to broadcast to website

            # Optional: upload to Supabase (Storage + DB) when defect found or every N frames
            if args.defect_every_n and (defects or (frame_count % args.defect_every_n == 0)):
                post_defect_to_function(
                    args.function_url,
                    args.device_token,
                    args.device_id,
                    defects[0]["type"] if defects else "Sample",
                    jpg_bytes,
                    "image/jpeg",
                )

            frame_count += 1
            time.sleep(interval)
    except KeyboardInterrupt:
        pass
    finally:
        cap.release()
        sio.disconnect()


if __name__ == "__main__":
    main()
