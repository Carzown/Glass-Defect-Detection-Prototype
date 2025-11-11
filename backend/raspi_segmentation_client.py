"""Raspberry Pi 5 Instance Segmentation client

Features
- Captures frames from the default camera (OpenCV)
- Runs instance segmentation (Ultralytics YOLOv8-seg by default)
- Draws masks/boxes for preview
- Streams annotated frames to backend via Socket.IO (`device:frame`)
- Uploads detected defects to Supabase Edge Function `defects-upload`
- Responds to dashboard control events: start, stop, pause, resume

Install (on Raspberry Pi 5)
    python3 -m venv .venv && source .venv/bin/activate
    pip install -r requirements-raspi.txt

Run
    python raspi_segmentation_client.py \
       --url http://<backend-ip>:5000 \
       --device-id cam-1 \
       --weights yolov8n-seg.pt \
       --supabase-fn https://<project-ref>.functions.supabase.co/defects-upload \
       --device-token <DEVICE_INGEST_TOKEN>

Environment variables (override by CLI)
    BACKEND_URL, DEVICE_ID, SUPABASE_FUNCTION_URL, DEVICE_INGEST_TOKEN,
    CONF_THRES (0.25), IOU_THRES (0.45), FRAME_INTERVAL (0.3 seconds),
    UPLOAD_INTERVAL (1.0 seconds), MAX_UPLOADS_PER_MIN (60)

Note: For best performance on Pi 5, set camera resolution small (e.g., 640x480)
and consider using `yolov8n-seg` or a custom tiny model.
"""

from __future__ import annotations

import argparse
import base64
import os
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional, Tuple

import numpy as np

try:
    import cv2
except Exception as e:  # pragma: no cover
    print(f"OpenCV import failed: {e}", file=sys.stderr)
    cv2 = None

try:
    # python-socketio client
    import socketio  # type: ignore
except Exception as e:
    print(f"python-socketio import failed: {e}. Install with: pip install python-socketio[client]", file=sys.stderr)
    sys.exit(1)


# Optional: Ultralytics for segmentation
_YOLO_AVAILABLE = True
try:
    from ultralytics import YOLO  # type: ignore
except Exception as e:  # pragma: no cover
    _YOLO_AVAILABLE = False
    YOLO = None  # type: ignore
    print(f"Ultralytics not available: {e}. Install with: pip install ultralytics", file=sys.stderr)


def b64_jpeg(image_bgr: np.ndarray, quality: int = 75) -> Optional[str]:
    params = [int(cv2.IMWRITE_JPEG_QUALITY), int(quality)]
    ok, buf = cv2.imencode(".jpg", image_bgr, params)
    if not ok:
        return None
    return base64.b64encode(buf).decode("ascii")


@dataclass
class Detection:
    cls: str
    conf: float
    bbox_xywh: Tuple[float, float, float, float]  # center x,y,w,h in pixels
    polygon: Optional[List[Tuple[float, float]]]  # segmentation polygon (list of (x,y))


class Segmenter:
    def __init__(self, weights: str, conf: float = 0.25, iou: float = 0.45):
        if not _YOLO_AVAILABLE:
            raise RuntimeError("Ultralytics YOLO is required for segmentation. Install 'ultralytics'.")
        self.model = YOLO(weights)
        self.conf = conf
        self.iou = iou

        # Try to get class names
        self.names = None
        try:
            self.names = self.model.model.names  # newer
        except Exception:
            try:
                self.names = self.model.names  # older
            except Exception:
                self.names = None

    def infer(self, frame_bgr: np.ndarray) -> Tuple[np.ndarray, List[Detection]]:
        """Run segmentation and return overlay image + detections."""
        h, w = frame_bgr.shape[:2]
        results = self.model.predict(
            source=frame_bgr, verbose=False, conf=self.conf, iou=self.iou, imgsz=max(320, min(w, h))
        )
        dets: List[Detection] = []
        overlay = frame_bgr.copy()

        for r in results:
            # Each result has .boxes, .masks
            boxes = getattr(r, "boxes", None)
            masks = getattr(r, "masks", None)
            if boxes is None:
                continue
            # Extract arrays
            try:
                xyxy = boxes.xyxy.cpu().numpy()  # (N,4)
                confs = boxes.conf.cpu().numpy()  # (N,)
                clsi = boxes.cls.cpu().numpy().astype(int)  # (N,)
            except Exception:
                # Fallback to numpy
                xyxy = np.array(boxes.xyxy)
                confs = np.array(boxes.conf)
                clsi = np.array(boxes.cls).astype(int)

            polys = []
            if masks is not None and getattr(masks, "xy", None) is not None:
                try:
                    # List[List[np.ndarray]] where each inner is Nx2 polygon
                    polys = masks.xy
                except Exception:
                    polys = []

            for i in range(xyxy.shape[0]):
                x1, y1, x2, y2 = xyxy[i].tolist()
                cx, cy = (x1 + x2) / 2.0, (y1 + y2) / 2.0
                bw, bh = (x2 - x1), (y2 - y1)
                name = str(clsi[i])
                if self.names and 0 <= clsi[i] < len(self.names):
                    name = str(self.names[clsi[i]])
                dets.append(
                    Detection(
                        cls=name,
                        conf=float(confs[i]),
                        bbox_xywh=(float(cx), float(cy), float(bw), float(bh)),
                        polygon=[(float(px), float(py)) for px, py in (polys[i][0].tolist() if polys and len(polys) > i and len(polys[i]) > 0 else [])]
                        if masks is not None
                        else None,
                    )
                )

                # Draw overlay
                color = (0, 200, 0)
                cv2.rectangle(overlay, (int(x1), int(y1)), (int(x2), int(y2)), color, 2)
                label = f"{name} {confs[i]:.2f}"
                cv2.putText(overlay, label, (int(x1), max(0, int(y1) - 5)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1, cv2.LINE_AA)

                if masks is not None and polys and len(polys) > i and len(polys[i]) > 0:
                    poly = polys[i][0].astype(np.int32)
                    cv2.polylines(overlay, [poly], isClosed=True, color=color, thickness=2)

        return overlay, dets


def upload_defect(
    image_bgr: np.ndarray,
    defect_type: str,
    device_id: str,
    supabase_fn_url: str,
    device_token: str,
    time_text: Optional[str] = None,
    quality: int = 80,
) -> Optional[str]:
    """Upload a single defect image to the Supabase Edge Function.
    Returns response text or None on error.
    """
    import requests  # local import to avoid dependency if unused

    ok, buf = cv2.imencode(".jpg", image_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), int(quality)])
    if not ok:
        return None
    files = {
        "file": (f"{device_id}_{int(time.time())}.jpg", buf.tobytes(), "image/jpeg"),
    }
    data = {
        "defect_type": defect_type or "Defect",
        "device_id": device_id,
    }
    if time_text:
        data["time_text"] = time_text

    try:
        r = requests.post(
            supabase_fn_url,
            headers={"x-device-token": device_token},
            files=files,
            data=data,
            timeout=10,
        )
        if r.status_code // 100 == 2:
            return r.text
        else:
            print(f"Upload failed: {r.status_code} {r.text}")
            return None
    except Exception as e:
        print(f"Upload exception: {e}")
        return None


def main():
    parser = argparse.ArgumentParser(description="Raspberry Pi 5 Instance Segmentation Streamer")
    parser.add_argument("--url", default=os.getenv("BACKEND_URL", "http://localhost:5000"), help="Backend base URL")
    parser.add_argument("--device-id", default=os.getenv("DEVICE_ID", "cam-1"), help="Logical device id")
    parser.add_argument("--camera", type=int, default=0, help="Camera index for OpenCV (default 0)")
    parser.add_argument("--width", type=int, default=640, help="Capture width")
    parser.add_argument("--height", type=int, default=480, help="Capture height")
    parser.add_argument("--fps", type=int, default=15, help="Desired capture FPS")
    parser.add_argument("--interval", type=float, default=float(os.getenv("FRAME_INTERVAL", 0.3)), help="Seconds between streamed frames")
    parser.add_argument("--weights", default=os.getenv("WEIGHTS", "yolov8n-seg.pt"), help="Ultralytics YOLOv8-seg weights path")
    parser.add_argument("--conf", type=float, default=float(os.getenv("CONF_THRES", 0.25)), help="Confidence threshold")
    parser.add_argument("--iou", type=float, default=float(os.getenv("IOU_THRES", 0.45)), help="IOU threshold")
    parser.add_argument("--supabase-fn", default=os.getenv("SUPABASE_FUNCTION_URL", ""), help="Supabase defects-upload function URL")
    parser.add_argument("--device-token", default=os.getenv("DEVICE_INGEST_TOKEN", ""), help="Device ingest token for Supabase function")
    parser.add_argument("--upload-interval", type=float, default=float(os.getenv("UPLOAD_INTERVAL", 1.0)), help="Min seconds between uploads")
    parser.add_argument("--max-uploads-per-min", type=int, default=int(os.getenv("MAX_UPLOADS_PER_MIN", 60)), help="Backpressure limiter")
    parser.add_argument("--preview-quality", type=int, default=70, help="JPEG quality for preview stream (1-95)")
    args = parser.parse_args()

    if cv2 is None:
        print("OpenCV is required. Install with: pip install opencv-python", file=sys.stderr)
        sys.exit(1)
    if not _YOLO_AVAILABLE:
        print("Ultralytics is required. Install with: pip install ultralytics", file=sys.stderr)
        sys.exit(1)

    # Camera setup
    cap = cv2.VideoCapture(args.camera)
    if not cap.isOpened():
        print(f"Failed to open camera index {args.camera}", file=sys.stderr)
        sys.exit(1)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, args.width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, args.height)
    cap.set(cv2.CAP_PROP_FPS, args.fps)

    # Model
    print(f"Loading model: {args.weights}")
    segmenter = Segmenter(args.weights, conf=args.conf, iou=args.iou)
    print("Model loaded.")

    # Socket
    sio = socketio.Client()
    paused = {"value": False}
    running = {"value": True}

    @sio.event
    def connect():
        print("Connected to backend")
        sio.emit("client:hello", {"role": "device", "deviceId": args.device_id})
        sio.emit("device:register", {"deviceId": args.device_id})

    @sio.event
    def disconnect():
        print("Disconnected from backend")

    @sio.on("dashboard:start")
    def _on_start(_data):
        print("Received start")
        paused["value"] = False
        running["value"] = True

    @sio.on("dashboard:stop")
    def _on_stop(_data):
        print("Received stop")
        running["value"] = False

    @sio.on("dashboard:pause")
    def _on_pause(_data):
        print("Received pause")
        paused["value"] = True

    @sio.on("dashboard:resume")
    def _on_resume(_data):
        print("Received resume")
        paused["value"] = False

    print(f"Connecting to {args.url} ...")
    try:
        sio.connect(args.url, transports=["websocket"])
    except Exception as e:
        print(f"Socket connect failed: {e}", file=sys.stderr)
        sys.exit(1)

    last_stream = 0.0
    last_upload = 0.0
    uploads_window: List[float] = []  # timestamps of uploads in last minute

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                time.sleep(0.2)
                continue

            # Stop loop if dashboard requested stop
            if not running["value"]:
                time.sleep(0.2)
                continue

            # Inference even if paused, so we can resume with latest; but only stream/upload when not paused
            overlay, dets = segmenter.infer(frame)

            now = time.time()
            # Prepare detection payload for stream
            defects_payload = [
                {
                    "type": d.cls,
                    "score": float(d.conf),
                    "bbox": [round(x, 1) for x in d.bbox_xywh],
                    "polygon": [[round(px, 1), round(py, 1)] for (px, py) in (d.polygon or [])],
                }
                for d in dets
            ]

            if not paused["value"] and (now - last_stream) >= float(args.interval):
                img_b64 = b64_jpeg(overlay, quality=args.preview_quality)
                if img_b64 is not None:
                    sio.emit(
                        "device:frame",
                        {
                            "image": img_b64,
                            "mime": "image/jpeg",
                            "time": datetime.utcnow().isoformat(),
                            "defects": defects_payload,
                            "deviceId": args.device_id,
                        },
                    )
                last_stream = now

            # Upload throttled to Supabase (top-1 detection)
            if (
                not paused["value"]
                and args.supabase_fn
                and args.device_token
                and dets
                and (now - last_upload) >= float(args.upload_interval)
            ):
                # enforce per-minute cap
                one_min_ago = now - 60.0
                uploads_window[:] = [t for t in uploads_window if t >= one_min_ago]
                if len(uploads_window) < int(args.max_uploads_per_min):
                    # Choose highest confidence
                    best = max(dets, key=lambda d: d.conf)
                    # Optional: crop bbox region for clarity; else upload full overlay
                    cx, cy, bw, bh = best.bbox_xywh
                    x1 = max(0, int(cx - bw / 2))
                    y1 = max(0, int(cy - bh / 2))
                    x2 = min(overlay.shape[1], int(cx + bw / 2))
                    y2 = min(overlay.shape[0], int(cy + bh / 2))
                    crop = overlay[y1:y2, x1:x2]
                    if crop.size == 0:
                        crop = overlay
                    ts_label = datetime.utcnow().strftime("[%H:%M:%S]")
                    resp = upload_defect(
                        crop,
                        defect_type=best.cls,
                        device_id=args.device_id,
                        supabase_fn_url=args.supabase_fn,
                        device_token=args.device_token,
                        time_text=ts_label,
                    )
                    if resp:
                        uploads_window.append(now)
                        last_upload = now

            # Optional local preview window if running with X11/Wayland
            if os.getenv("SHOW_WINDOW", "0") == "1":
                cv2.imshow("Segmentation Preview", overlay)
                if (cv2.waitKey(1) & 0xFF) == ord("q"):
                    break

    except KeyboardInterrupt:
        print("Interrupted by user")
    finally:
        try:
            cap.release()
        except Exception:
            pass
        try:
            sio.disconnect()
        except Exception:
            pass
        try:
            if os.getenv("SHOW_WINDOW", "0") == "1":
                cv2.destroyAllWindows()
        except Exception:
            pass


if __name__ == "__main__":
    main()
