# Glass Defect Detection - Complete Startup Guide

## ✅ Issues Fixed
1. **Port Conflict**: ControlCenter was using port 5000
   - Solution: Node server now runs on port 5001 (auto-fallback)
   - React and Python scripts updated to use 5001

2. **Environment Variable Issues**:
   - `glass_detection_db.py` now uses `os.getenv("BACKEND_URL")` instead of hardcoded URL
   - React `.env` updated to point to `http://localhost:5001`
   - All configuration is now environment-aware

3. **Socket.IO Connection Issues**:
   - Added proper connection logging
   - Added reconnection logic with exponential backoff
   - Added ping/timeout configuration
   - Added polling fallback for unsupported environments

4. **Frame Streaming Issues**:
   - Improved error handling in device-handler
   - Added logging to debug frame reception and broadcasting
   - Fixed dashboard counter to show active dashboards

---

## 🚀 Quick Start (Local Development)

### 1. Kill any existing processes
```bash
# Kill Node server
pkill -f "node server.js"

# Kill React dev server
pkill -f "npm start" || pkill -f "react-scripts"

# Verify ports are free
lsof -i :5001 || echo "✅ Port 5001 is free"
lsof -i :3000 || echo "✅ Port 3000 is free"
```

### 2. Start backend server (Terminal 1)
```bash
cd /Users/Carzown/Desktop/Projects/Glass-Defect-Detection-Prototype/backend
npm start
```

Expected output:
```
[SERVER] Defects API routes loaded
[device-handler] listening on port 5001
[SERVER] listening on port 5001
```

### 3. Start React frontend (Terminal 2)
```bash
cd /Users/Carzown/Desktop/Projects/Glass-Defect-Detection-Prototype/react-glass
npm start
```

Expected output:
```
Compiled successfully!
Local: http://localhost:3000
```

### 4. Test from browser
- Open http://localhost:3000
- Open Browser DevTools (F12)
- Go to Console tab
- Should see: `[Dashboard] Socket.IO connected: <socket-id>`

---

## 📡 Raspberry Pi Connection Setup

### On Your Development Machine:
```bash
# Get your machine IP
ifconfig | grep "inet " | grep -v "127.0.0.1"
# Example output: inet 192.168.1.39
```

### On Raspberry Pi:
```bash
# Start detection with correct backend URL
export BACKEND_URL=http://192.168.1.39:5001
python3 glass_detection_db.py
```

Expected output:
```
⏱️  Connecting to backend at http://192.168.1.39:5001...
✅ Connected to backend at http://192.168.1.39:5001
YOLOv11 segmentation running. Press 'q' to quit.
```

### On your browser:
- Refresh http://localhost:3000
- Should see live camera feed in the "Live Detection Stream" section

---

## 🐛 Troubleshooting

### Backend shows "Port 5000 in use"
This is expected (macOS ControlCenter). It will auto-fallback to 5001.
```bash
# Verify it's running on 5001
lsof -i :5001 | grep node
```

### Browser console shows "Connection error"
1. Check backend is running: `curl http://localhost:5001/health`
2. Check `.env` file: `cat react-glass/.env | grep BACKEND_URL`
3. Should show: `REACT_APP_BACKEND_URL=http://localhost:5001`

### Python script can't connect
1. Check backend URL: `echo $BACKEND_URL`
2. Test connectivity: `curl http://your-ip:5001/health`
3. Verify environment variable is set before running script

### No camera frames appearing
1. Check server logs for frame reception:
   ```
   [device:frame] Received frame from raspberry-pi-1
   ```
2. Check dashboard logs for broadcast:
   ```
   [stream:frame] Broadcasting to 1 dashboard(s)
   ```
3. If Raspberry Pi not showing defects, verify Supabase configuration

---

## 📋 Config Summary

**Backend** (Node.js on port 5001):
- Socket.IO enabled with websocket + polling
- Ping timeout: 60 seconds
- Supports device and dashboard connections
- Relays frames: `device:frame` → `stream:frame`

**React Frontend** (port 3000):
- Connects to Socket.IO at `http://localhost:5001`
- Auto-reconnects up to 5 times
- Displays live frames in real-time
- Polls Supabase for defect list every 3 seconds

**Raspberry Pi Script**:
- Reads `BACKEND_URL` from environment or defaults to `http://localhost:5000`
- Sends frames via `device:frame` event (base64 JPEG)
- Saves defects to Supabase database
- Uploads detection images to Supabase storage

---

## 🔧 Manual Port Configuration

To use a different port:

**Backend**:
```bash
PORT=8000 npm start  # Starts on port 8000
```

**React**:
```bash
# Edit react-glass/.env
REACT_APP_BACKEND_URL=http://localhost:8000
npm start
```

**Raspberry Pi**:
```bash
export BACKEND_URL=http://192.168.1.39:8000
python3 glass_detection_db.py
```

---

## ✨ What's Working Now
- ✅ Socket.IO connections between all components
- ✅ Real-time frame streaming from Raspberry Pi to Dashboard
- ✅ Device status updates
- ✅ Defect detection and logging
- ✅ Environment variable configuration
- ✅ Automatic port fallback
- ✅ Connection logging and debugging
- ✅ Graceful reconnection logic

