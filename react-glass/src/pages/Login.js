import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/AlumpreneurLogo.png';
import './Login.css';
import { signInAndGetRole } from '../firebase';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [role, setRole] = useState('employee'); // UI hint only; actual role comes from DB
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();

  // Prefill from localStorage when user previously selected "Remember me"
  useEffect(() => {
    const remembered = localStorage.getItem('rememberMe') === 'true';
    const savedEmail = localStorage.getItem('email') || '';
    if (remembered) {
      setRemember(true);
      if (savedEmail) setEmail(savedEmail);
    }
  }, []);

  // If already logged in (same tab), auto-redirect based on stored role
  useEffect(() => {
    const loggedIn = sessionStorage.getItem('loggedIn') === 'true';
    if (loggedIn) {
      const roleStored = sessionStorage.getItem('role') || 'employee';
      if (roleStored === 'admin') navigate('/admin');
      else navigate('/dashboard');
    }
  }, [navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await signInAndGetRole(email, password);
      const actualRole = res.role || 'employee';

      if (remember) {
        localStorage.setItem('rememberMe', 'true');
        localStorage.setItem('email', email);
      } else {
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('email');
      }

      sessionStorage.setItem('loggedIn', 'true');
      sessionStorage.setItem('role', actualRole);

      if (actualRole === 'admin') {
  navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (e) {
      console.error(e);
      setError(e?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <img src={logo} alt="Alumpreneur Logo" />
        </div>
        <h1 className="login-title">Glass Defect Detector</h1>

        <div className="login-role-tabs" role="tablist" aria-label="Sign in as">
          <button
            type="button"
            role="tab"
            aria-selected={role === 'admin'}
            className={`role-tab ${role === 'admin' ? 'active' : ''}`}
            onClick={() => setRole('admin')}
          >
            Admin
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={role === 'employee'}
            className={`role-tab ${role === 'employee' ? 'active' : ''}`}
            onClick={() => setRole('employee')}
          >
            Employee
          </button>
        </div>
        <form className="login-form" id="loginForm" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">{role === 'admin' ? 'Email Address' : 'Email Address'}</label>
            <input
              className="form-input"
              type="email"
              id="email"
              placeholder={role === 'admin' ? 'Email' : 'Email'}
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              className="form-input"
              type="password"
              id="password"
              placeholder="Password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          <div className="form-checkbox-wrapper">
            <input
              className="form-checkbox"
              type="checkbox"
              id="remember"
              checked={remember}
              onChange={e => setRemember(e.target.checked)}
            />
            <label className="form-checkbox-label" htmlFor="remember">Remember me</label>
          </div>
          {error && (
            <div style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{error}</div>
          )}
          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Signing In…' : 'Sign In'}
          </button>
        </form>
        
      </div>
    </div>
  );
}

export default Login;

// Inline modal to avoid new files; styles added to Login.css below.