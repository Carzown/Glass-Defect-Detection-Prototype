"""Raspberry Pi 5 Instance Segmentation client

YOLOv11-Segmentation Real-Time Inference (Raspberry Pi 5 Client)
Detects flat-glass defects (bubble, scratch, crack)
Streams preview to backend via Socket.IO and sends cropped defect images to backend (Supabase Edge Function)

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

Also compatible with YOLOv11-style args:
    python raspi_segmentation_client.py \
    --model yolov11n-seg.pt \
    --source usb0 \
    --thresh 0.5 \
    --resolution 640x480

Environment variables (override by CLI)
    BACKEND_URL, DEVICE_ID, SUPABASE_FUNCTION_URL, DEVICE_INGEST_TOKEN,
    CONF_THRES (0.25), IOU_THRES (0.45), FRAME_INTERVAL (0.3 seconds),
    UPLOAD_INTERVAL (1.0 seconds), MAX_UPLOADS_PER_MIN (60)

Note: For best performance on Pi 5, set camera resolution small (e.g., 640x480)
and consider using `yolov8n-seg` or a custom tiny model.

Quick checklist to ensure uploads reach Supabase (DB/storage):
- Dependencies: numpy, opencv-python, requests, python-socketio[client], ultralytics (and PyTorch compatible with your device)
- Edge Function deployed: defects-upload at https://<project-ref>.functions.supabase.co/defects-upload
- Device token: pass via --device-token (function validates x-device-token)
- Run example (USB cam):
        python raspi_segmentation_client.py \
            --model yolov11n-seg.pt --source usb0 --resolution 640x480 --thresh 0.5 --glass-names \
            --supabase-fn https://<project-ref>.functions.supabase.co/defects-upload \
            --device-token <DEVICE_INGEST_TOKEN> --device-id raspi5-cam1
- Live preview (optional): set --url http://<backend-ip>:5000 to stream frames to the dashboard
- Result: top-1 detection every upload_interval seconds enqueued to uploader -> Edge Function -> storage + public.defects insert
"""

from __future__ import annotations

import argparse
import base64
import os
import sys
import time
from dataclasses import dataclass
from queue import Queue, Full, Empty
from threading import Thread
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
    def __init__(self, weights: str, conf: float = 0.25, iou: float = 0.45, imgsz: int = 480, draw_masks: bool = True):
    # Loads Ultralytics YOLO (v8 or v11) segmentation model
    # - conf, iou: inference thresholds
    # - imgsz: short edge size used by predict() to control compute
    # - draw_masks: enables polygon overlay drawing on preview
        if not _YOLO_AVAILABLE:
            raise RuntimeError("Ultralytics YOLO not available. Install with: pip install ultralytics")
        try:
            self.model = YOLO(weights)
        except Exception as e:
            raise RuntimeError(f"Failed to load YOLO weights '{weights}': {e}. Ensure the file exists or use a built-in like yolov8n-seg.pt / yolo11n-seg.pt") from e
        self.conf = conf
        self.iou = iou
        self.imgsz = int(imgsz)
        self.draw_masks = bool(draw_masks)

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
        # Resize input to reduce compute; keep aspect by using Ultralytics imgsz
        h, w = frame_bgr.shape[:2]
        imgsz = max(256, min(self.imgsz, max(w, h)))
        results = self.model.predict(
            source=frame_bgr, verbose=False, conf=self.conf, iou=self.iou, imgsz=imgsz
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

                # Draw overlay: bbox + optional mask poly
                color = (0, 200, 0)
                cv2.rectangle(overlay, (int(x1), int(y1)), (int(x2), int(y2)), color, 2)
                label = f"{name} {confs[i]:.2f}"
                cv2.putText(overlay, label, (int(x1), max(0, int(y1) - 5)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1, cv2.LINE_AA)

                if self.draw_masks and masks is not None and polys and len(polys) > i and len(polys[i]) > 0:
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
    confidence: Optional[float] = None,
    bbox: Optional[Tuple[int, int, int, int]] = None,  # (x, y, w, h)
    time_iso: Optional[str] = None,
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
    if confidence is not None:
        try:
            data["confidence"] = f"{float(confidence):.2f}"
        except Exception:
            pass
    if bbox is not None:
        try:
            x, y, w, h = bbox
            data["bbox"] = f"{int(x)},{int(y)},{int(w)},{int(h)}"
        except Exception:
            pass
    if time_iso:
        data["time_iso"] = str(time_iso)

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


class UploadWorker:
    """Background uploader to avoid blocking inference with network IO."""

    def __init__(self, maxsize: int = 4):
        self.q: "Queue[Optional[Tuple[np.ndarray, str, str, str, str, Optional[str], Optional[float], Optional[Tuple[int,int,int,int]], Optional[str], int]]]" = Queue(maxsize=maxsize)
        self.t = Thread(target=self._run, daemon=True)
        self.running = False

    def start(self):
        self.running = True
        self.t.start()

    def stop(self):
        self.running = False
        try:
            self.q.put_nowait(None)  # sentinel
        except Full:
            pass
        self.t.join(timeout=1.0)

    def submit(self, image_bgr: np.ndarray, defect_type: str, device_id: str, supabase_fn_url: str, device_token: str, time_text: Optional[str], confidence: Optional[float] = None, bbox: Optional[Tuple[int,int,int,int]] = None, time_iso: Optional[str] = None, quality: int = 80) -> bool:
        # Enqueue an upload task; returns False if queue is full (backpressure)
        try:
            img_copy = image_bgr.copy()
            self.q.put_nowait((img_copy, defect_type, device_id, supabase_fn_url, device_token, time_text, confidence, bbox, time_iso, quality))
            return True
        except Full:
            return False

    def _run(self):
        while self.running:
            try:
                item = self.q.get(timeout=0.5)
            except Empty:
                continue
            if item is None:  # sentinel
                break
        img, dcls, did, url, tok, ttext, conf, bbox, tiso, q = item
            try:
                if url and tok and img.size:
            upload_defect(img, dcls, did, url, tok, ttext, confidence=conf, bbox=bbox, time_iso=tiso, quality=q)
            except Exception as e:
                print(f"Uploader error: {e}")

def main():
    parser = argparse.ArgumentParser(description="Raspberry Pi 5 Instance Segmentation Streamer")
    parser.add_argument("--url", default=os.getenv("BACKEND_URL", "http://localhost:5000"), help="Backend base URL")
    parser.add_argument("--device-id", default=os.getenv("DEVICE_ID", "cam-1"), help="Logical device id")
    parser.add_argument("--camera", type=int, default=0, help="Camera index for OpenCV (default 0)")
    # YOLOv11-style compatibility args
    parser.add_argument("--model", help="Alias for --weights; path to YOLO model (e.g., yolov11n-seg.pt)")
    parser.add_argument("--source", help="Camera source like usb0 or media file path")
    parser.add_argument("--thresh", type=float, help="Alias for --conf threshold (e.g., 0.5)")
    parser.add_argument("--resolution", help="Resolution WxH (e.g., 640x480)")
    parser.add_argument("--width", type=int, default=640, help="Capture width")
    parser.add_argument("--height", type=int, default=480, help="Capture height")
    parser.add_argument("--fps", type=int, default=15, help="Desired capture FPS")
    parser.add_argument("--interval", type=float, default=float(os.getenv("FRAME_INTERVAL", 0.3)), help="Seconds between streamed frames")
    parser.add_argument("--weights", default=os.getenv("WEIGHTS", "yolov8n-seg.pt"), help="Ultralytics YOLOv8-seg weights path")
    parser.add_argument("--conf", type=float, default=float(os.getenv("CONF_THRES", 0.25)), help="Confidence threshold")
    parser.add_argument("--iou", type=float, default=float(os.getenv("IOU_THRES", 0.45)), help="IOU threshold")
    parser.add_argument("--imgsz", type=int, default=int(os.getenv("IMGSZ", 480)), help="Model input size (short edge), e.g., 320-640")
    parser.add_argument("--infer-interval", type=float, default=float(os.getenv("INFER_INTERVAL", 0.15)), help="Seconds between YOLO inferences (rate limit)")
    parser.add_argument("--infer-when-paused", action="store_true", help="Keep running inference while paused (default off)")
    parser.add_argument("--supabase-fn", default=os.getenv("SUPABASE_FUNCTION_URL", ""), help="Supabase defects-upload function URL")
    parser.add_argument("--device-token", default=os.getenv("DEVICE_INGEST_TOKEN", ""), help="Device ingest token for Supabase function")
    parser.add_argument("--upload-interval", type=float, default=float(os.getenv("UPLOAD_INTERVAL", 1.0)), help="Min seconds between uploads")
    parser.add_argument("--max-uploads-per-min", type=int, default=int(os.getenv("MAX_UPLOADS_PER_MIN", 60)), help="Backpressure limiter")
    parser.add_argument("--preview-quality", type=int, default=70, help="JPEG quality for preview stream (1-95)")
    parser.add_argument("--preview-scale", type=float, default=float(os.getenv("PREVIEW_SCALE", 0.75)), help="Scale factor for preview image encoding (0.3-1.0)")
    parser.add_argument("--upload-max-size", type=int, default=int(os.getenv("UPLOAD_MAX_SIZE", 320)), help="Max width/height for upload crop resize")
    parser.add_argument("--draw-masks", action="store_true", help="Draw polygon masks (disabling saves CPU)")
    parser.add_argument("--cv2-threads", type=int, default=int(os.getenv("CV2_THREADS", 1)), help="OpenCV thread count (1 recommended on Pi)")
    parser.add_argument("--no-upload", action="store_true", help="Disable defect image uploads (for testing/network saving)")
    parser.add_argument("--include-score", action="store_true", help="Include confidence score in defects payload (dashboard optional)")
    parser.add_argument("--show", action="store_true", help="Show local preview window (same as SHOW_WINDOW=1)")
    parser.add_argument("--glass-names", action="store_true", help="Override model class names to bubble/scratch/crack")
    parser.add_argument("--upload-all", action="store_true", help="Upload all detections per frame (throttled)")
    parser.add_argument("--max-uploads-per-frame", type=int, default=2, help="Cap uploads per frame when --upload-all is set")
    args = parser.parse_args()

    if cv2 is None:
        print("OpenCV is required. Install with: pip install opencv-python", file=sys.stderr)
        sys.exit(1)
    if not _YOLO_AVAILABLE:
        print("Ultralytics is required. Install with: pip install ultralytics", file=sys.stderr)
        sys.exit(1)

    # Map YOLOv11-style args to existing flags
    if getattr(args, "model", None):
        args.weights = args.model  # prefer --model if provided
    if getattr(args, "thresh", None) is not None:
        args.conf = args.thresh
    if getattr(args, "resolution", None):
        try:
            w_str, h_str = str(args.resolution).lower().split("x")
            args.width, args.height = int(w_str), int(h_str)
        except Exception:
            print(f"Invalid --resolution format: {args.resolution}, expected WxH like 640x480", file=sys.stderr)
    if args.show:
        os.environ["SHOW_WINDOW"] = "1"

    # OpenCV threads control
    try:
        if hasattr(cv2, "setNumThreads"):
            cv2.setNumThreads(int(args.cv2_threads))
    except Exception:
        pass

    # Source setup: support --source like 'usb0' or path to media file
    cap = None
    if getattr(args, "source", None):
        src = args.source
        if isinstance(src, str) and src.startswith("usb") and src[3:].isdigit():
            cam_idx = int(src[3:])
            cap = cv2.VideoCapture(cam_idx)
        elif isinstance(src, str) and os.path.exists(src):
            cap = cv2.VideoCapture(src)
        else:
            print(f"Invalid --source: {src}. Use usb0/usb1 or a valid file path.", file=sys.stderr)
            cap = cv2.VideoCapture(args.camera)
    else:
        cap = cv2.VideoCapture(args.camera)
    if not cap.isOpened():
        print(f"Failed to open camera index {args.camera}", file=sys.stderr)
        sys.exit(1)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, args.width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, args.height)
    cap.set(cv2.CAP_PROP_FPS, args.fps)

    # Model
    print(f"Loading model: {args.weights}")
    segmenter = Segmenter(args.weights, conf=args.conf, iou=args.iou, imgsz=args.imgsz, draw_masks=args.draw_masks)
    # Optionally override class names to glass defects
    if getattr(args, "glass_names", False):
        try:
            # Override underlying model names if available
            if hasattr(segmenter.model, "model") and hasattr(segmenter.model.model, "names"):
                segmenter.model.model.names = {0: "bubble", 1: "scratch", 2: "crack"}
            elif hasattr(segmenter.model, "names"):
                segmenter.model.names = {0: "bubble", 1: "scratch", 2: "crack"}
            segmenter.names = ["bubble", "scratch", "crack"]
            print("Glass class names set: bubble, scratch, crack")
        except Exception:
            print("Warning: could not override model class names", file=sys.stderr)
    print("Model loaded.")

    # Socket: connect for dashboard streaming & control events (start/stop/pause/resume)
    sio = socketio.Client(reconnection=True, reconnection_attempts=0, reconnection_delay=1.0, reconnection_delay_max=5.0)
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

    # Timers for rate-limiting streaming, uploads, and inference
    last_stream = 0.0
    last_upload = 0.0
    last_infer = 0.0
    uploads_window: List[float] = []  # timestamps of uploads in last minute

    # Background uploader
    uploader = UploadWorker(maxsize=4)
    uploader.start()

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

            # Only run inference at configured rate; optionally skip when paused
            run_infer = (time.time() - last_infer) >= float(args.infer_interval) and (not paused["value"] or args.infer_when_paused)
            if run_infer:
                overlay, dets = segmenter.infer(frame)
                last_infer = time.time()
            else:
                # If skipping inference, keep previous overlay/dets if exist
                try:
                    overlay
                except NameError:
                    overlay = frame
                try:
                    dets
                except NameError:
                    dets = []

            now = time.time()
            # Prepare detection payload for stream (align to backend README)
            # Convert center-based bbox (cx,cy,w,h) -> top-left (x,y,w,h) ints
            defects_payload = []
            for d in dets:
                cx, cy, bw, bh = d.bbox_xywh
                x = int(max(0, cx - bw / 2))
                y = int(max(0, cy - bh / 2))
                w_box = int(max(1, bw))
                h_box = int(max(1, bh))
                entry = {
                    "type": d.cls,
                    "bbox": [x, y, w_box, h_box],
                }
                if args.include_score:
                    entry["score"] = round(float(d.conf), 3)
                defects_payload.append(entry)

            if not paused["value"] and (now - last_stream) >= float(args.interval):
                # Downscale preview before JPEG to reduce CPU/network
                if 0.2 <= float(args.preview_scale) < 1.0:
                    ph, pw = overlay.shape[:2]
                    new_w = max(64, int(pw * float(args.preview_scale)))
                    new_h = max(48, int(ph * float(args.preview_scale)))
                    preview_img = cv2.resize(overlay, (new_w, new_h), interpolation=cv2.INTER_AREA)
                else:
                    preview_img = overlay
                img_b64 = b64_jpeg(preview_img, quality=args.preview_quality)
                if img_b64 is not None:
                    sio.emit(
                        "device:frame",
                        {
                            "image": img_b64,
                            "mime": "image/jpeg",
                            "time": datetime.utcnow().isoformat(timespec="seconds") + "Z",
                            "defects": defects_payload,
                            "deviceId": args.device_id,
                        },
                    )
                last_stream = now

            # Upload throttled to Supabase (top-1 detection by default or all if --upload-all)
            if (
                not paused["value"]
                and args.supabase_fn
                and args.device_token
                and dets
                and (now - last_upload) >= float(args.upload_interval)
                and not args.no_upload
            ):
                # enforce per-minute cap
                one_min_ago = now - 60.0
                uploads_window[:] = [t for t in uploads_window if t >= one_min_ago]
                if len(uploads_window) < int(args.max_uploads_per_min):
                    # Select detections to upload
                    det_list = dets
                    if not args.upload_all:
                        det_list = [max(dets, key=lambda d: d.conf)]
                    # Apply per-frame cap when uploading all
                    det_list = det_list[: max(1, int(args.max_uploads_per_frame))]

                    # Upload each selected detection (cropped from original frame for clarity)
                    for sel in det_list:
                        cx, cy, bw, bh = sel.bbox_xywh
                        x1 = max(0, int(cx - bw / 2))
                        y1 = max(0, int(cy - bh / 2))
                        x2 = min(frame.shape[1], int(cx + bw / 2))
                        y2 = min(frame.shape[0], int(cy + bh / 2))
                        crop = frame[y1:y2, x1:x2]
                        if crop.size == 0:
                            crop = frame
                            x1, y1, x2, y2 = 0, 0, frame.shape[1], frame.shape[0]
                        # Resize crop to reduce upload size
                        um = int(args.upload_max_size)
                        ch, cw = crop.shape[:2]
                        scale = min(1.0, float(um) / max(ch, cw)) if max(ch, cw) > um else 1.0
                        if scale < 1.0:
                            new_cw = max(16, int(cw * scale))
                            new_ch = max(16, int(ch * scale))
                            crop = cv2.resize(crop, (new_cw, new_ch), interpolation=cv2.INTER_AREA)

                        ts_label = datetime.utcnow().strftime("[%H:%M:%S]")
                        ts_iso = datetime.utcnow().isoformat(timespec="seconds") + "Z"
                        bbox_xywh = (int(max(0, cx - bw / 2)), int(max(0, cy - bh / 2)), int(max(1, bw)), int(max(1, bh)))

                        ok_enq = uploader.submit(
                            crop,
                            defect_type=sel.cls,
                            device_id=args.device_id,
                            supabase_fn_url=args.supabase_fn,
                            device_token=args.device_token,
                            time_text=ts_label,
                            confidence=sel.conf,
                            bbox=bbox_xywh,
                            time_iso=ts_iso,
                            quality=min(85, max(60, int(args.preview_quality)))
                        )
                        if ok_enq:
                            uploads_window.append(now)
                            last_upload = now

            # Optional local preview window if running with X11/Wayland or --show
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
            uploader.stop()
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
