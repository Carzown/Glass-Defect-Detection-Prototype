import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import DateRangePicker from '../components/DateRangePicker';
import { signOutUser } from '../supabase';
import { capitalizeDefectType, formatDate, formatTime, groupByDate } from '../utils/formatters';
import { restoreAuthState, isUserAuthenticated } from '../utils/auth';
import { fetchDefectsByRange, fetchDefectsByDateRange } from '../services/defects';
import './Dashboard.css';
import './DetectionHistory.css';

function DetectionHistory() {
  const navigate = useNavigate();
  const location = useLocation();

  const [authChecked, setAuthChecked] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedDefect, setSelectedDefect] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState('30days');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Check if employee is authenticated - restore from localStorage if needed
  useEffect(() => {
    restoreAuthState();
    if (!isUserAuthenticated()) {
      navigate('/');
      return;
    }
    setAuthChecked(true);
  }, [navigate]);
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }));

  async function handleLogout() {
    try {
      await signOutUser();
    } catch (err) {
      console.error('Logout error:', err);
    }
    sessionStorage.removeItem('loggedIn');
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('userId');
    const remembered = localStorage.getItem('rememberMe') === 'true';
    if (!remembered) localStorage.removeItem('email');
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
        console.error('[DetectionHistory] Error loading defects:', e);
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
        console.error('[DetectionHistory] Error loading defects:', e);
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

  return (
    <div className="machine-container">
      <Sidebar
        onLogout={handleLogout}
        mainItems={[
          { key: 'dashboard', label: 'Dashboard', onClick: () => navigate('/dashboard') },
          { key: 'detection', label: 'Detection', onClick: () => navigate('/detection') },
          { key: 'detection-history', label: 'Detection History', onClick: () => navigate('/detection-history') },
        ]}
        bottomItems={[
          { key: 'how-to-use', label: 'How to Use', onClick: () => navigate('/how-to-use') },
        ]}
        activeKey="detection-history"
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
            <p className="machine-header-subtitle">View past inspection results</p>
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
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default DetectionHistory;
