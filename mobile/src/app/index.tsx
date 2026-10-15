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

  // Periksa koneksi backend Python pada startup
  useEffect(() => {
    const checkServerConnection = async () => {
      try {
        const pingRes = await pingServer();
        if (pingRes.status === 'ok') {
          ToastManager.show({
            type: 'success',
            title: 'Server Python Terhubung',
            message: `Port 3006 aktif (${pingRes.message || 'Siap digunakan'})`,
            duration: 3000,
          });
        }
      } catch (e: any) {
        ToastManager.show({
          type: 'error',
          title: 'Server Python Offline',
          message: 'Server Python belum aktif pada 127.0.0.1:3006. Pastikan Termux sudah berjalan.',
          duration: 5000,
        });
      }
    };

    const timer = setTimeout(checkServerConnection, 500);
    return () => clearTimeout(timer);
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
