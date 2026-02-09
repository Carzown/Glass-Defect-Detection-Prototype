#!/usr/bin/env python3
"""Backend connectivity check script.

Checks:
1. TCP port reachability
2. HTTP GET / (or specified path) status
3. WebRTC signaling endpoints

Usage:
    python scripts/check_backend.py --url http://<host>:5000 [--path /]

Environment overrides:
    BACKEND_URL, CHECK_PATH

Exit codes:
    0 = all requested checks passed
    1 = TCP failure
    2 = HTTP failure
"""

from __future__ import annotations

import argparse
import os
import sys
import socket
import time
from urllib.parse import urlparse

try:  # optional imports
    import requests  # type: ignore
except Exception:
    requests = None  # type: ignore


def tcp_check(host: str, port: int, timeout: float = 3.0) -> bool:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(timeout)
    try:
        s.connect((host, port))
        return True
    except Exception as e:
        print(f"[TCP] Fail: {e}")
        return False
    finally:
        try:
            s.close()
        except Exception:
            pass


def http_check(base_url: str, path: str = "/", timeout: float = 4.0) -> bool:
    if requests is None:
        print("[HTTP] 'requests' not installed; skipping HTTP check")
        return True  # don't fail purely due to missing dependency
    url = base_url.rstrip("/") + path
    try:
        r = requests.get(url, timeout=timeout)
        print(f"[HTTP] GET {url} -> {r.status_code}")
        return r.status_code < 500
    except Exception as e:
        print(f"[HTTP] Fail: {e}")
        return False


def webrtc_signaling_check(base_url: str, timeout: float = 6.0) -> bool:
    """Check if WebRTC signaling endpoints are available"""
    if requests is None:
        print("[WebRTC] requests not installed; skipping WebRTC check")
        return True

    try:
        # Check for WebRTC status endpoint
        resp = requests.get(
            f"{base_url}/webrtc/status/test",
            timeout=timeout
        )
        if resp.status_code in [200, 400]:  # 400 is ok (means endpoint exists but device not connected)
            print(f"[WebRTC] OK: Signaling endpoints available at {base_url}")
            return True
        else:
            print(f"[WebRTC] Fail: Signaling endpoint returned {resp.status_code}")
            return False
    except Exception as e:
        print(f"[WebRTC] Fail: Signaling check failed: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Check backend server connectivity")
    parser.add_argument("--url", default=os.getenv("BACKEND_URL", "http://localhost:3000"), help="Base backend URL")
    parser.add_argument("--path", default=os.getenv("CHECK_PATH", "/"), help="HTTP path to probe (default /)")
    parser.add_argument("--skip-http", action="store_true", help="Skip HTTP check")
    parser.add_argument("--skip-webrtc", action="store_true", help="Skip WebRTC signaling check")
    args = parser.parse_args()

    parsed = urlparse(args.url)
    host = parsed.hostname or "localhost"
    port = parsed.port or (443 if parsed.scheme == "https" else 80)

    print(f"Target: {host}:{port} ({args.url})")

    tcp_ok = tcp_check(host, port)
    if not tcp_ok:
        print("Result: TCP FAILED")
        sys.exit(1)
    print("[TCP] OK")

    http_ok = True
    if not args.skip_http:
        http_ok = http_check(args.url, args.path)
        if not http_ok:
            print("Result: HTTP FAILED")
            sys.exit(2)

    sio_ok = True
    if not args.skip_webrtc:
        webrtc_ok = webrtc_signaling_check(args.url)
        if not webrtc_ok:
            print("Result: WEBRTC SIGNALING CHECK FAILED")
            sys.exit(3)

    print("Result: ALL CHECKS PASSED")
    sys.exit(0)


if __name__ == "__main__":
    main()
