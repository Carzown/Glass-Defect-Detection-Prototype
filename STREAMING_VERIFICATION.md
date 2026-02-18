# ✅ Live Detection Streaming - Configuration & Connection Flow

## 🔧 Issues Fixed

### 1. **Frame Message Format** 
- **main.py**: Now sends `{"type": "frame", "frame": "base64_string"}` (clean base64)
- **websocket-server.js**: Strips any `data:` prefix and relays with `frame` key
- **Frontend**: Receives and wraps with `data:image/jpeg;base64,` as needed

### 2. **Web Client Registration**
- **Dashboard.js**: Now sends `{"type": "web_client"}` 
- **websocket-server.js**: Accepts both `{"type": "web_client"}` and `{"type": "register", "client_type": "web_client"}`

### 3. **Backend Relay**
- Clean base64 extraction from frame data
- Consistent JSON message structure to all web clients

---

## 🔄 Complete Connection Flow

```
┌─────────────────────────────────────────────────────────────┐
│ RASPBERRY PI (main.py)                                       │
│ - Picamera2 captures 768x768 frame                          │
│ - Hailo 8 runs YOLOv8m AI inference                         │
│ - Annotates frame with detection boxes                      │
│ - Encodes to JPEG, base64 encodes                           │
│ - Sends: {"type": "frame", "frame": "base64_data"}          │
└──────────────┬──────────────────────────────────────────────┘
               │ wss://railway-domain:8080
               ▼
┌──────────────────────────────────────────────────────────────┐
│ RAILWAY BACKEND (websocket-server.js)                        │
│ - Port 8080 receives WebSocket connections                  │
│ - Pi connects as device, sends frames                       │
│ - Web clients connect as web_client                         │
│ - Relays frame to ALL connected dashboards:                 │
│   {"type": "frame", "frame": "base64", "device_id": "..."} │
└──────────────┬──────────────────────────────────────────────┘
               │ wss://railway-domain:8080
               ▼
┌──────────────────────────────────────────────────────────────┐
│ FRONTEND DASHBOARD (GitHub Pages or local)                   │
│ - React component connects WebSocket to backend             │
│ - Receives frame messages                                    │
│ - Wraps base64: `data:image/jpeg;base64,{base64}`          │
│ - Displays in <img> or <LiveDetectionPreview>              │
│ - Shows 🟢 LIVE indicator when connected                    │
│ - Displays FPS counter, frame count, status                 │
└──────────────────────────────────────────────────────────────┘
```

---

## ⚙️ Configuration Required

### 1. **main.py** - Raspberry Pi
```bash
# Edit ~/modules/config.py
DEVICE_ID = "raspi-pi-1"
BACKEND_URL = "https://glass-defect-detection-prototype-production.up.railway.app"
WIDTH = 768
HEIGHT = 768
MIN_CONFIDENCE = 0.5
```

### 2. **backend** - Already Deployed on Railway
- WebSocket server on port 8080
- Listens for device registrations
- Broadcasts frames to all web clients
- Health check endpoint: `/health`

### 3. **Frontend** - React Application
- Connects to WebSocket on Railway domain
- Url: `wss://your-railway-domain:8080`
- Registers as `web_client`
- Displays live video from Pi

---

## 🧪 Testing the Connection

### Test 1: Check Backend Health
```bash
curl https://glass-defect-detection-prototype-production.up.railway.app:8080/health
```

Expected:
```json
{"status":"ok","devices":[],"webClients":0}
```

### Test 2: Run main.py on Pi
```bash
python3 main.py
```

Watch for:
- ✅ `AI Model loaded on Hailo accelerator`
- ✅ `WebSocket connected`
- ✅ `Device 'raspi-pi-1' registered with backend`

### Test 3: Open Dashboard
```
https://github-pages-url.github.io/dashboard
```

Watch for:
- ✅ `🟢 LIVE` indicator turns green
- ✅ Video feed appears (768x768 annotated frame)
- ✅ FPS counter shows ~15
- ✅ Frame count incrementing

### Test 4: Check Backend Status During Stream
```bash
curl https://glass-defect-detection-prototype-production.up.railway.app:8080/health
```

Should show:
```json
{"status":"ok","devices":["raspi-pi-1"],"webClients":1}
```

---

## 🔍 Troubleshooting

### Dashboard shows 🔴 OFFLINE
- Check REACT_APP_WS_URL environment variable
- Verify Railway backend is running
- Check browser console (F12) for WebSocket errors

### Pi not registering with backend
- Verify BACKEND_URL in config.py
- Check network connectivity: `ping your-domain`
- Verify port 8080 is open on Railway

### No video in dashboard, but connected
- Check main.py is sending frames in loop
- Verify `send_frame()` is being called
- Check Pi console for frame send errors

### High latency / slow updates
- Reduce frame resolution in config.py (768→512)
- Lower JPEG quality in main.py (85→70)
- Check network bandwidth

---

## 📊 Expected Metrics

**Pi CPU/Memory Usage:**
- CPU: 40-60% (Hailo accelerates AI)
- Memory: 400-600 MB
- Network: 400-800 KB/s (depends on resolution)

**Dashboard FPS:**
- 10-15 FPS (768x768 frames)
- Higher if resolution reduced
- Depends on network latency

---

## ✅ Checklist for Working End-to-End

- [ ] main.py edited with correct BACKEND_URL and DEVICE_ID
- [ ] modules/config.py created with settings
- [ ] main.py connects and shows "✅ WebSocket connected"
- [ ] Backend health check shows device connected
- [ ] Dashboard WebSocket URL is correct
- [ ] Dashboard green 🟢 LIVE indicator shows
- [ ] Live 768x768 frames appear in dashboard
- [ ] FPS counter shows 10-15 FPS
- [ ] Defect detections appear in dashboard list
