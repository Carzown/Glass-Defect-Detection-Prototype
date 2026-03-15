import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import DateRangePicker from '../components/DateRangePicker';
import { signOutUser } from '../supabase';
import { capitalizeDefectType, formatDate, formatTime, groupByDate, getDefectTypesLabel } from '../utils/formatters';
import { restoreAuthState, isUserAuthenticated } from '../utils/auth';
import { fetchDefectsByRange, fetchDefectsByDateRange, subscribeToDefects, connectWebSocket, getDateRangeBounds } from '../services/defects';
import './Dashboard.css';
import './DetectionHistory.css';

function DetectionHistory() {
  const navigate = useNavigate();

  const [authChecked, setAuthChecked] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedDefect, setSelectedDefect] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [timeFilter, setTimeFilter] = useState('30days');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [defectTypeFilter, setDefectTypeFilter] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }));
  const filterBtnRef = useRef(null);
  const timeFilterRef = useRef(timeFilter);
  const customFromDateRef = useRef('');
  const customToDateRef = useRef(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }));
  useEffect(() => { timeFilterRef.current = timeFilter; }, [timeFilter]);
  useEffect(() => { customFromDateRef.current = customFromDate; }, [customFromDate]);
  useEffect(() => { customToDateRef.current = customToDate; }, [customToDate]);

  
  useEffect(() => {
    restoreAuthState();
    if (!isUserAuthenticated()) {
      navigate('/');
      return;
    }
    setAuthChecked(true);
  }, [navigate]);

  async function handleLogout() {
    try { await signOutUser(); } catch {}
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
        console.error('[DetectionHistory] Error loading defects:', e);
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

  // Realtime subscription — handles new/update/delete without a full reload
  useEffect(() => {
    if (!authChecked) return;

    const makeKey = (detected_at) => new Date(detected_at).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila',
    });

    const inRange = (detected_at) => {
      const tf = timeFilterRef.current;
      const from = customFromDateRef.current;
      const to = customToDateRef.current;
      if (tf === 'custom-range') {
        if (!from || !to) return false;
        const d = new Date(detected_at);
        return d >= new Date(from + 'T00:00:00+08:00') && d <= new Date(to + 'T23:59:59.999+08:00');
      }
      const { start, end } = getDateRangeBounds(tf);
      const d = new Date(detected_at);
      return d >= new Date(start) && d <= new Date(end);
    };

    const onNew = (newDefect) => {
      if (!inRange(newDefect.detected_at)) return;
      const dateKey = makeKey(newDefect.detected_at);
      setSessions(prev => {
        const idx = prev.findIndex(([k]) => k === dateKey);
        if (idx !== -1) {
          if (prev[idx][1].some(d => d.id === newDefect.id)) return prev;
          return prev.map((entry, i) => i === idx ? [dateKey, [newDefect, ...entry[1]]] : entry);
        }
        return [[dateKey, [newDefect]], ...prev].sort((a, b) => new Date(b[0]) - new Date(a[0]));
      });
      setSelectedSession(prev => {
        if (!prev || prev[0] !== dateKey) return prev;
        if (prev[1].some(d => d.id === newDefect.id)) return prev;
        return [dateKey, [newDefect, ...prev[1]]];
      });
    };

    const onUpdate = (updatedDefect) => {
      setSessions(prev => prev.map(([k, defects]) =>
        [k, defects.map(d => d.id === updatedDefect.id ? updatedDefect : d)]
      ));
      setSelectedSession(prev =>
        prev ? [prev[0], prev[1].map(d => d.id === updatedDefect.id ? updatedDefect : d)] : prev
      );
      setSelectedDefect(prev => prev && prev.id === updatedDefect.id ? updatedDefect : prev);
    };

    const onDelete = (deletedId) => {
      setSessions(prev =>
        prev.map(([k, defects]) => [k, defects.filter(d => d.id !== deletedId)])
           .filter(([, defects]) => defects.length > 0)
      );
      setSelectedDefect(prev => prev && prev.id === deletedId ? null : prev);
      setSelectedSession(prev => {
        if (!prev) return prev;
        const updated = prev[1].filter(d => d.id !== deletedId);
        return updated.length > 0 ? [prev[0], updated] : null;
      });
    };

    const unsubSupa = subscribeToDefects({ onNew, onUpdate, onDelete });
    const unsubWS = connectWebSocket({ onNew, onUpdate, onDelete });
    return () => { unsubSupa(); unsubWS(); };
  }, [authChecked]);

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
              {}
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

              {}
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

              {}
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
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
        </div>
      )}
    </>
  );
}

export default DetectionHistory;
