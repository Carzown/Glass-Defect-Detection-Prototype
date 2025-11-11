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

Admin API (secure via header `x-admin-token: <ADMIN_API_TOKEN>`):

- List users: `GET /admin/users`
- Change password: `POST /admin/users/:id/password` with JSON `{ "password": "newStrongPass" }`

Required env vars for Admin API:

```
SUPABASE_URL=...                  # your project URL
SUPABASE_SERVICE_ROLE_KEY=...     # service role key (keep secret)
ADMIN_API_TOKEN=...               # random secret for backend admin routes
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

## Raspberry Pi 5 clients

### Minimal preview sender
See `raspi_client_example.py` for a minimal client that captures frames via OpenCV and sends them to the backend. On Raspberry Pi 5:

```
pip install opencv-python python-socketio[client]
python raspi_client_example.py --url http://<server-ip>:5000 --device-id cam-1
```

### Instance segmentation sender (YOLOv8-seg)
For end-to-end live detection + database inserts, use `raspi_segmentation_client.py` which:
- runs YOLOv8-seg on the Pi, draws masks/boxes
- streams annotated frames to the dashboard
- uploads detected defects to Supabase storage + `public.defects` via the `defects-upload` Edge Function

Install dependencies on the Pi (recommend a venv):

```
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-raspi.txt
```

Run (replace with your values):

```
python raspi_segmentation_client.py \
	--url http://<backend-ip>:5000 \
	--device-id cam-1 \
	--weights yolov8n-seg.pt \
	--supabase-fn https://<project-ref>.functions.supabase.co/defects-upload \
	--device-token <DEVICE_INGEST_TOKEN>
```

Environment variables (optional instead of flags):

```
BACKEND_URL=http://<backend-ip>:5000
DEVICE_ID=cam-1
SUPABASE_FUNCTION_URL=https://<project-ref>.functions.supabase.co/defects-upload
DEVICE_INGEST_TOKEN=<DEVICE_INGEST_TOKEN>
CONF_THRES=0.25
IOU_THRES=0.45
FRAME_INTERVAL=0.3
UPLOAD_INTERVAL=1.0
MAX_UPLOADS_PER_MIN=60
SHOW_WINDOW=0
```

Notes:
- Use small resolutions like 640x480 and `yolov8n-seg.pt` for speed on Pi 5.
- Ensure the Supabase SQL (`supabase/sql/defects.sql`) is applied and the Edge Function is deployed.
- The backend must be reachable from the Pi (open firewall/ports).

