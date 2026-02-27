// Admin Detection: Real-time defects from Supabase database for administrators
// - Defects list comes from Supabase database polling
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import DateRangePicker from '../components/DateRangePicker';
import { fetchDefects, getDateRangeBounds } from '../services/defects';
import './Detection.css';



// Helper: format Date -> relative time (e.g. "2 minutes ago", "3 hours ago", "5 days ago")
function formatTime(dateStr) {
  const detectionDate = new Date(dateStr);
  const now = new Date();
  const diffMs = now - detectionDate;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return diffSecs === 1 ? '1 second ago' : `${diffSecs} seconds ago`;
  } else if (diffMins < 60) {
    return diffMins === 1 ? '1 minute ago' : `${diffMins} minutes ago`;
  } else if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  } else {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  }
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

function AdminDetection() {
  // State
  const [currentDefects, setCurrentDefects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedDefectId, setSelectedDefectId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [timeFilter, setTimeFilter] = useState('today');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }));

  // Connections
  const navigate = useNavigate();
  const defectsListRef = useRef(null);

  // Check if admin is authenticated
  useEffect(() => {
    const adminToken = sessionStorage.getItem('adminToken');
    if (!adminToken) {
      navigate('/');
    }
  }, [navigate]);

  // Helper: Get date range bounds for filter - uses PHT-aware version from defects service
  // (imported above)

  // Load defects from Railway backend - only on mount
  const loadSupabaseDefects = useCallback(async () => {
    try {
      let start, end;
      if (timeFilter === 'custom-range') {
        // Use custom date range
        start = customFromDate ? new Date(customFromDate + 'T00:00:00+08:00').toISOString() : new Date(0).toISOString();
        end = customToDate ? new Date(customToDate + 'T23:59:59.999+08:00').toISOString() : new Date().toISOString();
      } else {
        // Use preset date range
        ({ start, end } = getDateRangeBounds(timeFilter));
      }
      const result = await fetchDefects({ limit: 999999, offset: 0, dateFrom: start, dateTo: end });
      const supabaseData = result.data || [];

      const displayDefects = supabaseData.map(d => ({
        id: d.id,
        time: formatTime(d.detected_at),
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
        .sort((a, b) => new Date(b.detected_at) - new Date(a.detected_at));

      setCurrentDefects(sorted);
      setLoading(false);
    } catch (error) {
      console.error('[AdminDetection] Error loading defects:', error);
      setLoading(false);
    }
  }, [timeFilter, customFromDate, customToDate]);

  // Fetch when component mounts or time filter changes
  useEffect(() => {
    setLoading(true);
    loadSupabaseDefects();
  }, [loadSupabaseDefects]);



  function handleLogout() {
    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminLoggedIn');
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
          { key: 'admin-dashboard', label: 'Dashboard', onClick: () => navigate('/admin-dashboard') },
          { key: 'admin-detection', label: 'Detection', onClick: () => navigate('/admin-detection') },
          { key: 'admin-detection-history', label: 'Detection History', onClick: () => navigate('/admin-detection-history') },
        ]}
        bottomItems={[
          { key: 'admin-how-to-use', label: 'How to Use', onClick: () => navigate('/admin-how-to-use') },
        ]}
        activeKey="admin-detection"
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
            <p className="machine-header-subtitle">Glass Detection Preview (Admin)</p>
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
                {loading ? (
                  <div className="machine-empty-state">
                    <p className="machine-empty-state-text">Loading...</p>
                  </div>
                ) : currentDefects.length === 0 ? (
                  <div className="machine-empty-state">
                    <p className="machine-empty-state-text">No defects detected yet</p>
                  </div>
                ) : currentDefects[0] && currentDefects[0].imageUrl ? (
                  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                    <img
                      src={currentDefects[0].imageUrl}
                      alt="Most recent defect"
                      style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '4px' }}
                    />
                    {currentDefects[0].tagNumber != null && (
                      <div style={{
                        position: 'absolute',
                        top: '12px',
                        left: '12px',
                        background: '#0f2942',
                        color: 'white',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: '700',
                        fontFamily: 'Poppins, sans-serif',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                      }}>
                        #{currentDefects[0].tagNumber}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="machine-empty-state">
                    <p className="machine-empty-state-text">No image available</p>
                  </div>
                )}
              </div>
            </div>

            {/* Defect List Section - Right */}
            <div className="machine-defects-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <h2 className="machine-section-title" style={{ marginBottom: '0' }}>Detected Defects ({currentDefects.length})</h2>
                </div>
                <div style={{ minWidth: '300px' }}>
                  <DateRangePicker
                    onApply={(result) => {
                      setTimeFilter('custom-range');
                      setCustomFromDate(result.from);
                      setCustomToDate(result.to);
                    }}
                    initialFrom={customFromDate}
                    initialTo={customToDate}
                  />
                </div>
              </div>
              <div className="machine-defects-list" ref={defectsListRef}>
                <div>
                  {loading ? (
                    <div className="machine-empty-state">
                      <p className="machine-empty-state-text">Loading...</p>
                    </div>
                  ) : currentDefects.length === 0 ? (
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
                    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                      <img src={modalDefect.imageUrl} alt="Defect" className="det-modal-image" />
                      {modalDefect.tagNumber != null && (
                        <div style={{
                          position: 'absolute',
                          top: '16px',
                          left: '16px',
                          background: '#0f2942',
                          color: 'white',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          fontSize: '16px',
                          fontWeight: '700',
                          fontFamily: 'Poppins, sans-serif',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                        }}>
                          #{modalDefect.tagNumber}
                        </div>
                      )}
                    </div>
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

export default AdminDetection;
