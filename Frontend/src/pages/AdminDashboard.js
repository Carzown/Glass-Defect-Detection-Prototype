import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import DateRangePicker from '../components/DateRangePicker';
import { fetchDefects, fetchDefectsByRange, fetchDefectsByDateRange } from '../services/defects';
import './AdminDashboard.css';

// ── Helpers ──────────────────────────────────────────────────────
function capitalizeDefectType(type) {
  if (!type) return type;
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
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

function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [timeFilter, setTimeFilter] = useState('today');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState(new Date().toISOString().split('T')[0]);
  const [filteredDefects, setFilteredDefects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastDetectionTime, setLastDetectionTime] = useState(null);
  const [timeUpdateCounter, setTimeUpdateCounter] = useState(0);

  // Check if admin is authenticated
  useEffect(() => {
    const adminToken = sessionStorage.getItem('adminToken');
    if (!adminToken) {
      navigate('/');
    }
  }, [navigate]);

  const handleLogout = () => {
    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminLoggedIn');
    navigate('/');
  };

  // Load the most recent defect across all time (for "Last detection" indicator)
  const loadLastDetection = async () => {
    try {
      const result = await fetchDefects({ limit: 1, offset: 0, dateFrom: new Date(0).toISOString(), dateTo: new Date().toISOString() });
      const supabaseData = result.data || [];
      if (supabaseData.length > 0) {
        setLastDetectionTime(supabaseData[0].detected_at);
      }
    } catch (error) {
      console.error('[AdminDashboard] Error loading last detection:', error);
    }
  };

  // Load last detection on mount
  useEffect(() => {
    loadLastDetection();
  }, []);

  // Re-fetch filtered defects when date filter changes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
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
        console.error('[AdminDashboard] Failed to load defects:', e);
        if (!cancelled) setFilteredDefects([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [timeFilter, customFromDate, customToDate]);

  // Refresh data when navigating to this page
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
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
        console.error('[AdminDashboard] Failed to load defects:', e);
        setFilteredDefects([]);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [location.pathname]);

  // Update relative times every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeUpdateCounter(prev => prev + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const sidebarMenuItems = [
    { key: 'admin-dashboard', label: 'Dashboard', onClick: () => navigate('/admin-dashboard') },
    { key: 'admin-detection', label: 'Detection', onClick: () => navigate('/admin-detection') },
    { key: 'admin-detection-history', label: 'Detection History', onClick: () => navigate('/admin-detection-history') },
  ];

  const sidebarBottomItems = [
    { key: 'admin-how-to-use', label: 'How to Use', onClick: () => navigate('/admin-how-to-use') },
  ];

  return (
    <div className="machine-container">
      <Sidebar
        onLogout={handleLogout}
        mainItems={sidebarMenuItems}
        bottomItems={sidebarBottomItems}
        activeKey="admin-dashboard"
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      
      <main className="machine-main-content">
        {/* Header */}
        <div className="machine-header">
          <button 
            className="hamburger-menu"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <h1 className="machine-header-title">Admin Dashboard</h1>
          <div className="machine-header-spacer"></div>
        </div>

        {/* Content Area */}
        <div className="dashboard-container">
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
            </div>
          </div>

          {/* Defect Sessions - Full width */}
          <div className="dashboard-box-wrapper dashboard-box-wrapper-full">
            <h2 className="dashboard-box-title">Detection Sessions ({filteredDefects.length})</h2>
            <div className="dashboard-box dashboard-sessions-box">
              {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>Loading sessions...</div>
              ) : filteredDefects.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>No defects in this period</div>
              ) : (
                <div className="sessions-container">
                  {groupByDate(filteredDefects).map(([dateKey, dayDefects]) => (
                    <div key={dateKey} className="session-group">
                      <div className="session-date-header">{dateKey}</div>
                      <div className="session-items">
                        {dayDefects.map((defect, idx) => (
                          <div key={defect.id || idx} className="session-item">
                            <span className="session-index">{idx + 1}</span>
                            <div className="session-info">
                              <span className="session-type">{capitalizeDefectType(defect.defect_type)}</span>
                              <span className="session-time">
                                {new Date(defect.detected_at).toLocaleTimeString('en-US', { 
                                  hour: '2-digit', 
                                  minute: '2-digit', 
                                  second: '2-digit' 
                                })}
                              </span>
                            </div>
                            {defect.confidence != null && (
                              <span className="session-confidence">{(defect.confidence * 100).toFixed(0)}%</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default AdminDashboard;
