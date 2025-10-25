import requests

def test_health_endpoint_backend_ready(backend_url, backend_ready):
    r = requests.get(backend_url + "/health", timeout=2)
    assert r.status_code == 200
    data = r.json()
    assert data.get("ok") is True
