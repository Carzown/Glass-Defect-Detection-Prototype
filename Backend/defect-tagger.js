
try { require('dotenv').config(); } catch (_) {}

const { createClient } = require('@supabase/supabase-js');

let sharp = null;
try {
  sharp = require('sharp');
  console.log('[Tagger] sharp loaded — images will be visually tagged');
} catch (_) {
  console.warn('[Tagger] ⚠️  sharp not installed');
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const BUCKET       = process.env.DEFECT_IMAGES_BUCKET || 'defects';
const POLL_MS      = 6000; 

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('[Tagger] ⚠️  Supabase not configured');
  module.exports = { start: () => {}, stop: () => {} };
  return;
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

async function downloadImage(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} downloading image from ${url}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

async function buildTaggedImage(originalBuffer, tagNumber) {
  if (!sharp) return null;
  const badge = makeBadgeSvg(tagNumber);
  
  
  const metadata = await sharp(originalBuffer).metadata();
  const imageWidth = metadata.width || 640;
  const badgeWidth = Math.max(28, String(tagNumber).length * 9 + 16); 
  const rightPosition = Math.max(0, imageWidth - badgeWidth - 8); 
  
  return sharp(originalBuffer)
    .composite([{ input: badge, top: 8, left: rightPosition }])
    .jpeg({ quality: 92 })
    .toBuffer();
}

async function uploadToStorage(defectId, tagNumber, imageBuffer) {
  const filePath = `tagged/defect-${defectId}-tag${tagNumber}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, imageBuffer, { contentType: 'image/jpeg', upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

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

async function processUntagged() {
  
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
      const { error: updateErr } = await supabase
        .from('defects')
        .update({ tag_number: tagNumber })
        .eq('id', defect.id);

      if (updateErr) throw new Error(updateErr.message);

      console.log(`[Tagger] ✅ #${tagNumber} → defect ${defect.id}`);
    } catch (err) {
      console.error(`[Tagger] ❌ defect ${defect.id}:`, err.message);
    }
  }
}

let _timer = null;

function start() {
  processUntagged().catch(err => console.error('[Tagger] startup:', err.message));
  _timer = setInterval(
    () => processUntagged().catch(err => console.error('[Tagger] poll:', err.message)),
    POLL_MS
  );
  console.log(`[Tagger] running - polling every ${POLL_MS / 1000}s (bucket: "${BUCKET}")`);
}

function stop() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
}

module.exports = { start, stop };
