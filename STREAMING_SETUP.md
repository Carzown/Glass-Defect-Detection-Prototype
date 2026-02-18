# Live Stream Setup Guide

## 🎯 Overview

You now have a complete streaming architecture:

```
Raspberry Pi Camera
    ↓
[Streaming Script] (Python)
    ↓ (WebSocket)
[Backend Server] (Node.js)
    ↓ (WebSocket Relay)
[Frontend Dashboard] (React)
    ↓
Live Detection Preview
```

---

## 🚀 Quick Start (3 Options)

### **Option 1: Python Camera Streamer (Recommended for Pi)**

Best for: Raspberry Pi 5 with USB camera or Picamera2

**On Raspberry Pi:**

```bash
# Install dependencies
pip install opencv-python websockets

# Run the streamer
python QtApp/stream_camera.py
```

**Configuration (edit stream_camera.py):**
```python
config = {
    "backend_url": "wss://your-railway-domain:8080",
    "device_id": "raspberry-pi-1",
    "camera_index": 0,  # or use Picamera2
    "fps": 15  # Lower FPS for stable streaming
}
```

### **Option 2: Qt Application (Frame Broadcasting)**

Best for: Full Qt/C++ detection pipeline

**In detectionwidget.cpp, after detection:**
```cpp
// Send frame to backend
void DetectionWidget::broadcastFrame(const QPixmap &frame) {
    if (websocketHandler) {
        // Convert QPixmap to base64
        QByteArray imageData;
        QBuffer buffer(&imageData);
        buffer.open(QIODevice::WriteOnly);
        frame.save(&buffer, "JPG");
        QString base64 = QString::fromUtf8(imageData.toBase64());
        
        QJsonObject frameMsg;
        frameMsg["type"] = "frame";
        frameMsg["device_id"] = "raspberry-pi-1";
        frameMsg["frame"] = base64;
        
        websocketHandler->sendMessage(frameMsg);
    }
}
```

### **Option 3: HTTP POST (Fallback)**

Best for: Simple frame uploads

```bash
curl -X POST https://domain:8080/frame \
  -H "Content-Type: application/json" \
  -d '{
    "type": "frame",
    "device_id": "device-1",
    "frame": "base64_data_here"
  }'
```

---

## 📊 Architecture Details

### **Backend Streaming (already done)**

The `websocket-server.js` handles:
- Device registration (`device_register` messages)
- Frame relay (broadcasts to all web clients)
- Defect data relay
- Status updates

**What happens when Pi sends a frame:**
1. Pi connects: `device_register` → identifies as "raspberry-pi-1"
2. Pi sends: `{ type: "frame", frame: "base64_data" }`
3. Backend: Relays to all connected dashboards
4. Dashboard: Receives frame → displays in LiveDetectionPreview

### **Frontend Display**

The `LiveDetectionPreview` component shows:
- ✅ Live video feed (base64 encoded JPEG)
- ✅ Connection status (🟢 LIVE / 🟡 CONNECTING / 🔴 OFFLINE)
- ✅ Frame rate (FPS)
- ✅ Frame counter
- ✅ Beautiful dark UI with status indicator

---

## 🔌 WebSocket Message Format

### **Device → Backend**

```json
{
  "type": "device_register",
  "device_id": "raspberry-pi-1"
}
```

```json
{
  "type": "frame",
  "device_id": "raspberry-pi-1",
  "frame": "base64_encoded_jpeg_data",
  "timestamp": 1708194600000
}
```

```json
{
  "type": "defect",
  "device_id": "raspberry-pi-1",
  "defect_type": "crack",
  "confidence": 0.95,
  "timestamp": 1708194600000,
  "severity": "high"
}
```

### **Backend → Frontend**

```json
{
  "type": "frame",
  "device_id": "raspberry-pi-1",
  "frame": "base64_encoded_jpeg_data",
  "timestamp": 1708194600000
}
```

```json
{
  "type": "device_status",
  "device_id": "raspberry-pi-1",
  "status": "connected"
}
```

---

## 🧪 Testing

### **Test 1: Start Backend Locally**

```bash
cd Backend
npm start
# Server runs on http://localhost:3000
# WebSocket on ws://localhost:8080
```

### **Test 2: Run Python Streamer**

```bash
# Update config in stream_camera.py
python QtApp/stream_camera.py
# If local: "backend_url": "ws://localhost:8080"
# If Railway: "backend_url": "wss://your-domain:8080"
```

### **Test 3: Check WebSocket Health**

```bash
curl -s http://localhost:8080/health | jq
```

Expected response:
```json
{
  "status": "ok",
  "devices": ["raspberry-pi-1"],
  "webClients": 1
}
```

### **Test 4: Open Dashboard**

```
http://localhost:3000/dashboard
```

Should show:
- 🟢 LIVE status
- Live camera feed updating
- FPS counter increasing
- Frame counter incrementing

---

## 🚀 Deployment Checklist

### **Before Pushing to Railway:**

- [ ] `Backend/websocket-server.js` - Handles device registration ✅
- [ ] `Backend/server.js` - Has WebRTC endpoints ✅
- [ ] `Frontend/src/components/LiveDetectionPreview.js` - Displays frames ✅
- [ ] `QtApp/stream_camera.py` - Ready to run on Pi ✅
- [ ] Update `stream_camera.py` backend URL for your Railway domain

### **On Raspberry Pi:**

- [ ] Install Python: `sudo apt install python3-pip`
- [ ] Install dependencies: `pip install opencv-python websockets`
- [ ] Update camera index (0 for USB, or configure Picamera2)
- [ ] Set backend URL to your Railway domain
- [ ] Run: `python3 stream_camera.py`

### **Verify Deployment:**

```bash
# 1. Test backend health
curl -s https://your-domain/health

# 2. Test WebSocket health  
curl -s https://your-domain:8080/health

# 3. Open dashboard
https://your-domain/dashboard
# Should show "Connecting..." then "🟢 LIVE"
```

---

## 📝 Customization

### **Change Device ID:**

In `stream_camera.py`:
```python
config = {
    "device_id": "pi-5-glass-scanner",  # Custom ID
    ...
}
```

### **Adjust Frame Quality:**

```python
config = {
    "frame_width": 320,  # Lower = smaller file size
    "frame_height": 240,
    "fps": 10,  # Lower = less bandwidth
}
```

### **Use Picamera2 (Pi Camera Hardware):**

```python
import picamera2

cap = picamera2.Picamera2()
cap.start()

frame = cap.capture_array()
```

### **Add JPEG Compression:**

```python
# In stream_camera.py, line: 
_, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 60])
```

---

## 🐛 Troubleshooting

### **Live Feed Not Showing**

1. Check WebSocket connection:
   ```bash
   curl http://localhost:8080/health
   ```
   Should show `devices: []` or with your device

2. Check browser console (F12) for WebSocket errors
3. Verify Railway environment variables are set
4. Check that `websocket-server.js` is running

### **Camera Not Starting**

```bash
# List available cameras
ls /dev/video*
# Use correct index in config
```

### **High Latency/Dropped Frames**

1. Lower FPS in config:
   ```python
   "fps": 5  # Instead of 15
   ```

2. Lower resolution:
   ```python
   "frame_width": 320
   "frame_height": 240
   ```

3. Increase JPEG compression quality:
   ```python
   cv2.IMWRITE_JPEG_QUALITY, 50  # Lower = more compressed
   ```

### **WebSocket Connection Issues**

```python
# Add SSL verification (if needed)
import ssl
ssl_context = ssl.create_default_context()
await websockets.connect(url, ssl=ssl_context)
```

---

## 📊 Performance Expectations

| Resolution | FPS | Bandwidth | Latency |
|-----------|-----|-----------|---------|
| 640x480   | 15  | ~200 KB/s | 100-200ms |
| 320x240   | 10  | ~50 KB/s  | 50-100ms |
| 320x240   | 5   | ~25 KB/s  | 50ms |

---

## 🎯 Next Steps

1. **Test locally** with Python streamer
2. **Verify** Dashboard displays frames
3. **Deploy** to Railway
4. **Configure** Raspberry Pi with your domain
5. **Monitor** bandwidth and latency
6. **Optimize** settings based on network

---

## 📚 Related Files

- **Backend**: `Backend/websocket-server.js`
- **Frontend**: `Frontend/src/components/LiveDetectionPreview.js`
- **Streamer**: `QtApp/stream_camera.py`
- **Qt Handler**: `QtApp/websockethandler.cpp`

---

## ✨ Features Included

- ✅ Real-time frame streaming
- ✅ WebSocket relay architecture
- ✅ Base64 JPEG encoding
- ✅ Frame rate monitoring
- ✅ Connection status indicator
- ✅ Beautiful dark UI
- ✅ Responsive design
- ✅ Error handling & auto-reconnect
