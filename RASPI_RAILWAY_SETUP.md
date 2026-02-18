# 🚀 Raspberry Pi → Railway Backend → GitHub Pages Frontend

## Architecture

```
Raspberry Pi Camera
    ↓ (WebSocket)
Railway Backend (websocket-server.js:8080)
    ↑
    ↓ (Broadcasts to all connected web clients)
GitHub Pages Frontend (React Dashboard)
```

---

## Raspberry Pi Setup (5 Steps)

### 1️⃣ Install Dependencies
```bash
ssh pi@raspberrypi.local
sudo apt install python3 python3-pip -y
pip install opencv-python websockets
```

### 2️⃣ Download Streaming Script
```bash
cd ~
wget https://raw.githubusercontent.com/Carzown/Glass-Defect-Detection-Prototype/main/QtApp/stream_camera.py
```

### 3️⃣ Configure for Railway Backend
```bash
nano ~/stream_camera.py
```

**Change line ~100:**
```python
config = {
    "backend_url": "wss://glass-defect-detection-prototype-production.up.railway.app:8080",
    "device_id": "raspberry-pi-1",
    "fps": 15
}
```

### 4️⃣ Run the Streamer
```bash
python3 ~/stream_camera.py
```

**Expected Output:**
```
✅ Camera initialized
✅ Device registered
📺 Streamed 30 frames...
```

### 5️⃣ View on GitHub Pages Frontend
```
Go to: https://your-github-pages-domain/dashboard
Should show: 🟢 LIVE with live camera feed
```

---

## What Raspberry Pi Does

- ✅ Connects to Railway backend via WebSocket
- ✅ Sends camera frames as base64-encoded JPEG
- ✅ Sends 15 frames per second
- ✅ Automatically reconnects if disconnected

**That's it. The frontend automatically receives the stream from the backend.**
