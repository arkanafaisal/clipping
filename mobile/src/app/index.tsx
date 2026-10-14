import React, { useEffect, useState } from 'react';
import { StyleSheet, StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dashboard } from '../components/Dashboard';
import { FeedScreen } from '../components/FeedScreen';
import { ToastContainer, ToastManager } from '../components/Toast';
import { pingServer } from '../services/api';

interface ActiveWorkshop {
  videoId: string;
  count: number;
}

export default function HomeScreen() {
  const [activeWorkshop, setActiveWorkshop] = useState<ActiveWorkshop | null>(null);

  // Otomatis nyalakan engine Python lokal di background saat aplikasi dibuka
  useEffect(() => {
    // Periksa koneksi ke server Python Termux di port 3006
    setTimeout(async () => {
      try {
        const pingRes = await pingServer();
        if (pingRes.status === 'ok') {
          ToastManager.show({
            type: 'success',
            title: 'API Termux Terhubung',
            message: `Port 3006 aktif (${pingRes.message || 'Siap digunakan'})`,
            duration: 3000,
          });
        }
      } catch (e) {
        ToastManager.show({
          type: 'info',
          title: 'Termux Port 3006',
          message: 'Pastikan server Python di Termux sudah berjalan pada port 3006.',
          duration: 4000,
        });
      }
    }, 1000);
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
