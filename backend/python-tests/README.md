# Python integration tests (pytest)

This optional pytest suite validates the Node backend from Python using `requests` and `python-socketio`.

## Install dependencies

```powershell
# from this folder or repo root
python -m pip install -r backend/python-tests/requirements.txt
```

## Run

By default the tests target `http://localhost:5000`. To change:

```powershell
$env:BACKEND_URL = "http://localhost:5000"   # PowerShell
pytest backend/python-tests -q
```

Ensure the backend is running first:

```powershell
cd backend
npm start
```

## What’s covered
- GET /health returns 200 and `{ status: "ok" }`
- `jetson:register` results in a `jetson:status` broadcast with `online: true`
- `jetson:frame` is relayed to dashboards as `stream:frame` with data URL and deviceId
- Jetson disconnect broadcasts `jetson:status` with `online: false`
