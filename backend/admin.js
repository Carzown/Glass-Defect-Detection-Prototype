// Admin API: list users and change passwords via Supabase Admin API
// Security: requires header `x-admin-token` to match process.env.ADMIN_API_TOKEN
const express = require('express')
const { createClient } = require('@supabase/supabase-js')
try { require('dotenv').config(); } catch (_) {}

const router = express.Router()

function requireAdminToken(req, res, next) {
  const provided = req.header('x-admin-token') || ''
  const expected = process.env.ADMIN_API_TOKEN || ''
  if (!expected || provided !== expected) {
    return res.status(401).json({ ok: false, error: 'unauthorized' })
  }
  next()
}

function getAdminClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, key)
}

// GET /admin/users - list auth users and merge profile roles
router.get('/users', requireAdminToken, async (_req, res) => {
  try {
    const supabase = getAdminClient()

    // List users (first page, large page size)
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (usersError) return res.status(500).json({ ok: false, error: usersError.message })

    // Fetch profiles
    const { data: profiles, error: profErr } = await supabase.from('profiles').select('id, email, role')
    if (profErr) return res.status(500).json({ ok: false, error: profErr.message })
    const roleById = new Map(profiles?.map((p) => [p.id, { role: p.role, email: p.email }]))

    const users = (usersData?.users || []).map((u) => ({
      id: u.id,
      email: u.email,
      role: roleById.get(u.id)?.role || 'employee',
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
    }))

    res.json({ ok: true, count: users.length, users })
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) })
  }
})

// POST /admin/users/:id/password { password }
router.post('/users/:id/password', requireAdminToken, async (req, res) => {
  const { id } = req.params
  const { password } = req.body || {}
  if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ ok: false, error: 'password_min_8' })
  }
  try {
    const supabase = getAdminClient()
    const { data, error } = await supabase.auth.admin.updateUserById(id, { password })
    if (error) return res.status(500).json({ ok: false, error: error.message })
    res.json({ ok: true, user: { id: data.user?.id, email: data.user?.email } })
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) })
  }
})

module.exports = router

// Extra routes for convenience
router.get('/ping', requireAdminToken, (_req, res) => res.json({ ok: true }))

// GET /admin/employees - list only users with role 'employee'
router.get('/employees', requireAdminToken, async (_req, res) => {
  try {
    const supabase = getAdminClient()
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (usersError) return res.status(500).json({ ok: false, error: usersError.message })
    const { data: profiles, error: profErr } = await supabase.from('profiles').select('id, email, role')
    if (profErr) return res.status(500).json({ ok: false, error: profErr.message })
    const roleById = new Map(profiles?.map((p) => [p.id, { role: p.role, email: p.email }]))
    const employees = (usersData?.users || [])
      .map((u) => ({ id: u.id, email: u.email, role: roleById.get(u.id)?.role || 'employee', created_at: u.created_at, last_sign_in_at: u.last_sign_in_at }))
      .filter((u) => u.role === 'employee')
    res.json({ ok: true, count: employees.length, users: employees })
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) })
  }
})
