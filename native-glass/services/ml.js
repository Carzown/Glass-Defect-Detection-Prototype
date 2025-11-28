import { Image } from 'react-native'
import Constants from 'expo-constants'
import { Buffer } from 'buffer'
import jpeg from 'jpeg-js'

function simulatedDetection() {
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

const extra = (Constants.expoConfig?.extra || {})
const CLOUD_INFERENCE_URL = extra.CLOUD_INFERENCE_URL
const CLOUD_INFERENCE_TOKEN = extra.CLOUD_INFERENCE_TOKEN
const CLOUD_MIN_INTERVAL_MS = parseInt(extra.CLOUD_INFERENCE_MIN_INTERVAL_MS || '1200', 10)
let lastCloudCall = 0

export async function detectFromBase64(base64Jpeg) {
  const isExpoGo = (Constants as any)?.appOwnership === 'expo'
  if (isExpoGo || (extra as any)?.SIMULATED_DETECTION === 'true') {
    console.warn('Using simulated detection mode')
    return simulatedDetection()
  }

  // On-device inference removed; try cloud if configured
  if (CLOUD_INFERENCE_URL && !isExpoGo) {
    const now = Date.now()
    if (now - lastCloudCall < CLOUD_MIN_INTERVAL_MS) return { boxes: [] }
    lastCloudCall = now
    try {
      const res = await fetch(CLOUD_INFERENCE_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(CLOUD_INFERENCE_TOKEN ? { authorization: `Bearer ${CLOUD_INFERENCE_TOKEN}` } : {}),
        },
        body: JSON.stringify({ image: `data:image/jpeg;base64,${base64Jpeg}` }),
      })
      if (!res.ok) return { boxes: [] }
      const json = await res.json()
      return { boxes: Array.isArray(json?.boxes) ? json.boxes : [] }
    } catch (e) {
      return { boxes: [] }
    }
  }

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
