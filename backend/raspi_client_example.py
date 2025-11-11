"""Minimal Raspberry Pi 5 client for streaming frames to the backend.

Usage:
    pip install opencv-python python-socketio[client]
    python raspi_client_example.py --url http://<server-ip>:5000 --device-id cam-1

The script captures frames from the default camera, encodes them as JPEG
base64, and emits `device:frame` events. It also sends `device:register`
on connect and updates status on disconnect.
"""
import argparse
import base64
import sys
import time
from datetime import datetime

try:
    import cv2
except ImportError:  # pragma: no cover
    cv2 = None

try:
    import socketio  # python-socketio client
except ImportError:
    print("python-socketio not installed. Run: pip install python-socketio[client]", file=sys.stderr)
    sys.exit(1)


def encode_jpeg_b64(frame):
    ok, buf = cv2.imencode('.jpg', frame)
    if not ok:
        return None
    return base64.b64encode(buf).decode('ascii')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', required=True, help='Backend base URL, e.g. http://localhost:5000')
    parser.add_argument('--device-id', default='cam-1', help='Logical device identifier')
    parser.add_argument('--interval', type=float, default=0.5, help='Seconds between frames')
    args = parser.parse_args()

    if cv2 is None:
        print('OpenCV not installed. Install with: pip install opencv-python', file=sys.stderr)
        sys.exit(1)

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print('Failed to open camera 0', file=sys.stderr)
        sys.exit(1)

    sio = socketio.Client()

    @sio.event
    def connect():
        print('Connected to backend')
        sio.emit('client:hello', {'role': 'device', 'deviceId': args.device_id})
        sio.emit('device:register', {'deviceId': args.device_id})

    @sio.event
    def disconnect():
        print('Disconnected from backend')

    # Dashboard control handlers (optional logic stubs)
    @sio.on('dashboard:start')
    def on_start(data):  # pylint: disable=unused-argument
        print('Received start signal')

    @sio.on('dashboard:stop')
    def on_stop(data):  # pylint: disable=unused-argument
        print('Received stop signal')

    @sio.on('dashboard:pause')
    def on_pause(data):  # pylint: disable=unused-argument
        print('Received pause signal')

    @sio.on('dashboard:resume')
    def on_resume(data):  # pylint: disable=unused-argument
        print('Received resume signal')

    print(f'Connecting to {args.url} ...')
    sio.connect(args.url, transports=['websocket'])

    try:
        last_send = 0.0
        while True:
            ok, frame = cap.read()
            if not ok:
                print('Frame capture failed, retrying...')
                time.sleep(0.5)
                continue
            now = time.time()
            if now - last_send >= args.interval:
                img_b64 = encode_jpeg_b64(frame)
                if img_b64:
                    sio.emit('device:frame', {
                        'image': img_b64,
                        'mime': 'image/jpeg',
                        'time': datetime.utcnow().isoformat(),
                        # Provide defect detections here
                        'defects': [],
                        'deviceId': args.device_id,
                    })
                last_send = now
            # Basic key interrupt handling (requires a GUI environment)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
    except KeyboardInterrupt:
        print('Interrupted by user')
    finally:
        cap.release()
        sio.disconnect()


if __name__ == '__main__':
    main()
