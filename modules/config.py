# ============================================================================
# Configuration for Glass Defect Detection System
# ============================================================================
# Update these values for your Raspberry Pi setup

# Backend Connection (used if posting detections to Railway backend instead of directly to Supabase)
BACKEND_URL = "https://glass-defect-detection-prototype-production.up.railway.app"

# Camera Configuration
WIDTH = 768   # Frame width (Picamera2)
HEIGHT = 768  # Frame height (Picamera2)

# AI Model Configuration (Hailo)
MODEL_NAME = "yolov8m_segmentation"  # Model to use
ZOO_PATH = "/home/pi/.degirum/zoo"   # Hailo model zoo path
DEVICE_TYPE = "hailo8"                # Hailo accelerator device

# Detection Settings
MIN_CONFIDENCE = 0.5         # Minimum confidence threshold (0.0 - 1.0)
UPLOAD_COOLDOWN = 2          # Seconds between defect uploads
SPATIAL_DIST = 50            # Pixels - avoid duplicate detections nearby

# Supabase Configuration (Optional - set to empty strings to skip)
SUPABASE_URL = ""                      # Your Supabase project URL
SUPABASE_SERVICE_ROLE_KEY = ""         # Your service role key (from Supabase Settings)
BUCKET_NAME = "defects"                # Storage bucket name
