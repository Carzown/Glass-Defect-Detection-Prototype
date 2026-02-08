// Supabase defects utility functions for React
import { supabase } from '../supabase';

/**
 * Fetch all defects with optional filters
 * @param {Object} filters - Optional filters (deviceId, status, limit, offset)
 * @returns {Promise<{data: Array, pagination: Object}>}
 */
export async function fetchDefects(filters = {}) {
  try {
    const { deviceId, status, limit = 50, offset = 0 } = filters;

    let query = supabase
      .from('defects')
      .select('*', { count: 'exact' })
      .order('detected_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (deviceId) {
      query = query.eq('device_id', deviceId);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, count, error } = await query;

    if (error) throw error;

    return {
      data: data || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
      },
    };
  } catch (error) {
    console.error('Error fetching defects:', error);
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
 * @param {Object} defectData - Defect data (device_id, defect_type, detected_at, image_url, etc.)
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
 * Change defect status (pending -> reviewed -> resolved)
 * @param {string} id - Defect ID
 * @param {string} status - New status (pending, reviewed, resolved)
 * @param {string} notes - Optional notes
 * @returns {Promise<Object>}
 */
export async function updateDefectStatus(id, status, notes = '') {
  try {
    const updates = { status };
    if (notes) {
      updates.notes = notes;
    }
    return await updateDefect(id, updates);
  } catch (error) {
    console.error('Error updating defect status:', error);
    throw error;
  }
}

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
      .select('defect_type, status, device_id');

    if (error) throw error;

    const stats = {
      total: allDefects?.length || 0,
      byType: {},
      byStatus: {},
      byDevice: {},
    };

    if (allDefects) {
      for (const defect of allDefects) {
        // Count by type
        stats.byType[defect.defect_type] = (stats.byType[defect.defect_type] || 0) + 1;
        // Count by status
        stats.byStatus[defect.status] = (stats.byStatus[defect.status] || 0) + 1;
        // Count by device
        stats.byDevice[defect.device_id] = (stats.byDevice[defect.device_id] || 0) + 1;
      }
    }

    return stats;
  } catch (error) {
    console.error('Error fetching defect stats:', error);
    throw error;
  }
}

/**
 * Fetch defects for a specific time range
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Array>}
 */
export async function fetchDefectsByDateRange(startDate, endDate) {
  try {
    const { data, error } = await supabase
      .from('defects')
      .select('*')
      .gte('detected_at', startDate.toISOString())
      .lte('detected_at', endDate.toISOString())
      .order('detected_at', { ascending: false });

    if (error) throw error;
    return data || [];
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
export function defectsToCSV(defects) {
  if (!defects || defects.length === 0) {
    return 'No defects to export';
  }

  const headers = ['ID', 'Device ID', 'Defect Type', 'Detected At', 'Status', 'Image URL', 'Notes', 'Created At'];
  const rows = defects.map((d) => [
    d.id,
    d.device_id,
    d.defect_type,
    new Date(d.detected_at).toLocaleString(),
    d.status,
    d.image_url || 'N/A',
    d.notes || 'N/A',
    new Date(d.created_at).toLocaleString(),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  return csvContent;
}
