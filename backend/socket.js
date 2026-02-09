// Socket.IO event constants - DEPRECATED
// Socket.IO has been replaced with WebRTC streaming from Raspberry Pi
// This file is kept for backward compatibility only

module.exports = {
	// Generic device events (DEPRECATED)
	DEVICE_REGISTER: 'device:register',
	DEVICE_FRAME: 'device:frame',
	DEVICE_STATUS: 'device:status',

	// Legacy Jetson aliases (DEPRECATED)
	JETSON_REGISTER: 'jetson:register',
	JETSON_FRAME: 'jetson:frame',
	JETSON_STATUS: 'jetson:status',

	// Dashboard control events (DEPRECATED)
	DASHBOARD_START: 'dashboard:start',
	DASHBOARD_STOP: 'dashboard:stop',
	DASHBOARD_PAUSE: 'dashboard:pause',
	DASHBOARD_RESUME: 'dashboard:resume',

	// Client identification (DEPRECATED)
	CLIENT_HELLO: 'client:hello',

	// Broadcast stream to dashboards (DEPRECATED)
	STREAM_FRAME: 'stream:frame',
};


