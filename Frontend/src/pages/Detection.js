// Detection: Real-time defects from Supabase database
// - Defects list comes from Supabase database polling
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { signOutUser } from '../supabase';
import { fetchDefects } from '../services/defects';
import './Detection.css';

// ── Mock defects (shown when Supabase returns no data) ──────────
const MOCK_DEFECTS = [
  { id: 'md1', defect_type: 'scratch', detected_at: '2026-02-21T14:32:10Z', confidence: 0.92, image_url: null, device_id: 'CAM-001', status: null, notes: null },
  { id: 'md2', defect_type: 'bubble',  detected_at: '2026-02-21T14:45:03Z', confidence: 0.87, image_url: null, device_id: 'CAM-001', status: null, notes: null },
  { id: 'md3', defect_type: 'crack',   detected_at: '2026-02-21T15:01:55Z', confidence: 0.95, image_url: null, device_id: 'CAM-001', status: null, notes: null },
  { id: 'md4', defect_type: 'scratch', detected_at: '2026-02-21T15:22:40Z', confidence: 0.78, image_url: null, device_id: 'CAM-001', status: null, notes: null },
  { id: 'md5', defect_type: 'bubble',  detected_at: '2026-02-21T15:38:22Z', confidence: 0.81, image_url: null, device_id: 'CAM-002', status: null, notes: null },
  { id: 'md6', defect_type: 'crack',   detected_at: '2026-02-21T15:50:05Z', confidence: 0.90, image_url: null, device_id: 'CAM-002', status: null, notes: null },
];

// Helper: format Date -> [HH:MM:SS]
function formatTime(date) {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  const s = date.getSeconds().toString().padStart(2, '0');
  return `[${h}:${m}:${s}]`;
}

function formatDisplayDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDisplayTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function capitalizeDefectType(type) {
  if (!type) return type;
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}

function Detection() {
  // State
  const [currentDefects, setCurrentDefects] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [supabaseDefects, setSupabaseDefects] = useState([]);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedDefectId, setSelectedDefectId] = useState(null);


  // Connections
  const navigate = useNavigate();
  const defectsListRef = useRef(null);

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

  const loadSupabaseDefects = async (filterAfterTime = null) => {
    try {
      console.log('[Detection] Fetching defects from Supabase...');
      
      // Save current scroll position before updating defects
      const scrollPos = defectsListRef.current?.scrollTop || 0;
      
      // Fetch latest defects (unlimited to get all)
      const result = await fetchDefects({ limit: 100, offset: 0 });
      const supabaseData = result.data || [];
      
      console.log(`[Detection] ✅ Fetched ${supabaseData.length} defects from Supabase`);

      // Use mock data if Supabase returns nothing
      const sourceData = supabaseData.length > 0 ? supabaseData : MOCK_DEFECTS;
      
      // Filter defects to only show ones detected after session start
      const timeToFilter = filterAfterTime || sessionStartTime;
      const filteredData = (supabaseData.length > 0 && timeToFilter)
        ? sourceData.filter(d => new Date(d.detected_at) >= timeToFilter)
        : sourceData;
      
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
        
        console.log(`[Detection] Updated defects list: ${merged.length} items`);
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
      console.error('[Detection] ❌ Error loading Supabase defects, using mock data:', error);
      const displayMock = MOCK_DEFECTS.map(d => ({
        id: d.id,
        time: formatTime(new Date(d.detected_at)),
        type: capitalizeDefectType(d.defect_type),
        imageUrl: d.image_url,
        detected_at: d.detected_at,
        device_id: d.device_id,
        confidence: d.confidence,
        supabaseData: d,
      }));
      setCurrentDefects(displayMock);
      setSupabaseDefects(MOCK_DEFECTS);
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
          { key: 'detection', label: 'Detection', onClick: () => navigate('/detection') },
          { key: 'detection-history', label: 'Detection History', onClick: () => navigate('/detection-history') },
        ]}
        bottomItems={[]}
        activeKey="detection"
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
            {/* Image Preview Section - Left */}
            <div className="machine-image-preview-panel">
              <div className="image-preview-header">
                <h2 className="machine-section-title">Defect Preview</h2>
              </div>
              <div className="machine-image-preview-container">
                {currentDefects.length === 0 ? (
                  <div className="machine-empty-state">
                    <p className="machine-empty-state-text">No defects detected yet</p>
                  </div>
                ) : currentDefects[0] && currentDefects[0].imageUrl ? (
                  <img
                    src={currentDefects[0].imageUrl}
                    alt="Most recent defect"
                    style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '4px' }}
                  />
                ) : (
                  <div className="machine-empty-state">
                    <p className="machine-empty-state-text">No image available</p>
                  </div>
                )}
              </div>
            </div>

            {/* Defect List Section - Right */}
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
                        className={`machine-defect-item det-defect-row${index === 0 ? ' det-defect-row--latest' : ''}`}
                        key={defect.id || index}
                        onClick={() => openModal(index)}
                      >
                        <div className="det-defect-index">{currentDefects.length - index}</div>
                        <div className="det-defect-body">
                          <span className="det-defect-type-label">{defect.type}</span>
                          <span className="det-defect-time-label">{defect.time}</span>
                        </div>
                        {defect.supabaseData?.confidence != null && (
                          <span className="det-defect-confidence">
                            {(defect.supabaseData.confidence * 100).toFixed(0)}%
                          </span>
                        )}
                        <svg className="det-defect-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modal */}
      {modalOpen && currentImageIndex >= 0 && currentDefects[currentImageIndex] && (
        (() => {
          const modalDefect = currentDefects[currentImageIndex];
          const confidence = modalDefect.supabaseData?.confidence ?? modalDefect.confidence;
          return (
            <div className="modal" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
              <div className="det-modal-content">

                {/* Header */}
                <div className="det-modal-header">
                  <div className="det-modal-header-left">
                    <span className="det-modal-index">{currentImageIndex + 1} / {currentDefects.length}</span>
                    <h2 className="det-modal-title">{modalDefect.type}</h2>
                  </div>
                  <button onClick={closeModal} className="det-modal-close">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                {/* Image area */}
                <div className="det-modal-image-area">
                  {modalDefect.imageUrl ? (
                    <img src={modalDefect.imageUrl} alt="Defect" className="det-modal-image" />
                  ) : (
                    <div className="det-modal-no-image">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <span>No image available</span>
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="det-modal-details">
                  <div className="det-modal-detail-row">
                    <span className="det-modal-detail-label">Type</span>
                    <span className="det-modal-detail-value">{modalDefect.type}</span>
                  </div>
                  <div className="det-modal-detail-row">
                    <span className="det-modal-detail-label">Time Detected</span>
                    <span className="det-modal-detail-value">{formatDisplayTime(modalDefect.detected_at)}</span>
                  </div>
                  <div className="det-modal-detail-row">
                    <span className="det-modal-detail-label">Date</span>
                    <span className="det-modal-detail-value">{formatDisplayDate(modalDefect.detected_at)}</span>
                  </div>
                  {confidence != null && (
                    <div className="det-modal-detail-row">
                      <span className="det-modal-detail-label">Confidence</span>
                      <span className="det-modal-detail-value">{(confidence * 100).toFixed(1)}%</span>
                    </div>
                  )}
                  <div className="det-modal-detail-row">
                    <span className="det-modal-detail-label">Image URL</span>
                    {modalDefect.imageUrl
                      ? <a href={modalDefect.imageUrl} target="_blank" rel="noreferrer" className="det-modal-detail-link">View image ↗</a>
                      : <span className="det-modal-detail-empty">—</span>
                    }
                  </div>
                </div>

                {/* Footer nav */}
                <div className="det-modal-footer">
                  <button
                    onClick={prevImage}
                    disabled={currentImageIndex === 0}
                    className="det-modal-nav-btn"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16"><polyline points="15 18 9 12 15 6" /></svg>
                    Prev
                  </button>
                  <span className="det-modal-counter">{currentImageIndex + 1} of {currentDefects.length}</span>
                  <button
                    onClick={nextImage}
                    disabled={currentImageIndex === currentDefects.length - 1}
                    className="det-modal-nav-btn"
                  >
                    Next
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16"><polyline points="9 18 15 12 9 6" /></svg>
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

export default Detection;
