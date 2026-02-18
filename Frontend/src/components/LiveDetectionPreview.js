import React, { useState, useRef, useEffect } from 'react';
import './LiveDetectionPreview.css';

/**
 * LiveDetectionPreview Component
 * Displays live camera feed from Raspberry Pi via WebSocket
 * Shows streaming status and frame rate
 */
function LiveDetectionPreview({ 
  ws = null, 
  streamStatus = 'connecting',
  streamMessage = 'Connecting...'
}) {
  const [videoFrame, setVideoFrame] = useState(null);
  const [frameRate, setFrameRate] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const videoRef = useRef(null);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(Date.now());

  // Listen for frame messages from WebSocket
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle frame data
        if (data.type === 'frame' && data.frame) {
          // Create image data URL from base64
          const imageUrl = `data:image/jpeg;base64,${data.frame}`;
          setVideoFrame(imageUrl);

          // Calculate frame rate
          frameCountRef.current++;
          const now = Date.now();
          const elapsed = (now - lastTimeRef.current) / 1000;
          
          if (elapsed >= 1) {
            setFrameRate(Math.round(frameCountRef.current / elapsed));
            setTotalFrames(prev => prev + frameCountRef.current);
            frameCountRef.current = 0;
            lastTimeRef.current = now;
          }
        }
      } catch (e) {
        console.error('Error handling frame message:', e);
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [ws]);

  // Update video element when frame changes
  useEffect(() => {
    if (videoRef.current && videoFrame) {
      videoRef.current.src = videoFrame;
    }
  }, [videoFrame]);

  return (
    <div className="live-detection-preview">
      <div className="preview-container">
        {/* Status Indicator */}
        <div className={`status-indicator ${streamStatus}`}>
          <span className="status-dot"></span>
          <span className="status-text">
            {streamStatus === 'connected' ? '🟢 LIVE' : streamStatus === 'connecting' ? '🟡 CONNECTING' : '🔴 OFFLINE'}
          </span>
        </div>

        {/* Video Feed */}
        <div className="video-feed-wrapper">
          {videoFrame ? (
            <img 
              ref={videoRef}
              className="video-feed"
              alt="Live detection preview"
              onError={() => console.warn('Error loading frame image')}
            />
          ) : (
            <div className="video-placeholder">
              <div className="placeholder-content">
                <div className="placeholder-icon">📹</div>
                <p className="placeholder-text">{streamMessage}</p>
              </div>
            </div>
          )}
        </div>

        {/* Frame Statistics */}
        <div className="frame-stats">
          <div className="stat-item">
            <span className="stat-label">FPS:</span>
            <span className="stat-value">{frameRate.toFixed(1)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Frames:</span>
            <span className="stat-value">{totalFrames}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Status:</span>
            <span className={`stat-value status-${streamStatus}`}>
              {streamStatus.toUpperCase()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LiveDetectionPreview;
