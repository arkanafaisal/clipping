import React, { useState, useEffect } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
} from 'react-native';
import {
  Settings,
  Folder,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Save,
  Cookie,
  X,
  CloudDownload,
  Trash2,
} from 'lucide-react-native';
import {
  getStorageRootPath,
  setStorageRootPath,
  verifyAndInitializeStorage,
  DEFAULT_SHARED_ROOT,
  StorageVerificationResult,
} from '../services/storageConfig';
import {
  syncCookiesFromGoogleDrive,
  extractGoogleDriveFileId,
  isGoogleDriveFolderLink,
  getValidCookiesPath,
  deleteCookies,
} from '../services/api';
import { ToastManager } from './Toast';

export interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
}) => {
  // --- Section 1: Storage State ---
  const [rootPath, setRootPath] = useState<string>(DEFAULT_SHARED_ROOT);
  const [isEditingPath, setIsEditingPath] = useState<boolean>(false);
  const [editPathValue, setEditPathValue] = useState<string>(DEFAULT_SHARED_ROOT);
  const [isVerifyingStorage, setIsVerifyingStorage] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<StorageVerificationResult | null>(null);

  // --- Section 2: Cookies State ---
  const [driveLink, setDriveLink] = useState('');
  const [isSyncingCookies, setIsSyncingCookies] = useState(false);
  const [isDeletingCookies, setIsDeletingCookies] = useState(false);
  const [existingCookiesPath, setExistingCookiesPath] = useState<string | null>(null);
  const [cookiesError, setCookiesError] = useState<string | null>(null);

  const refreshCookiesStatus = async () => {
    try {
      const valid = await getValidCookiesPath();
      setExistingCookiesPath(valid || null);
    } catch {
      setExistingCookiesPath(null);
    }
  };

  useEffect(() => {
    if (visible) {
      const initStorage = async () => {
        const current = await getStorageRootPath();
        setRootPath(current);
        setEditPathValue(current);
        handleVerifyStorage(current, true);
        refreshCookiesStatus();
      };
      initStorage();
      setCookiesError(null);
    }
  }, [visible]);

  // Handler Verifikasi Storage
  const handleVerifyStorage = async (pathTarget?: string, silent: boolean = false) => {
    setIsVerifyingStorage(true);
    const target = pathTarget || rootPath;
    const result = await verifyAndInitializeStorage(target);
    setVerificationResult(result);
    setIsVerifyingStorage(false);

    if (!silent) {
      if (result.success) {
        ToastManager.show({
          type: 'success',
          title: 'Storage Siap Digunakan',
          duration: 2500,
        });
      } else {
        ToastManager.show({
          type: 'error',
          title: 'Izin Storage Terbatas',
          rawError: result.traceback || result.error || result.message,
          duration: 5000,
        });
      }
    }
  };

  const handleSaveStoragePath = async () => {
    const cleaned = editPathValue.trim() || DEFAULT_SHARED_ROOT;
    await setStorageRootPath(cleaned);
    setRootPath(cleaned);
    setIsEditingPath(false);
    await handleVerifyStorage(cleaned, false);
  };

  // Handler Sinkronisasi Cookies Google Drive
  const handleSyncCookies = async () => {
    setCookiesError(null);
    const trimmed = driveLink.trim();
    if (!trimmed) {
      setCookiesError('Tolong masukkan link file cookies.txt Google Drive Anda.');
      return;
    }

    if (isGoogleDriveFolderLink(trimmed)) {
      setCookiesError('Link yang Anda masukkan adalah folder. Harap salin link langsung dari file cookies.txt.');
      return;
    }

    const fileId = extractGoogleDriveFileId(trimmed);
    if (!fileId) {
      setCookiesError('Format link Google Drive tidak valid.');
      return;
    }

    setIsSyncingCookies(true);
    try {
      await syncCookiesFromGoogleDrive(trimmed);
      setIsSyncingCookies(false);
      setDriveLink('');
      await refreshCookiesStatus();
      ToastManager.show({
        type: 'success',
        title: 'Cookies Berhasil Diimpor',
        duration: 3000,
      });
    } catch (err: any) {
      setIsSyncingCookies(false);
      const msg = err.message || 'Gagal mengunduh cookies dari Google Drive.';
      setCookiesError(msg);
      ToastManager.show({
        type: 'error',
        title: 'Impor Cookies Gagal',
        rawError: err.rawError || msg,
        duration: 5000,
      });
    }
  };

  // Handler Hapus Cookies
  const handleDeleteCookies = () => {
    Alert.alert(
      'Hapus Cookies',
      'Yakin ingin menghapus file cookies aktif? Aplikasi akan kembali ke mode anonim.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            setIsDeletingCookies(true);
            try {
              await deleteCookies();
              setExistingCookiesPath(null);
              ToastManager.show({
                type: 'info',
                title: 'Cookies Berhasil Dihapus',
                duration: 2500,
              });
            } catch (err: any) {
              ToastManager.show({
                type: 'error',
                title: 'Gagal Menghapus Cookies',
                rawError: err.message || String(err),
                duration: 3500,
              });
            } finally {
              setIsDeletingCookies(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
        >
          <View style={styles.modalCard}>
            {/* Header */}
            <View style={styles.headerRow}>
              <View style={styles.titleRow}>
                <Settings size={20} color="#38bdf8" />
                <Text style={styles.title}>Pengaturan Aplikasi</Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color="rgba(255, 255, 255, 0.6)" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              bounces={true}
            >
                {/* 1. SECTION: SHARED STORAGE */}
                <View style={styles.sectionBlock}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleRow}>
                      <Folder size={16} color="#60a5fa" />
                      <Text style={styles.sectionTitle}>Shared Storage Output</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.iconActionBtn}
                      onPress={() => handleVerifyStorage(rootPath, false)}
                      disabled={isVerifyingStorage}
                      activeOpacity={0.7}
                    >
                      {isVerifyingStorage ? (
                        <ActivityIndicator size="small" color="#60a5fa" />
                      ) : (
                        <RefreshCw size={14} color="#9ca3af" />
                      )}
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.sectionDescription}>
                    Direktori penyimpanan klip dan full video di memori internal HP.
                  </Text>

                  {isEditingPath ? (
                    <View style={styles.editRow}>
                      <TextInput
                        style={styles.pathInput}
                        value={editPathValue}
                        onChangeText={setEditPathValue}
                        placeholder="/storage/emulated/0/clipping"
                        placeholderTextColor="rgba(255, 255, 255, 0.3)"
                        autoCapitalize="none"
                      />
                      <TouchableOpacity
                        style={styles.savePathBtn}
                        onPress={handleSaveStoragePath}
                        activeOpacity={0.8}
                      >
                        <Save size={14} color="#ffffff" />
                        <Text style={styles.savePathBtnText}>Simpan</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.pathDisplayBox}
                      onPress={() => setIsEditingPath(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.pathDisplayText} numberOfLines={1}>
                        {rootPath}
                      </Text>
                      <Text style={styles.editHintText}>Ubah</Text>
                    </TouchableOpacity>
                  )}

                  {/* Status Storage Badge */}
                  <View style={styles.storageBadgeRow}>
                    {verificationResult?.success ? (
                      <View style={styles.storageSuccessBadge}>
                        <CheckCircle size={13} color="#10b981" />
                        <Text style={styles.storageSuccessText}>Izin Read & Write Aktif</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.storageWarningBadge}
                        onPress={() => handleVerifyStorage(rootPath, false)}
                        activeOpacity={0.7}
                      >
                        <AlertCircle size={13} color="#f59e0b" />
                        <Text style={styles.storageWarningText}>
                          {verificationResult ? 'Izin Terbatas / Uji Ulang' : 'Uji Akses Disk'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* DIVIDER */}
                <View style={styles.divider} />

                {/* 2. SECTION: GOOGLE DRIVE COOKIES */}
                <View style={styles.sectionBlock}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleRow}>
                      <Cookie size={16} color="#f59e0b" />
                      <Text style={styles.sectionTitle}>Cookies YouTube (Google Drive)</Text>
                    </View>
                    {existingCookiesPath && (
                      <TouchableOpacity
                        style={styles.deleteCookieBtn}
                        onPress={handleDeleteCookies}
                        disabled={isDeletingCookies}
                        activeOpacity={0.7}
                      >
                        {isDeletingCookies ? (
                          <ActivityIndicator size="small" color="#ef4444" />
                        ) : (
                          <>
                            <Trash2 size={13} color="#ef4444" />
                            <Text style={styles.deleteCookieBtnText}>Hapus</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>

                  <Text style={styles.sectionDescription}>
                    Impor cookies.txt publik untuk mengatasi rate limit (Error 429) atau verifikasi bot YouTube.
                  </Text>

                  {/* Status Cookies Aktif */}
                  {existingCookiesPath ? (
                    <View style={styles.cookieStatusCard}>
                      <CheckCircle size={14} color="#34d399" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cookieStatusTitle}>Cookies Terpasang & Aktif</Text>
                        <Text style={styles.cookieStatusSub} numberOfLines={1}>
                          File siap digunakan untuk bypass restriksi YouTube
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  <TextInput
                    style={styles.cookieInput}
                    value={driveLink}
                    onChangeText={(val) => {
                      setDriveLink(val);
                      if (cookiesError) setCookiesError(null);
                    }}
                    placeholder="https://drive.google.com/file/d/.../view"
                    placeholderTextColor="rgba(255, 255, 255, 0.25)"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isSyncingCookies}
                  />

                  {cookiesError ? (
                    <Text style={styles.errorText}>{cookiesError}</Text>
                  ) : null}

                  {/* Tombol Simpan / Unduh Cookies */}
                  <TouchableOpacity
                    style={[styles.syncCookieBtn, isSyncingCookies && styles.syncCookieBtnDisabled]}
                    onPress={handleSyncCookies}
                    activeOpacity={0.8}
                    disabled={isSyncingCookies}
                  >
                    {isSyncingCookies ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <CloudDownload size={15} color="#ffffff" />
                        <Text style={styles.syncCookieBtnText}>
                          {existingCookiesPath ? 'Perbarui / Timpa Cookies' : 'Unduh & Simpan Cookies'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  keyboardContainer: {
    width: '100%',
    maxWidth: 440,
  },
  modalCard: {
    backgroundColor: '#18181b',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 18,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  scrollArea: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingVertical: 4,
    gap: 16,
    flexGrow: 1,
  },
  sectionBlock: {
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  sectionDescription: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 11,
    lineHeight: 15,
  },
  iconActionBtn: {
    padding: 4,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pathInput: {
    flex: 1,
    height: 38,
    backgroundColor: '#09090b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    color: '#ffffff',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
  },
  savePathBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563eb',
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  savePathBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  pathDisplayBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#09090b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  pathDisplayText: {
    flex: 1,
    color: 'rgba(255, 255, 255, 0.85)',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    marginRight: 8,
  },
  editHintText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
  },
  storageBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  storageSuccessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  storageSuccessText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '700',
  },
  storageWarningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  storageWarningText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  cookieInput: {
    height: 38,
    backgroundColor: '#09090b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    color: '#ffffff',
    fontSize: 12,
  },
  errorText: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '600',
  },
  syncCookieBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#d97706',
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 2,
  },
  syncCookieBtnDisabled: {
    backgroundColor: 'rgba(217, 119, 6, 0.5)',
  },
  syncCookieBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  cookieStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(52, 211, 153, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.25)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  cookieStatusTitle: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '700',
  },
  cookieStatusSub: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 10,
    marginTop: 1,
  },
  deleteCookieBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  deleteCookieBtnText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '700',
  },
});
