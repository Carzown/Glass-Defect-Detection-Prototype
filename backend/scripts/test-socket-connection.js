/**
 * Test Script: Verify Socket.IO connection and frame streaming
 * Usage: node test-socket-connection.js
 */

const io = require('socket.io-client');
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

console.log('[TEST] Socket.IO Connection Test');
console.log('[TEST] Connecting to:', BACKEND_URL);

const socket = io(BACKEND_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5
});

let frameCount = 0;
let statusCount = 0;

socket.on('connect', () => {
  console.log('[TEST] [OK] Connected to backend!');
  console.log('[TEST] Socket ID:', socket.id);
  
  // Register as dashboard
  socket.emit('client:hello', { role: 'dashboard' });
  console.log('[TEST] Sent client:hello as dashboard');
});

socket.on('stream:frame', (payload) => {
  frameCount++;
  if (frameCount === 1) {
    console.log('[TEST] [OK] Received first frame!');
    console.log('[TEST]   deviceId:', payload.deviceId);
    console.log('[TEST]   time:', payload.time);
    console.log('[TEST]   image size:', payload.dataUrl?.length, 'chars');
    console.log('[TEST]   defects:', payload.defects?.length, 'detected');
  } else if (frameCount % 30 === 0) {
    console.log('[TEST] Received', frameCount, 'frames so far...');
  }
});

socket.on('device:status', (status) => {
  statusCount++;
  console.log('[TEST] Device status update:', status);
});

socket.on('connect_error', (error) => {
  console.error('[TEST] [ERROR] Connection failed:', error.message);
});

socket.on('disconnect', (reason) => {
  console.log('[TEST] Disconnected:', reason);
  process.exit(0);
});

socket.on('error', (error) => {
  console.error('[TEST] [ERROR] Socket error:', error);
});

// Auto-exit after 30 seconds
setTimeout(() => {
  console.log('[TEST] Test complete. Received', frameCount, 'frames and', statusCount, 'status updates.');
  socket.disconnect();
  process.exit(0);
}, 30000);
