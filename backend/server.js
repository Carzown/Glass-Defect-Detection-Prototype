import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

app.use(cors());
app.use(express.json());

// Basic route
app.get("/", (req, res) => {
  res.send("Backend connected successfully!");
});

// WebSocket setup
io.on("connection", (socket) => {
  console.log("A client connected");

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// Run server
server.listen(5000, () => {
  console.log("✅ Server running on port 5000");
});
