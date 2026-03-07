

export function restoreAuthState() {
  
  if (sessionStorage.getItem('loggedIn') === 'true') {
    return true;
  }

  
  if (localStorage.getItem('loggedIn') === 'true') {
    sessionStorage.setItem('userId', localStorage.getItem('userId') || '');
    sessionStorage.setItem('userEmail', localStorage.getItem('userEmail') || '');
    sessionStorage.setItem('userRole', localStorage.getItem('userRole') || '');
    sessionStorage.setItem('loggedIn', 'true');
    return true;
  }

  return false;
}

export function restoreAdminAuthState() {
  
  if (sessionStorage.getItem('adminLoggedIn') === 'true') {
    return true;
  }

  
  if (localStorage.getItem('adminLoggedIn') === 'true') {
    sessionStorage.setItem('userId', localStorage.getItem('userId') || '');
    sessionStorage.setItem('userEmail', localStorage.getItem('userEmail') || '');
    sessionStorage.setItem('userRole', localStorage.getItem('userRole') || '');
    sessionStorage.setItem('adminToken', localStorage.getItem('adminToken') || '');
    sessionStorage.setItem('adminLoggedIn', 'true');
    return true;
  }

  return false;
}

export function isUserAuthenticated() {
  return sessionStorage.getItem('loggedIn') === 'true' || localStorage.getItem('loggedIn') === 'true';
}

export function isAdminAuthenticated() {
  return sessionStorage.getItem('adminLoggedIn') === 'true' || localStorage.getItem('adminLoggedIn') === 'true';
}
