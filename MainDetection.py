#!/usr/bin/env python3

import cv2
import time
import uuid
import os
import tempfile
import numpy as np
from datetime import datetime
import pytz
import sys
from concurrent.futures import ThreadPoolExecutor

# ===============================
# CONSTANTS
# ===============================

FINAL_SIZE = 800
EMA_ALPHA = 0.55   # Exponential Moving Average smoothing factor

# Shared frame file read by TkinterApp for live canvas display
FRAME_PATH = os.path.join(tempfile.gettempdir(), "gdd_latest_frame.jpg")

# ===============================
# SCENE CHANGE DETECTION
# ===============================

SCENE_CHANGE_THRESHOLD = 40
SCENE_CHANGE_AREA = 0.15

previous_gray = None

# ===============================
# STABLE FRAME DETECTION
# ===============================

STABLE_FRAMES_REQUIRED = 4
last_defect_count = 0
stable_frame_counter = 0
stable_defects_buffer = []

# ===============================
# MODULE PATH
# ===============================

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'modules'))

try:
    from fps import FPS
    from config import (
        DEVICE_ID, MIN_CONFIDENCE,
        SPATIAL_DIST, WIDTH, HEIGHT,
        MODEL_NAME, ZOO_PATH, DEVICE_TYPE,
        SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BUCKET_NAME
    )
except ImportError as e:
    print(f"ERROR: Failed to import configuration: {e}")
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

# ===============================
# EMA CACHE
# ===============================

confidence_cache = {}

# ===============================
# TIMEZONE
# ===============================

ENABLE_DISPLAY = os.getenv('ENABLE_DISPLAY', 'true').lower() in ('true', '1', 'yes')
TIMEZONE = "UTC"

local_tz = pytz.UTC
try:
    local_tz = pytz.timezone(TIMEZONE)
except:
    pass

def get_timestamp():
    return datetime.now(local_tz)

# ===============================
# IMAGE PREPROCESSING
# ===============================

def preprocess_frame(frame):

    h, w, _ = frame.shape
    min_dim = min(h, w)

    x_start = (w - min_dim) // 2
    y_start = (h - min_dim) // 2

    square = frame[
        y_start:y_start + min_dim,
        x_start:x_start + min_dim
    ]

    resized = cv2.resize(
        square,
        (FINAL_SIZE, FINAL_SIZE),
        interpolation=cv2.INTER_LINEAR
    )

    gray = cv2.cvtColor(resized, cv2.COLOR_RGB2GRAY)

    rgb = cv2.cvtColor(gray, cv2.COLOR_GRAY2RGB)

    return rgb

# ===============================
# SUPABASE INIT
# ===============================

supabase = None

try:
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    print("Supabase client initialized")
except Exception as e:
    print(f"Supabase initialization failed: {e}")

# ===============================
# DEVICE STATUS HELPERS
# ===============================

def set_device_status(online: bool):
    """Upsert is_online + last_seen for this device in device_status table."""
    if not supabase:
        return
    try:
        supabase.table('device_status').upsert({
            'device_id': DEVICE_ID,
            'is_online': online,
            'last_seen': datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S+00:00'),
        }, on_conflict='device_id').execute()
    except Exception as e:
        print(f"device_status update failed: {e}")

# ===============================
# LOAD MODEL
# ===============================

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

# ===============================
# SUPABASE HELPERS
# ===============================

def upload_image_async(frame, ts):

    if not supabase:
        return None, None

    try:

        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 60])
        image_bytes = buf.tobytes()

        unique_id = uuid.uuid4().hex

        filename = f"{ts.strftime('%Y%m%d_%H%M%S_%f')}_{unique_id}.jpg"

        path = f"defects/combined/{filename}"

        supabase.storage.from_(BUCKET_NAME).upload(
            path,
            image_bytes,
            {"content-type": "image/jpeg"}
        )

        public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(path)

        return public_url, path

    except Exception as e:
        print(f"Upload failed: {e}")
        return None, None


def save_defect(defects_list, ts, image_url, image_path):

    if not supabase:
        return

    try:

        supabase.table("defects").insert({
            "detected_defects": defects_list,
            "defect_count": len(defects_list),
            "image_url": image_url,
            "image_path": image_path,
            "detected_at": ts.isoformat(),
        }).execute()

    except Exception as e:
        print(f"Database save failed: {e}")

# ===============================
# CAMERA INIT
# ===============================

try:

    picam2 = Picamera2()

    camera_config = picam2.create_video_configuration(
        main={"size": (WIDTH, HEIGHT), "format": "RGB888"},
        controls={
            "AeEnable": False,
            "AwbEnable": False,
            "ExposureTime": 15000,
            "AnalogueGain": 5.0,
            "ColourGains": (1, 1),
        },
    )

    picam2.configure(camera_config)
    picam2.start()

    time.sleep(1)

    print("Camera running with CUSTOM SETTINGS")

except Exception as e:

    print(f"Camera initialization failed: {e}")
    exit(1)


# ===============================
# FRAME GENERATOR
# ===============================

def frame_generator():

    while True:

        frame = picam2.capture_array()

        processed = preprocess_frame(frame)

        yield processed

# ===============================
# SCENE CHANGE DETECTION FUNCTION
# ===============================

def detect_scene_change(frame):

    global previous_gray

    gray = cv2.cvtColor(frame, cv2.COLOR_RGB2GRAY)

    if previous_gray is None:
        previous_gray = gray
        return False

    diff = cv2.absdiff(previous_gray, gray)

    _, thresh = cv2.threshold(diff, SCENE_CHANGE_THRESHOLD, 255, cv2.THRESH_BINARY)

    change_ratio = np.sum(thresh > 0) / thresh.size

    previous_gray = gray

    if change_ratio > SCENE_CHANGE_AREA:
        print(f"SCENE CHANGE DETECTED ({change_ratio:.2%} change)")
        return True

    return False


# ===============================
# MAIN LOOP
# ===============================

print("\nSYSTEM READY LOCAL MODE")
print("Defects uploaded ONLY ONCE per session.")
print("=" * 70)

set_device_status(True)

fps = FPS()

upload_executor = ThreadPoolExecutor(max_workers=2)

uploaded_defects_registry = []

try:

    for result in model.predict_batch(frame_generator()):

        fps.update()

        annotated = result.image_overlay
        frame_for_scene = result.image   # raw frame for scene detection

        if annotated is None:
            continue

        # Write the annotated frame to temp file so TkinterApp can display it
        cv2.imwrite(FRAME_PATH, annotated)

        if detect_scene_change(frame_for_scene):

            cleared_count = len(uploaded_defects_registry)

            uploaded_defects_registry.clear()
            confidence_cache.clear()

            stable_defects_buffer.clear()
            last_defect_count = 0
            stable_frame_counter = 0

            print(f"SCENE CHANGE DETECTED - registry cleared ({cleared_count} defects removed)")

        valid_hits = result.results

        if valid_hits:

            ts = get_timestamp()

            new_defects = []

            for hit in valid_hits:

                label = hit.get("label", "Unknown")
                conf_raw = hit.get("score", hit.get("confidence", 0.0))
                bbox = hit.get("bbox", [0, 0, 0, 0])

                cx = (bbox[0] + bbox[2]) / 2
                cy = (bbox[1] + bbox[3]) / 2

                spatial_x = int(cx / SPATIAL_DIST)
                spatial_y = int(cy / SPATIAL_DIST)

                key = f"{label}{spatial_x}{spatial_y}"

                if len(confidence_cache) > 500:
                    confidence_cache.clear()

                if key not in confidence_cache:
                    confidence_cache[key] = conf_raw
                else:
                    confidence_cache[key] = (
                        EMA_ALPHA * conf_raw +
                        (1 - EMA_ALPHA) * confidence_cache[key]
                    )

                conf = confidence_cache[key]

                is_duplicate = False
                dist_threshold_sq = SPATIAL_DIST ** 2

                for past in uploaded_defects_registry:

                    dist_sq = (cx - past['x'])**2 + (cy - past['y'])**2

                    if dist_sq < dist_threshold_sq:
                        is_duplicate = True
                        break

                if not is_duplicate:

                    print(f"NEW DETECT: {label} ({conf:.1%}) at x={int(cx)}, y={int(cy)}")

                    uploaded_defects_registry.append({
                        'x': cx,
                        'y': cy,
                        'label': label
                    })

                    new_defects.append({
                        "type": label,
                        "confidence": round(conf, 4),
                        "bbox": [
                            int(bbox[0]),
                            int(bbox[1]),
                            int(bbox[2]),
                            int(bbox[3])
                        ],
                        "center": {
                            "x": int(cx),
                            "y": int(cy)
                        }
                    })

            current_count = len(uploaded_defects_registry)

            if current_count == last_defect_count:
                stable_frame_counter += 1
            else:
                stable_frame_counter = 0
                last_defect_count = current_count

            if new_defects:
                stable_defects_buffer.extend(new_defects)

            print(f"FRAME DEFECT COUNT: {current_count} | STABLE FRAMES: {stable_frame_counter}")

            if stable_frame_counter >= STABLE_FRAMES_REQUIRED and stable_defects_buffer:

                print(f"STABLE DETECTION ACHIEVED ({current_count} defects)")

                defects_to_upload = stable_defects_buffer.copy()
                stable_defects_buffer.clear()

                def async_upload(frame_copy, defects, timestamp):

                    url, path = upload_image_async(frame_copy, timestamp)

                    if url:

                        save_defect(defects, timestamp, url, path)

                        defect_types = ", ".join([d["type"] for d in defects])

                        print(f"Saved to DB: {defect_types}")

                upload_executor.submit(
                    async_upload,
                    annotated.copy(),
                    defects_to_upload,
                    ts
                )

                stable_frame_counter = 0

        if ENABLE_DISPLAY:

            cv2.imshow("Glass Defect", annotated)

            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

except KeyboardInterrupt:
    pass

finally:

    picam2.stop()
    cv2.destroyAllWindows()
    set_device_status(False)

    print("\nSystem Stopped")
