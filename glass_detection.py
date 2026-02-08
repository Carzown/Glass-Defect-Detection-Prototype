import cv2
import time
import os
import base64
from datetime import datetime
from picamera2 import Picamera2
from ultralytics import YOLO
from socketio import Client as SocketClient

# Supabase setup
try:
    from supabase import create_client, Client
    SUPABASE_URL = "https://kfeztemgrbkfwaicvgnk.supabase.co"
    SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmZXp0ZW1ncmJrZndhaWN2Z25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMDM4NDIsImV4cCI6MjA3Njc3OTg0Mn0.n4F6v_kywu55Nj2Yx_dcZri4WsdUMaftzPl1FXT-to8"
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY environment variables are required")
    
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    SUPABASE_ENABLED = True
    print("✅ Supabase initialized")
except Exception as e:
    print(f"⚠️ Supabase initialization failed: {e}")
    SUPABASE_ENABLED = False
    supabase = None

# Socket.IO client setup
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3000")
sio = SocketClient()

@sio.event
def connect():
    print(f"✅ Connected to backend at {BACKEND_URL}")
    sio.emit("client:hello", {"role": "device", "deviceId": "raspberry-pi-1"})

@sio.event
def disconnect():
    print("❌ Disconnected from backend")

def upload_image_to_supabase(frame, defect_type, timestamp):
    """Upload image to Supabase Storage and return the public URL"""
    try:
        if not SUPABASE_ENABLED:
            return None, None
        
        # Encode frame to JPEG
        _, buffer = cv2.imencode('.jpg', frame)
        image_data = base64.b64encode(buffer).decode('utf-8')
        
        # Create unique filename with device prefix
        filename = f"defects/{defect_type}/{timestamp.strftime('%Y%m%d_%H%M%S_%f')}.jpg"
        
        try:
            # Upload to Supabase Storage bucket named 'defect-images'
            supabase.storage.from_('defect-images').upload(
                filename,
                base64.b64decode(image_data),
                {"content-type": "image/jpeg"}
            )
            
            # Get public URL
            public_url = supabase.storage.from_('defect-images').get_public_url(filename)
            print(f"✅ Image uploaded: {filename}")
            return public_url, filename
        except Exception as upload_error:
            print(f"⚠️ Image upload failed: {upload_error}")
            # Return None to indicate upload failure, but don't stop processing
            return None, None
            
    except Exception as e:
        print(f"❌ Error in upload function: {e}")
        return None, None

def save_defect_to_supabase(defect_type, timestamp, image_url, image_path, confidence=0.0, device_id="raspberry-pi-1"):
    """Save defect record to Supabase database (image URL is optional)"""
    try:
        if not SUPABASE_ENABLED:
            print("❌ Supabase not enabled - cannot save defect")
            return False
        
        data = {
            "device_id": device_id,
            "defect_type": defect_type,
            "detected_at": timestamp.isoformat(),
            "image_url": image_url,  # Can be None if upload failed
            "image_path": image_path,
            "status": "pending",  # Can be: pending, reviewed, resolved
            "notes": f"Confidence: {confidence:.2%}" if confidence else None,
        }
        
        try:
            supabase.table("defects").insert([data]).execute()
            print(f"✅ Defect saved to database: {defect_type} at {timestamp}")
            print(f"   Image URL: {image_url if image_url else '(No image)'}")
            return True
        except Exception as db_error:
            print(f"❌ Database save failed: {db_error}")
            return False
            
    except Exception as e:
        print(f"❌ Error in save function: {e}")
        return False

def emit_camera_frame_to_dashboard(frame, timestamp, device_id="raspberry-pi-1", defects=None):
    """
    Stream camera frame to backend for live preview on website.
    This is the PRIMARY way to show live camera detection on the website.
    """
    try:
        if not sio.connected:
            return  # Silent fail - not critical
        
        # Encode frame to base64
        _, buffer = cv2.imencode('.jpg', frame)
        image_data = base64.b64encode(buffer).decode('utf-8')
        
        # Send to backend with correct event name and format
        payload = {
            "image": image_data,  # Base64 encoded JPEG
            "mime": "image/jpeg",
            "time": timestamp.isoformat(),
            "deviceId": device_id,
            "defects": defects or [],  # Array of detected defect metadata
        }
        
        sio.emit("device:frame", payload)
    except Exception as e:
        # Silent fail - camera streaming is optional bonus
        pass

# Load YOLOv11-small segmentation model
model = YOLO("best.pt")

# Initialize Picamera2
picam2 = Picamera2()

config = picam2.create_preview_configuration(
    main={"size": (640, 480), "format": "RGB888"}
)

picam2.configure(config)
picam2.start()

time.sleep(2)  # Camera warm-up

# Connect to backend (optional - logging only if needed)
if os.getenv("BACKEND_URL"):
    try:
        print("\n⏱️  Connecting to backend for optional real-time notifications...")
        sio.connect(BACKEND_URL, transports=['websocket'], wait_timeout=3)
        time.sleep(0.5)
        print("✅ Connected to backend (optional)")
    except Exception as e:
        print(f"⚠️  Could not connect to backend (non-critical): {e}")
        print("   Detection will continue - Supabase is primary source\n")
else:
    print("⏭️  Backend URL not set - skipping Socket.IO connection (Supabase is primary)\n")

print("YOLOv11 segmentation running. Press 'q' to quit.")
print("Sending defects to Supabase database in real-time...\n")
print("=" * 60)

try:
    while True:
        frame = picam2.capture_array()

        # Run segmentation
        results = model(frame, conf=0.25, device="cpu")
        annotated = results[0].plot()

        # Collect all defects from this frame for broadcasting
        frame_defects = []

        # Check for detected defects
        if len(results[0].boxes) > 0:
            timestamp = datetime.now()
            
            # Extract defect information for each detection
            for box in results[0].boxes:
                class_id = int(box.cls[0])
                confidence = float(box.conf[0])
                defect_type = model.names[class_id] if class_id < len(model.names) else f"Defect_{class_id}"
                
                print(f"\n🔴 DEFECT DETECTED: {defect_type}")
                print(f"   Confidence: {confidence:.2%}")
                print(f"   Timestamp: {timestamp.strftime('%Y-%m-%d %H:%M:%S.%f')}")
                
                # Step 1: Try to upload image to Supabase Storage
                image_url = None
                image_path = None
                if SUPABASE_ENABLED:
                    image_url, image_path = upload_image_to_supabase(frame, defect_type, timestamp)
                
                # Step 2: ALWAYS save defect to database (with or without image)
                # This is the PRIMARY way the website gets notifications
                save_defect_to_supabase(defect_type, timestamp, image_url, image_path, confidence=confidence)
                
                # Collect defect info for frame broadcast
                frame_defects.append({
                    "type": defect_type,
                    "confidence": f"{confidence:.2%}",
                    "image_url": image_url,
                })

        # Step 4: ALWAYS send annotated camera frame to backend for live preview
        # This is how the website sees the live camera feed in real-time
        timestamp = datetime.now()
        emit_camera_frame_to_dashboard(annotated, timestamp, defects=frame_defects)

        cv2.imshow("YOLOv11 Segmentation (HQ Camera)", annotated)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

except KeyboardInterrupt:
    print("\n\n⏹️  Detection stopped by user")
finally:
    picam2.stop()
    cv2.destroyAllWindows()
    if sio.connected:
        try:
            sio.disconnect()
        except:
            pass
    print("📴 Cleanup complete - goodbye!")
    print("=" * 60)
