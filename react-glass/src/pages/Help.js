import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import './Dashboard.css';
import './Login.css';

function Help() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  function handleLogout() {
    sessionStorage.removeItem('loggedIn');
    navigate('/');
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!email || !message) return;
    setSending(true);
    try {
      // Placeholder for real API call
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
          { key: 'help', label: '? Help', onClick: () => navigate('/help') },
        ]}
        activeKey="help"
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
            <div className="machine-defects-panel" style={{ width: '100%', maxWidth: 720 }}>
              <h2 className="machine-section-title">Send a message</h2>
              <form className="login-form" onSubmit={handleSend}>
                <div className="form-group">
                  <label className="form-label" htmlFor="email">Your Email</label>
                  <input
                    id="email"
                    type="email"
                    className="form-input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="subject">Subject</label>
                  <input
                    id="subject"
                    type="text"
                    className="form-input"
                    placeholder="Brief summary"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="message">Message</label>
                  <textarea
                    id="message"
                    className="form-input"
                    style={{ minHeight: 140, resize: 'vertical' }}
                    placeholder="Describe your question or issue..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    type="submit"
                    className="action-button upload-button"
                    disabled={sending || !email || !message}
                  >
                    {sending ? 'Sending…' : 'Send to Admin'}
                  </button>
                  <button
                    type="button"
                    className="action-button clear-button"
                    onClick={() => navigate('/dashboard')}
                  >
                    Back to Dashboard
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Help;
