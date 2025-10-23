# Backend Server (Jetson Streaming)

This server accepts live video frames from a Jetson device (or any client) over Socket.IO and broadcasts them to the web dashboard.

## Run

1. Install dependencies:

```
npm install
```

2. Start the server:

```
npm start
```

The server listens on `http://localhost:5000` by default.

Health check:

```
GET http://localhost:5000/health
```

## Socket Protocol

Jetson/client emits to server:

- `jetson:register` `{ deviceId?: string }`
- `jetson:frame` `{ image: string(base64 without prefix), mime?: 'image/jpeg'|'image/png', time?: string ISO, defects?: Array<{ type: string, bbox?: [x,y,w,h] }> }`
- `jetson:status` `{ online: boolean, deviceId?: string }`

Server emits to dashboards:

- `stream:frame` `{ dataUrl: string, time: string, defects: Array<...>, deviceId?: string }`
- `jetson:status` `{ online: boolean, deviceId?: string }`

## Jetson example sender

See `jetson_client_example.py` for a minimal client that captures frames via OpenCV and sends them to the backend. On Jetson:

```
pip install opencv-python python-socketio[client]
python jetson_client_example.py --url http://<server-ip>:5000 --device-id cam-1
```

Insert your defect detection into the script and populate the `defects` array to surface detections on the dashboard.
