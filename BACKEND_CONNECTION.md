# Backend WebSocket Connection Guide

## Production Backend URL
**Public Domain**: `https://glass-defect-detection-prototype.up.railway.app`
**WebSocket URL**: `wss://glass-defect-detection-prototype.up.railway.app:8080`

---

## 1. Raspberry Pi - detect_db2.py

Update line 48:
```python
BACKEND_URL = "https://glass-defect-detection-prototype.up.railway.app"  # NEW - Use public domain
```

The script will automatically convert this to:
```
wss://glass-defect-detection-prototype.up.railway.app:8080
```

---

## 2. Frontend React - react-glass/.env.production

Add these environment variables:
```env
REACT_APP_BACKEND_URL=https://glass-defect-detection-prototype.up.railway.app
REACT_APP_WS_URL=wss://glass-defect-detection-prototype.up.railway.app:8080
```

Then in your React code (src/pages/Dashboard.js):
```javascript
const WS_URL = process.env.REACT_APP_WS_URL || 'wss://glass-defect-detection-prototype.up.railway.app:8080';
const ws = new WebSocket(WS_URL);
```

---

## 3. Qt Desktop App - mainwindow.cpp

Update WebSocket connection URL:
```cpp
QString wsUrl = "wss://glass-defect-detection-prototype.up.railway.app:8080";
ws_connection = new QWebSocket();
ws_connection->open(QUrl(wsUrl));
```

---

## Why Public, Not Private?

| URL Type | Use Case | Clients |
|----------|----------|---------|
| **Public** `*.up.railway.app` | Internet access | ✅ Web browser, Raspberry Pi, Desktop app |
| **Private** `*.railway.internal` | Internal only | ❌ Can't reach from Vercel, Pi, or desktop |

---

## Quick Verification

Once you have the public domain, test it in your browser:
```
https://glass-defect-detection-prototype.up.railway.app/
```

Should respond with your backend API (or 404 if no root route).

