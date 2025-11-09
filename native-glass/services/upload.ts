import 'react-native-get-random-values'
import Constants from 'expo-constants'
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
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 })
  if (res.canceled || !res.assets?.length) return null
  return res.assets[0]
}

export async function uploadDefectImage(params: { asset: ImagePicker.ImagePickerAsset; defect_type?: string; device_id?: string; time_text?: string }): Promise<UploadResult> {
  const { asset, defect_type = 'Defect', device_id = 'mobile', time_text } = params
  if (!EDGE_UPLOAD_URL) return { ok: false, error: 'EDGE_UPLOAD_URL not configured' }
  if (!DEVICE_INGEST_TOKEN) return { ok: false, error: 'DEVICE_INGEST_TOKEN not configured' }

  try {
    const response = await fetch(asset.uri)
    const blob = await response.blob()
    const form = new FormData()
    form.append('file', blob as any)
    form.append('defect_type', defect_type)
    form.append('device_id', device_id)
    if (time_text) form.append('time_text', time_text)
    const res = await fetch(EDGE_UPLOAD_URL, {
      method: 'POST',
      headers: { 'x-device-token': DEVICE_INGEST_TOKEN },
      body: form,
    })
    const json = await res.json()
    return json
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) }
  }
}
