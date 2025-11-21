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
  if (pytorchAvailable === false) return false
  // If running inside Expo Go, native JSI modules aren't available.
  // Avoid requiring `react-native-pytorch-core` which throws when JSI is missing.
  try {
    const appOwnership = (Constants as any)?.appOwnership
    if (appOwnership === 'expo') {
      pytorchAvailable = false
      // eslint-disable-next-line no-console
      console.warn('Expo Go detected — skipping react-native-pytorch-core and using fallback inference.')
      return false
    }
  } catch {
    // ignore and continue to attempt require in unknown environments
  }
  try {
    // Dynamic import to avoid crashing if library not installed
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const torch = require('react-native-pytorch-core')

    // Resolve model asset if bundled via Metro. This requires placing the .pt file
    // inside the project assets and using require(). If not present, we try to
    // resolve a pre-downloaded model path via Constants.expoConfig?.extra?.MODEL_PATH
    // or a previously downloaded file on disk (not handled here).
    if (!modelPath) {
      const extra = (Constants.expoConfig?.extra || {}) as Record<string, string>
      if (extra.MODEL_PATH) {
        modelPath = extra.MODEL_PATH
      } else {
        // Attempt to resolve a bundled asset via Metro using RN's asset resolver.
        // The file must exist at native-glass/yolov11_small_model.pt and metro.config.js
        // must include 'pt' in assetExts.
        try {
          if (!triedResolveAsset) {
            triedResolveAsset = true
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            let modId: any = null
            try {
              // Prefer mobile lite interpreter file if present
              modId = require('../yolov11_small_model.ptl')
            } catch {
              modId = require('../yolov11_small_model.pt')
            }
            const src = Image.resolveAssetSource(modId as any)
            modelPath = src?.uri || null
          }
        } catch {
          // ignore
        }
        if (!modelPath) {
          pytorchAvailable = false
          return false
        }
      }
    }

    if (!modelLoaded) {
      try {
        if (torch?.jit?._loadForMobile) {
          modelModule = await torch.jit._loadForMobile(modelPath)
        } else if (torch?.Module?.load) {
          modelModule = await torch.Module.load(modelPath)
        } else {
          // Fallback attempt
          modelModule = await torch.Module.load(modelPath)
        }
        modelLoaded = true
      } catch (e) {
        pytorchAvailable = false
        return false
      }
    }
    pytorchAvailable = true
    return true
  } catch (e) {
    // Library or asset not available
    pytorchAvailable = false
    return false
  }
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

  // Try on-device PyTorch first
  const canUseLocal = await tryLoadPyTorchModel()
  if (canUseLocal) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const torch = require('react-native-pytorch-core')
      const torchvision = torch?.torchvision
      const T = torchvision?.transforms

      if (!modelModule) return { boxes: [] }

      // 1) Decode base64 JPEG to RGBA bytes using jpeg-js
      let rgba: Uint8Array
      let width = 0
      let height = 0
      try {
        const buf = Buffer.from(base64Jpeg, 'base64')
        const decoded = jpeg.decode(buf, { useTArray: true }) as { data: Uint8Array; width: number; height: number }
        rgba = decoded.data
        width = decoded.width
        height = decoded.height
        if (!rgba || !width || !height) return { boxes: [] }
      } catch {
        return { boxes: [] }
      }

      // 2) Convert RGBA -> RGB packed bytes (HWC)
      const pixelCount = width * height
      const rgb = new Uint8Array(pixelCount * 3)
      for (let i = 0, j = 0; i < pixelCount; i += 1) {
        const idx4 = i * 4
        const idx3 = j
        rgb[idx3] = rgba[idx4]
        rgb[idx3 + 1] = rgba[idx4 + 1]
        rgb[idx3 + 2] = rgba[idx4 + 2]
        j += 3
      }

      // 3) Build tensor and preprocess to [1,3,640,640]
      let tensor = torch.fromBlob(rgb, [height, width, 3])
      tensor = tensor.permute([2, 0, 1]) // CHW
      tensor = tensor.div(255)

      // Center crop to square then resize. If torchvision transforms are not available,
      // fall back to a naive center crop without resize (model may handle dynamic sizes).
      try {
        if (T) {
          const size = Math.min(width, height)
          const centerCrop = T.centerCrop(size)
          tensor = centerCrop(tensor)
          const resize = T.resize(640)
          tensor = resize(tensor)
        }
      } catch {
        // ignore; proceed without transforms
      }
      tensor = tensor.unsqueeze(0)

      // 4) Inference
      const rawOut = await modelModule.forward(tensor)

      // 5) Postprocess
      // Helper to get tensor-like shape and data
      function toArray(t: any): { data: Float32Array; shape: number[] } {
        const shape = (typeof t.sizes === 'function' ? t.sizes() : t.shape) || []
        const flat: Float32Array = typeof t.data === 'function' ? t.data() : t.dataSync ? t.dataSync() : t?.toArray?.() || new Float32Array()
        return { data: flat, shape }
      }

      // Ultralytics YOLOv11-seg TorchScript returns a tuple: (bs, 39, 8400) detections and (bs, 32, 160, 160) protos.
      // We only use detections here.
      const outDet = Array.isArray(rawOut) || rawOut?.length
        ? (rawOut[0] ?? rawOut)
        : rawOut

      // Attempt to squeeze batch dim
      let out = outDet
      if (typeof outDet?.squeeze === 'function') {
        try { out = outDet.squeeze(0) } catch {}
      }
      const { data: outData, shape } = toArray(out)
      if (!outData?.length || !shape?.length) return { boxes: [] }

      const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
      const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))
      const inpSize = 640
      const boxes: DetectedBox[] = []

      if (shape.length === 2) {
        // Expect [C, N] or [N, C]
        const dim0 = shape[0]
        const dim1 = shape[1]
        const C = dim0 <= 64 ? dim0 : dim1 // if channels small assume [C,N] else [N,C]
        const N = C === dim0 ? dim1 : dim0
        const channelsFirst = C === dim0
        const ncCandidates = [3, 2, 4, 5, 6, 7, 8, 10, 1]

        const tryParse = (getVec: (i: number) => Float32Array) => {
          // vec layout assumed: [cx,cy,w,h, class_probs..., mask_coeffs...]
          const vec = getVec(0)
          const Cguess = vec.length
          // Prefer seg layout: 4 + nc + 32
          let nc = (Cguess - 4 - 32)
          if (!(nc > 0 && nc <= 80)) {
            // Fallback heuristic
            for (const k of ncCandidates) {
              if (Cguess >= 4 + k) { nc = k; break }
            }
            if (!(nc > 0)) nc = Math.max(1, Math.min(80, Cguess - 4))
          }
          const nm = Math.max(0, C - 4 - nc)
          let added = 0
          for (let i = 0; i < N; i += 1) {
            const v = getVec(i)
            const cx = v[0]; const cy = v[1]; const w = v[2]; const h = v[3]
            if (!isFinite(cx) || !isFinite(cy) || !isFinite(w) || !isFinite(h)) continue
            const clsScores = v.slice(4, 4 + nc)
            let best = 0; let bestIdx = 0
            for (let c = 0; c < clsScores.length; c += 1) {
              const s = sigmoid(clsScores[c])
              if (s > best) { best = s; bestIdx = c }
            }
            if (best < 0.25) continue
            const nx = clamp01((cx - w / 2) / inpSize)
            const ny = clamp01((cy - h / 2) / inpSize)
            const nw = clamp01(w / inpSize)
            const nh = clamp01(h / inpSize)
            boxes.push({ x: nx, y: ny, width: nw, height: nh, score: best, label: classNameForIndex(bestIdx, nc) })
            added += 1
            if (boxes.length >= 20) break
          }
          return added
        }

        if (channelsFirst) {
          // out shape [C,N], data layout contiguous; construct accessor returning a view per anchor
          const Cstride = 1
          const Nstride = C
          const getVec = (i: number) => {
            const start = i * Nstride
            const vec = new Float32Array(C)
            for (let k = 0; k < C; k += 1) vec[k] = outData[k * (N) + i]
            return vec
          }
          tryParse(getVec)
        } else {
          // out shape [N,C]
          const getVec = (i: number) => {
            const start = i * C
            return outData.subarray(start, start + C)
          }
          tryParse(getVec)
        }
      } else if (shape.length === 3) {
        // Likely [B, C, N] with B squeezed already failed; handle without squeeze
        // Fallback: assume [1, C, N]
        const B = shape[0]
        const C = shape[1]
        const N = shape[2]
        if (B >= 1) {
          const getVec = (i: number) => {
            const vec = new Float32Array(C)
            for (let k = 0; k < C; k += 1) {
              vec[k] = outData[k * N + i]
            }
            return vec
          }
          // Use same parse as above
          const ncCandidates = [3, 2, 4, 5, 6, 7, 8, 10, 1]
          const Cguess = C
          let nc = (Cguess - 4 - 32)
          if (!(nc > 0 && nc <= 80)) {
            for (const k of ncCandidates) { if (Cguess >= 4 + k) { nc = k; break } }
            if (!(nc > 0)) nc = Math.max(1, Math.min(80, Cguess - 4))
          }
          for (let i = 0; i < N; i += 1) {
            const v = getVec(i)
            const cx = v[0]; const cy = v[1]; const w = v[2]; const h = v[3]
            if (!isFinite(cx) || !isFinite(cy) || !isFinite(w) || !isFinite(h)) continue
            const clsScores = v.slice(4, 4 + nc)
            let best = 0; let bestIdx = 0
            for (let c = 0; c < clsScores.length; c += 1) {
              const s = sigmoid(clsScores[c])
              if (s > best) { best = s; bestIdx = c }
            }
            if (best < 0.25) continue
            const nx = clamp01((cx - w / 2) / inpSize)
            const ny = clamp01((cy - h / 2) / inpSize)
            const nw = clamp01(w / inpSize)
            const nh = clamp01(h / inpSize)
            boxes.push({ x: nx, y: ny, width: nw, height: nh, score: best, label: classNameForIndex(bestIdx, nc) })
            if (boxes.length >= 20) break
          }
        }
      } else {
        // Fallback to generic parsing (legacy models)
        const rows = shape.length === 2 ? shape[0] : shape.length === 1 ? shape[0] / 6 : (shape[1] || 0)
        const cols = shape.length >= 2 ? shape[1] : 6
        for (let i = 0; i < rows; i += 1) {
          const base = i * cols
          const a0 = outData[base + 0]
          const a1 = outData[base + 1]
          const a2 = outData[base + 2]
          const a3 = outData[base + 3]
          const conf = cols >= 5 ? outData[base + 4] : 1
          const cls = cols >= 6 ? outData[base + 5] : -1
          if (!isFinite(a0) || !isFinite(a1) || !isFinite(a2) || !isFinite(a3) || !isFinite(conf)) continue
          if (conf < 0.25) continue
          let x = 0, y = 0, w = 0, h = 0
          if (a2 > 1.2 || a3 > 1.2) {
            const x1 = a0 / inpSize
            const y1 = a1 / inpSize
            const x2 = a2 / inpSize
            const y2 = a3 / inpSize
            x = clamp01(Math.min(x1, x2))
            y = clamp01(Math.min(y1, y2))
            w = clamp01(Math.abs(x2 - x1))
            h = clamp01(Math.abs(y2 - y1))
          } else {
            w = clamp01(a2)
            h = clamp01(a3)
            x = clamp01(a0 - w / 2)
            y = clamp01(a1 - h / 2)
          }
          boxes.push({ x, y, width: w, height: h, score: conf, label: Number.isFinite(cls) ? classNameForIndex(Math.round(cls)) : 'Defect' })
          if (boxes.length >= 20) break
        }
      }

      return { boxes }
    } catch {
      // fallthrough
    }
  }

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
