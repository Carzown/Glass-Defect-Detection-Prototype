import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, Switch, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUser, signInAndGetRole, signOutUser, supabase, config } from '../services/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [roleTab, setRoleTab] = useState('employee');
  const [loading, setLoading] = useState(false);
  const [connStatus, setConnStatus] = useState('checking');
  const [connMessage, setConnMessage] = useState('');
  const [defectCount, setDefectCount] = useState(null);
  const [pingMs, setPingMs] = useState(null);

  // Prefill remembered email
  useEffect(() => {
    (async () => {
      const rem = await AsyncStorage.getItem('rememberMe')
      const savedEmail = await AsyncStorage.getItem('email')
      if (rem === 'true') {
        setRemember(true)
        if (savedEmail) setEmail(savedEmail)
      }
    })()
  }, [])

  // Connectivity check to Supabase
  useEffect(() => {
    let cancelled = false
    async function check() {
      setConnStatus('checking')
      setConnMessage('')
      const urlOk = !!(config.SUPABASE_URL && /^https?:\/\//.test(config.SUPABASE_URL))
      if (!urlOk) {
        if (!cancelled) { setConnStatus('error'); setConnMessage('Invalid or missing SUPABASE_URL') }
        return
      }
      try {
        const t0 = performance.now?.() || Date.now()
        await supabase.auth.getUser()
        const { count, error } = await supabase
          .from('defects')
          .select('id', { count: 'exact', head: true })
        const t1 = performance.now?.() || Date.now()
        if (error) throw error
        if (!cancelled) {
          setConnStatus('ok');
          setDefectCount(typeof count === 'number' ? count : null)
          setPingMs(Math.round(t1 - t0))
          setConnMessage('Connected to Supabase')
        }
      } catch (e) {
        if (!cancelled) { setConnStatus('error'); setConnMessage(e?.message || 'Connection failed') }
      }
    }
    check()
    return () => { cancelled = true }
  }, [])

  // If already logged in and session marker present, redirect
  useEffect(() => {
    (async () => {
      const loggedIn = await AsyncStorage.getItem('loggedIn')
      if (loggedIn === 'true') {
        const role = (await AsyncStorage.getItem('role')) || 'employee'
        const target = role === 'admin' ? '/admin' : '/dashboard'
        router.replace(target)
      }
    })()
  }, [router])

  const handleLogin = async () => {
    if (!email || !password) return
    setLoading(true)
    try {
      const res = await signInAndGetRole(email, password)
      let actualRole = res.role || 'employee'
      // Optional: email override like web app
      if (res.email && res.email.toLowerCase() === 'qvcdclarito@tip.edu.ph') {
        actualRole = 'admin'
      }

      // Remember me
      if (remember) {
        await AsyncStorage.setItem('rememberMe', 'true')
        await AsyncStorage.setItem('email', email)
      } else {
        await AsyncStorage.removeItem('rememberMe')
        await AsyncStorage.removeItem('email')
      }

      await AsyncStorage.setItem('loggedIn', 'true')
      await AsyncStorage.setItem('role', actualRole)
      await AsyncStorage.setItem('userId', res.uid)

      if (roleTab === 'admin' && actualRole !== 'admin') {
        Alert.alert('Not authorized as Admin. Redirecting to Employee Dashboard.')
      }
      if (roleTab === 'employee' && actualRole === 'admin') {
        Alert.alert('Admins cannot use the Employee Dashboard. Redirecting to Admin.')
      }

      {
        const target = actualRole === 'admin' ? '/admin' : '/dashboard'
        router.replace(target)
      }
    } catch (e) {
      let msg = 'Login failed'
      const text = e?.message || ''
      if (text.includes('Invalid')) msg = 'Invalid email or password'
      else if (text.includes('Email not confirmed')) msg = 'Please confirm your email'
      else if (text.includes('Too many requests')) msg = 'Too many attempts. Try later.'
      Alert.alert('Error', msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      {/* Status ribbon */}
      <View style={[styles.statusBar, connStatus==='ok' ? styles.statusOk : (connStatus==='error' ? styles.statusError : styles.statusChecking)]}>
        <Text style={styles.statusText}>
          {connStatus === 'checking' ? 'Checking Supabase…' : connMessage}
          {connStatus==='ok' && (defectCount!==null || pingMs!==null) && '\n'}
          {connStatus==='ok' && defectCount!==null && `Defects: ${defectCount}`} {connStatus==='ok' && pingMs!==null && `(ping: ${pingMs}ms)`}
        </Text>
      </View>
      <View style={styles.card}>
        <Image source={require('../assets/AlumpreneurLogo.png')} style={styles.logo} />
        <Text style={styles.title}>Glass Defect Detector</Text>
        {/* Tabs */}
        <View style={styles.tabBar}>
          <TouchableOpacity style={[styles.tabItem, roleTab==='admin' && styles.tabItemActive]} onPress={() => setRoleTab('admin')}>
            <Text style={[styles.tabItemText, roleTab==='admin' && styles.tabItemTextActive]}>Admin</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabItem, roleTab==='employee' && styles.tabItemActive]} onPress={() => setRoleTab('employee')}>
            <Text style={[styles.tabItemText, roleTab==='employee' && styles.tabItemTextActive]}>Employee</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        </View>
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>
        <View style={styles.rememberRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Switch value={remember} onValueChange={setRemember} />
            <Text style={styles.rememberText}>Remember me</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.signInBtn} onPress={handleLogin} disabled={loading}>
          <Text style={styles.signInText}>{loading ? 'Signing In…' : 'Sign In'}</Text>
        </TouchableOpacity>
        <Text style={styles.footer}>Powered by Supabase Authentication</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f2e42', alignItems: 'center', justifyContent: 'center', padding: 16 },
  statusBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingVertical: 6, paddingHorizontal: 12 },
  statusText: { textAlign: 'center', fontSize: 12, fontWeight: '600' },
  statusOk: { backgroundColor: '#d1fae5' },
  statusError: { backgroundColor: '#fee2e2' },
  statusChecking: { backgroundColor: '#fef9c3' },
  card: { width: '90%', maxWidth: 400, backgroundColor: '#ffffff', borderRadius: 12, paddingVertical: 28, paddingHorizontal: 24, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 },
  logo: { width: 140, height: 140, alignSelf: 'center', marginBottom: 6, resizeMode: 'contain' },
  title: { color: '#0f2e42', fontSize: 24, fontWeight: '700', textAlign: 'center', marginVertical: 20 },
  tabBar: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 8, overflow: 'hidden', marginBottom: 20 },
  tabItem: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: 'transparent' },
  tabItemActive: { backgroundColor: '#0f2e42' },
  tabItemText: { fontWeight: '600', color: '#1e293b' },
  tabItemTextActive: { fontWeight: '700', color: '#ffffff' },
  fieldBlock: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#1e293b', marginBottom: 6 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6, fontSize: 14 },
  rememberRow: { marginBottom: 16, justifyContent: 'flex-start' },
  rememberText: { color: '#1e293b', fontSize: 13 },
  signInBtn: { backgroundColor: '#e5a445', paddingVertical: 14, borderRadius: 6, alignItems: 'center', marginTop: 4 },
  signInText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  footer: { textAlign: 'center', fontSize: 11, color: '#64748b', marginTop: 18 },
});
