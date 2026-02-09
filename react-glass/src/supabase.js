import { createClient } from '@supabase/supabase-js';

// Supabase configuration from environment variables
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://kfeztemgrbkfwaicvgnk.supabase.co';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmZXp0ZW1ncmJrZndhaWN2Z25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMDM4NDIsImV4cCI6MjA3Njc3OTg0Mn0.n4F6v_kywu55Nj2Yx_dcZri4WsdUMaftzPl1FXT-to8';

let supabase;
let auth;

if (supabaseUrl && supabaseKey) {
  // Initialize Supabase
  supabase = createClient(supabaseUrl, supabaseKey);
  auth = supabase.auth;
  console.log('✅ Supabase initialized successfully');
  console.log('URL:', supabaseUrl);
} else {
  console.error(
    '❌ Supabase is NOT configured. Missing environment variables:',
    {
      REACT_APP_SUPABASE_URL: supabaseUrl ? '✅ Set' : '❌ Missing',
      REACT_APP_SUPABASE_ANON_KEY: supabaseKey ? '✅ Set' : '❌ Missing',
    }
  );
  // Provide stub objects so app can run without Supabase
  auth = {
    currentUser: null,
  };
  supabase = null;
}

export { auth, supabase };

// Authentication functions for Supabase
export async function signInWithEmail(email, password) {
  const { data, error } = await auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) throw error;
  return data.user;
}

export async function signUpWithEmail(email, password) {
  const { data, error } = await auth.signUp({
    email,
    password,
  });
  
  if (error) throw error;
  return data.user;
}

export async function signOut() {
  const { error } = await auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data, error } = await auth.getSession();
  
  if (error) throw error;
  return data.session?.user || null;
}

// User role management functions (Supabase profiles table)
export async function createUserWithRole(email, password, role) {
  // Create user in Supabase Auth
  const { data: authData, error: authError } = await auth.signUp({
    email,
    password,
  });
  
  if (authError) throw authError;

  // Store user role in profiles table
  const { data, error } = await supabase
    .from('profiles')
    .insert([
      {
        id: authData.user.id,
        email: authData.user.email,
        role: role,
        created_at: new Date(),
      },
    ]);
  
  if (error) throw error;

  return {
    uid: authData.user.id,
    email: authData.user.email,
    role,
  };
}

export async function signInAndGetRole(email, password) {
  // Sign in user
  const { data: authData, error: authError } = await auth.signInWithPassword({
    email,
    password,
  });
  
  if (authError) {
    console.error('❌ Supabase Auth Error:', authError);
    throw new Error(authError.message || 'Authentication failed');
  }

  console.log('✅ User authenticated:', authData.user.email);

  // Get user role from profiles table
  try {
    if (!supabase) {
      console.warn('⚠️ Supabase client not initialized, returning default employee role');
      return {
        uid: authData.user.id,
        email: authData.user.email,
        role: 'employee',
      };
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .single();
    
    if (error) {
      console.warn('⚠️ Could not fetch profile:', error);
      // PGRST116 = no rows found, which is OK - user just doesn't have a profile yet
      if (error.code !== 'PGRST116') {
        console.error('❌ Database error:', error);
      }
    } else {
      console.log('✅ User role fetched from database:', data?.role);
    }

    return {
      uid: authData.user.id,
      email: authData.user.email,
      role: data?.role || 'employee', // Default to employee if no profile exists
    };
  } catch (error) {
    console.error('❌ Error fetching user role:', error);
    return {
      uid: authData.user.id,
      email: authData.user.email,
      role: 'employee',
    };
  }
}

export async function getRole(uid) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', uid)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows found
    
    return data?.role;
  } catch (error) {
    console.error('Error fetching role:', error);
    return undefined;
  }
}

// ============================================================================
// IMAGE & DEFECT STORAGE FUNCTIONS
// ============================================================================

/**
 * Upload image to Supabase Storage bucket
 * @param {Blob|File} imageFile - Image file to upload
 * @param {string} bucketName - Bucket name (default: 'defect-images')
 * @param {string} path - Path within bucket (e.g., 'defects/2024-01-15_damage.jpg')
 * @returns {Promise<{url: string, path: string}>} Public URL and file path
 */
export async function uploadImageToStorage(imageFile, bucketName = 'defect-images', path) {
  try {
    if (!supabase) throw new Error('Supabase not initialized');
    
    const { data, error } = await supabase
      .storage
      .from(bucketName)
      .upload(path, imageFile, { cacheControl: '3600', upsert: false });
    
    if (error) throw error;
    
    // Get public URL
    const { data: publicUrl } = supabase
      .storage
      .from(bucketName)
      .getPublicUrl(path);
    
    return {
      url: publicUrl.publicUrl,
      path: data.path,
    };
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
}

/**
 * Save defect record to Supabase database
 * @param {Object} defectData - Defect record (device_id, defect_type, detected_at, image_url, etc.)
 * @returns {Promise<Object>} Inserted defect record
 */
export async function saveDefectRecord(defectData) {
  try {
    if (!supabase) throw new Error('Supabase not initialized');
    
    const { data, error } = await supabase
      .from('defects')
      .insert([defectData])
      .select()
      .single();
    
    if (error) throw error;
    
    console.log('✅ Defect saved:', data.id);
    return data;
  } catch (error) {
    console.error('Error saving defect:', error);
    throw error;
  }
}

/**
 * Fetch defects with optional filtering
 * @param {Object} filters - Filters (deviceId, status, limit, offset)
 * @returns {Promise<{data: Array, count: number}>}
 */
export async function fetchDefectsFromDB(filters = {}) {
  try {
    if (!supabase) throw new Error('Supabase not initialized');
    
    const { deviceId, status, limit = 50, offset = 0 } = filters;
    
    let query = supabase
      .from('defects')
      .select('*', { count: 'exact' })
      .order('detected_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (deviceId) query = query.eq('device_id', deviceId);
    if (status) query = query.eq('status', status);
    
    const { data, count, error } = await query;
    
    if (error) throw error;
    
    return { data: data || [], count: count || 0 };
  } catch (error) {
    console.error('Error fetching defects:', error);
    throw error;
  }
}

/**
 * Update defect status
 * @param {string} defectId - Defect record ID
 * @param {string} status - New status (pending, reviewed, resolved)
 * @param {string} notes - Optional notes
 * @returns {Promise<Object>} Updated defect
 */
export async function updateDefectStatus(defectId, status, notes = '') {
  try {
    if (!supabase) throw new Error('Supabase not initialized');
    
    const { data, error } = await supabase
      .from('defects')
      .update({ status, notes, updated_at: new Date() })
      .eq('id', defectId)
      .select()
      .single();
    
    if (error) throw error;
    
    console.log('✅ Defect status updated:', status);
    return data;
  } catch (error) {
    console.error('Error updating defect:', error);
    throw error;
  }
}

export async function signOutUser() {
  await signOut();
}
