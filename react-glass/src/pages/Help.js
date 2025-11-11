import React from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { signOutUser } from '../supabase';
import './Dashboard.css';
import './Login.css';

function Help() {
  const navigate = useNavigate();

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
        ]}
        bottomItems={[
          { key: 'help', label: '? Help', onClick: () => navigate('/help') },
        ]}
        activeKey="help"
      />

      <main className="machine-main-content">
        <header className="machine-header">
          <div className="machine-header-left">
            <h1 className="machine-header-title">Help Center</h1>
            <p className="machine-header-subtitle">Support form is temporarily unavailable</p>
          </div>
        </header>

        <div className="machine-content-area">
          <div className="machine-content-wrapper">
            <div className="machine-defects-panel" style={{ width: '100%', maxWidth: 720 }}>
              <h2 className="machine-section-title">Support temporarily unavailable</h2>
              <p style={{ marginBottom: 16 }}>
                The help form has been temporarily removed. Please check back later, or return to the dashboard.
              </p>
              <div>
                <button
                  type="button"
                  className="action-button clear-button"
                  onClick={() => navigate('/dashboard')}
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Help;
