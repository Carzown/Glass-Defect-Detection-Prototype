// CommonJS-based backend server with Socket.IO relays for Jetson -> Dashboard live video
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

// Register Jetson streaming/socket relays
require("./jetson-handler")(io);

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
const PORT = process.env.PORT || 5000;

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
  });
}

module.exports = { app, server, io };

