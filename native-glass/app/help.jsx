import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { useRouter } from 'expo-router'

export default function HelpScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend() {
    if (!email || !message) return
    setSending(true)
    try {
      await new Promise((res) => setTimeout(res, 700))
      Alert.alert('Sent', 'Your message has been sent to the admin.')
      setSubject('')
      setMessage('')
    } finally {
      setSending(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Help Center</Text>
      <Text style={styles.subtitle}>Ask the admin a question</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Your Email</Text>
        <TextInput style={styles.input} placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <Text style={styles.label}>Subject</Text>
        <TextInput style={styles.input} placeholder="Brief summary" value={subject} onChangeText={setSubject} />
        <Text style={styles.label}>Message</Text>
        <TextInput style={[styles.input, { height: 120 }]} multiline placeholder="Describe your question or issue..." value={message} onChangeText={setMessage} />

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity style={[styles.button, { backgroundColor: '#e5a445' }]} onPress={handleSend} disabled={sending || !email || !message}>
            <Text style={styles.buttonText}>{sending ? 'Sending…' : 'Send to Admin'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, { backgroundColor: '#133045' }]} onPress={() => router.replace('/dashboard')}>
            <Text style={styles.buttonText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f0', padding: 20 },
  title: { fontSize: 22, fontWeight: '700', color: '#1a3a52' },
  subtitle: { color: '#6b7280', marginBottom: 16 },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: 16, gap: 8 },
  label: { color: '#1a3a52', fontWeight: '600' },
  input: { backgroundColor: '#f9fafb', borderColor: '#e5e7eb', borderWidth: 1, borderRadius: 6, padding: 10 },
  button: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 6 },
  buttonText: { color: '#fff', fontWeight: '700' },
})
