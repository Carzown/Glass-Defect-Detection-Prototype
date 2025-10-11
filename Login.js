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

    sessionStorage.setItem('loggedIn', 'true');
    window.location.href = 'Dashboard.html';
  }
});
