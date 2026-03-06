// Admin Detection History - Browse past detection sessions grouped by date (Admin version)
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import DateRangePicker from '../components/DateRangePicker';
import ConfirmationModal from '../components/ConfirmationModal';
import { capitalizeDefectType, formatDate, formatTime, groupByDate, getDefectTypesLabel } from '../utils/formatters';
import { restoreAdminAuthState, isAdminAuthenticated } from '../utils/auth';
import { fetchDefectsByRange, fetchDefectsByDateRange, deleteDefect } from '../services/defects';
import './Dashboard.css';
import './DetectionHistory.css';

function AdminDetectionHistory() {
  const navigate = useNavigate();

  const [authChecked, setAuthChecked] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedDefect, setSelectedDefect] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [timeFilter, setTimeFilter] = useState('30days');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }));
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [defectTypeFilter, setDefectTypeFilter] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const filterBtnRef = useRef(null);

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
    sessionStorage.removeItem('loggedIn');
    sessionStorage.removeItem('userId');
    sessionStorage.removeItem('userEmail');
    sessionStorage.removeItem('userRole');
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminLoggedIn');
    localStorage.removeItem('loggedIn');
    localStorage.removeItem('userId');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userRole');
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
            if (!cancelled) { setSessions([]); setLoading(false); }
            return;
          }
          data = await fetchDefectsByDateRange(
            new Date(customFromDate + 'T00:00:00+08:00'),
            new Date(customToDate + 'T23:59:59.999+08:00')
          );
        } else {
          data = await fetchDefectsByRange(timeFilter);
        }
        if (!cancelled) {
          setFetchError(null);
          setSessions(groupByDate(data));
        }
      } catch (e) {
        console.error('[AdminDetectionHistory] Error loading defects:', e);
        if (!cancelled) {
          setFetchError('Failed to load history. Please check your connection.');
          setSessions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [authChecked, timeFilter, customFromDate, customToDate]);

  useEffect(() => {
    if (!filterOpen) return;
    const handler = (e) => {
      if (filterBtnRef.current && !filterBtnRef.current.contains(e.target)) setFilterOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [filterOpen]);

  function handleSessionClick(session) {
    setSelectedSession(session);
    setSelectedDefect(null);
  }

  function handleDefectClick(defect) {
    setSelectedDefect(defect);
  }

  async function handleDeleteDefect() {
    const deletedId = selectedDefect.id;
    // Optimistically remove from UI immediately
    const newSessions = sessions
      .map(([dateKey, defects]) => [dateKey, defects.filter(d => d.id !== deletedId)])
      .filter(([, defects]) => defects.length > 0);
    setSessions(newSessions);
    setSelectedDefect(null);
    setShowDeleteConfirm(false);

    // Update selectedSession so column 2 instantly reflects the deletion (respecting active filter)
    if (selectedSession) {
      const [dateKey] = selectedSession;
      const updatedRaw = newSessions.find(([k]) => k === dateKey);
      if (!updatedRaw) {
        setSelectedSession(null);
      } else if (defectTypeFilter === 'all') {
        setSelectedSession(updatedRaw);
      } else {
        const filteredDefects = updatedRaw[1].filter(d =>
          (d.detected_defects || []).some(dd => dd.type?.toLowerCase() === defectTypeFilter)
        );
        setSelectedSession(filteredDefects.length > 0 ? [dateKey, filteredDefects] : null);
      }
    }

    // Fire the actual delete in the background
    try {
      await deleteDefect(deletedId);
    } catch (error) {
      console.error('[AdminDetectionHistory] Error deleting defect:', error);
      setFetchError('Delete failed — please refresh to restore the list.');
    }
  }

  const countByType = (type) =>
    sessions.reduce((acc, [, defects]) =>
      acc + defects.filter(d =>
        (d.detected_defects || []).some(dd => dd.type?.toLowerCase() === type)
      ).length, 0);

  const filteredSessions = defectTypeFilter === 'all'
    ? sessions
    : sessions
        .map(([dateKey, defects]) => [
          dateKey,
          defects.filter(d =>
            (d.detected_defects || []).some(dd => dd.type?.toLowerCase() === defectTypeFilter)
          ),
        ])
        .filter(([, defects]) => defects.length > 0);

  return (
    <>
      {!authChecked ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          width: '100vw',
          backgroundColor: '#f5f5f5',
          fontSize: '18px',
          color: '#666'
        }}>
          Loading...
        </div>
      ) : (
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
              <div ref={filterBtnRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setFilterOpen(o => !o)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px',
                    background: defectTypeFilter !== 'all' ? '#0f2942' : '#fff',
                    color: defectTypeFilter !== 'all' ? '#fff' : '#0f2942',
                    border: '1.5px solid #0f2942', borderRadius: 8,
                    fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                  </svg>
                  {defectTypeFilter === 'all' ? 'Filter' : defectTypeFilter.charAt(0).toUpperCase() + defectTypeFilter.slice(1)}
                </button>
                {filterOpen && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 100,
                    background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 170, overflow: 'hidden',
                  }}>
                    {[
                      { value: 'all', label: 'All Types' },
                      { value: 'bubble', label: `Bubble (${countByType('bubble')})` },
                      { value: 'scratch', label: `Scratch (${countByType('scratch')})` },
                      { value: 'crack', label: `Crack (${countByType('crack')})` },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { setDefectTypeFilter(opt.value); setFilterOpen(false); }}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '10px 16px', border: 'none',
                          background: defectTypeFilter === opt.value ? '#f0f4ff' : 'transparent',
                          color: defectTypeFilter === opt.value ? '#0f2942' : '#374151',
                          fontWeight: defectTypeFilter === opt.value ? 700 : 500,
                          fontSize: 13, cursor: 'pointer',
                        }}
                        onMouseEnter={e => { if (defectTypeFilter !== opt.value) e.currentTarget.style.background = '#f9fafb'; }}
                        onMouseLeave={e => { if (defectTypeFilter !== opt.value) e.currentTarget.style.background = 'transparent'; }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
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
          </div>
          {loading && <div className="dh-loading">Loading history…</div>}

          {!loading && (
            <div className="dh-miller-container dh-miller-page">
              {/* ── Column 1: Sessions ── */}
              <div className="dh-panel dh-panel-always">
                <div className="dh-panel-header">
                  <span className="dh-panel-title">History</span>
                  <span className="dh-panel-count">{filteredSessions.length}</span>
                </div>
                <div className="dh-panel-list">
                  {filteredSessions.length === 0 ? (
                    <div className="dh-empty">
                      {fetchError ? fetchError : sessions.length === 0 ? 'No history found' : `No ${defectTypeFilter} defects in this period`}
                    </div>
                  ) : (
                    filteredSessions.map(([dateKey, defects]) => (
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
                            <span className="dh-defect-type">
                              {getDefectTypesLabel(d)}
                            </span>
                            <span className="dh-row-time">{formatTime(d.detected_at)}</span>
                          </div>
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
                      {selectedDefect.image_url && (
                        <div style={{ marginBottom: 12, borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb', position: 'relative' }}>
                          <img
                            src={selectedDefect.image_url}
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
                        <div className="dh-detail-row">
                          <span className="dh-detail-label">Defect Count</span>
                          <span className="dh-detail-value">{(selectedDefect.detected_defects || []).length}</span>
                        </div>
                        {(selectedDefect.detected_defects || []).length > 0 && (
                          <div className="dh-detail-row">
                            <span className="dh-detail-label">Type</span>
                            <span className="dh-detail-value">{[...new Set((selectedDefect.detected_defects || []).map(d => capitalizeDefectType(d.type)))].join(', ')}</span>
                          </div>
                        )}
                        <div className="dh-detail-row">
                          <span className="dh-detail-label">Time Detected</span>
                          <span className="dh-detail-value">{formatTime(selectedDefect.detected_at)}</span>
                        </div>
                        <div className="dh-detail-row">
                          <span className="dh-detail-label">Date</span>
                          <span className="dh-detail-value">{formatDate(selectedDefect.detected_at)}</span>
                        </div>
                        {selectedDefect.image_url && (
                          <div className="dh-detail-row">
                            <span className="dh-detail-label">Image URL</span>
                            <a href={selectedDefect.image_url} target="_blank" rel="noreferrer" className="dh-detail-value" style={{ color: '#2563eb' }}>Image Link ↗</a>
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
      )}
    </>
  );
}

export default AdminDetectionHistory;
