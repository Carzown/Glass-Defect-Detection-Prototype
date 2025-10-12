import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  StyleSheet, 
  Image 
} from 'react-native';
import { useRouter } from 'expo-router';

interface Defect {
  time: string;
  type: string;
}

const defectTypes = ['Crack', 'Bubble', 'Scratch', 'Chip', 'Discoloration'];

export default function DashboardScreen() {
  const router = useRouter();
  const [defects, setDefects] = useState<Defect[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isLive, setIsLive] = useState(false);

  const addDefect = () => {
    const time = new Date().toLocaleTimeString();
    const type = defectTypes[Math.floor(Math.random() * defectTypes.length)];
    setDefects(prev => [{ time, type }, ...prev]);
  };

  const toggleDetection = () => {
    setIsDetecting(!isDetecting);
    setIsLive(!isLive);
  };

  // Optional fake defect generation every 5s when detecting
  useEffect(() => {
  let interval: ReturnType<typeof setInterval>;
  if (isDetecting) {
    interval = setInterval(addDefect, 5000);
  }
  return () => clearInterval(interval);
  }, [isDetecting]);


  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Glass Defect Detector</Text>
        <TouchableOpacity style={styles.detectButton} onPress={toggleDetection}>
          <Text style={styles.detectText}>
            {isDetecting ? 'Stop Detection' : 'Start Detection'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Monitor (Fake Camera View) */}
      <View style={styles.monitorContainer}>
        <View style={styles.monitorBorder}>
          {isLive ? (
            <View style={styles.liveContainer}>
              <Text style={styles.liveLabel}>LIVE</Text>
              <Image 
                source={{ uri: 'https://placehold.co/400x250?text=Camera+Feed' }}
                style={styles.liveImage}
              />
            </View>
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderTitle}>Camera Ready</Text>
              <Text style={styles.placeholderSubtitle}>
                Click "Start Detection" to begin live view
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Defects List */}
      <Text style={styles.sectionTitle}>Detected Defects</Text>
      <ScrollView style={styles.defectsList}>
        {defects.length === 0 ? (
          <Text style={styles.emptyText}>No defects detected yet.</Text>
        ) : (
          defects.map((defect, index) => (
            <View key={index} style={styles.defectItem}>
              <Text style={styles.defectText}>
                [{defect.time}] Glass Defect: {defect.type}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={() => router.replace('/login')}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f0', padding: 20 },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  title: { fontSize: 22, fontWeight: '700', color: '#1a3a52' },
  detectButton: { backgroundColor: '#e5a445', padding: 12, borderRadius: 6 },
  detectText: { color: '#fff', fontWeight: '600' },

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
  liveImage: { width: '100%', height: 210, borderRadius: 6 },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1a3a52', marginBottom: 8 },
  defectsList: { flex: 1, backgroundColor: '#fff', borderRadius: 8, padding: 16 },
  defectItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#ddd' },
  defectText: { fontSize: 16, color: '#1a3a52' },
  emptyText: { textAlign: 'center', color: '#888', marginTop: 40 },
  logoutButton: { marginTop: 16, alignItems: 'center' },
  logoutText: { color: '#dc2626', fontSize: 16, fontWeight: '700' },
});
