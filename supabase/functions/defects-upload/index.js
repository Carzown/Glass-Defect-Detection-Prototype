// Supabase Edge Function: defects-upload (JavaScript)
// - Accepts multipart/form-data with fields: file (image), defect_type, device_id, time_text (optional)
// - Validates X-Device-Token header against DEVICE_INGEST_TOKEN secret
// - Uploads image to Storage bucket (BUCKET, default 'defects')
// - Inserts a row into public.defects with image_url and metadata
// - Returns { ok: true, defect } on success
//
// Env required:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY (service role)
// - DEVICE_INGEST_TOKEN (long random secret shared with device)
// - BUCKET (optional, defaults to 'defects')
// - USE_SIGNED_URLS (optional, 'true' to return signed URL instead of public)
// - SIGNED_URL_EXPIRES (seconds, default 86400)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-device-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' })
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const DEVICE_SECRET = Deno.env.get('DEVICE_INGEST_TOKEN')
  const BUCKET = Deno.env.get('BUCKET') || 'defects'
  const USE_SIGNED = (Deno.env.get('USE_SIGNED_URLS') || 'false').toLowerCase() === 'true'
  const SIGNED_EXPIRES = parseInt(Deno.env.get('SIGNED_URL_EXPIRES') || '86400')

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json(500, { ok: false, error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' })
  }
  if (!DEVICE_SECRET) {
    return json(500, { ok: false, error: 'Missing DEVICE_INGEST_TOKEN' })
  }

  const token = req.headers.get('x-device-token') || req.headers.get('X-Device-Token')
  if (!token || token !== DEVICE_SECRET) {
    return json(401, { ok: false, error: 'Unauthorized device' })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  try {
    const form = await req.formData()
    const file = form.get('file')
    const defect_type = String(form.get('defect_type') || 'Defect')
    const device_id = String(form.get('device_id') || 'unknown')
    const time_text = form.get('time_text') ? String(form.get('time_text')) : null

    if (!file || !(file instanceof File)) {
      return json(400, { ok: false, error: 'Missing file in multipart form-data' })
    }

    const ext = (file.type && file.type.includes('png')) ? 'png' : 'jpg'
    const ts = new Date().toISOString().replaceAll(':', '-').replaceAll('T', '_').replaceAll('Z', '')
    const key = `${device_id}/${ts}_${crypto.randomUUID()}.${ext}`

    const upload = await supabase.storage.from(BUCKET).upload(key, file, {
      contentType: file.type || (ext === 'png' ? 'image/png' : 'image/jpeg'),
      upsert: false,
    })
    if (upload.error) {
      return json(500, { ok: false, error: `upload_failed: ${upload.error.message}` })
    }

    let image_url
    if (USE_SIGNED) {
      const signed = await supabase.storage.from(BUCKET).createSignedUrl(key, SIGNED_EXPIRES)
      if (signed.error || !signed.data?.signedUrl) {
        return json(500, { ok: false, error: `signed_url_failed: ${signed.error?.message}` })
      }
      image_url = signed.data.signedUrl
    } else {
      const pub = supabase.storage.from(BUCKET).getPublicUrl(key)
      if (!pub.data?.publicUrl) {
        return json(500, { ok: false, error: 'public_url_failed' })
      }
      image_url = pub.data.publicUrl
    }

    const insert = await supabase
      .from('defects')
      .insert({ defect_type, image_url, time_text, device_id })
      .select()
      .single()

    if (insert.error) {
      return json(500, { ok: false, error: `insert_failed: ${insert.error.message}` })
    }

    return json(200, { ok: true, defect: insert.data })
  } catch (e) {
    return json(500, { ok: false, error: String(e) })
  }
})
