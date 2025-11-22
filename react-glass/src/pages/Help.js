import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { signOutUser } from '../supabase';
import './Dashboard.css';
import './Login.css';
import Chat from '../components/Chat';

function Help() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

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

  async function handleSend(e) {
    e.preventDefault();
    if (!email || !message) return;
    setSending(true);
    try {
      // Simulate API call
      await new Promise((res) => setTimeout(res, 700));
      alert('Your message has been sent to the admin.');
      setSubject('');
      setMessage('');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="machine-container">
      <Sidebar
        onLogout={handleLogout}
        mainItems={[
          { key: 'dashboard', label: 'Dashboard', onClick: () => navigate('/dashboard') },
        ]}
        bottomItems={[
          { key: 'help', label: 'Help', onClick: () => navigate('/help') },
        ]}
        activeKey="dashboard"
      />

      <main className="machine-main-content">
        <header className="machine-header">
          <div className="machine-header-left">
            <h1 className="machine-header-title">Help Center</h1>
            <p className="machine-header-subtitle">Ask the admin a question</p>
          </div>
        </header>

        <div className="machine-content-area">
          <div className="machine-content-wrapper">
            <div className="machine-defects-panel" style={{ flex: 1, minWidth: 0 }}>
              <h2 className="machine-section-title">Help Chat</h2>
              <Chat sender="User" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Help;
