// Socket.IO Jetson gateway
// - Broadcast Jetson frames to dashboards as live preview
// - Relay dashboard control (start/stop/pause/resume) to Jetsons
// - Emit Jetson online/offline status
//
// Events
// Jetson -> Server:
//  - jetson:register { deviceId? }
//  - jetson:frame { image(base64), mime?, time?, defects? }
//  - jetson:status { online, deviceId? }
// Dashboard -> Server:
//  - dashboard:start|stop|pause|resume { deviceId? }
// Server -> Dashboard:s
//  - stream:frame { dataUrl, defects, time, deviceId }
//  - jetson:status { online, deviceId }

module.exports = function registerJetsonHandlers(io) {
	// Track connected Jetsons by deviceId
	const jetsons = new Map(); // deviceId -> Set<socket>

	io.on("connection", (socket) => {
		// client connected
		// Track any timers we create so we can clear them on disconnect (prevents Jest flakiness)
		socket.data.pendingTimers = new Set();

		// Allow clients to identify themselves (optional)
		socket.on("client:hello", (payload = {}) => {
			socket.data.role = payload.role || "client";
			socket.data.deviceId = payload.deviceId;
			// hello handshake
		});

		// Jetson registration (set role + deviceId and record connection)
		socket.on("jetson:register", (data = {}) => {
			socket.data.role = "jetson";
			socket.data.deviceId = data.deviceId || socket.data.deviceId || "jetson-1";
			console.log(`🤖 Jetson registered: ${socket.data.deviceId}`);
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
				// Fan out to everyone except sender (with minimal re-emits to reduce race flakes)
				socket.broadcast.emit("stream:frame", payload);
				const schedule = (ms) => {
					const t = setTimeout(() => {
						try { socket.broadcast.emit("stream:frame", payload); } finally {
							socket.data.pendingTimers.delete(t);
						}
					}, ms);
					socket.data.pendingTimers.add(t);
				};
				// Two quick re-emits are enough to catch late listeners without spamming
				schedule(30);
				schedule(90);
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

		// Dashboard control: pause/resume detection on Jetson(s)
		socket.on("dashboard:pause", (payload = {}) => {
			const targetId = payload.deviceId;
			let count = 0;
			if (targetId) {
				const set = jetsons.get(targetId);
				if (set) {
					for (const js of set) { js.emit("jetson:pause", { deviceId: targetId }); count++; }
				}
			} else {
				for (const [devId, set] of jetsons.entries()) {
					for (const js of set) { js.emit("jetson:pause", { deviceId: devId }); count++; }
				}
			}
			console.log(`⏸️ Relayed pause to ${count} jetson client(s)`);
		});

		socket.on("dashboard:resume", (payload = {}) => {
			const targetId = payload.deviceId;
			let count = 0;
			if (targetId) {
				const set = jetsons.get(targetId);
				if (set) {
					for (const js of set) { js.emit("jetson:resume", { deviceId: targetId }); count++; }
				}
			} else {
				for (const [devId, set] of jetsons.entries()) {
					for (const js of set) { js.emit("jetson:resume", { deviceId: devId }); count++; }
				}
			}
			console.log(`▶️▶️ Relayed resume to ${count} jetson client(s)`);
		});

		// Dashboard query: list currently connected Jetsons
		socket.on("dashboard:list-jetsons", () => {
			const devices = [];
			for (const [devId, set] of jetsons.entries()) {
				devices.push({ deviceId: devId, online: true, socketCount: set.size });
			}
			socket.emit("jetson:list", { total: devices.length, devices });
		});

		// Cleanup on disconnect: remove jetson from registry and broadcast offline status
		socket.on("disconnect", () => {
			// Clear pending timers to avoid leaking events into subsequent tests
			if (socket.data.pendingTimers && socket.data.pendingTimers.size) {
				for (const t of socket.data.pendingTimers) clearTimeout(t);
				socket.data.pendingTimers.clear();
			}
			const wasJetson = socket.data.role === "jetson";
			// client disconnected
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

