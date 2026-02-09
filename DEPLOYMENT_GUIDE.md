# Deployment Guide - Glass Defect Detection System

## Environment Setup

### Backend (.env)
Located: `/backend/.env`

```
PORT=5000
SUPABASE_URL=https://kfeztemgrbkfwaicvgnk.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
ADMIN_TOKEN=your_admin_token_here
DEBUG_FRAMES=0
NODE_ENV=production
```

### Frontend (.env)
Located: `/react-glass/.env`

```
REACT_APP_BACKEND_URL=http://localhost:5000
REACT_APP_SUPABASE_URL=https://kfeztemgrbkfwaicvgnk.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Development Setup

### 1. Backend
```bash
cd backend
npm install
npm start
```
Backend runs on: `http://localhost:5000`

### 2. Frontend
```bash
cd react-glass
npm install
npm start
```
Frontend runs on: `http://localhost:3000`

### 3. Raspberry Pi
```bash
export BACKEND_URL=http://YOUR_MACHINE_IP:5000
python3 glass_detection_db.py
```

---

## Production Deployment

### Option 1: Deploy Backend to Cloud (Recommended)

#### Using Heroku:
1. Create Heroku app: `heroku create your-app-name`
2. Set environment variables: `heroku config:set PORT=5000`
3. Deploy: `git push heroku main`
4. Get URL: `https://your-app-name.herokuapp.com`

#### Using Railway:
1. Connect GitHub repo
2. Set environment variables in Railway dashboard
3. Deploy automatically on push
4. Get URL: `https://your-project-*.railway.app`

#### Using DigitalOcean:
1. Create App Platform app
2. Connect GitHub repo
3. Set environment variables
4. Deploy

### Option 2: Deploy Frontend to GitHub Pages/Vercel

#### GitHub Pages:
1. Build: `npm run build`
2. Push to GitHub
3. Enable GitHub Pages in settings
4. Update `REACT_APP_BACKEND_URL` in `.env` to your backend URL

#### Vercel:
1. Connect GitHub repo to Vercel
2. Set environment variables in Vercel dashboard
3. Auto-deploys on push

---

## Environment Variables Summary

### Backend Required:
- `PORT` - Server port (default: 5000)
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_KEY` - Supabase anon key
- `ADMIN_TOKEN` - Admin API token
- `NODE_ENV` - development/production

### Frontend Required:
- `REACT_APP_BACKEND_URL` - Backend server URL
- `REACT_APP_SUPABASE_URL` - Supabase URL
- `REACT_APP_SUPABASE_ANON_KEY` - Supabase key

### Raspberry Pi Required:
- `BACKEND_URL` - Backend server URL
- Model path: `/home/raspi5/glass_segmentation/models/yolov11n_10-6-25.pt`

---

## Example Deployment URLs

**Local Development:**
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`
- Raspberry Pi: `export BACKEND_URL=http://192.168.1.39:5000`

**Production Example:**
- Frontend: `https://glass-detector.vercel.app`
- Backend: `https://glass-detector-api.railway.app`
- Raspberry Pi: `export BACKEND_URL=https://glass-detector-api.railway.app`

---

## Testing Connection

1. **Backend Health Check:**
```bash
curl http://localhost:5000/health
# Response: {"ok":true}
```

2. **Frontend to Backend:**
- Open browser dev tools
- Check Network tab when loading dashboard
- Should see Socket.IO connection established

3. **Raspberry Pi to Backend:**
```bash
export BACKEND_URL=http://your-backend:5000
python3 glass_detection_db.py
# Should see: ✅ Connected to backend at http://your-backend:5000
```

---

## Troubleshooting

### "Cannot connect to backend"
1. Check backend is running: `curl http://backend-url:5000/health`
2. Check CORS settings in backend
3. Check firewall/network access
4. Verify `REACT_APP_BACKEND_URL` is correct

### Socket.IO Connection Failed
1. Check WebSocket support is enabled
2. Check backend transports: `transports: ['websocket']`
3. Check backend listening on correct port

### Supabase Connection Issues
1. Verify URL and KEY are correct
2. Check network access to Supabase
3. Check bucket exists: `defect-images`

