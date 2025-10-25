import os
import time
import contextlib
import socket
import requests
import pytest

DEFAULT_URL = os.environ.get("BACKEND_URL", "http://localhost:5000")


def is_port_open(host: str, port: int, timeout: float = 0.2) -> bool:
    with contextlib.closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as sock:
        sock.settimeout(timeout)
        try:
            sock.connect((host, port))
            return True
        except Exception:
            return False


def wait_for_http_ok(url: str, timeout: float = 5.0) -> bool:
    start = time.time()
    while time.time() - start < timeout:
        try:
            r = requests.get(url + "/health", timeout=1)
            if r.status_code == 200:
                return True
        except Exception:
            pass
        time.sleep(0.2)
    return False


@pytest.fixture(scope="session")
def backend_url():
    return DEFAULT_URL


@pytest.fixture(scope="session")
def backend_ready(backend_url):
    # Quick readiness check; if not ready, mark tests to be skipped
    try:
        ok = wait_for_http_ok(backend_url, timeout=6)
    except Exception:
        ok = False
    if not ok:
        pytest.skip(f"Backend not reachable at {backend_url}. Set BACKEND_URL or start the server.")
    return True
