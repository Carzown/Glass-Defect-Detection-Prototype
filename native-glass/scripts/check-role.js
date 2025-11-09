/**
 * Simple role verification script.
 * Provide TEST_EMAIL and TEST_PASSWORD in environment (or .env) to attempt login
 * and fetch the associated profile role.
 * Usage:
 *   node .\scripts\check-role.js
 */
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') })
const { createClient } = require('@supabase/supabase-js')

async function main() {
  const url = process.env.SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY
  const email = process.env.TEST_EMAIL
  const password = process.env.TEST_PASSWORD
  if (!url || !anon) {
    console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY')
    process.exit(1)
  }
  if (!email || !password) {
    console.error('Set TEST_EMAIL and TEST_PASSWORD in .env to use this script.')
    process.exit(1)
  }
  const supabase = createClient(url, anon, { auth: { persistSession: false } })
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
  if (signInError) {
    console.error('Sign-in failed:', signInError.message)
    process.exit(1)
  }
  const user = signInData.user
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profErr) {
    console.error('Profile fetch error:', profErr.message)
    process.exit(1)
  }
  console.log(`User ${email} role: ${profile?.role || 'unknown'}`)
}

main()
