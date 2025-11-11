// Dashboard: Live preview (Socket.IO) + session-scoped defects (Supabase)
// - Start/Stop controls Jetson via backend
// - Preview comes from 'stream:frame' events
// - Defects list comes from Supabase when enabled; only rows created since Start Detection
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { signOutUser, supabase } from '../supabase';
import './Dashboard.css';
import { io } from 'socket.io-client';

const DEFECT_ITEM_HEIGHT = 56;

// Helper: format Date -> [HH:MM:SS]
function formatTime(date) {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  const s = date.getSeconds().toString().padStart(2, '0');
  return `[${h}:${m}:${s}]`;
}

function Dashboard() {
  // Session + UI state
  const [isDetecting, setIsDetecting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentDefects, setCurrentDefects] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const csvInputRef = useRef(null);
  const [cameraError, setCameraError] = useState('');
  const [frameSrc, setFrameSrc] = useState(null);
  // Connections
  const socketRef = useRef(null);
  const channelRef = useRef(null); // Supabase realtime channel
  const [sessionStart, setSessionStart] = useState(null); // mark when Start Detection was clicked
  const navigate = useNavigate();
  const defectsListRef = useRef(null);

  // Keep latest paused state accessible inside event handlers
  const pausedRef = useRef(false);
  useEffect(() => { pausedRef.current = isPaused; }, [isPaused]);

  useEffect(() => {
    const role = sessionStorage.getItem('role');
    if (role === 'admin') {
      alert('Admins cannot access the Employee Dashboard. Redirecting to Admin.');
      navigate('/admin');
    }
  }, [navigate]);

  // Start detection: connect to backend, listen to frames, and ask Jetsons to start
  const startDetection = async () => {
    setIsDetecting(true);
    setIsPaused(false);
  // Reset defects and prepare live socket stream reception
    setCurrentDefects([]);
    setCameraError('');
    setSessionStart(new Date());

    try {
  // Connect to backend Socket.IO (allow test injection via window.__IO__)
      const url = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
      const ioFactory = (typeof window !== 'undefined' && window.__IO__) || io;
      const socket = ioFactory(url, { transports: ['websocket'] });
      socketRef.current = socket;

      // Identify as dashboard client
      socket.emit('client:hello', { role: 'dashboard' });

      socket.on('connect', () => {
        console.log('Connected to backend for live stream');
      });

  const realtimeEnabled = process.env.REACT_APP_ENABLE_SUPABASE_REALTIME === 'true';

      socket.on('stream:frame', (payload) => {
        if (pausedRef.current) return;
        if (payload?.dataUrl) setFrameSrc(payload.dataUrl);
  // If Supabase realtime is enabled, don't append defects from Socket.IO (source = Supabase)
        if (!realtimeEnabled) {
          if (Array.isArray(payload?.defects) && payload.defects.length) {
            const timeStr = formatTime(new Date(payload.time || Date.now()));
            const toAdd = payload.defects.map((d) => ({
              time: timeStr,
              type: d?.type || 'Defect',
              imageUrl: payload.dataUrl,
            }));
            setCurrentDefects((prev) => {
              const next = [...prev, ...toAdd];
              return next.length > 20 ? next.slice(-20) : next;
            });
          }
        }
      });

      socket.on('disconnect', () => {
        console.log('Disconnected from backend');
      });

      // Optional: log device online/offline status updates from Raspberry Pi
      socket.on('device:status', (status) => {
        try {
          console.log('Device status:', status);
        } catch (_) {}
      });

      // Request Jetson(s) to start streaming and detection
      socket.emit('dashboard:start', {});
    } catch (err) {
      console.error(err);
      setCameraError(err?.message || 'Unable to connect to backend stream');
      stopDetection();
    }
  };

  // Stop detection: signal stop, disconnect socket, reset preview, remove realtime channel
  const stopDetection = () => {
    setIsDetecting(false);
    setIsPaused(false);
    // disconnect socket and clear frame
    try {
      // signal Jetson(s) to stop
      socketRef.current?.emit?.('dashboard:stop', {});
      socketRef.current?.disconnect();
    } catch (_) {}
    socketRef.current = null;
    setFrameSrc(null);
    // remove realtime subscription if any
    try {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    } catch (_) {}
  };

  const toggleDetection = () => {
    isDetecting ? stopDetection() : startDetection();
  };

  // Pause/Resume: stop appending new frames/defects (keeps last frame shown)
  const togglePause = () => {
    setIsPaused((prev) => {
      const next = !prev;
      try {
        const sock = socketRef.current;
        if (sock && typeof sock.emit === 'function') {
          if (next) {
            // Pausing detection on Jetson(s)
            sock.emit('dashboard:pause', {});
          } else {
            // Resuming detection on Jetson(s)
            sock.emit('dashboard:resume', {});
          }
        }
      } catch (_) {}
      return next;
    });
  };


  function openClearConfirm() { setConfirmClearOpen(true); }
  function closeClearConfirm() { setConfirmClearOpen(false); }
  function clearDefects() {
    // Also stop detection when clearing, per requirement
    stopDetection();
    setCurrentDefects([]);
    setConfirmClearOpen(false);
  }

  function downloadCSV() {
    if (currentDefects.length === 0) return;
    const csvHeader = 'Time,Defect Type,Image URL\n';
    const csvRows = currentDefects.map(defect =>
      `${defect.time},${defect.type},${defect.imageUrl}`
    ).join('\n');
    const csvContent = csvHeader + csvRows;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `defects_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try { socketRef.current?.disconnect(); } catch (_) {}
    };
  }, []);

  // Supabase: fetch defects since the moment Start Detection was clicked, then subscribe to new inserts
  useEffect(() => {
    const enableRealtime = process.env.REACT_APP_ENABLE_SUPABASE_REALTIME === 'true';
    const hasConfig = !!(process.env.REACT_APP_SUPABASE_URL && process.env.REACT_APP_SUPABASE_ANON_KEY);
    if (!enableRealtime || !hasConfig || !sessionStart) return;

    let cancelled = false;
    const sinceIso = sessionStart.toISOString();

    (async () => {
      try {
        // Initial fetch: only rows created at or after session start
        const { data, error } = await supabase
          .from('defects')
          .select('*')
          .gte('created_at', sinceIso)
          .order('created_at', { ascending: true })
          .limit(200);
        if (!cancelled && data && !error) {
          const mapped = data.map((row) => ({
            time: (row.time_text && String(row.time_text)) || formatTime(new Date(row.created_at)),
            type: row.defect_type || 'Defect',
            imageUrl: row.image_url || '',
          }));
          setCurrentDefects(mapped);
        }

        // Setup realtime subscription filtered client-side by created_at >= sessionStart
        channelRef.current = supabase
          .channel('defects-stream')
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'defects' },
            (payload) => {
              const row = payload.new || {};
              const created = new Date(row.created_at || Date.now());
              if (created >= sessionStart) {
                setCurrentDefects((prev) => {
                  const next = [
                    ...prev,
                    {
                      time: (row.time_text && String(row.time_text)) || formatTime(created),
                      type: row.defect_type || 'Defect',
                      imageUrl: row.image_url || '',
                    },
                  ];
                  return next.length > 400 ? next.slice(-400) : next;
                });
              }
            }
          );
        await channelRef.current.subscribe();
      } catch (e) {
        console.warn('Supabase realtime disabled or failed:', e?.message || e);
      }
    })();

    return () => {
      cancelled = true;
      if (channelRef.current) {
        try { supabase.removeChannel(channelRef.current); } catch (_) {}
        channelRef.current = null;
      }
    };
  }, [sessionStart]);

  // Auto-scroll defects list so newest entries are visible
  useEffect(() => {
    if (defectsListRef.current) {
      defectsListRef.current.scrollTop = defectsListRef.current.scrollHeight;
    }
  }, [currentDefects]);

  function handleCsvUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      const text = e.target.result;
      const lines = text.trim().split('\n');
      let startIdx = 0;
      if (lines[0].toLowerCase().includes('time') && lines[0].toLowerCase().includes('defect')) {
        startIdx = 1;
      }
      let uploadedDefects = [];
      for (let i = startIdx; i < lines.length; i++) {
        const [time, type, imageUrl] = lines[i].split(',');
        if (time && type && imageUrl) {
          uploadedDefects.push({ time: time.trim(), type: type.trim(), imageUrl: imageUrl.trim() });
        }
      }
      // Display uploaded CSV entries in the defect list
      if (uploadedDefects.length) {
        setCurrentDefects((prev) => {
          const next = [...prev, ...uploadedDefects];
          return next;
        });
      }
      // Allow re-uploading the same file again if needed
      try { event.target.value = ''; } catch (_) {}
    };
    reader.readAsText(file);
  }

  return (
    <div className="machine-container">
      <Sidebar
        onLogout={handleLogout}
        mainItems={[
          { key: 'dashboard', label: 'Dashboard', onClick: () => navigate('/dashboard') },
        ]}
        bottomItems={[
          { key: 'help', label: ' Help', onClick: () => navigate('/help') },
        ]}
        activeKey="dashboard"
      />

      <main className="machine-main-content">
        <header className="machine-header">
          <div className="machine-header-left">
            <h1 className="machine-header-title">Glass Defect Detector</h1>
            <p className="machine-header-subtitle">CAM-001</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {isDetecting && (
              <button
                onClick={togglePause}
                className="machine-detection-button"
                title={isPaused ? 'Resume appending detections' : 'Pause appending detections'}
              >
                {isPaused ? 'Resume' : 'Pause'}
              </button>
            )}
            <button onClick={toggleDetection} className="machine-detection-button">
              {isDetecting ? 'Stop Detection' : 'Start Detection'}
            </button>
          </div>
        </header>

        <div className="machine-content-area">
          <div className="machine-content-wrapper">
            <div className="machine-video-section">
              <h2 className="machine-section-title">Detection Preview</h2>
              <div className="machine-video-container">
                {isDetecting ? (
                  <div className="machine-live-feed">
                    {cameraError ? (
                      <div style={{
                        width: '100%', height: '100%', backgroundColor: '#300', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, textAlign: 'center'
                      }}>
                        {cameraError}
                      </div>
                    ) : (
                      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                        {frameSrc ? (
                          <img
                            src={frameSrc}
                            alt="Live feed"
                            className="machine-live-video"
                            style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000' }}
                          />
                        ) : (
                          <div style={{
                            width: '100%', height: '100%', backgroundColor: '#000', color: '#ccc',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            Waiting for stream...
                          </div>
                        )}
                      </div>
                    )}
                    <div className="machine-live-indicator">
                      <span className="machine-live-dot"></span>
                      LIVE
                    </div>
                  </div>
                ) : (
                  <div className="machine-video-placeholder">
                    <div style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <p className="machine-placeholder-title" style={{ color: '#1a3a52', fontWeight: 700, fontSize: 18 }}>Camera Ready</p>
                      <p className="machine-placeholder-subtitle" style={{ color: '#6b7280', fontSize: 14 }}>Click "Start Detection" to begin live view</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Defect List Section */}
            <div className="machine-defects-panel">
              <div className="defects-panel-header">
                <h2 className="machine-section-title">Detected Defects</h2>
                <div className="defects-panel-actions">
                  <button
                    onClick={openClearConfirm}
                    className="action-button clear-button"
                    disabled={currentDefects.length === 0}
                  >
                    Clear
                  </button>
                  <input
                    type="file"
                    accept=".csv"
                    style={{ display: 'none' }}
                    ref={csvInputRef}
                    onChange={handleCsvUpload}
                  />
                  <button
                    onClick={() => csvInputRef.current.click()}
                    className="action-button upload-button"
                    disabled={isDetecting}
                  >
                    Upload to Database
                  </button>
                  <button
                    onClick={downloadCSV}
                    className="action-button download-button"
                    disabled={currentDefects.length === 0}
                  >
                    Download CSV
                  </button>
                </div>
              </div>
              <div className="machine-defects-list" ref={defectsListRef}>
                <div>
                  {currentDefects.length === 0 ? (
                    <div className="machine-empty-state">
                      <p className="machine-empty-state-text">No detections yet</p>
                    </div>
                  ) : (
                    currentDefects.map((defect, index) => (
                      <div className="machine-defect-item" key={index} style={{ height: DEFECT_ITEM_HEIGHT }}>
                        <div className="machine-defect-content">
                          <span className="machine-defect-time">{defect.time}</span>
                          <span className="machine-defect-label">Glass Defect:</span>
                          <span className="machine-defect-type">{defect.type}</span>
                          <span
                            className="machine-defect-image-link"
                            style={{ cursor: 'pointer', color: '#e5a445' }}
                            onClick={() => openModal(index)}
                          >
                            Image
                          </span>
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
      {modalOpen && (
        <div className="modal">
          <div className="modal-content">
            <button onClick={closeModal} className="modal-close">
              <svg className="icon" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <div className="modal-image-container">
              <div className="modal-defect-info">
                {currentDefects[currentImageIndex] && (
                  <>
                    <p>
                      {currentDefects[currentImageIndex].time} Glass Defect: {currentDefects[currentImageIndex].type}
                    </p>
                    {currentDefects[currentImageIndex].imageUrl && (
                      <p style={{ wordBreak: 'break-all', fontSize: 12, color: '#6b7280' }}>
                        Image URL:{" "}
                        <a
                          href={currentDefects[currentImageIndex].imageUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open in new tab
                        </a>
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', padding: '16px 32px 24px' }}>
              {currentImageIndex > 0 && (
                <button onClick={prevImage} className="modal-next">
                  <svg className="icon" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                  Prev  
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

      {/* Modal to confirm clearing defects */}
      {confirmClearOpen && (
        <div className="modal">
          <div className="modal-content" style={{ maxWidth: '400px', padding: '0', position: 'relative' }}>
            <button onClick={closeClearConfirm} className="modal-close" style={{ 
              position: 'absolute', 
              top: '16px', 
              right: '16px', 
              zIndex: 10 
            }}>
              <svg className="icon" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <div style={{ padding: '48px 32px 32px 32px' }}>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <h3 style={{ color: '#1a3a52', fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
                  Clear all detected defects?
                </h3>
                {currentDefects.length > 0 && (
                  <p style={{ fontSize: '14px', color: '#6b7280' }}>
                    This will remove {currentDefects.length} item{currentDefects.length !== 1 ? 's' : ''} from the list.
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '16px' }}>
                <button onClick={closeClearConfirm} className="action-button upload-button">
                  Cancel
                </button>
                <button onClick={clearDefects} className="action-button clear-button">
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;