# Live Camera Stream Quick Checklist

## The Most Common Issues (Check These First!)

### 1️⃣ Backend Not Running or Wrong Port
```bash
# Check if running
lsof -i :5000

# If not running, start it
cd backend
npm start
# Should see: ✅ Server running on port 5000
```

### 2️⃣ Raspberry Pi Doesn't Know Where Backend Is
On your Raspberry Pi, before running glass_detection.py:
```bash
# Set the backend URL (use your actual backend machine IP)
export BACKEND_URL=http://192.168.1.XXX:5000
python glass_detection.py
```

**glass_detection.py should print:**
```
✅ Supabase initialized
⏱️  Connecting to backend for optional real-time notifications...
Connected to backend (optional)
```

If you see "Could not connect to backend" - that's your issue!

### 3️⃣ Website Points to Wrong Backend URL
```bash
# Check react-glass/.env.local
cat react-glass/.env.local

# Must have:
REACT_APP_BACKEND_URL=http://192.168.1.XXX:5000
```

Then restart React app:
```bash
cd react-glass
npm start
```

### 4️⃣ Firewall Blocking Port 5000
Test if backend is reachable from Raspberry Pi:
```bash
# From Raspberry Pi
curl http://192.168.1.XXX:5000/health
# Should return: {"ok":true}
```

If it fails, your firewall is blocking the connection.

## The Full Flow (What Should Happen)

1. **Raspberry Pi** connects to backend with: `client:hello` event
2. **Backend** registers it as a "device"
3. **Raspberry Pi** sends each frame with: `device:frame` event
4. **Backend** receives and relays with: `stream:frame` event
5. **Website** receives `stream:frame` and displays image
6. **Browser console** should be clean (no errors)

## Quick Debug (Do This in Order)

### Step 1: Is Backend Running?
```bash
cd backend
npm start
# Wait for: ✅ Server running on port 5000
```

### Step 2: Can Website Connect?
1. Open website: http://localhost:3000
2. Go to Dashboard
3. Press F12 (DevTools)
4. Check Console tab
5. Should see NO errors about Socket.IO

### Step 3: Is Raspberry Pi Running?
SSH into Raspberry Pi:
```bash
# Set backend URL
export BACKEND_URL=http://YOUR_BACKEND_IP:5000

# Run detection
python glass_detection.py

# Should print:
# ✅ Supabase initialized
# Connected to backend (optional)
# YOLOv11 segmentation running...
```

### Step 4: Enable Verbose Logging on Backend
```bash
cd backend
export DEBUG_FRAMES=1
npm start

# Now watch the terminal while Raspberry Pi sends frames
# You should see:
# [device:frame] from raspberry-pi-1 defects: 0
# [stream:frame] broadcast to dashboards...
```

### Step 5: Watch Browser for Frames
1. Keep DevTools open in browser
2. Go to Console tab
3. You should see frames arriving (scroll through console)
4. Image in dashboard should update in real-time

## If It's Still Not Working

**Remember**: The live camera stream is **OPTIONAL**. Your system has a backup:

✅ Defects still save to Supabase database
✅ Website still polls database every 3 seconds
✅ Modal still shows defect images from storage bucket
✅ Status updates still work

So even without live streaming, the system fully functions!

But here's what to do:

### Enable Maximum Debugging
```bash
# Backend
cd backend
export DEBUG_FRAMES=1
npm start

# In another terminal, on Raspberry Pi
export BACKEND_URL=http://YOUR_BACKEND_IP:5000
python glass_detection.py 2>&1 | tee detection.log

# In browser, open DevTools and paste:
socket.on('stream:frame', (data) => console.log('Frame:', data));
```

### Check Every Connection Point
```bash
# From your laptop/where backend runs:
curl http://localhost:5000/health

# From Raspberry Pi:
curl http://YOUR_BACKEND_IP:5000/health

# From browser console (DevTools):
fetch('http://YOUR_BACKEND_IP:5000/health').then(r => r.json()).then(console.log)
```

All three should return `{"ok":true}`

### Network Diagnostics
```bash
# On Raspberry Pi, check if it can reach backend:
ping YOUR_BACKEND_IP
nc -zv YOUR_BACKEND_IP 5000  # Should say "succeeded" or "open"

# Check what IP Raspberry Pi sees for backend:
getent hosts YOUR_BACKEND_IP
```

## Summary

Most common fixes (in order):
1. ✅ Start backend server
2. ✅ Set `BACKEND_URL` on Raspberry Pi
3. ✅ Set `REACT_APP_BACKEND_URL` in react-glass/.env.local
4. ✅ Restart React app
5. ✅ Check firewall isn't blocking port 5000

If all else fails, system still works without live stream (uses Supabase polling instead).
