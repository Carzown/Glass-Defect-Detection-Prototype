# Flask backend (App)

This folder contains a minimal Flask app.

## Prereqs
- Windows PowerShell
- Virtual environment created at `App/venv`
- Dependencies installed: `pip install -r App/requirements.txt`

## Start the server (PowerShell)
From the project root or the `App` folder:

```powershell
# If not already in App
cd .\App

# Activate venv (optional but recommended)
.\venv\Scripts\Activate.ps1

# Run the app
python app.py
# or
$env:FLASK_APP = "app.py"; $env:FLASK_ENV = "development"; flask run --host 0.0.0.0 --port 5000
```

Open http://localhost:5000 or http://127.0.0.1:5000. Health check: http://localhost:5000/health
