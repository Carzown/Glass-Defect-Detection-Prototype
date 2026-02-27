// Dashboard: Dashboard page with sidebar and header
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import Sidebar from '../components/Sidebar';
import DateRangePicker from '../components/DateRangePicker';
import { signOutUser } from '../supabase';
import { fetchDefects, fetchDefectsByRange, fetchDefectsByDateRange, fetchDeviceStatus, subscribeToDeviceStatus } from '../services/defects';
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

function formatRelativeTime(dateStr) {
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

// Aggregate defects by type for bar chart
function aggregateDefectsByType(defects) {
  const counts = {};
  defects.forEach((d) => {
    const type = capitalizeDefectType(d.defect_type) || 'Unknown';
    counts[type] = (counts[type] || 0) + 1;
  });
  return Object.entries(counts).map(([type, count]) => ({ type, count }));
}

function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [timeFilter, setTimeFilter] = useState('today');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState(new Date().toISOString().split('T')[0]);

  // Check if employee is authenticated
  useEffect(() => {
    if (sessionStorage.getItem('loggedIn') !== 'true') {
      navigate('/');
    }
  }, [navigate]);

  // Sessions widget state
  const [dashSelectedSession, setDashSelectedSession] = useState(null);
  const [dashSelectedDefect, setDashSelectedDefect] = useState(null);
  const [filteredDefects, setFilteredDefects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastDetectionTime, setLastDetectionTime] = useState(null);

  // Raspberry Pi device status (from device_status table)
  const [deviceStatus, setDeviceStatus] = useState(null); // { is_online, last_seen }
  const [deviceStatusLoading, setDeviceStatusLoading] = useState(true);

  // Fetch initial device status and subscribe to real-time updates
  useEffect(() => {
    let cancelled = false;
    setDeviceStatusLoading(true);
    fetchDeviceStatus('raspi').then((status) => {
      if (!cancelled) {
        setDeviceStatus(status);
        setDeviceStatusLoading(false);
      }
    });
    const unsubscribe = subscribeToDeviceStatus('raspi', (updated) => {
      if (!cancelled) setDeviceStatus(updated);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the most recent defect across all time (for "Last detection" indicator)
  const loadLastDetection = async () => {
    try {
      const result = await fetchDefects({ limit: 1, offset: 0, dateFrom: new Date(0).toISOString(), dateTo: new Date().toISOString() });
      const supabaseData = result.data || [];
      if (supabaseData.length > 0) {
        setLastDetectionTime(supabaseData[0].detected_at);
      }
    } catch (error) {
      console.error('[Dashboard] Error loading last detection:', error);
    }
  };

  // Load last detection on mount
  useEffect(() => {
    loadLastDetection();
  }, []);

  // Re-fetch from Supabase every time the date filter changes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      // Reset drill-down selections whenever the range changes
      setDashSelectedSession(null);
      setDashSelectedDefect(null);
      try {
        let data;
        if (timeFilter === 'custom-range') {
          if (!customFromDate || !customToDate) {
            setFilteredDefects([]);
            setLoading(false);
            return;
          }
          data = await fetchDefectsByDateRange(new Date(customFromDate), new Date(customToDate));
        } else {
          data = await fetchDefectsByRange(timeFilter);
        }
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
  }, [timeFilter, customFromDate, customToDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh data when navigating to this page
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setDashSelectedSession(null);
      setDashSelectedDefect(null);
      try {
        let data;
        if (timeFilter === 'custom-range') {
          if (!customFromDate || !customToDate) {
            setFilteredDefects([]);
            setLoading(false);
            return;
          }
          data = await fetchDefectsByDateRange(new Date(customFromDate), new Date(customToDate));
        } else {
          data = await fetchDefectsByRange(timeFilter);
        }
        setFilteredDefects(data);
      } catch (e) {
        console.error('[Dashboard] Failed to load defects:', e);
        setFilteredDefects([]);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps



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
        bottomItems={[
          { key: 'how-to-use', label: 'How to Use', onClick: () => navigate('/how-to-use') },
        ]}
        activeKey="dashboard"
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
      />

      <main className="machine-main-content">
        <header className="machine-header">
          <button className="sidebar-hamburger" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle sidebar">
            <span /><span /><span />
          </button>
          <div className="machine-header-left">
            <h1 className="machine-header-title">Dashboard</h1>
            <p className="machine-header-subtitle">Overview and analytics</p>
          </div>
        </header>

        <div className="machine-content-area">
          {/* Top Container - Full Width */}
          <div className="dashboard-box-wrapper dashboard-box-wrapper-full">
            <div className="dashboard-title-row" style={{ gap: '12px', alignItems: 'center' }}>
              <h2 className="dashboard-box-title">Statistics</h2>
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
                    {lastDetectionTime ? formatRelativeTime(lastDetectionTime) : '--'}
                  </span>
                </div>
              </div>
              <div className="dashboard-box dashboard-status-box">
                <span className="dashboard-stat-label">Raspberry Pi Status</span>
                {deviceStatusLoading ? (
                  <span className="dashboard-stat-value dashboard-stat-status" style={{ color: '#94a3b8' }}>…</span>
                ) : (() => {
                  const online = deviceStatus?.is_online === true;
                  const lastSeen = deviceStatus?.last_seen
                    ? new Date(deviceStatus.last_seen).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : null;
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span className="dashboard-stat-value dashboard-stat-status" style={{ color: online ? '#22c55e' : '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: online ? '#22c55e' : '#ef4444', flexShrink: 0 }} />
                        {online ? 'Online' : deviceStatus ? 'Offline' : 'Unknown'}
                      </span>
                      {lastSeen && (
                        <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                          Last seen: {lastSeen}
                        </span>
                      )}
                    </div>
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
                {filteredDefects.length > 0 ? (
                  <div className="dashboard-bar-chart">
                    <div className="chart-y-axis-label">Count</div>
                    <div className="chart-body">
                      <div className="chart-y-axis">
                        {[0, Math.ceil(Math.max(...aggregateDefectsByType(filteredDefects).map(d => d.count)) / 4), Math.ceil(Math.max(...aggregateDefectsByType(filteredDefects).map(d => d.count)) / 2), Math.max(...aggregateDefectsByType(filteredDefects).map(d => d.count))].map((tick) => (
                          <div key={tick} className="chart-y-tick">{tick}</div>
                        ))}
                      </div>
                      <div className="chart-area">
                        <div className="chart-grid">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="chart-gridline" />
                          ))}
                        </div>
                        <div className="chart-bars">
                          {aggregateDefectsByType(filteredDefects).map((item) => {
                            const maxCount = Math.max(...aggregateDefectsByType(filteredDefects).map(d => d.count));
                            const width = (item.count / maxCount) * 100;
                            return (
                              <div key={item.type} className="chart-bar-wrapper">
                                <div
                                  className="dashboard-bar-fill"
                                  style={{ width: `${width}%` }}
                                />
                                <span className="chart-bar-value">{item.count}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '80px', marginTop: '8px', minHeight: '28px' }} className="chart-x-axis">
                      {aggregateDefectsByType(filteredDefects).map((item) => (
                        <span key={item.type} style={{ fontSize: '11px', color: '#6b7280', textAlign: 'center', minWidth: '60px' }}>{item.type}</span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{
                    height: 300,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                    fontSize: 14,
                  }}>
                    No defects detected in this date range
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
