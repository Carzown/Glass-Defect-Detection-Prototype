#!/bin/bash
# Quick start script for WebRTC streaming setup
# Run this on your Raspberry Pi to start streaming

echo "🚀 Glass Detection WebRTC Quick Start"
echo "===================================="
echo ""

# Check if BACKEND_URL is set
if [ -z "$BACKEND_URL" ]; then
    echo "⚠️  BACKEND_URL not set!"
    echo ""
    echo "Usage:"
    echo "  export BACKEND_URL=http://localhost:5000      # For local testing"
    echo "  export BACKEND_URL=http://192.168.1.100:5000  # For remote server"
    echo "  export DEVICE_ID=raspberry-pi-1               # (optional)"
    echo "  bash run_webrtc.sh"
    echo ""
    exit 1
fi

echo "Configuration:"
echo "  Backend: $BACKEND_URL"
echo "  Device:  ${DEVICE_ID:-raspberry-pi-1}"
echo "  WebRTC:  Enabled"
echo ""

# Check if model exists
if [ ! -f "best.pt" ]; then
    echo "❌ Error: best.pt model not found in current directory"
    echo ""
    echo "Download the model first:"
    echo "  wget https://path-to-model/best.pt"
    echo ""
    exit 1
fi

echo "Starting detection..."
echo "Press Ctrl+C to stop"
echo ""

# Run detection
export WEBRTC_ENABLED=true
export DEVICE_ID="${DEVICE_ID:-raspberry-pi-1}"

python3 glass_detection_webrtc.py
