/**
 * Authentication utilities and hooks
 */

/**
 * Safely restore authentication state from localStorage to sessionStorage
 * Used when sessionStorage is cleared (e.g., on page refresh)
 */
export function restoreAuthState() {
  // Check if already logged in via sessionStorage
  if (sessionStorage.getItem('loggedIn') === 'true') {
    return true;
  }

  // Try to restore from localStorage
  if (localStorage.getItem('loggedIn') === 'true') {
    sessionStorage.setItem('userId', localStorage.getItem('userId') || '');
    sessionStorage.setItem('userEmail', localStorage.getItem('userEmail') || '');
    sessionStorage.setItem('userRole', localStorage.getItem('userRole') || '');
    sessionStorage.setItem('loggedIn', 'true');
    return true;
  }

  return false;
}

/**
 * Safely restore admin authentication state from localStorage to sessionStorage
 */
export function restoreAdminAuthState() {
  // Check if already logged in via sessionStorage
  if (sessionStorage.getItem('adminLoggedIn') === 'true') {
    return true;
  }

  // Try to restore from localStorage
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

/**
 * Check if user is authenticated (either via sessionStorage or localStorage)
 */
export function isUserAuthenticated() {
  return sessionStorage.getItem('loggedIn') === 'true' || localStorage.getItem('loggedIn') === 'true';
}

/**
 * Check if admin is authenticated (either via sessionStorage or localStorage)
 */
export function isAdminAuthenticated() {
  return sessionStorage.getItem('adminLoggedIn') === 'true' || localStorage.getItem('adminLoggedIn') === 'true';
}
