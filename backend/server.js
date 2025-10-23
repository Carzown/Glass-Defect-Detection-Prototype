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

// Run server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
