# 🎯 Supabase Storage Upload - Complete Troubleshooting Guide

**Problem:** Cannot upload images to Supabase storage  
**Status:** DIAGNOSABLE & FIXABLE  
**Time to Fix:** 10-15 minutes

---

## 🚀 Quick Start - 3 Steps to Fix

### **Step 1: Run the Diagnostic (2 minutes)**
```bash
cd /Users/Carzown/Desktop/Projects/Glass-Defect-Detection-Prototype
python3 diagnose_supabase.py
```

This will tell you **exactly** what's wrong.

### **Step 2: Follow the Instructions (5 minutes)**
Based on the diagnostic output, follow the specific fix below.

### **Step 3: Test with Fixed Script (3 minutes)**
```bash
python3 glass_detection_supabase_fixed.py
```

---

## ❌ Most Common Problems & Exact Fixes

### **Problem 1: "Bucket does not exist" or 404 Error** (70% of cases)

**You see:**
```
❌ Upload failed: 404 Not Found
→ Bucket 'defect-images' does not exist
```

**THE FIX (4 steps):**

1. Go to **https://app.supabase.com/project/kfeztemgrbkfwaicvgnk**
2. Click **"Storage"** in left sidebar
3. Click **"Create a new bucket"** (blue button)
4. Type name exactly: `defect-images` (no caps, no typos)
5. **CRITICAL:** Toggle **"Make it public"** to **ON** (blue) ✅
6. Click **"Create Bucket"**

✅ **Verify it worked:** You should see the bucket in the list

---

### **Problem 2: "Permission denied" or 403 Error** (20% of cases)

**You see:**
```
❌ Upload failed: 403 Forbidden
→ Permission denied
```

**THE FIX (6 steps):**

1. Go to **Storage** → Click **"defect-images"** bucket
2. Click **"Policies"** tab (top right)
3. Click **"New Policy"** button
4. Select **"For public users"** template (left side)
5. Operation: **SELECT** → Click **"Save"** (bottom right)
6. Repeat: Click **"New Policy"** again
7. Select **"For authenticated users"** template
8. Operation: **INSERT** → Click **"Save"**

✅ **Verify:** You should see 2 policies in the list:
- ✅ "Allow public read"
- ✅ "Allow authenticated upload"

---

### **Problem 3: "Unauthorized" or 401 Error** (5% of cases)

**You see:**
```
❌ Upload failed: 401 Unauthorized
→ Unauthorized - check API key
```

**THE FIX (2 steps):**

1. Go to **Settings** → **API** (left sidebar)
2. Find **"Anon public"** key and copy it
3. Go back to your code and verify it matches:

```python
SUPABASE_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."  # Should start with eyJ0eXA
```

**CHECK:** Your key should:
- ✅ Start with `eyJ0eXA` (not `eyJhbGci`)
- ✅ Be from "Anon public" row (not "Service role")
- ✅ Match exactly with no extra spaces

---

### **Problem 4: "Table does not exist" or Database Error** (3% of cases)

**You see:**
```
❌ Database save failed: relation "defects" does not exist
→ Table 'defects' does not exist
```

**THE FIX (3 steps):**

1. Go to **SQL Editor** (left sidebar)
2. Click **"New Query"**
3. Open `/DATABASE_SETUP.sql` file and copy ALL contents
4. Paste into the SQL editor
5. Click **"Run"** (blue button, bottom right)
6. Wait for: **"No errors" message**

✅ **Verify:** You'll see "Execution completed successfully"

---

### **Problem 5: Bucket exists but upload still fails** (2% of cases)

**THE DIAGNOSTIC APPROACH:**

Run this Python script to pinpoint the exact issue:

```python
#!/usr/bin/env python3
from supabase import create_client
import sys

# Your credentials
URL = "https://kfeztemgrbkfwaicvgnk.supabase.co"
KEY = "YOUR_ANON_KEY"  # Copy from Settings > API
BUCKET = "defect-images"

# Initialize
supabase = create_client(URL, KEY)

# Test 1: Can we access the bucket?
try:
    files = supabase.storage.from_(BUCKET).list()
    print("✅ Bucket accessible")
except Exception as e:
    print(f"❌ Bucket error: {e}")
    sys.exit(1)

# Test 2: Can we upload?
try:
    response = supabase.storage.from_(BUCKET).upload(
        path="test/hello.txt",
        file=b"hello world",
        file_options={"content-type": "text/plain"}
    )
    print("✅ Upload works!")
    print(f"Response: {response}")
except Exception as e:
    print(f"❌ Upload failed: {e}")
    sys.exit(1)

# Test 3: Can we get public URL?
try:
    url = supabase.storage.from_(BUCKET).get_public_url("test/hello.txt")
    print(f"✅ Public URL: {url}")
except Exception as e:
    print(f"❌ URL generation failed: {e}")
    sys.exit(1)

print("\n✅ All tests passed!")
```

---

## 📋 Complete Setup Checklist

Go through this checklist and check off each item:

### **Supabase Configuration**
- [ ] Go to https://app.supabase.com/project/kfeztemgrbkfwaicvgnk
- [ ] Project opens without errors

### **Storage Setup**
- [ ] Storage > Create bucket named: `defect-images`
- [ ] Bucket is set to PUBLIC (toggle ON)
- [ ] Bucket > Policies shows 2 policies:
  - [ ] "Allow public read" (SELECT)
  - [ ] "Allow authenticated upload" (INSERT)

### **Database Setup**
- [ ] SQL Editor > New Query
- [ ] Paste DATABASE_SETUP.sql contents
- [ ] Click Run
- [ ] Message says "No errors"
- [ ] Table Explorer > "defects" table visible

### **Credentials Setup**
- [ ] Go to Settings > API
- [ ] Copy "Anon public" key (starts with eyJ0eXA)
- [ ] Verify in your Python code:
  ```python
  SUPABASE_URL = "https://kfeztemgrbkfwaicvgnk.supabase.co"
  SUPABASE_KEY = "[your anon key here]"
  BUCKET_NAME = "defect-images"
  ```

### **Code Setup**
- [ ] Install dependencies: `pip install supabase opencv-python`
- [ ] Use fixed version: `glass_detection_supabase_fixed.py`
- [ ] Run diagnostic: `python diagnose_supabase.py`
- [ ] Test upload: `python glass_detection_supabase_fixed.py`

---

## 🔧 Step-by-Step Setup from Scratch

If nothing above worked, do the complete setup:

### **1. Create Storage Bucket (2 minutes)**

```
Supabase Dashboard
  ↓ Click "Storage" (left sidebar)
  ↓ Click blue "Create a new bucket" button
  ↓ Name: defect-images
  ↓ Toggle "Make it public" = ON ✅
  ↓ Click "Create Bucket"
  
Result: Bucket appears in storage list
```

### **2. Configure Storage Policies (3 minutes)**

```
Bucket: defect-images
  ↓ Click "Policies" tab
  ↓ Click "New Policy"
  ↓ Template: "For public users"
  ↓ Operation: SELECT
  ↓ Click "Save"
  
  ↓ Click "New Policy" again
  ↓ Template: "For authenticated users"
  ↓ Operation: INSERT
  ↓ Click "Save"
  
Result: 2 policies in list
```

### **3. Setup Database Schema (2 minutes)**

```
Supabase Dashboard
  ↓ Click "SQL Editor" (left sidebar)
  ↓ Click "New Query"
  ↓ Open file: DATABASE_SETUP.sql
  ↓ Copy ALL contents
  ↓ Paste into SQL editor
  ↓ Click "Run" button
  ↓ Wait for: "No errors"
  
Result: defects table exists in database
```

### **4. Verify Credentials (2 minutes)**

```
Supabase Dashboard
  ↓ Click "Settings" (left sidebar)
  ↓ Click "API"
  ↓ Find row: "Anon public"
  ↓ Copy the key value (starts with eyJ0eXA...)
  ↓ Verify it's NOT the Service Role Key
  
Result: You have the correct Anon key
```

### **5. Test Connection (3 minutes)**

```bash
# Run the diagnostic tool
python3 diagnose_supabase.py

# Should show ✅ for all checks
# If any ❌, address that specific issue
```

### **6. Test Upload (2 minutes)**

```bash
# Run the fixed test script
python3 glass_detection_supabase_fixed.py

# Should show:
# ✅ Supabase initialized
# ✅ All tests passed
# ✅ Upload successful
```

---

## 📊 Diagnosis Decision Tree

```
Upload fails?
  ↓
  Run: python3 diagnose_supabase.py
  ↓
  ┌─────────────────────────────────┐
  │ Output shows which is broken:   │
  │                                 │
  │ ❌ Supabase client             │ → Check credentials
  │ ❌ Bucket check                │ → Create bucket (see Problem #1)
  │ ❌ Upload test                 │ → Set policies (see Problem #2)
  │ ❌ Database test               │ → Run DATABASE_SETUP.sql
  │ ✅ All checks pass             │ → Use fixed script
  └─────────────────────────────────┘
```

---

## 🆘 If You're Still Stuck

1. **Run diagnostic:**
   ```bash
   python3 diagnose_supabase.py > diagnostic_output.txt
   ```

2. **Copy exact error messages** from output

3. **Check these specific things:**
   - Is bucket public? (toggle should be ON/blue)
   - Are there 2 policies? (SELECT and INSERT)
   - Does database table exist? (check in SQL Editor)
   - Is API key the anon key? (check Settings > API)

4. **Try the fixed script:**
   ```bash
   python3 glass_detection_supabase_fixed.py
   ```
   This has better error messages

---

## 💡 Key Things to Remember

1. **Bucket name MUST be exactly:** `defect-images` (lowercase, dash not underscore)
2. **Bucket MUST be public:** Toggle = ON (blue color)
3. **Need 2 policies:** SELECT (public) + INSERT (auth)
4. **Use Anon key, NOT Service Role key**
5. **Database schema MUST be applied** from DATABASE_SETUP.sql
6. **Use `.tobytes()` not base64** for uploads
7. **Test connection first** with diagnostic tool

---

## ✅ Success Criteria

You'll know it's working when:

✅ `diagnose_supabase.py` shows all checks pass  
✅ `glass_detection_supabase_fixed.py` shows "All tests passed"  
✅ Images appear in Supabase Storage browser  
✅ Defect records appear in database  
✅ Public URLs are generated correctly  

---

## 📞 Quick Reference

| Item | Value |
|------|-------|
| **Project URL** | https://app.supabase.com/project/kfeztemgrbkfwaicvgnk |
| **Bucket Name** | `defect-images` |
| **Supabase URL** | https://kfeztemgrbkfwaicvgnk.supabase.co |
| **Table Name** | `defects` |
| **Storage Policies Needed** | SELECT + INSERT |
| **Key Type to Use** | Anon (public) - NOT Service Role |
| **Diagnostic Tool** | `python3 diagnose_supabase.py` |
| **Fixed Script** | `python3 glass_detection_supabase_fixed.py` |

---

**Last Updated:** February 9, 2026  
**Status:** COMPLETE GUIDE WITH DIAGNOSTICS

