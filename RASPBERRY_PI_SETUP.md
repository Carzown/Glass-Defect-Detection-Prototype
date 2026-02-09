# Raspberry Pi Installation Guide - Glass Defect Detection WebRTC

## 📋 What You Need to Install

This guide covers every package and tool required to run the WebRTC streaming system on Raspberry Pi.

---

## Option 1: Automated Installation (Recommended)

```bash
# Download and run the automated setup script
wget https://[your-repo]/setup_raspberry_pi.sh
chmod +x setup_raspberry_pi.sh
./setup_raspberry_pi.sh
```

**Time**: ~20 minutes  
**Handles**: All system packages, Python dependencies, and verification

---

## Option 2: Manual Installation (Step-by-Step)

### Step 1: Update System (5 minutes)

```bash
sudo apt-get update
sudo apt-get upgrade -y
```

### Step 2: Install System Dependencies (10 minutes)

**Required for image processing and WebRTC:**

```bash
# Core build tools
sudo apt-get install -y \
    python3-pip \
    python3-venv \
    python3-dev \
    git \
    wget \
    curl

# Image processing and OpenCV support
sudo apt-get install -y \
    libatlas-base-dev \
    libjasper-dev \
    libtiff5 \
    libharfbuzz0b \
    libwebp6 \
    libopenjp2-7

# Additional libjasper (for some Pi OS versions)
sudo apt-get install -y libjasper1 || true
```

### Step 3: Install Camera Support (5 minutes)

**For Picamera2 (recommended for modern Pi OS):**

```bash
sudo apt-get install -y \
    libcamera0 \
    libcamera-dev \
    libpython3-dev \
    python3-libcamera \
    python3-picamera2
```

**For legacy Picamera (older Pi OS):**
```bash
sudo apt-get install -y python3-picamera
```

### Step 4: Install Media/Video Libraries (5 minutes)

**For video codec support (required by aiortc/av):**

```bash
sudo apt-get install -y \
    libavformat-dev \
    libavcodec-dev \
    libswscale-dev \
    libavutil-dev \
    libavdevice-dev \
    libavfilter-dev \
    libswresample-dev
```

### Step 5: Create Python Virtual Environment (2 minutes)

**Recommended to keep dependencies isolated:**

```bash
cd ~
python3 -m venv glass-detection-env
source glass-detection-env/bin/activate
```

### Step 6: Upgrade pip and Install Core Packages (15 minutes)

**This is where the main dependencies go:**

```bash
# Upgrade pip first
pip install --upgrade pip setuptools wheel

# ===== WEBRTC PACKAGES =====
echo "Installing WebRTC packages..."
pip install aiortc==1.7.0
pip install av==10.0.0
pip install aiohttp==3.8.5

# ===== YOLO & VISION =====
echo "Installing YOLO and OpenCV..."
pip install ultralytics
pip install opencv-python
pip install opencv-contrib-python

# ===== CLOUD STORAGE =====
echo "Installing Supabase..."
pip install supabase

# ===== UTILITIES =====
echo "Installing utilities..."
pip install requests
pip install numpy
pip install Pillow
```

**Installation times per package:**
- `aiortc`: 5-10 minutes (builds from source)
- `av`: 5-10 minutes (builds from source)
- `ultralytics`: 2-3 minutes
- `opencv-python`: 3-5 minutes
- `supabase`: 1 minute
- Others: < 1 minute each

**Total**: ~20-30 minutes

### Step 7: Verify Installation (2 minutes)

```bash
# Test each critical package
python3 -c "from aiortc import RTCPeerConnection; print('✅ WebRTC OK')"
python3 -c "from ultralytics import YOLO; print('✅ YOLO OK')"
python3 -c "import cv2; print('✅ OpenCV OK')"
python3 -c "from picamera2 import Picamera2; print('✅ Camera OK')"
python3 -c "from supabase import create_client; print('✅ Supabase OK')"
```

All should print `✅ ... OK`

---

## Step 8: Download YOLO Model (5 minutes)

The model must be in your project directory:

```bash
# Navigate to project directory
cd ~/glass-defect-detection-prototype

# Download model (first time only)
# Option A: YOLOv11 Nano (fastest, good for Pi)
wget https://github.com/ultralytics/assets/releases/download/v8.1.0/yolov11n.pt -O best.pt

# Option B: YOLOv8 Medium (more accurate but slower)
# wget https://github.com/ultralytics/assets/releases/download/v8.0.0/yolov8m.pt -O best.pt

# Option C: Use your own trained model
# cp /path/to/your/model.pt best.pt
```

**Model sizes:**
- `yolov11n.pt` (nano): ~2.6 MB, 2 FPS on Pi4
- `yolov8m.pt` (medium): ~49 MB, 0.5 FPS on Pi4
- `best.pt` (your custom): Depends on training

---

## Step 9: Test Hardware

### Test Camera

```bash
# Modern Pi (Bookworm OS with libcamera)
libcamera-hello --time 1

# Legacy Pi
raspistill -o test.jpg
```

Should show camera preview or create test image.

### Test YOLO Model Loading

```bash
python3 << 'EOF'
from ultralytics import YOLO
model = YOLO('best.pt')
print("✅ Model loaded successfully")
EOF
```

---

## Step 10: Get Project Files

```bash
# If using git
git clone https://github.com/[your-repo]/glass-defect-detection.git
cd glass-defect-detection

# Or copy files manually from your source
```

---

## Step 11: Configure Environment Variables

```bash
# Create config file
nano .env.webrtc
```

**Add these settings:**
```bash
BACKEND_URL=http://192.168.1.100:5000        # Change to your backend IP
DEVICE_ID=raspberry-pi-1
WEBRTC_ENABLED=true
MODEL_PATH=./best.pt
CAMERA_INDEX=0
VIDEO_WIDTH=640
VIDEO_HEIGHT=480
FPS=30
```

**Save**: Ctrl+X, then Y, then Enter

---

## Complete Installation Package Summary

| Component | Package | Installation Time | Size |
|-----------|---------|-------------------|------|
| **System** | | |
| Python3 | python3-dev | 1 min | 50 MB |
| Build Tools | build-essential | 5 min | 100 MB |
| | | |
| **Camera** | | |
| Picamera2 | python3-picamera2 | 2 min | 30 MB |
| Libcamera | libcamera-dev | 2 min | 50 MB |
| | | |
| **Video Processing** | | |
| FFmpeg | libav* packages | 3 min | 100 MB |
| OpenCV | opencv-python | 5 min | 80 MB |
| | | |
| **AI/ML** | | |
| YOLO | ultralytics | 3 min | 50 MB |
| NumPy | numpy | 2 min | 30 MB |
| | | |
| **WebRTC** | | |
| aiortc | aiortc | 10 min | 5 MB |
| av | av (PyAV) | 10 min | 10 MB |
| aiohttp | aiohttp | 2 min | 5 MB |
| | | |
| **Cloud** | | |
| Supabase | supabase-py | 1 min | 5 MB |
| | | |
| **Model** | | |
| YOLO Model | best.pt | 5 min | 2-50 MB |
| | | |
| **TOTAL** | | **~45-60 min** | **~600-800 MB** |

---

## Quick Copy-Paste Reference

### System Packages (All at Once)
```bash
sudo apt-get update && sudo apt-get upgrade -y && \
sudo apt-get install -y \
    python3-pip python3-venv python3-dev git wget curl \
    libatlas-base-dev libjasper-dev libjasper1 libtiff5 libharfbuzz0b libwebp6 libopenjp2-7 \
    libcamera0 libcamera-dev libpython3-dev python3-libcamera python3-picamera2 \
    libavformat-dev libavcodec-dev libswscale-dev libavutil-dev libavdevice-dev libavfilter-dev libswresample-dev
```

### Python Packages (All at Once)
```bash
python3 -m venv glass-detection-env
source glass-detection-env/bin/activate
pip install --upgrade pip setuptools wheel
pip install aiortc==1.7.0 av==10.0.0 aiohttp==3.8.5 ultralytics opencv-python opencv-contrib-python supabase requests numpy Pillow
```

### Verify Everything
```bash
python3 -c "
import sys
try:
    from aiortc import RTCPeerConnection
    from ultralytics import YOLO
    import cv2
    from picamera2 import Picamera2
    from supabase import create_client
    print('✅ All packages installed successfully!')
    sys.exit(0)
except Exception as e:
    print(f'❌ Missing package: {e}')
    sys.exit(1)
"
```

---

## Troubleshooting Installation Issues

### Issue: `pip install aiortc` takes too long
**Solution**: It's normal, it builds from source. Takes 5-10 minutes. Use `--no-cache-dir` to save space:
```bash
pip install --no-cache-dir aiortc==1.7.0
```

### Issue: "No module named 'picamera2'"
**Solution**: Ensure you're on modern Pi OS (Bookworm/Bullseye). For legacy systems:
```bash
sudo apt-get install python3-picamera  # Legacy version
```

### Issue: Camera import fails
**Solution**: Test with libcamera:
```bash
libcamera-hello --time 1
```

If that fails, update camera firmware:
```bash
sudo apt-get install -y rpi-eeprom
sudo rpi-eeprom-update -a
```

### Issue: "av" module fails to build
**Solution**: Ensure media libraries are installed:
```bash
sudo apt-get install -y libavformat-dev libavcodec-dev libswscale-dev
pip install --no-cache-dir --force-reinstall av==10.0.0
```

### Issue: Not enough disk space
**Solution**: Clean up and free space:
```bash
sudo apt-get clean
sudo apt-get autoclean
pip cache purge
```

---

## Maintenance & Updates

### After Installation

**Keep packages updated:**
```bash
pip install --upgrade aiortc av ultralytics opencv-python supabase
```

**Check for issues:**
```bash
python3 verify_project.py
```

---

## Disk Space Check

Before installing, check available space:
```bash
df -h
```

You need **at least 2GB** free space for installation.

---

## Final Checklist

- ✅ System packages installed
- ✅ Camera support installed
- ✅ Python packages installed
- ✅ All imports working
- ✅ YOLO model downloaded
- ✅ Environment variables configured
- ✅ Camera tested

**Ready to run**: 
```bash
python3 glass_detection_webrtc.py
```

---

Good luck! 🚀
