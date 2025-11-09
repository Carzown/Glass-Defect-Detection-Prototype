import React, { useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { signOutUser } from '../services/supabase'

export default function AdminScreen() {
  const router = useRouter()

  useEffect(() => {
    (async () => {
      const role = (await AsyncStorage.getItem('role')) || 'employee'
      if (role !== 'admin') {
        router.replace('/dashboard')
      }
    })()
  }, [router])

  const logout = async () => {
    try { await signOutUser() } catch {}
    await AsyncStorage.multiRemove(['loggedIn','role','userId'])
    router.replace('/login')
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Alternate Dashboard</Text>
      <Text style={styles.subtitle}>Admin</Text>

      <View style={styles.placeholder}>
        <Text style={styles.sectionTitle}>Admin Page Placeholder</Text>
        <Text style={styles.subtext}>Use this page for admin layout or metrics.</Text>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f0', padding: 20 },
  title: { fontSize: 22, fontWeight: '700', color: '#1a3a52' },
  subtitle: { color: '#6b7280', marginBottom: 20 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#e5a445', borderStyle: 'dashed', borderRadius: 8, backgroundColor: '#fff7ed' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1a3a52', marginBottom: 8 },
  subtext: { color: '#6b7280' },
  logoutButton: { marginTop: 16, alignItems: 'center' },
  logoutText: { color: '#dc2626', fontSize: 16, fontWeight: '700' },
})
