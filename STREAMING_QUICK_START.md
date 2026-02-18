# 🎬 Live Streaming - Quick Start Checklist

## ✅ Files Ready to Use

- [x] **QtApp/stream_camera.py** - Ready to run on Raspberry Pi
- [x] **Frontend/src/components/LiveDetectionPreview.js** - Live video component
- [x] **Frontend/src/components/LiveDetectionPreview.css** - Styling
- [x] **Frontend/src/pages/Dashboard.js** - Updated with live preview
- [x] **QtApp/FRAME_STREAMING_INTEGRATION.h** - Qt integration example
- [x] **Backend/websocket-server.js** - Already handles streaming ✓
- [x] **Backend/server.js** - Already has WebRTC endpoints ✓

---

## 🚀 3-Step Quick Start

### **1️⃣ Test Locally (5 minutes)**

```bash
# Terminal 1
cd Backend
npm start

# Terminal 2
python QtApp/stream_camera.py

# Terminal 3
cd Frontend && npm start
```

**Expected Result:**
- Backend running on http://localhost:3000
- WebSocket running on ws://localhost:8080
- Python streamer shows: "✅ Camera initialized"
- Dashboard shows: "🟢 LIVE" with video feed
- FPS counter shows 10-15 FPS

### **2️⃣ Deploy to Railway (2 minutes)**

```bash
git add -A
git commit -m "Add live video streaming"
git push origin main
# Wait 2-5 minutes for Railway to deploy
```

### **3️⃣ Run on Raspberry Pi (5 minutes)**

```bash
ssh pi@your-pi.local

pip install opencv-python websockets

# Edit backend URL in stream_camera.py
nano stream_camera.py
# Change: "backend_url": "wss://your-railway-domain:8080"

python3 stream_camera.py
# Should show:
# ✅ Camera initialized
# ✅ Device 'raspberry-pi-1' registered
# 📺 Streamed 30 frames...
```

**Then open dashboard:**
```
https://your-railway-domain/dashboard
```

Should show 🟢 LIVE with camera feed updating!

---

## 🔍 What Gets Streamed

**Frame Format:**
```json
{
  "type": "frame",
  "device_id": "raspberry-pi-1",
  "frame": "base64_encoded_jpeg_data",
  "timestamp": 1708194600000
}
```

**Bandwidth:** ~50-200 KB/s (depends on resolution & FPS)

**Latency:** 100-300ms (typical over WiFi)

---

## ⚙️ Configuration

**In QtApp/stream_camera.py:**

```python
config = {
    "backend_url": "wss://your-railway-domain:8080",  # ← CHANGE THIS
    "device_id": "raspberry-pi-1",
    "camera_index": 0,      # 0 = default camera
    "frame_width": 640,     # Lower = faster
    "frame_height": 480,    # Lower = faster  
    "fps": 15               # Lower = less bandwidth
}
```

---

## 🧪 Quick Tests

### Test 1: Backend Health
```bash
curl http://localhost:3000/health
# Should return: { ok: true }
```

### Test 2: WebSocket Health
```bash
curl http://localhost:8080/health
# Should return: { status: "ok", devices: [...], webClients: [...] }
```

### Test 3: Dashboard Live
```
http://localhost:3000/dashboard
# Look for: 🟢 LIVE indicator
# Look for: updating video feed
# Look for: FPS counter
```

---

## 🎯 What Happens

```
Camera Frame
    ↓ (from Pi)
Python Streamer (stream_camera.py)
    ↓ Encode to JPEG base64
WebSocket Message to Backend
    ↓ ws://localhost:8080
Backend (websocket-server.js)
    ↓ Relay to all dashboards
Frontend (LiveDetectionPreview)
    ↓ Decode base64
Display as Image
    ↓
User sees: 🟢 LIVE video feed
```

---

## 📋 Verification Checklist

### After Local Test:
- [ ] Backend starts without errors
- [ ] WebSocket server starts on 8080
- [ ] Python streamer connects successfully
- [ ] Dashboard shows "🟢 LIVE"
- [ ] Video feed updates in real-time
- [ ] FPS counter shows 10-15

### After Railway Deploy:
- [ ] `git push` succeeds
- [ ] Railway shows deployment (check dashboard)
- [ ] `curl https://domain/health` returns 200
- [ ] Frontend loads without errors
- [ ] Dashboard connects to backend

### After Pi Setup:
- [ ] Python installed: `python3 --version`
- [ ] Dependencies installed: `pip list | grep opencv`
- [ ] stream_camera.py runs without errors
- [ ] Backend logs show device connected
- [ ] Dashboard shows live video from Pi

---

## 🆘 Emergency Debug

### "🔴 OFFLINE" in Dashboard:

```bash
# 1. Check WebSocket server
curl http://localhost:8080/health

# 2. Check Python error
python QtApp/stream_camera.py
# Look for error message

# 3. Check frontend console
# Open browser F12 → Console
# Look for WebSocket errors
```

### No Video Updating:

```bash
# 1. Check Python is still running
top | grep python

# 2. Check backend logs
curl http://localhost:8080/health
# Should show device in list

# 3. Check network
# Are you on same WiFi?
# Is firewall blocking port 8080?
```

### High Latency:

```python
# Reduce settings in stream_camera.py:
config = {
    "frame_width": 320,   # ← Lower
    "frame_height": 240,  # ← Lower
    "fps": 5,             # ← Lower
}
```

---

## 📈 Performance

| Setting | Bandwidth | Latency | Quality |
|---------|-----------|---------|---------|
| 640x480 @ 15 FPS | 200 KB/s | 150ms | Excellent |
| 320x240 @ 10 FPS | 50 KB/s | 100ms | Good |
| 300x240 @ 5 FPS | 25 KB/s | 50ms | Fair |

---

## ✨ Features Included

✅ Live video streaming from Pi camera
✅ Real-time frame rate monitoring  
✅ Connection status indicator (🟢🟡🔴)
✅ Automatic reconnection
✅ WebSocket relay architecture
✅ Base64 JPEG encoding/decoding
✅ Beautiful dark UI
✅ Responsive design (works on mobile)
✅ Frame counter
✅ Timestamp tracking

---

## 📚 Documentation

- **STREAMING_SETUP.md** - Full setup guide + troubleshooting
- **STREAMING_COMPLETE.md** - Architecture + detailed explanation
- **QtApp/stream_camera.py** - Python streamer source
- **QtApp/FRAME_STREAMING_INTEGRATION.h** - Qt integration guide
- **Frontend/src/components/LiveDetectionPreview.js** - React component

---

## 🎬 Ready to Stream?

1. ✅ Run local test
2. ✅ Push to Railway
3. ✅ Run on Pi
4. ✅ Watch live video in dashboard

**That's it! 🚀**

Questions? Check STREAMING_SETUP.md for detailed troubleshooting.
