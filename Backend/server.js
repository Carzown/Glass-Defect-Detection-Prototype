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
    'https://carzown.github.io',
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

// HTTP endpoint for devices to send frames
app.post("/api/device/frames", (req, res) => {
  const deviceId = req.headers['x-device-id'] || req.body?.device_id;
  
  if (!deviceId) {
    return res.status(400).json({ error: 'Missing device_id header or in body' });
  }
  
  res.json({
    success: true,
    device_id: deviceId,
    received_at: new Date().toISOString(),
    message: 'Frame received (streaming disabled)'
  });
});

// HTTP endpoint for devices to send detections
app.post("/api/device/detections", (req, res) => {
  const deviceId = req.headers['x-device-id'] || req.body?.device_id;
  
  if (!deviceId || !req.body?.detections) {
    return res.status(400).json({ error: 'Missing device_id or detections' });
  }
  
  const detections = req.body.detections || [];
  
  res.json({
    success: true,
    device_id: deviceId,
    received: detections.length,
    received_at: new Date().toISOString(),
    message: 'Detections received (streaming disabled - save to Supabase directly)'
  });
});

// HTTP fallback for device registration
app.post("/api/device/register", (req, res) => {
  const deviceId = req.headers['x-device-id'] || req.body?.device_id || 'unknown-' + Date.now();
  
  res.json({
    success: true,
    device_id: deviceId,
    message: 'Device registered (streaming disabled)',
    timestamp: new Date().toISOString()
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

// Defect tagger — assigns sequential tag numbers + overlays numbered badges on images
try {
  const tagger = require('./defect-tagger')
  tagger.start()
} catch (e) {
  console.warn('[SERVER] Defect tagger not started:', e?.message || e)
}

// ============================================================================
// Run server
// ============================================================================

let basePort = parseInt(process.env.PORT, 10) || 5000;
const maxAttempts = 10;

function startServer(port, attempt = 1) {
  const onListening = () => {
    console.log('[SERVER] ✅ HTTP listening on port ' + port);
    console.log('[SERVER] Running in HTTP-only mode (WebSocket/streaming disabled)');
  };

  const onError = (err) => {
    if (err.code === 'EADDRINUSE' && attempt < maxAttempts) {
      console.warn('[SERVER] ⚠️  port ' + port + ' in use, trying ' + (port + 1) + '...');
      startServer(port + 1, attempt + 1);
    } else {
      console.error('[SERVER] ❌ failed to start:', err.message);
      process.exit(1);
    }
  };

  const server = app.listen(port);
  
  server.once('error', onError);
  server.once('listening', onListening);
}

if (require.main === module) {
  startServer(basePort);
}

module.exports = { app };
