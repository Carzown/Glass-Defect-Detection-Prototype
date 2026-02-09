# Why Your Raspberry Pi Camera Isn't Streaming - Root Cause Analysis

## The Issue

Your website shows "Cannot connect to backend for live stream" because the Socket.IO connection between the Raspberry Pi and backend isn't working.

## How the System Works

```
[Raspberry Pi - glass_detection.py]
     │
     ├─ Detects defects with YOLOv11 ✅
     ├─ Saves to Supabase Database ✅ (This works!)
     └─ Emits frames via Socket.IO ❌ (This is broken)
              │
              ↓ (should travel here)
     [Backend Server - port 5000]
              │
              ├─ Receives frame from Raspberry Pi
              └─ Relays to website via Socket.IO
                        │
                        ↓
              [Website - Dashboard]
              Shows live camera stream in browser
```

The defect detection part (Supabase) is working fine. The live streaming part (Socket.IO) is not.

## Three Things to Check

### #1: Backend Server Running?
```bash
# Check if port 5000 is in use
lsof -i :5000
# If nothing shows, backend isn't running

# Start it:
cd backend
npm start
```

You should see: `✅ Server running on port 5000`

### #2: Backend URL on Raspberry Pi?
On your Raspberry Pi, before running detection:
```bash
export BACKEND_URL=http://YOUR_BACKEND_IP:5000
python glass_detection.py
```

Check the output for:
- ✅ "Connected to backend" = Good!
- ❌ "Could not connect to backend" = Bad!

If you see "Could not connect" - that's your problem!

### #3: Website Knows Where Backend Is?
```bash
# In react-glass/.env.local
REACT_APP_BACKEND_URL=http://YOUR_BACKEND_IP:5000
```

Then restart: `npm start`

## Most Likely Culprit: BACKEND_URL Not Set on Raspberry Pi

If you just run `python glass_detection.py` without setting `BACKEND_URL`, the script tries `http://localhost:5000` which doesn't exist on the Raspberry Pi.

**Fix it:**
```bash
# On Raspberry Pi, before running detection:
export BACKEND_URL=http://192.168.1.XXX:5000
python glass_detection.py
```

Replace `192.168.1.XXX` with your actual backend machine IP.

## Important: System Works Without Live Stream

Your defect detection **already works**:
- ✅ Raspberry Pi detects defects
- ✅ Saves to Supabase database
- ✅ Website polls every 3 seconds
- ✅ Defects appear in list
- ✅ Click to see full image
- ✅ Status updates work

The live camera feed is a bonus feature. Without it, the system is 100% functional.

## Quick Diagnostic Script

Run this on backend machine:

```bash
echo "=== Checking Backend ==="
lsof -i :5000 && echo "✅ Running" || echo "❌ Not running"

echo ""
echo "=== Testing Health Endpoint ==="
curl http://localhost:5000/health 2>/dev/null | grep -q ok && echo "✅ Responds" || echo "❌ No response"

echo ""
echo "=== Environment Config ==="
echo "Backend URL from .env:"
grep -i port backend/.env || echo "❌ Not found"

echo ""
echo "Frontend config:"
grep REACT_APP_BACKEND_URL react-glass/.env.local || echo "❌ Not found"
```

## What to Do Now

1. **Start backend:**
   ```bash
   cd backend
   npm start
   # Keep this running in a terminal window
   ```

2. **Set backend URL on Raspberry Pi:**
   ```bash
   # SSH to Raspberry Pi
   ssh pi@raspberry-pi
   
   # Set the backend URL (use your actual IP)
   export BACKEND_URL=http://192.168.1.123:5000
   
   # Run detection
   python glass_detection.py
   ```

3. **Check website:**
   - Open Dashboard
   - Press F12 to open DevTools
   - Look for connection errors
   - Watch for "LIVE" indicator to appear

4. **Look for Success Messages:**

   **In glass_detection.py output:**
   ```
   Connected to backend (optional)
   ```

   **In website console (F12):**
   ```
   Device status: {online: true, deviceId: "raspberry-pi-1"}
   ```

   **In backend logs (if DEBUG_FRAMES=1):**
   ```
   [device:frame] from raspberry-pi-1
   [stream:frame] broadcast to dashboards
   ```

## If Still Broken

Check these in order:

1. Can Raspberry Pi reach backend?
   ```bash
   # On Raspberry Pi
   curl http://YOUR_BACKEND_IP:5000/health
   # Should return: {"ok":true}
   ```

2. Is firewall blocking port 5000?
   ```bash
   # On backend machine
   sudo ufw allow 5000/tcp
   ```

3. Is backend behind router/NAT?
   - Use actual machine IP, not localhost
   - Check what IP Raspberry Pi should use: `ifconfig` on backend machine

4. Network cable or WiFi working?
   ```bash
   # On Raspberry Pi
   ping YOUR_BACKEND_IP
   ```

## TL;DR

**Most likely fix:**
```bash
# On Raspberry Pi
export BACKEND_URL=http://192.168.1.YOUR_IP:5000
python glass_detection.py
```

Replace with your actual backend machine IP address. If that works, add it to your `~/.bashrc` so it persists.

---

Created: February 8, 2026  
See also: `LIVE_STREAM_QUICK_FIX.md` for more debugging steps
