const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') })
const { createClient } = require('@supabase/supabase-js')

async function main() {
  const url = process.env.SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY
  const result = { ok: false, url, error: null, defectsCount: null }

  if (!url || !/^https?:\/\//.test(url)) {
    result.error = 'Invalid or missing SUPABASE_URL'
    return finish(result)
  }
  if (!anon || anon.trim() === '') {
    result.error = 'Missing SUPABASE_ANON_KEY in .env'
    return finish(result)
  }

  try {
    const supabase = createClient(url, anon, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })
    // Lightweight HEAD query to get a count without returning rows
    const { count, error } = await supabase
      .from('defects')
      .select('id', { count: 'exact', head: true })
    if (error) throw error
    result.ok = true
    result.defectsCount = typeof count === 'number' ? count : null
    return finish(result)
  } catch (e) {
    result.error = e.message || String(e)
    return finish(result)
  }
}

function finish(res) {
  console.log('\nSupabase Connectivity Check')
  console.log('----------------------------')
  console.log('URL:        ', res.url || '<none>')
  console.log('Connected:  ', res.ok ? 'YES' : 'NO')
  if (res.ok && typeof res.defectsCount === 'number') {
    console.log('Defects:    ', res.defectsCount)
  }
  if (res.error) console.log('Error:      ', res.error)
  console.log('\nTip: Edit native-glass/.env and set SUPABASE_URL & SUPABASE_ANON_KEY.')
  process.exit(res.ok ? 0 : 1)
}

main()
