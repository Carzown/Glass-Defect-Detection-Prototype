document.getElementById('loginForm').addEventListener('submit', function(event) {
  event.preventDefault();

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const remember = document.getElementById('remember').checked;

  if (username && password) {
    if (remember) {
      localStorage.setItem('rememberMe', 'true');
      localStorage.setItem('username', username);
    } else {
      localStorage.removeItem('rememberMe');
      localStorage.removeItem('username');
    }

    // Mark the user as logged in; set role to admin for the Admin Dashboard
    sessionStorage.setItem('loggedIn', 'true');
    sessionStorage.setItem('role', 'admin');
    // Redirect to the Dashboard (Admin view)
    window.location.href = 'Dashboard.html';
  }
});
