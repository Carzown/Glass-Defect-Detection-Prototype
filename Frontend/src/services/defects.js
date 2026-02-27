// Defects service - API interface for glass defect records
// Strategy: backend (Railway) is primary; Supabase direct is the fallback.
// Auth/login is always direct-to-Supabase (no backend auth routes exist).
import { supabase } from '../supabase';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// ── Backend availability cache ────────────────────────────────────────────
let _backendAvailable = null;
let _backendCheckedAt = 0;
const BACKEND_CACHE_MS = 30_000; // re-check every 30 s

async function isBackendAvailable() {
  const now = Date.now();
  if (_backendAvailable !== null && now - _backendCheckedAt < BACKEND_CACHE_MS) {
    return _backendAvailable;
  }
  try {
    if (!BACKEND_URL) { _backendAvailable = false; _backendCheckedAt = now; return false; }
    const res = await fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(4000) });
    _backendAvailable = res.ok;
  } catch {
    _backendAvailable = false;
  }
  _backendCheckedAt = now;
  if (!_backendAvailable) console.warn('[defects] ⚠️ Backend unavailable – using Supabase direct');
  return _backendAvailable;
}

// Reset cache (e.g. after a backend error so we re-check sooner)
function invalidateBackendCache() {
  _backendAvailable = null;
  _backendCheckedAt = 0;
}

// ── Device Status ─────────────────────────────────────────────────────────

/**
 * Fetch the current online/offline status for a device from the
 * `device_status` table in Supabase.
 *
 * Returns: { is_online: boolean, last_seen: string } or null
 */
export async function fetchDeviceStatus(deviceId = 'raspi') {
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

/**
 * Subscribe to real-time changes on the device_status table.
 * `callback` is called with the updated row whenever it changes.
 * Returns an unsubscribe function.
 */
export function subscribeToDeviceStatus(deviceId = 'raspi', callback) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel('device_status_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'device_status', filter: `device_id=eq.${deviceId}` },
      (payload) => {
        if (payload.new) callback(payload.new);
      }
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// ── Fetch all defects (backend → Supabase fallback) ───────────────────────
export async function fetchDefects(filters = {}) {
  const { limit = 50, offset = 0, dateFrom, dateTo } = filters;

  // Try backend first
  if (await isBackendAvailable()) {
    try {
      const params = new URLSearchParams({ limit, offset });
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      console.log('[fetchDefects] → backend');
      const res = await fetch(`${BACKEND_URL}/defects?${params}`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`Backend responded ${res.status}`);
      const json = await res.json();
      console.log(`[fetchDefects] ✅ backend (${(json.data || []).length} records)`);
      return json;
    } catch (err) {
      console.warn('[fetchDefects] backend failed, falling back to Supabase:', err.message);
      invalidateBackendCache();
    }
  }

  // Supabase direct fallback
  if (!supabase) throw new Error('Neither backend nor Supabase is available');
  console.log('[fetchDefects] → Supabase direct');
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

// ── Fetch single defect by ID (backend → Supabase fallback) ──────────────
export async function fetchDefectById(id) {
  if (await isBackendAvailable()) {
    try {
      console.log('[fetchDefectById] → backend');
      const res = await fetch(`${BACKEND_URL}/defects/${id}`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`Backend responded ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[fetchDefectById] backend failed, falling back to Supabase:', err.message);
      invalidateBackendCache();
    }
  }

  if (!supabase) throw new Error('Neither backend nor Supabase is available');
  console.log('[fetchDefectById] → Supabase direct');
  const { data, error } = await supabase.from('defects').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

// ── Create defect record (backend → Supabase fallback) ───────────────────
export async function createDefect(defectData) {
  if (await isBackendAvailable()) {
    try {
      console.log('[createDefect] → backend');
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
      console.warn('[createDefect] backend failed, falling back to Supabase:', err.message);
      invalidateBackendCache();
    }
  }

  if (!supabase) throw new Error('Neither backend nor Supabase is available');
  console.log('[createDefect] → Supabase direct');
  const { data, error } = await supabase.from('defects').insert([defectData]).select().single();
  if (error) throw error;
  return data;
}

// ── Update defect record (backend → Supabase fallback) ───────────────────
export async function updateDefect(id, updates) {
  if (await isBackendAvailable()) {
    try {
      console.log('[updateDefect] → backend');
      const res = await fetch(`${BACKEND_URL}/defects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`Backend responded ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[updateDefect] backend failed, falling back to Supabase:', err.message);
      invalidateBackendCache();
    }
  }

  if (!supabase) throw new Error('Neither backend nor Supabase is available');
  console.log('[updateDefect] → Supabase direct');
  const { data, error } = await supabase.from('defects').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// ── Delete defect record (backend → Supabase fallback) ───────────────────
export async function deleteDefect(id) {
  if (await isBackendAvailable()) {
    try {
      console.log('[deleteDefect] → backend');
      const res = await fetch(`${BACKEND_URL}/defects/${id}`, {
        method: 'DELETE',
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`Backend responded ${res.status}`);
      return true;
    } catch (err) {
      console.warn('[deleteDefect] backend failed, falling back to Supabase:', err.message);
      invalidateBackendCache();
    }
  }

  if (!supabase) throw new Error('Neither backend nor Supabase is available');
  console.log('[deleteDefect] → Supabase direct');
  const { error } = await supabase.from('defects').delete().eq('id', id);
  if (error) throw error;
  return true;
}

// ── Delete all defects (Supabase direct only – no backend bulk-delete) ────
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

// ── Real-time subscription (Supabase direct – no backend equivalent) ──────
export function subscribeToDefects(callback) {
  try {
    if (!supabase) return () => {};
    const channel = supabase
      .channel('defects_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'defects' }, (payload) => {
        console.log('Real-time update:', payload);
        callback(payload);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  } catch (error) {
    console.error('Error subscribing to defects:', error);
    return () => {};
  }
}

// ── Defect statistics (backend → Supabase fallback) ──────────────────────
export async function getDefectStats() {
  if (await isBackendAvailable()) {
    try {
      console.log('[getDefectStats] → backend');
      const res = await fetch(`${BACKEND_URL}/defects/stats/summary`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`Backend responded ${res.status}`);
      const json = await res.json();
      // Normalise to { total, byType }
      return { total: json.totalDefects ?? json.total ?? 0, byType: json.byType || {} };
    } catch (err) {
      console.warn('[getDefectStats] backend failed, falling back to Supabase:', err.message);
      invalidateBackendCache();
    }
  }

  if (!supabase) throw new Error('Neither backend nor Supabase is available');
  console.log('[getDefectStats] → Supabase direct');
  const { data: allDefects, error } = await supabase.from('defects').select('defect_type');
  if (error) throw error;
  const stats = { total: allDefects?.length || 0, byType: {} };
  for (const defect of allDefects || []) {
    stats.byType[defect.defect_type] = (stats.byType[defect.defect_type] || 0) + 1;
  }
  return stats;
}

// ── Date range helpers ────────────────────────────────────────────────────
// PH timezone constant (UTC+8)
const PH_TZ = 'Asia/Manila';
// Get current date string in PHT as YYYY-MM-DD
function getTodayPH() {
  return new Date().toLocaleDateString('en-CA', { timeZone: PH_TZ });
}
// Parse a YYYY-MM-DD date string as start-of-day PHT
function phDayStart(dateStr) {
  return new Date(dateStr + 'T00:00:00+08:00');
}
// Parse a YYYY-MM-DD date string as end-of-day PHT
function phDayEnd(dateStr) {
  return new Date(dateStr + 'T23:59:59.999+08:00');
}

export function getDateRangeBounds(range) {
  const now = new Date();
  const end = now.toISOString();
  let start;
  if (range === 'today') {
    // Start of today in PHT (UTC+8)
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
    start = new Date(0).toISOString(); // all time
  }
  return { start, end };
}

export async function fetchDefectsByRange(range) {
  const { start, end } = getDateRangeBounds(range);
  return fetchDefectsByDateRange(new Date(start), new Date(end));
}

// ── Fetch by date range (backend → Supabase fallback) ────────────────────
export async function fetchDefectsByDateRange(startDate, endDate) {
  if (await isBackendAvailable()) {
    try {
      const params = new URLSearchParams({
        dateFrom: startDate.toISOString(),
        dateTo: endDate.toISOString(),
        limit: 1000,
        offset: 0,
      });
      console.log('[fetchDefectsByDateRange] → backend');
      const res = await fetch(`${BACKEND_URL}/defects?${params}`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`Backend responded ${res.status}`);
      const json = await res.json();
      return json.data || [];
    } catch (err) {
      console.warn('[fetchDefectsByDateRange] backend failed, falling back to Supabase:', err.message);
      invalidateBackendCache();
    }
  }

  if (!supabase) throw new Error('Neither backend nor Supabase is available');
  console.log('[fetchDefectsByDateRange] → Supabase direct');
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
