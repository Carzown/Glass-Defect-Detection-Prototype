import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/AlumpreneurLogo.png';
import './Login.css';
import { signInAndGetRole, getCurrentUser } from '../firebase';

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

  // If already logged in (check Supabase session), auto-redirect based on stored role
  // But only if the user hasn't intentionally logged out
  useEffect(() => {
    const checkAuthState = async () => {
      try {
        const user = await getCurrentUser();
        const hasLoggedIn = sessionStorage.getItem('loggedIn') === 'true';
        
        // Only auto-redirect if user is authenticated AND we have a valid session marker
        // This prevents auto-login after intentional logout
        if (user && hasLoggedIn) {
          const roleStored = sessionStorage.getItem('role') || 'employee';
          if (roleStored === 'admin') navigate('/admin');
          else navigate('/dashboard');
        }
      } catch (error) {
        // User not authenticated, stay on login page
        console.log('User not authenticated');
      }
    };
    
    checkAuthState();
  }, [navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      // Authenticate with Firebase
      const res = await signInAndGetRole(email, password);
      let actualRole = res.role || 'employee';
      
      // Hard-code admin email mapping (override database role if needed)
      if (res.email && res.email.toLowerCase() === 'qvcdclarito@tip.edu.ph') {
        actualRole = 'admin';
      }

      // Handle "Remember me" functionality
      if (remember) {
        localStorage.setItem('rememberMe', 'true');
        localStorage.setItem('email', email);
      } else {
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('email');
      }

      // Set session storage for app state
      sessionStorage.setItem('loggedIn', 'true');
      sessionStorage.setItem('role', actualRole);
      sessionStorage.setItem('userId', res.uid);

      // Show role mismatch warnings if user selected wrong tab
      if (role === 'admin' && actualRole !== 'admin') {
        alert('You are not authorized as Admin. Redirecting to Employee Dashboard.');
      }
      if (role === 'employee' && actualRole === 'admin') {
        alert('Admins cannot use the Employee Dashboard. Redirecting to Admin.');
      }

      // Navigate based on actual role
      if (actualRole === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Login error:', error);
      
      // Handle specific Firebase auth errors
      let errorMessage = 'Login failed';
      if (error.message) {
        if (error.message.includes('auth/invalid-email') || error.message.includes('auth/user-not-found')) {
          errorMessage = 'Invalid email or password';
        } else if (error.message.includes('auth/wrong-password')) {
          errorMessage = 'Invalid email or password';
        } else if (error.message.includes('auth/too-many-requests')) {
          errorMessage = 'Too many login attempts. Please try again later';
        } else if (error.message.includes('auth/operation-not-allowed')) {
          errorMessage = 'Login is currently disabled';
        } else {
          errorMessage = error.message;
        }
      }
      
      setError(errorMessage);
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
        
        <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>
          <p>Powered by Firebase Authentication</p>
        </div>
      </div>
    </div>
  );
}

export default Login;

// Inline modal to avoid new files; styles added to Login.css below.