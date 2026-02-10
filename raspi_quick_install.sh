#!/bin/bash

# 🍓 Glass Defect Detection - Raspberry Pi Quick Installation
# Copy & paste this entire script to install everything at once

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}================================${NC}"
echo -e "${YELLOW}🍓 Raspberry Pi Installation${NC}"
echo -e "${YELLOW}================================${NC}"
echo ""

# 1. System Update
echo -e "${YELLOW}[1/8] Updating system...${NC}"
sudo apt-get update -qq
sudo apt-get upgrade -y -qq
echo -e "${GREEN}✅ System updated${NC}"

# 2. Core Dependencies
echo -e "${YELLOW}[2/8] Installing core dependencies...${NC}"
sudo apt-get install -y -qq \
    python3-pip python3-venv python3-dev git wget curl build-essential cmake \
    libatlas-base-dev libjasper-dev libtiff5 libharfbuzz0b libwebp6 \
    libopenjp2-7 libopenjp2-7-dev
echo -e "${GREEN}✅ Core dependencies installed${NC}"

# 3. Camera Support
echo -e "${YELLOW}[3/8] Installing camera support...${NC}"
sudo apt-get install -y -qq \
    libcamera0 libcamera-dev python3-libcamera python3-picamera2
echo -e "${GREEN}✅ Camera support installed${NC}"

# 4. Setup Virtual Environment
echo -e "${YELLOW}[4/8] Setting up Python virtual environment...${NC}"
cd ~
mkdir -p glass-defect-detection
cd glass-defect-detection
python3 -m venv venv
source venv/bin/activate
echo -e "${GREEN}✅ Virtual environment created${NC}"

# 5. Upgrade pip
echo -e "${YELLOW}[5/8] Upgrading pip...${NC}"
pip install --upgrade pip setuptools wheel -q
echo -e "${GREEN}✅ pip upgraded${NC}"

# 6. Install Python Packages
echo -e "${YELLOW}[6/8] Installing Python packages (this may take 10-20 minutes)...${NC}"
pip install -q \
    aiortc==1.7.0 av==10.0.0 aiohttp==3.8.5 \
    ultralytics opencv-python opencv-contrib-python \
    supabase python-socketio[client] \
    requests numpy Pillow python-dotenv pyyaml
echo -e "${GREEN}✅ Python packages installed${NC}"

# 7. Download YOLO Model
echo -e "${YELLOW}[7/8] Downloading YOLO model...${NC}"
wget -q https://github.com/ultralytics/assets/releases/download/v8.0.0/yolov11n.pt -O yolov11n.pt
echo -e "${GREEN}✅ YOLO model downloaded${NC}"

# 8. Create .env File
echo -e "${YELLOW}[8/8] Creating configuration file...${NC}"
cat > .env << 'EOF'
# Backend Connection (update with your IP)
BACKEND_URL=http://192.168.1.100:5000
DEVICE_ID=raspberry-pi-1

# Supabase Configuration
SUPABASE_URL=https://kfeztemgrbkfwaicvgnk.supabase.co
SUPABASE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmZXp0ZW1ncmJrZndhaWN2Z25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMDM4NDIsImV4cCI6MjA3Njc3OTg0Mn0.n4F6v_kywu55Nj2Yx_dcZri4WsdUMaftzPl1FXT-to8

# Detection Settings
YOLO_MODEL=yolov11n.pt
CONFIDENCE_THRESHOLD=0.5

# WebRTC Settings
WEBRTC_ENABLED=true
EOF
echo -e "${GREEN}✅ Configuration file created${NC}"

# 9. Verify Installation
echo ""
echo -e "${YELLOW}Verifying installation...${NC}"
python3 << 'VERIFY'
try:
    from aiortc import RTCPeerConnection
    print("  ✅ aiortc")
except: print("  ❌ aiortc")
try:
    from ultralytics import YOLO
    print("  ✅ ultralytics")
except: print("  ❌ ultralytics")
try:
    import cv2
    print("  ✅ opencv")
except: print("  ❌ opencv")
try:
    from picamera2 import Picamera2
    print("  ✅ picamera2")
except: print("  ❌ picamera2")
try:
    from supabase import create_client
    print("  ✅ supabase")
except: print("  ❌ supabase")
VERIFY

echo ""
echo -e "${GREEN}════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Installation Complete!${NC}"
echo -e "${GREEN}════════════════════════════════════${NC}"
echo ""
echo "📋 Next steps:"
echo ""
echo "1. Test camera:"
echo "   libcamera-hello --time 1"
echo ""
echo "2. Update .env file with your backend IP:"
echo "   nano .env"
echo "   # Change BACKEND_URL to your computer's IP"
echo ""
echo "3. Run detection:"
echo "   source venv/bin/activate"
echo "   python3 glass_detection_webrtc.py"
echo ""
echo "4. Download project files:"
echo "   git clone https://github.com/Carzown/Glass-Defect-Detection-Prototype.git"
echo "   cp glass_detection_webrtc.py ."
echo ""
echo "📁 Project location: ~/glass-defect-detection"
echo "🔧 Configuration file: ~/glass-defect-detection/.env"
echo "🤖 YOLO model: ~/glass-defect-detection/yolov11n.pt"
echo ""

