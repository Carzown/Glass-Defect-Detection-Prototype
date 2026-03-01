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
            error: 'This account does not have admin access'
          });
        }
        userRole = 'admin';
      }
    } else {
      // For employee login, accept any non-admin or admin role
      // (admin can also login as employee)
      if (userRole === 'admin') {
        userRole = 'admin'; // Keep their admin role
      } else {
        userRole = 'employee';
      }
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

module.exports = router;
