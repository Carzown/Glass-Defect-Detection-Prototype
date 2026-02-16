/**
 * WebSocket Server for Glass Defect Detection
 * Relays frames and defect data between Raspberry Pi (Qt app) and Web Dashboard
 */

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.WS_PORT || 8080;

// Create HTTP server for WebSocket
const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Store current frame buffer and device connections
const deviceConnections = new Map(); // device_id -> ws connection
const webClients = new Set(); // web dashboard clients
let currentFrame = null;
let lastFrameTime = Date.now();

console.log(`[WebSocket Server] Starting on ws://0.0.0.0:${PORT}`);

wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`[Connection] New client from ${clientIp}`);
    
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
                    console.log(`[Device] ${deviceId} connected`);
                    
                    // Notify web clients
                    broadcastToWeb({
                        type: 'device_status',
                        device_id: deviceId,
                        status: 'connected'
                    });
                    return;
                } else if (message.type === 'web_client') {
                    clientType = 'web';
                    webClients.add(ws);
                    console.log(`[Web] Dashboard client connected (total: ${webClients.size})`);
                    
                    // Send current frame to new web client if available
                    if (currentFrame) {
                        ws.send(JSON.stringify({
                            type: 'frame',
                            data: currentFrame,
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
            console.error('[Error] Failed to parse message:', error.message);
        }
    });
    
    ws.on('close', () => {
        if (clientType === 'device') {
            console.log(`[Device] ${deviceId} disconnected`);
            deviceConnections.delete(deviceId);
            broadcastToWeb({
                type: 'device_status',
                device_id: deviceId,
                status: 'disconnected'
            });
        } else if (clientType === 'web') {
            webClients.delete(ws);
            console.log(`[Web] Client disconnected (total: ${webClients.size})`);
        }
    });
    
    ws.on('error', (error) => {
        console.error(`[Error] WebSocket error from ${clientType}:`, error.message);
    });
});

function handleDeviceMessage(deviceId, message) {
    const { type } = message;
    
    switch (type) {
        case 'frame':
            // Relay video frame to all web clients
            currentFrame = message.data;
            lastFrameTime = message.timestamp || Date.now();
            
            broadcastToWeb({
                type: 'frame',
                device_id: deviceId,
                data: message.data,
                timestamp: message.timestamp
            });
            break;
            
        case 'defect':
            // Relay defect data to web clients
            console.log(`[Defect] ${deviceId}: ${message.defect_type} (confidence: ${message.confidence})`);
            broadcastToWeb({
                type: 'defect',
                device_id: deviceId,
                defect_type: message.defect_type,
                timestamp: message.timestamp,
                severity: message.severity || 'medium',
                confidence: message.confidence
            });
            break;
            
        case 'status':
            // Relay status updates
            console.log(`[Status] ${deviceId}: ${message.status}`);
            broadcastToWeb({
                type: 'device_status',
                device_id: deviceId,
                status: message.status,
                timestamp: message.timestamp
            });
            break;
            
        default:
            console.log(`[Message] ${deviceId}: ${type}`);
    }
}

function handleWebMessage(message) {
    const { type, command } = message;
    
    switch (type) {
        case 'get_frame':
            // Web client requests current frame
            if (currentFrame) {
                // Already sent on connection, use polling
            }
            break;
            
        case 'get_status':
            // Web client requests device status
            const deviceStatus = {
                type: 'devices',
                devices: Array.from(deviceConnections.keys()).map(id => ({
                    id,
                    connected: true
                }))
            };
            // Response would go to specific client
            break;
            
        default:
            console.log(`[Web Message] ${type}`);
    }
}

function broadcastToWeb(message) {
    const data = JSON.stringify(message);
    let sentCount = 0;
    
    webClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
            sentCount++;
        }
    });
    
    if (sentCount > 0 && message.type !== 'frame') {
        console.log(`[Broadcast] Sent to ${sentCount} web clients`);
    }
}

// Health check endpoint
server.on('request', (req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            devices: Array.from(deviceConnections.keys()),
            webClients: webClients.size
        }));
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] WebSocket server listening on ws://0.0.0.0:${PORT}`);
    console.log(`[Server] HTTP health check available at http://0.0.0.0:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('[Server] Shutting down...');
    wss.clients.forEach((client) => {
        client.close();
    });
    server.close(() => {
        console.log('[Server] Server closed');
        process.exit(0);
    });
});
