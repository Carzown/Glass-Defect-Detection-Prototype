

const WebSocket = require('ws');
const path = require('path');

let wss = null;
const clients = new Set();

function initializeWebSocketServer(httpServer) {
  if (wss) {
    console.warn('[REALTIME] ⚠️ WebSocket server already initialized');
    return;
  }

  try {
    wss = new WebSocket.Server({ 
      server: httpServer,
      path: '/ws/defects'
    });

    wss.on('connection', (ws) => {
      console.log('[REALTIME] 🔌 New WebSocket connection, clients:', wss.clients.size);
      clients.add(ws);

      
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to real-time defect stream',
        clientCount: wss.clients.size
      }));

      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          
          console.log('[REALTIME] 📩 Message from client:', data.type || data);
        } catch (e) {
          console.warn('[REALTIME] ⚠️ Failed to parse client message:', e.message);
        }
      });

      
      ws.on('close', () => {
        clients.delete(ws);
        console.log('[REALTIME] 🔌 Client disconnected, clients:', wss.clients.size);
      });

      
      ws.on('error', (error) => {
        console.error('[REALTIME] ❌ WebSocket error:', error.message);
        clients.delete(ws);
      });
    });

    console.log('[REALTIME] ✅ WebSocket server initialized on /ws/defects');
  } catch (error) {
    console.error('[REALTIME] ❌ Failed to initialize WebSocket server:', error);
  }
}

function broadcastNewDefect(defect) {
  if (!wss) {
    console.warn('[REALTIME] ⚠️ WebSocket server not initialized');
    return;
  }

  try {
    const message = JSON.stringify({
      type: 'new_defect',
      timestamp: new Date().toISOString(),
      data: defect
    });

    let sentCount = 0;
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        sentCount++;
      }
    });

    console.log(`[REALTIME] 📡 Broadcast new defect to ${sentCount}/${Array.from(wss.clients).length} clients`);
  } catch (error) {
    console.error('[REALTIME] ❌ Error broadcasting defect:', error);
  }
}

function broadcastDefectUpdate(defectId, updates) {
  if (!wss) {
    console.warn('[REALTIME] ⚠️ WebSocket server not initialized');
    return;
  }

  try {
    const message = JSON.stringify({
      type: 'defect_update',
      timestamp: new Date().toISOString(),
      defectId,
      updates
    });

    let sentCount = 0;
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        sentCount++;
      }
    });

    console.log(`[REALTIME] 📡 Broadcast defect update to ${sentCount}/${Array.from(wss.clients).length} clients`);
  } catch (error) {
    console.error('[REALTIME] ❌ Error broadcasting update:', error);
  }
}

function broadcastDefectDelete(defectId) {
  if (!wss) {
    console.warn('[REALTIME] ⚠️ WebSocket server not initialized');
    return;
  }

  try {
    const message = JSON.stringify({
      type: 'defect_delete',
      timestamp: new Date().toISOString(),
      defectId
    });

    let sentCount = 0;
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        sentCount++;
      }
    });

    console.log(`[REALTIME] 📡 Broadcast defect delete to ${sentCount}/${Array.from(wss.clients).length} clients`);
  } catch (error) {
    console.error('[REALTIME] ❌ Error broadcasting delete:', error);
  }
}

function broadcastDeviceStatus(status) {
  if (!wss) return;
  try {
    const message = JSON.stringify({
      type: 'device_status',
      timestamp: new Date().toISOString(),
      data: status
    });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(message);
    });
    console.log('[REALTIME] 📡 Broadcast device status');
  } catch (error) {
    console.error('[REALTIME] ❌ Error broadcasting device status:', error);
  }
}

function getClientCount() {
  return wss ? wss.clients.size : 0;
}

function close() {
  if (wss) {
    wss.close(() => {
      console.log('[REALTIME] ✋ WebSocket server closed');
    });
    wss = null;
  }
}

module.exports = {
  initializeWebSocketServer,
  broadcastNewDefect,
  broadcastDefectUpdate,
  broadcastDefectDelete,
  broadcastDeviceStatus,
  getClientCount,
  close
};
