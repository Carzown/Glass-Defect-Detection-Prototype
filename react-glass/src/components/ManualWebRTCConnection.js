// ManualWebRTCConnection.js
// Manual connection to Raspberry Pi via IP:Port input

import React, { useState, useRef } from 'react';

function ManualWebRTCConnection({ onConnected, videoRef, onError, onStatusChange }) {
  const [backendAddress, setBackendAddress] = useState('192.168.1.:5000');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const peerConnectionRef = useRef(null);

  const handleConnect = async () => {
    if (!backendAddress.trim()) {
      onError('Please enter the Raspberry Pi address (IP:Port)');
      return;
    }

    // Validate address format
    const addressParts = backendAddress.split(':');
    if (addressParts.length !== 2) {
      onError('Please enter address in format: IP:Port (e.g., 192.168.1.100:5000)');
      return;
    }

    const [ipAddr, port] = addressParts;
    if (!ipAddr.trim() || !port.trim()) {
      onError('Please enter both IP address and port');
      return;
    }

    setIsConnecting(true);
    setConnectionStatus('🔄 Connecting...');
    onStatusChange('connecting');

    try {
      const backendUrl = `http://${backendAddress}`;
      console.log('[Manual Connection] Connecting to:', backendUrl);

      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: ['stun:stun.l.google.com:19302'] },
          { urls: ['stun:stun1.l.google.com:19302'] }
        ]
      });

      // Handle incoming tracks
      pc.ontrack = (event) => {
        console.log('[Manual WebRTC] Received track:', event.track.kind);
        if (event.track.kind === 'video' && videoRef.current) {
          videoRef.current.srcObject = event.streams[0];
          setConnectionStatus('✅ Connected!');
          onStatusChange('connected');
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('[Manual WebRTC] Connection state:', pc.connectionState);
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setConnectionStatus('❌ Connection lost');
          onStatusChange('error');
          onError(`Connection ${pc.connectionState}`);
        }
      };

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      console.log('[Manual Connection] Sending offer to', backendUrl);

      // Send offer to backend (on the Raspberry Pi/local network)
      const offerResponse = await fetch(`${backendUrl}/webrtc/offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: 'raspberry-pi-1',
          offer: pc.localDescription
        })
      });

      if (!offerResponse.ok) {
        throw new Error(`Offer response: ${offerResponse.status}`);
      }

      console.log('[Manual Connection] Offer sent, waiting for answer...');

      // Wait for answer from backend
      let attempt = 0;
      const maxAttempts = 30;

      while (attempt < maxAttempts) {
        try {
          const answerResponse = await fetch(`${backendUrl}/webrtc/answer`);

          if (answerResponse.ok) {
            const answerData = await answerResponse.json();
            const piAnswer = answerData.answer;

            if (piAnswer) {
              console.log('[Manual Connection] Received answer from Raspberry Pi');

              // Set remote description
              await pc.setRemoteDescription(
                new RTCSessionDescription(piAnswer)
              );

              console.log('[Manual Connection] WebRTC connection established!');
              peerConnectionRef.current = pc;
              setConnectionStatus('✅ Connected!');
              setIsConnected(true);
              onStatusChange('connected');
              onConnected(pc);
              setIsConnecting(false);
              return;
            }
          }
        } catch (e) {
          // Still waiting for answer
          console.log(`[Manual Connection] Attempt ${attempt + 1}/${maxAttempts}...`);
        }

        attempt++;
        await new Promise(r => setTimeout(r, 1000));
      }

      throw new Error('Timeout waiting for Raspberry Pi answer');

    } catch (error) {
      console.error('[Manual Connection] Error:', error);
      setConnectionStatus(`❌ ${error.message}`);
      onStatusChange('error');
      onError(`Connection Error: ${error.message}`);
      
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setConnectionStatus('');
    setIsConnected(false);
    setBackendAddress('192.168.1.:5000');
    onStatusChange('disconnected');
  };

  return (
    <>
      {!isConnected ? (
        <div style={styles.formContainer}>
          <div style={styles.header}>
            <h3>🔌 Manual WebRTC Connection</h3>
          </div>

          <div style={styles.inputGroup}>
            <label>Backend Address (IP:Port):</label>
            <input
              type="text"
              value={backendAddress}
              onChange={(e) => setBackendAddress(e.target.value)}
              placeholder="192.168.1.100:5000"
              disabled={isConnecting}
              style={styles.input}
            />
          </div>

          <button
            onClick={handleConnect}
            disabled={isConnecting}
            style={{
              ...styles.button,
              ...styles.connectButton,
              opacity: isConnecting ? 0.5 : 1,
              cursor: isConnecting ? 'not-allowed' : 'pointer'
            }}
          >
            {isConnecting ? '🔄 Connecting...' : '🔗 Connect'}
          </button>

          {connectionStatus && (
            <div style={{
              ...styles.status,
              color: connectionStatus.includes('✅') ? '#27ae60' : 
                      connectionStatus.includes('❌') ? '#e74c3c' : '#f39c12'
            }}>
              {connectionStatus}
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}

const styles = {
  formContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f8f9fa',
    border: '2px solid #3498db',
    borderRadius: '8px',
    padding: '30px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'stretch',
    boxSizing: 'border-box'
  },
  header: {
    marginBottom: '20px',
    textAlign: 'center'
  },
  inputGroup: {
    marginBottom: '15px',
    display: 'flex',
    flexDirection: 'column'
  },
  input: {
    padding: '12px',
    border: '1px solid #bdc3c7',
    borderRadius: '4px',
    fontSize: '14px',
    marginTop: '8px',
    fontFamily: 'monospace'
  },
  button: {
    padding: '12px 15px',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  connectButton: {
    background: '#27ae60',
    color: 'white',
    marginTop: '10px'
  },
  status: {
    marginTop: '15px',
    padding: '12px',
    borderRadius: '4px',
    textAlign: 'center',
    fontWeight: 'bold',
    background: 'white',
    border: '1px solid #ecf0f1'
  },
  connectedOverlay: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    zIndex: 100
  },
  reconnectButton: {
    padding: '8px 16px',
    background: '#3498db',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer'
  }
};

export default ManualWebRTCConnection;
