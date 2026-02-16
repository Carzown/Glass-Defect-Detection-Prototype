// Dashboard: Real-time defects from Supabase + WebSocket video stream
// - Defects list comes from Supabase database polling
// - Live video stream comes from WebSocket backend on Railway
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
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
  // eslint-disable-next-line no-unused-vars
  const [supabaseDefects, setSupabaseDefects] = useState([]); // Supabase database defects (stored for consistency)
  const [sessionStartTime, setSessionStartTime] = useState(null); // Track when dashboard loaded
  const [modalOpen, setModalOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedDefectId, setSelectedDefectId] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false); // UI state for status update
  const [streamStatus, setStreamStatus] = useState('connecting'); // 'connecting', 'connected', 'error'
  const [streamMessage, setStreamMessage] = useState('Connecting to backend...');
  const [videoFrame, setVideoFrame] = useState(null);

  // Connections
  const navigate = useNavigate();
  const defectsListRef = useRef(null);
  const videoRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Load initial Supabase defects and set up polling
  useEffect(() => {
    // Set session start time when component mounts
    const now = new Date();
    setSessionStartTime(now);
    
    // Load initial defects
    loadSupabaseDefects(now);
    
    // Poll for new defects every 3 seconds
    const pollInterval = setInterval(() => {
      loadSupabaseDefects(now);
    }, 3000);
    
    return () => clearInterval(pollInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // WebSocket connection for real-time video frames from Railway backend
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        const wsUrl = process.env.REACT_APP_WS_URL || 'wss://glass-defect-detection-prototype-production.up.railway.app:8080';
        console.log('[Dashboard] Attempting WebSocket connection to:', wsUrl);

        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          console.log('[Dashboard] WebSocket connected, registering as web_client');
          setStreamStatus('connected');
          setStreamMessage('Connected to backend');
          
          // Register as web_client
          if (wsRef.current) {
            wsRef.current.send(JSON.stringify({
              type: 'register',
              client_type: 'web_client'
            }));
          }
        };

        wsRef.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            // Handle frame data (for live video display)
            if (data.type === 'frame' && data.frame) {
              try {
                const blob = new Blob([Uint8Array.from(atob(data.frame), c => c.charCodeAt(0))], { type: 'image/jpeg' });
                const url = URL.createObjectURL(blob);
                setVideoFrame(url);
              } catch (e) {
                console.error('[Dashboard] Error creating blob from frame:', e);
              }
            }

            // Handle defect detection
            // Note: Defects are now fetched from Supabase polling, not WebSocket
            // to ensure we get the full defect list with proper status tracking

            // Handle connection status messages
            if (data.type === 'status') {
              console.log('[Dashboard] Server status:', data.message);
              setStreamMessage(data.message);
            }

          } catch (e) {
            console.error('[Dashboard] Error parsing WebSocket message:', e);
          }
        };

        wsRef.current.onerror = (error) => {
          console.error('[Dashboard] WebSocket error:', error);
          setStreamStatus('error');
          setStreamMessage('Backend connection error');
        };

        wsRef.current.onclose = () => {
          console.log('[Dashboard] WebSocket disconnected');
          setStreamStatus('disconnected');
          setStreamMessage('Connection lost. Reconnecting...');
          
          // Attempt reconnection after 3 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[Dashboard] Attempting to reconnect WebSocket...');
            connectWebSocket();
          }, 3000);
        };

      } catch (error) {
        console.error('[Dashboard] WebSocket setup error:', error);
        setStreamStatus('error');
        setStreamMessage(`WebSocket Error: ${error.message}`);
        
        // Retry connection after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 3000);
      }
    };

    connectWebSocket();

    return () => {
      // Cleanup on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Update video element with new frame
  useEffect(() => {
    if (videoFrame && videoRef.current) {
      videoRef.current.src = videoFrame;
    }
  }, [videoFrame]);

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
    
    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    navigate('/');
  }

  const loadSupabaseDefects = async (filterAfterTime = null) => {
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
      
      // Restore scroll position after state update
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        if (defectsListRef.current) {
          defectsListRef.current.scrollTop = scrollPos;
        }
      });
      
      setSupabaseDefects(supabaseData);
    } catch (error) {
      console.error('Error loading Supabase defects:', error);
    }
  };

  const handleStatusUpdate = async (defectId, newStatus) => {
    try {
      setUpdatingStatus(true);
      await updateDefectStatus(defectId, newStatus);
      // Update local state
      setCurrentDefects(prev => 
        prev.map(d => d.id === defectId ? { ...d, status: newStatus } : d)
      );
      setSupabaseDefects(prev =>
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
  }

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

  const videoContainerStyle = {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    flexDirection: 'column',
    padding: '16px',
    textAlign: 'center'
  };

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

              {/* Video Container */}
              <div className="machine-video-container">
                {streamStatus === 'error' ? (
                  <div style={videoContainerStyle}>
                    <p style={{ marginBottom: 16, fontSize: 16 }}>❌ Connection Error</p>
                    <p style={{ fontSize: 12, color: '#999' }}>{streamMessage}</p>
                    <p style={{ fontSize: 12, color: '#999', marginTop: 8 }}>Make sure backend is running on Railway</p>
                  </div>
                ) : streamStatus === 'connecting' ? (
                  <div style={videoContainerStyle}>
                    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>⏳ Connecting...</div>
                    <div style={{ fontSize: 12, color: '#999' }}>{streamMessage}</div>
                  </div>
                ) : (
                  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                    {videoFrame ? (
                      <img 
                        ref={videoRef}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                          backgroundColor: '#000'
                        }}
                        alt="Live detection stream"
                      />
                    ) : (
                      <div style={videoContainerStyle}>
                        <p style={{ fontSize: 14 }}>Waiting for video stream...</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Defect List Section */}
            <div className="machine-defects-panel">
              <div className="defects-panel-header">
                <h2 className="machine-section-title">Detected Defects ({currentDefects.length})</h2>
              </div>
              <div className="machine-defects-list" ref={defectsListRef}>
                <div>
                  {currentDefects.length === 0 ? (
                    <div className="machine-empty-state">
                      <p className="machine-empty-state-text">No defects detected yet</p>
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

      {/* Modal for defect image with navigation */}
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
                  {/* Image Display - Top */}
                  {modalDefect.imageUrl && (
                    <div style={{ marginBottom: '20px', maxWidth: '100%' }}>
                      <img 
                        src={modalDefect.imageUrl} 
                        alt="Defect" 
                        style={{ width: '100%', maxHeight: '350px', borderRadius: '4px', objectFit: 'cover' }}
                      />
                    </div>
                  )}

                  {/* Defect Details */}
                  <div style={{ backgroundColor: '#f5f5f5', padding: '15px', borderRadius: '4px', marginBottom: '20px', fontSize: '13px', lineHeight: '1.8' }}>
                    <p style={{ margin: '8px 0' }}>
                      <strong>Detection Time:</strong> {new Date(modalDefect.detected_at || Date.now()).toLocaleString()}
                    </p>
                    <p style={{ margin: '8px 0' }}>
                      <strong>Type of Defect:</strong> {modalDefect.type}
                    </p>
                    {modalDefect.confidence && (
                      <p style={{ margin: '8px 0' }}>
                        <strong>Confidence Level:</strong> {(modalDefect.confidence * 100).toFixed(1)}%
                      </p>
                    )}
                  </div>

                  {/* Image Link */}
                  {modalDefect.imageUrl && (
                    <p style={{ fontSize: '12px', color: '#2196f3', marginBottom: '20px' }}>
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

                {/* Modal Navigation and Actions */}
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', padding: '20px 0 0 0', borderTop: '1px solid #eee', paddingTop: '20px' }}>
                  <button 
                    onClick={prevImage} 
                    disabled={currentImageIndex === 0}
                    className="modal-next"
                    style={{ flex: 1, minWidth: '100px', opacity: currentImageIndex === 0 ? 0.5 : 1, cursor: currentImageIndex === 0 ? 'not-allowed' : 'pointer' }}
                  >
                    <svg className="icon" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
                      <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                    Prev  
                  </button>
                  <button 
                    onClick={() => handleStatusUpdate(modalDefect.id, 'reviewed')}
                    className="modal-next"
                    disabled={updatingStatus}
                    style={{ flex: 1, minWidth: '100px', backgroundColor: updatingStatus ? '#ccc' : '#2196f3', cursor: updatingStatus ? 'not-allowed' : 'pointer' }}
                  >
                    {updatingStatus ? 'Updating...' : '✓ Mark Reviewed'}
                  </button>
                  <button 
                    onClick={nextImage} 
                    disabled={currentImageIndex === currentDefects.length - 1}
                    className="modal-next"
                    style={{ flex: 1, minWidth: '100px', opacity: currentImageIndex === currentDefects.length - 1 ? 0.5 : 1, cursor: currentImageIndex === currentDefects.length - 1 ? 'not-allowed' : 'pointer' }}
                  >
                    Next
                    <svg className="icon" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </button>
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