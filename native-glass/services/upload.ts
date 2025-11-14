import 'react-native-get-random-values'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Alert } from 'react-native'

const extra = (Constants.expoConfig?.extra || {}) as Record<string,string>
const EDGE_UPLOAD_URL = extra.EDGE_UPLOAD_URL
const DEVICE_INGEST_TOKEN = extra.DEVICE_INGEST_TOKEN

export interface UploadResult { ok: boolean; defect?: any; error?: string }

export async function pickImage(): Promise<ImagePicker.ImagePickerAsset | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!perm.granted) {
    Alert.alert('Permission denied', 'Media library access is required to select an image')
    return null
  }
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, base64: true })
  if (res.canceled || !res.assets?.length) return null
  return res.assets[0]
}

export async function uploadDefectImage(params: { asset: ImagePicker.ImagePickerAsset; defect_type?: string; device_id?: string; time_text?: string }): Promise<UploadResult> {
  const { asset, defect_type = 'Defect', device_id = 'mobile', time_text } = params
  if (!EDGE_UPLOAD_URL) return { ok: false, error: 'EDGE_UPLOAD_URL not configured. Set it in app.json > expo.extra or .env.' }
  if (!DEVICE_INGEST_TOKEN) return { ok: false, error: 'DEVICE_INGEST_TOKEN not configured' }

  try {
    // Resolve localhost -> device-reachable host if possible (LAN only)
    let url = EDGE_UPLOAD_URL
    const hostUri = (Constants.expoConfig as any)?.hostUri as string | undefined
    const host = hostUri?.split(':')[0]
    const usingTunnel = hostUri ? !/^\d+\.\d+\.\d+\.\d+$/.test(host || '') : false
    if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(url)) {
      if (!usingTunnel && host) {
        // Replace localhost with LAN IP used by Metro
        url = url.replace('localhost', host).replace('127.0.0.1', host).replace('[::1]', host)
      } else {
        return { ok: false, error: 'Upload server is localhost but you are on Expo Tunnel. Switch to LAN or use a public HTTPS URL for EDGE_UPLOAD_URL.' }
      }
    }

    // Timeout guard
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), 15000)
    const form = new FormData()
    // React Native FormData expects a file descriptor with uri, name, and type
    const name = (asset as any).fileName || 'upload.jpg'
    const type = asset.mimeType || 'image/jpeg'
    form.append('file', { uri: asset.uri, name, type } as any)
    form.append('defect_type', defect_type)
    form.append('device_id', device_id)
    if (time_text) form.append('time_text', time_text)
    const res = await fetch(url, {
      method: 'POST',
      // Do not set Content-Type; RN will set the proper multipart boundary
      headers: { 'x-device-token': DEVICE_INGEST_TOKEN },
      body: form,
      signal: ac.signal as any,
    })
    clearTimeout(t)
    const json = await res.json()
    return json
  } catch (e: any) {
    const msg = (e?.name === 'AbortError')
      ? 'Network timeout. Check EDGE_UPLOAD_URL and connectivity.'
      : e?.message || String(e)
    // Provide actionable help for common RN fetch error
    if (msg.includes('Network request failed')) {
      return { ok: false, error: 'Network request failed. If EDGE_UPLOAD_URL is localhost, switch Expo to LAN and use http://<LAN-IP>:<PORT> or deploy a public HTTPS endpoint.' }
    }
    return { ok: false, error: msg }
  }
}
