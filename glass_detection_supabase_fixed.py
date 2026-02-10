#!/usr/bin/env python3
"""
Glass Defect Detection - CORRECTED Supabase Upload Version
This version has all the Supabasdef save_defect_to_supabase(defect_type, timestamp, image_url, image_path, 
                            confidence=0.0, device_id=None):storage issues fixed
"""

import cv2
import time
import os
import base64
from datetime import datetime
from pathlib import Path

print("Initializing modules...")

# Supabase setup - CORRECTED
SUPABASE_ENABLED = False
supabase = None

try:
    from supabase import create_client, Client
    
    # Configuration - EXACTLY as in Supabase Dashboard
    SUPABASE_URL = "https://kfeztemgrbkfwaicvgnk.supabase.co"
    SUPABASE_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmZXp0ZW1ncmJrZndhaWN2Z25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMDM4NDIsImV4cCI6MjA3Njc3OTg0Mn0.n4F6v_kywu55Nj2Yx_dcZri4WsdUMaftzPl1FXT-to8"
    BUCKET_NAME = "defect-images"  # MUST match exactly
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY are required")
    
    # Initialize Supabase client
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    SUPABASE_ENABLED = True
    print("✅ Supabase initialized successfully")
    
except ImportError:
    print("⚠️  Supabase library not installed")
    print("   Fix: pip install supabase")
except Exception as e:
    print(f"⚠️  Supabase initialization failed: {e}")
    print(f"   Check your credentials and internet connection")

# Load YOLOv11 model
try:
    from ultralytics import YOLO
    print("Loading YOLO model...")
    model = YOLO("best.pt")  # Or "yolov11n.pt" for small
    print("✅ YOLO model loaded")
except Exception as e:
    print(f"⚠️  YOLO model error: {e}")
    model = None

# ============================================================================
# STORAGE UPLOAD FUNCTIONS - CORRECTED
# ============================================================================

def upload_image_to_supabase(frame, defect_type, timestamp):
    """
    Upload image to Supabase Storage - CORRECTED VERSION
    
    Returns: (public_url, image_path) or (None, None) on failure
    """
    if not SUPABASE_ENABLED:
        print("⚠️  Supabase not enabled - cannot upload")
        return None, None
    
    try:
        # Step 1: Encode frame to JPEG bytes
        success, buffer = cv2.imencode('.jpg', frame)
        if not success:
            print("⚠️  Failed to encode image")
            return None, None
        
        # Step 2: Create unique filename with proper directory structure
        # Format: defects/{type}/YYYYMMDD_HHMMSS_ffffff.jpg
        filename = f"defects/{defect_type}/{timestamp.strftime('%Y%m%d_%H%M%S_%f')}.jpg"
        
        print(f"⏳ Uploading to Supabase Storage...")
        print(f"   Bucket: {BUCKET_NAME}")
        print(f"   Path: {filename}")
        print(f"   Size: {len(buffer.tobytes())} bytes")
        
        # Step 3: Upload to storage
        # CRITICAL: Use .tobytes() NOT base64!
        response = supabase.storage.from_(BUCKET_NAME).upload(
            path=filename,
            file=buffer.tobytes(),  # ✅ CORRECT: Raw bytes
            file_options={"content-type": "image/jpeg"}
        )
        
        print(f"✅ Storage upload successful!")
        
        # Step 4: Get public URL
        try:
            public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(filename)
            print(f"   URL: {public_url}")
            return public_url, filename
        except Exception as url_error:
            print(f"⚠️  Could not generate public URL: {url_error}")
            return None, filename
            
    except Exception as e:
        error_msg = str(e)
        print(f"❌ Upload failed: {e}")
        
        # Diagnose the error
        if "404" in error_msg:
            print("   → Bucket 'defect-images' does not exist")
            print("   → Fix: Create it in Supabase Dashboard > Storage")
        elif "403" in error_msg:
            print("   → Permission denied")
            print("   → Fix: Check storage policies in Supabase Dashboard")
        elif "401" in error_msg:
            print("   → Unauthorized - check API key")
            print("   → Fix: Use Anon key from Supabase Dashboard > Settings > API")
        
        return None, None

def save_defect_to_database(defect_type, timestamp, image_url, image_path, 
                            confidence=0.0, device_id="raspberry-pi-1"):
    """
    Save defect record to Supabase Database
    
    Returns: True if successful, False otherwise
    """
    if not SUPABASE_ENABLED:
        print("⚠️  Supabase not enabled - cannot save to database")
        return False
    
    try:
        print(f"⏳ Saving defect record to database...")
        
        # Prepare data
        data = {
            "device_id": device_id,
            "defect_type": defect_type,
            "detected_at": timestamp.isoformat(),
            "image_url": image_url,  # Can be None if upload failed
            "image_path": image_path,
            "status": "pending",  # Can be: pending, reviewed, resolved
            "notes": f"Confidence: {confidence:.2%}" if confidence else None,
        }
        
        # Insert into database
        response = supabase.table("defects").insert([data]).execute()
        
        print(f"✅ Database record saved")
        print(f"   Defect type: {defect_type}")
        print(f"   Status: {data['status']}")
        print(f"   Has image: {'Yes' if image_url else 'No'}")
        
        return True
        
    except Exception as e:
        error_msg = str(e)
        print(f"❌ Database save failed: {e}")
        
        if "does not exist" in error_msg.lower():
            print("   → Table 'defects' does not exist")
            print("   → Fix: Run DATABASE_SETUP.sql in Supabase SQL Editor")
        elif "permission" in error_msg.lower():
            print("   → Permission denied")
            print("   → Fix: Check RLS policies on defects table")
        elif "policy" in error_msg.lower():
            print("   → RLS policy violation")
            print("   → Fix: Ensure policies allow inserts")
        
        return False

# ============================================================================
# TEST FUNCTIONS
# ============================================================================

def test_supabase_connection():
    """Test Supabase connectivity"""
    print("\n" + "="*70)
    print("🧪 TESTING SUPABASE CONNECTION")
    print("="*70 + "\n")
    
    if not SUPABASE_ENABLED:
        print("❌ Supabase not enabled")
        return False
    
    # Test 1: Check if bucket exists
    try:
        print("1. Checking if bucket exists...")
        bucket_client = supabase.storage.from_(BUCKET_NAME)
        files = bucket_client.list()
        print(f"   ✅ Bucket exists, contains {len(files)} files")
    except Exception as e:
        print(f"   ❌ Bucket check failed: {e}")
        return False
    
    # Test 2: Try simple upload
    try:
        print("2. Testing upload capability...")
        test_data = b"test-connection-" + datetime.now().isoformat().encode()
        test_filename = f"test/connection-{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        
        response = supabase.storage.from_(BUCKET_NAME).upload(
            path=test_filename,
            file=test_data,
            file_options={"content-type": "text/plain"}
        )
        print(f"   ✅ Upload test successful")
    except Exception as e:
        print(f"   ❌ Upload test failed: {e}")
        return False
    
    # Test 3: Try database insert
    try:
        print("3. Testing database connection...")
        test_record = supabase.table("defects").select("*", count="exact").limit(1).execute()
        print(f"   ✅ Database accessible")
    except Exception as e:
        print(f"   ❌ Database test failed: {e}")
        return False
    
    print("\n✅ All tests passed! Supabase is ready.\n")
    return True

def test_with_sample_image():
    """Test with a sample image"""
    print("\n" + "="*70)
    print("📸 TESTING WITH SAMPLE IMAGE")
    print("="*70 + "\n")
    
    # Try to find a sample image
    sample_images = [
        "test_frame.jpg",
        "sample.jpg",
        "defect.jpg",
    ]
    
    sample_image = None
    for img_path in sample_images:
        if os.path.exists(img_path):
            sample_image = cv2.imread(img_path)
            if sample_image is not None:
                print(f"Found sample image: {img_path}")
                break
    
    if sample_image is None:
        print("⚠️  No sample image found")
        print("   Creating blank test image...")
        sample_image = cv2.imread("blank.jpg") if os.path.exists("blank.jpg") else cv2.Mat()
        if sample_image.empty():
            sample_image = 255 * cv2.ones((480, 640, 3), dtype=cv2.uint8)
            cv2.imwrite("blank.jpg", sample_image)
            print("   Created blank.jpg")
    
    # Try to upload
    print("\nAttempting upload...")
    timestamp = datetime.now()
    url, path = upload_image_to_supabase(sample_image, "test", timestamp)
    
    if url:
        print(f"✅ Upload successful!")
        print(f"   URL: {url}")
        
        # Try to save to database
        print("\nAttempting database save...")
        success = save_defect_to_database("test", timestamp, url, path, 0.95)
        if success:
            print("✅ Database save successful!")
        else:
            print("❌ Database save failed")
    else:
        print("❌ Upload failed")

# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    print("\n" + "="*70)
    print("🔧 SUPABASE UPLOAD TESTER")
    print("="*70)
    
    # Check connection
    if not test_supabase_connection():
        print("\n❌ Cannot proceed - Supabase connection failed")
        print("\n📋 Troubleshooting:")
        print("1. Check internet connection")
        print("2. Verify SUPABASE_URL and SUPABASE_KEY")
        print("3. Create 'defect-images' bucket in Supabase Dashboard")
        print("4. Set storage bucket policies")
        print("5. Run: python diagnose_supabase.py")
        exit(1)
    
    # Test with sample image
    test_with_sample_image()
    
    print("\n" + "="*70)
    print("✅ Testing complete!")
    print("="*70 + "\n")

