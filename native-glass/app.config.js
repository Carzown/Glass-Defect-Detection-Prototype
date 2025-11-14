/**
 * Dynamic Expo config to inject environment variables at build/start time.
 * Allows using PowerShell env vars for Supabase and backend without hardcoding in app.json.
 */

// Load .env if present (Node side only, not bundled in app)
try { require('dotenv').config(); } catch (_) {}

module.exports = ({ config }) => {
  const fallbackUrl = 'https://kfeztemgrbkfwaicvgnk.supabase.co'

  // Merge existing extra to preserve fields added by tooling (e.g., extra.eas.projectId)
  const extra = {
    ...(config.extra || {}),
    SUPABASE_URL:
      process.env.SUPABASE_URL || (config.extra && config.extra.SUPABASE_URL) || fallbackUrl,
    SUPABASE_ANON_KEY:
      process.env.SUPABASE_ANON_KEY || (config.extra && config.extra.SUPABASE_ANON_KEY) || '',
    BACKEND_URL:
      process.env.BACKEND_URL || (config.extra && config.extra.BACKEND_URL) || 'http://localhost:5000',
    ENABLE_SUPABASE_REALTIME:
      process.env.ENABLE_SUPABASE_REALTIME ?? (config.extra && config.extra.ENABLE_SUPABASE_REALTIME) ?? 'true',
    EDGE_UPLOAD_URL:
      process.env.EDGE_UPLOAD_URL || (config.extra && config.extra.EDGE_UPLOAD_URL) || '',
    DEVICE_INGEST_TOKEN:
      process.env.DEVICE_INGEST_TOKEN || (config.extra && config.extra.DEVICE_INGEST_TOKEN) || '',
    // Inference over HTTP for Expo Go (no dev client)
    CLOUD_INFERENCE_URL:
      process.env.CLOUD_INFERENCE_URL || (config.extra && config.extra.CLOUD_INFERENCE_URL) || '',
    CLOUD_INFERENCE_TOKEN:
      process.env.CLOUD_INFERENCE_TOKEN || (config.extra && config.extra.CLOUD_INFERENCE_TOKEN) || '',
    CLOUD_INFERENCE_MIN_INTERVAL_MS:
      process.env.CLOUD_INFERENCE_MIN_INTERVAL_MS || (config.extra && config.extra.CLOUD_INFERENCE_MIN_INTERVAL_MS) || '1200',
    // Class names mapping for detection labels
    DEFECT_CLASS_NAMES:
      process.env.DEFECT_CLASS_NAMES || (config.extra && config.extra.DEFECT_CLASS_NAMES) || 'scratch,bubble,crack',
  }

  return {
    ...config,
    extra,
    ios: {
      ...(config.ios || {}),
      bundleIdentifier: (config.ios && config.ios.bundleIdentifier) || 'com.carzown.nativeglass',
    },
    android: {
      ...(config.android || {}),
      package: (config.android && config.android.package) || 'com.carzown.nativeglass',
    },
    plugins: [
      ...((config.plugins || []).filter((p) => p !== 'expo-image-picker')),
      'expo-image-picker',
    ],
  }
}
