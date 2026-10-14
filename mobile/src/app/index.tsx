import React, { useEffect } from 'react';
import { StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dashboard } from '../components/Dashboard';
import { startPythonServer } from '../../modules/python-runner';

export default function HomeScreen() {
  // Otomatis nyalakan engine Python lokal di background saat aplikasi dibuka
  useEffect(() => {
    try {
      const res = startPythonServer();
      console.log('[Native] Python Engine auto-start result:', res);
    } catch (e) {
      console.log('[Native] Python engine initialization:', e);
    }
  }, []);

  const handleOpenWorkshop = (videoId: string, count: number) => {
    Alert.alert(
      'Buka Workshop',
      `Membuka Workshop untuk video: ${videoId}\nJumlah klip: ${count}\n(Halaman Feed Player akan dibuat di tahap berikutnya)`
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Dashboard onOpenWorkshop={handleOpenWorkshop} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
});
