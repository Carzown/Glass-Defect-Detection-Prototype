# 🍓 Raspberry Pi Installation - Quick Summary

**Target:** Raspberry Pi 5 with Camera  
**Time:** 90-120 minutes  
**Updated:** February 9, 2026

---

## ⚡ TL;DR - One Command Install

Copy and paste this one line on your Raspberry Pi:

```bash
curl -fsSL https://raw.githubusercontent.com/Carzown/Glass-Defect-Detection-Prototype/main/raspi_quick_install.sh | bash
```

Or download and run manually:
```bash
wget https://raw.githubusercontent.com/Carzown/Glass-Defect-Detection-Prototype/main/raspi_quick_install.sh
chmod +x raspi_quick_install.sh
./raspi_quick_install.sh
```

---

## 📦 What Gets Installed

### System Packages (via apt-get)
```
✅ python3-pip                          # Python package manager
✅ python3-venv                         # Virtual environments
✅ python3-dev                          # Python development
✅ build-essential                      # Compilation tools
✅ libcamera                            # Modern camera stack
✅ python3-picamera2                    # Camera Python interface
✅ opencv dependencies                  # Image processing libs
```

### Python Packages (via pip)
```
✅ aiortc==1.7.0                        # WebRTC peer connection
✅ av==10.0.0                           # Audio/video processing
✅ aiohttp==3.8.5                       # Async HTTP
✅ ultralytics                          # YOLO detection
✅ opencv-python                        # Computer vision
✅ numpy                                # Numerical computing
✅ Pillow                               # Image processing
✅ supabase                             # Cloud database client
✅ python-socketio[client]              # Socket.IO streaming
✅ requests                             # HTTP requests
✅ python-dotenv                        # Environment variables
```

### Files Generated
```
✅ ~/glass-defect-detection/venv/       # Virtual environment
✅ ~/glass-defect-detection/yolov11n.pt # YOLO model (7MB)
✅ ~/glass-defect-detection/.env        # Configuration
```

---

## 🚀 Installation Steps (Manual)

### 1. System Setup (5 min)
```bash
sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get install -y python3-pip python3-venv python3-dev git
```

### 2. Camera Setup (5 min)
```bash
sudo apt-get install -y libcamera0 libcamera-dev python3-picamera2
sudo raspi-config  # Enable camera in Interface Options
```

### 3. Create Virtual Environment (2 min)
```bash
mkdir -p ~/glass-defect-detection
cd ~/glass-defect-detection
python3 -m venv venv
source venv/bin/activate
```

### 4. Install Dependencies (45-60 min)
```bash
pip install --upgrade pip setuptools wheel
pip install aiortc==1.7.0 av==10.0.0 aiohttp==3.8.5
pip install ultralytics opencv-python opencv-contrib-python
pip install supabase python-socketio[client] requests numpy Pillow python-dotenv
```

### 5. Download YOLO Model (5 min)
```bash
cd ~/glass-defect-detection
wget https://github.com/ultralytics/assets/releases/download/v8.0.0/yolov11n.pt
```

### 6. Configure Environment (2 min)
```bash
cat > .env << EOF
BACKEND_URL=http://192.168.1.100:5000
DEVICE_ID=raspberry-pi-1
SUPABASE_URL=https://kfeztemgrbkfwaicvgnk.supabase.co
SUPABASE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmZXp0ZW1ncmJrZndhaWN2Z25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMDM4NDIsImV4cCI6MjA3Njc3OTg0Mn0.n4F6v_kywu55Nj2Yx_dcZri4WsdUMaftzPl1FXT-to8
WEBRTC_ENABLED=true
EOF
```

### 7. Verify Installation (2 min)
```bash
source venv/bin/activate
python3 -c "from aiortc import RTCPeerConnection; from ultralytics import YOLO; print('✅ Ready!')"
```

### 8. Test Camera (2 min)
```bash
libcamera-hello --time 1
```

### 9. Run Detection (Ongoing)
```bash
source venv/bin/activate
python3 glass_detection_webrtc.py
```

---

## 📋 File Locations

| What | Where |
|------|-------|
| Virtual Environment | `~/glass-defect-detection/venv/` |
| YOLO Model | `~/glass-defect-detection/yolov11n.pt` |
| Configuration | `~/glass-defect-detection/.env` |
| Detection Script | `~/glass-defect-detection/glass_detection_webrtc.py` |
| Project Code | `~/glass-defect-detection/` |

---

## ✅ Verification Checklist

After installation, verify each component:

```bash
# 1. Virtual environment
[ -d ~/glass-defect-detection/venv ] && echo "✅ venv" || echo "❌ venv"

# 2. Python packages
source ~/glass-defect-detection/venv/bin/activate
python3 -c "from aiortc import RTCPeerConnection; print('✅ aiortc')"
python3 -c "from ultralytics import YOLO; print('✅ YOLO')"
python3 -c "import cv2; print('✅ OpenCV')"
python3 -c "from picamera2 import Picamera2; print('✅ Picamera2')"
python3 -c "from supabase import create_client; print('✅ Supabase')"

# 3. YOLO model
[ -f ~/glass-defect-detection/yolov11n.pt ] && echo "✅ YOLO model" || echo "❌ YOLO model"

# 4. Configuration
[ -f ~/glass-defect-detection/.env ] && echo "✅ .env" || echo "❌ .env"

# 5. Camera
libcamera-hello --time 1
```

---

## 🔧 Common Issues & Fixes

### "ModuleNotFoundError: No module named 'aiortc'"
```bash
source ~/glass-defect-detection/venv/bin/activate
pip install --upgrade aiortc av aiohttp
```

### "Camera not found"
```bash
# Enable in raspi-config
sudo raspi-config
# Navigate to: Interface Options > Camera > Enable > Reboot

# Or command:
sudo raspi-config nonint do_camera 0
sudo reboot
```

### "Connection refused" (backend)
```bash
# Update .env with correct backend IP
nano ~/glass-defect-detection/.env
# Change: BACKEND_URL=http://YOUR_COMPUTER_IP:5000

# Check connectivity
ping 192.168.1.100  # Replace with your computer IP
```

### "Out of memory" during installation
```bash
# Add swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 🎯 Next Steps After Installation

### 1. Get Project Files
```bash
cd ~/glass-defect-detection
git clone https://github.com/Carzown/Glass-Defect-Detection-Prototype.git
cp Glass-Defect-Detection-Prototype/glass_detection_webrtc.py .
cp Glass-Defect-Detection-Prototype/glass_detection.py .
```

### 2. Update Backend IP
```bash
# Find your computer's IP
# On Linux/Mac: ifconfig | grep inet
# On Windows: ipconfig

# Update .env
nano .env
# Change: BACKEND_URL=http://YOUR_IP:5000
```

### 3. Start Backend (on your computer)
```bash
cd backend
npm start
# Should see: ✅ listening on port 5000
```

### 4. Start Frontend (on your computer)
```bash
cd react-glass
npm start
# Should see: webpack compiled
```

### 5. Run Detection on Pi
```bash
source ~/glass-defect-detection/venv/bin/activate
python3 ~/glass-defect-detection/glass_detection_webrtc.py
```

### 6. View Live Stream
Open in browser: `http://localhost:3000`

---

## 📊 System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Raspberry Pi | Pi 4B (4GB) | Pi 5 (8GB) |
| Camera | v2 | v3 |
| microSD | 16GB | 32GB |
| Power | 15W | 27W |
| RAM | 4GB | 8GB |

---

## ⏱️ Installation Timeline

| Step | Time |
|------|------|
| System update | 5-10 min |
| Dependencies | 5-10 min |
| Camera setup | 5 min |
| Python packages | 30-45 min ⏳ *longest* |
| YOLO model | 5 min |
| Configuration | 2 min |
| Verification | 2 min |
| **Total** | **60-90 min** |

---

## 📚 Documentation Files

For more detailed information, see:

- **RASPBERRY_PI_INSTALLATION.md** - Full step-by-step guide
- **requirements_raspi.txt** - Python package list
- **setup_raspberry_pi.sh** - Detailed setup script
- **glass_detection_webrtc.py** - Detection script with WebRTC

---

## 🎯 Quick Commands Reference

```bash
# Activate virtual environment
source ~/glass-defect-detection/venv/bin/activate

# Run detection
python3 ~/glass-defect-detection/glass_detection_webrtc.py

# Stop detection
Ctrl+C

# Check system resources
htop

# Monitor camera temperature
vcgencmd measure_temp

# Check internet connection
ping 8.8.8.8

# View logs
tail -f ~/.bashrc

# Restart service
sudo systemctl restart glass-detection.service
```

---

## ✨ What You Get

✅ WebRTC streaming from Pi to dashboard  
✅ Real-time glass defect detection with YOLO  
✅ Automatic image upload to Supabase storage  
✅ Database records with defect metadata  
✅ Live dashboard visualization  
✅ Status management (pending → reviewed → resolved)  
✅ Multi-device support  

---

**Status:** ✅ READY TO INSTALL  
**Last Updated:** February 9, 2026

For support, refer to detailed documentation or README.md

