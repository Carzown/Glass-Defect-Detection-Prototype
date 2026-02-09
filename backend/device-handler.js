// Device handler - DEPRECATED
// Socket.IO device handling has been replaced with WebRTC streaming from Raspberry Pi
// This file is kept for backward compatibility only

module.exports = function registerDeviceHandler(io) {
  // No-op function - Socket.IO device handling is deprecated
  console.log('[device-handler] Socket.IO device handling is deprecated. Using WebRTC instead.');
};
