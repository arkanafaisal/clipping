import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, AppState } from 'react-native';
import { checkStoragePermission, requestStoragePermission } from '../../modules/python-runner';

interface StoragePermissionModalProps {
  onPermissionGranted?: () => void;
}

export const StoragePermissionModal: React.FC<StoragePermissionModalProps> = ({ onPermissionGranted }) => {
  const [hasPermission, setHasPermission] = useState<boolean>(true);
  const [isChecking, setIsChecking] = useState<boolean>(false);

  const verifyPermission = () => {
    setIsChecking(true);
    try {
      const granted = checkStoragePermission();
      setHasPermission(granted);
      if (granted && onPermissionGranted) {
        onPermissionGranted();
      }
    } catch {
      setHasPermission(true);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    verifyPermission();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        verifyPermission();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  if (hasPermission) {
    return null;
  }

  return (
    <Modal visible={!hasPermission} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.icon}>📁</Text>
          <Text style={styles.title}>Izin Penyimpanan Diperlukan</Text>
          <Text style={styles.description}>
            Aplikasi Clipping memerlukan izin <Text style={styles.bold}>Akses Semua File (All Files Access)</Text> agar dapat mengeksekusi skrip dinamis dan menyimpan video klip langsung ke folder bersama HP Anda.
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              requestStoragePermission();
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Beri Izin Akses File</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={verifyPermission}
            activeOpacity={0.7}
            disabled={isChecking}
          >
            <Text style={styles.secondaryButtonText}>
              {isChecking ? 'Memeriksa...' : 'Periksa Ulang Izin'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1E1E24',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#33333F',
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#A0A0B0',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  bold: {
    color: '#60A5FA',
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  secondaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
});
