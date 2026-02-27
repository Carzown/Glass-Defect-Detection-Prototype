import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import DateRangePicker from '../components/DateRangePicker';
import AdminEmployeeManagement from '../components/AdminEmployeeManagement';
import { fetchDefects, fetchDefectsByRange, fetchDefectsByDateRange, fetchDeviceStatus, subscribeToDeviceStatus } from '../services/defects';
import './AdminDashboard.css';

// ── Helpers ──────────────────────────────────────────────────────
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

  // Raspberry Pi device status
  const [deviceStatus, setDeviceStatus] = useState(null);
  const [deviceStatusLoading, setDeviceStatusLoading] = useState(true);

  // Check if admin is authenticated
  useEffect(() => {
    const adminLoggedIn = sessionStorage.getItem('adminLoggedIn') === 'true';
    const adminToken = sessionStorage.getItem('adminToken');
    if (!adminLoggedIn && !adminToken) {
      navigate('/');
    }
  }, [navigate]);

  const handleLogout = () => {
    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminLoggedIn');
    sessionStorage.removeItem('userId');
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
  }, [location.pathname, customFromDate, customToDate, timeFilter]);

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
        <header className="machine-header">
          <button className="sidebar-hamburger" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle sidebar">
            <span /><span /><span />
          </button>
          <div className="machine-header-left">
            <h1 className="machine-header-title">Admin Dashboard</h1>
            <p className="machine-header-subtitle">Overview &amp; Employee Management</p>
          </div>
        </header>

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

          {/* Employee Management Section */}
          <div className="dashboard-box-wrapper dashboard-box-wrapper-full admin-emp-expand">
            <h2 className="dashboard-box-title">Employee Management</h2>
            <div className="dashboard-box dashboard-employee-box">
              <AdminEmployeeManagement />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default AdminDashboard;
