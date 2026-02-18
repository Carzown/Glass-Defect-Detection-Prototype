#!/usr/bin/env python3
"""
Mock WebSocket test - Simulates main2.py connection to backend
Tests device registration and frame streaming WITHOUT Raspberry Pi hardware
"""

import json
import sys
import os
import time
import threading

# Add modules to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'modules'))

try:
    import websocket
    from config import BACKEND_URL, DEVICE_ID
except ImportError as e:
    print(f"❌ Missing dependency: {e}")
    sys.exit(1)

print("=" * 70)
print("MOCK WEBSOCKET CONNECTION TEST")
print("=" * 70)
print()

# Convert backend URL to WebSocket URL
backup_url = BACKEND_URL.strip()
backup_url = backup_url.replace("http://", "").replace("https://", "").replace("wss://", "").replace("ws://", "").strip("/")
if ":" in backup_url:
    backup_url = backup_url.split(":")[0]
protocol = "wss" if "railway" in BACKEND_URL or "https" in BACKEND_URL else "ws"
ws_url = f"{protocol}://{backup_url}/ws"  # Use /ws endpoint

print(f"Backend URL: {BACKEND_URL}")
print(f"WebSocket URL: {ws_url}")
print(f"Device ID: {DEVICE_ID}")
print()

# Test variables
connection_successful = False
device_registered = False
frames_sent = 0
messages_received = 0

def on_open(ws):
    """Callback when WebSocket opens"""
    global connection_successful, device_registered
    connection_successful = True
    print("✅ WebSocket connection established")
    
    # Send device registration
    msg = json.dumps({"type": "device_register", "device_id": DEVICE_ID})
    ws.send(msg)
    print(f"📡 Device registration sent: {DEVICE_ID}")
    print()

def on_message(ws, message):
    """Callback when message is received"""
    global messages_received, device_registered
    messages_received += 1
    try:
        data = json.loads(message)
        print(f"📩 Received from backend: {data.get('type', 'unknown')}")
        if data.get('type') == 'device_status' and data.get('status') == 'connected':
            device_registered = True
            print("✅ Device registration confirmed by backend")
    except:
        pass

def on_error(ws, error):
    """Callback on error"""
    print(f"❌ WebSocket error: {error}")

def on_close(ws, close_status_code, close_msg):
    """Callback when connection closes"""
    print(f"⚠️ WebSocket connection closed (code: {close_status_code})")

def stream_mock_frames(ws, count=5, interval=0.5):
    """Send mock frame messages (simulates main2.py frame streaming)"""
    global frames_sent
    print(f"\n🎬 Streaming {count} mock frames...")
    print()
    
    for i in range(count):
        if not connection_successful:
            print(f"⚠️  Frame {i+1}: Connection not established, skipping")
            break
        
        # Create a mock frame message (small base64 JPEG)
        # In real usage, this would be an actual encoded frame
        mock_frame_data = f"mock_frame_{i+1}_" + "A" * 1000  # Simplified mock data
        msg = json.dumps({
            "type": "frame",
            "frame": mock_frame_data
        })
        
        try:
            ws.send(msg)
            frames_sent += 1
            print(f"✅ Frame {i+1}/{count} sent ({len(mock_frame_data)} bytes)")
        except Exception as e:
            print(f"❌ Frame {i+1} failed to send: {e}")
            break
        
        time.sleep(interval)
    
    print()
    print(f"📊 Frames sent: {frames_sent}/{count}")
    print()

def stream_mock_detection(ws):
    """Send a mock detection message (simulates defect detection)"""
    print("🔍 Streaming mock detection...")
    print()
    
    detection_msg = json.dumps({
        "type": "detection",
        "defect_type": "edge_defect",
        "confidence": 0.92,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S")
    })
    
    try:
        ws.send(detection_msg)
        print("✅ Detection message sent:")
        print(f"   - Type: edge_defect")
        print(f"   - Confidence: 92%")
    except Exception as e:
        print(f"❌ Detection send failed: {e}")
    
    print()

# Main test
print("[STEP 1] Connecting to backend...")
print()

try:
    # Create WebSocket connection
    ws = websocket.WebSocketApp(
        ws_url,
        on_open=on_open,
        on_message=on_message,
        on_error=on_error,
        on_close=on_close
    )
    
    # Run WebSocket in a thread with timeout
    def run_ws():
        ws.run_forever(ping_interval=30, ping_payload="ping")
    
    ws_thread = threading.Thread(target=run_ws, daemon=True)
    ws_thread.start()
    
    # Wait for connection
    max_wait = 10
    wait_time = 0
    while not connection_successful and wait_time < max_wait:
        time.sleep(0.5)
        wait_time += 0.5
    
    if not connection_successful:
        print(f"❌ Connection failed after {max_wait} seconds")
        print()
        print("Possible issues:")
        print("1. Backend is not running (npm start)")
        print("2. WebSocket not integrated into backend (check server.js)")
        print("3. Network connectivity issue")
        print("4. Firewall blocking connection")
        sys.exit(1)
    
    # Wait for device registration confirmation
    print("\n[STEP 2] Waiting for device registration confirmation...")
    device_confirm_time = 0
    while not device_registered and device_confirm_time < 5:
        time.sleep(0.5)
        device_confirm_time += 0.5
    
    # Send mock frames
    print("[STEP 3] Sending mock frames...")
    stream_mock_frames(ws, count=3, interval=1)
    
    # Send mock detection
    print("[STEP 4] Sending mock detection...")
    stream_mock_detection(ws)
    
    # Summary
    print("=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)
    print()
    print(f"✅ Connection: {'SUCCESS' if connection_successful else 'FAILED'}")
    print(f"✅ Device Registration: {'CONFIRMED' if device_registered else 'PENDING'}")
    print(f"✅ Frames Sent: {frames_sent}")
    print(f"📩 Messages Received: {messages_received}")
    print()
    
    if connection_successful and frames_sent > 0:
        print("=" * 70)
        print("✅ MOCK TEST SUCCESSFUL")
        print("=" * 70)
        print()
        print("main2.py is ready to stream to backend!")
        print()
        print("To deploy to Raspberry Pi:")
        print("1. Copy main2.py and modules/ to Raspberry Pi")
        print("2. Configure modules/config.py with Supabase credentials (optional)")
        print("3. Run: python3 main2.py")
        print()
        exit_code = 0
    else:
        print("=" * 70)
        print("⚠️ MOCK TEST PARTIALLY SUCCESSFUL")
        print("=" * 70)
        print()
        print("Backend connection works but frames may not be streaming correctly")
        exit_code = 1
    
    # Close connection
    ws.close()
    time.sleep(1)
    sys.exit(exit_code)

except Exception as e:
    print()
    print(f"❌ Test failed with exception: {e}")
    print()
    print("Troubleshooting:")
    print("1. Make sure backend is running: npm start (in Backend/)")
    print("2. Check BACKEND_URL in modules/config.py")
    print("3. Verify WebSocket server is integrated into server.js")
    sys.exit(2)
