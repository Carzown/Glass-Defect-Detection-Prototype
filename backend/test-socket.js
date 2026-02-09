#!/usr/bin/env node
/**
 * Socket.IO Test Client
 * Tests connection to backend and frame streaming
 */

const io = require('socket.io-client');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';
console.log(`[TEST] Connecting to ${BACKEND_URL}...\n`);

const socket = io(BACKEND_URL, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
  transports: ['websocket', 'polling'],
});

let frameCount = 0;
let startTime = Date.now();

socket.on('connect', () => {
  console.log('✅ [TEST] Connected to backend');
  console.log(`   Socket ID: ${socket.id}\n`);
  
  // Identify as test client
  socket.emit('client:hello', { role: 'test-client', deviceId: 'test-device' });
  console.log('📤 [TEST] Sent client:hello event\n');
});

socket.on('disconnect', (reason) => {
  console.log(`\n⚠️  [TEST] Disconnected: ${reason}`);
  process.exit(0);
});

socket.on('connect_error', (err) => {
  console.error('❌ [TEST] Connection error:', err.message);
  console.error('   Make sure backend is running on', BACKEND_URL);
  process.exit(1);
});

socket.on('stream:frame', (payload) => {
  frameCount++;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const size = payload.dataUrl ? `${Math.round(payload.dataUrl.length / 1024)}KB` : '0KB';
  
  console.log(`📹 [TEST] Frame ${frameCount} received`);
  console.log(`   Size: ${size}`);
  console.log(`   Time: ${payload.time}`);
  console.log(`   Device: ${payload.deviceId}`);
  console.log(`   Defects: ${payload.defects?.length || 0}`);
  console.log(`   Elapsed: ${elapsed}s\n`);
});

socket.on('device:status', (status) => {
  console.log(`📊 [TEST] Device status update:`);
  console.log(`   Device: ${status.deviceId}`);
  console.log(`   Online: ${status.online}\n`);
});

// Keep alive
setTimeout(() => {
  console.log(`\n[TEST] Listening for frames... (press Ctrl+C to stop)`);
  console.log(`   Backend: ${BACKEND_URL}`);
  console.log(`   Socket ID: ${socket.id}`);
  console.log(`   Frames received: ${frameCount}\n`);
}, 2000);

process.on('SIGINT', () => {
  console.log(`\n[TEST] Summary:`);
  console.log(`   Frames received: ${frameCount}`);
  console.log(`   Duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log(`   Status: ${frameCount > 0 ? '✅ Working' : '⚠️  No frames yet (waiting for Raspberry Pi...)'}`);
  socket.disconnect();
  process.exit(0);
});
