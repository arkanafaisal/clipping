import React, { useEffect, useState } from 'react';
import { StyleSheet, StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dashboard } from '../components/Dashboard';
import { FeedScreen } from '../components/FeedScreen';
import { ToastContainer, ToastManager } from '../components/Toast';
import { startPythonServer, getPythonLastError } from '../../modules/python-runner';
import { pingServer } from '../services/api';

interface ActiveWorkshop {
  videoId: string;
  count: number;
}

export default function HomeScreen() {
  const [activeWorkshop, setActiveWorkshop] = useState<ActiveWorkshop | null>(null);

  // Otomatis nyalakan engine Python lokal di background saat aplikasi dibuka
  useEffect(() => {
    try {
      const res = startPythonServer();
      console.log('[Native] Python Engine auto-start result:', res);
      
      // Berikan notifikasi awal status server kepada user
      setTimeout(async () => {
        try {
          const pingRes = await pingServer();
          if (pingRes.status === 'ok') {
            ToastManager.show({
              type: 'success',
              title: 'Server Python Aktif',
              message: `Port 8080 aktif (Uptime: ${pingRes.uptime_seconds || 0}s)`,
              duration: 3000,
            });
          }
        } catch (e) {
          const lastErr = getPythonLastError();
          if (lastErr) {
            console.error('[Native] Python Server Error on Launch:', lastErr);
            ToastManager.show({
              type: 'error',
              title: 'Python Server Error',
              message: lastErr,
              duration: 6000,
            });
          } else {
            ToastManager.show({
              type: 'info',
              title: 'Server Background',
              message: 'Engine Python sedang memuat di background HP...',
              duration: 3500,
            });
          }
        }
      }, 1500);
    } catch (e: any) {
      console.log('[Native] Python engine initialization error:', e);
      ToastManager.show({
        type: 'error',
        title: 'Python Engine Error',
        message: e.message || 'Gagal memulai server lokal',
      });
    }
  }, []);

  const handleOpenWorkshop = (videoId: string, count: number) => {
    setActiveWorkshop({ videoId, count });
  };

  const handleBackToDashboard = () => {
    setActiveWorkshop(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      <View style={styles.mainContent}>
        {activeWorkshop ? (
          <FeedScreen
            videoId={activeWorkshop.videoId}
            initialCount={activeWorkshop.count}
            onBack={handleBackToDashboard}
          />
        ) : (
          <Dashboard onOpenWorkshop={handleOpenWorkshop} />
        )}
      </View>
      {/* Toast Notification Container (Sonner-like) */}
      <ToastContainer />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  mainContent: {
    flex: 1,
  },
});
