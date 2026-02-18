// Defects API Routes - Handle glass defect records with Supabase integration
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('✅ Supabase client initialized for defects');
} else {
  console.warn('⚠️ Supabase not configured for defects API');
}

/**
 * GET /defects
 * Retrieve all defects with optional filtering
 * Query params: 
 *   - deviceId: filter by device
 *   - status: filter by status (pending, reviewed, resolved)
 *   - limit: number of records to return (default: 50)
 *   - offset: pagination offset (default: 0)
 */
router.get('/', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const { deviceId, status, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('defects')
      .select('*', { count: 'exact' })
      .order('detected_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    // Apply filters if provided
    if (deviceId) {
      query = query.eq('device_id', deviceId);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, count, error } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      data,
      pagination: {
        total: count,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (err) {
    console.error('Error fetching defects:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /defects/:id
 * Retrieve a specific defect by ID
 */
router.get('/:id', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const { id } = req.params;
    const { data, error } = await supabase
      .from('defects')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Defect not found' });
    }

    res.json(data);
  } catch (err) {
    console.error('Error fetching defect:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /defects
 * Create a new defect record
 * Body:
 *   - device_id: device identifier
 *   - defect_type: type of defect
 *   - detected_at: ISO timestamp of detection
 *   - image_url: URL to the image in storage
 *   - image_path: path to the image in storage bucket
 *   - status: (optional) pending, reviewed, or resolved
 */
router.post('/', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const { device_id, defect_type, detected_at, image_url, image_path, status = 'pending' } = req.body;

    // Validate required fields
    if (!device_id || !defect_type || !detected_at || !image_url) {
      return res.status(400).json({
        error: 'Missing required fields: device_id, defect_type, detected_at, image_url',
      });
    }

    const { data, error } = await supabase
      .from('defects')
      .insert([
        {
          device_id,
          defect_type,
          detected_at,
          image_url,
          image_path,
          status,
        },
      ])
      .select();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json(data[0]);
  } catch (err) {
    console.error('Error creating defect:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /defects/:id
 * Update a defect record
 * Body: any fields to update (status, notes, etc.)
 */
router.patch('/:id', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const { id } = req.params;
    const updates = req.body;

    // Don't allow updating these key fields
    delete updates.id;
    delete updates.created_at;

    const { data, error } = await supabase
      .from('defects')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (data.length === 0) {
      return res.status(404).json({ error: 'Defect not found' });
    }

    res.json(data[0]);
  } catch (err) {
    console.error('Error updating defect:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /defects/:id
 * Delete a defect record
 */
router.delete('/:id', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const { id } = req.params;
    const { data, error } = await supabase
      .from('defects')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Defect deleted successfully' });
  } catch (err) {
    console.error('Error deleting defect:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /defects/stats/summary
 * Get defect statistics
 */
router.get('/stats/summary', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    // Get total count by device and type
    const { data: byDevice } = await supabase
      .from('defects')
      .select('device_id', { count: 'exact' });

    const { data: byType } = await supabase
      .from('defects')
      .select('defect_type', { count: 'exact' });

    const { data: byStatus } = await supabase
      .from('defects')
      .select('status', { count: 'exact' });

    res.json({
      totalDefects: byDevice?.length || 0,
      byType: groupBy(byType || [], 'defect_type'),
      byStatus: groupBy(byStatus || [], 'status'),
    });
  } catch (err) {
    console.error('Error fetching statistics:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to group array by key
function groupBy(array, key) {
  return array.reduce((acc, obj) => {
    const value = obj[key];
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

module.exports = router;
