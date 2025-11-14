from flask import Flask, request, jsonify
import argparse

app = Flask(__name__)

@app.route('/infer', methods=['POST'])
def infer():
    try:
        # Accept JSON with image but ignore it for fallback
        data = request.get_json(force=True)
    except Exception:
        data = None
    # Return a fixed placeholder detection normalized 0..1
    return jsonify({
        "boxes": [
            {"x": 0.25, "y": 0.2, "width": 0.5, "height": 0.6, "score": 0.9, "label": "Defect"}
        ]
    })

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=5055)
    args = parser.parse_args()
    app.run(host='0.0.0.0', port=args.port)
