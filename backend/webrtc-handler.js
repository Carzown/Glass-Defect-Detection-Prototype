// WebRTC Signaling Server for Streaming glass detection from Raspberry Pi
// Handles offer/answer exchange and ICE candidates

const peers = new Map(); // Store peer connections by device ID

module.exports = function registerWebRTCHandler(app) {
  /**
   * POST /webrtc/offer
   * Raspberry Pi sends offer, server responds with answer
   */
  app.post('/webrtc/offer', (req, res) => {
    try {
      const { deviceId, offer, iceCandidate } = req.body;
      
      if (!deviceId || !offer) {
        return res.status(400).json({ error: 'deviceId and offer required' });
      }

      // Store the offer and device ID
      if (!peers.has(deviceId)) {
        peers.set(deviceId, {
          deviceId,
          offer: null,
          answer: null,
          iceCandidates: [],
          createdAt: Date.now(),
        });
      }

      const peer = peers.get(deviceId);
      peer.offer = offer;
      
      if (iceCandidate) {
        peer.iceCandidates.push(iceCandidate);
      }

      console.log(`[WebRTC] Offer received from ${deviceId}`);

      // Return answer (generated on client side, stored here temporarily)
      // Client will POST answer to /webrtc/answer
      res.json({
        status: 'offer_received',
        deviceId,
        message: 'Send answer to /webrtc/answer endpoint',
      });
    } catch (err) {
      console.error('[WebRTC] Offer error:', err.message);
      res.status(500).json({ error: 'Failed to process offer' });
    }
  });

  /**
   * POST /webrtc/answer
   * Raspberry Pi sends answer after receiving generated answer from client
   */
  app.post('/webrtc/answer', (req, res) => {
    try {
      const { deviceId, answer, iceCandidate } = req.body;

      if (!deviceId || !answer) {
        return res.status(400).json({ error: 'deviceId and answer required' });
      }

      const peer = peers.get(deviceId);
      if (!peer) {
        return res.status(404).json({ error: 'Peer not found' });
      }

      peer.answer = answer;
      if (iceCandidate) {
        peer.iceCandidates.push(iceCandidate);
      }

      console.log(`[WebRTC] Answer received from ${deviceId}`);

      res.json({
        status: 'answer_received',
        deviceId,
        message: 'Connection established',
      });
    } catch (err) {
      console.error('[WebRTC] Answer error:', err.message);
      res.status(500).json({ error: 'Failed to process answer' });
    }
  });

  /**
   * POST /webrtc/candidate
   * Exchange ICE candidates
   */
  app.post('/webrtc/candidate', (req, res) => {
    try {
      const { deviceId, candidate } = req.body;

      if (!deviceId || !candidate) {
        return res.status(400).json({ error: 'deviceId and candidate required' });
      }

      const peer = peers.get(deviceId);
      if (!peer) {
        return res.status(404).json({ error: 'Peer not found' });
      }

      peer.iceCandidates.push(candidate);

      console.log(`[WebRTC] ICE candidate received from ${deviceId}`);

      res.json({ status: 'candidate_received' });
    } catch (err) {
      console.error('[WebRTC] Candidate error:', err.message);
      res.status(500).json({ error: 'Failed to process candidate' });
    }
  });

  /**
   * GET /webrtc/answer
   * Dashboard client fetches the answer to complete WebRTC connection
   */
  app.get('/webrtc/answer', (req, res) => {
    try {
      const { deviceId } = req.query;

      if (!deviceId) {
        // Return all active peers
        const activePeers = Array.from(peers.values()).map(p => ({
          deviceId: p.deviceId,
          connected: !!(p.offer && p.answer),
        }));
        return res.json({ peers: activePeers });
      }

      const peer = peers.get(deviceId);
      if (!peer || !peer.answer) {
        return res.status(404).json({ error: 'Answer not available yet' });
      }

      res.json({
        deviceId,
        answer: peer.answer,
        iceCandidates: peer.iceCandidates,
      });
    } catch (err) {
      console.error('[WebRTC] Get answer error:', err.message);
      res.status(500).json({ error: 'Failed to fetch answer' });
    }
  });

  /**
   * GET /webrtc/offer
   * Dashboard client fetches the offer from Raspberry Pi
   */
  app.get('/webrtc/offer', (req, res) => {
    try {
      const { deviceId } = req.query;

      if (!deviceId) {
        return res.status(400).json({ error: 'deviceId query parameter required' });
      }

      const peer = peers.get(deviceId);
      if (!peer || !peer.offer) {
        return res.status(404).json({ error: 'Offer not available yet' });
      }

      res.json({
        deviceId,
        offer: peer.offer,
        iceCandidates: peer.iceCandidates,
      });
    } catch (err) {
      console.error('[WebRTC] Get offer error:', err.message);
      res.status(500).json({ error: 'Failed to fetch offer' });
    }
  });

  /**
   * POST /webrtc/connect
   * Dashboard client initiates connection with Raspberry Pi
   * Returns generated answer for device to use
   */
  app.post('/webrtc/connect', (req, res) => {
    try {
      const { deviceId, answer } = req.body;

      if (!deviceId) {
        return res.status(400).json({ error: 'deviceId required' });
      }

      // Create or get peer
      if (!peers.has(deviceId)) {
        peers.set(deviceId, {
          deviceId,
          offer: null,
          answer: null,
          iceCandidates: [],
          createdAt: Date.now(),
        });
      }

      const peer = peers.get(deviceId);
      if (answer) {
        peer.answer = answer;
      }

      console.log(`[WebRTC] Connection initiated for ${deviceId}`);

      res.json({
        status: 'connection_initiated',
        deviceId,
        message: 'Awaiting Raspberry Pi with WebRTC offer',
      });
    } catch (err) {
      console.error('[WebRTC] Connect error:', err.message);
      res.status(500).json({ error: 'Failed to initiate connection' });
    }
  });

  /**
   * GET /webrtc/status/:deviceId
   * Check connection status
   */
  app.get('/webrtc/status/:deviceId', (req, res) => {
    try {
      const { deviceId } = req.params;
      const peer = peers.get(deviceId);

      if (!peer) {
        return res.json({ status: 'disconnected', deviceId });
      }

      const isConnected = !!(peer.offer && peer.answer);
      res.json({
        status: isConnected ? 'connected' : 'connecting',
        deviceId,
        hasOffer: !!peer.offer,
        hasAnswer: !!peer.answer,
        iceCandidateCount: peer.iceCandidates.length,
      });
    } catch (err) {
      console.error('[WebRTC] Status error:', err.message);
      res.status(500).json({ error: 'Failed to get status' });
    }
  });

  /**
   * DELETE /webrtc/:deviceId
   * Clean up connection
   */
  app.delete('/webrtc/:deviceId', (req, res) => {
    try {
      const { deviceId } = req.params;
      const deleted = peers.delete(deviceId);

      console.log(`[WebRTC] Connection cleaned up for ${deviceId}`);

      res.json({
        status: 'cleaned',
        deviceId,
        wasConnected: deleted,
      });
    } catch (err) {
      console.error('[WebRTC] Cleanup error:', err.message);
      res.status(500).json({ error: 'Failed to cleanup' });
    }
  });

  console.log('[SERVER] WebRTC signaling endpoints loaded');
};
