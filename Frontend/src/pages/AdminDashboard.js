import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import DateRangePicker from '../components/DateRangePicker';
import AdminEmployeeManagement from '../components/AdminEmployeeManagement';
import { formatRelativeTime, getBackendURL, capitalizeDefectType } from '../utils/formatters';
import { restoreAdminAuthState, isAdminAuthenticated } from '../utils/auth';
import { fetchDefects, fetchDefectsByRange, fetchDefectsByDateRange, fetchDeviceStatus, subscribeToDeviceStatus, subscribeToDefects, connectWebSocket } from '../services/defects';
import './AdminDashboard.css';

const BACKEND_URL = getBackendURL();

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
  const [refreshTick, setRefreshTick] = useState(0);

  
  const [deviceStatus, setDeviceStatus] = useState(null);
  const [deviceStatusLoading, setDeviceStatusLoading] = useState(true);
  const [timeTick, setTimeTick] = useState(0);

  // Tick every 60 s so relative timestamps ("X minutes ago") stay current
  useEffect(() => {
    const id = setInterval(() => setTimeTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  
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

  
  useEffect(() => {
    if (!authChecked) return;
    loadLastDetection();
  }, [authChecked]);

  
  const timeFilterRef = useRef(timeFilter);
  useEffect(() => { timeFilterRef.current = timeFilter; }, [timeFilter]);

  
  useEffect(() => {
    if (!authChecked) return;
    const pollId = setInterval(() => {
      loadLastDetection();
      setRefreshTick(t => t + 1);
    }, 30_000);
    const onNew = (newDefect) => {
      setLastDetectionTime(newDefect.detected_at);
      if (timeFilterRef.current === 'today') {
        setFilteredDefects(prev =>
          prev.some(d => d.id === newDefect.id) ? prev : [newDefect, ...prev]
        );
      } else if (timeFilterRef.current !== 'custom-range') {
        setRefreshTick(t => t + 1);
      }
    };
    const unsubWS = connectWebSocket({ onNew, onDeviceStatus: (status) => setDeviceStatus(status) });
    const unsubSupa = subscribeToDefects({ onNew });
    return () => {
      clearInterval(pollId);
      unsubWS();
      unsubSupa();
    };
  }, [authChecked]);

  
  useEffect(() => {
    if (!authChecked) return;
    
    let cancelled = false;
    setDeviceStatusLoading(true);
    fetchDeviceStatus('raspi-pi-1').then((status) => {
      if (!cancelled) {
        setDeviceStatus(status);
        setDeviceStatusLoading(false);
      }
    });
    const unsubscribe = subscribeToDeviceStatus('raspi-pi-1', (updated) => {
      if (!cancelled) setDeviceStatus(updated);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [authChecked]);

  
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
  }, [authChecked, timeFilter, customFromDate, customToDate, refreshTick]);

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
        {}
        <header className="machine-header">
          <button className="sidebar-hamburger" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle sidebar">
            <span /><span /><span />
          </button>
          <div className="machine-header-left">
            <h1 className="machine-header-title">Admin Dashboard</h1>
            <p className="machine-header-subtitle">Overview &amp; Employee Management</p>
          </div>
        </header>

        {}
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
                  <span className="dashboard-stat-label">Last Detected Defect</span>
                  <span className="dashboard-stat-value">
                    {loading ? '…' : (() => {
                      const latest = filteredDefects[0];
                      if (!latest) return '--';
                      const types = [...new Set((latest.detected_defects || []).map(d => capitalizeDefectType(d.type)))];
                      return types.length > 0 ? types.join(', ') : '--';
                    })()}
                  </span>
                </div>
                <div className="dashboard-stat-card">
                  <span className="dashboard-stat-label">Last Detection</span>
                  <span className="dashboard-stat-value">
                    {/* timeTick causes re-render every 60 s to keep the relative time fresh */}
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
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <span className="dashboard-stat-value dashboard-stat-status" style={{ color: online ? '#22c55e' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: online ? '#22c55e' : '#ef4444', flexShrink: 0 }} />
                        {online ? 'Online' : 'Offline'}
                      </span>
                      {lastSeen && (
                        <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, textAlign: 'center' }}>
                          Last seen: {lastSeen}
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {}
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
