import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/AlumpreneurLogo.png';
import './Login.css';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (event) => {
    event.preventDefault();

    if (username && password) {
      if (remember) {
        localStorage.setItem('rememberMe', 'true');
        localStorage.setItem('username', username);
      } else {
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('username');
      }

      sessionStorage.setItem('loggedIn', 'true');
      navigate('/dashboard');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          {/* ✅ Use imported logo */}
          <img src={logo} alt="Alumpreneur Logo" />
        </div>
        <h1 className="login-title">Glass Defect Detector</h1>
        <form className="login-form" id="loginForm" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="username">Username</label>
            <input
              className="form-input"
              type="text"
              id="username"
              placeholder="Enter your username"
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              className="form-input"
              type="password"
              id="password"
              placeholder="Enter your password"
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
          <button type="submit" className="login-button">Sign In</button>
        </form>
      </div>
    </div>
  );
}

export default Login;
