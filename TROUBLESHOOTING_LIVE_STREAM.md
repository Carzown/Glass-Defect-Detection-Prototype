# Troubleshooting: Raspberry Pi Live Camera Stream Not Working

## Quick Diagnosis Checklist

Your system architecture for live streaming:
```
Raspberry Pi (glass_detection.py)
   ↓ (emits "device:frame" via Socket.IO)
Backend Server (device-handler.js)
   ↓ (relays as "stream:frame" to dashboards)
Website (Dashboard.js)
   ↓ (listens for "stream:frame" events)
Live Camera Display
```

## Step 1: Verify Backend Server is Running

Check that the backend is running on the correct port:

```bash
# On your backend machine:
cd /Users/Carzown/Desktop/Projects/Glass-Defect-Detection-Prototype/backend

# Check if server is running
lsof -i :5000
# OR
netstat -an | grep 5000

# If not running, start it:
npm start
# Should output: ✅ Server running on port 5000
```

**Expected output:**
```
Server listening on port 5000
✅ Server running on port 5000
```

## Step 2: Check Backend Environment Variables

Verify the backend has correct configuration:

```bash
# Check your backend/.env file exists
cat backend/.env

# Should contain at minimum:
# PORT=5000
# SUPABASE_URL=https://...
# SUPABASE_KEY=...
```

## Step 3: Verify Raspberry Pi is Sending Frames

Create a test script to check if the Raspberry Pi can connect to the backend:

**Create file: `backend/scripts/test-socket-connection.js`**

```javascript
const { io } = require('socket.io-client');

const BACKEND_URL = process.argv[2] || 'http://localhost:5000';

const socket = io(BACKEND_URL, { transports: ['websocket'] });

socket.on('connect', () => {
  console.log('✅ Connected to backend');
  
  // Send device identification
  socket.emit('client:hello', { role: 'device', deviceId: 'test-device' });
  
  // Send a test frame
  setTimeout(() => {
    const testPayload = {
      image: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      mime: 'image/png',
      deviceId: 'test-device',
      time: new Date().toISOString(),
      defects: []
    };
    
    socket.emit('device:frame', testPayload);
    console.log('📤 Sent test frame to backend');
    
    // Wait and disconnect
    setTimeout(() => {
      socket.disconnect();
      console.log('Disconnected');
    }, 2000);
  }, 1000);
});

socket.on('connect_error', (error) => {
  console.log('❌ Connection error:', error.message);
  process.exit(1);
});

socket.on('disconnect', () => {
  console.log('Disconnected from backend');
});
```

Run the test:
```bash
# From backend directory
node scripts/test-socket-connection.js http://YOUR_BACKEND_IP:5000
```

**What to look for:**
- ✅ "Connected to backend" = Backend is reachable
- ❌ "Connection error" = Backend URL is wrong or server not running

## Step 4: Check Raspberry Pi Connection (glass_detection.py)

On your Raspberry Pi, verify the BACKEND_URL environment variable:

```bash
# On Raspberry Pi
echo $BACKEND_URL
# Should output your backend IP and port like: http://192.168.1.100:5000
```

If not set, set it:

```bash
# Option A: Temporary (this session only)
export BACKEND_URL=http://YOUR_BACKEND_IP:5000
python glass_detection.py

# Option B: Permanent (add to ~/.bashrc or ~/.zshrc)
echo 'export BACKEND_URL=http://YOUR_BACKEND_IP:5000' >> ~/.bashrc
source ~/.bashrc
python glass_detection.py
```

**Expected output from glass_detection.py:**
```
✅ Supabase initialized
⏱️  Connecting to backend for optional real-time notifications...
Connected to backend (optional)

YOLOv11 segmentation running. Press 'q' to quit.
Sending defects to Supabase database in real-time...
```

## Step 5: Check Browser Console for Errors

On your website (Dashboard page):
1. Open DevTools: **F12**
2. Go to **Console** tab
3. Look for any errors like:
   - ❌ "Cannot connect to backend for live stream"
   - ❌ "WebSocket connection failed"
   - ✅ "Device status: online" (good sign!)

## Step 6: Verify Socket.IO Connection from Frontend

Check that the React app has the correct backend URL:

```bash
# Check react-glass/.env.local
cat react-glass/.env.local

# Should have:
REACT_APP_BACKEND_URL=http://YOUR_BACKEND_IP:5000
```

If missing, update it:

```bash
echo 'REACT_APP_BACKEND_URL=http://YOUR_BACKEND_IP:5000' > react-glass/.env.local
```

Then restart the React app:

```bash
cd react-glass
npm start
```

## Step 7: Test Complete Flow with Logging

Enable debug logging to see frame transmission:

1. **On Backend**: Set debug flag
```bash
# In backend directory
export DEBUG_FRAMES=1
npm start
```

This will output:
```
[device:frame] from raspberry-pi-1 defects: 0
[stream:frame] broadcast to dashboards for raspberry-pi-1
```

2. **On Raspberry Pi**: Run glass_detection.py and trigger a defect detection

3. **Check backend logs** - should show frames being relayed

4. **Check browser DevTools Network tab**:
   - Look for WebSocket connection to backend
   - Should see `stream:frame` events coming in
   - Each event should have a `dataUrl` field

## Common Issues and Fixes

### Issue 1: "Cannot connect to backend for live stream"

**Cause**: Website can't reach backend via Socket.IO

**Fix**:
1. Verify `REACT_APP_BACKEND_URL` in `react-glass/.env.local`
2. Check backend is running: `lsof -i :5000`
3. Try to ping backend from your browser's location:
   ```bash
   curl http://YOUR_BACKEND_IP:5000/health
   # Should return: {"ok":true}
   ```
4. If behind a firewall, ensure port 5000 is open

### Issue 2: Backend connects but no frames appear

**Cause**: Raspberry Pi not sending frames or connection issues

**Check**:
1. Is Raspberry Pi running `glass_detection.py`?
2. Check Raspberry Pi logs for error:
   ```bash
   # SSH into Raspberry Pi
   tail -20 glass_detection.py output
   ```
3. Verify `BACKEND_URL` on Raspberry Pi points to correct backend IP
4. Test from Raspberry Pi:
   ```bash
   curl http://YOUR_BACKEND_IP:5000/health
   ```

### Issue 3: Frames come through but stop appearing

**Cause**: Socket.IO connection dropped or buffer full

**Fix**:
1. Check backend max buffer size in `server.js`:
   ```javascript
   // Should be at least 10MB
   maxHttpBufferSize: 10 * 1024 * 1024,
   ```
2. Reduce frame size on Raspberry Pi (edit `glass_detection.py`):
   ```python
   config = picam2.create_preview_configuration(
       main={"size": (480, 360), "format": "RGB888"}  # Reduce from 640x480
   )
   ```

### Issue 4: Website shows "LIVE" but image doesn't update

**Cause**: Frames are arriving but React isn't displaying them

**Fix**:
1. Check Dashboard.js `stream:frame` listener exists
2. Verify setFrameSrc state is being called
3. Check img src in JSX is using frameSrc correctly
4. Look for console errors in DevTools

## Detailed Debugging: Enable Verbose Logging

### Backend Logging

Edit `backend/device-handler.js` and add logging:

```javascript
const onFrame = (payload = {}) => {
  try {
    const { image, mime = 'image/jpeg', time, defects } = payload;
    console.log('🔵 [device:frame] received from', payload.deviceId);
    console.log('   - image size:', image?.length || 0, 'bytes');
    console.log('   - defects:', Array.isArray(defects) ? defects.length : 0);
    // ... rest of function
    console.log('🟢 [stream:frame] broadcasting to dashboards');
  } catch (e) {
    console.error('❌ Frame processing error:', e);
  }
};
```

### Frontend Logging

Edit `react-glass/src/pages/Dashboard.js` and add logging in the Socket.IO setup:

```javascript
socket.on('stream:frame', (payload) => {
  console.log('🎬 Received stream frame:', {
    deviceId: payload.deviceId,
    time: payload.time,
    dataUrlLength: payload.dataUrl?.length || 0
  });
  if (payload?.dataUrl) {
    setFrameSrc(payload.dataUrl);
  }
});
```

## Testing Checklist

- [ ] Backend server is running on correct port
- [ ] Frontend has correct `REACT_APP_BACKEND_URL` set
- [ ] Raspberry Pi has correct `BACKEND_URL` set
- [ ] Can ping backend from both frontend and Raspberry Pi
- [ ] glass_detection.py shows "Connected to backend"
- [ ] Browser console shows no Socket.IO errors
- [ ] Backend logs show frames being received
- [ ] Frontend receives `stream:frame` events
- [ ] Image updates in browser (check `frameSrc` state)

## If All Else Fails

The system is designed to work without live camera streaming! The Supabase polling approach is the primary method:

1. **Defects detection still works** via Supabase database polling
2. **Modal image loading still works** from Storage bucket URLs
3. **Status updates still work** 
4. **Live camera is bonus feature** - nice to have but not critical

The camera streaming is optional and can be debugged separately without blocking other functionality.

## Getting Help

If you get stuck, run this diagnostic:

```bash
# Backend diagnostics
cd backend
echo "=== Backend Status ===" 
lsof -i :5000 | head -1 && echo "✅ Running on port 5000" || echo "❌ Not running"
echo ""
echo "=== Environment ===" 
cat .env | head -3
echo ""
echo "=== Test connection ===" 
curl http://localhost:5000/health 2>/dev/null && echo "✅ Responds" || echo "❌ No response"
```

Then share:
1. Backend logs (with `DEBUG_FRAMES=1` enabled)
2. Browser DevTools Console output
3. Raspberry Pi console output from glass_detection.py
4. Output of diagnostic script above
