const express = require('express');
const router = express.Router();

// Initialize Supabase client
let supabase = null;
try {
  const { createClient } = require('@supabase/supabase-js');
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
  } else {
    console.warn('[AUTH] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set - auth routes will return 500');
  }
} catch (e) {
  console.warn('[AUTH] Failed to initialize Supabase:', e.message);
}

/**
 * POST /auth/login
 * Login endpoint for employees and admins
 * 
 * Request body:
 * {
 *   email: string,
 *   password: string,
 *   role: 'employee' | 'admin'
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   user: { id, email, role },
 *   error?: string
 * }
 */
router.post('/login', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Authentication service unavailable' });
    }

    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    // Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      return res.status(401).json({
        success: false,
        error: authError.message || 'Invalid credentials'
      });
    }

    const userId = authData.user.id;

    // Fetch user profile and role from profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, email')
      .eq('id', userId)
      .maybeSingle();

    let userRole = profile?.role || 'employee';

    // Apply role selection logic
    if (role === 'admin') {
      // For admin login, verify the user has admin role
      if (userRole !== 'admin') {
        // Check against env var admin emails as fallback
        const adminEmails = (process.env.REACT_APP_ADMIN_EMAILS || '')
          .split(',')
          .map(e => e.trim().toLowerCase())
          .filter(Boolean);
        
        if (!adminEmails.includes(email.toLowerCase())) {
          return res.status(403).json({
            success: false,
            error: 'This email belongs to an employee account, not an admin account'
          });
        }
        userRole = 'admin';
      }
    } else if (role === 'employee') {
      // For employee login, reject if user is admin
      if (userRole === 'admin') {
        return res.status(403).json({
          success: false,
          error: 'This email belongs to an admin account, not an employee account'
        });
      }
      userRole = 'employee';
    }

    // Return user info and auth session
    return res.status(200).json({
      success: true,
      user: {
        id: userId,
        email: authData.user.email,
        role: userRole,
      },
      session: {
        accessToken: authData.session?.access_token,
        refreshToken: authData.session?.refresh_token,
      }
    });

  } catch (error) {
    console.error('[AUTH] Login error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Login failed'
    });
  }
});

/**
 * POST /auth/logout
 * Logout endpoint (invalidates session)
 */
router.post('/logout', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Authentication service unavailable' });
    }

    // Sign out from Supabase
    await supabase.auth.signOut();

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[AUTH] Logout error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Logout failed'
    });
  }
});

/**
 * POST /auth/verify-session
 * Verify if a session token is still valid
 * 
 * Request header:
 * Authorization: Bearer <access_token>
 * 
 * Response:
 * {
 *   valid: boolean,
 *   user?: { id, email, role },
 *   error?: string
 * }
 */
router.post('/verify-session', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ valid: false, error: 'Authentication service unavailable' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ valid: false, error: 'No token provided' });
    }

    const accessToken = authHeader.substring(7);

    // Verify token with Supabase
    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error || !data.user) {
      return res.status(401).json({ valid: false, error: 'Invalid token' });
    }

    // Fetch user role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle();

    const userRole = profile?.role || 'employee';

    return res.status(200).json({
      valid: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        role: userRole,
      }
    });

  } catch (error) {
    console.error('[AUTH] Session verification error:', error);
    return res.status(500).json({
      valid: false,
      error: error.message || 'Verification failed'
    });
  }
});

// ─────────────────────────────────────────────────────────────────
// EMPLOYEE MANAGEMENT (requires service role key on backend)
// ─────────────────────────────────────────────────────────────────

/**
 * GET /auth/employees
 * List all users with role = 'employee'
 */
router.get('/employees', async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ success: false, error: 'Auth service unavailable' });
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, role, created_at')
      .eq('role', 'employee')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.status(200).json({ success: true, employees: data || [] });
  } catch (error) {
    console.error('[AUTH] List employees error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /auth/employees
 * Create a new employee account
 * Body: { email, password }
 */
router.post('/employees', async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ success: false, error: 'Auth service unavailable' });
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, error: 'Email and password are required' });

    // Create auth user via admin API (requires service role)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (authError) throw authError;

    // Upsert profile row
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert([{ id: authData.user.id, email, role: 'employee' }]);
    if (profileError) throw profileError;

    return res.status(201).json({ success: true, user: { id: authData.user.id, email } });
  } catch (error) {
    console.error('[AUTH] Create employee error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /auth/employees/:id
 * Update employee email and/or password
 * Body: { email?, password? }
 */
router.put('/employees/:id', async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ success: false, error: 'Auth service unavailable' });
    const { id } = req.params;
    const { email, password } = req.body;

    const updates = {};
    if (email) updates.email = email;
    if (password) updates.password = password;

    if (Object.keys(updates).length > 0) {
      const { error: authError } = await supabase.auth.admin.updateUserById(id, updates);
      if (authError) throw authError;
    }

    if (email) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ email })
        .eq('id', id);
      if (profileError) throw profileError;
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[AUTH] Update employee error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /auth/employees/:id
 * Delete an employee account
 */
router.delete('/employees/:id', async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ success: false, error: 'Auth service unavailable' });
    const { id } = req.params;

    // Delete from auth (cascades to profiles if FK is set, otherwise delete manually)
    const { error: authError } = await supabase.auth.admin.deleteUser(id);
    if (authError) throw authError;

    // Also delete from profiles table in case there's no cascade
    await supabase.from('profiles').delete().eq('id', id);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[AUTH] Delete employee error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
