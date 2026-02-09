# Step-by-Step Fix for Raspberry Pi Live Camera Stream

## The Problem in One Sentence
Your Raspberry Pi doesn't know where your backend server is, so it can't send camera frames.

## The Solution in One Line
```bash
export BACKEND_URL=http://YOUR_IP:5000 && python glass_detection.py
```

---

## Detailed Steps

### Step 1: Find Your Backend Machine IP Address

**If backend is on same machine as Raspberry Pi:**
```bash
# On that machine
ifconfig | grep "inet " | grep -v 127.0.0.1
# Look for something like: inet 192.168.1.123
```

**If backend is on different machine:**
```bash
# On backend machine
ifconfig | grep "inet " | grep -v 127.0.0.1
# Look for something like: inet 192.168.1.123
```

Write down this IP. We'll call it `YOUR_IP`.

### Step 2: Verify Backend Server is Running

On your backend machine:
```bash
# Check if running
lsof -i :5000

# If yes, you'll see node process
# If no, start it:
cd /path/to/backend
npm start

# Wait for output:
# ✅ Server running on port 5000
```

### Step 3: Test Connection from Raspberry Pi

SSH into your Raspberry Pi:
```bash
ssh pi@your-raspberry-pi.local
# or
ssh pi@192.168.1.XXX
```

Test if it can reach backend:
```bash
# Replace YOUR_IP with actual IP from Step 1
curl http://YOUR_IP:5000/health

# Should return: {"ok":true}
# If it fails, firewall might be blocking port 5000
```

### Step 4: Set Backend URL Environment Variable

Still on Raspberry Pi:
```bash
# Option A: Temporary (just for this session)
export BACKEND_URL=http://YOUR_IP:5000
python glass_detection.py

# Option B: Permanent (add to ~/.bashrc)
echo 'export BACKEND_URL=http://YOUR_IP:5000' >> ~/.bashrc
source ~/.bashrc
python glass_detection.py
```

### Step 5: Watch for Success Message

In glass_detection.py output, you should see:
```
✅ Supabase initialized
⏱️  Connecting to backend for optional real-time notifications...
Connected to backend (optional)

YOLOv11 segmentation running. Press 'q' to quit.
```

If you see **"Connected to backend (optional)"** - You fixed it! 🎉

### Step 6: Verify on Website

1. Open your website: http://localhost:3000/dashboard
2. Press **F12** to open DevTools
3. Check **Console** tab
4. Should NOT see any "Cannot connect" errors
5. Point camera at an object or trigger defect detection
6. Watch for "LIVE" badge to appear in top-left of camera box

---

## Troubleshooting by Symptom

### "Could not connect to backend (non-critical)"
**Problem**: Raspberry Pi can't reach backend  
**Solution**:
1. Check `BACKEND_URL` environment variable is set correctly
2. Test: `curl http://YOUR_IP:5000/health`
3. If curl fails, backend IP is wrong or firewall blocking port 5000
4. Check backend is actually running: `lsof -i :5000` on backend machine

### "Waiting for Camera Stream" on website
**Problem**: Website connected to backend, but not receiving frames  
**Solution**:
1. Make sure glass_detection.py shows "Connected to backend"
2. Trigger a defect or wait for detection
3. Check backend logs with `export DEBUG_FRAMES=1` before `npm start`
4. Look for: `[device:frame] from raspberry-pi-1`

### Website shows "Live" but image doesn't update
**Problem**: Frames arriving but not displaying  
**Solution**:
1. Check browser console (F12)
2. Look for errors in Console tab
3. Check `REACT_APP_BACKEND_URL` is set in react-glass/.env.local
4. Restart React app: `npm start` in react-glass folder

---

## Complete Working Example

### Example: Backend on machine 192.168.1.123, Raspberry Pi on 192.168.1.45

**On backend machine (192.168.1.123):**
```bash
cd /path/to/Glass-Defect-Detection-Prototype/backend
npm start
# Outputs: ✅ Server running on port 5000
```

**On Raspberry Pi (192.168.1.45):**
```bash
# SSH in or open terminal
ssh pi@192.168.1.45

# Set backend URL
export BACKEND_URL=http://192.168.1.123:5000

# Run detection
python glass_detection.py

# Outputs:
# ✅ Supabase initialized
# ⏱️  Connecting to backend for optional real-time notifications...
# Connected to backend (optional)
# YOLOv11 segmentation running...
```

**On your computer's browser:**
```
http://localhost:3000/dashboard
```

When you point camera at defect:
- Raspberry Pi logs show: "DEFECT DETECTED"
- Website list shows new defect
- **PLUS**: Camera image appears in "Live Detection Stream" box

---

## Make It Permanent

So you don't have to set `BACKEND_URL` every time:

```bash
# On Raspberry Pi
sudo nano ~/.bashrc

# Add this line at the end (use your actual IP):
export BACKEND_URL=http://192.168.1.123:5000

# Save: Ctrl+O, Enter, Ctrl+X

# Apply changes:
source ~/.bashrc

# Verify it works:
echo $BACKEND_URL
# Should print: http://192.168.1.123:5000

# Now it will persist even after reboot
python glass_detection.py
```

---

## If Firewall is Blocking Port 5000

On your backend machine:

```bash
# Check if firewall is active
sudo ufw status

# If active, allow port 5000
sudo ufw allow 5000/tcp

# Or if using iptables
sudo iptables -A INPUT -p tcp --dport 5000 -j ACCEPT
```

---

## Remember

✅ **The system works without live streaming!**
- Defects still save to database
- Website polls every 3 seconds
- Defects appear in list
- Images load from storage bucket
- Status updates work

The live camera is a bonus. If it's not working, everything else still functions perfectly.

---

## Summary

1. **Find backend IP**: `ifconfig` on backend machine
2. **Start backend**: `npm start` in backend folder
3. **Set URL on Raspberry Pi**: `export BACKEND_URL=http://YOUR_IP:5000`
4. **Run detection**: `python glass_detection.py`
5. **Check for**: "Connected to backend (optional)" message
6. **Verify website**: Should show LIVE badge and camera feed

That's it! 🚀
