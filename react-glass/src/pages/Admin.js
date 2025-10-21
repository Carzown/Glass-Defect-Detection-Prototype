import React from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import './Dashboard.css';

function Admin() {
  const navigate = useNavigate();

  function handleLogout() {
    sessionStorage.removeItem('loggedIn');
    sessionStorage.removeItem('role');
    navigate('/');
  }

  return (
    <div className="machine-container">
      <Sidebar
        onLogout={handleLogout}
        mainItems={[
          { key: 'admin', label: 'Admin', onClick: () => navigate('/admin') },
        ]}
        bottomItems={[]}
        activeKey="admin"
      />

      <main className="machine-main-content">
        <header className="machine-header">
          <div className="machine-header-left">
            <h1 className="machine-header-title">Alternate Dashboard</h1>
            <p className="machine-header-subtitle">Admin</p>
          </div>
        </header>

        <div className="machine-content-area">
          <div className="machine-content-wrapper">
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px dashed #e5a445',
              borderRadius: 8,
              background: '#fff7ed'
            }}>
              <div style={{ textAlign: 'center' }}>
                <h2 className="machine-section-title">Admin Page Placeholder</h2>
                <p style={{ color: '#6b7280' }}>Use this page for admin layout or metrics.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Admin;
