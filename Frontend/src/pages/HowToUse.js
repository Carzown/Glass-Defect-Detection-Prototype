import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { signOutUser } from '../supabase';
import './Dashboard.css';

function HowToUse() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Check if employee is authenticated
  useEffect(() => {
    if (sessionStorage.getItem('loggedIn') !== 'true') {
      navigate('/');
    }
  }, [navigate]);

  async function handleLogout() {
    try {
      // Sign out from Supabase
      await signOutUser();
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    // Clear session storage
    sessionStorage.removeItem('loggedIn');
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('userId');
    
    // If "Remember me" is not enabled, clear the email too
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
        activeKey="how-to-use"
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
      />
      <main className="machine-main-content">
        <header className="machine-header">
          <button className="sidebar-hamburger" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle sidebar">
            <span /><span /><span />
          </button>
          <div className="machine-header-left">
            <h1 className="machine-header-title">How to Use</h1>
            <p className="machine-header-subtitle">Step-by-step guide for glass defect detection</p>
          </div>
        </header>
        <div style={{ flex: 1, padding: '30px', overflowY: 'auto' }}>
        </div>
      </main>
    </div>
  );
}

export default HowToUse;
