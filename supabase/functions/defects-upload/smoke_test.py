#!/usr/bin/env python3
"""
Quick smoke test for the Supabase Edge Function `defects-upload`.
Requires: pip install requests

Usage (PowerShell):
  $env:FUNCTION_URL="https://<project-ref>.functions.supabase.co/defects-upload"
  $env:DEVICE_TOKEN="<DEVICE_INGEST_TOKEN>"
  $env:DEVICE_ID="cam-1"
  $env:IMAGE_PATH="c:/path/to/sample.jpg"
  python smoke_test.py

If successful, prints the inserted defect row.
"""
import os, requests

FUNCTION_URL = os.getenv("FUNCTION_URL")
DEVICE_TOKEN = os.getenv("DEVICE_TOKEN")
DEVICE_ID    = os.getenv("DEVICE_ID", "cam-1")
IMAGE_PATH   = os.getenv("IMAGE_PATH")

def main():
    if not FUNCTION_URL or not DEVICE_TOKEN or not IMAGE_PATH:
        raise SystemExit("Set FUNCTION_URL, DEVICE_TOKEN, and IMAGE_PATH env vars first")

    with open(IMAGE_PATH, "rb") as f:
        files = { "file": (os.path.basename(IMAGE_PATH), f, "image/jpeg") }
        data = { "defect_type": "Crack", "device_id": DEVICE_ID, "time_text": "[12:00:00]" }
        headers = { "x-device-token": DEVICE_TOKEN }
        resp = requests.post(FUNCTION_URL, files=files, data=data, headers=headers, timeout=30)
        try:
            js = resp.json()
        except Exception:
            js = {"error": f"non-json: {resp.text[:200]}"}
        print("HTTP", resp.status_code, js)
        if not resp.ok or not js.get("ok"):
            raise SystemExit("Smoke test failed")

if __name__ == "__main__":
    main()
