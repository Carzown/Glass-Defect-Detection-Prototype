// Defects service - API interface for glass defect records
import { supabase } from '../supabase';

const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL ||
  'https://glass-defect-detection-prototype-production.up.railway.app';

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

// Fetch all defects via Railway backend
export async function fetchDefects(filters = {}) {
  try {
    const { limit = 50, offset = 0, dateFrom, dateTo } = filters;
    const params = new URLSearchParams({ limit, offset });
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);

    console.log('[fetchDefects] Fetching from Railway');

    const res = await fetch(`${BACKEND_URL}/defects?${params}`);
    if (!res.ok) throw new Error(`Backend responded ${res.status}`);
    const json = await res.json();

    console.log(`[fetchDefects] ✅ Fetched ${(json.data || []).length} defects`);
    return json;
  } catch (error) {
    console.error('[fetchDefects] ❌ Error:', error.message);
    throw error;
  }
}

// Fetch single defect by ID
export async function fetchDefectById(id) {
  try {
    const { data, error } = await supabase
      .from('defects')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching defect:', error);
    throw error;
  }
}

// Create new defect record
export async function createDefect(defectData) {
  try {
    const { data, error } = await supabase
      .from('defects')
      .insert([defectData])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating defect:', error);
    throw error;
  }
}

// Update defect record
export async function updateDefect(id, updates) {
  try {
    const { data, error } = await supabase
      .from('defects')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating defect:', error);
    throw error;
  }
}

// Delete defect record
export async function deleteDefect(id) {
  try {
    const { error } = await supabase
      .from('defects')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting defect:', error);
    throw error;
  }
}

// Delete all defects
export async function deleteAllDefects() {
  try {
    const { error } = await supabase
      .from('defects')
      .delete()
      .neq('id', ''); // This deletes all records

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting all defects:', error);
    throw error;
  }
}

// Subscribe to real-time defect changes
export function subscribeToDefects(callback) {
  try {
    const subscription = supabase
      .from('defects')
      .on('*', (payload) => {
        console.log('Real-time update:', payload);
        callback(payload);
      })
      .subscribe();

    // Return unsubscribe function
    return () => {
      supabase.removeSubscription(subscription);
    };
  } catch (error) {
    console.error('Error subscribing to defects:', error);
    throw error;
  }
}

// Get defect statistics
export async function getDefectStats() {
  try {
    const { data: allDefects, error } = await supabase
      .from('defects')
      .select('defect_type');

    if (error) throw error;

    const stats = {
      total: allDefects?.length || 0,
      byType: {},
    };

    if (allDefects) {
      for (const defect of allDefects) {
        stats.byType[defect.defect_type] = (stats.byType[defect.defect_type] || 0) + 1;
      }
    }

    return stats;
  } catch (error) {
    console.error('Error fetching defect stats:', error);
    throw error;
  }
}

// Get date range bounds (today, 7days, 30days, or all time)
export function getDateRangeBounds(range) {
  const now = new Date();
  const end = now.toISOString();
  let start;
  if (range === 'today') {
    const s = new Date(now);
    s.setHours(0, 0, 0, 0);
    start = s.toISOString();
  } else if (range === '7days') {
    const s = new Date(now);
    s.setDate(s.getDate() - 6);
    s.setHours(0, 0, 0, 0);
    start = s.toISOString();
  } else if (range === '30days') {
    const s = new Date(now);
    s.setDate(s.getDate() - 29);
    s.setHours(0, 0, 0, 0);
    start = s.toISOString();
  } else {
    start = new Date(0).toISOString(); // all time
  }
  return { start, end };
}

// Fetch defects within named time range
export async function fetchDefectsByRange(range) {
  const { start, end } = getDateRangeBounds(range);
  return fetchDefectsByDateRange(new Date(start), new Date(end));
}

// Fetch defects for specific date range
export async function fetchDefectsByDateRange(startDate, endDate) {
  try {
    const params = new URLSearchParams({
      dateFrom: startDate.toISOString(),
      dateTo: endDate.toISOString(),
      limit: 1000,
      offset: 0,
    });
    console.log('[fetchDefectsByDateRange] Fetching');
    const res = await fetch(`${BACKEND_URL}/defects?${params}`);
    if (!res.ok) throw new Error(`Backend responded ${res.status}`);
    const json = await res.json();
    return json.data || [];
  } catch (error) {
    console.error('Error fetching defects by date range:', error);
    throw error;
  }
}
