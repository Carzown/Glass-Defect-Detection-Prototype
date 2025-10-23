import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// Authentication functions for Supabase
export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  
  if (error) throw error
  return data
}

export async function signUpWithEmail(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })
  
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// User role management functions
export async function createUserWithRole(email, password, role) {
  // Sign up the user first
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  })
  
  if (authError) throw authError
  
  // Insert user role into profiles table
  const { error } = await supabase
    .from('profiles')
    .insert([
      { 
        id: authData.user.id,
        email: authData.user.email,
        role: role 
      }
    ])
  
  if (error) throw error
  
  return { 
    uid: authData.user.id, 
    email: authData.user.email, 
    role 
  }
}

export async function signInAndGetRole(email, password) {
  // Sign in the user
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  
  if (authError) throw authError
  
  // Get user role from profiles table
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .single()
  
  if (profileError) {
    // If no profile exists, default to employee
    const role = 'employee'
    return { 
      uid: authData.user.id, 
      email: authData.user.email, 
      role 
    }
  }
  
  return { 
    uid: authData.user.id, 
    email: authData.user.email, 
    role: profileData.role 
  }
}

export async function getRole(uid) {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', uid)
    .single()
  
  if (error) return undefined
  return data.role
}

export async function signOutUser() {
  await signOut()
}