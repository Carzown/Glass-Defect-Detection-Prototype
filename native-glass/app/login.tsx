import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    if (username && password) {
      router.replace('/dashboard'); // ✅ updated path
    }
  };

  return (
    <View style={styles.container}>
      <Image source={require('../assets/AlumpreneurLogo.png')} style={styles.logo} />
      <Text style={styles.title}>Glass Defect Detector</Text>

      <TextInput
        style={styles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Sign In</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a3a52', alignItems: 'center', justifyContent: 'center' },
  logo: { width: 150, height: 150, marginBottom: 20, resizeMode: 'contain' },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 40 },
  input: { width: '80%', backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 16 },
  button: { backgroundColor: '#e5a445', padding: 14, borderRadius: 8, width: '80%', alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
