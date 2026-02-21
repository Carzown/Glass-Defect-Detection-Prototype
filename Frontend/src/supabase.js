import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://kfeztemgrbkfwaicvgnk.supabase.co';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmZXp0ZW1ncmJrZndhaWN2Z25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMDM4NDIsImV4cCI6MjA3Njc3OTg0Mn0.n4F6v_kywu55Nj2Yx_dcZri4WsdUMaftzPl1FXT-to8';

let supabase;
let auth;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  auth = supabase.auth;
  console.log('✅ Supabase initialized');
} else {
  console.error('❌ Supabase not configured');
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

  try {
    if (!supabase) {
      return {
        uid: authData.user.id,
        email: authData.user.email,
        role: 'employee',
      };
    }

    const { data, error: _profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .single();

    return {
      uid: authData.user.id,
      email: authData.user.email,
      role: data?.role || 'employee',
    };
  } catch (_error) {
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
    
    console.log('✅ Defect saved:', data.id);
    return data;
  } catch (error) {
    console.error('Error saving defect:', error);
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
