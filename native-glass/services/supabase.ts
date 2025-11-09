import 'react-native-url-polyfill/auto'
import 'react-native-get-random-values'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'

// Read Expo extra env
const extra = (Constants.expoConfig?.extra || {}) as Record<string, string>
const SUPABASE_URL = extra.SUPABASE_URL
const SUPABASE_ANON_KEY = extra.SUPABASE_ANON_KEY

let supabase: SupabaseClient

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
  // Minimal stub so the app won't crash without env config
  console.warn('Supabase not configured or invalid URL. Add SUPABASE_URL and SUPABASE_ANON_KEY to app.json > extra or env.')
  const noop = async (..._args: any[]) => ({ data: null as any, error: null as any })
  const stubQuery = () => ({
    select: noop,
    gte: () => ({ order: () => ({ limit: () => ({ data: [], error: null }) }) }),
  })
  const stubChannel = () => ({ on: () => ({ subscribe: async () => {} }) }) as any
  // @ts-ignore - build-time stub for dev
  supabase = {
    auth: {
      signInWithPassword: async () => ({ data: null, error: new Error('Supabase not configured') }),
      signUp: async () => ({ data: null, error: new Error('Supabase not configured') }),
      signOut: async () => ({ error: null }),
      getUser: async () => ({ data: { user: null } }),
    },
    from: stubQuery as any,
    channel: stubChannel,
    removeChannel: () => {},
  } as unknown as SupabaseClient
}

export { supabase }

// Auth helpers mirrored from web app
export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUpWithEmail(email: string, password: string) {
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

export async function getRole(uid: string): Promise<string | undefined> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', uid)
      .single()
    if (error) return undefined
    return (data as any)?.role
  } catch {
    return undefined
  }
}

export async function signInAndGetRole(email: string, password: string) {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
  if (authError) throw authError

  // Default to employee if no profile row
  let role = 'employee'
  try {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .single()
    if ((profileData as any)?.role) role = (profileData as any).role
  } catch {}

  return { uid: authData.user.id, email: authData.user.email!, role }
}

export const config = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
}
