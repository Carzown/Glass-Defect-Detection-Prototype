// Socket.IO Jetson gateway
//
// Purpose
// - Accept frames from Jetson devices and broadcast to dashboards as a live preview
// - Relay dashboard control (start/stop) to Jetsons
// - Fan-out Jetson online/offline status
//
// Event contract
// Jetson -> Server:
//  - 'jetson:register' { deviceId?: string }
//  - 'jetson:frame' { image: <base64 no prefix>, mime?: 'image/jpeg'|'image/png', time?: string, defects?: Array<{ type:string, bbox?:[x,y,w,h] }> }
//  - 'jetson:status' { online: boolean, deviceId?: string }
//
// Dashboard -> Server:
//  - 'dashboard:start' { deviceId?: string } -> relayed to Jetson(s) as 'jetson:start'
//  - 'dashboard:stop'  { deviceId?: string } -> relayed to Jetson(s) as 'jetson:stop'
//
// Server -> Dashboard:
//  - 'stream:frame' { dataUrl, defects, time, deviceId } (computed dataUrl for display)
//  - 'jetson:status' { online, deviceId }

module.exports = function registerJetsonHandlers(io) {
	// Track connected Jetsons by deviceId
	const jetsons = new Map(); // deviceId -> Set<socket>

	io.on("connection", (socket) => {
		console.log("🔌 Client connected", socket.id);

		// Allow clients to identify themselves (optional)
		socket.on("client:hello", (payload = {}) => {
			socket.data.role = payload.role || "client";
			socket.data.deviceId = payload.deviceId;
			console.log(`👋 hello from ${socket.data.role} (${socket.id})`);
		});

		// Jetson registration (set role + deviceId and record connection)
		socket.on("jetson:register", (data = {}) => {
			socket.data.role = "jetson";
			socket.data.deviceId = data.deviceId || socket.data.deviceId || "jetson-1";
			console.log(`🤖 Jetson registered: ${socket.data.deviceId} (${socket.id})`);
			const set = jetsons.get(socket.data.deviceId) || new Set();
			set.add(socket);
			jetsons.set(socket.data.deviceId, set);
			io.emit("jetson:status", { online: true, deviceId: socket.data.deviceId });
		});

		// Frames from Jetson: compute dataUrl and broadcast to dashboards (except sender)
		socket.on("jetson:frame", (frame = {}) => {
			try {
				const { image, time, defects, mime } = frame;
				if (!image) return; // ignore malformed
				const ts = time || new Date().toISOString();
				const contentType = mime || "image/jpeg"; // default to jpeg
				const dataUrl = `data:${contentType};base64,${image}`;
				const payload = {
					time: ts,
					defects: Array.isArray(defects) ? defects : [],
					dataUrl,
					deviceId: socket.data.deviceId || frame.deviceId,
				};
				// Fan out to everyone except sender
				socket.broadcast.emit("stream:frame", payload);
			} catch (err) {
				console.error("Error handling jetson:frame", err);
			}
		});

		// Relay status updates
		socket.on("jetson:status", (status = {}) => {
			io.emit("jetson:status", {
				online: !!status.online,
				deviceId: socket.data.deviceId || status.deviceId,
			});
		});

		// Dashboard control: relay start/stop signals to Jetson(s)
		socket.on("dashboard:start", (payload = {}) => {
			const targetId = payload.deviceId;
			let count = 0;
			if (targetId) {
				const set = jetsons.get(targetId);
				if (set) {
					for (const js of set) { js.emit("jetson:start", { deviceId: targetId }); count++; }
				}
			} else {
				for (const [devId, set] of jetsons.entries()) {
					for (const js of set) { js.emit("jetson:start", { deviceId: devId }); count++; }
				}
			}
			console.log(`▶️ Relayed start to ${count} jetson client(s)`);
		});

		socket.on("dashboard:stop", (payload = {}) => {
			const targetId = payload.deviceId;
			let count = 0;
			if (targetId) {
				const set = jetsons.get(targetId);
				if (set) {
					for (const js of set) { js.emit("jetson:stop", { deviceId: targetId }); count++; }
				}
			} else {
				for (const [devId, set] of jetsons.entries()) {
					for (const js of set) { js.emit("jetson:stop", { deviceId: devId }); count++; }
				}
			}
			console.log(`⏹️ Relayed stop to ${count} jetson client(s)`);
		});

		// Cleanup on disconnect: remove jetson from registry and broadcast offline status
		socket.on("disconnect", () => {
			const wasJetson = socket.data.role === "jetson";
			console.log("🔌 Client disconnected", socket.id);
			if (wasJetson) {
				// remove from registry
				const set = jetsons.get(socket.data.deviceId);
				if (set) {
					set.delete(socket);
					if (set.size === 0) jetsons.delete(socket.data.deviceId);
				}
				io.emit("jetson:status", { online: false, deviceId: socket.data.deviceId });
			}
		});
	});
};

