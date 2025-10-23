# Example Jetson client: send camera frames to the Node backend via Socket.IO
# Requirements (install on Jetson):
#   pip install opencv-python python-socketio[client]
# Usage:
#   python jetson_client_example.py --url http://<server-ip>:5000 --device-id cam-1

import argparse
import base64
import time

import cv2
import socketio


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://localhost:5000", help="Backend server URL")
    parser.add_argument("--device-id", default="jetson-1", help="Device ID label")
    parser.add_argument("--source", default=0, help="OpenCV video source index or path")
    parser.add_argument("--fps", type=float, default=10.0, help="Frame rate to send")
    parser.add_argument("--width", type=int, default=640)
    parser.add_argument("--height", type=int, default=480)
    args = parser.parse_args()

    sio = socketio.Client()

    @sio.event
    def connect():
        print("Connected to backend")
        sio.emit("jetson:register", {"deviceId": args.device_id})

    @sio.event
    def disconnect():
        print("Disconnected from backend")

    sio.connect(args.url, transports=["websocket"])  # prefer websocket

    cap = cv2.VideoCapture(args.source)
    if args.width and args.height:
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, args.width)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, args.height)

    interval = 1.0 / max(args.fps, 0.1)
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                print("Failed to read frame")
                break
            # TODO: Insert your defect detection here and populate `defects`
            defects = []

            # Encode as JPEG and base64
            ok, buf = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
            if not ok:
                continue
            b64 = base64.b64encode(buf.tobytes()).decode('ascii')
            payload = {
                "image": b64,
                "mime": "image/jpeg",
                "time": time.strftime('%Y-%m-%dT%H:%M:%S'),
                "defects": defects,
                "deviceId": args.device_id,
            }
            sio.emit("jetson:frame", payload)
            time.sleep(interval)
    except KeyboardInterrupt:
        pass
    finally:
        cap.release()
        sio.disconnect()


if __name__ == "__main__":
    main()
