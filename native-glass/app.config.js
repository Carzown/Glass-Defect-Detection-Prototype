/**
 * Dynamic Expo config to inject environment variables at build/start time.
 * Allows using PowerShell env vars for Supabase and backend without hardcoding in app.json.
 */

// Load .env if present (Node side only, not bundled in app)
try { require('dotenv').config(); } catch (_) {}

module.exports = ({ config }) => {
  const fallbackUrl = 'https://kfeztemgrbkfwaicvgnk.supabase.co'

  const extra = {
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
