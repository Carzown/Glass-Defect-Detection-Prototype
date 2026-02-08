// CommonJS-based backend server with Socket.IO relays for Jetson -> Dashboard live video
try { require('dotenv').config(); } catch (_) {}
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  maxHttpBufferSize: 10 * 1024 * 1024, // allow larger binary/base64 frames (~10MB)
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
  console.log('✅ Defects API routes loaded')
} catch (e) {
  console.warn('Defects routes not loaded:', e?.message || e)
}

// Utility: enumerate connected Jetsons based on socket.data.role/deviceId
function getConnectedJetsons() {
  const groups = new Map(); // deviceId -> { deviceId, socketIds: [] }
  // Iterate all connected sockets and group those marked as jetson
  for (const [sid, socket] of io.sockets.sockets) {
    if (socket?.data?.role === "jetson") {
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

// HTTP endpoints to verify Jetson connectivity
app.get("/jetsons", (_req, res) => {
  const summary = getConnectedJetsons();
  res.json(summary);
});

app.get("/jetsons/:deviceId", (req, res) => {
  const { deviceId } = req.params;
  const summary = getConnectedJetsons();
  const match = summary.devices.find((d) => d.deviceId === deviceId);
  res.json({ deviceId, online: !!match, socketCount: match?.socketCount || 0, socketIds: match?.socketIds || [] });
});

// Run server
let basePort = parseInt(process.env.PORT, 10) || 5000;
const maxAttempts = 10;

function startServer(port, attempt = 1) {
  const onListening = () => {
    console.log(`✅ Server running on port ${port}`);
  };

  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempt < maxAttempts) {
      console.warn(`Port ${port} in use, trying ${port + 1} (attempt ${attempt + 1}/${maxAttempts})`);
      startServer(port + 1, attempt + 1);
    } else {
      console.error('Server failed to start:', err);
      process.exit(1);
    }
  });

  server.listen(port, onListening);
}

if (require.main === module) {
  startServer(basePort);
}

module.exports = { app, server, io };

