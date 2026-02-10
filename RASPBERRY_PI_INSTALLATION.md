# 🍓 Raspberry Pi - Complete Installation Guide

**Target:** Raspberry Pi 5 with Camera Module  
**OS:** Raspberry Pi OS (Bullseye/Bookworm)  
**Python:** 3.9+  
**Updated:** February 9, 2026

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [System Updates](#system-updates)
3. [Core Dependencies](#core-dependencies)
4. [Camera Setup](#camera-setup)
5. [Python Virtual Environment](#python-virtual-environment)
6. [Python Packages](#python-packages)
7. [Supabase Setup](#supabase-setup)
8. [Project Files](#project-files)
9. [Environment Configuration](#environment-configuration)
10. [Testing & Verification](#testing--verification)
11. [Running the Application](#running-the-application)
12. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Raspberry Pi 5 (or Pi 4B with 4GB+ RAM)
- Raspberry Pi Camera Module v2 or v3
- microSD card (32GB recommended)
- Raspberry Pi OS (Bullseye or Bookworm) installed
- Internet connection
- USB power supply (27W for Pi 5)

---

## System Updates

### Step 1: Update System Packages

```bash
# Update package lists
sudo apt-get update

# Upgrade all packages to latest versions
sudo apt-get upgrade -y

# Install security updates
sudo apt-get dist-upgrade -y
```

**Time:** ~10-15 minutes (depends on current updates)

---

## Core Dependencies

### Step 2: Install Base Libraries

These are required for camera support, image processing, and compilation:

```bash
sudo apt-get install -y \
    python3-pip \
    python3-venv \
    python3-dev \
    git \
    wget \
    curl \
    build-essential \
    cmake \
    libatlas-base-dev \
    libjasper-dev \
    libtiff5 \
    libjasper1 \
    libharfbuzz0b \
    libwebp6 \
    libopenjp2-7 \
    libopenjp2-7-dev \
    libatlas-base-dev \
    libtiffxx5 \
    pkg-config
```

**What each does:**
- `python3-pip` - Package manager for Python
- `python3-venv` - Virtual environment support
- `python3-dev` - Python development headers
- `build-essential` - Compilation tools
- `libatlas-base-dev`, `libjasper-dev`, etc. - Image processing libraries

**Time:** ~5-10 minutes

---

## Camera Setup

### Step 3: Install Camera Support

```bash
# Install libcamera (modern camera stack)
sudo apt-get install -y \
    libcamera0 \
    libcamera-dev \
    libpython3-dev \
    python3-libcamera \
    python3-picamera2 \
    libopenjp2-7 \
    libtiff5
```

### Step 4: Enable Camera in raspi-config

```bash
# Open Raspberry Pi configuration
sudo raspi-config

# Navigate to: Interface Options > Camera > Enable
# Then: Reboot

# Or use command line (Bookworm):
sudo raspi-config nonint do_camera 0

# Reboot
sudo reboot
```

### Step 5: Test Camera

```bash
# Basic camera test
libcamera-hello --time 1

# Expected output: Camera feed opens for 1 second
```

**Time:** ~5 minutes

---

## Python Virtual Environment

### Step 6: Create Virtual Environment

```bash
# Navigate to home directory
cd ~

# Create project directory
mkdir glass-defect-detection
cd glass-defect-detection

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Verify activation (prompt should show (venv))
which python3
```

**Tip:** Always activate the virtual environment before installing packages:
```bash
source ~/glass-defect-detection/venv/bin/activate
```

---

## Python Packages

### Step 7: Upgrade pip and Install Wheel

```bash
# Activate venv first
source ~/glass-defect-detection/venv/bin/activate

# Upgrade pip (important!)
pip install --upgrade pip setuptools wheel

# This may take 5-10 minutes
```

### Step 8: Install WebRTC Packages

```bash
# Core WebRTC
pip install aiortc==1.7.0
pip install av==10.0.0
pip install aiohttp==3.8.5

# Time: 10-15 minutes (av compilation takes time)
```

### Step 9: Install Computer Vision Packages

```bash
# YOLO detection
pip install ultralytics
pip install opencv-python
pip install opencv-contrib-python

# numpy and image processing
pip install numpy
pip install Pillow

# Time: 15-20 minutes (YOLO download is large)
```

### Step 10: Install Cloud & Networking

```bash
# Supabase client
pip install supabase

# Socket.IO for fallback streaming
pip install python-socketio[client]

# Requests for HTTP
pip install requests

# Time: 5 minutes
```

### Step 11: Install Additional Utilities

```bash
# Optional but recommended
pip install python-dotenv     # Environment variables
pip install pyyaml            # Configuration files
pip install Werkzeug          # For error handling

# Time: 2 minutes
```

### Complete Installation Command

Run all at once (copy & paste):

```bash
source ~/glass-defect-detection/venv/bin/activate

pip install --upgrade pip setuptools wheel

# WebRTC stack
pip install aiortc==1.7.0 av==10.0.0 aiohttp==3.8.5

# Computer vision
pip install ultralytics opencv-python opencv-contrib-python

# Cloud & networking
pip install supabase python-socketio[client]

# Utilities
pip install requests numpy Pillow python-dotenv pyyaml
```

**Total Time:** 45-60 minutes (first run, compilation happens)

---

## Supabase Setup

### Step 12: Create Supabase Project

Already set up in your project! Use these credentials (embedded in scripts):

```
SUPABASE_URL=https://kfeztemgrbkfwaicvgnk.supabase.co
SUPABASE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmZXp0ZW1ncmJrZndhaWN2Z25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMDM4NDIsImV4cCI6MjA3Njc3OTg0Mn0.n4F6v_kywu55Nj2Yx_dcZri4WsdUMaftzPl1FXT-to8
```

### Step 13: Create Storage Bucket

1. Go to **Supabase Dashboard** → Storage
2. Click **Create Bucket**
3. Name: `defect-images`
4. Make **PUBLIC** ✅
5. Click **Create Bucket**

### Step 14: Set Storage Policies

1. Go to **defect-images** bucket → **Policies**
2. Click **New Policy**
3. Select **"For Authenticated Users"** template
4. Operation: **SELECT**
5. Click **Save**
6. Repeat for **INSERT** operation

---

## Project Files

### Step 15: Clone/Download Project

```bash
cd ~/glass-defect-detection

# Using git (if installed)
git clone https://github.com/Carzown/Glass-Defect-Detection-Prototype.git
cd Glass-Defect-Detection-Prototype

# Or download and extract manually
```

### Step 16: Copy Detection Script

```bash
# You'll need the detection script
# From your project:
cp glass_detection_webrtc.py ~/glass-defect-detection/
cp glass_detection.py ~/glass-defect-detection/
```

---

## Environment Configuration

### Step 17: Create .env File

```bash
cd ~/glass-defect-detection
cat > .env << EOF
# Backend Connection
BACKEND_URL=http://192.168.1.100:5000
DEVICE_ID=raspberry-pi-1

# Supabase Configuration
SUPABASE_URL=https://kfeztemgrbkfwaicvgnk.supabase.co
SUPABASE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmZXp0ZW1ncmJrZndhaWN2Z25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMDM4NDIsImV4cCI6MjA3Njc3OTg0Mn0.n4F6v_kywu55Nj2Yx_dcZri4WsdUMaftzPl1FXT-to8

# Detection Settings
YOLO_MODEL=yolov11n.pt
CONFIDENCE_THRESHOLD=0.5
CAMERA_ID=0

# WebRTC Settings
WEBRTC_ENABLED=true
EOF
```

**Replace:**
- `192.168.1.100` with your backend IP address

### Step 18: Create Python Virtual Environment Auto-load

```bash
cat > ~/.bashrc_venv << EOF
# Auto-activate virtual environment
if [ -f ~/glass-defect-detection/venv/bin/activate ]; then
    source ~/glass-defect-detection/venv/bin/activate
fi
EOF

# Add to .bashrc
echo "source ~/.bashrc_venv" >> ~/.bashrc
```

---

## Testing & Verification

### Step 19: Verify All Installations

```bash
# Activate venv
source ~/glass-defect-detection/venv/bin/activate

# Test imports
python3 << EOF
print("Testing imports...")
try:
    from aiortc import RTCPeerConnection
    print("✅ aiortc")
except ImportError as e:
    print(f"❌ aiortc: {e}")

try:
    from ultralytics import YOLO
    print("✅ ultralytics")
except ImportError as e:
    print(f"❌ ultralytics: {e}")

try:
    import cv2
    print("✅ opencv-python")
except ImportError as e:
    print(f"❌ opencv-python: {e}")

try:
    from picamera2 import Picamera2
    print("✅ picamera2")
except ImportError as e:
    print(f"❌ picamera2: {e}")

try:
    from supabase import create_client
    print("✅ supabase")
except ImportError as e:
    print(f"❌ supabase: {e}")

try:
    import socketio
    print("✅ python-socketio")
except ImportError as e:
    print(f"❌ python-socketio: {e}")
EOF
```

### Step 20: Test Camera Access

```bash
# Test with libcamera
libcamera-hello --time 1

# Test with Python
python3 << EOF
from picamera2 import Picamera2
pic = Picamera2()
print("Camera ready!")
EOF
```

### Step 21: Test Network Connectivity

```bash
# Test backend connection
ping 192.168.1.100  # Replace with your backend IP

# Test Supabase
curl -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmZXp0ZW1ncmJrZndhaWN2Z25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMDM4NDIsImV4cCI6MjA3Njc3OTg0Mn0.n4F6v_kywu55Nj2Yx_dcZri4WsdUMaftzPl1FXT-to8" \
  https://kfeztemgrbkfwaicvgnk.supabase.co/rest/v1/defects?limit=1
```

---

## Running the Application

### Step 22: Download YOLO Model

```bash
cd ~/glass-defect-detection

# Download tiny model (fastest)
wget https://github.com/ultralytics/assets/releases/download/v8.0.0/yolov11n.pt

# Or small model (better accuracy)
wget https://github.com/ultralytics/assets/releases/download/v8.0.0/yolov11s.pt

# Verify download
ls -lh yolov11*.pt
```

**Model Sizes:**
- `yolov11n.pt` - Nano (7MB) - **Fastest** ⭐
- `yolov11s.pt` - Small (22MB) - Good balance
- `yolov11m.pt` - Medium (49MB) - Better accuracy

### Step 23: Run Detection Script

```bash
# Activate virtual environment
source ~/glass-defect-detection/venv/bin/activate

# Set environment variables
export BACKEND_URL=http://192.168.1.100:5000
export DEVICE_ID=raspberry-pi-1
export WEBRTC_ENABLED=true

# Run the script
python3 glass_detection_webrtc.py
```

### Step 24: Run as Background Service

```bash
# Create systemd service
sudo cat > /etc/systemd/system/glass-detection.service << EOF
[Unit]
Description=Glass Defect Detection Service
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/glass-defect-detection
Environment="PATH=/home/pi/glass-defect-detection/venv/bin"
Environment="BACKEND_URL=http://192.168.1.100:5000"
Environment="DEVICE_ID=raspberry-pi-1"
Environment="WEBRTC_ENABLED=true"
ExecStart=/home/pi/glass-defect-detection/venv/bin/python3 glass_detection_webrtc.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable service
sudo systemctl daemon-reload
sudo systemctl enable glass-detection.service

# Start service
sudo systemctl start glass-detection.service

# Check status
sudo systemctl status glass-detection.service

# View logs
sudo journalctl -u glass-detection.service -f
```

---

## Troubleshooting

### Issue: "ModuleNotFoundError: No module named 'aiortc'"

**Solution:**
```bash
# Activate venv
source ~/glass-defect-detection/venv/bin/activate

# Reinstall
pip install --upgrade aiortc av aiohttp

# Or reinstall from requirements
pip install -r requirements.txt
```

### Issue: Camera not detected

**Solution:**
```bash
# Check libcamera
libcamera-hello --time 1

# Enable in raspi-config
sudo raspi-config

# Or command line:
sudo raspi-config nonint do_camera 0

# Reboot
sudo reboot
```

### Issue: "No module named 'picamera2'"

**Solution:**
```bash
# Install specifically
sudo apt-get install -y python3-picamera2

# Or in venv
pip install picamera2
```

### Issue: Connection timeout to backend

**Solution:**
```bash
# Check backend is running
ping 192.168.1.100

# Check firewall
sudo ufw status

# Check backend listening
sudo lsof -i :5000
```

### Issue: Supabase storage upload fails

**Solution:**
```bash
# Check credentials in .env
cat .env

# Test Supabase connection
python3 << EOF
from supabase import create_client
supabase = create_client(
    "https://kfeztemgrbkfwaicvgnk.supabase.co",
    "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmZXp0ZW1ncmJrZndhaWN2Z25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMDM4NDIsImV4cCI6MjA3Njc3OTg0Mn0.n4F6v_kywu55Nj2Yx_dcZri4WsdUMaftzPl1FXT-to8"
)
print("✅ Connected to Supabase")
EOF
```

### Issue: Out of memory during pip install

**Solution:**
```bash
# Increase swap space
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Check
free -h
```

### Issue: Python package compilation fails

**Solution:**
```bash
# Install development libraries
sudo apt-get install -y python3-dev

# Try binary wheel if available
pip install --only-binary :all: package-name

# Or install from pre-compiled wheel
pip install https://example.com/package-name-wheel.whl
```

---

## Quick Reference - Full Installation Commands

### Copy & Paste Complete Setup:

```bash
# 1. System updates
sudo apt-get update && sudo apt-get upgrade -y

# 2. Install dependencies
sudo apt-get install -y python3-pip python3-venv python3-dev git \
    build-essential cmake libatlas-base-dev libjasper-dev \
    libcamera0 libcamera-dev python3-libcamera python3-picamera2

# 3. Setup project
cd ~ && mkdir glass-defect-detection && cd glass-defect-detection
python3 -m venv venv
source venv/bin/activate

# 4. Install Python packages
pip install --upgrade pip setuptools wheel
pip install aiortc==1.7.0 av==10.0.0 aiohttp==3.8.5
pip install ultralytics opencv-python opencv-contrib-python
pip install supabase python-socketio[client] requests numpy Pillow python-dotenv

# 5. Get YOLO model
wget https://github.com/ultralytics/assets/releases/download/v8.0.0/yolov11n.pt

# 6. Create .env
cat > .env << EOF
BACKEND_URL=http://192.168.1.100:5000
DEVICE_ID=raspberry-pi-1
SUPABASE_URL=https://kfeztemgrbkfwaicvgnk.supabase.co
SUPABASE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmZXp0ZW1ncmJrZndhaWN2Z25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMDM4NDIsImV4cCI6MjA3Njc3OTg0Mn0.n4F6v_kywu55Nj2Yx_dcZri4WsdUMaftzPl1FXT-to8
WEBRTC_ENABLED=true
EOF

# 7. Test camera
libcamera-hello --time 1

# 8. Verify installation
python3 -c "from aiortc import RTCPeerConnection; from ultralytics import YOLO; import cv2; print('✅ All packages ready!')"

echo "✅ Installation complete! Run: python3 glass_detection_webrtc.py"
```

---

## Storage & Performance Tips

### Optimize SD Card Performance

```bash
# Check current settings
cat /boot/cmdline.txt

# Add to increase performance (edit with sudo nano)
sudo nano /boot/cmdline.txt
# Add at end: noatime nodiratime
```

### Monitor System Resources

```bash
# Real-time monitoring
htop

# Check disk space
df -h

# Check CPU temperature
vcgencmd measure_temp

# Check memory usage
free -h
```

### Enable GPU Acceleration

```bash
# Check GPU memory
vcgencmd get_mem gpu

# Increase if needed (edit config.txt)
sudo nano /boot/config.txt
# Add: gpu_mem=256
```

---

## Next Steps

1. ✅ Complete all installation steps above
2. ✅ Test camera with: `libcamera-hello --time 1`
3. ✅ Start backend on your main computer: `cd backend && npm start`
4. ✅ Run detection: `python3 glass_detection_webrtc.py`
5. ✅ Verify stream in dashboard: http://localhost:3000
6. ✅ Test Supabase uploads

---

**Total Installation Time:** 90-120 minutes (including downloads and compilations)

**Status:** ✅ COMPLETE RASPBERRY PI SETUP

