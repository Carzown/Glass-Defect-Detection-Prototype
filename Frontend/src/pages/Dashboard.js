// Dashboard: Real-time defects from Supabase
// - Defects list comes from Supabase database polling
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ManualWebRTCConnection from '../components/ManualWebRTCConnection';
import { signOutUser } from '../supabase';
import { fetchDefects, updateDefectStatus } from '../services/defects';
import './Dashboard.css';

const DEFECT_ITEM_HEIGHT = 56;

// Helper: format Date -> [HH:MM:SS]
function formatTime(date) {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  const s = date.getSeconds().toString().padStart(2, '0');
  return `[${h}:${m}:${s}]`;
}

// Helper: capitalize first letter of defect type
function capitalizeDefectType(type) {
  if (!type) return type;
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}

function Dashboard() {
  // State
  const [currentDefects, setCurrentDefects] = useState([]);
  const [sessionStartTime, setSessionStartTime] = useState(null); // Track when dashboard loaded
  const [modalOpen, setModalOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedDefectId, setSelectedDefectId] = useState(null); // Track by ID instead of index
  const [updatingStatus, setUpdatingStatus] = useState(false); // UI state for status update
  const [cameraError, setCameraError] = useState('');
  const [streamStatus, setStreamStatus] = useState('connecting'); // 'connecting', 'connected', 'error'
  const [useManualConnection, setUseManualConnection] = useState(true); // Use manual IP connection by default
  const [showManualPanel, setShowManualPanel] = useState(true); // control visibility of manual panel
  // Connections
  const navigate = useNavigate();
  const defectsListRef = useRef(null);
  const videoRef = useRef(null);
  const peerConnectionRef = useRef(null);

  useEffect(() => {
    const role = sessionStorage.getItem('role');
    if (role === 'admin') {
      alert('Admins cannot access the Employee Dashboard. Redirecting to Admin.');
      navigate('/admin');
    }
  }, [navigate]);

  // Load initial Supabase defects and set up polling
  const loadSupabaseDefects = useCallback(async (filterAfterTime = null) => {
    try {
      // Save current scroll position before updating defects
      const scrollPos = defectsListRef.current?.scrollTop || 0;
      
      // Fetch latest defects (unlimited to get all)
      const result = await fetchDefects({ limit: 100, offset: 0 });
      const supabaseData = result.data || [];
      
      // Filter defects to only show ones detected after session start
      const timeToFilter = filterAfterTime || sessionStartTime;
      const filteredData = timeToFilter 
        ? supabaseData.filter(d => new Date(d.detected_at) >= timeToFilter)
        : supabaseData;
      
      // Convert Supabase defects to display format
      const displayDefects = filteredData.map(d => ({
        id: d.id,
        time: formatTime(new Date(d.detected_at)),
        type: capitalizeDefectType(d.defect_type),
        imageUrl: d.image_url,
        status: d.status,
        // Add full Supabase object for modal
        detected_at: d.detected_at,
        device_id: d.device_id,
        image_path: d.image_path,
        notes: d.notes,
        supabaseData: d,
      }));

      // Update the list (keep latest 20)
      setCurrentDefects(prev => {
        // Merge with existing, removing duplicates by id
        const mergedMap = new Map();
        
        // Add existing defects
        prev.forEach(d => {
          if (d.id) mergedMap.set(d.id, d);
        });
        
        // Add/update with Supabase defects
        displayDefects.forEach(d => {
          mergedMap.set(d.id, d);
        });
        
        // Convert back to array, keep latest 20
        const merged = Array.from(mergedMap.values())
          .sort((a, b) => new Date(b.detected_at || 0) - new Date(a.detected_at || 0))
          .slice(0, 20);
        
        return merged;
      });
      
      // Restore scroll position
      if (defectsListRef.current) {
        defectsListRef.current.scrollTop = scrollPos;
      }
    } catch (error) {
      console.error('Error loading Supabase defects:', error);
    }
  }, [sessionStartTime]);

  useEffect(() => {
    // Set session start time when component mounts
    const now = new Date();
    setSessionStartTime(now);
    
    // Don't load old defects on initial mount
    // Only start polling for new defects from this point forward
    const pollInterval = setInterval(() => {
      loadSupabaseDefects(now);
    }, 3000);
    
    return () => clearInterval(pollInterval);
  }, [loadSupabaseDefects]);

  // WebRTC streaming setup
  useEffect(() => {
    if (useManualConnection) {
      // Skip auto-connection, wait for manual connection
      setStreamStatus('disconnected');
      return;
    }

    const setupWebRTC = async () => {
      try {
        setStreamStatus('connecting');
        const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
        const deviceId = 'raspberry-pi-1';

        // Create peer connection
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: ['stun:stun.l.google.com:19302'] },
            { urls: ['stun:stun1.l.google.com:19302'] }
          ]
        });

        // Handle incoming tracks
        pc.ontrack = (event) => {
          console.log('[Dashboard] Received track:', event.track.kind);
          if (event.track.kind === 'video' && videoRef.current) {
            videoRef.current.srcObject = event.streams[0];
            setStreamStatus('connected');
          }
        };

        pc.onconnectionstatechange = () => {
          console.log('[Dashboard] Connection state:', pc.connectionState);
          if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
            setStreamStatus('error');
            setCameraError(`Connection ${pc.connectionState}`);
          }
        };

        // Create offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Check if backend has offer from Raspberry Pi
        console.log('[Dashboard] Checking for Raspberry Pi offer...');
        let attempt = 0;
        const maxAttempts = 30; // 30 seconds timeout

        while (attempt < maxAttempts) {
          try {
            const offerResponse = await fetch(
              `${backendUrl}/webrtc/offer?deviceId=${deviceId}`
            );

            if (offerResponse.ok) {
              const offerData = await offerResponse.json();
              const piOffer = offerData.offer;

              console.log('[Dashboard] Received offer from Raspberry Pi');

              // Set remote description
              await pc.setRemoteDescription(
                new RTCSessionDescription(piOffer)
              );

              // Send our answer
              const answerResponse = await fetch(
                `${backendUrl}/webrtc/answer`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    deviceId,
                    answer: pc.localDescription
                  })
                }
              );

              if (answerResponse.ok) {
                console.log('[Dashboard] WebRTC connection established!');
                peerConnectionRef.current = pc;
                setStreamStatus('connected');
                return;
              }
            }
          } catch (e) {
            // Still waiting for offer
          }

          attempt++;
          await new Promise(r => setTimeout(r, 1000)); // Wait 1 second before retry
        }

        console.warn('[Dashboard] Timeout waiting for Raspberry Pi offer');
        setStreamStatus('error');
        setCameraError('Timeout waiting for Raspberry Pi to connect');
        pc.close();

      } catch (error) {
        console.error('[Dashboard] WebRTC setup error:', error);
        setStreamStatus('error');
        setCameraError(`WebRTC Error: ${error.message}`);
      }
    };

    setupWebRTC();

    return () => {
      // Cleanup on unmount
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, [useManualConnection]);

  // WebSocket connection for real-time frame streaming
  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;

    const connectWebSocket = () => {
      try {
        const wsUrl = process.env.REACT_APP_WS_URL || 'wss://glass-defect-detection-prototype-production.up.railway.app:8080';
        console.log('[Dashboard] Attempting WebSocket connection to:', wsUrl);

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('[Dashboard] WebSocket connected');
          setStreamStatus('connected');
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            // Handle frame data
            if (data.type === 'frame' && data.frame) {
              // Display frame in video element if available
              if (videoRef.current && data.frame) {
                const blob = new Blob([Buffer.from(data.frame, 'base64')], { type: 'image/jpeg' });
                const url = URL.createObjectURL(blob);
                videoRef.current.src = url;
              }
            }

            // Handle defect detection
            if (data.type === 'defect' && data.defect) {
              const defect = data.defect;
              // Add to current defects list
              const newDefect = {
                id: defect.id || `ws-${Date.now()}`,
                time: formatTime(new Date()),
                type: capitalizeDefectType(defect.type || defect.defect_type || 'Unknown'),
                imageUrl: defect.image_url,
                status: 'pending',
                detected_at: new Date().toISOString(),
                confidence: defect.confidence,
              };

              setCurrentDefects(prev => [newDefect, ...prev.slice(0, 19)]);
            }

            // Handle connection status
            if (data.type === 'status') {
              console.log('[Dashboard] Server status:', data.message);
            }
          } catch (e) {
            console.error('[Dashboard] Error parsing WebSocket message:', e);
          }
        };

        ws.onerror = (error) => {
          console.error('[Dashboard] WebSocket error:', error);
          setStreamStatus('error');
          setCameraError('WebSocket connection error');
        };

        ws.onclose = () => {
          console.log('[Dashboard] WebSocket disconnected');
          setStreamStatus('disconnected');
          
          // Attempt reconnection after 3 seconds
          reconnectTimeout = setTimeout(() => {
            console.log('[Dashboard] Attempting to reconnect WebSocket...');
            connectWebSocket();
          }, 3000);
        };

      } catch (error) {
        console.error('[Dashboard] WebSocket setup error:', error);
        setStreamStatus('error');
        setCameraError(`WebSocket Error: ${error.message}`);
        
        // Retry connection after 3 seconds
        reconnectTimeout = setTimeout(() => {
          connectWebSocket();
        }, 3000);
      }
    };

    connectWebSocket();

    return () => {
      // Cleanup on unmount
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (ws) {
        ws.close();
      }
    };
  }, []);

  async function handleLogout() {
    try {
      // Sign out from Supabase
      await signOutUser();
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    // Clear session storage
    sessionStorage.removeItem('loggedIn');
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('userId');
    
    // If "Remember me" is not enabled, clear the email too
    const remembered = localStorage.getItem('rememberMe') === 'true';
    if (!remembered) {
      localStorage.removeItem('email');
    }
    
    navigate('/');
  }

  const handleStatusUpdate = async (defectId, newStatus) => {
    try {
      setUpdatingStatus(true);
      await updateDefectStatus(defectId, newStatus);
      // Update local state
      setCurrentDefects(prev => 
        prev.map(d => d.id === defectId ? { ...d, status: newStatus } : d)
      );
      alert(`Defect marked as ${newStatus}`);
      closeModal();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update defect status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'pending': return '#ff9800';
      case 'reviewed': return '#2196f3';
      case 'resolved': return '#4caf50';
      default: return '#999';
    }
  };

  function openModal(index) {
    const defect = currentDefects[index];
    if (defect && defect.id) {
      setSelectedDefectId(defect.id);
      setCurrentImageIndex(index);
      setModalOpen(true);
    }
  }

  function closeModal() {
    setModalOpen(false);
    setSelectedDefectId(null);
  }

  function nextImage() {
    setCurrentImageIndex((idx) => {
      const last = currentDefects.length - 1;
      if (idx < last) {
        const nextIdx = idx + 1;
        if (currentDefects[nextIdx]) {
          setSelectedDefectId(currentDefects[nextIdx].id);
        }
        return nextIdx;
      }
      return idx;
    });
  }

  function prevImage() {
    setCurrentImageIndex((idx) => {
      if (idx > 0) {
        const prevIdx = idx - 1;
        if (currentDefects[prevIdx]) {
          setSelectedDefectId(currentDefects[prevIdx].id);
        }
        return prevIdx;
      }
      return idx;
    });
  }

  // Sync modal index if selected defect ID is still valid
  useEffect(() => {
    if (modalOpen && selectedDefectId) {
      const foundIndex = currentDefects.findIndex(d => d.id === selectedDefectId);
      if (foundIndex !== -1 && foundIndex !== currentImageIndex) {
        setCurrentImageIndex(foundIndex);
      } else if (foundIndex === -1) {
        // Defect was removed, close modal
        closeModal();
      }
    }
  }, [currentDefects, modalOpen, selectedDefectId, currentImageIndex]);



  // Auto-scroll defects list so newest entries are visible
  useEffect(() => {
    if (defectsListRef.current) {
      defectsListRef.current.scrollTop = defectsListRef.current.scrollHeight;
    }
  }, [currentDefects]);

  return (
    <div className="machine-container">
      <Sidebar
        onLogout={handleLogout}
        mainItems={[
          { key: 'dashboard', label: 'Dashboard', onClick: () => navigate('/dashboard') },
        ]}
        bottomItems={[]}
        activeKey="dashboard"
      />

      <main className="machine-main-content">
        <header className="machine-header">
          <div className="machine-header-left">
            <h1 className="machine-header-title">Glass Defect Detector</h1>
            <p className="machine-header-subtitle">CAM-001</p>
          </div>
        </header>

        <div className="machine-content-area">
          <div className="machine-content-wrapper">
            <div className="machine-video-section">
              <h2 className="machine-section-title">Live Detection Stream</h2>

              {/* Unified Container: Shows connection form OR video stream */}
              <div className="machine-video-container">
                {/* Show connection form when manual mode and not connected */}
                {useManualConnection && streamStatus !== 'connected' ? (
                  showManualPanel ? (
                    <ManualWebRTCConnection
                      onConnected={(pc) => {
                        peerConnectionRef.current = pc;
                      }}
                      videoRef={videoRef}
                      onError={(error) => setCameraError(error)}
                      onStatusChange={(status) => setStreamStatus(status)}
                      onClose={() => setShowManualPanel(false)}
                      onDisconnect={() => {
                        if (peerConnectionRef.current) {
                          try { peerConnectionRef.current.close(); } catch(e){}
                          peerConnectionRef.current = null;
                        }
                        if (videoRef.current) videoRef.current.srcObject = null;
                        setStreamStatus('disconnected');
                      }}
                    />
                  ) : (
                    <div style={{ padding: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button
                        onClick={() => setShowManualPanel(true)}
                        style={{ padding: '8px 12px', background: '#3498db', color: '#fff', border: 'none', borderRadius: 4 }}
                      >
                        Open Manual Connection
                      </button>
                      <button
                        onClick={() => { setUseManualConnection(false); setStreamStatus('connecting'); }}
                        style={{ padding: '8px 12px', background: '#27ae60', color: '#fff', border: 'none', borderRadius: 4 }}
                      >
                        Use Auto Connection
                      </button>
                    </div>
                  )
                ) : streamStatus === 'error' ? (
                  <div style={{
                    width: '100%', height: '100%', backgroundColor: '#000', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, 
                    textAlign: 'center', fontSize: 16, flexDirection: 'column'
                  }}>
                    <p style={{ marginBottom: 16 }}>❌ {cameraError}</p>
                    <p style={{ fontSize: 12, color: '#999' }}>Make sure Raspberry Pi is running glass_detection_webrtc.py</p>
                  </div>
                ) : streamStatus === 'connecting' ? (
                  <div style={{
                    width: '100%', height: '100%', backgroundColor: '#000', color: '#ccc',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column'
                  }}>
                    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>⏳ Connecting to Raspberry Pi...</div>
                    <div style={{ fontSize: 12, color: '#999' }}>Waiting for WebRTC offer from camera device</div>
                  </div>
                ) : (
                  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsinline
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        backgroundColor: '#000'
                      }}
                    />
                    <div className="machine-live-indicator">
                      <span className="machine-live-dot"></span>
                      LIVE
                    </div>
                    {/* Change Connection button overlay */}
                    {useManualConnection && (
                      <button
                        onClick={() => {
                          setStreamStatus('disconnected');
                          setUseManualConnection(true);
                          if (peerConnectionRef.current) {
                            peerConnectionRef.current.close();
                            peerConnectionRef.current = null;
                          }
                          if (videoRef.current) {
                            videoRef.current.srcObject = null;
                          }
                        }}
                        style={{
                          position: 'absolute',
                          top: '10px',
                          right: '10px',
                          padding: '8px 16px',
                          background: '#3498db',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          zIndex: 100
                        }}
                      >
                        🔄 Change Connection
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Defect List Section */}
            <div className="machine-defects-panel">
              <div className="defects-panel-header">
                <h2 className="machine-section-title">Detected Defects</h2>
              </div>
              <div className="machine-defects-list" ref={defectsListRef}>
                <div>
                  {currentDefects.length === 0 ? (
                    <div className="machine-empty-state">
                      <p className="machine-empty-state-text">No detections yet</p>
                    </div>
                  ) : (
                    currentDefects.map((defect, index) => (
                      <div 
                        className="machine-defect-item" 
                        key={defect.id || index}
                        style={{ 
                          height: DEFECT_ITEM_HEIGHT,
                          backgroundColor: index % 2 === 0 ? '#f5f5f5' : '#fff',
                          borderLeft: `4px solid ${getStatusColor(defect.status)}`,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onClick={() => openModal(index)}
                      >
                        <div className="machine-defect-content">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', width: '100%' }}>
                            <span className="machine-defect-time">{defect.time}</span>
                            <span className="machine-defect-type">{defect.type}</span>
                            {defect.imageUrl ? (
                              <span style={{ fontSize: '11px', backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '2px 6px', borderRadius: '3px' }}>Image</span>
                            ) : (
                              <span style={{ fontSize: '11px', backgroundColor: '#fff3e0', color: '#e65100', padding: '2px 6px', borderRadius: '3px' }}>No Image</span>
                            )}
                            <span style={{ fontSize: '11px', backgroundColor: '#f3e5f5', color: '#6a1b9a', padding: '2px 6px', borderRadius: '3px', marginLeft: 'auto' }}>
                              {defect.status}
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#999' }}>
                            {defect.device_id && <span>{defect.device_id}</span>}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modal for defect image with X and Next button */}
      {modalOpen && currentImageIndex >= 0 && currentDefects[currentImageIndex] && (
        (() => {
          const modalDefect = currentDefects[currentImageIndex];
          return (
            <div className="modal">
              <div className="modal-content">
                <button onClick={closeModal} className="modal-close">
                  <svg className="icon" viewBox="0 0 24 24">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
                <div className="modal-defect-info">
                  <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>
                    {modalDefect.type} Defect
                  </h3>
                  
                  {/* Image Display */}
                  {modalDefect.imageUrl && (
                    <div style={{ marginBottom: '15px', maxWidth: '100%' }}>
                      <img 
                        src={modalDefect.imageUrl} 
                        alt="Defect" 
                        style={{ width: '100%', maxHeight: '300px', borderRadius: '4px', objectFit: 'cover' }}
                      />
                    </div>
                  )}

                  {/* Defect Details */}
                  <div style={{ backgroundColor: '#f5f5f5', padding: '12px', borderRadius: '4px', marginBottom: '15px', fontSize: '13px', lineHeight: '1.6' }}>
                    <p style={{ margin: '5px 0' }}>
                      <strong>Detection Time:</strong> {new Date(modalDefect.detected_at || Date.now()).toLocaleString()}
                    </p>
                    <p style={{ margin: '5px 0' }}>
                      <strong>Device:</strong> {modalDefect.device_id || 'N/A'}
                    </p>
                    <p style={{ margin: '5px 0' }}>
                      <strong>Status:</strong> <span style={{ color: getStatusColor(modalDefect.status), fontWeight: 'bold' }}>
                        {modalDefect.status || 'pending'}
                      </span>
                    </p>
                    {modalDefect.notes && (
                      <p style={{ margin: '5px 0' }}>
                        <strong>Notes:</strong> {modalDefect.notes}
                      </p>
                    )}
                  </div>

                  {/* Image Link */}
                  {modalDefect.imageUrl && (
                    <p style={{ fontSize: '12px', color: '#2196f3', marginBottom: '15px' }}>
                      <a 
                        href={modalDefect.imageUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        style={{ textDecoration: 'underline', color: '#2196f3' }}
                      >
                        Open full image in new tab
                      </a>
                    </p>
                  )}
                </div>

                {/* Modal Actions */}
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', padding: '16px 0 0 0', flexWrap: 'wrap', borderTop: '1px solid #eee', paddingTop: '15px' }}>
                  {currentImageIndex > 0 && (
                    <button onClick={prevImage} className="modal-next" style={{ flex: 1, minWidth: '100px' }}>
                      <svg className="icon" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
                        <polyline points="15 18 9 12 15 6"></polyline>
                      </svg>
                      Prev  
                    </button>
                  )}
                  {modalDefect?.id && modalDefect?.status !== 'resolved' && (
                    <button 
                      onClick={() => handleStatusUpdate(modalDefect.id, modalDefect.status === 'pending' ? 'reviewed' : 'resolved')}
                      className="modal-next"
                      disabled={updatingStatus}
                      style={{ flex: 1, minWidth: '100px', backgroundColor: updatingStatus ? '#ccc' : '#2196f3', cursor: updatingStatus ? 'not-allowed' : 'pointer' }}
                    >
                      {updatingStatus ? 'Updating...' : modalDefect.status === 'pending' ? '✓ Mark Reviewed' : '✓ Mark Resolved'}
                    </button>
                  )}
                  {currentImageIndex < currentDefects.length - 1 && (
                    <button onClick={nextImage} className="modal-next">
                      Next
                      <svg className="icon" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()
      )}

    </div>
  );
}

export default Dashboard;