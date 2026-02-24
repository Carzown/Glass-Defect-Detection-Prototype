import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import './Dashboard.css';

function AdminHowToUse() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Check if admin is authenticated
  useEffect(() => {
    if (sessionStorage.getItem('adminToken') === null) {
      navigate('/');
    }
  }, [navigate]);

  function handleLogout() {
    // Clear admin session
    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminLoggedIn');
    navigate('/');
  }

  return (
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
        activeKey="admin-how-to-use"
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
      />
      <main className="machine-main-content">
        <header className="machine-header">
          <button className="sidebar-hamburger" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle sidebar">
            <span /><span /><span />
          </button>
          <div className="machine-header-left">
            <h1 className="machine-header-title">How to Use (Admin)</h1>
            <p className="machine-header-subtitle">Administrator guide for glass defect monitoring</p>
          </div>
        </header>
        <div style={{ flex: 1, padding: '30px', overflowY: 'auto' }}>
        </div>
      </main>
    </div>
  );
}

export default AdminHowToUse;
