# Glass Defect Detection System - Master Setup Guide

## 📋 What This System Does

```
Raspberry Pi (with camera)
    ↓ Detects glass defects with YOLOv11
    ↓ Uploads image to cloud storage
    ↓ Saves defect details to database
    
Supabase (Cloud Database + Storage)
    ↓ Stores defect records
    ↓ Hosts defect images
    
Website (React)
    ↓ Polls database every 3 seconds
    ↓ Shows live list of defects
    ↓ Click to view full defect details in modal
    ↓ Can update status (pending → reviewed → resolved)
```

## 🚀 Quick Start (5 Steps)

### Step 1: Run SQL Setup (5 minutes)
```bash
# In Supabase Dashboard > SQL Editor:
# 1. Click "New Query"
# 2. Copy entire contents of DATABASE_SETUP.sql
# 3. Paste into editor
# 4. Click "Run"
# ✅ You should see: "No errors" at bottom

# Verify with:
SELECT COUNT(*) FROM public.defects;
```

### Step 2: Create Storage Bucket (3 minutes)
```
1. Supabase Dashboard > Storage > Buckets
2. Click "Create Bucket"
3. Name: defect-images
4. Make it PUBLIC (toggle ON)
5. Click "Create Bucket"
```

### Step 3: Add Storage Policies (3 minutes)
```
1. Storage > defect-images > Policies
2. Click "New Policy"
3. Select "For Authenticated Users" template
4. Operation: INSERT
5. Click "Save"

6. Click "New Policy" again
7. Select "For Public Access" template
8. Operation: SELECT
9. Click "Save"

✅ Now you should see 2 policies listed
```

### Step 4: Set Environment Variables (2 minutes)

**Get credentials from Supabase Dashboard > Settings > API:**
- Project URL → SUPABASE_URL
- Anon (public) key → SUPABASE_KEY

**On Raspberry Pi (.env):**
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=eyJ0eXAi...
BACKEND_URL=http://your-backend-ip:5000
```

**On Backend (backend/.env):**
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=eyJ0eXAi...
PORT=5000
```

**On Website (react-glass/.env.local):**
```
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJ0eXAi...
REACT_APP_BACKEND_URL=http://your-backend-ip:3000
```

### Step 5: Start All Three Components (5 minutes)

**Terminal 1 - Backend Server:**
```bash
cd backend
npm start
# Should show: ✅ Server running on port 5000
```

**Terminal 2 - Raspberry Pi Detection:**
```bash
python glass_detection.py
# Should show: ✅ Supabase initialized
#             ✅ Connected to backend
#             YOLOv11 segmentation running...
```

**Terminal 3 - Website:**
```bash
cd react-glass
npm start
# Opens: http://localhost:3000
```

## ✅ Verify It Works

1. **Website Dashboard loads** - You should see:
   - "Live Detection Stream" section (shows "Waiting for Camera Stream")
   - "Detected Defects" section (empty initially)

2. **Trigger a defect** - In Raspberry Pi:
   - Show a crack/chip to the camera
   - Wait for detection (usually 2-5 seconds)
   - Look for: `🔴 DEFECT DETECTED: Crack`

3. **Check logs** - Raspberry Pi should show:
   ```
   ✅ Image uploaded: defects/Crack/20260208_143045_123456.jpg
   ✅ Defect saved to database: Crack at 2026-02-08 14:30:45
   ```

4. **Website shows defect** - Within 3 seconds:
   - Check "Detected Defects" list
   - Should see: `[14:30:45] Crack - pending`

5. **Click defect → Modal shows**:
   - Full image from storage bucket
   - Defect timestamp
   - Device ID: raspberry-pi-1
   - Status: pending (orange badge)
   - Confidence percentage
   - Can click "Mark Reviewed" to update status

6. **Status updates** - Click "Mark Reviewed":
   - Status changes to blue
   - Database is updated
   - Website reflects change immediately

## 📚 Documentation Files

| File | Purpose | When to Use |
|------|---------|------------|
| **DATABASE_SETUP.sql** | SQL script to create database | Run once in Supabase SQL Editor |
| **DATABASE_SETUP_GUIDE.md** | Step-by-step database setup | First-time setup instructions |
| **STORAGE_POLICIES_GUIDE.md** | How to create storage policies | Questions about storage access |
| **COMPLETE_SETUP_GUIDE.md** | Complete technical reference | Understanding the full architecture |
| **INTEGRATION_GUIDE.md** | Simple technical overview | Quick reference during development |
| **TROUBLESHOOTING.md** | Problem solving guide | Something not working |
| **test_complete_setup.py** | Verify all components | Check before running detection |

## 🔍 How Data Actually Flows

### When Defect is Detected (Raspberry Pi):
```
1. YOLOv11 detects "Crack" at 14:30:45.123456
2. Capture timestamp: datetime.now() → timestamp
3. Upload image to Supabase Storage
   - Path: defects/Crack/20260208_143045_123456.jpg
   - Returns: public_url (https://...)
4. Save to database with SAME timestamp:
   {
     device_id: "raspberry-pi-1",
     defect_type: "Crack",
     detected_at: "2026-02-08T14:30:45.123456+00:00",  ← Same time
     image_url: "https://...../defects/Crack/...",
     status: "pending",
     notes: "Confidence: 85%"
   }
5. Done. Image and metadata both saved.
```

### When Website Fetches (Every 3 Seconds):
```
1. JavaScript timer: setInterval(() => loadSupabaseDefects(), 3000)
2. Query: SELECT * FROM defects ORDER BY detected_at DESC
3. Get back the record created above
4. Convert to display format:
   - time: "14:30:45"
   - type: "Crack"
   - imageUrl: "https://...../defects/Crack/..."
   - detected_at: "2026-02-08T14:30:45.123456+00:00"
5. Show in list
6. User clicks → Modal opens
7. Modal displays full image from image_url
8. Modal shows all metadata
9. User clicks "Mark Reviewed" → PATCH to database
10. Status updated to "reviewed"
11. Next poll (3 seconds) → sees updated status
12. List updates with blue badge
```

## 🛠️ Technology Stack

- **Raspberry Pi**: Python with OpenCV, YOLOv11, Picamera2
- **Database**: Supabase PostgreSQL
- **Storage**: Supabase Storage (S3-compatible)
- **Backend**: Node.js/Express with Socket.IO (optional live streaming)
- **Website**: React with Socket.IO client
- **APIs**: RESTful (for status updates), Real-time subscriptions (automatic)

## 📊 Database Schema

### defects Table
```
id          UUID              Primary key
device_id   TEXT              "raspberry-pi-1"
defect_type TEXT              "Crack", "Chip", etc.
detected_at TIMESTAMP WITH TZ  When defect occurred
image_url   TEXT              Public URL from Storage
image_path  TEXT              Storage bucket path
status      TEXT              "pending", "reviewed", "resolved"
notes       TEXT              "Confidence: 85%"
created_at  TIMESTAMP WITH TZ  Auto (record creation)
updated_at  TIMESTAMP WITH TZ  Auto (updated on change)
```

### Storage Bucket
```
defect-images/
├── defects/
│   ├── Crack/
│   │   ├── 20260208_143045_123456.jpg
│   │   └── 20260208_143102_234567.jpg
│   ├── Chip/
│   │   └── 20260208_143130_345678.jpg
```

## 🔐 Security

- ✅ RLS Policies: Only authenticated users can read/write
- ✅ Storage Policies: Authenticated users upload, public can view
- ✅ API Key: Anon key used (safe - no sensitive data)
- ✅ Images: Public URLs (assume defect images are not sensitive)

For production:
- Use private storage if defect images are sensitive
- Add authentication to backend
- Use HTTPS/WSS for all connections
- Use environment secrets for all credentials

## 🐛 Testing

Run comprehensive setup test:
```bash
python test_complete_setup.py
```

This verifies:
- ✅ Environment variables set
- ✅ Supabase database connected
- ✅ Storage bucket accessible
- ✅ Required Python packages installed
- ✅ Backend server reachable
- ✅ All configuration files present

## ⚡ Performance

- **Detection**: ~1-2 seconds per frame (YOLOv11 on CPU)
- **Upload**: <1 second per image (Supabase Storage)
- **Database Save**: <100ms (Supabase PostgreSQL)
- **Website Poll**: 3-second interval for updates
- **Live Stream**: <100ms latency (Socket.IO)

For 10+ defects per second, consider:
- Batching database inserts
- Reducing polling interval
- Adding image compression

## 📞 Support

### If Something Doesn't Work
1. Check **TROUBLESHOOTING.md** (most issues covered)
2. Run **test_complete_setup.py** for diagnosis
3. Check browser console: Press F12
4. Check Supabase logs: Dashboard > Logs
5. Check terminal output for error messages

### Common Issues
- **"Table does not exist"** → Run DATABASE_SETUP.sql again
- **"Permission denied"** → Check RLS policies and storage policies
- **"Cannot connect to backend"** → Is backend running? Check BACKEND_URL
- **"Images not uploading"** → Check bucket is PUBLIC and policies allow INSERT
- **"Website doesn't fetch data"** → Check REACT_APP variables and browser console

## 🎉 Success Indicators

When everything works:
- ✅ Defect appears in website list within 3 seconds of detection
- ✅ Image loads in modal from storage
- ✅ All metadata displays correctly (timestamp, device, confidence)
- ✅ Status update works: click → database updates → website refreshes
- ✅ Live camera feed appears on website (bonus Socket.IO feature)

## 📈 Next Steps

Once working, consider:
1. **Train custom YOLO model** for better detection accuracy
2. **Add device selector** to website (if multiple Raspberry Pis)
3. **Archive old defects** to keep database fast
4. **Add notifications** (email/SMS when defects detected)
5. **Export reports** (CSV with statistics)
6. **Add comments** to defects (for team notes)
7. **Multi-language support** on website
8. **Mobile app** using React Native

---

**Questions?** Check the documentation files or TROUBLESHOOTING.md

**Ready to start?** Go to Step 1 above! 🚀
