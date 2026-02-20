// DetectionHistory: Browse past detection sessions
// Loads all defects from Supabase, groups by date into "sessions"
// Miller-column navigation: Session → Defects in session → Defect details
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { signOutUser } from '../supabase';
import { fetchDefects } from '../services/defects';
import './Dashboard.css';
import './DetectionHistory.css';

// ── Mock sessions (shown when Supabase has no data) ─────────────
const MOCK_SESSIONS = [
  {
    detected_at: '2026-02-21T14:32:10Z', defect_type: 'scratch',
    confidence: 0.92, status: 'unresolved', device_id: 'CAM-001', id: 'm1',
  },
  {
    detected_at: '2026-02-21T14:45:03Z', defect_type: 'bubble',
    confidence: 0.87, status: 'resolved', device_id: 'CAM-001', id: 'm2',
  },
  {
    detected_at: '2026-02-21T15:01:55Z', defect_type: 'crack',
    confidence: 0.95, status: 'unresolved', device_id: 'CAM-001', id: 'm3',
  },
  {
    detected_at: '2026-02-20T09:12:40Z', defect_type: 'scratch',
    confidence: 0.78, status: 'resolved', device_id: 'CAM-001', id: 'm4',
  },
  {
    detected_at: '2026-02-20T09:58:22Z', defect_type: 'bubble',
    confidence: 0.81, status: 'unresolved', device_id: 'CAM-002', id: 'm5',
  },
  {
    detected_at: '2026-02-20T11:30:05Z', defect_type: 'crack',
    confidence: 0.90, status: 'resolved', device_id: 'CAM-002', id: 'm6',
  },
  {
    detected_at: '2026-02-20T13:44:19Z', defect_type: 'scratch',
    confidence: 0.85, status: 'unresolved', device_id: 'CAM-001', id: 'm7',
  },
  {
    detected_at: '2026-02-19T08:05:33Z', defect_type: 'crack',
    confidence: 0.93, status: 'resolved', device_id: 'CAM-001', id: 'm8',
  },
  {
    detected_at: '2026-02-19T10:22:47Z', defect_type: 'bubble',
    confidence: 0.76, status: 'unresolved', device_id: 'CAM-002', id: 'm9',
  },
  {
    detected_at: '2026-02-19T14:55:11Z', defect_type: 'scratch',
    confidence: 0.88, status: 'resolved', device_id: 'CAM-001', id: 'm10',
  },
];

function capitalizeDefectType(type) {
  if (!type) return type;
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function groupByDate(defects) {
  const groups = {};
  defects.forEach((d) => {
    const dateKey = new Date(d.detected_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(d);
  });
  // Sort by date descending
  return Object.entries(groups).sort((a, b) => new Date(b[0]) - new Date(a[0]));
}

function DetectionHistory() {
  const navigate = useNavigate();

  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedDefect, setSelectedDefect] = useState(null);
  const [loading, setLoading] = useState(true);

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
    async function load() {
      try {
        setLoading(true);
        const result = await fetchDefects({ limit: 500, offset: 0 });
        const data = result.data || [];
        setSessions(groupByDate(data.length > 0 ? data : MOCK_SESSIONS));
      } catch (e) {
        console.error('[DetectionHistory] Error loading defects, using mock data:', e);
        setSessions(groupByDate(MOCK_SESSIONS));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

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
        bottomItems={[]}
        activeKey="detection-history"
      />

      <main className="machine-main-content">
        <header className="machine-header">
          <div className="machine-header-left">
            <h1 className="machine-header-title">Detection History</h1>
            <p className="machine-header-subtitle">Browse past detections</p>
          </div>
        </header>

        <div className="dh-page-content-area">
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
                      <div className="dh-detail-card">
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
                          <span className="dh-detail-label">Image URL</span>
                          {selectedDefect.image_url
                            ? <a href={selectedDefect.image_url} target="_blank" rel="noreferrer" className="dh-detail-value" style={{ color: '#2563eb', wordBreak: 'break-all' }}>View image</a>
                            : <span className="dh-detail-value">—</span>
                          }
                        </div>
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
