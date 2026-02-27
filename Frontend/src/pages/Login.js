import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/AlumpreneurLogo.png';
import './Login.css';
import { signInWithEmail, signInAndGetRole, getCurrentUser } from '../supabase';

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
        const user = await getCurrentUser();
        if (user && sessionStorage.getItem('loggedIn') === 'true') {
          navigate('/dashboard');
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
    setEmail('');
    setPassword('');
  };

  const handleEmployeeSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await signInWithEmail(email, password);

      if (remember) {
        localStorage.setItem('rememberMe', 'true');
        localStorage.setItem('email', email);
      } else {
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('email');
      }

      sessionStorage.setItem('loggedIn', 'true');
      sessionStorage.setItem('userId', user.id);
      navigate('/dashboard');
    } catch (err) {
      let msg = 'Login failed. Please try again.';
      if (err.message) {
        if (err.message.includes('Invalid login credentials')) msg = 'Invalid email or password.';
        else if (err.message.includes('too-many-requests')) msg = 'Too many login attempts. Please try again later.';
        else if (err.message.includes('email not confirmed')) msg = 'Please verify your email before logging in.';
        else if (err.message.includes('already registered')) msg = 'This email is already registered.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleAdminSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await signInAndGetRole(email, password);
      if (result.role !== 'admin') {
        setError('This account does not have admin access.');
        setLoading(false);
        return;
      }
      if (remember) {
        localStorage.setItem('rememberMe', 'true');
        localStorage.setItem('email', email);
      } else {
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('email');
      }
      sessionStorage.setItem('adminLoggedIn', 'true');
      sessionStorage.setItem('adminToken', result.uid);
      sessionStorage.setItem('userId', result.uid);
      navigate('/admin-dashboard');
    } catch (err) {
      let msg = 'Login failed. Please try again.';
      if (err.message) {
        if (err.message.includes('Invalid login credentials')) msg = 'Invalid email or password.';
        else if (err.message.includes('too-many-requests')) msg = 'Too many login attempts. Please try again later.';
        else if (err.message.includes('email not confirmed')) msg = 'Please verify your email before logging in.';
        else if (err.message.includes('already registered')) msg = 'This email is already registered.';
      }
      setError(msg);
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

