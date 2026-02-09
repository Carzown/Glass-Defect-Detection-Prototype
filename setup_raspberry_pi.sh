#!/bin/bash
# Raspberry Pi Setup Script for Glass Defect Detection WebRTC Streaming
# Run this script to install all dependencies and prepare your Pi

set -e

echo "=========================================="
echo "🍓 Raspberry Pi Setup for WebRTC Streaming"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. System Update
echo -e "${YELLOW}[1/6] Updating system packages...${NC}"
sudo apt-get update
sudo apt-get upgrade -y

# 2. Core Dependencies
echo -e "${YELLOW}[2/6] Installing core dependencies...${NC}"
sudo apt-get install -y \
    python3-pip \
    python3-venv \
    python3-dev \
    git \
    libatlas-base-dev \
    libjasper-dev \
    libtiff5 \
    libjasper1 \
    libharfbuzz0b \
    libwebp6 \
    libtiff5 \
    libjasper1 \
    libharfbuzz0b \
    libwebp6 \
    libopenjp2-7 \
    libtiffxx5 \
    libopenjp2-7-dev \
    libjasper-dev \
    libharfbuzz0b \
    libwebp6 \
    libtiff5 \
    libatlas-base-dev \
    libjasper-dev \
    libharfbuzz0b \
    libwebp6 \
    libtiff5 \
    libopenjp2-7 \
    libharfbuzz0b \
    libwebp6 \
    libtiff5 \
    libopenjp2-7-dev

# 3. Camera Support (Picamera2)
echo -e "${YELLOW}[3/6] Installing camera support...${NC}"
sudo apt-get install -y \
    libcamera0 \
    libcamera-dev \
    libpython3-dev \
    python3-libcamera \
    python3-picamera2 \
    libopenjp2-7 \
    libtiff5

# 4. WebRTC and Media Libraries
echo -e "${YELLOW}[4/6] Installing WebRTC and media libraries...${NC}"
sudo apt-get install -y \
    libavformat-dev \
    libavcodec-dev \
    libswscale-dev \
    libavutil-dev \
    libavdevice-dev \
    libavfilter-dev \
    libswresample-dev

# 5. Python Packages via pip
echo -e "${YELLOW}[5/6] Installing Python packages (this may take 10-15 minutes)...${NC}"

# Create virtual environment (optional but recommended)
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
fi

# Upgrade pip and install wheel
pip install --upgrade pip setuptools wheel

# Install core WebRTC packages
echo "Installing WebRTC packages..."
pip install aiortc==1.7.0
pip install av==10.0.0
pip install aiohttp==3.8.5

# Install YOLO and dependencies
echo "Installing YOLO and computer vision packages..."
pip install ultralytics
pip install opencv-python
pip install opencv-contrib-python

# Install Supabase (for defect storage)
echo "Installing Supabase client..."
pip install supabase

# Install requests and other utilities
echo "Installing utility packages..."
pip install requests
pip install numpy
pip install Pillow

# 6. Verify Installation
echo -e "${YELLOW}[6/6] Verifying installation...${NC}"
echo ""

echo -e "${GREEN}Testing import:${NC}"
python3 -c "from aiortc import RTCPeerConnection; print('✅ aiortc OK')" && echo "✅ aiortc" || echo "❌ aiortc"
python3 -c "from ultralytics import YOLO; print('✅ YOLO OK')" && echo "✅ YOLO" || echo "❌ YOLO"
python3 -c "import cv2; print('✅ OpenCV OK')" && echo "✅ OpenCV" || echo "❌ OpenCV"
python3 -c "from picamera2 import Picamera2; print('✅ Picamera2 OK')" && echo "✅ Picamera2" || echo "❌ Picamera2"
python3 -c "from supabase import create_client; print('✅ Supabase OK')" && echo "✅ Supabase" || echo "❌ Supabase"

echo ""
echo "=========================================="
echo -e "${GREEN}✅ Installation Complete!${NC}"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Download YOLO model: wget https://github.com/ultralytics/assets/releases/download/v8.0.0/yolov11n.pt"
echo "  2. Rename it: mv yolov11n.pt best.pt"
echo "  3. Test camera: libcamera-hello --time 1"
echo "  4. Download project files from: [your repo]"
echo "  5. Configure environment variables in .env.webrtc"
echo "  6. Run: python3 glass_detection_webrtc.py"
echo ""
echo "For manual installation, see: RASPBERRY_PI_SETUP.md"
echo ""
