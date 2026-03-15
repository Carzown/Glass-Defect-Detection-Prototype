

import { supabase } from '../supabase';
import { getBackendURL } from '../utils/formatters';

const BACKEND_URL = getBackendURL();

let _backendAvailable = null;
let _backendCheckedAt = 0;
const BACKEND_CACHE_MS = 30_000; 

async function isBackendAvailable() {
  const now = Date.now();
  if (_backendAvailable !== null && now - _backendCheckedAt < BACKEND_CACHE_MS) {
    return _backendAvailable;
  }
  try {
    if (!BACKEND_URL) { _backendAvailable = false; _backendCheckedAt = now; return false; }
    const res = await fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(5000) });
    _backendAvailable = res.ok;
  } catch {
    _backendAvailable = false;
  }
  _backendCheckedAt = now;
  return _backendAvailable;
}

function invalidateBackendCache() {
  _backendAvailable = null;
  _backendCheckedAt = 0;
}

export async function fetchDeviceStatus(deviceId = 'raspi-pi-1') {
  
  if (BACKEND_URL) {
    try {
      const res = await fetch(`${BACKEND_URL}/defects/device-status/${deviceId}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn('[defects] fetchDeviceStatus backend error, trying Supabase direct:', err.message);
    }
  }
  
  try {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('device_status')
      .select('is_online, last_seen')
      .eq('device_id', deviceId)
      .single();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

export function subscribeToDeviceStatus(deviceId = 'raspi-pi-1', callback) {
  let stopped = false;

  // Supabase realtime for instant updates when the DB row changes
  let supaChannel = null;
  if (supabase) {
    supaChannel = supabase
      .channel('device_status_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'device_status', filter: `device_id=eq.${deviceId}` },
        (payload) => {
          if (payload.new && !stopped) callback(payload.new);
        }
      )
      .subscribe();
  }

  // Always poll periodically as a safety net regardless of Supabase availability
  const poll = async () => {
    if (stopped) return;
    try {
      const status = await fetchDeviceStatus(deviceId);
      if (status && !stopped) callback(status);
    } catch {}
    if (!stopped) setTimeout(poll, 30_000);
  };
  setTimeout(poll, 30_000);

  return () => {
    stopped = true;
    if (supaChannel) supabase.removeChannel(supaChannel);
  };
}

export async function fetchDefects(filters = {}) {
  const { limit = 50, offset = 0, dateFrom, dateTo } = filters;

  
  if (await isBackendAvailable()) {
    try {
      const params = new URLSearchParams({ limit, offset });
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const res = await fetch(`${BACKEND_URL}/defects?${params}`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`Backend responded ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[defects] fetchDefects backend error, falling back to Supabase:', err.message);
      invalidateBackendCache();
    }
  }

  
  if (!supabase) throw new Error('Neither backend nor Supabase is available');
  let query = supabase
    .from('defects')
    .select('*', { count: 'exact' })
    .order('detected_at', { ascending: false })
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
  if (dateFrom) query = query.gte('detected_at', dateFrom);
  if (dateTo)   query = query.lte('detected_at', dateTo);
  const { data, count, error } = await query;
  if (error) throw error;
  return { data: data || [], pagination: { total: count, limit: parseInt(limit), offset: parseInt(offset) }, source: 'supabase-direct' };
}

export async function fetchDefectById(id) {
  if (await isBackendAvailable()) {
    try {
      const res = await fetch(`${BACKEND_URL}/defects/${id}`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`Backend responded ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[defects] fetchDefectById backend error, falling back:', err.message);
      invalidateBackendCache();
    }
  }

  if (!supabase) throw new Error('Neither backend nor Supabase is available');
  const { data, error } = await supabase.from('defects').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createDefect(defectData) {
  if (await isBackendAvailable()) {
    try {
      const res = await fetch(`${BACKEND_URL}/defects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(defectData),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`Backend responded ${res.status}`);
      const json = await res.json();
      return json.data || json;
    } catch (err) {
      console.warn('[defects] createDefect backend error, falling back:', err.message);
      invalidateBackendCache();
    }
  }

  if (!supabase) throw new Error('Neither backend nor Supabase is available');
  const { data, error } = await supabase.from('defects').insert([defectData]).select().single();
  if (error) throw error;
  return data;
}

export async function updateDefect(id, updates) {
  if (await isBackendAvailable()) {
    try {
      const res = await fetch(`${BACKEND_URL}/defects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`Backend responded ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[defects] updateDefect backend error, falling back:', err.message);
      invalidateBackendCache();
    }
  }

  if (!supabase) throw new Error('Neither backend nor Supabase is available');
  const { data, error } = await supabase.from('defects').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteDefect(id) {
  if (await isBackendAvailable()) {
    try {
      const res = await fetch(`${BACKEND_URL}/defects/${id}`, {
        method: 'DELETE',
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`Backend responded ${res.status}`);
      return true;
    } catch (err) {
      console.warn('[defects] deleteDefect backend error, falling back:', err.message);
      invalidateBackendCache();
    }
  }

  if (!supabase) throw new Error('Neither backend nor Supabase is available');
  console.log('[deleteDefect] → Supabase direct');
  const { error } = await supabase.from('defects').delete().eq('id', id);
  if (error) throw error;
  return true;
}

export async function deleteAllDefects() {
  try {
    if (!supabase) throw new Error('Supabase not initialized');
    const { error } = await supabase.from('defects').delete().neq('id', '');
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting all defects:', error);
    throw error;
  }
}

export function subscribeToDefects({ onNew, onUpdate, onDelete } = {}) {
  try {
    if (!supabase) return () => {};
    
    const defaultCallback = () => {};
    const handleNew = onNew || defaultCallback;
    const handleUpdate = onUpdate || defaultCallback;
    const handleDelete = onDelete || defaultCallback;
    
    const channel = supabase
      .channel('defects_realtime', { config: { broadcast: { self: false } } })
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'defects' },
        (payload) => { handleNew(payload.new); }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'defects' },
        (payload) => { handleUpdate(payload.new); }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'defects' },
        (payload) => { handleDelete(payload.old.id); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch {
    return () => {};
  }
}

export async function getDefectStats() {
  if (await isBackendAvailable()) {
    try {
      const res = await fetch(`${BACKEND_URL}/defects/stats/summary`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`Backend responded ${res.status}`);
      const json = await res.json();
      return { total: json.totalDefects ?? json.total ?? 0, byType: json.byType || {} };
    } catch (err) {
      console.warn('[defects] getDefectStats backend error, falling back:', err.message);
      invalidateBackendCache();
    }
  }

  if (!supabase) throw new Error('Neither backend nor Supabase is available');
  const { data: allDefects, error } = await supabase.from('defects').select('detected_defects');
  if (error) throw error;
  const stats = { total: allDefects?.length || 0, byType: {} };
  for (const record of allDefects || []) {
    for (const d of (record.detected_defects || [])) {
      const t = d.type || 'Unknown';
      stats.byType[t] = (stats.byType[t] || 0) + 1;
    }
  }
  return stats;
}

const PH_TZ = 'Asia/Manila';

function getTodayPH() {
  return new Date().toLocaleDateString('en-CA', { timeZone: PH_TZ });
}

function phDayStart(dateStr) {
  return new Date(dateStr + 'T00:00:00+08:00');
}

export function getDateRangeBounds(range) {
  const now = new Date();
  const end = now.toISOString();
  let start;
  if (range === 'today') {
    
    start = phDayStart(getTodayPH()).toISOString();
  } else if (range === '7days') {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    const dateStr = d.toLocaleDateString('en-CA', { timeZone: PH_TZ });
    start = phDayStart(dateStr).toISOString();
  } else if (range === '30days') {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    const dateStr = d.toLocaleDateString('en-CA', { timeZone: PH_TZ });
    start = phDayStart(dateStr).toISOString();
  } else {
    start = new Date(0).toISOString(); 
  }
  return { start, end };
}

export async function fetchDefectsByRange(range) {
  const { start, end } = getDateRangeBounds(range);
  return fetchDefectsByDateRange(new Date(start), new Date(end));
}

export async function fetchDefectsByDateRange(startDate, endDate) {
  if (await isBackendAvailable()) {
    try {
      const params = new URLSearchParams({
        dateFrom: startDate.toISOString(),
        dateTo: endDate.toISOString(),
        limit: 1000,
        offset: 0,
      });
      const res = await fetch(`${BACKEND_URL}/defects?${params}`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`Backend responded ${res.status}`);
      const json = await res.json();
      return json.data || [];
    } catch (err) {
      console.warn('[defects] fetchDefectsByDateRange backend error, falling back:', err.message);
      invalidateBackendCache();
    }
  }

  if (!supabase) throw new Error('Neither backend nor Supabase is available');
  const { data, error } = await supabase
    .from('defects')
    .select('*')
    .gte('detected_at', startDate.toISOString())
    .lte('detected_at', endDate.toISOString())
    .order('detected_at', { ascending: false })
    .limit(1000);
  if (error) throw error;
  return data || [];
}

let ws = null;

export function connectWebSocket({ onNew, onUpdate, onDelete, onDeviceStatus } = {}) {
  try {
    if (!BACKEND_URL) {
      console.warn('[WebSocket] No backend URL configured, skipping WebSocket connection');
      return () => {};
    }

    
    const wsURL = BACKEND_URL
      .replace(/^http:/, 'ws:')
      .replace(/^https:/, 'wss:')
      + '/ws/defects';

    console.log('[WebSocket] 🔌 Connecting to', wsURL);

    ws = new WebSocket(wsURL);

    ws.onopen = () => {};

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        switch (message.type) {
          case 'new_defect':
            if (onNew) onNew(message.data);
            break;
          case 'defect_update':
            if (onUpdate) onUpdate(message);
            break;
          case 'defect_delete':
            if (onDelete) onDelete(message.defectId);
            break;
          case 'device_status':
            if (onDeviceStatus) onDeviceStatus(message.data);
            break;
          default:
            break;
        }
      } catch {
        
      }
    };

    ws.onerror = () => {};

    ws.onclose = () => { ws = null; };

    
    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.close();
      ws = null;
    };
  } catch {
    return () => {};
  }
}

export function getWebSocketStatus() {
  if (!ws) return 'disconnected';
  switch (ws.readyState) {
    case WebSocket.CONNECTING: return 'connecting';
    case WebSocket.OPEN: return 'connected';
    case WebSocket.CLOSING: return 'closing';
    case WebSocket.CLOSED: return 'closed';
    default: return 'unknown';
  }
}

export function disconnectWebSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close();
  }
}
