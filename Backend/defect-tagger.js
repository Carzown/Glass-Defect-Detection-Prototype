// defect-tagger.js
// Watches Supabase for untagged defects.
// For each untagged defect:
//   1. Assigns the next sequential tag_number (ordered by detected_at — chronological, permanent)
//   2. If the defect has an image_url, downloads it, composites a numbered badge
//      (dark box, upper-left corner) using sharp, and uploads the result back to
//      Supabase Storage under tagged/<defect-id>-tag<n>.jpg
//   3. Writes tag_number + tagged_image_url back to the 'defects' table
//
// History is entirely in Supabase — persists across server restarts, page refreshes,
// and user logouts.
//
// Prerequisites (run once in Supabase SQL Editor):
//   ALTER TABLE defects ADD COLUMN IF NOT EXISTS tag_number INTEGER;
//   ALTER TABLE defects ADD COLUMN IF NOT EXISTS tagged_image_url TEXT;
//
// Storage: create a bucket named 'defects' in Supabase Storage (public read).
// Override bucket name with env DEFECT_IMAGES_BUCKET.

try { require('dotenv').config(); } catch (_) {}

const { createClient } = require('@supabase/supabase-js');

let sharp = null;
try {
  sharp = require('sharp');
  console.log('[Tagger] sharp loaded — images will be visually tagged');
} catch (_) {
  console.warn('[Tagger] ⚠️  sharp not installed — run "npm install sharp" in Backend/ to enable image tagging');
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const BUCKET       = process.env.DEFECT_IMAGES_BUCKET || 'defects';
const POLL_MS      = 6000; // poll Supabase every 6 seconds

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('[Tagger] ⚠️  Supabase not configured — defect tagger disabled');
  module.exports = { start: () => {}, stop: () => {} };
  // Early return pattern for CommonJS module-level guard
  return;
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Image helpers ────────────────────────────────────────────────────────────

/**
 * Build an SVG badge: dark navy rounded rectangle containing the tag number in white.
 * Sized dynamically so 3-digit numbers still fit.
 */
function makeBadgeSvg(number) {
  const label   = String(number);
  const fontSize = 14;
  const padX    = 8;
  const boxH    = 26;
  const boxW    = Math.max(28, label.length * 9 + padX * 2);
  const cx      = boxW / 2;
  const cy      = boxH / 2 + fontSize * 0.35;
  return Buffer.from(
    `<svg width="${boxW}" height="${boxH}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${boxW}" height="${boxH}" rx="5" ry="5"
        fill="#0f2942" fill-opacity="0.88"/>
      <text x="${cx}" y="${cy}" font-family="Arial,Helvetica,sans-serif"
        font-size="${fontSize}" font-weight="bold" fill="white"
        text-anchor="middle">${label}</text>
    </svg>`
  );
}

/**
 * Download image from a URL; returns a Buffer.
 */
async function downloadImage(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} downloading image from ${url}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

/**
 * Composite the numbered badge onto the upper-left corner of the image via sharp.
 * Returns a JPEG Buffer, or null if sharp is unavailable.
 */
async function buildTaggedImage(originalBuffer, tagNumber) {
  if (!sharp) return null;
  const badge = makeBadgeSvg(tagNumber);
  return sharp(originalBuffer)
    .composite([{ input: badge, top: 8, left: 8 }])
    .jpeg({ quality: 92 })
    .toBuffer();
}

/**
 * Upload a tagged image buffer to Supabase Storage and return its public URL.
 */
async function uploadToStorage(defectId, tagNumber, imageBuffer) {
  const filePath = `tagged/defect-${defectId}-tag${tagNumber}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, imageBuffer, { contentType: 'image/jpeg', upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────

/**
 * Return the next available sequential tag number (max existing + 1, starts at 1).
 * Reads from Supabase so the sequence is globally consistent across restarts.
 */
async function getNextTagNumber() {
  const { data } = await supabase
    .from('defects')
    .select('tag_number')
    .not('tag_number', 'is', null)
    .order('tag_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.tag_number ?? 0) + 1;
}

// ─── Core processing loop ─────────────────────────────────────────────────────

/**
 * Find all defects without a tag_number, assign sequential numbers (oldest first),
 * tag their images, and persist everything back to Supabase.
 */
async function processUntagged() {
  // Fetch defects that haven't been tagged yet, ordered oldest-first so numbering
  // follows chronological detection order.
  const { data: defects, error } = await supabase
    .from('defects')
    .select('id, image_url, detected_at')
    .is('tag_number', null)
    .order('detected_at', { ascending: true });

  if (error) {
    console.error('[Tagger] Query error:', error.message);
    return;
  }
  if (!defects?.length) return;

  const baseTag = await getNextTagNumber();
  console.log(`[Tagger] Tagging ${defects.length} defect(s) starting at #${baseTag}`);

  for (let i = 0; i < defects.length; i++) {
    const defect    = defects[i];
    const tagNumber = baseTag + i;

    try {
      let taggedUrl = null;

      if (defect.image_url) {
        const original = await downloadImage(defect.image_url);
        const tagged   = await buildTaggedImage(original, tagNumber);
        if (tagged) {
          taggedUrl = await uploadToStorage(defect.id, tagNumber, tagged);
        }
      }

      const { error: updateErr } = await supabase
        .from('defects')
        .update({ tag_number: tagNumber, tagged_image_url: taggedUrl })
        .eq('id', defect.id);

      if (updateErr) throw new Error(updateErr.message);

      console.log(
        `[Tagger] ✅ #${tagNumber} → defect ${defect.id}` +
        (taggedUrl ? ' (image tagged & stored)' : ' (no image — number assigned)')
      );
    } catch (err) {
      console.error(`[Tagger] ❌ defect ${defect.id}:`, err.message);
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

let _timer = null;

function start() {
  // Process any existing untagged defects immediately on startup
  processUntagged().catch(err => console.error('[Tagger] startup run:', err.message));

  // Then poll on interval for new arrivals
  _timer = setInterval(
    () => processUntagged().catch(err => console.error('[Tagger] poll run:', err.message)),
    POLL_MS
  );

  console.log(`[Tagger] 🏷️  Defect tagger running — polling every ${POLL_MS / 1000}s (bucket: "${BUCKET}")`);
}

function stop() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
}

module.exports = { start, stop };
