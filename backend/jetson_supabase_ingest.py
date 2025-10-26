"""
Jetson → Supabase secure ingestion example

Send a single defect (or loop) directly to Supabase via a secure RPC that
validates a per-device token from the HTTP headers. This avoids embedding
service keys on the device and works with RLS.

Requirements (install on device):
  pip install requests python-dotenv

Usage (PowerShell or bash):
  set SUPABASE_URL=...; set SUPABASE_ANON_KEY=...; set DEVICE_TOKEN=...; \
  python backend/jetson_supabase_ingest.py --device-id cam-1 --defect-type Scratch --image path/to.jpg

Notes:
  - The RPC name is ingest_defect as defined in the SQL setup below.
  - The website can display image_url if you send a data URL or a public HTTP URL.
"""

import argparse
import base64
import os
import sys
from typing import Optional

import requests
from requests import Response


SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
DEVICE_TOKEN = os.getenv("DEVICE_TOKEN")  # per-device secret token from Supabase device_api_keys


def image_file_to_data_url(path: str, mime: Optional[str] = None) -> str:
    if not os.path.isfile(path):
        raise FileNotFoundError(path)
    if not mime:
        ext = os.path.splitext(path)[1].lower()
        mime = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
        }.get(ext, "image/jpeg")
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    return f"data:{mime};base64,{b64}"


def call_ingest_defect(device_id: str, defect_type: str, image_url: str) -> Response:
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars")
    if not DEVICE_TOKEN:
        raise RuntimeError("Missing DEVICE_TOKEN env var (per-device secret)")

    rpc_url = SUPABASE_URL.rstrip("/") + "/rest/v1/rpc/ingest_defect"

    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Content-Type": "application/json",
        # Custom header validated within the RPC on the DB side
        "X-Device-Token": DEVICE_TOKEN,
    }
    payload = {
        "device_id": device_id,
        "defect_type": defect_type,
        "image_url": image_url,
    }
    resp = requests.post(rpc_url, headers=headers, json=payload, timeout=30)
    return resp


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--device-id", required=True)
    parser.add_argument("--defect-type", required=True, help="e.g. Scratch, Crack, Bubble")
    parser.add_argument("--image", required=True, help="Path to an image to include with the defect")
    args = parser.parse_args()

    try:
        image_url = image_file_to_data_url(args.image)
        resp = call_ingest_defect(args.device_id, args.defect_type, image_url)
        if resp.ok:
            print("Inserted defect:", resp.json())
        else:
            print("Failed to insert defect:", resp.status_code, resp.text, file=sys.stderr)
            sys.exit(1)
    except Exception as e:
        print("Error:", e, file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
