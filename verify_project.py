#!/usr/bin/env python3
"""
Project Integrity Verification Script
Checks that all critical WebRTC streaming files are in place and correct
"""

import os
import sys
from pathlib import Path

def check_file_exists(filepath, description):
    """Check if a file exists"""
    if os.path.exists(filepath):
        size = os.path.getsize(filepath)
        print(f"  ✅ {description}: {size:,} bytes")
        return True
    else:
        print(f"  ❌ {description}: NOT FOUND")
        return False

def check_directory_exists(dirpath, description):
    """Check if a directory exists"""
    if os.path.isdir(dirpath):
        files = len(os.listdir(dirpath))
        print(f"  ✅ {description}: {files} items")
        return True
    else:
        print(f"  ❌ {description}: NOT FOUND")
        return False

def main():
    root = Path(__file__).parent
    os.chdir(root)
    
    print("=" * 60)
    print("🔍 Glass Defect Detection - Project Integrity Check")
    print("=" * 60)
    print()
    
    all_ok = True
    
    # Check critical WebRTC files
    print("📡 WebRTC Streaming Components:")
    all_ok &= check_file_exists("glass_detection_webrtc.py", "Raspberry Pi Detection Script")
    all_ok &= check_file_exists("backend/webrtc-handler.js", "Backend Signaling Server")
    all_ok &= check_file_exists("react-glass/src/pages/Dashboard.js", "React Dashboard")
    all_ok &= check_file_exists("webrtc_requirements.txt", "Python Dependencies")
    print()
    
    # Check documentation
    print("📚 Documentation:")
    all_ok &= check_file_exists("WEBRTC_QUICK_START.md", "Quick Start Guide")
    all_ok &= check_file_exists("WEBRTC_STREAMING_GUIDE.md", "Full Setup Guide")
    all_ok &= check_file_exists("DEPLOYMENT_CHECKLIST.md", "Deployment Checklist")
    all_ok &= check_file_exists(".env.webrtc.example", "Config Template")
    print()
    
    # Check helper scripts
    print("🚀 Helper Scripts:")
    all_ok &= check_file_exists("run_webrtc.sh", "Linux/Pi Startup")
    all_ok &= check_file_exists("run_webrtc.bat", "Windows Startup")
    print()
    
    # Check backend
    print("🔧 Backend Setup:")
    all_ok &= check_directory_exists("backend", "Backend Directory")
    all_ok &= check_file_exists("backend/server.js", "Express Server")
    all_ok &= check_file_exists("backend/webrtc-handler.js", "WebRTC Handler")
    all_ok &= check_file_exists("backend/defects.js", "Defect API")
    all_ok &= check_file_exists("backend/package.json", "Backend Dependencies")
    print()
    
    # Check frontend
    print("💻 Frontend Setup:")
    all_ok &= check_directory_exists("react-glass", "React App Directory")
    all_ok &= check_file_exists("react-glass/package.json", "React Dependencies")
    all_ok &= check_file_exists("react-glass/src/pages/Dashboard.js", "Dashboard Component")
    print()
    
    # Check deprecated files (should be stubs)
    print("⚠️  Deprecated Components (should be stubs, not removed):")
    all_ok &= check_file_exists("backend/socket.js", "Socket.IO Stub")
    all_ok &= check_file_exists("backend/device-handler.js", "Device Handler Stub")
    print()
    
    # Check that redundant files are removed
    print("🗑️  Cleanup Verification:")
    if not os.path.exists("backend/webrtc_streamer.py"):
        print("  ✅ backend/webrtc_streamer.py: Removed (redundant)")
    else:
        print("  ⚠️  backend/webrtc_streamer.py: Still exists (should remove)")
        all_ok = False
    print()
    
    # Summary
    print("=" * 60)
    if all_ok:
        print("✅ PROJECT STATUS: READY FOR DEPLOYMENT")
        print()
        print("Next steps:")
        print("  1. Install backend: cd backend && npm install && npm start")
        print("  2. Install frontend: cd react-glass && npm install && npm start")
        print("  3. Install Pi: pip install -r webrtc_requirements.txt")
        print("  4. Run Pi: export BACKEND_URL=http://YOUR_IP:5000 && python3 glass_detection_webrtc.py")
        print()
        print("For detailed instructions, see: WEBRTC_QUICK_START.md")
        return 0
    else:
        print("⚠️  PROJECT STATUS: SOME FILES MISSING")
        print()
        print("Please review the missing files above and ensure they exist")
        print("See CLEANUP_REPORT.md for details on what changed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
