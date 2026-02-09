#!/usr/bin/env python3
"""
Glass Defect Detection with WebRTC Streaming
Streams instance segmentation from Raspberry Pi to website

Run with:
  export BACKEND_URL=http://localhost:5000
  export DEVICE_ID=raspberry-pi-1
  export WEBRTC_ENABLED=true
  python glass_detection_webrtc.py
"""

import cv2
import time
import os
import asyncio
import threading
import requests
from datetime import datetime
from picamera2 import Picamera2
from ultralytics import YOLO

print("Initializing modules...")

# Import WebRTC libraries
WEBRTC_AVAILABLE = False
try:
    from av import VideoFrame
    from aiortc import RTCPeerConnection, RTCSessionDescription, RTCVideoStreamTrack
    import fractions
    WEBRTC_AVAILABLE = True
    print("✅ WebRTC libraries loaded")
except ImportError as e:
    print(f"⚠️ WebRTC not available: {e}")
    print("   Install: pip install aiortc av")

# Supabase setup
SUPABASE_ENABLED = False
supabase = None
try:
    from supabase import create_client, Client
    SUPABASE_URL = "https://kfeztemgrbkfwaicvgnk.supabase.co"
    SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmZXp0ZW1ncmJrZndhaWN2Z25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMDM4NDIsImV4cCI6MjA3Njc3OTg0Mn0.n4F6v_kywu55Nj2Yx_dcZri4WsdUMaftzPl1FXT-to8"
    
    if SUPABASE_URL and SUPABASE_KEY:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        SUPABASE_ENABLED = True
        print("✅ Supabase initialized")
except Exception as e:
    print(f"⚠️ Supabase init failed: {e}")

# Configuration
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5000").rstrip('/')
DASHBOARD_URL = os.getenv("DASHBOARD_URL", None)
DEVICE_ID = os.getenv("DEVICE_ID", "raspberry-pi-1")
WEBRTC_ENABLED = os.getenv("WEBRTC_ENABLED", "true").lower() == "true" and WEBRTC_AVAILABLE

webrtc = {
    "connected": False,
    "pc": None,
    "current_frame": None,
    "lock": threading.Lock(),
    "frame_count": 0,
}

# ============================================================================
# SUPABASE FUNCTIONS
# ============================================================================

def upload_image_to_supabase(frame, defect_type, timestamp):
    """Upload image to Supabase Storage"""
    try:
        if not SUPABASE_ENABLED:
            return None, None
        
        import base64
        
        _, buffer = cv2.imencode('.jpg', frame)
        image_data = base64.b64encode(buffer).decode('utf-8')
        filename = f"defects/{defect_type}/{timestamp.strftime('%Y%m%d_%H%M%S_%f')}.jpg"
        
        supabase.storage.from_('defect-images').upload(
            filename,
            base64.b64decode(image_data),
            {"content-type": "image/jpeg"}
        )
        
        public_url = supabase.storage.from_('defect-images').get_public_url(filename)
        print(f"✅ Image uploaded: {filename}")
        return public_url, filename
    except Exception as e:
        print(f"⚠️ Upload failed: {e}")
        return None, None

def save_defect_to_supabase(defect_type, timestamp, image_url, image_path, confidence=0.0):
    """Save defect to Supabase database"""
    try:
        if not SUPABASE_ENABLED:
            return False
        
        data = {
            "device_id": DEVICE_ID,
            "defect_type": defect_type,
            "detected_at": timestamp.isoformat(),
            "image_url": image_url,
            "image_path": image_path,
            "status": "pending",
            "notes": f"Confidence: {confidence:.2%}" if confidence else None,
        }
        
        supabase.table("defects").insert([data]).execute()
        print(f"📊 Defect saved: {defect_type} ({confidence:.2%})")
        return True
    except Exception as e:
        print(f"❌ Save failed: {e}")
        return False

# ============================================================================
# WEBRTC STREAMING
# ============================================================================

class SegmentationVideoTrack(RTCVideoStreamTrack):
    """Custom video track streaming segmentation frames"""
    
    def __init__(self):
        super().__init__()
        self.pts = 0
        self.time_base = fractions.Fraction(1, 30)  # 30 FPS
    
    async def recv(self):
        pts, time_base = self.pts, self.time_base
        self.pts += 1
        
        # Get current frame (with small delay to allow async scheduling)
        await asyncio.sleep(0.001)
        
        with webrtc["lock"]:
            frame = webrtc["current_frame"]
        
        if frame is None:
            # Black frame
            import numpy as np
            frame = np.zeros((480, 640, 3), dtype=np.uint8)
        else:
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Create video frame
        video_frame = VideoFrame.from_ndarray(frame, format="rgb24")
        video_frame.pts = pts
        video_frame.time_base = time_base
        
        return video_frame

async def setup_webrtc():
    """Initialize WebRTC connection"""
    if not WEBRTC_ENABLED:
        print("⏭️  WebRTC disabled")
        return
    
    try:
        print(f"\n🌐 WebRTC: Connecting as {DEVICE_ID}")
        print(f"   Server: {BACKEND_URL}")
        
        # Create peer connection
        pc = RTCPeerConnection()
        
        # Add video track
        pc.addTrack(SegmentationVideoTrack())
        print("✅ Video track added")
        
        # Create offer
        offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        
        # Send offer (just the SDP string, not a dict)
        print("📤 Sending offer...")
        response = requests.post(
            f"{BACKEND_URL}/webrtc/offer",
            json={"deviceId": DEVICE_ID, "offer": pc.localDescription.sdp},
            timeout=10
        )
        
        if response.status_code != 200:
            print(f"❌ Offer failed: {response.text}")
            await pc.close()
            return
        
        print("✅ Offer sent")
        
        # Wait for answer (60 second timeout)
        print("⏳ Waiting for dashboard to accept...")
        for i in range(60):
            try:
                r = requests.get(
                    f"{BACKEND_URL}/webrtc/answer",
                    params={"deviceId": DEVICE_ID},
                    timeout=5
                )
                
                if r.status_code == 200:
                    data = r.json()
                    answer_sdp = data.get("answer")  # Get answer SDP string
                    
                    if answer_sdp:
                        print("📥 Answer received!")
                        
                        # Create SessionDescription from SDP string
                        answer = RTCSessionDescription(
                            sdp=answer_sdp,
                            type="answer"
                        )
                        await pc.setRemoteDescription(answer)
                        
                        webrtc["connected"] = True
                        webrtc["pc"] = pc
                        
                        # Calculate and display dashboard link
                        from urllib.parse import urlparse
                        parsed = urlparse(BACKEND_URL)
                        dashboard_host = parsed.hostname or "localhost"
                        dashboard_link = f"http://{dashboard_host}:3000/dashboard"
                        
                        print("✨ WebRTC CONNECTED!\n")
                        print("=" * 60)
                        print("🎬 LIVE STREAM READY")
                        print("=" * 60)
                        print(f"📺 Open your browser and go to:")
                        print(f"   {dashboard_link}")
                        print(f"")
                        print(f"You should see:")
                        print(f"   ✅ Live camera feed")
                        print(f"   ✅ YOLO segmentation overlay")
                        print(f"   ✅ Real-time defect detection")
                        print("=" * 60)
                        print(f"")
                        return
            except Exception as e:
                if i % 15 == 0 and i > 0:
                    print(f"   Retry {i}/60... ({e})")
            
            if i % 10 == 0 and i > 0:
                print(f"   Still waiting ({i}s)...")
            await asyncio.sleep(1)
        
        print("❌ Timeout - dashboard didn't accept")
        await pc.close()
    
    except Exception as e:
        print(f"❌ WebRTC error: {e}")
        import traceback
        traceback.print_exc()

def update_webrtc_frame(frame):
    """Update frame being streamed"""
    try:
        with webrtc["lock"]:
            webrtc["current_frame"] = frame.copy()
            webrtc["frame_count"] += 1
    except:
        pass

# ============================================================================
# MAIN DETECTION LOOP
# ============================================================================

print("\n" + "=" * 60)

# Load model
print("Loading YOLO model...")
model = YOLO("best.pt")
print("✅ Model loaded")

# Initialize camera
print("Initializing camera...")
picam2 = Picamera2()
config = picam2.create_preview_configuration(
    main={"size": (640, 480), "format": "RGB888"}
)
picam2.configure(config)
picam2.start()
time.sleep(2)
print("✅ Camera ready")

# Start WebRTC
if WEBRTC_ENABLED:
    def run_webrtc():
        asyncio.run(setup_webrtc())
    
    threading.Thread(target=run_webrtc, daemon=True).start()
    time.sleep(2)

print("\n" + "=" * 60)
print("🚀 DETECTION RUNNING")
print(f"   Supabase: {'✅' if SUPABASE_ENABLED else '❌'}")
print(f"   WebRTC: {'✅' if WEBRTC_ENABLED else '❌'}")
if WEBRTC_ENABLED:
    from urllib.parse import urlparse
    parsed = urlparse(BACKEND_URL)
    dashboard_host = parsed.hostname or "localhost"
    dashboard_link = f"http://{dashboard_host}:3000/dashboard"
    print(f"   Dashboard: {dashboard_link}")
print("   Press 'q' to quit")
print("=" * 60 + "\n")

try:
    frame_count = 0
    defect_count = 0
    
    while True:
        frame = picam2.capture_array()
        frame_count += 1
        
        # Inference
        results = model(frame, conf=0.25, device="cpu")
        annotated = results[0].plot()
        
        # Stream via WebRTC
        if webrtc["connected"]:
            update_webrtc_frame(annotated)
        
        # Process detections
        if len(results[0].boxes) > 0:
            timestamp = datetime.now()
            
            for box in results[0].boxes:
                class_id = int(box.cls[0])
                confidence = float(box.conf[0])
                defect_type = model.names[class_id] if class_id < len(model.names) else f"Defect_{class_id}"
                defect_count += 1
                
                print(f"🔴 [{defect_count}] {defect_type} ({confidence:.2%})")
                
                # Upload image
                image_url, image_path = None, None
                if SUPABASE_ENABLED:
                    image_url, image_path = upload_image_to_supabase(frame, defect_type, timestamp)
                
                # Save to database
                save_defect_to_supabase(defect_type, timestamp, image_url, image_path, confidence)
        
        # Display
        cv2.imshow("YOLOv11 Segmentation", annotated)
        
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

except KeyboardInterrupt:
    print("\n\n⏹️  User interrupted")

finally:
    print("\nCleaning up...")
    picam2.stop()
    cv2.destroyAllWindows()
    
    # Close WebRTC
    if webrtc["pc"]:
        try:
            asyncio.run(webrtc["pc"].close())
        except:
            pass
        
        try:
            requests.delete(f"{BACKEND_URL}/webrtc/{DEVICE_ID}", timeout=5)
        except:
            pass
    
    print(f"📊 Summary:")
    print(f"   Frames: {frame_count}")
    print(f"   Defects: {defect_count}")
    print("✅ Done!")
