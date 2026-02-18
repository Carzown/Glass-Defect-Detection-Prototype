# 🎬 Raspberry Pi 5 - Glass Defect Detection with Hailo AI

## 📋 Complete Setup Instructions

This guide walks you through setting up `main.py` on your Raspberry Pi 5 with Hailo 8 accelerator to:
- Capture video from Picamera2 (768x768)
- Run YOLOv8m AI detection model
- Stream annotated frames (with detection overlays) via WebSocket
- Save detected defects to Supabase database

---

## 🎯 What You're Building

```
Raspberry Pi 5 (with Hailo 8 accelerator)
    ↓
Pickamera2 captures frames (768x768)
    ↓
YOLOv8m model runs on Hailo (AI inference)
    ↓
Annotated frames with detection boxes
    ↓
WebSocket Stream to Railway Backend (wss://)
    ↓
Railway Backend (websocket-server.js:8080)
    ↓
Broadcasts to all connected dashboards
    ↓
Frontend Dashboard on GitHub Pages
    ↓
User sees: 🟢 LIVE annotated video + defect history
```

---

## 📦 What You Need

- **Raspberry Pi 5** (4GB+ RAM recommended)
- **Hailo 8 AI Accelerator** (pre-installed on Pi)
- **Picamera2** (Camera Module 3 or 3 Wide recommended)
- **Internet connection** (WiFi or Ethernet)
- **SSH access** to Pi (or monitor + keyboard)
- **Railway backend domain** deployed
- **Supabase project** for database + storage (optional but recommended)

---

## 🚀 Step 1: Connect to Your Raspberry Pi

### Option A: SSH (Remote)
```bash
ssh pi@raspberrypi.local
# Or: ssh pi@<your-pi-ip-address>
# Default password: raspberry
```

### Option B: Direct Terminal
```
Plug in monitor and keyboard
Open terminal on Pi
```

---

## 🔧 Step 2: Install Required Dependencies

Run these commands on your Raspberry Pi:

```bash
# Update package manager
sudo apt update
sudo apt upgrade -y

# Install Python 3 and pip
sudo apt install python3 python3-pip -y

# Install system dependencies for OpenCV
sudo apt install libopenjp2-7 libtiff6 libharfoss0 libwebp6 libjasper1 libatlas-base-dev -y

# Install dependencies
pip install --upgrade pip
pip install opencv-python
pip install websocket-client
pip install degirum
pip install picamera2
pip install supabase
pip install pytz
pip install numpy

# Verify installations
python3 --version
pip list | grep -E 'degirum|picamera2|supabase|opencv|websocket'
```

**Expected Output:**
```
Python 3.11.x
degirum x.x.x
opencv-python 4.x.x
picamera2 x.x.x
supabase x.x.x
websocket-client 1.x.x
```

---

## 📥 Step 3: Download the Detection Script and Config

### Option A: Copy from Your Computer (Recommended)

On your computer:
```bash
cd Glass-Defect-Detection-Prototype
scp main.py pi@raspberrypi.local:~/main.py
scp modules/config.py pi@raspberrypi.local:~/modules/config.py
scp modules/fps.py pi@raspberrypi.local:~/modules/fps.py
```

### Option B: Clone the Repository on Pi

On Pi:
```bash
cd ~
git clone https://github.com/Carzown/Glass-Defect-Detection-Prototype.git
cd Glass-Defect-Detection-Prototype
```

This downloads everything including `main.py` and the `modules/` directory.

---

## ⚙️ Step 4: Configure Backend URL and Supabase

Edit the config file:
```bash
mkdir -p ~/modules
nano ~/modules/config.py
```

**Create/Update `~/modules/config.py`:**

```python
# Backend Configuration
DEVICE_ID = "raspi-pi-1"  # Your Pi identifier
BACKEND_URL = "https://glass-defect-detection-prototype-production.up.railway.app"  # Your Railway domain

# Camera Configuration
WIDTH = 768
HEIGHT = 768

# AI Model Configuration (Hailo)
MODEL_NAME = "yolov8m_segmentation"  # Hailo YOLOv8m model
ZOO_PATH = "/home/pi/.degirum/zoo"  # Hailo model zoo path
DEVICE_TYPE = "hailo8"  # Hailo accelerator

# Detection Settings
MIN_CONFIDENCE = 0.5  # Only report detections > 50% confidence
UPLOAD_COOLDOWN = 2  # Seconds between uploads (avoid spam)
SPATIAL_DIST = 50  # Pixels - don't upload same defect twice nearby

# Supabase Configuration (Optional)
SUPABASE_URL = "https://your-project.supabase.co"  # Your Supabase URL
SUPABASE_SERVICE_ROLE_KEY = "your-service-role-key"  # From Supabase settings
BUCKET_NAME = "defects"  # Storage bucket name
```

**Update these values:**

| Variable | Value | Notes |
|----------|-------|-------|
| `BACKEND_URL` | `https://your-railway-domain` | Your Railway backend |
| `DEVICE_ID` | `raspi-factory-1` | Identify your Pi |
| `SUPABASE_URL` | `https://xxxxx.supabase.co` | From Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | Your key | From Supabase → Settings → API |
| `MIN_CONFIDENCE` | `0.5` | 50% threshold (adjust as needed) |

**Save the file:** Ctrl+X, Y, Enter

---

## 🎥 Step 5: Verify Picamera2 and Hailo

Test that your camera and AI accelerator work:

```bash
# Test Picamera2
python3 -c "from picamera2 import Picamera2; cam = Picamera2(); print('✅ Picamera2 OK')"

# Test Hailo
python3 -c "import degirum as dg; print('✅ Hailo OK')"

# Test WebSocket
python3 -c "import websocket; print('✅ WebSocket OK')"
```

**Expected Output:**
```
✅ Picamera2 OK
✅ Hailo OK
✅ WebSocket OK
```

**If any tests fail:**
```bash
# Reinstall the failing library
pip install --upgrade picamera2  # or degirum or websocket-client
```

---

## 🚀 Step 6: Run the Detection Script

### Start the System

```bash
cd ~
python3 main.py
```

### What You Should See

```
✅ Supabase client initialized (database + storage ready)
✅ Timezone set to UTC
✅ AI Model loaded on Hailo accelerator
✅ Picamera2 initialized
✅ Camera running at 768x768 with fixed parameters
🔄 Connecting to WebSocket: wss://glass-defect-detection-prototype-production.up.railway.app:443
✅ WebSocket connected to wss://glass-defect-detection-prototype-production.up.railway.app:443
✅ WebSocket receive thread started

======================================================================
✅ Detection loop starting...
======================================================================
Monitoring for defects... (Press 'q' to stop)
Device: raspi-pi-1
Backend: https://glass-defect-detection-prototype-production.up.railway.app
FPS target: Real-time with spatial uniqueness checking

🔍 DEFECT DETECTED: crack (89.5%)
💾 Saved: crack
```

**If you see errors:**
- ❌ `Supabase initialization failed` → Missing SUPABASE credentials (OK if you skip)
- ❌ `AI Model loading failed` → Hailo not connected or model missing
- ❌ `Camera initialization failed` → Picamera2 issue or camera not connected
- ❌ `WebSocket connection error` → Backend URL wrong or offline

---

## ✅ Step 7: Verify on Dashboard

### On Your Computer:

1. **Open the Frontend Dashboard:**
   ```
   https://github-pages-url.github.io
   ```
   (Or wherever you deployed the React frontend)

2. **Log in** with your credentials

3. **Look for:**
   - ✅ **🟢 LIVE** indicator (green = connected to backend)
   - ✅ **Annotated video feed** updating with detection boxes
   - ✅ **FPS counter** showing ~15 FPS
   - ✅ **Defect list** showing detected items
   - ✅ **Confidence scores** for each detection

### Three Operation Modes

The system starts in **STOPPED** mode. Switch modes from the dashboard:

| Mode | Behavior | Use Case |
|------|----------|----------|
| **STOPPED** | No frames sent, no processing | Pause operation |
| **MANUAL** | Frames sent every frame, but inference only on "Capture" button | Inspect specific frames |
| **AUTOMATIC** | Continuous frame streaming + continuous inference | Real-time detection |

**If you don't see video:**
- Check browser console (F12 → Console) for errors
- Verify Pi script shows `✅ WebSocket connected`
- Try clicking "START DETECTION" button
- Refresh the page
- Check Railway backend is running

---

## 📊 Understanding the Connection Flow

### What Happens When You Run main.py:

**1. Initialization**
```
✅ Supabase client connects (optional)
✅ Hailo AI model loads (YOLOv8m)
✅ Picamera2 initializes (768x768 RGB)
✅ WebSocket connects to Railway backend
```

**2. Each Frame Processing**
```
Pickamera2 captures frame (768x768)
    ↓ (RGB888 format)
Hailo accelerator runs YOLOv8m inference
    ↓ (Real-time AI detection)
Model outputs: detection boxes + confidence scores
    ↓
Annotate frame with boxes + labels
    ↓
Convert to JPEG (quality: 85)
    ↓
Encode to Base64
    ↓
WebSocket message JSON
```

**3. WebSocket Message Format**
```json
{
  "type": "frame",
  "data": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
}
```

**4. Backend Relay (Railway)**
```
Backend receives WebSocket message
    ↓
Broadcasts to all connected web clients
```

**5. Frontend Display**
```
GitHub Pages dashboard receives frame
    ↓
Decodes base64 JPEG
    ↓
Displays in <img> tag
    ↓
User sees 🟢 LIVE annotated video
```

**6. Defect Detection (When Found)**
```
If confidence > MIN_CONFIDENCE (50%)
    ↓
Check spatial uniqueness (avoid duplicates)
    ↓
Upload image to Supabase storage
    ↓
Save defect record to Supabase database
    ↓
Send metadata to dashboard
    ↓
Display in defect list with timestamp + image
```

---

## 🧪 Testing & Debugging

### Test 1: Backend Health

On Pi:
```bash
curl -s https://glass-defect-detection-prototype-production.up.railway.app/health
```

**Expected Output:**
```json
{"ok":true,"timestamp":"2026-02-18T..."}
```

### Test 2: WebSocket Server

```bash
curl -s https://glass-defect-detection-prototype-production.up.railway.app:8080/health
```

**Expected Output:**
```json
{"status":"ok","devices":[],"webClients":0}
```

### Test 3: Run main.py with Debug Output

```bash
python3 main.py
```

**Watch for:**
- ✅ `AI Model loaded on Hailo accelerator`
- ✅ `Camera running at 768x768`
- ✅ `WebSocket connected`
- ✅ `Detection loop starting...`
- 🔍 `DEFECT DETECTED:` messages (when defects appear)

### Test 4: Check Hailo Model Download

First run may download the model (big file). Monitor:
```bash
df -h  # Check disk space
top    # Monitor CPU/Memory during model load
```

Model downloads to `/home/pi/.degirum/zoo/` (takes time)

### Test 5: Verify Network

```bash
# Ping backend
ping glass-defect-detection-prototype-production.up.railway.app

# Check WiFi signal
iwconfig

# Monitor network traffic
iftop
```

---

## 🔧 Performance Tuning

### For Slow Networks or High Latency

If dashboard updates are slow, adjust in `~/modules/config.py`:

```python
# Reduce resolution (default 768x768)
WIDTH = 512
HEIGHT = 512

# Reduce JPEG quality (default 85 in main.py line ~261)
# Edit main.py around line 261:
_, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])  # Was 85

# Reduce inference frequency (skip some frames)
# Add to main loop: if frame_count % 2 == 0: continue  # Process every 2nd frame
```

### Bandwidth Estimates

- **768x768 @ 15 FPS (default)** = ~500 KB/s
- **512x512 @ 15 FPS (slower net)** = ~250 KB/s
- **512x512 @ 5 FPS (very slow)** = ~80 KB/s

### CPU/Memory Monitoring

```bash
# Monitor while running
watch -n 1 'free -h && top -bn1 | head -20'

# Check Hailo usage
top | grep 'main.py'
```

**Typical Usage:**
- CPU: 40-60% (Hailo accelerator offloads most AI work)
- Memory: 300-500 MB
- Network: 200-500 KB/s

---

## ⚠️ Troubleshooting

### Problem: WebSocket Connection Error

```
⚠️  WebSocket connection error: ... Connection refused
```

**Solution:**
1. Check backend URL in `config.py` is correct
2. Verify backend is deployed on Railway:
   ```bash
   curl https://your-domain/health
   ```
3. Check internet connection:
   ```bash
   ping 8.8.8.8
   ```
4. Verify firewall allows outbound connections

### Problem: AI Model Fails to Load

```
❌ AI Model loading failed: ...
```

**Solution:**
1. Check Hailo is detected:
   ```bash
   lspci | grep Hailo
   ```
2. Reinstall degirum:
   ```bash
   pip install --upgrade --force-reinstall degirum
   ```
3. Check disk space (model is 1-2 GB):
   ```bash
   df -h
   ```
4. Manually download model on first run (takes 5-10 minutes)

### Problem: Camera Initialization Failed

```
❌ Camera initialization failed: ...
```

**Solution:**
1. Check camera is connected (ribbon cable)
2. Test Picamera2:
   ```bash
   python3 -c "from picamera2 import Picamera2; Picamera2()"
   ```
3. Enable camera in raspi-config:
   ```bash
   sudo raspi-config
   # → Interface Options → Camera → Enable
   ```
4. Reboot:
   ```bash
   sudo reboot
   ```

### Problem: No Video on Dashboard

**Solution:**
1. Check Pi script shows `✅ WebSocket connected`
2. Check browser console (F12 → Console) for JavaScript errors
3. Check backend logs:
   ```bash
   curl https://your-domain:8080/health
   ```
4. Try switching modes: STOPPED → MANUAL → AUTOMATIC
5. Refresh browser page (Ctrl+R)

### Problem: Script Keeps Disconnecting

```
⚠️  WebSocket frame send error: ...
```

**Solution:**
1. Ensure stable WiFi:
   ```bash
   iwconfig  # Check signal strength
   ```
2. Prevent Pi sleep:
   ```bash
   sudo systemctl mask sleep.target
   ```
3. Run with restart on error:
   ```bash
   while true; do python3 main.py; sleep 5; done
   ```
4. Check for thermal throttling:
   ```bash
   vcgencmd measure_temp
   ```

---

## 🚀 Running as Background Service (Optional)

To keep detection running even after SSH disconnects:

### Create Service File

```bash
sudo nano /etc/systemd/system/glass-detection.service
```

**Paste this:**

```ini
[Unit]
Description=Glass Defect Detection with Hailo AI
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi
ExecStart=/usr/bin/python3 /home/pi/main.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/home/pi/.local/bin"

[Install]
WantedBy=multi-user.target
```

**Save:** Ctrl+X, Y, Enter

### Enable & Start Service

```bash
# Enable on boot
sudo systemctl daemon-reload
sudo systemctl enable glass-detection.service

# Start now
sudo systemctl start glass-detection.service

# Check status
sudo systemctl status glass-detection.service

# View real-time logs
sudo journalctl -u glass-detection.service -f

# View last 50 lines
sudo journalctl -u glass-detection.service -n 50
```

### Stop/Restart Service

```bash
# Stop
sudo systemctl stop glass-detection.service

# Restart
sudo systemctl restart glass-detection.service

# Disable on boot
sudo systemctl disable glass-detection.service
```

---

## 📈 Monitoring

### Watch Backend Status

While main.py is running, on another terminal:
```bash
while true; do curl -s https://your-domain:8080/health | jq . ; sleep 2; done
```

Expected output:
```json
{
  "status": "ok",
  "devices": ["raspi-pi-1"],
  "webClients": 1
}
```

### Monitor Pi System Resources

```bash
# Real-time CPU/Memory
top

# Disk space (model is ~1-2 GB)
df -h /home/pi

# Temperature (watch for throttling)
vcgencmd measure_temp

# Network bandwidth
iftop -i eth0  # or your interface

# Service logs
sudo journalctl -u glass-detection.service -f
```

### Expected Metrics

```
CPU Usage:     40-60% (Hailo accelerates AI)
Memory:        400-600 MB
Network:       200-500 KB/s (depends on resolution)
Temperature:   < 60°C (safe) / > 80°C (throttled)
```

---

## 📝 Configuration Summary

### Backend URL Format

```
https://glass-defect-detection-prototype-production.up.railway.app
███                                                                 
└─ Your Railway domain (put in config.py BACKEND_URL)
```

### WebSocket Connection (Automatic)

main.py automatically converts:
```python
BACKEND_URL = "https://your-domain.up.railway.app"
         ↓ (converted to)
wss://your-domain.up.railway.app:443  # Secure WebSocket on HTTPS port
```

### Frame Message Format

```json
{
  "type": "frame",
  "data": "data:image/jpeg;base64,/9j/4AAQSkZJRgABA..."
}
```

### Detection Message Format

```json
{
  "type": "detection",
  "defect_type": "crack",
  "confidence": 0.895,
  "timestamp": "2026-02-18T12:34:56.789+00:00"
}
```

### Device Registration (Automatic)

```json
{
  "type": "device_register"
}
```
Sent automatically when WebSocket connects.

---

## ✅ Final Checklist

**Setup Phase:**
- [ ] SSH into Raspberry Pi 5
- [ ] Installed: degirum, picamera2, supabase, websocket-client, opencv-python, pytz
- [ ] Downloaded main.py and modules/ folder
- [ ] Created/updated ~/modules/config.py with:
  - [ ] BACKEND_URL = your Railway domain
  - [ ] DEVICE_ID = your Pi name
  - [ ] SUPABASE credentials (optional)

**Hardware Verification:**
- [ ] Hailo 8 accelerator connected (`lspci | grep Hailo`)
- [ ] Picamera2 connected and enabled (`python3 -c "from picamera2 import Picamera2"`)
- [ ] Safe temperature (`vcgencmd measure_temp < 60°C`)

**Software Testing:**
- [ ] Ran `python3 main.py` successfully
- [ ] See ✅ checkmarks for all initialization steps
- [ ] See `AI Model loaded on Hailo accelerator`
- [ ] See `WebSocket connected`
- [ ] See `Detection loop starting...`

**Dashboard Verification:**
- [ ] Opened frontend dashboard
- [ ] Dashboard shows 🟢 LIVE indicator
- [ ] Video feed updating with annotated boxes
- [ ] FPS counter ~15
- [ ] Status shows "CONNECTED"

**Production Ready:**
- [ ] Set up background service (optional but recommended)
- [ ] Can SSH disconnect and Pi continues
- [ ] Check `sudo systemctl status glass-detection.service`
- [ ] Monitor with `sudo journalctl -u glass-detection.service -f`

---

## 🎯 Expected Results

### On Raspberry Pi Terminal (main.py)

```
✅ Supabase client initialized (database + storage ready)
✅ Timezone set to UTC
✅ AI Model loaded on Hailo accelerator
✅ Picamera2 initialized
✅ Camera running at 768x768 with fixed parameters
🔄 Connecting to WebSocket: wss://glass-defect-detection-production.up.railway.app:443
✅ WebSocket connected to wss://glass-defect-detection-production.up.railway.app:443
✅ WebSocket receive thread started

======================================================================
✅ Detection loop starting...
======================================================================
Monitoring for defects... (Press 'q' to stop)
Device: raspi-pi-1
Backend: https://glass-defect-detection-prototype-production.up.railway.app
FPS target: Real-time with spatial uniqueness checking

🔍 DEFECT DETECTED: crack (89.5%)
💾 Saved: crack
🔍 DEFECT DETECTED: bubble (76.2%)
💾 Saved: bubble
[Continues, detecting defects in real-time...]
```

### On Web Dashboard (GitHub Pages)

```
✨ Glass Defect Detection
────────────────────────────
🟢 LIVE  ← Green = Connected to backend

📊 FPS: 15.0
📈 Frames streamed: 450
🔌 Status: CONNECTED

[768x768 annotated video feed]
[Detection boxes with labels + confidence]

Detected Defects:
  • crack (89.5%) - 2:34 PM
  • bubble (76.2%) - 2:31 PM
```

---

## 📚 Quick Reference

| Task | Command |
|------|---------|
| Start streaming | `python3 ~/stream_camera.py` |
| Stop streaming | Ctrl+C |
| Run in background | `nohup python3 ~/stream_camera.py &` |
| View logs | `tail -f stream.log` |
| Test camera | `python3 -c "import cv2; cap = cv2.VideoCapture(0); print(cap.isOpened())"` |
| Test backend | `curl -s https://your-domain/health` |
| Check status | `sudo systemctl status stream-camera.service` |

---

## 🆘 Getting Help

If something doesn't work:

1. **Check error message** - Read what the script is saying
2. **Check logs** - `sudo journalctl -u stream-camera.service -f`
3. **Test connectivity** - `ping your-domain`
4. **Verify camera** - `ls /dev/video*`
5. **Check backend** - `curl https://your-domain/health`
6. **Restart everything** - Stop Pi script, restart backend, try again

---

## 🎬 You're Ready!

Your Raspberry Pi 5 with Hailo 8 is now:
✅ Running YOLOv8m AI detection in real-time
✅ Streaming annotated frames to Railway backend
✅ Broadcasting live video to your web dashboard
✅ Detecting and saving defects to Supabase
✅ Operating in automatic detection mode

The web dashboard displays:
- 🟢 LIVE indicator (green = connected)
- Real-time annotated video with detection boxes
- FPS counter (~15 frames per second)
- Detected defects with timestamps and images

**Everything is flowing through the backend → frontend! 🚀**
