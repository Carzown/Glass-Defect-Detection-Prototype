// Dashboard: Dashboard page with sidebar and header
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { signOutUser } from '../supabase';
import { fetchDefects } from '../services/defects';
import './Dashboard.css';

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

// ── Helpers for sessions widget ──────────────────────────────────
function capitalizeDefectType(type) {
  if (!type) return type;
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function groupByDate(defects) {
  const groups = {};
  defects.forEach((d) => {
    const dateKey = new Date(d.detected_at).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(d);
  });
  return Object.entries(groups).sort((a, b) => new Date(b[0]) - new Date(a[0]));
}

function Dashboard() {
  const navigate = useNavigate();
  const [timeFilter, setTimeFilter] = useState('today');

  // Sessions widget state
  const [dashSessions, setDashSessions] = useState([]);
  const [dashSelectedSession, setDashSelectedSession] = useState(null);
  const [dashSelectedDefect, setDashSelectedDefect] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const result = await fetchDefects({ limit: 500, offset: 0 });
        const data = result.data || [];
        setDashSessions(groupByDate(data.length > 0 ? data : MOCK_SESSIONS));
      } catch (e) {
        console.error('[Dashboard] Failed to load sessions, using mock data:', e);
        setDashSessions(groupByDate(MOCK_SESSIONS));
      }
    }
    load();
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

    const remembered = localStorage.getItem('rememberMe') === 'true';
    if (!remembered) {
      localStorage.removeItem('email');
    }

    navigate('/');
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
        activeKey="dashboard"
      />

      <main className="machine-main-content">
        <header className="machine-header">
          <div className="machine-header-left">
            <h1 className="machine-header-title">Dashboard</h1>
            <p className="machine-header-subtitle">Overview and analytics</p>
          </div>
        </header>

        <div className="machine-content-area">
          {/* Top Container - Full Width */}
          <div className="dashboard-box-wrapper dashboard-box-wrapper-full">
            <div className="dashboard-title-row">
              <h2 className="dashboard-box-title">Statistics</h2>
              <select
                className="dashboard-time-filter"
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>
            <div className="dashboard-stats-row">
              <div className="dashboard-box dashboard-stats-box">
                <div className="dashboard-stat-card">
                  <span className="dashboard-stat-label">Total Defects Detected</span>
                  <span className="dashboard-stat-value">0</span>
                </div>
                <div className="dashboard-stat-card">
                  <span className="dashboard-stat-label">Average Confidence Score</span>
                  <span className="dashboard-stat-value">0%</span>
                </div>
                <div className="dashboard-stat-card">
                  <span className="dashboard-stat-label">Last Detection</span>
                  <span className="dashboard-stat-value">--</span>
                </div>
              </div>
              <div className="dashboard-box dashboard-status-box">
                <span className="dashboard-stat-label">Raspberry Pi Status</span>
                <span className="dashboard-stat-value dashboard-stat-status">Online</span>
              </div>
            </div>
          </div>

          {/* Bottom Containers */}
          <div className="machine-content-wrapper">
            <div className="dashboard-box-wrapper">
              <div className="dashboard-sessions-header">
                <h2 className="dashboard-box-title">Detection History</h2>
                <button
                  className="dashboard-sessions-nav-btn"
                  onClick={() => navigate('/detection-history')}
                  title="View all history"
                >
                  ›
                </button>
              </div>
              <div className="dashboard-box dashboard-sessions-box">
                <div className="dh-miller-container">
                  {/* Column 1: Sessions */}
                  <div className="dh-panel dh-panel-always">
                    <div className="dh-panel-header">
                      <span className="dh-panel-title"></span>
                      <span className="dh-panel-count">{dashSessions.length}</span>
                    </div>
                    <div className="dh-panel-list">
                      {dashSessions.length === 0 ? (
                        <div className="dh-empty">No history yet</div>
                      ) : (
                        dashSessions.map(([dateKey, defects]) => (
                          <div
                            key={dateKey}
                            className={`dh-row${dashSelectedSession && dashSelectedSession[0] === dateKey ? ' dh-row-selected' : ''}`}
                            onClick={() => { setDashSelectedSession([dateKey, defects]); setDashSelectedDefect(null); }}
                          >
                            <div className="dh-row-main">
                              <span className="dh-row-title">{dateKey}</span>
                              <span className="dh-row-badge">{defects.length} defect{defects.length !== 1 ? 's' : ''}</span>
                            </div>
                            <svg className="dh-row-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Column 2: Defects in selected session */}
                  <div className={`dh-panel dh-panel-slide${dashSelectedSession ? ' dh-panel-visible' : ''}`}>
                    {dashSelectedSession && (
                      <>
                        <div className="dh-panel-header">
                          <span className="dh-panel-title">{dashSelectedSession[0]}</span>
                          <span className="dh-panel-count">{dashSelectedSession[1].length}</span>
                        </div>
                        <div className="dh-panel-list">
                          {dashSelectedSession[1].map((d, i) => (
                            <div
                              key={d.id || i}
                              className={`dh-row${dashSelectedDefect && dashSelectedDefect.id === d.id ? ' dh-row-selected' : ''}`}
                              onClick={() => setDashSelectedDefect(d)}
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

                  {/* Column 3: Defect details */}
                  <div className={`dh-panel dh-panel-slide${dashSelectedDefect ? ' dh-panel-visible' : ''}`}>
                    {dashSelectedDefect && (
                      <>
                        <div className="dh-panel-header">
                          <span className="dh-panel-title">Details</span>
                        </div>
                        <div className="dh-detail-card-wrapper">
                          <div className="dh-detail-card">
                            <div className="dh-detail-row">
                              <span className="dh-detail-label">Type</span>
                              <span className={`dh-defect-type dh-defect-${(dashSelectedDefect.defect_type || '').toLowerCase()}`}>
                                {capitalizeDefectType(dashSelectedDefect.defect_type)}
                              </span>
                            </div>
                            <div className="dh-detail-row">
                              <span className="dh-detail-label">Time Detected</span>
                              <span className="dh-detail-value">{formatTime(dashSelectedDefect.detected_at)}</span>
                            </div>
                            <div className="dh-detail-row">
                              <span className="dh-detail-label">Date</span>
                              <span className="dh-detail-value">{formatDate(dashSelectedDefect.detected_at)}</span>
                            </div>
                            {dashSelectedDefect.confidence != null && (
                              <div className="dh-detail-row">
                                <span className="dh-detail-label">Confidence</span>
                                <span className="dh-detail-value">
                                  {(dashSelectedDefect.confidence * 100).toFixed(1)}%
                                </span>
                              </div>
                            )}
                            <div className="dh-detail-row">
                              <span className="dh-detail-label">Image URL</span>
                              {dashSelectedDefect.image_url
                                ? <a href={dashSelectedDefect.image_url} target="_blank" rel="noreferrer" className="dh-detail-value" style={{ color: '#2563eb', wordBreak: 'break-all' }}>View image</a>
                                : <span className="dh-detail-value">—</span>
                              }
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="dashboard-box-wrapper">
              <h2 className="dashboard-box-title">Amount of Defects per Type</h2>
              <div className="dashboard-box dashboard-chart-box">
                <div className="dashboard-bar-chart">
                  <div className="chart-y-axis-label">Defect Type</div>
                  <div className="chart-body">
                    <div className="chart-y-axis">
                      <span className="chart-y-tick">Scratch</span>
                      <span className="chart-y-tick">Bubble</span>
                      <span className="chart-y-tick">Cracks</span>
                    </div>
                    <div className="chart-area">
                      <div className="chart-grid">
                        <div className="chart-gridline"></div>
                        <div className="chart-gridline"></div>
                        <div className="chart-gridline"></div>
                        <div className="chart-gridline"></div>
                        <div className="chart-gridline"></div>
                      </div>
                      <div className="chart-bars">
                        <div className="chart-bar-wrapper">
                          <div className="dashboard-bar-fill" style={{ width: '90%' }}></div>
                          <span className="chart-bar-value">18</span>
                        </div>
                        <div className="chart-bar-wrapper">
                          <div className="dashboard-bar-fill" style={{ width: '55%' }}></div>
                          <span className="chart-bar-value">11</span>
                        </div>
                        <div className="chart-bar-wrapper">
                          <div className="dashboard-bar-fill" style={{ width: '65%' }}></div>
                          <span className="chart-bar-value">13</span>
                        </div>
                      </div>
                      <div className="chart-x-axis">
                        <span>0</span>
                        <span>5</span>
                        <span>10</span>
                        <span>15</span>
                        <span>20</span>
                      </div>
                    </div>
                  </div>
                  <div className="chart-x-axis-label">Count</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
