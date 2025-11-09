import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Image, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { supabase, signOutUser } from '../services/supabase';
import { connectDashboardSocket, disconnectSocket, getSocket } from '../services/socket';
import { pickImage, uploadDefectImage } from '../services/upload';

type Defect = { time: string; type: string; imageUrl?: string }

const extra = (Constants.expoConfig?.extra || {}) as Record<string,string>
const ENABLE_SUPABASE_REALTIME = String(extra.ENABLE_SUPABASE_REALTIME || 'true') === 'true'

export default function DashboardScreen() {
  const router = useRouter()
  const [defects, setDefects] = useState<Defect[]>([])
  const [isDetecting, setIsDetecting] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [frameSrc, setFrameSrc] = useState<string | null>(null)
  const sessionStartRef = useRef<Date | null>(null)
  const channelRef = useRef<any>(null)
  const [uploading, setUploading] = useState(false)

  // Guard route
  useEffect(() => {
    (async () => {
      const loggedIn = await AsyncStorage.getItem('loggedIn')
      const role = (await AsyncStorage.getItem('role')) || 'employee'
      if (loggedIn !== 'true') {
        router.replace('/login')
        return
      }
      // Admin screen not yet implemented on mobile; redirect admins to dashboard for now
      if (role === 'admin') {
        Alert.alert('Admin role detected', 'Admin view not yet available on mobile; showing Dashboard.')
      }
    })()
  }, [router])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try { disconnectSocket() } catch {}
      try {
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current)
          channelRef.current = null
        }
      } catch {}
    }
  }, [])

  const startDetection = async () => {
    setIsDetecting(true)
    setIsPaused(false)
    setDefects([])
    sessionStartRef.current = new Date()

    try {
      const sock = connectDashboardSocket()
      sock.on('connect', () => console.log('Connected to backend'))
      sock.on('stream:frame', (payload: any) => {
        if (isPaused) return
        if (payload?.dataUrl) setFrameSrc(payload.dataUrl)
        if (!ENABLE_SUPABASE_REALTIME) {
          if (Array.isArray(payload?.defects) && payload.defects.length) {
            const timeStr = new Date(payload.time || Date.now()).toLocaleTimeString()
            const toAdd = payload.defects.map((d: any) => ({ time: `[${timeStr}]`, type: d?.type || 'Defect', imageUrl: payload.dataUrl }))
            setDefects((prev) => {
              const next = [...prev, ...toAdd]
              return next.length > 200 ? next.slice(-200) : next
            })
          }
        }
      })
      sock.emit('dashboard:start', {})
    } catch (e: any) {
      Alert.alert('Camera error', e?.message || 'Unable to connect to backend stream')
      stopDetection()
    }

    // Supabase realtime fetch+subscribe
    if (ENABLE_SUPABASE_REALTIME && sessionStartRef.current) {
      const sinceIso = sessionStartRef.current.toISOString()
      try {
        const { data, error } = await supabase
          .from('defects')
          .select('*')
          .gte('created_at', sinceIso)
          .order('created_at', { ascending: true })
          .limit(200)
        if (!error && data) {
          const mapped = data.map((row: any) => ({
            time: String(row.time_text || `[${new Date(row.created_at).toLocaleTimeString()}]`),
            type: row.defect_type || 'Defect',
            imageUrl: row.image_url || ''
          }))
          setDefects(mapped)
        }
        channelRef.current = supabase
          .channel('defects-stream')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'defects' }, (payload: any) => {
            const row = payload.new || {}
            const created = new Date(row.created_at || Date.now())
            if (sessionStartRef.current && created >= sessionStartRef.current) {
              setDefects((prev) => {
                const next = [...prev, { time: String(row.time_text || `[${created.toLocaleTimeString()}]`), type: row.defect_type || 'Defect', imageUrl: row.image_url || '' }]
                return next.length > 400 ? next.slice(-400) : next
              })
            }
          })
        await channelRef.current.subscribe()
      } catch (e) {
        console.warn('Supabase realtime failed or disabled', e)
      }
    }
  }

  const stopDetection = () => {
    setIsDetecting(false)
    setIsPaused(false)
    setFrameSrc(null)
    try { getSocket()?.emit?.('dashboard:stop', {}) } catch {}
    try { disconnectSocket() } catch {}
    try {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    } catch {}
  }

  const toggleDetection = () => {
    isDetecting ? stopDetection() : startDetection()
  }

  const togglePause = () => {
    setIsPaused((prev) => {
      const next = !prev
      try {
        const sock = getSocket()
        if (sock) sock.emit(next ? 'dashboard:pause' : 'dashboard:resume', {})
      } catch {}
      return next
    })
  }

  const clearDefects = () => {
    stopDetection()
    setDefects([])
  }

  const logout = async () => {
    try { await signOutUser() } catch {}
    await AsyncStorage.multiRemove(['loggedIn','role','userId'])
    const remembered = (await AsyncStorage.getItem('rememberMe')) === 'true'
    if (!remembered) await AsyncStorage.removeItem('email')
    router.replace('/login')
  }

  async function handleImageUpload() {
    const asset = await pickImage()
    if (!asset) return
    setUploading(true)
    try {
      const timeLabel = `[${new Date().toLocaleTimeString()}]`
      const result = await uploadDefectImage({ asset, defect_type: 'Manual', device_id: 'mobile', time_text: timeLabel })
      if (!result.ok) {
        Alert.alert('Upload failed', result.error || 'Unknown error')
        return
      }
      const defect: any = (result as any).defect
      setDefects((prev) => [...prev, { time: defect?.time_text || timeLabel, type: defect?.defect_type || 'Manual', imageUrl: defect?.image_url }])
      Alert.alert('Uploaded', 'Image uploaded and defect row inserted')
    } finally {
      setUploading(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.controlsRow}>
          {isDetecting && (
            <TouchableOpacity style={[styles.secondaryBtn, styles.smallBtn]} onPress={togglePause}>
              <Text style={styles.secondaryText}>{isPaused ? 'Resume' : 'Pause'}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.detectButton, styles.smallBtn]} onPress={toggleDetection}>
            <Text style={styles.detectText}>{isDetecting ? 'Stop Detection' : 'Start Detection'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.monitorContainer}>
        <View style={styles.monitorBorder}>
          {isDetecting ? (
            <View style={styles.liveContainer}>
              <Text style={styles.liveLabel}>LIVE</Text>
              {frameSrc ? (
                <Image source={{ uri: frameSrc }} style={styles.liveImage} />
              ) : (
                <View style={styles.placeholder}><Text style={styles.placeholderSubtitle}>Waiting for stream…</Text></View>
              )}
            </View>
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderTitle}>Camera Ready</Text>
              <Text style={styles.placeholderSubtitle}>Click "Start Detection" to begin live view</Text>
            </View>
          )}
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
        <Text style={styles.sectionTitle}>Detected Defects</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={handleImageUpload} disabled={uploading}>
          {uploading ? <ActivityIndicator color="#e5e7eb" /> : <Text style={styles.secondaryText}>Upload Image</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.clearBtn, defects.length===0 && styles.clearBtnDisabled]} onPress={clearDefects} disabled={defects.length===0}>
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.defectsList}>
        {defects.length === 0 ? (
          <Text style={styles.emptyText}>No detections yet.</Text>
        ) : (
          defects.map((d, i) => (
            <View key={i} style={styles.defectItem}>
              <Text style={styles.defectText}>{d.time} Glass Defect: {d.type}</Text>
            </View>
          ))
        )}
      </ScrollView>

      <View style={{ alignItems: 'center', marginTop: 12 }}>
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f0', padding: 20 },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  controlsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  detectButton: { backgroundColor: '#e5a445', padding: 12, borderRadius: 6 },
  detectText: { color: '#fff', fontWeight: '600' },
  smallBtn: { paddingVertical: 8, paddingHorizontal: 10 },

  monitorContainer: { marginBottom: 20 },
  monitorBorder: { 
    borderWidth: 3, 
    borderColor: '#e5a445', 
    borderRadius: 8, 
    backgroundColor: '#fafafa', 
    height: 220, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  placeholder: { alignItems: 'center' },
  placeholderTitle: { color: '#1a3a52', fontSize: 18, fontWeight: '600' },
  placeholderSubtitle: { color: '#6b7280', fontSize: 13, marginTop: 6 },

  liveContainer: { alignItems: 'center' },
  liveLabel: { 
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#dc2626',
    color: 'white',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 50,
    fontWeight: '700',
    fontSize: 12,
    zIndex: 2
  },
  liveImage: { width: '100%', height: 210, borderRadius: 6, resizeMode: 'contain', backgroundColor: '#000' },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1a3a52', marginBottom: 8 },
  defectsList: { flex: 1, backgroundColor: '#fff', borderRadius: 8, padding: 16 },
  defectItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#ddd' },
  defectText: { fontSize: 16, color: '#1a3a52' },
  emptyText: { textAlign: 'center', color: '#888', marginTop: 40 },
  logoutButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 6, borderWidth: 1, borderColor: '#dc2626' },
  logoutText: { color: '#dc2626', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { backgroundColor: '#133045', padding: 10, borderRadius: 6 },
  secondaryText: { color: '#e5e7eb', fontWeight: '600' },
  clearBtn: { backgroundColor: '#dc2626', padding: 10, borderRadius: 6 },
  clearBtnDisabled: { opacity: 0.4 },
  clearText: { color: '#fff', fontWeight: '700' }
});


