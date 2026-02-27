try { require('dotenv').config(); } catch (_) {}

const express = require("express");
const cors = require("cors");

const app = express();

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

app.get("/test/supabase", async (req, res) => {
  try {
    
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
    
    try {
      const client = createClient(supabaseUrl, supabaseKey);
      results.tests.clientCreation = { success: true };
    } catch (e) {
      results.tests.clientCreation = { success: false, error: e.message };
    }
    
    try {
      const client = createClient(supabaseUrl, supabaseKey);
      const { data, error } = await client.auth.getSession();
      results.tests.authSession = error ? { success: false, error: error.message } : { success: true, hasSession: !!data.session };
    } catch (e) {
      results.tests.authSession = { success: false, error: e.message };
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

app.post("/api/device/register", (req, res) => {
  const deviceId = req.headers['x-device-id'] || req.body?.device_id || 'unknown-' + Date.now();
  
  res.json({
    success: true,
    device_id: deviceId,
    message: 'Device registered (streaming disabled)',
    timestamp: new Date().toISOString()
  });
});

// Defects API routes
try {
  const defectsRouter = require('./defects')
  app.use('/defects', defectsRouter)
  console.log('[SERVER] Defects API routes loaded')
} catch (e) {
  console.warn('[SERVER] Defects routes not loaded:', e?.message || e)
}

// Defect tagger - auto-tags and overlays numbered badges on images
try {
  const tagger = require('./defect-tagger')
  tagger.start()
} catch (e) {
  console.warn('[SERVER] Defect tagger not started:', e?.message || e)
}

// Serve static files from the built frontend
const path = require('path');
const frontendBuildPath = path.join(__dirname, '../Frontend/build');
try {
  app.use(express.static(frontendBuildPath));
  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    // If it's not an API route, serve the React app
    if (!req.path.startsWith('/api') && !req.path.startsWith('/defects')) {
      res.sendFile(path.join(frontendBuildPath, 'index.html'));
    }
  });
  console.log('[SERVER] Serving frontend from:', frontendBuildPath);
} catch (e) {
  console.warn('[SERVER] Frontend static files not available:', e?.message || e);
}

let basePort = parseInt(process.env.PORT, 10) || 5000;
const maxAttempts = 10;

function startServer(port, attempt = 1) {
  const onListening = () => {
    console.log('[SERVER] ✅ Listening on port ' + port);
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
