# Railway Deployment Configuration

After deploying to Railway, configure these environment variables in the Railway dashboard:

## Backend Environment Variables (Required)

### Supabase Configuration
```
SUPABASE_URL=https://kfeztemgrbkfwaicvgnk.supabase.co
SUPABASE_KEY=<your-service-role-key>
```

**How to get SUPABASE_KEY:**
1. Go to Supabase Dashboard → Project Settings
2. Click "API" in the left sidebar
3. Copy the **Service Role** secret (NOT the anon key)
4. Paste in Railway environment variables

### Optional Configuration
```
PORT=3000                           # Main API server port (default: 3000)
WS_PORT=8080                        # WebSocket server port (default: 8080)
NODE_ENV=production                 # Environment (development/production)
FRONTEND_URL=https://your-domain    # For CORS if frontend is separate
```

## Backend Service Architecture

The backend now supports TWO deployment modes:

### Mode 1: Express API Only (Current)
```bash
npm start
```
- Starts Express API server on PORT (default 3000)
- Includes WebRTC signaling endpoints
- Good for: REST API + WebRTC signaling

### Mode 2: Both Express + WebSocket
```bash
npm run start:all
```
- Starts Express API + WebSocket server
- API on PORT, WebSocket on WS_PORT
- Good for: Full two-way streaming

## What was Fixed

### ✅ 1. Added WebRTC Signaling Endpoints (server.js)
New endpoints for device status management:
- `GET /webrtc/status/:deviceId` - Check device connection status
- `POST /webrtc/register/:deviceId` - Register a device
- `POST /webrtc/unregister/:deviceId` - Unregister a device
- `GET /webrtc/devices` - List all connected devices

### ✅ 2. Fixed Environment Configuration (check-supabase-auth.js)
- Now checks both `.env` and `.env.local` files
- Properly loads Frontend environment variables

### ✅ 3. Updated Dockerfile
- Fixed path case sensitivity (`backend` → `Backend`)
- Properly exposes both API (3000) and WebSocket (8080) ports
- Added health check endpoint
- Updated to use PORT environment variable correctly

### ✅ 4. Added Service Start Scripts
- `Backend/start-all.js` - Runs both Express and WebSocket servers
- `npm run start:all` - Easy way to start both services

### ✅ 5. Added NPM Scripts for Easy Management
```bash
npm run start:all      # Start API + WebSocket
npm run dev:all        # Development mode (with auto-reload)
npm run check:backend  # Test backend connectivity
npm run check:supabase # Test Supabase connection
npm run check:all      # Run all checks
```

## Railway Deployment Checklist

- [ ] Run `npm install` in Backend directory
- [ ] Set `SUPABASE_URL` environment variable in Railway
- [ ] Set `SUPABASE_KEY` environment variable in Railway
- [ ] Set `PORT=3000` (or desired port) in Railway
- [ ] Deploy to Railway
- [ ] Test endpoints:
  ```bash
  curl https://glass-defect-detection-prototype-production.up.railway.app/
  curl https://glass-defect-detection-prototype-production.up.railway.app/health
  curl https://glass-defect-detection-prototype-production.up.railway.app/webrtc/devices
  ```

## Verification After Deployment

### Run local checks against Railway:
```bash
python Backend/scripts/check_backend.py --url https://glass-defect-detection-prototype-production.up.railway.app
```

### Run Supabase diagnostics:
```bash
node Backend/scripts/check-supabase-auth.js
```

## Troubleshooting

### If endpoints return 404:
- Verify the Dockerfile uses correct paths (`Backend/` not `backend/`)
- Check that `npm start` is being run (launches server.js)

### If defects API fails:
- Check Supabase environment variables are set in Railway
- Verify `SUPABASE_URL` and `SUPABASE_KEY` have values
- Run `/test/supabase` endpoint to diagnose

### If WebSocket connection fails (port 8080):
- Option 1: Use API mode only (simpler, currently recommended)
- Option 2: Use Railway static build and expose port 8080
- Option 3: Configure Railway to support two ports/services

## Current Recommended Setup

1. **Express API only** (simplest, currently deployed)
   - Single service running on 1 port
   - All WebRTC signaling via HTTP
   - WebSocket relay available separately

2. **For Production:**
   - Set SUPABASE credentials in Railway
   - Use `npm start` to launch
   - Monitor `/health` endpoint
   - Test `/webrtc/devices` for device tracking
