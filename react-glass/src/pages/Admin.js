import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { signOutUser, supabase } from '../supabase';
import './Dashboard.css';

const ADMIN_API = (path) => `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}${path}`;

function Admin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [adminToken, setAdminToken] = useState(localStorage.getItem('ADMIN_API_TOKEN') || '');
  const [pwdById, setPwdById] = useState({});

  useEffect(() => {
    const role = sessionStorage.getItem('role');
    if (role !== 'admin') {
      alert('Only Admin can access this page. Redirecting to Employee Dashboard.');
      navigate('/dashboard');
    }
  }, [navigate]);

  async function fetchUsers() {
    setLoading(true);
    setError('');
    try {
      if (adminToken) {
        // Fetch full authentication users list (merged with roles)
        const resp = await fetch(ADMIN_API('/admin/users'), {
          headers: { 'x-admin-token': adminToken },
        });
        const js = await resp.json();
        if (!resp.ok || !js.ok) throw new Error(js.error || 'Failed to load users');
        setUsers(js.users || []);
      } else {
        // Fallback: use Supabase client (admin must be logged in with role admin; RLS policy enables)
        const { data, error } = await supabase.from('profiles').select('id,email,role,created_at');
        if (error) throw new Error(error.message);
        // Employees only; we lack last_sign_in_at without admin API
        const mapped = (data || [])
          .filter(p => p.role === 'employee')
          .map(p => ({ id: p.id, email: p.email, role: p.role, last_sign_in_at: null }));
        setUsers(mapped);
      }
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (adminToken) {
      localStorage.setItem('ADMIN_API_TOKEN', adminToken);
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken]);

  // Auto-fetch on initial mount regardless of token
  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          { key: 'admin', label: 'Admin', onClick: () => navigate('/admin') },
        ]}
        bottomItems={[]}
        activeKey="admin"
      />

      <main className="machine-main-content">
        <header className="machine-header">
          <div className="machine-header-left">
            <h1 className="machine-header-title">Admin Dashboard</h1>
            <p className="machine-header-subtitle">Admin</p>
          </div>
        </header>

        <div className="machine-content-area">
          <div className="machine-content-wrapper">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="action-button upload-button" onClick={fetchUsers} disabled={loading}>
                  {loading ? 'Loading…' : 'Refresh Users'}
                </button>
              </div>

              {error && (
                <div style={{ color: '#dc2626', fontSize: 13 }}>{error}</div>
              )}

              <div style={{ border: '1px solid #d1d5db', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: 0, padding: 12, background: '#f3f4f6', fontWeight: 600, borderBottom: '1px solid #d1d5db' }}>
                  <div>Email</div>
                  <div>Role</div>
                  <div>Last Sign In</div>
                </div>
                <div>
                  {users.length === 0 ? (
                    <div style={{ padding: 16, color: '#6b7280' }}>
                      No employees found. Refresh Users to load data or ensure your account has admin role.
                    </div>
                  ) : (
                    users.map((u) => (
                      <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: 0, padding: 12, borderTop: '1px solid #d1d5db', alignItems: 'center' }}>
                        <div style={{ wordBreak: 'break-all' }}>{u.email || '—'}</div>
                        <div>{u.role}</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : '—'}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Admin;
