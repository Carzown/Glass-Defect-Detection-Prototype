import { createClient } from '@supabase/supabase-js';

// Supabase configuration from environment variables
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

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

export async function signOutUser() {
  await signOut();
}
