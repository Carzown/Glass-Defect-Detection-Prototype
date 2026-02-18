try { require('dotenv').config(); } catch (_) {}

const express = require("express");
const cors = require("cors");

const app = express();

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    process.env.FRONTEND_URL || 'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Health check and info routes
app.get("/", (req, res) => {
  res.json({ 
    message: "Backend connected successfully!",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (req, res) => {
  res.json({ 
    ok: true,
    timestamp: new Date().toISOString(),
  });
});

app.get("/health/detailed", (req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL ? '✅ SET' : '❌ MISSING';
  const supabaseKey = process.env.SUPABASE_KEY ? '✅ SET' : '❌ MISSING';
  
  res.json({
    ok: true,
    port: process.env.PORT || 5000,
    environment: process.env.NODE_ENV || 'development',
    supabase: {
      url: supabaseUrl,
      key: supabaseKey,
    },
    timestamp: new Date().toISOString(),
  });
});

// Test Supabase connection endpoint
app.get("/test/supabase", async (req, res) => {
  try {
    console.log('[TEST] Testing Supabase connection...');
    
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    
    const results = {
      timestamp: new Date().toISOString(),
      configuration: {
        url: supabaseUrl ? '✅ SET' : '❌ MISSING',
        key: supabaseKey ? '✅ SET (length: ' + supabaseKey.length + ')' : '❌ MISSING',
      },
      tests: {},
    };
    
    if (!supabaseUrl || !supabaseKey) {
      results.success = false;
      results.error = 'Missing Supabase credentials in .env';
      return res.status(400).json(results);
    }
    
    // Test 1: Create client
    try {
      const client = createClient(supabaseUrl, supabaseKey);
      results.tests.clientCreation = { success: true };
      console.log('✅ Supabase client created successfully');
    } catch (e) {
      results.tests.clientCreation = { success: false, error: e.message };
      console.error('❌ Failed to create Supabase client:', e.message);
    }
    
    // Test 2: Test auth session
    try {
      const client = createClient(supabaseUrl, supabaseKey);
      const { data, error } = await client.auth.getSession();
      if (error) {
        results.tests.authSession = { success: false, error: error.message };
        console.warn('⚠️ Auth session test:', error.message);
      } else {
        results.tests.authSession = { 
          success: true, 
          hasSession: !!data.session,
          message: data.session ? 'Session active' : 'No active session'
        };
        console.log('✅ Auth session check passed');
      }
    } catch (e) {
      results.tests.authSession = { success: false, error: e.message };
      console.warn('⚠️ Auth session exception:', e.message);
    }
    
    results.success = results.tests.clientCreation?.success || results.tests.authSession?.success;
    res.json(results);
  } catch (error) {
    console.error('[TEST] Exception during test:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Device status endpoint - shows WebSocket-connected devices
app.get("/devices/status", (req, res) => {
  const devices = Array.from(deviceConnections.keys()).map(id => ({
    device_id: id,
    status: 'connected',
    timestamp: new Date().toISOString()
  }));
  
  res.json({
    devices: devices,
    count: devices.length,
    timestamp: new Date().toISOString(),
  });
});

// Defects API for glass defect management
try {
  const defectsRouter = require('./defects')
  app.use('/defects', defectsRouter)
  console.log('[SERVER] Defects API routes loaded')
} catch (e) {
  console.warn('[SERVER] Defects routes not loaded:', e?.message || e)
}



// ============================================================================
// WebSocket Server Integration
// ============================================================================

const WebSocket = require('ws');
const http = require('http');

// Store current frame buffer and device connections
const deviceConnections = new Map(); // device_id -> ws connection
const webClients = new Set(); // web dashboard clients
let currentFrame = null;
let lastFrameTime = Date.now();

function setupWebSocketServer(httpServer) {
  // WebSocket server with origin validation
  // Use specific path /ws to avoid conflicts with Express routing
  const wss = new WebSocket.Server({ 
    server: httpServer, 
    path: '/ws',  // Use specific path, not root
    perMessageDeflate: false,  // Disable compression for faster streaming
    verifyClient: (info, callback) => {
      const origin = info.origin || info.req.headers.origin || '';
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        process.env.FRONTEND_URL || '',
        'https://Carzown.github.io'  // GitHub Pages
      ];
      
      const isAllowed = allowedOrigins.some(o => o && origin.includes(o));
      
      if (isAllowed || !origin || origin === '') {
        callback(true);
      } else {
        console.log('[WS] Blocked connection from origin:', origin);
        callback(false, 403, 'Forbidden');
      }
    }
  });

  console.log('[WebSocket] Server initialized on path /ws with origin validation');

  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`[WS Connection] New client from ${clientIp}`);
    
    let clientType = null; // 'device' or 'web'
    let deviceId = null;
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        // First message should identify the client
        if (!clientType) {
          if (message.type === 'device_register') {
            clientType = 'device';
            deviceId = message.device_id || 'unknown';
            deviceConnections.set(deviceId, ws);
            console.log(`[WS Device] ${deviceId} registered`);
            
            // Notify web clients
            broadcastToWeb({
              type: 'device_status',
              device_id: deviceId,
              status: 'connected'
            });
            return;
          } else if (message.type === 'web_client' || (message.type === 'register' && message.client_type === 'web_client')) {
            clientType = 'web';
            webClients.add(ws);
            console.log(`[WS Web] Client registered (total: ${webClients.size})`);
            
            // Send current frame to new web client if available
            if (currentFrame) {
              ws.send(JSON.stringify({
                type: 'frame',
                frame: currentFrame,
                timestamp: lastFrameTime
              }));
            }
            return;
          }
        }
        
        // Route messages based on client type
        if (clientType === 'device') {
          handleDeviceMessage(deviceId, message);
        } else if (clientType === 'web') {
          handleWebMessage(message);
        }
        
      } catch (error) {
        console.error('[WS Error] Failed to parse message:', error.message);
      }
    });
    
    ws.on('close', () => {
      if (clientType === 'device') {
        console.log(`[WS Device] ${deviceId} disconnected`);
        deviceConnections.delete(deviceId);
        broadcastToWeb({
          type: 'device_status',
          device_id: deviceId,
          status: 'disconnected'
        });
      } else if (clientType === 'web') {
        webClients.delete(ws);
        console.log(`[WS Web] Client disconnected (total: ${webClients.size})`);
      }
    });
    
    ws.on('error', (error) => {
      console.error(`[WS Error] ${clientType}:`, error.message);
    });
  });

  return wss;
}

function handleDeviceMessage(deviceId, message) {
  if (message.type === 'frame' && message.frame) {
    // Store frame buffer and broadcast to web clients
    currentFrame = message.frame;
    lastFrameTime = Date.now();
    
    broadcastToWeb({
      type: 'frame',
      frame: message.frame,
      timestamp: lastFrameTime
    });
  } else if (message.type === 'detection') {
    // Broadcast detection to web clients
    broadcastToWeb({
      type: 'detection',
      device_id: deviceId,
      defect_type: message.defect_type,
      confidence: message.confidence,
      timestamp: message.timestamp
    });
  } else if (message.type === 'ping') {
    // Respond to keepalive ping
    const device = deviceConnections.get(deviceId);
    if (device) {
      device.send(JSON.stringify({ type: 'pong' }));
    }
  }
}

function handleWebMessage(message) {
  if (message.type === 'ping') {
    // Just a keepalive, no action needed
  }
}

function broadcastToWeb(message) {
  const payload = JSON.stringify(message);
  webClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// ============================================================================
// Run server
// ============================================================================

let basePort = parseInt(process.env.PORT, 10) || 5000;
const maxAttempts = 10;

function startServer(port, attempt = 1) {
  const onListening = () => {
    console.log('[SERVER] ✅ HTTP + WebSocket listening on port ' + port);
  };

  const onError = (err) => {
    if (err.code === 'EADDRINUSE' && attempt < maxAttempts) {
      console.warn('[SERVER] ⚠️  port ' + port + ' in use, trying ' + (port + 1) + '...');
      // Try next port
      startServer(port + 1, attempt + 1);
    } else {
      console.error('[SERVER] ❌ failed to start:', err.message);
      process.exit(1);
    }
  };

  const server = http.createServer(app);
  setupWebSocketServer(server); // Initialize WebSocket on same HTTP server
  
  server.once('error', onError);
  server.listen(port, onListening);
}

if (require.main === module) {
  startServer(basePort);
}

module.exports = { app };