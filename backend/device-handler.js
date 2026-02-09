const {
  DEVICE_REGISTER,
  DEVICE_FRAME,
  DEVICE_STATUS,
  JETSON_REGISTER,
  JETSON_FRAME,
  JETSON_STATUS,
  CLIENT_HELLO,
  STREAM_FRAME,
} = require('./socket');

module.exports = function registerDeviceHandler(io) {
  io.on('connection', (socket) => {
    console.log('[device-handler] New socket connection:', socket.id);
    
    // Identify client role
    socket.on(CLIENT_HELLO, (payload = {}) => {
      const role = (payload.role || '').toLowerCase();
      socket.data.role = role;
      if (payload.deviceId) socket.data.deviceId = String(payload.deviceId);
      console.log(`[device-handler] Client identified: role=${role}, deviceId=${socket.data.deviceId || 'unknown'}`);
    });

    // Accept both new device:* and legacy jetson:* events
    const onRegister = (payload = {}) => {
      const deviceId = String(payload.deviceId || socket.data.deviceId || 'unknown');
      socket.data.role = socket.data.role || 'device';
      socket.data.deviceId = deviceId;
      // Notify dashboards that this device is online
      emitToDashboards(io, DEVICE_STATUS, { online: true, deviceId });
    };
    socket.on(DEVICE_REGISTER, onRegister);
    socket.on(JETSON_REGISTER, onRegister);

    const onStatus = (payload = {}) => {
      // Upstream status from device
      const deviceId = String(payload.deviceId || socket.data.deviceId || 'unknown');
      const online = !!payload.online;
      emitToDashboards(io, DEVICE_STATUS, { online, deviceId });
    };
    socket.on(DEVICE_STATUS, onStatus);
    socket.on(JETSON_STATUS, onStatus);

    const onFrame = (payload = {}) => {
      try {
        const { image, mime = 'image/jpeg', time, defects } = payload;
        if (!image || typeof image !== 'string') {
          console.warn('[device:frame] Received malformed frame (no image data)');
          return;
        }
        const deviceId = String(payload.deviceId || socket.data.deviceId || 'unknown');
        const defectCount = Array.isArray(defects) ? defects.length : 0;
        console.log(`[device:frame] Received frame from ${deviceId} with ${defectCount} defects (${Math.round(image.length / 1024)}KB)`);
        
        const dataUrl = `data:${mime};base64,${image}`;
        const out = {
          dataUrl,
          time: typeof time === 'string' ? time : new Date().toISOString(),
          defects: Array.isArray(defects) ? defects : [],
          deviceId,
        };
        
        // Broadcast to all connected dashboards
        const dashboardCount = countDashboards(io);
        console.log(`[stream:frame] Broadcasting to ${dashboardCount} dashboard(s)`);
        emitToDashboards(io, STREAM_FRAME, out);
      } catch (err) {
        console.error('[device:frame] Error processing frame:', err.message);
      }
    };
    socket.on(DEVICE_FRAME, onFrame);
    socket.on(JETSON_FRAME, onFrame);

    // Handle disconnect -> if it was a device, broadcast offline
    socket.on('disconnect', () => {
      if (socket.data?.role === 'device' || socket.data?.role === 'jetson') {
        const deviceId = socket.data.deviceId || 'unknown';
        emitToDashboards(io, DEVICE_STATUS, { online: false, deviceId });
      }
    });
  });
};

function emitToDashboards(io, event, payload) {
  forEachSocket(io, (s) => {
    if (s.data?.role === 'dashboard') {
      s.emit(event, payload);
    }
  });
}

function countDashboards(io) {
  let count = 0;
  forEachSocket(io, (s) => {
    if (s.data?.role === 'dashboard') count++;
  });
  return count;
}

function forEachSocket(io, fn) {
  for (const [, s] of io.sockets.sockets) fn(s);
}
