import React, { useEffect, useState } from 'react';
import { StyleSheet, StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dashboard } from '../components/Dashboard';
import { FeedScreen } from '../components/FeedScreen';
import { ToastContainer, ToastManager } from '../components/Toast';
import { StoragePermissionModal } from '../components/StoragePermissionModal';
import { pingServer } from '../services/api';

interface ActiveWorkshop {
  videoId: string;
  count: number;
  playMode?: 'local' | 'stream';
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
            duration: 2500,
          });
        }
      } catch (e: any) {
        ToastManager.show({
          type: 'error',
          title: 'Server Python Offline',
          rawError: e?.rawError || e?.message,
          errorCode: e?.code,
          duration: 4000,
        });
      }
    };

    const timer = setTimeout(checkServerConnection, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleOpenWorkshop = (videoId: string, count: number, playMode?: 'local' | 'stream') => {
    setActiveWorkshop({ videoId, count, playMode });
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
            playMode={activeWorkshop.playMode}
            onBack={handleBackToDashboard}
          />
        ) : (
          <Dashboard onOpenWorkshop={handleOpenWorkshop} />
        )}
      </View>
      {/* Toast Notification Container (Sonner-like) */}
      <ToastContainer />
      {/* Modal Izin Akses Penyimpanan File Penuh (MANAGE_EXTERNAL_STORAGE) */}
      <StoragePermissionModal />
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
