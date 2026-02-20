// Detection: Real-time defects from Supabase database
// - Defects list comes from Supabase database polling
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { signOutUser } from '../supabase';
import { fetchDefects } from '../services/defects';
import './Detection.css';



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
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedDefectId, setSelectedDefectId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);


  // Connections
  const navigate = useNavigate();
  const defectsListRef = useRef(null);

  // Load defects from Railway backend
  const loadSupabaseDefects = async (filterAfterTime = null) => {
    try {
      const result = await fetchDefects({ limit: 100, offset: 0 });
      const supabaseData = result.data || [];

      const timeToFilter = filterAfterTime || sessionStartTime;
      const filteredData = (timeToFilter && supabaseData.length > 0)
        ? supabaseData.filter(d => new Date(d.detected_at) >= timeToFilter)
        : supabaseData;

      const displayDefects = filteredData.map(d => ({
        id: d.id,
        time: formatTime(new Date(d.detected_at)),
        type: capitalizeDefectType(d.defect_type),
        imageUrl: d.tagged_image_url || d.image_url,
        originalImageUrl: d.image_url,
        tagNumber: d.tag_number,
        detected_at: d.detected_at,
        image_path: d.image_path,
        notes: d.notes,
        supabaseData: d,
      }));

      const sorted = displayDefects
        .sort((a, b) => new Date(b.detected_at) - new Date(a.detected_at))
        .slice(0, 20);

      setCurrentDefects(sorted);
    } catch (error) {
      console.error('[Detection] Error loading defects:', error);
    }
  };

  // Load initial Supabase defects and set up polling
  useEffect(() => {
    const now = new Date();
    setSessionStartTime(now);
    
    loadSupabaseDefects(now);
    
    const pollInterval = setInterval(() => {
      loadSupabaseDefects(now);
    }, 3000);
    
    return () => clearInterval(pollInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function handleLogout() {
    try {
      await signOutUser();
    } catch (error) {
      console.error('Logout error:', error);
    }
    
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

  // Auto-scroll defects list so newest entry (top) is always visible
  useEffect(() => {
    if (defectsListRef.current) {
      defectsListRef.current.scrollTop = 0;
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
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
      />

      <main className="machine-main-content">
        <header className="machine-header">
          <button className="sidebar-hamburger" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle sidebar">
            <span /><span /><span />
          </button>
          <div className="machine-header-left">
            <h1 className="machine-header-title">Glass Defect Detector</h1>
            <p className="machine-header-subtitle">Live Detection Feed</p>
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
                        <div className="det-defect-index">{defect.tagNumber ?? (currentDefects.length - index)}</div>
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
                  {modalDefect.tagNumber != null && (
                    <div className="det-modal-detail-row">
                      <span className="det-modal-detail-label">Tag #</span>
                      <span className="det-modal-detail-value" style={{ fontWeight: 800, color: '#0f2942' }}>#{modalDefect.tagNumber}</span>
                    </div>
                  )}
                  {confidence != null && (
                    <div className="det-modal-detail-row">
                      <span className="det-modal-detail-label">Confidence</span>
                      <span className="det-modal-detail-value">{(confidence * 100).toFixed(1)}%</span>
                    </div>
                  )}
                  <div className="det-modal-detail-row">
                    <span className="det-modal-detail-label">Tagged Image</span>
                    {modalDefect.imageUrl
                      ? <a href={modalDefect.imageUrl} target="_blank" rel="noreferrer" className="det-modal-detail-link">View tagged ↗</a>
                      : <span className="det-modal-detail-empty">—</span>
                    }
                  </div>
                  {modalDefect.originalImageUrl && modalDefect.originalImageUrl !== modalDefect.imageUrl && (
                    <div className="det-modal-detail-row">
                      <span className="det-modal-detail-label">Original</span>
                      <a href={modalDefect.originalImageUrl} target="_blank" rel="noreferrer" className="det-modal-detail-link">View original ↗</a>
                    </div>
                  )}
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
