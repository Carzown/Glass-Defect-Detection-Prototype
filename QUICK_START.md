# Quick Setup & Verification Guide

## ✅ Fixes Applied

### Files Changed:
1. **Backend/server.js** - Added WebRTC signaling endpoints
2. **Backend/scripts/check-supabase-auth.js** - Fixed environment variable loading
3. **Dockerfile** - Fixed paths and port configuration
4. **Backend/package.json** - Added convenient npm scripts
5. **Backend/start-all.js** - New service orchestrator (created)

### Files Added:
- **DIAGNOSTICS_REPORT.md** - Detailed diagnostic findings
- **RAILWAY_DEPLOYMENT.md** - Railway deployment guide
- **FIXES_SUMMARY.md** - Complete fix documentation
- **Backend/start-all.js** - Start both services script

---

## 🚀 What To Do Next

### Step 1: Verify Supabase Configuration ✅ (ALREADY PASSING)
```bash
cd Backend
npm run check:supabase
```
**Result:** All tests passing ✅

### Step 2: Deploy to Railway
```bash
# Push changes to GitHub
git add -A
git commit -m "Fix: Add WebRTC endpoints, fix environment config, update deployment"
git push origin main
```

Railway will automatically detect changes and redeploy.

### Step 3: Set Environment Variables in Railway
Go to [Railway Dashboard](https://railway.app/dashboard):
1. Select your project
2. Go to Variables
3. Add/Update:
   ```
   SUPABASE_URL=https://kfeztemgrbkfwaicvgnk.supabase.co
   SUPABASE_KEY=<your-service-role-key>
   PORT=3000
   NODE_ENV=production
   ```

### Step 4: Verify Deployment (After ~5 minutes)
```bash
# Test API
curl https://glass-defect-detection-prototype-production.up.railway.app/

# Test Health
curl https://glass-defect-detection-prototype-production.up.railway.app/health

# Test WebRTC endpoints
curl https://glass-defect-detection-prototype-production.up.railway.app/webrtc/devices

# Test Defects API
curl https://glass-defect-detection-prototype-production.up.railway.app/defects
```

---

## 📊 Summary of Fixes

| Issue | Status | Details |
|-------|--------|---------|
| Missing WebRTC endpoints | ✅ FIXED | Added `/webrtc/*` endpoints to server.js |
| Supabase config not loading | ✅ FIXED | check-supabase-auth.js now reads correct .env file |
| Dockerfile path issues | ✅ FIXED | Changed `backend` → `Backend` (correct case) |
| Port misconfiguration | ✅ FIXED | Now exposes 3000 and 8080 correctly |
| No health checks | ✅ FIXED | Added health check endpoint to Dockerfile |

---

## 🧪 Testing Locally (Optional)

### Test 1: Supabase Connection
```bash
cd Backend
npm install         # Install dependencies if needed
npm run check:supabase
```
✅ **Expected result:** All green check marks

### Test 2: Start Backend Server
```bash
cd Backend
npm start
# Server starts on http://localhost:3000
```

In another terminal:
```bash
curl http://localhost:3000/health
curl http://localhost:3000/webrtc/devices
```

### Test 3: Start Both Services (Advanced)
```bash
cd Backend
npm run start:all
# Starts both Express and WebSocket server
```

---

## 📱 How Devices Connect Now

### Qt App (Raspberry Pi) → Backend
1. **Register Device:**
   ```
   POST /webrtc/register/device-001
   ```

2. **Send Detections:**
   ```
   POST /defects
   Body: { device_id: "device-001", ... }
   ```

3. **Check Status:**
   ```
   GET /webrtc/status/device-001
   ```

### Web Dashboard → Backend
1. **Get Device List:**
   ```
   GET /webrtc/devices
   ```

2. **Fetch Defects:**
   ```
   GET /defects?deviceId=device-001
   ```

3. **Monitor Health:**
   ```
   GET /health/detailed
   ```

---

## ⚠️ Important Notes

- **Supabase Key:** Make sure you use the **Service Role** key, NOT the anon key
- **Port 3000:** This is the main API port (configurable via PORT env var)
- **Port 8080:** Reserved for WebSocket server (optional, for streaming)
- **HTTPS:** Always use HTTPS for production (Railway provides this)
- **CORS:** Configured to allow requests from localhost and FRONTEND_URL

---

## 🔍 Troubleshooting

### If `/webrtc/devices` returns 404:
- Deployment hasn't completed yet (Railway can take 2-5 minutes)
- Check Railway logs to see if build succeeded

### If `/defects` returns error:
- Verify `SUPABASE_URL` and `SUPABASE_KEY` are set in Railway
- Check the `/test/supabase` endpoint for diagnosis

### If `check:supabase` fails:
- Make sure `Frontend/.env` exists and has values
- Check that env variables are not placeholder values

---

## 📚 Documentation

For more details, see:
- **[FIXES_SUMMARY.md](FIXES_SUMMARY.md)** - Complete list of changes
- **[DIAGNOSTICS_REPORT.md](DIAGNOSTICS_REPORT.md)** - Initial diagnostics
- **[RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md)** - Railway deployment details

---

## ✨ Everything is Ready!

The backend is now properly configured with:
- ✅ WebRTC signaling endpoints
- ✅ Supabase integration
- ✅ Proper Docker setup
- ✅ Health monitoring
- ✅ Device management endpoints

**Next step:** Push to GitHub and let Railway handle the deployment! 🚀
