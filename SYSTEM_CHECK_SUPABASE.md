# ✅ Quick System Check - Supabase Integration

**Before you run anything, verify these connections:**

---

## 1️⃣ Environment Files Created ✅

```bash
# Check these files exist:
ls -la react-glass/.env          # React dashboard env
ls -la .env                       # Root env config
```

**Files should contain:**
- `SUPABASE_URL` = https://kfeztemgrbkfwaicvgnk.supabase.co
- `SUPABASE_KEY` = (the long JWT token)
- `BACKEND_URL` = http://localhost:5000 (NOT 3000!)
- `REACT_APP_BACKEND_URL` = http://localhost:5000 (in react-glass/.env)

---

## 2️⃣ Supabase Project Setup ✅

### Check Database Table
```bash
# Go to: https://app.supabase.com/project/[your-project]/editor/tables
# Look for table: "defects"
# Verify it has these columns:
```

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| device_id | text | "raspberry-pi-1" |
| defect_type | text | "crack", "chip", etc |
| detected_at | timestamp | When detected |
| image_url | text | URL from storage |
| image_path | text | Path in bucket |
| status | text | "pending", "reviewed", "resolved" |
| notes | text | Confidence, metadata |
| created_at | timestamp | Auto |
| updated_at | timestamp | Auto |

### Check Storage Bucket
```bash
# Go to: https://app.supabase.com/project/[your-project]/storage/buckets
# Look for bucket: "defect-images"
# Make sure it's "PUBLIC" (not private!)
```

**Bucket structure should look like:**
```
defect-images/
├─ defects/
│  ├─ crack/
│  │  ├─ 20240115_120000_fake.jpg
│  │  └─ 20240115_120030_fake.jpg
│  ├─ chip/
│  │  └─ 20240115_120100_fake.jpg
│  └─ scratch/
│     └─ 20240115_120200_fake.jpg
└─ test/
   └─ test-image.jpg
```

---

## 3️⃣ Supabase Credentials ✅

### Check Connection String
```bash
# From your Supabase project, verify URL matches:
https://kfeztemgrbkfwaicvgnk.supabase.co

# Check API Key (anon) is in:
.env               → SUPABASE_KEY
react-glass/.env   → REACT_APP_SUPABASE_ANON_KEY
glass_detection_webrtc.py (hardcoded fallback)
```

---

## 4️⃣ Test Supabase Connection

### From Raspberry Pi (if available)
```bash
python3 << 'EOF'
from supabase import create_client

url = "https://kfeztemgrbkfwaicvgnk.supabase.co"
key = "eyJhbGciOiJIUzI1NiI..."  # Your key here

try:
    client = create_client(url, key)
    # Try to connect
    response = client.table('defects').select('count', { count: 'exact' }).execute()
    print(f"✅ CONNECTED! Table has {response.count} records")
except Exception as e:
    print(f"❌ ERROR: {e}")
    print("Check your URL and KEY in .env files")
EOF
```

### From React Dashboard
```javascript
// Open browser console (F12) and run:
import { supabase } from './supabase';

supabase.from('defects')
  .select('count', { count: 'exact' })
  .then(res => console.log('✅ Connected! Records:', res.count))
  .catch(err => console.error('❌ Error:', err.message))
```

---

## 5️⃣ Test Image Upload (Optional)

```bash
python3 glass_detection_webrtc.py
# Watch the console for:
# "✅ Image uploaded to: defect-images/defects/..."
```

---

## 🚀 Startup Sequence

### Terminal 1: Backend Server (should show port 5000)
```bash
cd backend
npm start
# Expected: ✅ Listening on port 5000
```

### Terminal 2: React Dashboard (should show port 3000)
```bash
cd react-glass
npm start
# Expected: Compiled successfully!
# Opens: http://localhost:3000/dashboard
```

### Terminal 3: Raspberry Pi (when ready)
```bash
python3 glass_detection_webrtc.py
# Expected: ✨ WebRTC CONNECTED!
#           🎬 Dashboard: http://192.168.X.X:3000/dashboard
```

---

## ✅ Verify Complete Flow

Once all three are running:

### On Dashboard Browser
- **Video section**: Should show loading spinner → video appears → "🔴 LIVE" indicator
- **Defects list**: Should update every 3 seconds
- **Images**: Should load from Supabase storage (not 404 errors)

### On Raspberry Pi Console
```
✅ Supabase initialization
🌐 WebRTC: Connecting...
✨ WebRTC CONNECTED!
🎬 Dashboard link: http://192.168.1.100:3000/dashboard
🔍 Frame 1: No defects
🔍 Frame 2: Crack detected (92%)
✅ Image uploaded: defect-images/defects/crack/20240115_xxx.jpg
📊 Record saved to database ID: [uuid]
🔍 Frame 3: No defects
```

### Browser Console (F12)
No red errors, clean log output

---

## 🔴 Troubleshooting

### If Images Don't Appear (404 errors)
```bash
# Check bucket is PUBLIC:
# Supabase Dashboard → Storage → defect-images → Settings
# Verify: "Public bucket" toggle is ON
```

### If Supabase Connection Fails
```bash
# 1. Check internet connection on Raspberry Pi/computer
# 2. Verify Supabase project is ACTIVE (not paused)
# 3. Confirm API KEY is correct in all .env files
# 4. Check Firewall isn't blocking connections
```

### If Dashboard Shows "Error loading stream"
```bash
# 1. Check Backend is running on port 5000
# 2. Verify Raspberry Pi can reach backend (same network)
# 3. Check Browser Console for specific error message
# 4. Ensure WebRTC signaling successful (check backend logs)
```

### If Defects Don't Appear in List
```bash
# 1. Check detecting something on Pi (console shows detections)
# 2. Verify defects table exists in Supabase
# 3. Check Supabase filters are correct in Dashboard code
# 4. Try manual query in Supabase SQL editor:
#    SELECT * FROM defects ORDER BY created_at DESC LIMIT 10;
```

---

## 📊 System Status Matrix

| Component | Status Check | Expected Output |
|-----------|--------------|-----------------|
| **Backend** | `curl http://localhost:5000/health` | `{"status":"ok"}` |
| **Dashboard** | `http://localhost:3000/dashboard` | Page loads, no errors |
| **Supabase DB** | Check defects table | Table visible in dashboard |
| **Supabase Storage** | Check defect-images bucket | Bucket visible, is PUBLIC |
| **Pi → Supabase** | Run detection script | Sees `✅ Image uploaded` |
| **Dashboard → Supabase** | Check defects list | Updates every 3 seconds |
| **WebRTC Video** | Check video element | Video plays with 🔴 LIVE |

---

## 🎯 Summary

When everything is working:

1. **Pi captures frame** → Runs YOLO → Detects defect
2. **Pi uploads to Supabase** → Image to Storage, metadata to Database
3. **Dashboard polls Supabase** → Fetches defects every 3 seconds
4. **Dashboard displays stream** → Shows live video via WebRTC + defects list

**If you see:**
- ✅ Live video on dashboard
- ✅ Defects appearing in list
- ✅ Images loading from links

**Then Supabase integration is COMPLETE! 🎉**
