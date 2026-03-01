/**
 * Centralized utility functions for formatting and transforming data
 */

/**
 * Capitalize first letter and lowercase rest
 * @param {string} type - Input string
 * @returns {string} - Formatted string
 */
export function capitalizeDefectType(type) {
  if (!type) return type;
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}

/**
 * Format date to localized time string (HH:MM:SS)
 * @param {string} dateStr - ISO date string
 * @returns {string} - Formatted time
 */
export function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * Format date to relative time (e.g., "2 minutes ago")
 * @param {string} dateStr - ISO date string
 * @returns {string} - Relative time string
 */
export function formatRelativeTime(dateStr) {
  const detectionDate = new Date(dateStr);
  const now = new Date();
  const diffMs = now - detectionDate;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return diffSecs === 1 ? '1 second ago' : `${diffSecs} seconds ago`;
  }
  if (diffMins < 60) {
    return diffMins === 1 ? '1 minute ago' : `${diffMins} minutes ago`;
  }
  if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  }
  return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
}

/**
 * Format date to localized date string
 * @param {string} dateStr - ISO date string
 * @returns {string} - Formatted date
 */
export function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Format full display date and time
 * @param {string} dateStr - ISO date string
 * @returns {string} - Formatted date and time
 */
export function formatDisplayDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDisplayTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * Group defects by date
 * @param {Array} defects - Array of defect objects
 * @returns {Array} - Array of [dateKey, defectsArray] pairs, sorted by date descending
 */
export function groupByDate(defects) {
  const groups = {};
  defects.forEach((d) => {
    const dateKey = new Date(d.detected_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Manila',
    });
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(d);
  });
  return Object.entries(groups).sort((a, b) => new Date(b[0]) - new Date(a[0]));
}

/**
 * Aggregate defects by type for bar chart
 * @param {Array} defects - Array of defect objects
 * @returns {Array} - Array of {type, count} objects
 */
export function aggregateDefectsByType(defects) {
  const counts = {};
  defects.forEach((d) => {
    const type = capitalizeDefectType(d.defect_type) || 'Unknown';
    counts[type] = (counts[type] || 0) + 1;
  });
  return Object.entries(counts).map(([type, count]) => ({ type, count }));
}

/**
 * Get backend URL with fallbacks
 * @returns {string} - Backend URL
 */
export function getBackendURL() {
  if (process.env.REACT_APP_BACKEND_URL) {
    return process.env.REACT_APP_BACKEND_URL;
  }
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:5000';
  }
  return 'http://localhost:5000';
}
