# Complete Glass Defect Detection System - Setup & Verification

## System Architecture Overview

```
RASPBERRY PI (glass_detection.py)
├── Detects defect with YOLOv11
├── Captures timestamp: datetime.now()
├── Uploads image to: Supabase Storage (defect-images bucket)
│   └── Path: defects/{defect_type}/{timestamp}.jpg
│   └── Returns: public_url
└── Saves to database: Supabase defects table
    ├── device_id: "raspberry-pi-1"
    ├── defect_type: "Crack" (from YOLOv11)
    ├── detected_at: timestamp (ISO format)
    ├── image_url: public URL from storage
    ├── image_path: storage path
    ├── status: "pending" (default)
    └── notes: "Confidence: 85%" (optional)
    
         ↓ (Supabase publishes)
         
WEBSITE (React Dashboard.js)
├── Polls Supabase every 3 seconds
├── Fetches: SELECT * FROM defects ORDER BY detected_at DESC
├── Displays in list: [timestamp, type, status]
└── Click defect → Opens modal
    ├── Shows full image from image_url
    ├── Shows all metadata
    ├── Can update status → PATCH to database
    └── Changes reflected immediately on website

LIVE CAMERA STREAM (Socket.IO - Bonus Feature)
└── Raspberry Pi streams frame via Socket.IO
    └── Backend relays to website
    └── Website displays "LIVE" preview
```

## Phase 1: Database Setup ✅

Run this in Supabase SQL Editor (copy-paste the DATABASE_SETUP.sql script):

1. Go to **SQL Editor** in Supabase dashboard
2. Click **New Query**
3. Copy all contents from `DATABASE_SETUP.sql`
4. Paste into editor
5. Click **Run**

**Verify Success:**
```sql
-- Run these queries in SQL Editor to verify
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- Should show: defects

SELECT * FROM public.defects LIMIT 1;
-- Should return empty result (no data yet)

SELECT indexname FROM pg_indexes WHERE tablename = 'defects';
-- Should show: idx_defects_detected_at, idx_defects_device_id, etc.
```

## Phase 2: Storage Bucket Setup ✅

1. Go to **Storage > Buckets** in Supabase dashboard
2. Click **Create Bucket**
3. Name: `defect-images`
4. Make it **Public** (toggle ON)
5. File size limit: 50MB
6. Click **Create Bucket**

## Phase 3: Storage Policies ✅

Go to **Storage > defect-images > Policies**

1. Click **New Policy**
2. Select template: **For Authenticated Users**
3. Operation: **INSERT**
4. Click **Save**

5. Click **New Policy** again
6. Select template: **For Public Access**
7. Operation: **SELECT**
8. Click **Save**

**Verify**: Two policies should appear in the list

## Phase 4: Environment Variables ✅

### On Raspberry Pi (.env)
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=eyJ0eXAiOiJKV1QiLCJhbGc...
BACKEND_URL=http://your-backend-ip:5000
```

Get these from Supabase Dashboard > Settings > API

### On Backend Server (backend/.env)
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=eyJ0eXAiOiJKV1QiLCJhbGc...
PORT=5000
```

### On Website (react-glass/.env.local)
```
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGc...
REACT_APP_BACKEND_URL=http://your-backend-ip:5000
```

## Phase 5: Code Verification ✅

### glass_detection.py FLOW:
```python
# 1. Detect defect
defect_detected = True

# 2. Capture timestamp (same for both image and database)
timestamp = datetime.now()  # ← SAME TIMESTAMP

# 3. Upload image to storage
image_url, image_path = upload_image_to_supabase(
    frame, 
    defect_type,    # e.g., "Crack"
    timestamp       # ← SAME TIMESTAMP
)
# Returns: 
#   image_url = "https://...../defects/Crack/20260208_143045_123456.jpg"
#   image_path = "defects/Crack/20260208_143045_123456.jpg"

# 4. Save to database (ALWAYS happens, even if image upload fails)
save_defect_to_supabase(
    defect_type,      # "Crack"
    timestamp,        # ← SAME TIMESTAMP
    image_url,        # public URL from storage
    image_path,       # storage path
    confidence=0.85,
    device_id="raspberry-pi-1"
)
# Saves to defects table:
# {
#   device_id: "raspberry-pi-1",
#   defect_type: "Crack",
#   detected_at: "2026-02-08T14:30:45.123456+00:00",
#   image_url: "https://....",
#   image_path: "defects/Crack/...",
#   status: "pending",
#   notes: "Confidence: 85.00%"
# }

# 5. Stream frame to website (live preview)
emit_camera_frame_to_dashboard(
    annotated_frame,
    timestamp,
    device_id="raspberry-pi-1",
    defects=[...]
)
```

### Dashboard.js FLOW:
```javascript
// Every 3 seconds:
useEffect(() => {
  loadSupabaseDefects();
  const pollInterval = setInterval(() => {
    loadSupabaseDefects();  // ← Polls every 3 seconds
  }, 3000);
}, []);

// loadSupabaseDefects() does:
const result = await fetchDefects({ 
  limit: 100,   // Fetch up to 100 defects
  offset: 0 
});

// Converts to display format and shows in list:
displayDefects = result.data.map(d => ({
  id: d.id,
  time: formatTime(new Date(d.detected_at)),
  type: d.defect_type,
  imageUrl: d.image_url,           // ← Public URL from storage
  status: d.status,
  detected_at: d.detected_at,      // ← Same timestamp from database
  device_id: d.device_id,          // ← "raspberry-pi-1"
  image_path: d.image_path,
  notes: d.notes,                  // ← "Confidence: 85%"
}));

// When clicking defect → Opens modal with:
// - Full image from d.image_url
// - Detection timestamp
// - Device ID
// - Status badge
// - Confidence notes
// - Can update status
```

### defects.js FUNCTIONS:
```javascript
// Fetch all defects (ordered newest first)
fetchDefects({ limit: 100, offset: 0 })
// Returns: 
// {
//   data: [
//     {
//       id: "uuid",
//       device_id: "raspberry-pi-1",
//       defect_type: "Crack",
//       detected_at: "2026-02-08T14:30:45...",
//       image_url: "https://...",
//       image_path: "defects/Crack/...",
//       status: "pending",
//       notes: "Confidence: 85%"
//     }
//   ],
//   pagination: { total: 5, limit: 100, offset: 0 }
// }

// Update status
updateDefectStatus(id, newStatus, notes)
// Sends PATCH to defects table
// Updates: status, notes, updated_at (automatic)
```

## Phase 6: Test Connectivity

### Test 1: Raspberry Pi → Supabase

Create `test_supabase.py`:
```python
import os
from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Try to list defects
try:
    response = supabase.table("defects").select("*").limit(1).execute()
    print("✅ Database connected")
    print(f"   Rows in defects table: {len(response.data)}")
except Exception as e:
    print(f"❌ Database error: {e}")

# Try to upload a test file to storage
try:
    test_data = b"test image data"
    supabase.storage.from_('defect-images').upload(
        'test.txt',
        test_data
    )
    print("✅ Storage upload works")
    
    # Try to get public URL
    url = supabase.storage.from_('defect-images').get_public_url('test.txt')
    print(f"   Public URL: {url}")
except Exception as e:
    print(f"❌ Storage error: {e}")
```

Run:
```bash
python test_supabase.py
```

### Test 2: Start Backend Server

```bash
cd backend
npm start
# Should show: ✅ Server running on port 5000
```

Test:
```bash
curl http://localhost:3000
# Should return something or 404, not connection refused
```

### Test 3: Start Website

```bash
cd react-glass
npm start
# Should open http://localhost:3000
# Login with credentials
# Go to Dashboard
# Should see "Waiting for Camera Stream" and "No defects" initially
```

### Test 4: Run Raspberry Pi Detection

```bash
python glass_detection.py
```

Watch for these log messages:
```
✅ Supabase initialized
✅ Connected to backend at http://...
YOLOv11 segmentation running.

[When defect is detected]
🔴 DEFECT DETECTED: Crack
   Confidence: 85.00%
   Timestamp: 2026-02-08 14:30:45...
✅ Image uploaded: defects/Crack/20260208_143045_123456.jpg
✅ Defect saved to database: Crack at 2026-02-08 14:30:45
```

### Test 5: Check Website for Live Defect

1. Refresh Dashboard page (or wait 3 seconds)
2. Should see defect appear in "Detected Defects" list with:
   - Time: [HH:MM:SS]
   - Type: Crack
   - Status: pending (orange)
3. Click defect → Modal opens showing:
   - Full image from storage bucket
   - Detection timestamp: 2026-02-08 14:30:45
   - Device: raspberry-pi-1
   - Status: pending
   - Notes: Confidence: 85%
4. Click "Mark Reviewed" → Status changes to blue
5. Reflected in list immediately

## Complete Data Flow Example

**Timestamp: 2026-02-08 14:30:45.123456**

### Raspberry Pi executes:
```python
timestamp = datetime.now()  # 2026-02-08 14:30:45.123456

# Upload image
upload_image_to_supabase(
    frame, 
    "Crack",
    timestamp
)
# Creates file: defects/Crack/20260208_143045_123456.jpg
# Returns URL: https://xxxxx.supabase.co/storage/v1/object/public/defect-images/defects/Crack/20260208_143045_123456.jpg

# Save to database
save_defect_to_supabase(
    "Crack",
    timestamp,
    image_url,
    image_path,
    confidence=0.85,
    device_id="raspberry-pi-1"
)
# Database record created:
# id: abc123def456
# device_id: "raspberry-pi-1"
# defect_type: "Crack"
# detected_at: "2026-02-08T14:30:45.123456+00:00"
# image_url: "https://..../defects/Crack/20260208_143045_123456.jpg"
# image_path: "defects/Crack/20260208_143045_123456.jpg"
# status: "pending"
# notes: "Confidence: 85.00%"
# created_at: "2026-02-08T14:30:46.000000+00:00" (auto)
# updated_at: "2026-02-08T14:30:46.000000+00:00" (auto)
```

### Website polls at 14:30:48 (3 seconds later):
```javascript
fetchDefects({ limit: 100 })
// SELECT * FROM defects ORDER BY detected_at DESC
// Returns the defect created above

// Display in list:
// [14:30:45] Crack - pending

// User clicks → Modal shows:
// - Image from: https://..../defects/Crack/20260208_143045_123456.jpg
// - Detection Time: 2026-02-08 14:30:45
// - Device: raspberry-pi-1
// - Status: pending (orange badge)
// - Notes: Confidence: 85.00%

// User clicks "Mark Reviewed"
// → Updates database: status = "reviewed"
// → List updates immediately (blue badge)
```

## Success Checklist

- [ ] SQL script runs without errors in Supabase
- [ ] defects table exists with all columns
- [ ] defect-images bucket created and public
- [ ] Two storage policies created (INSERT + SELECT)
- [ ] Environment variables set on all three systems
- [ ] test_supabase.py shows ✅ for database and storage
- [ ] Backend server starts with no errors
- [ ] Website loads and shows Dashboard
- [ ] glass_detection.py runs and shows camera window
- [ ] When defect detected, logs show ✅ for upload and database save
- [ ] Website shows defect in list within 3 seconds
- [ ] Click defect → Modal shows image from storage
- [ ] Modal shows all metadata correctly
- [ ] Can update status in modal
- [ ] Status changes reflected in list and database
- [ ] Live camera feed appears (bonus Socket.IO feature)

## If Something Doesn't Work

1. **SQL script fails** → Run one section at a time to find the error
2. **Policy creation fails** → Use Dashboard UI templates (not SQL)
3. **Storage upload fails** → Check bucket is PUBLIC and policies allow INSERT
4. **Website doesn't fetch data** → Check browser console (F12) for CORS or network errors
5. **Modal doesn't show image** → Verify image_url is a valid public Storage URL
6. **Status update doesn't work** → Check Supabase RLS policies allow UPDATE
7. **Real-time not working** → Socket.IO is optional; system works without it

## Files Used

- `DATABASE_SETUP.sql` - Table, indexes, RLS, triggers, views
- `glass_detection.py` - Detection, upload, database save
- `Dashboard.js` - Polling, list, modal display
- `defects.js` - Supabase queries and mutations
- `.env` files - Credentials on all three systems
