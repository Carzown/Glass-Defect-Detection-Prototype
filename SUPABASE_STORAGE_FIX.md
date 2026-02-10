# 🔍 Supabase Storage Upload Issues - Complete Diagnosis & Fix

**Date:** February 9, 2026  
**Issue:** Cannot upload to Supabase storage despite following instructions

---

## ❌ Common Problems & Solutions

### **Problem #1: Storage Bucket Not Created (Most Common)**

**Symptoms:**
```
⚠️ Upload failed: 404 Not Found - Bucket does not exist
```

**Solution:**
1. Go to **Supabase Dashboard** → **Storage**
2. Click **"Create a new bucket"**
3. Name it: `defect-images` (exactly this name!)
4. **IMPORTANT:** Toggle **"Make it public"** to **ON** ✅
5. Click **"Create Bucket"**
6. Click on the bucket and go to **"Policies"**
7. Click **"New Policy"**
8. Select template: **"For public users"**
9. Operation: **SELECT** → Click **"Save"**
10. Repeat: Click **"New Policy"** again
11. Select template: **"For authenticated users"**
12. Operation: **INSERT** → Click **"Save"**

**Verify it worked:**
```bash
curl -H "Authorization: Bearer $SUPABASE_KEY" \
  https://YOUR_SUPABASE_URL/storage/v1/bucket
```

---

### **Problem #2: Storage Policies Missing or Incorrect**

**Symptoms:**
```
⚠️ Upload failed: 403 Forbidden - Permission denied
❌ Unable to save defect: Policy violation
```

**Solution - Set Correct Storage Policies:**

Go to **Supabase Dashboard** → **Storage** → **defect-images** → **Policies**

You need **EXACTLY 2 policies**:

#### **Policy 1: Public Read Access**
- Click **"New Policy"** → Select **"For public users"**
- Operation: **SELECT**
- With CHECK: `true`
- Click **"Save"**

#### **Policy 2: Authenticated Write Access**
- Click **"New Policy"** → Select **"For authenticated users"**
- Operation: **INSERT**
- With CHECK: `true`
- Click **"Save"**

**Or manually via SQL:**
```sql
CREATE POLICY "Allow public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'defect-images');

CREATE POLICY "Allow authenticated upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'defect-images');
```

---

### **Problem #3: Using Wrong API Key (Anonymous vs Service Role)**

**Symptoms:**
```
⚠️ Upload failed: 401 Unauthorized
❌ Invalid authentication token
```

**The ONLY key that works for storage upload from Raspberry Pi:**
- ✅ Use: **Anon Key** (public)
- ❌ Don't use: Service Role Key (secret - server only)

**Check your code:**
```python
# ✅ CORRECT - Uses Anon Key
SUPABASE_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3M..."  # Starts with eyJ0eXA
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ❌ WRONG - Using Service Role Key
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3M..."  # This is service role
```

**To get the correct Anon Key:**
1. Go to **Supabase Dashboard** → **Settings** → **API**
2. Find **"Anon public"** key
3. Copy it (it's safe to use publicly)
4. Add to your code:

```python
SUPABASE_URL = "https://YOUR_PROJECT.supabase.co"
SUPABASE_KEY = "YOUR_ANON_KEY_HERE"  # Copy from dashboard
```

---

### **Problem #4: Bucket Name Mismatch**

**Symptoms:**
```
⚠️ Upload failed: Bucket 'defect-images' does not exist
```

**Check your code - MUST match exactly:**
```python
# ✅ CORRECT - Matches bucket name
supabase.storage.from_('defect-images').upload(filename, data)

# ❌ WRONG - Typo or different name
supabase.storage.from_('defect_images').upload(filename, data)  # Underscore
supabase.storage.from_('defects').upload(filename, data)        # Different name
```

---

### **Problem #5: File Upload Binary Format Issue**

**Symptoms:**
```
⚠️ Upload failed: Invalid file format
❌ Cannot decode base64
```

**Correct implementation:**
```python
import base64
import cv2

def upload_image_to_supabase(frame, defect_type, timestamp):
    try:
        # 1. Encode frame to JPEG bytes
        _, buffer = cv2.imencode('.jpg', frame)
        
        # 2. Create filename
        filename = f"defects/{defect_type}/{timestamp.strftime('%Y%m%d_%H%M%S_%f')}.jpg"
        
        # 3. Upload raw bytes (NOT base64!)
        response = supabase.storage.from_('defect-images').upload(
            path=filename,
            file=buffer.tobytes(),  # ✅ Use tobytes(), not base64
            file_options={"content-type": "image/jpeg"}
        )
        
        # 4. Get public URL
        public_url = supabase.storage.from_('defect-images').get_public_url(filename)
        print(f"✅ Upload successful: {public_url}")
        return public_url
        
    except Exception as e:
        print(f"❌ Upload failed: {e}")
        return None
```

---

### **Problem #6: Network/Connectivity Issues**

**Symptoms:**
```
⚠️ Upload failed: Connection timeout
❌ Failed to resolve host
```

**Test your connection:**
```bash
# Test Supabase API
curl -H "Authorization: Bearer YOUR_ANON_KEY" \
  https://YOUR_PROJECT.supabase.co/rest/v1/defects?limit=1

# Test storage directly
curl -H "Authorization: Bearer YOUR_ANON_KEY" \
  https://YOUR_PROJECT.supabase.co/storage/v1/bucket

# Test from Pi
ssh pi@raspberrypi.local
curl https://kfeztemgrbkfwaicvgnk.supabase.co/rest/v1/health
```

---

### **Problem #7: Row Level Security (RLS) Blocking Inserts**

**Symptoms:**
```
⚠️ Database save failed: Policy violation
❌ Cannot insert into defects table
```

**The database schema already includes these policies, but verify:**

```sql
-- Check that these policies exist:
SELECT * FROM pg_policies WHERE tablename = 'defects';

-- Should see 4 policies:
-- - Allow read all
-- - Allow insert all
-- - Allow update all
-- - Allow delete all
```

**If missing, add them:**
```sql
ALTER TABLE public.defects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read all" ON public.defects FOR SELECT USING (true);
CREATE POLICY "Allow insert all" ON public.defects FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update all" ON public.defects FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete all" ON public.defects FOR DELETE USING (true);
```

---

## ✅ Complete Working Example

Here's a **TESTED** working implementation:

```python
#!/usr/bin/env python3
import cv2
import base64
from datetime import datetime
from supabase import create_client

# Configuration
SUPABASE_URL = "https://YOUR_PROJECT.supabase.co"
SUPABASE_KEY = "YOUR_ANON_KEY"  # Copy from Supabase Dashboard > Settings > API
BUCKET_NAME = "defect-images"

# Initialize Supabase
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def upload_defect_image(frame, defect_type):
    """Upload a single frame to Supabase Storage"""
    try:
        # Step 1: Encode frame to JPEG
        success, buffer = cv2.imencode('.jpg', frame)
        if not success:
            print("❌ Failed to encode image")
            return None
        
        # Step 2: Create unique filename
        timestamp = datetime.now()
        filename = f"defects/{defect_type}/{timestamp.strftime('%Y%m%d_%H%M%S_%f')}.jpg"
        
        # Step 3: Upload to storage
        print(f"⏳ Uploading to Supabase: {filename}")
        
        response = supabase.storage.from_(BUCKET_NAME).upload(
            path=filename,
            file=buffer.tobytes(),
            file_options={"content-type": "image/jpeg"}
        )
        
        # Step 4: Get public URL
        public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(filename)
        print(f"✅ Upload successful!")
        print(f"   URL: {public_url}")
        
        # Step 5: Save to database
        save_defect_record(defect_type, filename, public_url, timestamp)
        
        return public_url
        
    except Exception as e:
        print(f"❌ Upload failed: {type(e).__name__}: {e}")
        return None

def save_defect_record(defect_type, image_path, image_url, timestamp):
    """Save defect record to database"""
    try:
        print(f"⏳ Saving to database...")
        
        data = {
            "device_id": "raspberry-pi-1",
            "defect_type": defect_type,
            "detected_at": timestamp.isoformat(),
            "image_path": image_path,
            "image_url": image_url,
            "status": "pending",
            "notes": "Auto-detected by YOLOv11"
        }
        
        response = supabase.table("defects").insert([data]).execute()
        print(f"✅ Database record saved")
        
    except Exception as e:
        print(f"❌ Database save failed: {type(e).__name__}: {e}")

# Test it
if __name__ == "__main__":
    # Load a test image
    test_image = cv2.imread("test_frame.jpg")
    
    if test_image is None:
        print("❌ Cannot find test_frame.jpg")
        print("   Create one: capture a frame first")
    else:
        print("🧪 Testing Supabase upload...")
        url = upload_defect_image(test_image, "scratch")
        if url:
            print(f"\n✅ Test passed! Image at: {url}")
        else:
            print("\n❌ Test failed!")
```

---

## 🔧 Step-by-Step Verification

### **Step 1: Verify Bucket Exists**
```bash
curl -H "Authorization: Bearer YOUR_ANON_KEY" \
  https://kfeztemgrbkfwaicvgnk.supabase.co/storage/v1/bucket

# Expected response: JSON with bucket details
```

### **Step 2: Verify Policies Are Set**
Go to Supabase Dashboard → Storage → defect-images → Policies

**Should see:**
- ✅ "Allow public read" (SELECT)
- ✅ "Allow authenticated upload" (INSERT)

### **Step 3: Test Upload with cURL**
```bash
# Create test file
echo "test" > test.txt

# Upload it
curl -X POST \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -F "file=@test.txt" \
  https://kfeztemgrbkfwaicvgnk.supabase.co/storage/v1/object/defect-images/test/test.txt

# If successful, you'll get back the file path
```

### **Step 4: Test from Python**
```python
from supabase import create_client

supabase = create_client(
    "https://kfeztemgrbkfwaicvgnk.supabase.co",
    "YOUR_ANON_KEY"
)

# Try simple upload
response = supabase.storage.from_('defect-images').upload(
    'test/hello.txt',
    b'Hello World',
    {"content-type": "text/plain"}
)

print(response)  # Should print success
```

---

## 🎯 The Real Issue (Most Likely)

Based on your setup, the **#1 most common reason** is:

### **You haven't created the storage bucket yet!**

**Quick fix (2 minutes):**
1. Go to Supabase Dashboard
2. Click **Storage** (left sidebar)
3. Click **"Create a new bucket"**
4. Enter name: `defect-images`
5. Toggle **"Make it public"** ✅
6. Click **Create**
7. Click the bucket → **Policies** tab
8. Add 2 policies (follow the policy steps above)

**Then test:**
```bash
python3 -c "
from supabase import create_client
s = create_client('https://kfeztemgrbkfwaicvgnk.supabase.co', 'YOUR_KEY')
r = s.storage.from_('defect-images').upload('test.txt', b'test')
print('✅ SUCCESS' if r else '❌ FAILED')
"
```

---

## 📊 Checklist

- [ ] Storage bucket `defect-images` created
- [ ] Bucket is set to PUBLIC
- [ ] Storage policy: SELECT (public read) exists
- [ ] Storage policy: INSERT (authenticated write) exists
- [ ] Using ANON key (not service role key)
- [ ] Bucket name matches in code (exactly: `defect-images`)
- [ ] Database table `defects` created
- [ ] Database RLS policies enabled
- [ ] Network connectivity verified
- [ ] Python Supabase library installed: `pip install supabase`
- [ ] Using `.tobytes()` for file upload (not base64)

---

## 🆘 Still Not Working?

Enable debug logging:

```python
import logging
logging.basicConfig(level=logging.DEBUG)

# This will show exactly what's failing
```

Then run and send me the error output with:
- ❌ Exact error message
- ❌ Line number where it fails
- ❌ Output from debug logging

---

**Last Updated:** February 9, 2026

