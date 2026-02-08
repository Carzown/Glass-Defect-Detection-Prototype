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
    // Identify client role
    socket.on(CLIENT_HELLO, (payload = {}) => {
      const role = (payload.role || '').toLowerCase();
      socket.data.role = role;
      if (payload.deviceId) socket.data.deviceId = String(payload.deviceId);
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
        if (!image || typeof image !== 'string') return; // ignore malformed
        const deviceId = String(payload.deviceId || socket.data.deviceId || 'unknown');
        if (process.env.DEBUG_FRAMES === '1') {
          try {
            console.log('[device:frame] from', deviceId, 'defects:', Array.isArray(defects) ? defects.length : 0);
          } catch (_) {}
        }
        const dataUrl = `data:${mime};base64,${image}`;
        const out = {
          dataUrl,
          time: typeof time === 'string' ? time : new Date().toISOString(),
          defects: Array.isArray(defects) ? defects : [],
          deviceId,
        };
        if (process.env.DEBUG_FRAMES === '1') {
          try {
            console.log('[stream:frame] broadcast to dashboards for', deviceId);
          } catch (_) {}
        }
        emitToDashboards(io, STREAM_FRAME, out);
      } catch (_) {}
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

function forEachSocket(io, fn) {
  for (const [, s] of io.sockets.sockets) fn(s);
}
