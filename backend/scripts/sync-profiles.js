#!/usr/bin/env node
// Sync missing rows in public.profiles for all Supabase Auth users.
// Usage:
//   node scripts/sync-profiles.js [--role=employee] [--dry-run]
// Env:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

try { require('dotenv').config(); } catch (_) {}
const { createClient } = require('@supabase/supabase-js');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { role: 'employee', dryRun: false };
  for (const a of args) {
    if (a.startsWith('--role=')) out.role = a.split('=')[1] || 'employee';
    if (a === '--dry-run') out.dryRun = true;
  }
  return out;
}

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  return createClient(url, key);
}

async function listAllAuthUsers(supabase, perPage = 200) {
  const all = [];
  let page = 1;
  /* supabase-js v2 admin.listUsers supports pagination by page/perPage */
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    all.push(...users);
    if (users.length < perPage) break;
    page += 1;
  }
  return all;
}

async function main() {
  const { role, dryRun } = parseArgs();
  const supabase = getAdminClient();

  console.log('Sync profiles start', { role, dryRun });

  const users = await listAllAuthUsers(supabase);
  console.log(`Fetched ${users.length} auth users`);

  // Process in chunks
  const chunkSize = 200;
  let missingCount = 0;
  let insertedCount = 0;

  for (let i = 0; i < users.length; i += chunkSize) {
    const chunk = users.slice(i, i + chunkSize);
    const ids = chunk.map((u) => u.id);

    // Fetch existing profiles for these ids
    const { data: existing, error: existingErr } = await supabase
      .from('profiles')
      .select('id')
      .in('id', ids);
    if (existingErr) throw existingErr;
    const existingSet = new Set((existing || []).map((r) => r.id));

    const toInsert = chunk
      .filter((u) => !existingSet.has(u.id))
      .map((u) => ({ id: u.id, email: u.email, role }));

    if (toInsert.length === 0) continue;
    missingCount += toInsert.length;

    if (dryRun) {
      console.log(`[dry-run] Would insert ${toInsert.length} profiles in batch ${i / chunkSize + 1}`);
      continue;
    }

    const { error: insErr, count } = await supabase
      .from('profiles')
      .insert(toInsert, { count: 'exact' });
    if (insErr) throw insErr;
    insertedCount += count || toInsert.length;
    console.log(`Inserted ${count || toInsert.length} profiles`);
  }

  console.log('Sync complete', { missing: missingCount, inserted: insertedCount, totalUsers: users.length });
}

main().catch((e) => {
  console.error('Sync failed:', e?.message || e);
  process.exit(1);
});
