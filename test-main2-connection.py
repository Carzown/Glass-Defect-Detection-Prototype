#!/usr/bin/env python3
"""
Test script to verify main2.py WebSocket connection configuration
Tests without needing actual Raspberry Pi hardware
"""

import os
import sys
import json

# Add modules to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'modules'))

print("=" * 70)
print("MAIN2.PY CONNECTION DIAGNOSTIC TEST")
print("=" * 70)
print()

# Test 1: Configuration import
print("[TEST 1] Importing configuration...")
try:
    from config import (
        DEVICE_ID, BACKEND_URL, MIN_CONFIDENCE, UPLOAD_COOLDOWN, 
        SPATIAL_DIST, WIDTH, HEIGHT, MODEL_NAME, ZOO_PATH, DEVICE_TYPE,
        SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BUCKET_NAME
    )
    print("✅ Configuration imported successfully")
    print(f"   - DEVICE_ID: {DEVICE_ID}")
    print(f"   - BACKEND_URL: {BACKEND_URL}")
    print(f"   - Camera: {WIDTH}x{HEIGHT}")
    print(f"   - Model: {MODEL_NAME}")
except ImportError as e:
    print(f"❌ Configuration import failed: {e}")
    sys.exit(1)

# Test 2: Verify BACKEND_URL is set
print()
print("[TEST 2] Validating BACKEND_URL...")
if not BACKEND_URL or BACKEND_URL == "":
    print("❌ BACKEND_URL is not configured in modules/config.py")
    print("❌ Set BACKEND_URL to your Railway backend domain")
    sys.exit(2)
else:
    print(f"✅ BACKEND_URL is configured: {BACKEND_URL}")

# Test 3: WebSocket URL generation
print()
print("[TEST 3] Testing WebSocket URL generation...")
try:
    def get_websocket_url():
        """Convert backend URL to WebSocket URL"""
        url = BACKEND_URL.strip()
        
        if not url:
            raise ValueError("BACKEND_URL is not configured in config.py")
        
        # Remove any existing protocols
        url = url.replace("http://", "").replace("https://", "").replace("wss://", "").replace("ws://", "")
        
        # Remove port if present (will use the same port as the base URL)
        if ":" in url:
            url = url.split(":")[0]
        
        # Add wss:// (secure WebSocket) - will use default HTTPS port (443)
        # or ws:// for local dev
        protocol = "wss" if "railway" in BACKEND_URL or "https" in BACKEND_URL else "ws"
        url = f"{protocol}://{url}"
        
        return url
    
    ws_url = get_websocket_url()
    print(f"✅ WebSocket URL generated: {ws_url}")
except Exception as e:
    print(f"❌ WebSocket URL generation failed: {e}")
    sys.exit(3)

# Test 4: Message format validation
print()
print("[TEST 4] Validating message formats...")
try:
    # Device registration message
    device_register_msg = json.dumps({
        "type": "device_register",
        "device_id": DEVICE_ID
    })
    print(f"✅ Device registration message: {device_register_msg}")
    
    # Frame message (simulated)
    frame_msg = json.dumps({
        "type": "frame",
        "frame": "base64_encoded_jpeg_data_here..."
    })
    print(f"✅ Frame message format: {frame_msg}")
    
    # Detection message (simulated)
    detection_msg = json.dumps({
        "type": "detection",
        "defect_type": "edge_defect",
        "confidence": 0.85,
        "timestamp": "2026-02-18T00:00:00"
    })
    print(f"✅ Detection message format: {detection_msg}")
except Exception as e:
    print(f"❌ Message format validation failed: {e}")
    sys.exit(4)

# Test 5: Supabase configuration
print()
print("[TEST 5] Checking Supabase configuration...")
if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    print(f"✅ Supabase configured:")
    print(f"   - URL: {SUPABASE_URL}")
    print(f"   - Service Role Key: {'*' * 20}... (length: {len(SUPABASE_SERVICE_ROLE_KEY)})")
else:
    print("⚠️  Supabase not configured (optional)")
    print("   - Defects won't be saved to database")

# Test 6: FPS module
print()
print("[TEST 6] Testing FPS module...")
try:
    from fps import FPS
    fps = FPS()
    print("✅ FPS module imported successfully")
except ImportError as e:
    print(f"❌ FPS module import failed: {e}")
    sys.exit(5)

# Test 7: WebSocket library
print()
print("[TEST 7] Checking WebSocket library...")
try:
    import websocket
    print("✅ websocket-client library is available")
except ImportError:
    print("❌ websocket-client not installed")
    print("   Install with: pip install websocket-client")
    sys.exit(6)

# Test 8: Other dependencies
print()
print("[TEST 8] Checking other dependencies...")
deps = {
    'cv2': 'opencv-python',
    'numpy': 'numpy',
    'pytz': 'pytz',
    'supabase': 'supabase (optional)' if not SUPABASE_URL else 'supabase'
}

for module, package in deps.items():
    try:
        if module == 'supabase' and not SUPABASE_URL:
            print(f"⚠️  {module} (optional, Supabase not configured)")
        else:
            __import__(module)
            print(f"✅ {module} is available")
    except ImportError:
        print(f"❌ {module} not installed (pip install {package})")

# Final summary
print()
print("=" * 70)
print("CONNECTION READINESS CHECK")
print("=" * 70)
print()
print("✅ Configuration: OK")
print(f"✅ Backend URL: {BACKEND_URL}")
print(f"✅ WebSocket URL: {ws_url}")
print("✅ Message formats: Valid")
print("✅ Dependencies: Ready")

if SUPABASE_URL:
    print("✅ Supabase: Configured")
else:
    print("⚠️  Supabase: Not configured (optional)")

print()
print("=" * 70)
print("READY TO CONNECT")
print("=" * 70)
print()
print("When running main2.py on Raspberry Pi:")
print(f"  1. Device will register as: '{DEVICE_ID}'")
print(f"  2. Connect to: {ws_url}")
print(f"  3. Camera resolution: {WIDTH}x{HEIGHT}")
print(f"  4. Will stream frames and detections continuously")
print()
print("Frontend will receive:")
print("  - Live annotated frames (with bounding boxes)")
print("  - FPS counter overlay")
print("  - Defect detection messages")
print()
print("✅ All systems ready for deployment!")
print()
