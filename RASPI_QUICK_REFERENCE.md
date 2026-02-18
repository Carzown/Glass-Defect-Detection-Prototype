# 🎯 Raspberry Pi Setup - Quick Reference Card

## 📋 TL;DR - Copy & Paste Commands

### 1️⃣ SSH into Pi
```bash
ssh pi@raspberrypi.local
# Or: ssh pi@<pi-ip-address>
```

### 2️⃣ Install Dependencies (Copy all at once)
```bash
sudo apt update && sudo apt upgrade -y && sudo apt install python3 python3-pip -y && pip install opencv-python websockets
```

### 3️⃣ Get the Script
```bash
cd ~ && wget https://raw.githubusercontent.com/Carzown/Glass-Defect-Detection-Prototype/main/QtApp/stream_camera.py
```

### 4️⃣ Edit Configuration
```bash
nano ~/stream_camera.py
```
**Change these 2 lines (around line 100-105):**
```python
"backend_url": "wss://glass-defect-detection-prototype-production.up.railway.app:8080",  # CHANGE THIS
"device_id": "raspberry-pi-1",  # Change if you want
```
**Save:** Ctrl+X, Y, Enter

### 5️⃣ Test Camera
```bash
python3 -c "import cv2; cap = cv2.VideoCapture(0); print('✅ Camera OK!' if cap.isOpened() else '❌ Camera FAILED')"
```

### 6️⃣ Run Streamer
```bash
python3 ~/stream_camera.py
```

### 7️⃣ View Dashboard
```
Open in browser: https://glass-defect-detection-prototype-production.up.railway.app/dashboard
Should show: 🟢 LIVE with video updating
```

---

## 🔑 Key Settings to Know

| Setting | What It Does | Example |
|---------|-------------|---------|
| `backend_url` | Where to send frames | `wss://your-domain:8080` |
| `device_id` | Your Pi's name in logs | `raspberry-pi-1` |
| `frame_width` | Video width (lower = faster) | `640` or `320` |
| `frame_height` | Video height | `480` or `240` |
| `fps` | Frames per second | `15` or `5` (lower = less bandwidth) |

---

## 🚨 If Something Breaks

### "Connection refused"
```bash
# Check backend is running
curl -s https://glass-defect-detection-prototype-production.up.railway.app/health
# Should return JSON, not error
```

### "Camera not found"
```bash
# List available cameras
ls /dev/video*
# Change camera_index in script if needed
```

### "Slow/Laggy Video"
Edit script and change:
```python
"frame_width": 320,    # Lower
"frame_height": 240,   # Lower
"fps": 5,              # Lower
```

### "Script keeps crashing"
Run with logging:
```bash
python3 ~/stream_camera.py 2>&1 | tee stream.log
```

---

## 🎬 What You'll See

### On Pi Terminal
```
✅ Camera initialized
✅ Device registered
📺 Streamed 30 frames at 15.0 FPS
📺 Streamed 60 frames at 14.9 FPS
[keeps going...]
```

### On Web Dashboard
```
🟢 LIVE
FPS: 15.0
Frames: 450
[Camera feed showing live video]
```

---

## 📊 Performance Expectations

| Speed | Settings | Works? |
|-------|----------|--------|
| **Good WiFi** | 640x480 @ 15 FPS | ✅ ~200 KB/s |
| **Slow WiFi** | 320x240 @ 10 FPS | ✅ ~50 KB/s |
| **Mobile 4G** | 320x240 @ 5 FPS | ✅ ~25 KB/s |

---

## 🆘 Quick Help

| Problem | Quick Fix |
|---------|-----------|
| Can't ping Pi | Check WiFi connection, IP address |
| Camera not working | `ls /dev/video*` and change camera_index |
| No video on dashboard | Refresh page, check WebSocket in F12 console |
| Backend not responding | Check Railway deployment is active |
| High latency | Lower fps and resolution in config |

---

## 📝 Essential Info to Keep

```
Your Backend Domain:
wss://glass-defect-detection-prototype-production.up.railway.app:8080

Your Pi Name:
raspberry-pi-1

Your Dashboard URL:
https://glass-defect-detection-prototype-production.up.railway.app/dashboard
```

---

## ✅ One-Minute Test

```bash
# 1. SSH in
ssh pi@raspberrypi.local

# 2. Run script
python3 ~/stream_camera.py

# 3. In browser, go to dashboard
# Expected: See 🟢 LIVE with video
```

Done! 🚀
