import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Folder, CheckCircle, AlertCircle, RefreshCw, Save } from 'lucide-react-native';
import {
  getStorageRootPath,
  setStorageRootPath,
  verifyAndInitializeStorage,
  DEFAULT_SHARED_ROOT,
  StorageVerificationResult,
} from '../services/storageConfig';
import { ToastManager } from './Toast';

export const StorageConfigSection: React.FC = () => {
  const [rootPath, setRootPath] = useState<string>(DEFAULT_SHARED_ROOT);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editValue, setEditValue] = useState<string>(DEFAULT_SHARED_ROOT);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<StorageVerificationResult | null>(null);

  useEffect(() => {
    const init = async () => {
      const current = await getStorageRootPath();
      setRootPath(current);
      setEditValue(current);
      // Jalankan verifikasi otomatis saat startup
      handleVerify(current, true);
    };
    init();
  }, []);

  const handleVerify = async (pathTarget?: string, silent: boolean = false) => {
    setIsVerifying(true);
    const target = pathTarget || rootPath;
    const result = await verifyAndInitializeStorage(target);
    setVerificationResult(result);
    setIsVerifying(false);

    if (!silent) {
      if (result.success) {
        ToastManager.show({
          type: 'success',
          title: 'Verifikasi Berhasil',
          message: 'Fisik hello.txt berhasil ditulis dan dibaca dari disk!',
          duration: 3000,
        });
      } else {
        ToastManager.show({
          type: 'error',
          title: 'Verifikasi Gagal',
          message: 'Akses shared storage ditolak oleh sistem. Klik ikon kode di kanan untuk melihat detail debug.',
          rawError: result.traceback || result.error || result.message,
          errorCode: 'STORAGE_VERIFICATION_FAILED',
          duration: 7000,
        });
      }
    }
  };

  const handleSave = async () => {
    const cleaned = editValue.trim() || DEFAULT_SHARED_ROOT;
    await setStorageRootPath(cleaned);
    setRootPath(cleaned);
    setIsEditing(false);
    await handleVerify(cleaned, false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <Folder size={18} color="#60A5FA" />
          <Text style={styles.title}>Penyimpanan Shared Storage</Text>
        </View>

        <TouchableOpacity
          style={styles.verifyIconButton}
          onPress={() => handleVerify(rootPath, false)}
          disabled={isVerifying}
          activeOpacity={0.7}
        >
          {isVerifying ? (
            <ActivityIndicator size="small" color="#60A5FA" />
          ) : (
            <RefreshCw size={15} color="#9CA3AF" />
          )}
        </TouchableOpacity>
      </View>

      {isEditing ? (
        <View style={styles.editRow}>
          <TextInput
            style={styles.input}
            value={editValue}
            onChangeText={setEditValue}
            placeholder="/storage/emulated/0/clipping"
            placeholderTextColor="#6B7280"
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.8}>
            <Save size={16} color="#FFFFFF" />
            <Text style={styles.saveButtonText}>Simpan</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.pathBox}
          onPress={() => setIsEditing(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.pathText} numberOfLines={1}>
            {rootPath}
          </Text>
          <Text style={styles.editHint}>Ubah</Text>
        </TouchableOpacity>
      )}

      {/* Status Badge */}
      <View style={styles.statusRow}>
        {verificationResult?.success ? (
          <View style={styles.successBadge}>
            <CheckCircle size={14} color="#10B981" />
            <Text style={styles.successBadgeText}>
              Read & Write Aktif (hello.txt fisik terverifikasi)
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.warningBadge}
            onPress={() => handleVerify(rootPath, false)}
            activeOpacity={0.7}
          >
            <AlertCircle size={14} color="#F59E0B" />
            <Text style={styles.warningBadgeText}>
              {verificationResult ? 'Izin Terbatas / Gagal Tulis' : 'Uji Akses Disk'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#16161D',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#262633',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E5E7EB',
  },
  verifyIconButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#1E1E28',
  },
  pathBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F0F14',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2A38',
  },
  pathText: {
    color: '#93C5FD',
    fontSize: 13,
    fontFamily: 'monospace',
    flex: 1,
  },
  editHint: {
    color: '#6B7280',
    fontSize: 12,
    marginLeft: 8,
  },
  editRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#0F0F14',
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#3B82F6',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  statusRow: {
    marginTop: 10,
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  successBadgeText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '500',
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  warningBadgeText: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '500',
  },
});
