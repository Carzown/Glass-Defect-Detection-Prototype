// Centralized Socket.IO event names
// Prefer `device:*` for Raspberry Pi (or any edge device). Keep legacy `jetson:*` for backwards compatibility.
module.exports = {
	// Generic device events (preferred)
	DEVICE_REGISTER: 'device:register',
	DEVICE_FRAME: 'device:frame',
	DEVICE_STATUS: 'device:status',

	// Legacy Jetson aliases (still accepted)
	JETSON_REGISTER: 'jetson:register',
	JETSON_FRAME: 'jetson:frame',
	JETSON_STATUS: 'jetson:status',

	// Dashboard control events
	DASHBOARD_START: 'dashboard:start',
	DASHBOARD_STOP: 'dashboard:stop',
	DASHBOARD_PAUSE: 'dashboard:pause',
	DASHBOARD_RESUME: 'dashboard:resume',

	// Client identification
	CLIENT_HELLO: 'client:hello',

	// Broadcast stream to dashboards
	STREAM_FRAME: 'stream:frame',
};

