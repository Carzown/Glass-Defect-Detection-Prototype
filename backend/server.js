try { require('dotenv').config(); } catch (_) {}

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { 
    origin: "*",
    methods: ["GET", "POST"],
    credentials: false
  },
  maxHttpBufferSize: 10 * 1024 * 1024, // allow larger binary/base64 frames (~10MB)
  transports: ['websocket', 'polling'], // Support both websocket and polling
  pingInterval: 25000,
  pingTimeout: 60000,
});

// Log Socket.IO connection events
io.on('connection', (socket) => {
  console.log('[Socket.IO] Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('[Socket.IO] Client disconnected:', socket.id);
  });
});

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Basic routes
app.get("/", (req, res) => {
  res.send("Backend connected successfully!");
});
app.get("/health", (_req, res) => res.json({ ok: true }));

// Register Raspberry Pi/device streaming/socket relays
require("./device-handler")(io);

// Admin API (list users, change passwords) protected by x-admin-token
try {
  const adminRouter = require('./admin')
  app.use('/admin', adminRouter)
} catch (e) {
  console.warn('Admin routes not loaded:', e?.message || e)
}

// Defects API for glass defect management
try {
  const defectsRouter = require('./defects')
  app.use('/defects', defectsRouter)
  console.log('[SERVER] Defects API routes loaded')
} catch (e) {
  console.warn('[SERVER] Defects routes not loaded:', e?.message || e)
}

// Utility: enumerate connected devices based on socket.data.role/deviceId
function getConnectedDevices() {
  const groups = new Map();
  for (const [sid, socket] of io.sockets.sockets) {
    if (socket?.data?.role === "device" || socket?.data?.role === "jetson") {
      const devId = socket.data.deviceId || "unknown";
      const entry = groups.get(devId) || { deviceId: devId, socketIds: [] };
      entry.socketIds.push(sid);
      groups.set(devId, entry);
    }
  }
  const devices = Array.from(groups.values()).map((e) => ({
    deviceId: e.deviceId,
    online: true,
    socketCount: e.socketIds.length,
    socketIds: e.socketIds,
  }));
  return { total: devices.length, devices };
}

// HTTP endpoints to verify device connectivity
app.get("/devices", (_req, res) => {
  const summary = getConnectedDevices();
  res.json(summary);
});

app.get("/devices/:deviceId", (req, res) => {
  const { deviceId } = req.params;
  const summary = getConnectedDevices();
  const match = summary.devices.find((d) => d.deviceId === deviceId);
  res.json({ deviceId, online: !!match, socketCount: match?.socketCount || 0, socketIds: match?.socketIds || [] });
});

// Run server
let basePort = parseInt(process.env.PORT, 10) || 5000;
const maxAttempts = 10;

function startServer(port, attempt = 1) {
  const onListening = () => {
    console.log('[SERVER] ✅ listening on port ' + port);
  };

  const onError = (err) => {
    if (err.code === 'EADDRINUSE' && attempt < maxAttempts) {
      console.warn('[SERVER] ⚠️  port ' + port + ' in use, trying ' + (port + 1) + '...');
      // Close this server instance and try next port
      server.close();
      startServer(port + 1, attempt + 1);
    } else {
      console.error('[SERVER] ❌ failed to start:', err.message);
      process.exit(1);
    }
  };

  server.once('error', onError);
  server.listen(port, onListening);
}

if (require.main === module) {
  startServer(basePort);
}

module.exports = { app, server, io };