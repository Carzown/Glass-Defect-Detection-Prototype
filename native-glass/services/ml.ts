import { Image } from 'react-native'
import Constants from 'expo-constants'
import { Buffer } from 'buffer'
import jpeg from 'jpeg-js'

export type DetectedBox = {
  x: number
  y: number
  width: number
  height: number
  score?: number
  label?: string
  // Optional segmentation polygons (normalized 0..1 coordinates)
  segments?: Array<Array<{ x: number; y: number }>>
}

export type DetectionResult = {
  boxes: DetectedBox[]
}

let pytorchAvailable: boolean | null = null
let modelLoaded = false
let modelPath: string | null = null
let modelModule: any | null = null
let triedResolveAsset = false

// Cloud inference fallback config
const extra = (Constants.expoConfig?.extra || {}) as Record<string, string>
const CLOUD_INFERENCE_URL: string | undefined = extra.CLOUD_INFERENCE_URL
const CLOUD_INFERENCE_TOKEN: string | undefined = extra.CLOUD_INFERENCE_TOKEN
// Minimal rate limit to avoid spamming cloud API
const CLOUD_MIN_INTERVAL_MS = parseInt(extra.CLOUD_INFERENCE_MIN_INTERVAL_MS || '1200', 10)
let lastCloudCall = 0

// Optional class names mapping, e.g. "scratch,bubble,crack"
const DEFECT_CLASS_NAMES: string[] | undefined = ((): string[] | undefined => {
  const raw = (extra as any)?.DEFECT_CLASS_NAMES as string | undefined
  if (!raw || typeof raw !== 'string') return undefined
  const arr = raw.split(',').map((s) => s.trim()).filter(Boolean)
  return arr.length ? arr : undefined
})()

// Helper: simulated detection for Expo Go or visual testing
function simulatedDetection(): DetectionResult {
  // Single obvious defect covering center area
  return {
    boxes: [
      {
        x: 0.25,
        y: 0.2,
        width: 0.5,
        height: 0.55,
        score: 0.95,
        label: 'Simulated Defect',
        segments: [
          [
            { x: 0.25, y: 0.2 },
            { x: 0.75, y: 0.2 },
            { x: 0.75, y: 0.75 },
            { x: 0.25, y: 0.75 },
          ],
        ],
      },
    ],
  }
}

function classNameForIndex(idx: number, nc?: number): string {
  if (Number.isFinite(idx)) {
    if (DEFECT_CLASS_NAMES && idx >= 0 && idx < DEFECT_CLASS_NAMES.length) {
      return DEFECT_CLASS_NAMES[idx]
    }
    // Sensible default for 3-class models
    if ((nc === 3 || (!nc && DEFECT_CLASS_NAMES?.length === 3)) && idx >= 0 && idx < 3) {
      return ['scratch', 'bubble', 'crack'][idx] || `Class ${idx}`
    }
  }
  return `Class ${Math.max(0, Math.floor(idx))}`
}

async function tryLoadPyTorchModel(): Promise<boolean> {
  // On-device PyTorch has been removed from this build. Always fall back
  // to cloud or simulated detection instead of attempting to load native
  // PyTorch modules which are not present in this repo.
  pytorchAvailable = false
  return false
}

export async function detectFromBase64(base64Jpeg: string): Promise<DetectionResult> {
  // Detect whether we're running inside Expo Go (no custom native modules)
  const isExpoGo = (Constants as any)?.appOwnership === 'expo'

  // If the environment requests simulated detections (or we're in Expo Go), use them
  if (isExpoGo || (extra as any)?.SIMULATED_DETECTION === 'true') {
    // eslint-disable-next-line no-console
    console.warn('Using simulated detection mode')
    return simulatedDetection()
  }

  // On-device inference has been removed. Skip local model execution and
  // fall back to cloud or simulated detection below.

  // Fallback: Cloud inference if configured (skip in Expo Go to use placeholder)
  if (CLOUD_INFERENCE_URL && !isExpoGo) {
    // Resolve localhost to LAN IP when using Expo LAN (devices cannot reach host's localhost)
    try {
      const extraCfg = (Constants.expoConfig || {}) as any
      const hostUri: string | undefined = extraCfg.hostUri
      let url = CLOUD_INFERENCE_URL
      if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(url)) {
        const host = hostUri?.split(':')[0]
        const isLan = host && /^\d+\.\d+\.\d+\.\d+$/.test(host)
        if (isLan) {
          url = url.replace('localhost', host).replace('127.0.0.1', host).replace('[::1]', host)
        } else {
          // On tunnel, localhost will not work from device
          // Return empty to avoid delays; suggest switching to LAN or using a public URL
          return { boxes: [] }
        }
      }
      // Update the URL for this call only
      const now = Date.now()
      if (now - lastCloudCall < CLOUD_MIN_INTERVAL_MS) {
        return { boxes: [] }
      }
      lastCloudCall = now
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(CLOUD_INFERENCE_TOKEN ? { authorization: `Bearer ${CLOUD_INFERENCE_TOKEN}` } : {}),
          },
          body: JSON.stringify({ image: `data:image/jpeg;base64,${base64Jpeg}` }),
        })
        if (!res.ok) return { boxes: [] }
        const json = await res.json()
        const boxes: DetectedBox[] = Array.isArray(json?.boxes)
          ? json.boxes.map((b: any) => ({
              x: Number(b.x) || 0,
              y: Number(b.y) || 0,
              width: Number(b.width) || 0,
              height: Number(b.height) || 0,
              score: typeof b.score === 'number' ? b.score : undefined,
              label: typeof b.label === 'string' ? b.label : undefined,
              segments: Array.isArray(b.segments)
                ? b.segments.map((seg: any) => Array.isArray(seg)
                    ? seg.map((pt: any) => ({ x: Number(pt?.x) || 0, y: Number(pt?.y) || 0 }))
                    : [])
                : undefined,
            }))
          : []
        return { boxes }
      } catch {
        return { boxes: [] }
      }
    } catch {
      // fallthrough to placeholder
    }
  }

  // No on-device and no cloud inference configured (or running in Expo Go) — return a minimal
  // placeholder detection so the pipeline can be demonstrated end-to-end.
  // This should be replaced by real model inference or a cloud endpoint.
  return {
    boxes: [
      {
        x: 0.3,
        y: 0.25,
        width: 0.4,
        height: 0.5,
        score: 0.5,
        label: 'Defect',
        segments: [
          [
            { x: 0.3, y: 0.25 },
            { x: 0.7, y: 0.25 },
            { x: 0.7, y: 0.75 },
            { x: 0.3, y: 0.75 },
          ],
        ],
      },
    ],
  }
}
