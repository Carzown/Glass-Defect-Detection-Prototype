import 'react-native-url-polyfill/auto'
import 'react-native-get-random-values'
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'

// Read Expo extra env
const extra = (Constants.expoConfig?.extra || {})
const SUPABASE_URL = extra.SUPABASE_URL
const SUPABASE_ANON_KEY = extra.SUPABASE_ANON_KEY

let supabase

const isValidUrl = typeof SUPABASE_URL === 'string' && /^https?:\/\//.test(SUPABASE_URL)

if (SUPABASE_URL && SUPABASE_ANON_KEY && isValidUrl) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    global: {
      headers: { 'X-Client-Info': 'native-glass' },
    },
  })
} else {
  console.warn('Supabase not configured or invalid URL. Add SUPABASE_URL and SUPABASE_ANON_KEY to app.json > extra or env.')
  const noop = async (..._args) => ({ data: null, error: null })
  const stubQuery = () => ({
    select: noop,
    gte: () => ({ order: () => ({ limit: () => ({ data: [], error: null }) }) }),
  })
  const stubChannel = () => ({ on: () => ({ subscribe: async () => {} }) })
  supabase = {
    auth: {
      signInWithPassword: async () => ({ data: null, error: new Error('Supabase not configured') }),
      signUp: async () => ({ data: null, error: new Error('Supabase not configured') }),
      signOut: async () => ({ error: null }),
      getUser: async () => ({ data: { user: null } }),
    },
    from: stubQuery,
    channel: stubChannel,
    removeChannel: () => {},
  }
}

export { supabase }

// Auth helpers
export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUpWithEmail(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data
}

export async function signOutUser() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getRole(uid) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', uid)
      .single()
    if (error) return undefined
    return data?.role
  } catch {
    return undefined
  }
}

export async function signInAndGetRole(email, password) {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
  if (authError) throw authError

  let role = 'employee'
  try {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .single()
    if (profileData?.role) role = profileData.role
  } catch {}

  return { uid: authData.user.id, email: authData.user.email, role }
}

export const config = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
}
