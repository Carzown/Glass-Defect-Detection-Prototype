import os
import io
import argparse
import base64
from flask import Flask, request, jsonify
from PIL import Image
from ultralytics import YOLO


def load_model(model_path: str):
    if not os.path.isabs(model_path):
        model_path = os.path.abspath(model_path)
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model not found at {model_path}")
    return YOLO(model_path)


def create_app(model_path: str):
    model = load_model(model_path)
    class_names = None
    try:
        # Ultralytics model.names is a dict {class_id: name}
        names = getattr(model, 'names', None)
        if isinstance(names, dict) and len(names):
            class_names = [names[i] for i in sorted(names.keys())]
    except Exception:
        pass
    # Fallback to desired mapping if exactly 3 classes
    if not class_names:
        class_names = ['scratch', 'bubble', 'crack']

    app = Flask(__name__)

    @app.get('/health')
    def health():
        return jsonify({"ok": True, "model": os.path.basename(model_path)})

    @app.post('/infer')
    def infer():
        try:
            data = request.get_json(silent=True) or {}
            img_field = data.get('image') or data.get('base64')
            if not img_field:
                return jsonify({"boxes": []})
            # Accept data URL or raw base64
            if isinstance(img_field, str) and img_field.startswith('data:'):
                b64 = img_field.split(',', 1)[1]
            else:
                b64 = img_field
            img_bytes = base64.b64decode(b64)
            img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
            w, h = img.size

            results = model(img)
            boxes_out = []
            if results and len(results):
                r = results[0]
                # r.boxes.xyxy, r.boxes.conf, r.boxes.cls
                try:
                    import torch
                    xyxy = r.boxes.xyxy.cpu().numpy() if hasattr(r.boxes, 'xyxy') else []
                    conf = r.boxes.conf.cpu().numpy() if hasattr(r.boxes, 'conf') else []
                    cls = r.boxes.cls.cpu().numpy() if hasattr(r.boxes, 'cls') else []
                except Exception:
                    xyxy = getattr(getattr(r, 'boxes', {}), 'xyxy', []) or []
                    conf = getattr(getattr(r, 'boxes', {}), 'conf', []) or []
                    cls = getattr(getattr(r, 'boxes', {}), 'cls', []) or []

                for i in range(min(len(xyxy), 50)):
                    x1, y1, x2, y2 = [float(v) for v in xyxy[i]]
                    score = float(conf[i]) if i < len(conf) else None
                    c = int(cls[i]) if i < len(cls) else -1
                    # normalize to 0..1
                    xx = max(0.0, min(1.0, x1 / w))
                    yy = max(0.0, min(1.0, y1 / h))
                    ww = max(0.0, min(1.0, (x2 - x1) / w))
                    hh = max(0.0, min(1.0, (y2 - y1) / h))
                    label = class_names[c] if 0 <= c < len(class_names) else f"Class {c}"
                    boxes_out.append({
                        "x": xx,
                        "y": yy,
                        "width": ww,
                        "height": hh,
                        "score": score,
                        "label": label,
                    })
            return jsonify({"boxes": boxes_out})
        except Exception as e:
            return jsonify({"boxes": [], "error": str(e)})

    return app


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=5055)
    parser.add_argument('--host', type=str, default='0.0.0.0')
    parser.add_argument('--model', type=str, default=os.path.join('..', '..', 'native-glass', 'yolov11_small_model.pt'))
    args = parser.parse_args()
    app = create_app(args.model)
    app.run(host=args.host, port=args.port, debug=False)
