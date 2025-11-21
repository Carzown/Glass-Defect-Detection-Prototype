// Admin users list script (static HTML version)

function checkAuth() {
  if (sessionStorage.getItem('loggedIn') !== 'true') {
    window.location.href = 'Login.html';
  }
}

function handleLogout() {
  sessionStorage.removeItem('loggedIn');
  sessionStorage.removeItem('role');
  window.location.href = 'Login.html';
}

async function fetchUsers() {
  const tbody = document.getElementById('usersTbody');
  const message = document.getElementById('adminMessage');
  if (!tbody) return;
  message.textContent = '';
  tbody.innerHTML = '<tr><td colspan="3" style="padding:16px; color:#6b7280">Loading users…</td></tr>';

  try {
    // Try to fetch from a backend admin endpoint; if not available, fall back to mock data
    const resp = await fetch('/admin/users');
    if (!resp.ok) throw new Error('Network response not ok');
    const js = await resp.json();
    const users = js.users || js || [];
    renderUsers(users);
  } catch (e) {
    // Fallback: mock users or attempt to read from localStorage
    const fallback = JSON.parse(localStorage.getItem('mockUsers') || '[]');
    if (fallback.length > 0) {
      renderUsers(fallback);
      message.textContent = 'Using local mock users';
    } else {
      // No users available
      tbody.innerHTML = '<tr><td colspan="3" style="padding:16px; color:#6b7280; text-align:left">No employees found. Click "Refresh Users" to try again.</td></tr>';
      message.textContent = 'Could not load users from backend';
    }
  }
}

function renderUsers(users) {
  const tbody = document.getElementById('usersTbody');
  if (!tbody) return;
  if (!users || users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="padding:16px; color:#6b7280; text-align:left">No employees found. Click "Refresh Users" to load data.</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(u => `
    <tr>
      <td class="td-email">${escapeHtml(u.email || '—')}</td>
      <td>${escapeHtml(u.role || '—')}</td>
      <td style="font-size:12px; color:#6b7280">${u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : '—'}</td>
    </tr>
  `).join('');
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

document.addEventListener('DOMContentLoaded', function() {
  checkAuth();
  const btn = document.getElementById('refreshUsersButton');
  if (btn) btn.addEventListener('click', fetchUsers);
  // Auto-fetch once on load
  fetchUsers();
  // Wire logout button in the sidebar
  window.handleLogout = handleLogout;
});