from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO
import os
from PIL import Image
import io

app = Flask(__name__)
CORS(app)  # allow cross-origin requests from react-glass during development

def _find_model_path() -> str:
    here = os.path.dirname(__file__)
    candidates = [
        os.path.join(here, "model.pt"),
        os.path.join(os.getcwd(), "model.pt"),
        # Fallback to sibling App folder where model.pt likely resides
        os.path.join(os.path.dirname(here), "App", "model.pt"),
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    # As a last resort, return default name and let YOLO error clearly
    return os.path.join(here, "model.pt")

# Load YOLO model once at startup
_MODEL_PATH = _find_model_path()
try:
    model = YOLO(_MODEL_PATH)
except Exception as e:
    # Defer hard failure to inference time with clearer message
    model = None
    app.logger.error(f"Failed to load model from {_MODEL_PATH}: {e}")

@app.route('/')
def home():
    return jsonify({"message": "Glass defect detection API is running!"})

@app.route('/health', methods=['GET'])
def health():
    ok = model is not None
    return jsonify({"status": "ok" if ok else "degraded", "model_loaded": ok, "model_path": _MODEL_PATH})

@app.route('/predict', methods=['POST'])
def predict():
    # accept 'file' or 'image' field
    file = request.files.get('file') or request.files.get('image')
    if not file:
        return jsonify({"error": "No file provided. Use form field 'file' or 'image'."}), 400

    try:
        img = Image.open(io.BytesIO(file.read())).convert('RGB')
    except Exception as e:
        return jsonify({"error": f"Invalid image: {e}"}), 400

    if model is None:
        return jsonify({"error": f"Model not loaded from {_MODEL_PATH}. Check that model.pt exists and is a valid Ultralytics model."}), 500

    # Run YOLO inference
    try:
        results = model.predict(img)
    except Exception as e:
        return jsonify({"error": f"Inference failed: {e}"}), 500

    detections = []
    for result in results:
        boxes = getattr(result, 'boxes', None)
        if boxes is None:
            continue
        try:
            for box in boxes:
                # box.cls and box.conf are 1-element tensors
                cls_idx = int(box.cls[0].item()) if hasattr(box.cls, 'item') else int(box.cls[0])
                conf = float(box.conf[0].item()) if hasattr(box.conf, 'item') else float(box.conf[0])
                name = model.names[cls_idx] if isinstance(model.names, (list, dict)) else str(cls_idx)

                # Optional: include bbox coordinates if needed on frontend
                xyxy = None
                if hasattr(box, 'xyxy'):
                    try:
                        xyxy = [float(v) for v in box.xyxy[0].tolist()]
                    except Exception:
                        xyxy = None

                detections.append({
                    "class": name,
                    "class_id": cls_idx,
                    "confidence": round(conf, 4),
                    "bbox": xyxy,
                })
        except TypeError:
            # Some versions require explicit indexing rather than iteration
            b = boxes
            n = len(b) if hasattr(b, '__len__') else 0
            for i in range(n):
                box = b[i]
                cls_idx = int(box.cls[0].item())
                conf = float(box.conf[0].item())
                name = model.names[cls_idx] if isinstance(model.names, (list, dict)) else str(cls_idx)
                detections.append({
                    "class": name,
                    "class_id": cls_idx,
                    "confidence": round(conf, 4),
                })

    return jsonify({"detections": detections})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
