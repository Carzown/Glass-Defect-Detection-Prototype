// Defects API Routes - CRUD operations for glass defect records
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// Real-time WebSocket broadcasting (optional - will gracefully fail if not available)
let realtime = null;
try {
  realtime = require('./realtime');
} catch (e) {
  console.warn('[DEFECTS] Real-time module not loaded:', e?.message);
}

// In-memory fallback store (optional, only used if Supabase is not configured)
let defectsStore = null;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.warn('[defects] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set – falling back to in-memory store (no persistence)');
}

// GET /defects - Retrieve all defects with pagination
router.get('/', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ 
        error: 'Supabase not configured - cannot retrieve defects',
        instructions: [
          'Configure Supabase on Railway to save and retrieve defects:',
          '1. Go to Railway Dashboard → glass-defect-detection-prototype-production',
          '2. Click "Variables" tab',
          '3. Add: SUPABASE_URL = https://kfeztemgrbkfwaicvgnk.supabase.co',
          '4. Add: SUPABASE_SERVICE_ROLE_KEY = (from Supabase Settings → API)',
          '5. Redeploy'
        ]
      });
    }

    const { limit = 50, offset = 0, dateFrom, dateTo } = req.query;

    let query = supabase
      .from('defects')
      .select('*', { count: 'exact' })
      .order('detected_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (dateFrom) {
      query = query.gte('detected_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('detected_at', dateTo);
    }

    const { data, count, error } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({
      data,
      pagination: {
        total: count,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
      source: 'supabase'
    });
  } catch (err) {
    console.error('Error fetching defects:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /stats/summary - Overall defect statistics
router.get('/stats/summary', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }
    const { data, error } = await supabase
      .from('defects')
      .select('defect_type, confidence, detected_at');
    if (error) return res.status(400).json({ error: error.message });
    const records = data || [];
    res.json({
      totalDefects: records.length,
      avgConfidence: records.length
        ? records.reduce((s, d) => s + (d.confidence || 0), 0) / records.length
        : 0,
      byType: groupBy(records, 'defect_type'),
    });
  } catch (err) {
    console.error('Error fetching statistics:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /stats/range - Statistics filtered by date range
router.get('/stats/range', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }
    const { dateFrom, dateTo } = req.query;
    let query = supabase
      .from('defects')
      .select('id, defect_type, confidence, detected_at')
      .order('detected_at', { ascending: false });
    if (dateFrom) query = query.gte('detected_at', dateFrom);
    if (dateTo)   query = query.lte('detected_at', dateTo);
    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    const records = data || [];
    const total = records.length;
    const avgConfidence = total
      ? records.reduce((s, d) => s + (d.confidence || 0), 0) / total
      : 0;
    const lastDetected = records.length ? records[0].detected_at : null;
    const byType = groupBy(records, 'defect_type');
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const piOnline = records.some(d => d.detected_at >= tenMinAgo);
    res.json({
      total,
      avgConfidence,
      lastDetected,
      byType,
      piOnline,
    });
  } catch (err) {
    console.error('Error fetching range stats:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /defects/:id - Retrieve specific defect
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (supabase) {
      const { data, error } = await supabase
        .from('defects')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        return res.status(404).json({ error: 'Defect not found' });
      }

      return res.json(data);
    } else if (defectsStore) {
      const defect = defectsStore.data.find(d => d.id == id);
      if (!defect) {
        return res.status(404).json({ error: 'Defect not found' });
      }
      return res.json(defect);
    } else {
      return res.status(503).json({ error: 'No storage configured' });
    }
  } catch (err) {
    console.error('Error fetching defect:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /defects - Create new defect record
router.post('/', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ 
        error: 'Supabase not configured',
        message: 'To save defects, configure Supabase on Railway:',
        instructions: [
          '1. Go to Railway Dashboard → glass-defect-detection-prototype-production',
          '2. Click "Variables" tab',
          '3. Add: SUPABASE_URL = https://kfeztemgrbkfwaicvgnk.supabase.co',
          '4. Add: SUPABASE_SERVICE_ROLE_KEY = (get from Supabase Dashboard → Settings → API)',
          '5. Redeploy'
        ]
      });
    }

    const { defect_type, detected_at, image_url, image_path, confidence } = req.body;

    if (!defect_type) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['defect_type']
      });
    }

    // Insert into Supabase
    const { data, error } = await supabase
      .from('defects')
      .insert([
        {
          defect_type,
          detected_at: detected_at || new Date().toISOString(),
          image_url: image_url || null,
          image_path: image_path || null,
          confidence: confidence || null,
        },
      ])
      .select();

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(400).json({ 
        error: 'Failed to save defect to Supabase',
        details: error.message 
      });
    }

    // Broadcast new defect to WebSocket clients
    if (realtime && data[0]) {
      try {
        realtime.broadcastNewDefect(data[0]);
      } catch (broadcastErr) {
        console.warn('[DEFECTS] Failed to broadcast via WebSocket:', broadcastErr.message);
      }
    }

    return res.status(201).json({
      success: true,
      data: data[0],
      source: 'supabase',
      message: 'Defect saved to Supabase'
    });
  } catch (err) {
    console.error('Error creating defect:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// PATCH /defects/:id - Update defect record
router.patch('/:id', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const { id } = req.params;
    const updates = req.body;

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

    // Broadcast defect update to WebSocket clients
    if (realtime && data[0]) {
      try {
        realtime.broadcastDefectUpdate(id, updates);
      } catch (broadcastErr) {
        console.warn('[DEFECTS] Failed to broadcast update via WebSocket:', broadcastErr.message);
      }
    }

    res.json(data[0]);
  } catch (err) {
    console.error('Error updating defect:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /defects/:id - Delete defect record
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

    // Broadcast defect deletion to WebSocket clients
    if (realtime) {
      try {
        realtime.broadcastDefectDelete(id);
      } catch (broadcastErr) {
        console.warn('[DEFECTS] Failed to broadcast delete via WebSocket:', broadcastErr.message);
      }
    }

    res.json({ message: 'Defect deleted successfully' });
  } catch (err) {
    console.error('Error deleting defect:', err);
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
