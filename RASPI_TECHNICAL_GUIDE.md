# 🔗 Comprehensive Raspberry Pi Connection Guide

## 📖 Complete Technical Explanation

This guide explains **everything** about how your Raspberry Pi connects to the backend and streams to the frontend.

---

## 🏗️ Architecture Overview

```
┌──────────────────────┐
│  Raspberry Pi 5      │
│                      │
│ ┌────────────────┐   │
│ │   USB Camera   │   │  Captures live frames
│ └────────┬───────┘   │
│          │           │
│ ┌────────▼────────┐  │
│ │  stream_camera  │  │  Encodes to JPEG + Base64
│ │  .py Script     │  │
│ └────────┬────────┘  │
│          │           │
│ ┌────────▼────────────────────┐  │
│ │ WebSocket Client Connection │  │  Connects to Railway
│ │ wss://your-domain:8080      │  │
│ └────────┬────────────────────┘  │
│          │                        │
└──────────┼────────────────────────┘
           │ (frame data)
           │ (base64 encoded)
           │ (secure connection)
           ▼
┌────────────────────────────────────────┐
│  Railway Backend (Node.js)             │
│                                        │
│  websocket-server.js (port 8080)       │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ Device Registry                  │  │
│  │ - raspberry-pi-1 (connected)     │  │
│  │ - Stores current frame           │  │
│  └──────────────────────────────────┘  │
│          │                             │
│          │ Broadcast to all           │
│          │ connected dashboards       │
└──────────┼─────────────────────────────┘
           │
    ┌──────┴──────────────────┐
    │                         │
    ▼                         ▼
┌──────────────┐      ┌──────────────┐
│  Dashboard 1 │      │  Dashboard 2 │
│  (Browser)   │      │  (Browser)   │
│              │      │              │
│ 🟢 LIVE      │      │ 🟢 LIVE      │
│ [Video]      │      │ [Video]      │
│ 15 FPS       │      │ 15 FPS       │
└──────────────┘      └──────────────┘
```

---

## 🔌 What WebSocket Connection Means

WebSocket creates a **persistent, two-way connection** between your Pi and the backend.

```
Traditional HTTP (❌ Not used):
Pi → Request → Backend → Response → Pi
[Connection closes after each frame]
[Slow, lots of overhead]

WebSocket (✅ We use this):
Pi ←→ Backend [Connection stays open]
[Stream continuous frames]
[Low latency, efficient]
```

---

## 📡 Connection Details

### URL Format

```
wss://glass-defect-detection-prototype-production.up.railway.app:8080
│││                                                                 │
│││                                                                 └─ Port
│││                                                                    (8080 = WebSocket)
│││
││└─ S = Secure (encrypted, required for HTTPS)
│└── S = WebSocket
└─── w = Web
```

### Breaking It Down

| Part | Meaning | Example |
|------|---------|---------|
| `wss://` | WebSocket Secure | Use this (encrypted) |
| `glass-defect...app` | Your Railway domain | Your server location |
| `:8080` | Port number | WebSocket server port |

---

## 🔐 Security (WSS = Encrypted)

```
Your Pi ────[HTTPS Encryption]──────> Railway
                 ↓
           Unreadable if intercepted
```

- ✅ All data encrypted
- ✅ Safe over public WiFi
- ✅ Verified SSL certificate

---

## 📨 Message Flow - Frame by Frame

### Step 1: Device Registration (First Message)

**On startup, your Pi sends:**

```json
{
  "type": "device_register",
  "device_id": "raspberry-pi-1"
}
```

**Backend receives and logs:**
```
[Device] raspberry-pi-1 connected
```

**What this does:**
- Tells backend that your Pi is here
- Backend adds Pi to device registry
- Backend broadcasts to all dashboards: "Device connected"

---

### Step 2: Frame Streaming (Every 67ms at 15 FPS)

**Your Pi captures frame and sends:**

```json
{
  "type": "frame",
  "device_id": "raspberry-pi-1",
  "frame": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "timestamp": 1708194600000
}
```

**Breaking down the message:**

| Field | What It Is | Example |
|-------|-----------|---------|
| `type` | Message type | `"frame"` (always this for video) |
| `device_id` | Your device name | `"raspberry-pi-1"` |
| `frame` | Camera image | Base64-encoded JPEG (compressed image data) |
| `timestamp` | When captured | Unix milliseconds |

**What the "frame" field contains:**

```
Original JPEG image file:
┌──────────────────────────┐
│ 640x480 pixels           │
│ ~50-100 KB               │
└──────────────────────────┘
        ↓ (Convert to Base64)
┌──────────────────────────────────────────────────┐
│ iVBORw0KGgoAAA...rkJggg==                       │
│ (Text representation, ~30% larger)               │
└──────────────────────────────────────────────────┘
        ↓ (Send via WebSocket)
Backend receives, relays to dashboards
```

---

### Step 3: Backend Receives and Relays

**Backend (websocket-server.js) processes:**

```javascript
function handleDeviceMessage(deviceId, message) {
    if (message.type === 'frame') {
        // Store current frame
        currentFrame = message.data;
        lastFrameTime = message.timestamp;
        
        // Broadcast to ALL connected dashboards
        broadcastToWeb({
            type: 'frame',
            device_id: deviceId,
            frame: message.frame,  // Relay same base64 data
            timestamp: message.timestamp
        });
    }
}
```

**What backend does:**
1. Receives frame from Pi
2. Stores it (for new clients joining)
3. Broadcasts to all connected dashboards
4. Discards old frame

---

### Step 4: Dashboard Receives and Displays

**Frontend (LiveDetectionPreview.js) receives:**

```json
{
  "type": "frame",
  "device_id": "raspberry-pi-1",
  "frame": "iVBORw0KGgoAAAAN...",
  "timestamp": 1708194600000
}
```

**Frontend processes:**

```javascript
if (data.type === 'frame' && data.frame) {
    // Decode Base64 to image
    const imageUrl = `data:image/jpeg;base64,${data.frame}`;
    
    // Display in <img> tag
    setVideoFrame(imageUrl);
    
    // Update FPS counter
    frameCount++;
}
```

**What user sees:**
```
🟢 LIVE
FPS: 15.0
Frames: 450
[Camera image displayed and updating]
```

---

## ⏱️ Timing (at 15 FPS)

```
Time    Event
────────────────────────────────────
0ms     Pi captures frame
20ms    Pi encodes to JPEG
40ms    Pi encodes to Base64
60ms    Pi sends to backend
70ms    Backend receives
75ms    Backend relays to dashboards
100ms   Dashboard receives
120ms   Dashboard decodes & displays
150ms   User sees frame
────────────────────────
Total Latency: ~150ms (typical)
```

---

## 🔄 Frame Rate Explanation

### At 15 FPS:

```
Time    Action
──────────────────────────
0ms     Frame 1 sent
67ms    Frame 2 sent
133ms   Frame 3 sent
200ms   Frame 4 sent
...

One frame every 1000ms / 15 = 67ms
```

### Why Lower FPS When Network is Slow:

```
At 15 FPS:
- New frame every 67ms
- Data: ~100 KB per frame
- Bandwidth: 15 × 100 = 1,500 KB/s (too much!)

At 5 FPS (better for slow networks):
- New frame every 200ms
- Data: ~100 KB per frame
- Bandwidth: 5 × 100 = 500 KB/s (much better)
```

---

## 💾 Base64 Encoding (Why We Use It)

### Why Not Send Binary JPEG Directly?

```
Binary JPEG:
[0xFF, 0xD8, 0xFF, 0xE0, ...] (raw bytes)
Problem: WebSocket has trouble with some binary bytes
         May get corrupted in transmission

Base64 Encoded:
iVBORw0KGgoAAAANSUhEUg... (text only)
Solution: Text-safe format
         Can safely travel over any network
        
Trade-off:
- ~30% larger (JPEG: 50KB → Base64: 65KB)
- But safe transmission
```

---

## 🔧 Configuration Parameters Explained

### Backend URL
```python
"backend_url": "wss://glass-defect-detection-prototype-production.up.railway.app:8080"
```
- **What**: Where to send frames
- **Why**: Tells your Pi where the server is
- **Change**: Use your Railway domain

### Device ID
```python
"device_id": "raspberry-pi-1"
```
- **What**: Your Pi's unique name
- **Why**: Identify this Pi if you have multiple
- **Change**: Can be anything (e.g., "factory-cam-1")

### Frame Width & Height
```python
"frame_width": 640
"frame_height": 480
```
- **What**: Video resolution
- **Why**: Affects file size and quality
- **Change**: Lower for slow networks (320x240)

### FPS (Frames Per Second)
```python
"fps": 15
```
- **What**: How many frames per second
- **Why**: Affects smoothness and bandwidth
- **Change**: Lower for slow networks (5-10)

---

## 📊 Expected vs Actual Values

### What You Should See on Pi Terminal

```
[WebSocket Server] Starting on ws://0.0.0.0:8080
Connecting to backend: wss://glass-defect...
✅ Camera initialized (index: 0)
✅ Device 'raspberry-pi-1' registered with backend
📺 Streamed 30 frames at 15.1 FPS
📺 Streamed 60 frames at 15.0 FPS
📺 Streamed 90 frames at 14.9 FPS
```

### What Backend Logs Show

```
[Connection] New client from 192.168.1.100
[Device] raspberry-pi-1 connected
[Broadcast] Sent to 2 web clients (dashboard 1 and dashboard 2)
```

### What Dashboard Shows

```
🟢 LIVE
FPS: 15.0
Frames: 450
Status: CONNECTED
[Live camera feed updating every ~67ms]
```

---

## 🔄 Error Recovery

### If Connection Drops:

```
Python Script:
1. Detects disconnection
2. Waits 3 seconds
3. Attempts to reconnect
4. Sends device_register message again
5. Resumes streaming

No manual restart needed!
```

### If Camera Becomes Unavailable:

```
Script logs: "[Camera] Failed to read frame"
But continues trying
Resumes when camera is available again
```

---

## 🚀 Performance Optimization

### High Bandwidth Available (Good WiFi)
```python
config = {
    "frame_width": 1280,  ← Highest quality
    "frame_height": 720,
    "fps": 30,             ← Smoothest
}
```

### Limited Bandwidth (Mobile/Slow WiFi)
```python
config = {
    "frame_width": 320,   ← Lower resolution
    "frame_height": 240,
    "fps": 5,             ← Lower FPS
}
# Also lower JPEG quality: cv2.IMWRITE_JPEG_QUALITY, 50
```

---

## 🧪 Connection Testing Sequence

### Before Running Script:

```bash
# 1. Test WiFi
ping 8.8.8.8

# 2. Test DNS
ping glass-defect-detection-prototype-production.up.railway.app

# 3. Test HTTP backend
curl https://glass-defect-detection-prototype-production.up.railway.app/health

# 4. Test camera
python3 -c "import cv2; cap = cv2.VideoCapture(0); print(cap.isOpened())"

# 5. All good? Start streaming
python3 stream_camera.py
```

---

## 📈 Bandwidth Calculator

```
Formula: (frame_width × frame_height × fps) / 10

Examples:
640 × 480 × 15 / 10 = 460,800 bytes/sec ≈ 450 KB/s
320 × 240 × 10 / 10 = 76,800 bytes/sec ≈ 75 KB/s
320 × 240 × 5 / 10 = 38,400 bytes/sec ≈ 35 KB/s
```

---

## 🎯 Summary

**What happens when you run the script:**

1. **Pi connects** to `wss://your-domain:8080`
2. **Registers device** with backend
3. **Captures frames** from camera
4. **Encodes** to JPEG, then Base64
5. **Sends** via secure WebSocket
6. **Backend relays** to all connected dashboards
7. **Dashboards display** live video
8. **You see** 🟢 LIVE with live video feed

**Key points:**
- ✅ One-way stream (Pi → Backend → Dashboards)
- ✅ WebSocket (persistent connection)
- ✅ Encrypted (WSS secure)
- ✅ Auto-reconnect on failure
- ✅ Multiple dashboards supported

---

## 🆘 Troubleshooting with This Knowledge

### "Not connecting"
→ Check URL, WiFi, backend running

### "Connected but no video"
→ Check camera works, check FPS in logs

### "Video updating slowly"
→ Lower frame_width, frame_height, fps

### "High bandwidth usage"
→ Change settings above, lower JPEG quality

### "Connection keeps dropping"
→ Check WiFi signal strength, firewall

---

**Now you understand the complete architecture! 🎓**

Any questions? Refer to RASPI_SETUP_GUIDE.md for step-by-step instructions.
