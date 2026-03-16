

export function capitalizeDefectType(type) {
  if (!type) return type;
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}

export function getDefectTypesLabel(record) {
  const defects = record?.detected_defects;
  if (!Array.isArray(defects) || defects.length === 0) return 'Unknown';
  
  const counts = {};
  defects.forEach(d => {
    const t = capitalizeDefectType(d.type) || 'Unknown';
    counts[t] = (counts[t] || 0) + 1;
  });
  
  return Object.entries(counts).map(([type]) => type).join(', ');
}

export function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

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

export function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDisplayDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDisplayTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

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

export function aggregateDefectsByType(defects) {
  const counts = {};
  defects.forEach((record) => {
    const items = Array.isArray(record.detected_defects) ? record.detected_defects : [];
    
    const types = new Set(items.map(d => capitalizeDefectType(d.type)).filter(Boolean));
    types.forEach(type => {
      counts[type] = (counts[type] || 0) + 1;
    });
  });
  return Object.entries(counts).map(([type, count]) => ({ type, count }));
}

const RAILWAY_BACKEND_URL = 'https://glass-defect-detection-prototype-production.up.railway.app';

export function getBackendURL() {
  if (process.env.REACT_APP_BACKEND_URL) {
    return process.env.REACT_APP_BACKEND_URL;
  }
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ) {
    return 'http://localhost:5000';
  }
  
  return RAILWAY_BACKEND_URL;
}
