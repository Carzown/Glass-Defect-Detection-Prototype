// Socket.IO handlers to accept frames from Jetson and broadcast to dashboard clients

/**
 * Minimal event contract
 * Jetson -> Server:
 *  - 'jetson:register' { deviceId?: string }
 *  - 'jetson:frame' { image: string(base64 JPEG/PNG without prefix), time?: string, defects?: Array<{type:string,bbox?:[number,number,number,number]}> }
 *  - 'jetson:status' { online: boolean, deviceId?: string }
 *
 * Server -> Dashboard clients:
 *  - 'stream:frame' same payload as above but with { dataUrl } computed for convenience
 *  - 'jetson:status' status fanout
 */

module.exports = function registerJetsonHandlers(io) {
	io.on("connection", (socket) => {
		console.log("🔌 Client connected", socket.id);

		// Allow clients to identify themselves (optional)
		socket.on("client:hello", (payload = {}) => {
			socket.data.role = payload.role || "client";
			socket.data.deviceId = payload.deviceId;
			console.log(`👋 hello from ${socket.data.role} (${socket.id})`);
		});

		// Jetson registration (optional)
		socket.on("jetson:register", (data = {}) => {
			socket.data.role = "jetson";
			socket.data.deviceId = data.deviceId || socket.data.deviceId || "jetson-1";
			console.log(`🤖 Jetson registered: ${socket.data.deviceId} (${socket.id})`);
			io.emit("jetson:status", { online: true, deviceId: socket.data.deviceId });
		});

		// Receive a frame from Jetson and broadcast to all dashboards
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

		socket.on("disconnect", () => {
			const wasJetson = socket.data.role === "jetson";
			console.log("🔌 Client disconnected", socket.id);
			if (wasJetson) {
				io.emit("jetson:status", { online: false, deviceId: socket.data.deviceId });
			}
		});
	});
};

