import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBackendURL } from '../utils/formatters';
import logo from '../assets/AlumpreneurLogo.png';
import './Login.css';

const BACKEND_URL = getBackendURL();

function Login() {
  const [role, setRole] = useState('employee'); // 'admin' | 'employee'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  // Restore saved email if "Remember me" was previously selected
  useEffect(() => {
    const remembered = localStorage.getItem('rememberMe') === 'true';
    const savedEmail = localStorage.getItem('email') || '';
    if (remembered) {
      setRemember(true);
      if (savedEmail) setEmail(savedEmail);
    }
  }, []);

  // Auto-redirect if already logged in
  useEffect(() => {
    const checkAuthState = async () => {
      try {
        if (sessionStorage.getItem('adminLoggedIn') === 'true') {
          navigate('/admin-dashboard');
          return;
        }
        if (sessionStorage.getItem('loggedIn') === 'true') {
          navigate('/dashboard');
          return;
        }
      } catch {
        // not authenticated
      }
    };
    checkAuthState();
  }, [navigate]);

  // Clear errors when switching roles
  const handleRoleSwitch = (newRole) => {
    setRole(newRole);
    setError('');
  };

  const handleBackendLogin = async (event, loginRole) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          role: loginRole,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        let msg = data.error || 'Login failed. Please try again.';
        if (msg.includes('Invalid credentials')) msg = 'Invalid email or password.';
        else if (msg.includes('too-many-requests')) msg = 'Too many login attempts. Please try again later.';
        else if (msg.includes('email not confirmed')) msg = 'Please verify your email before logging in.';
        else if (msg.includes('admin access')) msg = 'This account does not have admin access.';
        setError(msg);
        setLoading(false);
        return;
      }

      // Save user info and session
      if (remember) {
        localStorage.setItem('rememberMe', 'true');
        localStorage.setItem('email', email);
      } else {
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('email');
      }

      // Store session tokens (sessionStorage - session-only)
      if (data.session?.accessToken) {
        sessionStorage.setItem('accessToken', data.session.accessToken);
        if (data.session.refreshToken) {
          sessionStorage.setItem('refreshToken', data.session.refreshToken);
        }
      }

      // Store user info (sessionStorage + localStorage for persistence across refresh)
      sessionStorage.setItem('userId', data.user.id);
      sessionStorage.setItem('userEmail', data.user.email);
      sessionStorage.setItem('userRole', data.user.role);
      
      // Persist auth state to localStorage so refresh doesn't lose login
      localStorage.setItem('userId', data.user.id);
      localStorage.setItem('userEmail', data.user.email);
      localStorage.setItem('userRole', data.user.role);

      // Redirect based on role
      if (data.user.role === 'admin') {
        sessionStorage.setItem('adminLoggedIn', 'true');
        sessionStorage.setItem('adminToken', data.user.id);
        localStorage.setItem('adminLoggedIn', 'true');
        localStorage.setItem('adminToken', data.user.id);
        navigate('/admin-dashboard');
      } else {
        sessionStorage.setItem('loggedIn', 'true');
        localStorage.setItem('loggedIn', 'true');
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('[Login] Backend login error:', err);
      let msg = 'Login failed. Please try again.';
      if (err.message) {
        if (err.message.includes('Failed to fetch')) {
          msg = 'Cannot reach the server. Please check your connection.';
        }
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeSubmit = (event) => handleBackendLogin(event, 'employee');
  const handleAdminSubmit = (event) => handleBackendLogin(event, 'admin');

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <img src={logo} alt="Alumpreneur Logo" />
        </div>
        <h1 className="login-title">Glass Defect Detector</h1>

        {/* Role tab slider */}
        <div className="login-role-tabs">
          <button
            type="button"
            className={`role-tab${role === 'admin' ? ' active' : ''}`}
            onClick={() => handleRoleSwitch('admin')}
          >
            Admin
          </button>
          <button
            type="button"
            className={`role-tab${role === 'employee' ? ' active' : ''}`}
            onClick={() => handleRoleSwitch('employee')}
          >
            Employee
          </button>
        </div>

        {/* Single stable form — handler switches based on role */}
        <form
          className="login-form"
          onSubmit={role === 'admin' ? handleAdminSubmit : handleEmployeeSubmit}
        >
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email Address</label>
            <input
              className="form-input"
              type="email"
              id="login-email"
              placeholder="Email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <input
              className="form-input"
              type="password"
              id="login-password"
              placeholder="Password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
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
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="login-button" disabled={loading}>
            {loading ? (role === 'admin' ? 'Verifying…' : 'Signing In…') : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>
          <p>Powered by Supabase Authentication</p>
        </div>
      </div>
    </div>
  );
}

export default Login;

