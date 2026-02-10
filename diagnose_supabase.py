#!/usr/bin/env python3
"""
Supabase Storage Upload Diagnostic Tool
Checks all components and identifies the exact problem
"""

import sys
import os
from datetime import datetime

# Colors
GREEN = '\033[0;32m'
RED = '\033[0;31m'
YELLOW = '\033[1;33m'
BLUE = '\033[0;34m'
RESET = '\033[0m'

def print_header(title):
    print(f"\n{BLUE}{'='*70}{RESET}")
    print(f"{BLUE}{title}{RESET}")
    print(f"{BLUE}{'='*70}{RESET}\n")

def print_success(msg):
    print(f"{GREEN}✅ {msg}{RESET}")

def print_error(msg):
    print(f"{RED}❌ {msg}{RESET}")

def print_warning(msg):
    print(f"{YELLOW}⚠️  {msg}{RESET}")

def print_info(msg):
    print(f"{BLUE}ℹ️  {msg}{RESET}")

print_header("🔍 SUPABASE STORAGE DIAGNOSTIC")

# ============================================================================
# Check 1: Python & Libraries
# ============================================================================
print("1️⃣  CHECKING PYTHON & LIBRARIES")
print("-" * 70)

try:
    import supabase
    print_success("supabase library installed")
    print_info(f"   Version: {supabase.__version__ if hasattr(supabase, '__version__') else 'unknown'}")
except ImportError:
    print_error("supabase library NOT installed")
    print_info("   Fix: pip install supabase")
    sys.exit(1)

try:
    import cv2
    print_success("opencv (cv2) installed")
except ImportError:
    print_warning("opencv NOT installed (needed for frame capture)")

try:
    import requests
    print_success("requests library installed")
except ImportError:
    print_error("requests library NOT installed")

# ============================================================================
# Check 2: Supabase Configuration
# ============================================================================
print("\n2️⃣  CHECKING SUPABASE CONFIGURATION")
print("-" * 70)

SUPABASE_URL = "https://kfeztemgrbkfwaicvgnk.supabase.co"
SUPABASE_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmZXp0ZW1ncmJrZndhaWN2Z25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMDM4NDIsImV4cCI6MjA3Njc3OTg0Mn0.n4F6v_kywu55Nj2Yx_dcZri4WsdUMaftzPl1FXT-to8"
BUCKET_NAME = "defect-images"

if SUPABASE_URL:
    print_success(f"SUPABASE_URL configured: {SUPABASE_URL}")
else:
    print_error("SUPABASE_URL not set")

if SUPABASE_KEY:
    print_success(f"SUPABASE_KEY configured")
    # Check key type
    if SUPABASE_KEY.startswith("eyJ0eXA"):
        print_info("   Key type: Anon key ✅ (correct for client)")
    elif SUPABASE_KEY.startswith("eyJhbGci"):
        print_warning("   Key type: Service role key (should use Anon key)")
    else:
        print_warning("   Key type: Unknown")
else:
    print_error("SUPABASE_KEY not set")

print_info(f"Bucket name: {BUCKET_NAME}")

# ============================================================================
# Check 3: Supabase Connection
# ============================================================================
print("\n3️⃣  CHECKING SUPABASE CONNECTION")
print("-" * 70)

try:
    from supabase import create_client
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    print_success("Supabase client created")
except Exception as e:
    print_error(f"Failed to create Supabase client: {e}")
    sys.exit(1)

# Test connection
try:
    # Try to list buckets
    storage = supabase.storage
    print_success("Storage client initialized")
except Exception as e:
    print_error(f"Storage client failed: {e}")

# ============================================================================
# Check 4: Storage Bucket
# ============================================================================
print("\n4️⃣  CHECKING STORAGE BUCKET")
print("-" * 70)

try:
    bucket_client = supabase.storage.from_(BUCKET_NAME)
    print_success(f"Bucket '{BUCKET_NAME}' client created")
    
    # Try a simple operation
    try:
        # List files (this will fail if bucket doesn't exist)
        files = bucket_client.list()
        print_success(f"Bucket exists and is accessible")
        print_info(f"   Contains {len(files) if files else 0} files")
    except Exception as bucket_error:
        error_msg = str(bucket_error)
        if "404" in error_msg or "not found" in error_msg.lower():
            print_error(f"Bucket '{BUCKET_NAME}' does NOT exist")
            print_warning("   Fix: Create bucket in Supabase Dashboard > Storage")
        elif "403" in error_msg or "permission" in error_msg.lower():
            print_error(f"Permission denied to bucket '{BUCKET_NAME}'")
            print_warning("   Fix: Check bucket policies in Supabase Dashboard")
        else:
            print_error(f"Bucket access error: {error_msg}")
            
except Exception as e:
    print_error(f"Cannot access bucket: {e}")

# ============================================================================
# Check 5: Test Upload (without actual file)
# ============================================================================
print("\n5️⃣  TESTING UPLOAD CAPABILITY")
print("-" * 70)

try:
    # Create a small test payload
    test_data = b"test-upload-" + datetime.now().isoformat().encode()
    test_filename = f"test/diagnostic-{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    
    print_info(f"Attempting test upload...")
    print_info(f"   File: {test_filename}")
    print_info(f"   Size: {len(test_data)} bytes")
    
    response = supabase.storage.from_(BUCKET_NAME).upload(
        path=test_filename,
        file=test_data,
        file_options={"content-type": "text/plain"}
    )
    
    print_success("Test upload SUCCESSFUL")
    print_info(f"   Response: {response}")
    
    # Try to get URL
    try:
        url = supabase.storage.from_(BUCKET_NAME).get_public_url(test_filename)
        print_success(f"Public URL generated")
        print_info(f"   URL: {url}")
    except Exception as url_error:
        print_warning(f"Could not generate public URL: {url_error}")
    
except Exception as e:
    error_msg = str(e)
    print_error(f"Test upload FAILED")
    
    # Diagnose the error
    if "404" in error_msg:
        print_warning("Error: Bucket not found")
        print_info("   Action: Create 'defect-images' bucket in Supabase")
    elif "403" in error_msg:
        print_warning("Error: Permission denied")
        print_info("   Action: Check storage policies")
    elif "401" in error_msg:
        print_warning("Error: Unauthorized")
        print_info("   Action: Check API key is correct (use Anon key, not Service Role)")
    elif "400" in error_msg:
        print_warning("Error: Bad request")
        print_info("   Action: Check file format/encoding")
    else:
        print_info(f"   Error details: {error_msg}")

# ============================================================================
# Check 6: Database Connection
# ============================================================================
print("\n6️⃣  CHECKING DATABASE CONNECTION")
print("-" * 70)

try:
    # Try to check if defects table exists
    result = supabase.table("defects").select("*", count="exact").limit(1).execute()
    print_success("Database connection successful")
    print_info(f"   defects table accessible")
    print_info(f"   Total records: {result.count if hasattr(result, 'count') else 'unknown'}")
except Exception as e:
    error_msg = str(e)
    if "does not exist" in error_msg.lower() or "relation" in error_msg.lower():
        print_error("defects table does not exist")
        print_warning("   Fix: Run DATABASE_SETUP.sql in Supabase SQL Editor")
    elif "permission" in error_msg.lower():
        print_warning("Permission denied to defects table")
        print_info("   Check RLS policies")
    else:
        print_error(f"Database error: {error_msg}")

# ============================================================================
# Check 7: Summary & Recommendations
# ============================================================================
print("\n7️⃣  DIAGNOSTIC SUMMARY")
print("-" * 70)

print("\n📋 CHECKLIST:")
print("   [ ] Python 3 installed")
print("   [ ] supabase library installed")
print("   [ ] Supabase credentials configured")
print("   [ ] Storage bucket 'defect-images' created")
print("   [ ] Bucket set to PUBLIC")
print("   [ ] Storage policies configured (SELECT + INSERT)")
print("   [ ] Database table 'defects' created")
print("   [ ] Database RLS policies enabled")
print("   [ ] API key is Anon key (not Service Role)")

print("\n🔧 COMMON FIXES:")
print(f"\n   1. Create bucket:")
print(f"      → Supabase Dashboard → Storage → Create Bucket")
print(f"      → Name: defect-images")
print(f"      → Toggle: Make it public ✅")
print(f"\n   2. Add storage policies:")
print(f"      → Storage → defect-images → Policies")
print(f"      → Add: SELECT (public read)")
print(f"      → Add: INSERT (authenticated write)")
print(f"\n   3. Apply database schema:")
print(f"      → SQL Editor → New Query")
print(f"      → Copy DATABASE_SETUP.sql contents")
print(f"      → Click Run")
print(f"\n   4. Install Python packages:")
print(f"      → pip install supabase opencv-python")

print("\n" + "=" * 70)
print(f"{GREEN}Diagnostic complete!{RESET}")
print("=" * 70 + "\n")

