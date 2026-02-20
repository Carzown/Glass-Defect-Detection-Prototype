// Dashboard: Dashboard page with sidebar and header
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { signOutUser } from '../supabase';
import { fetchDefectsByRange } from '../services/defects';
import './Dashboard.css';

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
  const [dashSelectedSession, setDashSelectedSession] = useState(null);
  const [dashSelectedDefect, setDashSelectedDefect] = useState(null);
  const [filteredDefects, setFilteredDefects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Re-fetch from Supabase every time the date filter changes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      // Reset drill-down selections whenever the range changes
      setDashSelectedSession(null);
      setDashSelectedDefect(null);
      try {
        const data = await fetchDefectsByRange(timeFilter);
        if (!cancelled) setFilteredDefects(data);
      } catch (e) {
        console.error('[Dashboard] Failed to load defects:', e);
        if (!cancelled) setFilteredDefects([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [timeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const dashSessions = groupByDate(filteredDefects);

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
                <option value="7days">Last 7 days</option>
                <option value="30days">Last 30 days</option>
              </select>
            </div>
            <div className="dashboard-stats-row">
              <div className="dashboard-box dashboard-stats-box">
                <div className="dashboard-stat-card">
                  <span className="dashboard-stat-label">Total Defects Detected</span>
                  <span className="dashboard-stat-value">{loading ? '…' : filteredDefects.length}</span>
                </div>
                <div className="dashboard-stat-card">
                  <span className="dashboard-stat-label">Average Confidence Score</span>
                  <span className="dashboard-stat-value">
                    {loading ? '…' : filteredDefects.length > 0
                      ? `${(filteredDefects.reduce((sum, d) => sum + (d.confidence || 0), 0) / filteredDefects.length * 100).toFixed(1)}%`
                      : '0%'}
                  </span>
                </div>
                <div className="dashboard-stat-card">
                  <span className="dashboard-stat-label">Last Detection</span>
                  <span className="dashboard-stat-value">
                    {loading ? '…' : filteredDefects.length > 0 ? (() => {
                      const last = filteredDefects.slice().sort((a, b) => new Date(b.detected_at) - new Date(a.detected_at))[0];
                      const mins = Math.floor((Date.now() - new Date(last.detected_at)) / 60000);
                      return mins === 0 ? 'Just now' : `${mins} min${mins > 1 ? 's' : ''} ago`;
                    })() : '--'}
                  </span>
                </div>
              </div>
              <div className="dashboard-box dashboard-status-box">
                <span className="dashboard-stat-label">Raspberry Pi Status</span>
                {loading ? (
                  <span className="dashboard-stat-value dashboard-stat-status" style={{ color: '#94a3b8' }}>…</span>
                ) : (() => {
                  const online = filteredDefects.some(d => (Date.now() - new Date(d.detected_at)) < 10 * 60000);
                  return (
                    <span className="dashboard-stat-value dashboard-stat-status" style={{ color: online ? '#22c55e' : '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: online ? '#22c55e' : '#ef4444', flexShrink: 0 }} />
                      {online ? 'Online' : 'Offline'}
                    </span>
                  );
                })()}
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
                {loading ? (
                  <div className="dh-loading">Loading…</div>
                ) : (
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
                            {dashSelectedDefect.tag_number != null && (
                              <div className="dh-detail-row">
                                <span className="dh-detail-label">Tag #</span>
                                <span className="dh-detail-value" style={{ fontWeight: 800, color: '#0f2942' }}>#{dashSelectedDefect.tag_number}</span>
                              </div>
                            )}
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
                              <span className="dh-detail-label">Tagged Image</span>
                              {dashSelectedDefect.tagged_image_url
                                ? <a href={dashSelectedDefect.tagged_image_url} target="_blank" rel="noreferrer" className="dh-detail-value" style={{ color: '#2563eb' }}>View tagged ↗</a>
                                : <span className="dh-detail-value" style={{ color: '#d1d5db' }}>Pending…</span>
                              }
                            </div>
                            {dashSelectedDefect.image_url && (
                              <div className="dh-detail-row">
                                <span className="dh-detail-label">Original</span>
                                <a href={dashSelectedDefect.image_url} target="_blank" rel="noreferrer" className="dh-detail-value" style={{ color: '#2563eb' }}>View original ↗</a>
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
                        {(() => {
                          const typeCounts = { scratch: 0, bubble: 0, crack: 0 };
                          filteredDefects.forEach(d => {
                            const t = (d.defect_type || '').toLowerCase();
                            if (typeCounts[t] !== undefined) typeCounts[t]++;
                          });
                          const dataMax = Math.max(...Object.values(typeCounts), 0);
                          // Nice ceiling: smallest of these steps >= dataMax
                          const steps = [5, 10, 20, 50, 100, 200, 500, 1000];
                          const chartMax = steps.find(s => s >= dataMax) || Math.ceil(dataMax / 100) * 100;
                          const ticks = [0, chartMax / 4, chartMax / 2, (chartMax * 3) / 4, chartMax];
                          return (
                            <>
                              {[
                                { label: 'Scratch', key: 'scratch' },
                                { label: 'Bubble', key: 'bubble' },
                                { label: 'Cracks', key: 'crack' },
                              ].map(({ label, key }) => (
                                <div className="chart-bar-wrapper" key={key}>
                                  <div className="dashboard-bar-fill" style={{ width: `${(typeCounts[key] / chartMax) * 100}%` }}></div>
                                  <span className="chart-bar-value">{typeCounts[key]}</span>
                                </div>
                              ))}
                              <div className="chart-x-axis">
                                {ticks.map((t, i) => (
                                  <span key={i}>{Number.isInteger(t) ? t : Math.round(t)}</span>
                                ))}
                              </div>
                            </>
                          );
                        })()}
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
