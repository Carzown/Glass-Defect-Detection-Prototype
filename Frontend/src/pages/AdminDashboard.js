import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import DateRangePicker from '../components/DateRangePicker';
import AdminEmployeeManagement from '../components/AdminEmployeeManagement';
import { formatRelativeTime, getBackendURL } from '../utils/formatters';
import { restoreAdminAuthState, isAdminAuthenticated } from '../utils/auth';
import { fetchDefects, fetchDefectsByRange, fetchDefectsByDateRange, fetchDeviceStatus, subscribeToDeviceStatus } from '../services/defects';
import './AdminDashboard.css';

const BACKEND_URL = getBackendURL();

// ── Helpers ──────────────────────────────────────────────────────

function AdminDashboard() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [timeFilter, setTimeFilter] = useState('today');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }));
  const [filteredDefects, setFilteredDefects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [lastDetectionTime, setLastDetectionTime] = useState(null);

  // Raspberry Pi device status
  const [deviceStatus, setDeviceStatus] = useState(null);
  const [deviceStatusLoading, setDeviceStatusLoading] = useState(true);

  // Check if admin is authenticated - restore from localStorage if needed
  useEffect(() => {
    restoreAdminAuthState();
    if (!isAdminAuthenticated()) {
      navigate('/');
      return;
    }
    setAuthChecked(true);
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await fetch(`${BACKEND_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('accessToken') || ''}`,
        },
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      // Logout is always successful locally
    }
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

  // Load last detection on mount (only after auth is verified)
  useEffect(() => {
    if (!authChecked) return;
    loadLastDetection();
  }, [authChecked]);

  // Fetch initial device status and subscribe to real-time updates
  useEffect(() => {
    if (!authChecked) return;
    
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
  }, [authChecked]);

  // Re-fetch whenever the date filter or page navigation changes (only after auth is verified)
  useEffect(() => {
    if (!authChecked) return;
    
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        let data;
        if (timeFilter === 'custom-range') {
          if (!customFromDate || !customToDate) {
            if (!cancelled) { setFilteredDefects([]); setLoading(false); }
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
          setFilteredDefects(data);
        }
      } catch (e) {
        console.error('[AdminDashboard] Failed to load defects:', e);
        if (!cancelled) {
          setFetchError('Failed to load defects. Please check your connection.');
          setFilteredDefects([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [authChecked, timeFilter, customFromDate, customToDate]);



  const sidebarMenuItems = [
    { key: 'admin-dashboard', label: 'Dashboard', onClick: () => navigate('/admin-dashboard') },
    { key: 'admin-detection', label: 'Detection', onClick: () => navigate('/admin-detection') },
    { key: 'admin-detection-history', label: 'Detection History', onClick: () => navigate('/admin-detection-history') },
  ];

  const sidebarBottomItems = [
    { key: 'admin-how-to-use', label: 'How to Use', onClick: () => navigate('/admin-how-to-use') },
  ];

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
          {fetchError && (
            <div style={{ padding: '10px 16px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, color: '#dc2626', fontSize: 14, marginBottom: 12 }}>
              {fetchError}
            </div>
          )}
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
                <span className="dashboard-stat-label">System Status</span>
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
                        {online ? 'Online' : 'Offline'}
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
      )}
    </>
  );
}

export default AdminDashboard;
