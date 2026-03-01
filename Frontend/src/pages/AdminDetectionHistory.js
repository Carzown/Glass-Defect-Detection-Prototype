// Admin Detection History - Browse past detection sessions grouped by date (Admin version)
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import DateRangePicker from '../components/DateRangePicker';
import ConfirmationModal from '../components/ConfirmationModal';
import { capitalizeDefectType, formatDate, formatTime, groupByDate } from '../utils/formatters';
import { restoreAdminAuthState, isAdminAuthenticated } from '../utils/auth';
import { fetchDefectsByRange, fetchDefectsByDateRange, deleteDefect } from '../services/defects';
import './Dashboard.css';
import './DetectionHistory.css';

function AdminDetectionHistory() {
  const navigate = useNavigate();
  const location = useLocation();

  const [authChecked, setAuthChecked] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedDefect, setSelectedDefect] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState('30days');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }));
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Check if admin is authenticated - restore from localStorage if needed
  useEffect(() => {
    restoreAdminAuthState();
    if (!isAdminAuthenticated()) {
      navigate('/');
      return;
    }
    setAuthChecked(true);
  }, [navigate]);

  function handleLogout() {
    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminLoggedIn');
    navigate('/');
  }

  useEffect(() => {
    if (!authChecked) return;
    
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setSelectedSession(null);
        setSelectedDefect(null);
        let data;
        if (timeFilter === 'custom-range') {
          if (!customFromDate || !customToDate) {
            setSessions([]);
            setLoading(false);
            return;
          }
          data = await fetchDefectsByDateRange(
            new Date(customFromDate + 'T00:00:00+08:00'),
            new Date(customToDate + 'T23:59:59.999+08:00')
          );
        } else {
          data = await fetchDefectsByRange(timeFilter);
        }
        if (!cancelled) setSessions(groupByDate(data));
      } catch (e) {
        console.error('[AdminDetectionHistory] Error loading defects:', e);
        if (!cancelled) setSessions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [authChecked, timeFilter, customFromDate, customToDate]);

  // Refresh data when navigating to this page (only after auth is verified)
  useEffect(() => {
    if (!authChecked) return;
    
    const loadData = async () => {
      try {
        setLoading(true);
        setSelectedSession(null);
        setSelectedDefect(null);
        const data = await fetchDefectsByRange(timeFilter);
        setSessions(groupByDate(data));
      } catch (e) {
        console.error('[AdminDetectionHistory] Error loading defects:', e);
        setSessions([]);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [authChecked, timeFilter]);

  function handleSessionClick(session) {
    setSelectedSession(session);
    setSelectedDefect(null);
  }

  function handleDefectClick(defect) {
    setSelectedDefect(defect);
  }

  async function handleDeleteDefect() {
    try {
      await deleteDefect(selectedDefect.id);
      // Refresh the current view by reloading the sessions
      const newSessions = sessions.map(([dateKey, defects]) => {
        return [dateKey, defects.filter(d => d.id !== selectedDefect.id)];
      }).filter(([, defects]) => defects.length > 0);
      setSessions(newSessions);
      setSelectedDefect(null);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('[AdminDetectionHistory] Error deleting defect:', error);
      alert('Failed to delete defect. Please try again.');
    }
  }

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
        activeKey="admin-detection-history"
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
      />

      <main className="machine-main-content">
        <header className="machine-header">
          <button className="sidebar-hamburger" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle sidebar">
            <span /><span /><span />
          </button>
          <div className="machine-header-left">
            <h1 className="machine-header-title">Detection History</h1>
            <p className="machine-header-subtitle">Admin Access</p>
          </div>
        </header>

        <div className="dh-page-content-area">
          <div className="dashboard-title-row" style={{ padding: '0 0 8px 0', gap: '12px', alignItems: 'center' }}>
            <h2 className="dashboard-box-title">Sessions</h2>
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
          {loading && <div className="dh-loading">Loading history…</div>}

          {!loading && (
            <div className="dh-miller-container dh-miller-page">
              {/* ── Column 1: Sessions ── */}
              <div className="dh-panel dh-panel-always">
                <div className="dh-panel-header">
                  <span className="dh-panel-title">History</span>
                  <span className="dh-panel-count">{sessions.length}</span>
                </div>
                <div className="dh-panel-list">
                  {sessions.length === 0 ? (
                    <div className="dh-empty">No history found</div>
                  ) : (
                    sessions.map(([dateKey, defects]) => (
                      <div
                        key={dateKey}
                        className={`dh-row${selectedSession && selectedSession[0] === dateKey ? ' dh-row-selected' : ''}`}
                        onClick={() => handleSessionClick([dateKey, defects])}
                      >
                        <div className="dh-row-main">
                          <span className="dh-row-title">{dateKey}</span>
                          <span className="dh-row-badge">
                            {defects.length} defect{defects.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <svg className="dh-row-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* ── Column 2: Defects in selected session ── */}
              <div className={`dh-panel dh-panel-slide${selectedSession ? ' dh-panel-visible' : ''}`}>
                {selectedSession && (
                  <>
                    <div className="dh-panel-header">
                      <span className="dh-panel-title">{selectedSession[0]}</span>
                      <span className="dh-panel-count">{selectedSession[1].length}</span>
                    </div>
                    <div className="dh-panel-list">
                      {selectedSession[1].map((d, i) => (
                        <div
                          key={d.id || i}
                          className={`dh-row${selectedDefect && selectedDefect.id === d.id ? ' dh-row-selected' : ''}`}
                          onClick={() => handleDefectClick(d)}
                        >
                          <div className="dh-row-main">
                            <span className={`dh-defect-type dh-defect-${(d.defect_type || '').toLowerCase()}`}>
                              {capitalizeDefectType(d.defect_type)}
                            </span>
                            <span className="dh-row-time">{formatTime(d.detected_at)}</span>
                          </div>
                          {d.tag_number != null && (
                            <span style={{ background: '#0f2942', color: 'white', borderRadius: 4, fontSize: 10, fontWeight: 700, padding: '2px 6px', fontFamily: 'Inter', flexShrink: 0, marginRight: 4 }}>#{d.tag_number}</span>
                          )}
                          <svg className="dh-row-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* ── Column 3: Defect details ── */}
              <div className={`dh-panel dh-panel-slide${selectedDefect ? ' dh-panel-visible' : ''}`}>
                {selectedDefect && (
                  <>
                    <div className="dh-panel-header">
                      <span className="dh-panel-title">Details</span>
                    </div>
                    <div className="dh-detail-card-wrapper">
                      {(selectedDefect.tagged_image_url || selectedDefect.image_url) && (
                        <div style={{ marginBottom: 12, borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb', position: 'relative' }}>
                          <img
                            src={selectedDefect.tagged_image_url || selectedDefect.image_url}
                            alt="Defect"
                            style={{ width: '100%', display: 'block', objectFit: 'contain', background: '#000' }}
                          />
                          {selectedDefect.tag_number != null && (
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
                              #{selectedDefect.tag_number}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="dh-detail-card">
                        {selectedDefect.tag_number != null && (
                          <div className="dh-detail-row">
                            <span className="dh-detail-label">Tag #</span>
                            <span className="dh-detail-value" style={{ fontWeight: 800, color: '#0f2942' }}>#{selectedDefect.tag_number}</span>
                          </div>
                        )}
                        <div className="dh-detail-row">
                          <span className="dh-detail-label">Type</span>
                          <span className={`dh-defect-type dh-defect-${(selectedDefect.defect_type || '').toLowerCase()}`}>
                            {capitalizeDefectType(selectedDefect.defect_type)}
                          </span>
                        </div>
                        <div className="dh-detail-row">
                          <span className="dh-detail-label">Time Detected</span>
                          <span className="dh-detail-value">{formatTime(selectedDefect.detected_at)}</span>
                        </div>
                        <div className="dh-detail-row">
                          <span className="dh-detail-label">Date</span>
                          <span className="dh-detail-value">{formatDate(selectedDefect.detected_at)}</span>
                        </div>
                        {selectedDefect.confidence != null && (
                          <div className="dh-detail-row">
                            <span className="dh-detail-label">Confidence</span>
                            <span className="dh-detail-value">
                              {(selectedDefect.confidence * 100).toFixed(1)}%
                            </span>
                          </div>
                        )}
                        <div className="dh-detail-row">
                          <span className="dh-detail-label">Tagged Image</span>
                          {selectedDefect.tagged_image_url
                            ? <a href={selectedDefect.tagged_image_url} target="_blank" rel="noreferrer" className="dh-detail-value" style={{ color: '#2563eb' }}>View tagged ↗</a>
                            : <span className="dh-detail-value" style={{ color: '#d1d5db' }}>Pending…</span>
                          }
                        </div>
                        {selectedDefect.image_url && (
                          <div className="dh-detail-row">
                            <span className="dh-detail-label">Original</span>
                            <a href={selectedDefect.image_url} target="_blank" rel="noreferrer" className="dh-detail-value" style={{ color: '#2563eb' }}>View original ↗</a>
                          </div>
                        )}
                      </div>
                      {/* Delete Button - Centered at Bottom */}
                      <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
                        <button
                          onClick={() => setShowDeleteConfirm(true)}
                          style={{
                            padding: '10px 24px',
                            background: '#dc2626',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: '600',
                            fontSize: '14px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#b91c1c';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.3)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#dc2626';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          Delete Defect
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        title="Delete Defect"
        message="Are you sure you want to delete this defect? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isDangerous={true}
        onConfirm={handleDeleteDefect}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}

export default AdminDetectionHistory;
