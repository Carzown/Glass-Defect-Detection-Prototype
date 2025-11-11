# Backend Server (Raspberry Pi 5 / Edge Device Streaming)

This server accepts live video frames from a Raspberry Pi 5 (or any edge device) over Socket.IO and broadcasts them to the web dashboard.

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

Edge device (Raspberry Pi) emits to server (preferred names):

- `device:register` `{ deviceId?: string }`
- `device:frame` `{ image: string(base64 without prefix), mime?: 'image/jpeg'|'image/png', time?: string ISO, defects?: Array<{ type: string, bbox?: [x,y,w,h] }> }`
- `device:status` `{ online: boolean, deviceId?: string }`

Legacy Jetson event names are still accepted (`jetson:register`, `jetson:frame`, `jetson:status`) for backward compatibility.

Dashboard emits control events (broadcast to all devices or filtered by `deviceId` if provided):

- `dashboard:start` `{ deviceId?: string }`
- `dashboard:stop` `{ deviceId?: string }`
- `dashboard:pause` `{ deviceId?: string }`
- `dashboard:resume` `{ deviceId?: string }`

Server broadcasts to dashboards:

- `stream:frame` `{ dataUrl: string, time: string, defects: Array<...>, deviceId?: string }`
- `device:status` `{ online: boolean, deviceId?: string }` (also legacy `jetson:status` when origin uses jetson name)

## Raspberry Pi 5 example sender

See `raspi_client_example.py` for a minimal client that captures frames via OpenCV and sends them to the backend. On Raspberry Pi 5:

```
pip install opencv-python python-socketio[client]
python raspi_client_example.py --url http://<server-ip>:5000 --device-id cam-1
```

Insert your defect detection into the script and populate the `defects` array to surface detections on the dashboard.
