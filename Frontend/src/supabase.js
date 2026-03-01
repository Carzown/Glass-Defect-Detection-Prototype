import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

let supabase;
let auth;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  auth = supabase.auth;
} else {
  auth = { currentUser: null };
  supabase = null;
}

export { auth, supabase };
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
  const { error } = await supabase
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
  const { data: authData, error: authError } = await auth.signInWithPassword({
    email,
    password,
  });
  
  if (authError) throw new Error(authError.message);

  if (!supabase) throw new Error('Supabase not configured');

  // Try lookup by user id first
  let role = null;
  const { data: byId } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (byId?.role) {
    role = byId.role;
  } else {
    // Fallback: try lookup by email
    const { data: byEmail } = await supabase
      .from('profiles')
      .select('role')
      .eq('email', authData.user.email)
      .maybeSingle();
    role = byEmail?.role || null;
  }

  // Final fallback: check against REACT_APP_ADMIN_EMAILS env var
  if (!role || role === 'employee') {
    const adminEmails = (process.env.REACT_APP_ADMIN_EMAILS || '')
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);
    if (adminEmails.includes(authData.user.email.toLowerCase())) {
      role = 'admin';
    }
  }

  return {
    uid: authData.user.id,
    email: authData.user.email,
    role: role || 'employee',
  };
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

// Upload image to Supabase Storage
export async function uploadImageToStorage(imageFile, bucketName = 'defects', path) {
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

// Save defect record to database
export async function saveDefectRecord(defectData) {
  try {
    if (!supabase) throw new Error('Supabase not initialized');
    
    const { data, error } = await supabase
      .from('defects')
      .insert([defectData])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
}

// Fetch defects from database with pagination
export async function fetchDefectsFromDB(filters = {}) {
  try {
    if (!supabase) throw new Error('Supabase not initialized');

    const { limit = 50, offset = 0 } = filters;

    let query = supabase
      .from('defects')
      .select('*', { count: 'exact' })
      .order('detected_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) throw error;

    return { data: data || [], count: count || 0 };
  } catch (error) {
    console.error('Error fetching defects:', error);
    throw error;
  }
}



export async function signOutUser() {
  await signOut();
}
