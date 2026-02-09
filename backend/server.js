try { require('dotenv').config(); } catch (_) {}

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Basic routes
app.get("/", (req, res) => {
  res.send("Backend connected successfully!");
});
app.get("/health", (_req, res) => res.json({ ok: true }));

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

// WebRTC signaling for Raspberry Pi streaming
try {
  const registerWebRTC = require('./webrtc-handler')
  registerWebRTC(app)
} catch (e) {
  console.warn('[SERVER] WebRTC handler not loaded:', e?.message || e)
}



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
      // Create new app instance and try next port
      const newApp = express();
      const newServer = require('http').createServer(newApp);
      const server = newServer;
      startServer(port + 1, attempt + 1);
    } else {
      console.error('[SERVER] ❌ failed to start:', err.message);
      process.exit(1);
    }
  };

  const http = require('http');
  const server = http.createServer(app);
  server.once('error', onError);
  server.listen(port, onListening);
}

if (require.main === module) {
  startServer(basePort);
}

module.exports = { app };