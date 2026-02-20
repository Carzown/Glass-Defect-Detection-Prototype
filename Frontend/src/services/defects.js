// Defects service — routes through the Railway backend API
import { supabase } from '../supabase';

const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL ||
  'https://glass-defect-detection-prototype-production.up.railway.app';

/**
 * Fetch all defects with optional filters via Railway backend
 * @param {Object} filters - Optional filters (limit, offset, dateFrom, dateTo)
 * @returns {Promise<{data: Array, pagination: Object}>}
 */
export async function fetchDefects(filters = {}) {
  try {
    const { limit = 50, offset = 0, dateFrom, dateTo } = filters;
    const params = new URLSearchParams({ limit, offset });
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);

    console.log('[fetchDefects] Fetching via Railway backend:', `${BACKEND_URL}/defects?${params}`);

    const res = await fetch(`${BACKEND_URL}/defects?${params}`);
    if (!res.ok) throw new Error(`Backend responded ${res.status}`);
    const json = await res.json();

    console.log(`[fetchDefects] ✅ Fetched ${(json.data || []).length} defects from Railway`);
    return json;
  } catch (error) {
    console.error('[fetchDefects] ❌ Error:', error.message);
    throw error;
  }
}

/**
 * Fetch a single defect by ID
 * @param {string} id - Defect ID
 * @returns {Promise<Object>}
 */
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

/**
 * Create a new defect record
 * @param {Object} defectData - Defect data (defect_type, detected_at, image_url, confidence, etc.)
 * @returns {Promise<Object>}
 */
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

/**
 * Update a defect record
 * @param {string} id - Defect ID
 * @param {Object} updates - Fields to update (status, notes, etc.)
 * @returns {Promise<Object>}
 */
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

/**
 * Delete a defect record
 * @param {string} id - Defect ID
 * @returns {Promise<boolean>}
 */
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

/**
 * Delete all defects
 * @returns {Promise<boolean>}
 */
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

/**
 * Change defect status removed — status column no longer in schema.
 */
// updateDefectStatus removed

/**
 * Subscribe to real-time defect changes
 * @param {Function} callback - Callback function to handle changes
 * @returns {Function} Unsubscribe function
 */
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

/**
 * Get defect statistics
 * @returns {Promise<Object>}
 */
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

/**
 * Get ISO start/end timestamps for a named range.
 * @param {'today'|'7days'|'30days'} range
 * @returns {{ start: string, end: string }}
 */
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

/**
 * Fetch all defects within a named time range.
 * @param {'today'|'7days'|'30days'} range
 * @returns {Promise<Array>}
 */
export async function fetchDefectsByRange(range) {
  const { start, end } = getDateRangeBounds(range);
  return fetchDefectsByDateRange(new Date(start), new Date(end));
}

/**
 * Fetch defects for a specific time range via Railway backend
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Array>}
 */
export async function fetchDefectsByDateRange(startDate, endDate) {
  try {
    const params = new URLSearchParams({
      dateFrom: startDate.toISOString(),
      dateTo: endDate.toISOString(),
      limit: 1000,
      offset: 0,
    });
    console.log('[fetchDefectsByDateRange] Fetching via Railway:', `${BACKEND_URL}/defects?${params}`);
    const res = await fetch(`${BACKEND_URL}/defects?${params}`);
    if (!res.ok) throw new Error(`Backend responded ${res.status}`);
    const json = await res.json();
    return json.data || [];
  } catch (error) {
    console.error('Error fetching defects by date range:', error);
    throw error;
  }
}

/**
 * Export defects as CSV
 * @param {Array} defects - Array of defect records
 * @returns {string} CSV content
 */
// CSV export removed; keep defects API utilities only
