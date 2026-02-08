#!/usr/bin/env node
const { io } = require('socket.io-client');

const URL = process.env.BACKEND_URL || 'http://localhost:3000';
const DEVICE_ID = process.env.DEVICE_ID || 'test-cam';

// 1x1 PNG (transparent)
const BASE64_PNG_1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

(async () => {
  console.log(`[test] connecting to ${URL} ...`);
  const socket = io(URL, { transports: ['websocket'] });

  socket.on('connect', () => {
    console.log('[test] connected');
    socket.emit('client:hello', { role: 'device', deviceId: DEVICE_ID });
    socket.emit('device:register', { deviceId: DEVICE_ID });

    const payload = {
      image: BASE64_PNG_1x1, // base64 without prefix
      mime: 'image/png',
      time: new Date().toISOString() + 'Z',
      defects: [
        { type: 'scratch', bbox: [10, 20, 30, 40] },
        { type: 'chip', bbox: [50, 60, 25, 25] },
      ],
      deviceId: DEVICE_ID,
    };
    socket.emit('device:frame', payload);
    console.log('[test] sent device:frame');

    setTimeout(() => {
      console.log('[test] disconnecting');
      socket.disconnect();
      process.exit(0);
    }, 1000);
  });

  socket.on('connect_error', (e) => {
    console.error('[test] connect_error:', e && e.message ? e.message : e);
    if (e && e.description) console.error('[test] description:', e.description);
    if (e && e.context) console.error('[test] context:', e.context);
    process.exit(1);
  });
})();
