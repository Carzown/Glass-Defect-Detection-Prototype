// Dashboard: Live preview (Socket.IO) + real-time defects from Supabase
// - Receives live camera stream from Raspberry Pi via Socket.IO backend
// - Preview comes from 'stream:frame' events
// - Defects list comes from Supabase database polling
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
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
  const [supabaseDefects, setSupabaseDefects] = useState([]); // Supabase database defects
  const [sessionStartTime, setSessionStartTime] = useState(null); // Track when dashboard loaded
  const [modalOpen, setModalOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [updatingStatus, setUpdatingStatus] = useState(false); // UI state for status update
  const [cameraError, setCameraError] = useState('');
  const [frameSrc, setFrameSrc] = useState(null);
  // Connections
  const socketRef = useRef(null);
  const navigate = useNavigate();
  const defectsListRef = useRef(null);

  useEffect(() => {
    const role = sessionStorage.getItem('role');
    if (role === 'admin') {
      alert('Admins cannot access the Employee Dashboard. Redirecting to Admin.');
      navigate('/admin');
    }
  }, [navigate]);

  // Load initial Supabase defects and set up polling
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
  }, []);

  // Connect to backend Socket.IO for live camera stream
  useEffect(() => {
    const url = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';
    console.log('[Dashboard] Connecting to Socket.IO at:', url);
    
    const socket = io(url, { 
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('[Dashboard] Socket.IO connected:', socket.id);
      setCameraError('');
      // Identify as dashboard
      socket.emit('client:hello', { role: 'dashboard' });
    });

    socket.on('disconnect', () => {
      console.log('[Dashboard] Socket.IO disconnected');
      setCameraError('Disconnected from backend. Reconnecting...');
    });

    // Receive live camera frames from Raspberry Pi
    socket.on('stream:frame', (payload) => {
      if (payload?.dataUrl) {
        setFrameSrc(payload.dataUrl);
      }
    });

    // Listen for device status updates
    socket.on('device:status', (status) => {
      console.log('[Dashboard] Device status:', status);
    });

    // Handle connection errors
    socket.on('connect_error', (err) => {
      console.error('[Dashboard] Socket.IO connection error:', err);
      setCameraError(`Connection error: ${err.message || 'Cannot reach backend at ' + url}`);
    });

    // Cleanup on unmount
    return () => {
      try {
        socket.disconnect();
      } catch (_) {}
    };
  }, []);

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
    setCurrentImageIndex(index);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
  }

  function nextImage() {
    setCurrentImageIndex((idx) => {
      const last = currentDefects.length - 1;
      return idx < last ? idx + 1 : idx; // clamp at most recent (right end)
    });
  }

  function prevImage() {
    setCurrentImageIndex((idx) => (idx > 0 ? idx - 1 : idx)); // clamp at oldest (left end)
  }



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
              <div className="machine-video-container">
                {cameraError ? (
                  <div style={{
                    width: '100%', height: '100%', backgroundColor: '#000', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, textAlign: 'center', fontSize: 16
                  }}>
                    {cameraError}
                  </div>
                ) : frameSrc ? (
                  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                    <img
                      src={frameSrc}
                      alt="Live detection feed"
                      className="machine-live-video"
                      style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000' }}
                    />
                    <div className="machine-live-indicator">
                      <span className="machine-live-dot"></span>
                      LIVE
                    </div>
                  </div>
                ) : (
                  <div style={{
                    width: '100%', height: '100%', backgroundColor: '#000', color: '#ccc',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column'
                  }}>
                    <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Waiting for Camera Stream</p>
                    <p style={{ fontSize: 14 }}>Make sure Raspberry Pi detection is running and backend is started</p>
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
      {modalOpen && currentDefects[currentImageIndex] && (
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
                {currentDefects[currentImageIndex].type} Defect
              </h3>
              
              {/* Image Display */}
              {currentDefects[currentImageIndex].imageUrl && (
                <div style={{ marginBottom: '15px', maxWidth: '100%' }}>
                  <img 
                    src={currentDefects[currentImageIndex].imageUrl} 
                    alt="Defect" 
                    style={{ width: '100%', maxHeight: '300px', borderRadius: '4px', objectFit: 'cover' }}
                  />
                </div>
              )}

              {/* Defect Details */}
              <div style={{ backgroundColor: '#f5f5f5', padding: '12px', borderRadius: '4px', marginBottom: '15px', fontSize: '13px', lineHeight: '1.6' }}>
                <p style={{ margin: '5px 0' }}>
                  <strong>Detection Time:</strong> {new Date(currentDefects[currentImageIndex].detected_at || Date.now()).toLocaleString()}
                </p>
                <p style={{ margin: '5px 0' }}>
                  <strong>Device:</strong> {currentDefects[currentImageIndex].device_id || 'N/A'}
                </p>
                <p style={{ margin: '5px 0' }}>
                  <strong>Status:</strong> <span style={{ color: getStatusColor(currentDefects[currentImageIndex].status), fontWeight: 'bold' }}>
                    {currentDefects[currentImageIndex].status || 'pending'}
                  </span>
                </p>
                {currentDefects[currentImageIndex].notes && (
                  <p style={{ margin: '5px 0' }}>
                    <strong>Notes:</strong> {currentDefects[currentImageIndex].notes}
                  </p>
                )}
              </div>

              {/* Image Link */}
              {currentDefects[currentImageIndex].imageUrl && (
                <p style={{ fontSize: '12px', color: '#2196f3', marginBottom: '15px' }}>
                  <a 
                    href={currentDefects[currentImageIndex].imageUrl} 
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
              {currentDefects[currentImageIndex]?.id && currentDefects[currentImageIndex]?.status !== 'resolved' && (
                <button 
                  onClick={() => handleStatusUpdate(currentDefects[currentImageIndex].id, currentDefects[currentImageIndex].status === 'pending' ? 'reviewed' : 'resolved')}
                  className="modal-next"
                  disabled={updatingStatus}
                  style={{ flex: 1, minWidth: '100px', backgroundColor: updatingStatus ? '#ccc' : '#2196f3', cursor: updatingStatus ? 'not-allowed' : 'pointer' }}
                >
                  {updatingStatus ? 'Updating...' : currentDefects[currentImageIndex].status === 'pending' ? '✓ Mark Reviewed' : '✓ Mark Resolved'}
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
      )}

    </div>
  );
}

export default Dashboard;