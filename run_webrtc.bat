@echo off
REM Windows batch script to run WebRTC backend
REM This script validates the environment and starts the backend server

echo.
echo ========================================
echo Glass Defect Detection - WebRTC Backend
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js found: 
node --version

REM Check if backend directory exists
if not exist "backend\" (
    echo [ERROR] backend/ directory not found
    echo Make sure you're running this from the project root directory
    pause
    exit /b 1
)

echo [OK] backend/ directory found

REM Navigate to backend
cd backend

REM Check if package.json exists
if not exist "package.json" (
    echo [ERROR] package.json not found in backend/
    pause
    exit /b 1
)

echo [OK] package.json found

REM Install dependencies if node_modules doesn't exist
if not exist "node_modules\" (
    echo.
    echo [INFO] Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed
)

echo.
echo [INFO] Starting WebRTC Backend Server...
echo.
echo When ready, the server will display:
echo "✅ listening on port 5000"
echo.
echo Then on your Raspberry Pi, run:
echo   export BACKEND_URL=http://YOUR_COMPUTER_IP:5000
echo   python3 glass_detection_webrtc.py
echo.
echo And open the dashboard in your browser:
echo   http://localhost:3000/dashboard
echo.
echo Press Ctrl+C to stop the server
echo.
echo ========================================
echo.

REM Start the server
npm start

pause
