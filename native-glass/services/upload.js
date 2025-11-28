import Constants from 'expo-constants'
import { Buffer } from 'buffer'

const extra = (Constants.expoConfig?.extra || {})
const EDGE_UPLOAD_URL = extra.EDGE_UPLOAD_URL
const DEVICE_INGEST_TOKEN = extra.DEVICE_INGEST_TOKEN

export async function uploadImageBase64(base64Jpeg, metadata = {}) {
  if (!EDGE_UPLOAD_URL) return { ok: false, error: 'No EDGE_UPLOAD_URL configured' }
  try {
    const res = await fetch(EDGE_UPLOAD_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(DEVICE_INGEST_TOKEN ? { authorization: `Bearer ${DEVICE_INGEST_TOKEN}` } : {}),
      },
      body: JSON.stringify({ image: `data:image/jpeg;base64,${base64Jpeg}`, metadata }),
    })
    if (!res.ok) return { ok: false, error: await res.text() }
    const json = await res.json()
    return { ok: true, data: json }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}
