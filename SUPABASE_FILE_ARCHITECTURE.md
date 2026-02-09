# 🔗 Supabase Integration - File Architecture

**Complete map of all connections between Supabase, Backend, Pi, and Dashboard**

---

## File Structure with Connections

```
Glass-Defect-Detection-Prototype/
│
├─ 📄 .env 
│  └─→ SUPABASE_URL: https://kfeztemgrbkfwaicvgnk.supabase.co
│  └─→ SUPABASE_KEY: [api-key]
│  └─→ BACKEND_URL: http://localhost:5000 ← CORRECTED
│
├─ 📄 glass_detection_webrtc.py ⭐ RASPBERRY PI
│  ├─ Imports:
│  │  ├─ from supabase import create_client ← USES SUPABASE
│  │  └─ import aiohttp ← WebRTC signaling
│  │
│  └─ Key Functions:
│     ├─ upload_image_to_supabase() → Uploads to defect-images bucket
│     ├─ save_defect_to_supabase() → Saves to defects table
│     └─ SegmentationVideoTrack.recv() → Streams frames via WebRTC
│
├─ backend/
│  │
│  ├─ 📄 server.js ⚙️ BACKEND SERVER
│  │  ├─ Imports:
│  │  │  ├─ require('./webrtc-handler.js') ← WebRTC signaling
│  │  │  └─ require('./defects.js') ← Defect endpoints
│  │  │
│  │  └─ Routes:
│  │     ├─ POST /webrtc/offer ← Pi sends offer
│  │     ├─ GET /webrtc/offer ← Dashboard gets offer
│  │     ├─ POST /webrtc/answer ← Dashboard sends answer
│  │     ├─ GET /webrtc/answer ← Pi gets answer
│  │     ├─ POST /webrtc/candidate ← ICE candidates
│  │     └─ GET /defects ← Dashboard polls defects (NEW: calls supabase.js)
│  │
│  ├─ 📄 webrtc-handler.js 🎥 WebRTC SIGNALING
│  │  └─ Manages offer/answer/ICE between Pi and Dashboard
│  │
│  └─ 📄 defects.js 📊 DEFECT API
│     └─ GET /api/defects → (calls Supabase via Dashboard)
│
├─ react-glass/
│  │
│  ├─ 📄 .env ⚙️ REACT ENV
│  │  ├─ REACT_APP_SUPABASE_URL: https://kfeztemgrbkfwaicvgnk.supabase.co
│  │  ├─ REACT_APP_SUPABASE_ANON_KEY: [api-key]
│  │  └─ REACT_APP_BACKEND_URL: http://localhost:5000
│  │
│  ├─ 📄 .env.example 📋 TEMPLATE
│  │  └─ Template for above
│  │
│  ├─ src/
│  │  │
│  │  ├─ 📄 supabase.js ⭐⭐⭐ SUPABASE CLIENT (NEW: 300+ lines)
│  │  │  │
│  │  │  ├─ Exports:
│  │  │  │  ├─ supabase (client instance)
│  │  │  │  ├─ uploadImageToStorage() ← Upload images
│  │  │  │  ├─ saveDefectRecord() ← Save defects
│  │  │  │  ├─ fetchDefectsFromDB() ← Fetch defects ← CALLED BY DASHBOARD
│  │  │  │  └─ updateDefectStatus() ← Update status
│  │  │  │
│  │  │  └─ Config:
│  │  │     ├─ URL from env: REACT_APP_SUPABASE_URL
│  │  │     └─ Key from env: REACT_APP_SUPABASE_ANON_KEY
│  │  │
│  │  ├─ 📄 App.js 🎨 ROOT COMPONENT
│  │  │  └─ Imports supabase.js
│  │  │
│  │  ├─ 📄 pages/Dashboard.js 📺 MAIN DASHBOARD
│  │  │  │
│  │  │  ├─ Imports:
│  │  │  │  ├─ import { fetchDefects } from '../services/defects' ← Fetch defects
│  │  │  │  └─ import supabase from '../supabase' ← Supabase client
│  │  │  │
│  │  │  ├─ Key Functions:
│  │  │  │  ├─ setupWebRTC() → Pi → Backend → Dashboard (WebRTC signaling)
│  │  │  │  ├─ pollDefects() ← Every 3 seconds
│  │  │  │  │  └─ fetchDefectsFromDB() ← Gets from Supabase
│  │  │  │  │     └─ Display on dashboard
│  │  │  │  └─ ontrack handler → Receives video stream
│  │  │  │
│  │  │  └─ State:
│  │  │     ├─ status: 'connecting' | 'connected' | 'error'
│  │  │     ├─ defects: [{...}, {...}] ← From Supabase
│  │  │     └─ videoStream: RTCMediaStream
│  │  │
│  │  ├─ 📄 services/defects.js 🔄 DEFECT SERVICE
│  │  │  │
│  │  │  └─ Exports:
│  │  │     ├─ fetchDefects(filters) ← Calls supabase.js
│  │  │     ├─ updateDefectStatus(id, status) ← Calls supabase.js
│  │  │     └─ Other defect operations
│  │  │
│  │  └─ 📄 setupProxy.js 🔌 PROXY CONFIG
│  │     └─ Proxies /api calls to BACKEND_URL (http://localhost:5000)
│  │
│  └─ 📄 package.json 📦 REACT DEPS
│     ├─ Added: "proxy": "http://localhost:5000"
│     └─ Dependencies: @supabase/supabase-js, etc
│
└─ supabase/
   └─ Supabase configuration files (if any)
```

---

## Connection Flows

### 🔄 Flow 1: Pi Detects Defect & Uploads

```
glass_detection_webrtc.py (Raspberry Pi)
│
├─ YOLO detects object
│
├─ 1️⃣ Upload Image
│  └─→ upload_image_to_supabase(frame, type, timestamp)
│     └─→ supabase.storage.from('defect-images').upload()
│        └─→ Supabase Storage Bucket ✅
│           └─ saves image at: defects/{type}/{timestamp}.jpg
│
└─ 2️⃣ Save Metadata
   └─→ save_defect_to_supabase(type, timestamp, url)
      └─→ supabase.table('defects').insert()
         └─→ Supabase Database Table ✅
            └─ saves record to 'defects' table
```

### 🔄 Flow 2: Dashboard Polls Supabase

```
React Dashboard (Browser)
│
├─ useEffect() - runs on mount
│
├─ callsetupWebRTC()
│  └─→ Creates offer → Backend → Gets answer → Connects to Pi
│     └─→ ontrack handler receives video stream
│        └─→ Displays in <video> element ✅
│
└─ setInterval(() => { pollDefects() }, 3000)
   └─→ Every 3 seconds, fetch from Supabase
      └─→ pages/Dashboard.js calls services/defects.js
         └─→ defects.js calls supabase.js
            └─→ fetchDefectsFromDB()
               └─→ supabase.from('defects').select() ✅
                  └─→ Supabase Database
                     └─→ Returns defect list
                        └─→ Update state
                           └─→ Re-render component
                              └─→ Display in list ✅
                                 └─→ Show images w/ public URLs ✅
```

### 🔄 Flow 3: User Updates Defect Status

```
React Dashboard (Browser)
│
├─ User clicks defect → selects "Reviewed"
│
└─→ updateDefectStatus(defectId, "reviewed")
   └─→ services/defects.js
      └─→ supabase.js → updateDefectStatus()
         └─→ supabase.from('defects').update()
            └─→ Supabase Database ✅
               └─ updates status field
                  └─→ Next poll (3 seconds) reflects change ✅
```

---

## Supabase Configuration

### Database Table: `defects`

```sql
Table: public.defects

Columns:
- id: uuid (primary key, auto-generated)
- created_at: timestamp with time zone (auto, NOW())
- updated_at: timestamp with time zone (auto, NOW())
- device_id: text (e.g., "raspberry-pi-1")
- defect_type: text (e.g., "crack", "chip", "scratch")
- detected_at: timestamp with time zone (when detected)
- image_url: text (public URL from Supabase Storage)
- image_path: text (path in bucket, e.g., "defects/crack/...")
- status: text (default 'pending', can be 'reviewed', 'resolved')
- notes: text (optional, e.g., confidence score)

Row Level Security: Disabled (or allow all for development)
```

### Storage Bucket: `defect-images`

```
Bucket: defect-images
Visibility: PUBLIC (Required for images to be accessible!)
Path structure:
  defects/
    ├─ crack/
    │  ├─ 20240115_120000_000000.jpg
    │  └─ 20240115_120030_000001.jpg
    ├─ chip/
    │  └─ 20240115_120100_000002.jpg
    └─ scratch/
       └─ 20240115_120200_000003.jpg

Public URL format:
https://kfeztemgrbkfwaicvgnk.supabase.co/storage/v1/object/public/defect-images/{path}
```

---

## Environment Variable Mapping

### Root `.env` (Used by Pi & Backend)
```env
SUPABASE_URL=https://kfeztemgrbkfwaicvgnk.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiI...
BACKEND_URL=http://localhost:5000
```

**Used by:**
- `glass_detection_webrtc.py` → Supabase settings
- `backend/` → May use BACKEND_URL

### React `.env` (Used by Dashboard)
```env
REACT_APP_SUPABASE_URL=https://kfeztemgrbkfwaicvgnk.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiI...
REACT_APP_BACKEND_URL=http://localhost:5000
```

**Used by:**
- `react-glass/src/supabase.js` → Supabase settings
- `react-glass/src/pages/Dashboard.js` → Backend URL for WebRTC signaling

---

## Code Examples

### Example 1: Pi Uploads Image

**File: glass_detection_webrtc.py**
```python
async def upload_image_to_supabase(frame, defect_type, timestamp):
    # Encode frame as JPEG
    success, buffer = cv2.imencode('.jpg', frame)
    
    # Upload to Supabase
    file_path = f"defects/{defect_type}/{timestamp}.jpg"
    response = supabase.storage.from_("defect-images").upload(
        file_path, 
        buffer.tobytes()
    )
    
    # Get public URL
    public_url = supabase.storage.from_("defect-images").get_public_url(file_path)
    
    return public_url, file_path
```

### Example 2: Dashboard Fetches Defects

**File: react-glass/src/pages/Dashboard.js**
```javascript
async function pollDefects() {
    const { data, count } = await fetchDefectsFromDB({
        device_id: 'raspberry-pi-1',
        status: 'pending',
        limit: 50
    });
    
    setDefects(data);  // Update state with latest defects
}

// In useEffect:
setInterval(() => pollDefects(), 3000);  // Every 3 seconds
```

### Example 3: Save Defect to Database

**File: glass_detection_webrtc.py**
```python
async def save_defect_to_supabase(defect_type, timestamp, image_url, confidence):
    defect_data = {
        'device_id': 'raspberry-pi-1',
        'defect_type': defect_type,
        'detected_at': timestamp,
        'image_url': image_url,
        'status': 'pending',
        'notes': f'Confidence: {confidence}%'
    }
    
    response = supabase.table('defects').insert(defect_data).execute()
    return response.data[0]['id']
```

---

## Summary of Integrations

| Component | Connects To | Method | Status |
|-----------|------------|--------|--------|
| **Pi script** | Supabase Storage | REST API | ✅ Uploads images |
| **Pi script** | Supabase Database | REST API | ✅ Saves defects |
| **Pi script** | Backend | HTTP/WebRTC | ✅ Signaling |
| **Dashboard** | Supabase Database | REST API | ✅ Polls defects |
| **Dashboard** | Supabase Storage | Public URLs | ✅ Displays images |
| **Dashboard** | Backend | HTTP/WebRTC | ✅ Signaling |
| **Backend** | Supabase | N/A | ℹ️ Not used (Pi & Dashboard connect directly) |

---

## Deployment Checklist

- [ ] Supabase project exists
- [ ] `defects` table created with all columns
- [ ] `defect-images` bucket created and PUBLIC
- [ ] `.env` file exists at root with Supabase credentials
- [ ] `react-glass/.env` exists with ReactApp credentials
- [ ] Backend `package.json` has all dependencies
- [ ] React `package.json` has all dependencies
- [ ] Pi has Python packages: `aiortc`, `av`, `supabase`, `opencv-python`, `ultralytics`
- [ ] All three services can be started:
  - [ ] Backend: `npm start` → port 5000
  - [ ] React: `npm start` → port 3000
  - [ ] Pi: `python3 glass_detection_webrtc.py`

---

## Final Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            SUPABASE (Cloud)                             │
│  ┌─────────────────────┐                    ┌──────────────────────┐   │
│  │  defects Table      │                    │  defect-images       │   │
│  │  ─────────────────  │                    │  Storage Bucket      │   │
│  │  id (UUID)          │ ◄──────────────────┤  ─────────────────   │   │
│  │  device_id          │  Polling (3s)      │  Images (JPEG)       │   │
│  │  defect_type        │                    │  Public URLs         │   │
│  │  detected_at        │                    │                      │   │
│  │  image_url      ────┼────────────────────► defects/{type}/... │   │
│  │  status             │                    │                      │   │
│  │  notes              │                    │                      │   │
│  └─────────────────────┘                    └──────────────────────┘   │
│         ▲                                              ▲                │
│         │                                              │                │
└─────────┼──────────────────────────────────────────────┼────────────────┘
          │                                              │
          │ INSERT/SELECT                                │ UPLOAD
          │                                              │
   ┌──────┴──────────▼────────┐              ┌──────────┴──────────┐
   │ React Dashboard          │              │ Raspberry Pi        │
   │ (localhost:3000)         │              │ (glass_detection    │
   │ ─────────────────────    │              │  _webrtc.py)        │
   │ • Polls defects (3s)     │              │ ─────────────────   │
   │ • Displays live video    │              │ • Captures frames   │
   │ • Updates status         │              │ • Runs YOLO         │
   │ • Shows images           │              │ • Detects defects   │
   │                          │              │ • Uploads images    │
   │ supabase.js:             │              │ • Saves metadata    │
   │ • fetchDefectsFromDB()   │              │                     │
   │ • updateDefectStatus()   │              │ supabase.js:        │
   │ • uploadImageToStorage() │              │ • upload_image()    │
   │                          │              │ • save_defect()     │
   └────────────┬─────────────┘              │                     │
                │                            │                     │
                └────────────┬───────────────┘                     │
                             │                                     │
                    WebRTC Signaling                               │
                    (offer/answer)                    Fallback (code)
                    via Backend                       credentials
                             │                        embedded
                             ▼
                   ┌──────────────────────┐
                   │  Node.js Backend     │
                   │  (localhost:5000)    │
                   │  ─────────────────   │
                   │  • WebRTC signaling  │
                   │  • Offer/answer      │
                   │  • ICE candidates    │
                   │                      │
                   │  webrtc-handler.js   │
                   └──────────────────────┘
```

---

## Success Indicators

All flows working when you see:

1. **Pi Console**: `✅ Image uploaded to: defect-images/`
2. **Dashboard**: Defects list updates with new detections
3. **Dashboard**: Clicking image shows it from Supabase
4. **Dashboard**: Updating status saves immediately
5. **Supabase Dashboard**: Defects table shows new records
6. **Supabase Dashboard**: Storage bucket shows uploaded JPEGs

All working? **Integration is COMPLETE!** 🎉
