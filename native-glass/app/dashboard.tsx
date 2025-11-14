import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator, Image, Linking } from 'react-native';
import Svg, { Polygon } from 'react-native-svg'
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { signOutUser } from '../services/supabase'
import { pickImage } from '../services/upload';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { detectFromBase64, type DetectedBox } from '../services/ml';

type Defect = { time: string; type: string; imageUrl?: string }

const extra = (Constants.expoConfig?.extra || {}) as Record<string,string>
const CLOUD_INFERENCE_URL = extra.CLOUD_INFERENCE_URL

export default function DashboardScreen() {
  const router = useRouter()
  const [defects, setDefects] = useState<Defect[]>([])
  const [isDetecting, setIsDetecting] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [boxes, setBoxes] = useState<DetectedBox[]>([])
  const [sourceMode, setSourceMode] = useState<'camera'|'image'>('camera')
  const [uploadedBase64, setUploadedBase64] = useState<string | null>(null)
  const [viewSize, setViewSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 })
  const [cameraReady, setCameraReady] = useState(false)
  const sessionStartRef = useRef<Date | null>(null)
  const [uploading, setUploading] = useState(false)
  const cameraRef = useRef<CameraView | null>(null)
  const [permission, requestPermission] = useCameraPermissions()
  const isMountedRef = useRef(true)
  const isLoopRunningRef = useRef(false)
  const lastAppendRef = useRef<number>(0)

  // Request camera permission and surface actionable guidance if blocked
  const ensurePermissionOnDemand = useCallback(async () => {
    const res = await requestPermission()
    if (!res.granted) {
      const goToSettings = () => {
        try { Linking.openSettings() } catch {}
      }
      Alert.alert(
        'Permission required',
        res.canAskAgain
          ? 'Camera access is needed to start detection.'
          : 'Camera access is blocked. Please enable it in system settings to use detection.',
        [
          ...(res.canAskAgain ? [] : [{ text: 'Open Settings', onPress: goToSettings as any }]),
          { text: 'OK' }
        ]
      )
    }
    return res.granted
  }, [requestPermission])

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
      isMountedRef.current = false
      // no-op: database connections removed
    }
  }, [])

  const startDetection = async () => {
    setIsDetecting(true)
    setIsPaused(false)
    setDefects([])
  setBoxes([])
  setSourceMode('camera')
  setUploadedBase64(null)
    setCameraReady(false)
    sessionStartRef.current = new Date()

    try {
      // Always check/request camera permission at the moment detection starts
      const res = await requestPermission()
      if (!res.granted) {
        const goToSettings = () => {
          try { Linking.openSettings() } catch {}
        }
        Alert.alert(
          'Permission required',
          res.canAskAgain
            ? 'Camera access is needed to start detection.'
            : 'Camera access is blocked. Please enable it in system settings to use detection.',
          [
            ...(res.canAskAgain ? [] : [{ text: 'Open Settings', onPress: goToSettings as any }]),
            { text: 'OK' }
          ]
        )
        stopDetection()
        return
      }
      // Kick off capture loop
      if (!isLoopRunningRef.current) {
        isLoopRunningRef.current = true
        runCaptureLoop()
      }
    } catch (e: any) {
      Alert.alert('Camera error', e?.message || 'Unable to start camera')
      stopDetection()
    }

    // Database connections removed — only local list updates are used now
  }

  const stopDetection = () => {
    setIsDetecting(false)
    setIsPaused(false)
  setBoxes([])
  setSourceMode('camera')
  setUploadedBase64(null)
    setCameraReady(false)
    isLoopRunningRef.current = false
    // no-op: database connections removed
  }

  const toggleDetection = () => {
    if (isDetecting) {
      stopDetection()
    } else {
      startDetection()
    }
  }

  const togglePause = () => {
    setIsPaused((prev) => !prev)
  }

  const clearDefects = () => {
    stopDetection()
    setDefects([])
  }

  const logout = async () => {
    // Use Supabase auth for logout to clear server-side session as well
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
      // Show on detection screen and run model first
      if (asset.base64) {
        setSourceMode('image')
        setUploadedBase64(asset.base64)
        try {
          const detect = await detectFromBase64(asset.base64)
          setBoxes(detect.boxes || [])
          if (detect.boxes && detect.boxes.length) {
            // Append each detected box as a separate entry with timestamp
            setDefects((prev) => {
              const additions = detect.boxes.map((b) => ({ time: timeLabel, type: b.label || 'Defect' }))
              const next = [...prev, ...additions]
              return next.length > 400 ? next.slice(-400) : next
            })
          } else {
            // No detections: optionally log a placeholder entry
            setDefects((prev) => {
              const next = [...prev, { time: timeLabel, type: 'No defect' }]
              return next.length > 400 ? next.slice(-400) : next
            })
          }
        } catch {}
      }
    } finally {
      setUploading(false)
    }
  }

  // Capture current frame into IMAGE mode (freeze frame) and pause live loop
  const backToFrame = useCallback(async () => {
    try {
      if (!cameraRef.current) return
      const picture = await cameraRef.current.takePictureAsync({ base64: true, skipProcessing: true, quality: 0.6 })
      if (!picture?.base64) return
      setIsPaused(true)
      setSourceMode('image')
      setUploadedBase64(picture.base64)
      try {
        const detect = await detectFromBase64(picture.base64)
        setBoxes(detect.boxes || [])
        if (detect.boxes && detect.boxes.length) {
          const timeStr = `[${new Date().toLocaleTimeString()}]`
          const type = detect.boxes[0].label || 'Defect'
          setDefects((prev) => {
            const next = [...prev, { time: timeStr, type }]
            return next.length > 400 ? next.slice(-400) : next
          })
        }
      } catch {}
    } catch {}
  }, [])

  const backToCamera = useCallback(() => {
    setSourceMode('camera')
    setUploadedBase64(null)
    setBoxes([])
    setIsPaused(false)
  }, [])

  const runCaptureLoop = useCallback(async () => {
    const intervalMs = CLOUD_INFERENCE_URL ? 1200 : 500
    // Capture a frame every ~500ms, run detection, and overlay boxes
    while (isMountedRef.current && isDetecting) {
      try {
        if (!isPaused && cameraReady && cameraRef.current) {
          const picture = await cameraRef.current.takePictureAsync({ base64: true, skipProcessing: true, quality: 0.4 })
          if (picture?.base64) {
            const result = await detectFromBase64(picture.base64)
            setBoxes(result.boxes || [])
            // If any boxes, append to local list
            if (result.boxes && result.boxes.length) {
              const now = Date.now()
              const cooldownMs = 2000
              if (now - lastAppendRef.current > cooldownMs) {
                lastAppendRef.current = now
                const timeStr = `[${new Date().toLocaleTimeString()}]`
                const type = result.boxes[0].label || 'Defect'
                setDefects((prev) => {
                  const next = [...prev, { time: timeStr, type }]
                  return next.length > 400 ? next.slice(-400) : next
                })
              }
            }
          }
        }
      } catch {
        // Swallow errors to keep loop going
      }
      // Sleep
      await new Promise((r) => setTimeout(r, intervalMs))
    }
    isLoopRunningRef.current = false
  }, [isDetecting, isPaused, cameraReady])

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
          {sourceMode === 'image' && uploadedBase64 ? (
            <View style={styles.liveContainer}>
              <Text style={styles.liveLabel}>IMAGE</Text>
              <View style={styles.cameraWrapper} onLayout={(e) => setViewSize(e.nativeEvent.layout)}>
                <Image source={{ uri: `data:image/jpeg;base64,${uploadedBase64}` }} style={styles.camera} resizeMode="contain" />
                {/* Masks overlay (SVG) */}
                {viewSize.width > 0 && viewSize.height > 0 && (
                  <Svg pointerEvents="none" style={StyleSheet.absoluteFillObject} width={viewSize.width} height={viewSize.height}>
                    {boxes.flatMap((b, idx) =>
                      (b.segments || []).map((seg, sidx) => (
                        <Polygon
                          key={`poly-${idx}-${sidx}`}
                          points={seg.map(p => `${p.x * viewSize.width},${p.y * viewSize.height}`).join(' ')}
                          fill="rgba(34,197,94,0.25)"
                          stroke="#22c55e"
                          strokeWidth={2}
                        />
                      ))
                    )}
                  </Svg>
                )}
                {/* Box overlays */}
                {boxes.map((b, idx) => (
                  <View key={`box-${idx}`} style={[styles.box, { left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.width * 100}%`, height: `${b.height * 100}%` }]}>
                    <Text style={styles.boxLabel}>{`${b.label || 'Defect'}${b.score ? ` ${(b.score * 100).toFixed(0)}%` : ''}`}</Text>
                  </View>
                ))}
                {/* Back to Camera - overlay same position as Back to Frame */}
                <View style={styles.overlayButtonWrap} pointerEvents="box-none">
                  <TouchableOpacity style={styles.overlayButton} onPress={backToCamera}>
                    <Text style={styles.overlayButtonText}>Back to Camera</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : isDetecting ? (
            <View style={styles.liveContainer}>
              {!isPaused && permission?.granted && cameraReady ? (
                <>
                  <Text style={styles.liveLabel}>LIVE</Text>
                  <View style={styles.cameraWrapper} onLayout={(e) => setViewSize(e.nativeEvent.layout)}>
                    <CameraView
                      ref={(r: CameraView | null) => { cameraRef.current = r }}
                      style={styles.camera}
                      facing="back"
                      onCameraReady={() => setCameraReady(true)}
                    />
                    {viewSize.width > 0 && viewSize.height > 0 && (
                      <Svg pointerEvents="none" style={StyleSheet.absoluteFillObject} width={viewSize.width} height={viewSize.height}>
                        {boxes.flatMap((b, idx) =>
                          (b.segments || []).map((seg, sidx) => (
                            <Polygon
                              key={`poly-live-${idx}-${sidx}`}
                              points={seg.map(p => `${p.x * viewSize.width},${p.y * viewSize.height}`).join(' ')}
                              fill="rgba(34,197,94,0.25)"
                              stroke="#22c55e"
                              strokeWidth={2}
                            />
                          ))
                        )}
                      </Svg>
                    )}
                    {/* Overlay boxes */}
                    {boxes.map((b, idx) => (
                      <View
                        key={`box-live-${idx}`}
                        style={[
                          styles.box,
                          {
                            left: `${b.x * 100}%`,
                            top: `${b.y * 100}%`,
                            width: `${b.width * 100}%`,
                            height: `${b.height * 100}%`,
                          },
                        ]}
                      >
                        <Text style={styles.boxLabel}>{`${b.label || 'Defect'}${b.score ? ` ${(b.score * 100).toFixed(0)}%` : ''}`}</Text>
                      </View>
                    ))}
                    {/* Back to Frame - overlay same position as Back to Camera */}
                    <View style={styles.overlayButtonWrap} pointerEvents="box-none">
                      <TouchableOpacity style={styles.overlayButton} onPress={backToFrame}>
                        <Text style={styles.overlayButtonText}>Back to Frame</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              ) : (
                <View style={styles.placeholder}>
                  {isPaused ? (
                    <>
                      <Text style={styles.placeholderTitle}>Paused</Text>
                      <Text style={styles.placeholderSubtitle}>Tap Resume to continue detection</Text>
                    </>
                  ) : !permission?.granted ? (
                    <>
                      <Text style={styles.placeholderTitle}>Waiting for permission</Text>
                      <Text style={styles.placeholderSubtitle}>Grant camera access to start</Text>
                      <TouchableOpacity style={[styles.secondaryBtn, { marginTop: 10 }]} onPress={ensurePermissionOnDemand}>
                        <Text style={styles.secondaryText}>Grant Permission</Text>
                      </TouchableOpacity>
                    </>
                  ) : !cameraReady ? (
                    <>
                      <Text style={styles.placeholderTitle}>Starting camera…</Text>
                      <Text style={styles.placeholderSubtitle}>Please wait</Text>
                    </>
                  ) : null}
                </View>
              )}
            </View>
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderTitle}>Camera Ready</Text>
              <Text style={styles.placeholderSubtitle}>Click Start Detection to begin live view</Text>
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

  liveContainer: { alignItems: 'center', width: '100%' },
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
  cameraWrapper: { width: '100%', height: 210, borderRadius: 6, overflow: 'hidden', backgroundColor: '#000' },
  camera: { width: '100%', height: '100%' },
  box: {
    position: 'absolute',
    borderColor: '#22c55e',
    borderWidth: 2,
    zIndex: 3,
  },
  boxLabel: {
    position: 'absolute',
    bottom: -18,
    left: 0,
    backgroundColor: 'rgba(34,197,94,0.85)',
    color: '#fff',
    fontSize: 10,
    paddingHorizontal: 4,
    borderTopRightRadius: 4,
  },

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
  clearText: { color: '#fff', fontWeight: '700' },
  // Overlay buttons (shared position for Back to Frame / Back to Camera)
  overlayButtonWrap: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 4,
  },
  overlayButton: {
    backgroundColor: 'rgba(19,48,69,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  overlayButtonText: {
    color: '#e5e7eb',
    fontWeight: '700',
  }
});



