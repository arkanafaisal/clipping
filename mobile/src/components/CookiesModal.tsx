import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { syncCookiesFromGoogleDrive, extractGoogleDriveFileId } from '../services/api';
import { ToastManager } from './Toast';

interface CookiesModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (cookiesPath: string) => void;
}

export const CookiesModal: React.FC<CookiesModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [driveLink, setDriveLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    setErrorMessage(null);
    const trimmed = driveLink.trim();
    if (!trimmed) {
      setErrorMessage('Tolong masukkan link atau ID file Google Drive cookies Anda.');
      return;
    }

    const fileId = extractGoogleDriveFileId(trimmed);
    if (!fileId) {
      setErrorMessage('Format link Google Drive tidak valid atau ID file tidak terdeteksi.');
      return;
    }

    setIsSubmitting(true);
    try {
      const savedPath = await syncCookiesFromGoogleDrive(trimmed);
      setIsSubmitting(false);
      setDriveLink('');
      ToastManager.show({
        type: 'success',
        title: 'Cookies Berhasil Diimpor',
        message: 'File cookies.txt tersimpan dan siap digunakan untuk retry request.',
        duration: 4000,
      });
      onSuccess?.(savedPath);
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      const msg = err.message || 'Gagal mengunduh file cookies dari Google Drive.';
      setErrorMessage(msg);
      ToastManager.show({
        type: 'error',
        title: 'Gagal Mengimpor Cookies',
        message: msg,
        rawError: err.rawError,
        errorCode: err.code,
        duration: 5000,
      });
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setErrorMessage(null);
    setDriveLink('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalCard}>
          <Text style={styles.title}>Batas Permintaan YouTube</Text>
          <Text style={styles.subtitle}>
            Batas permintaan YouTube terlampaui (Error 429). Tolong kirimkan link file cookies Anda dari Google Drive (akses publik) untuk melanjutkan.
          </Text>

          <TextInput
            style={styles.input}
            value={driveLink}
            onChangeText={(text) => {
              setDriveLink(text);
              if (errorMessage) setErrorMessage(null);
            }}
            placeholder="https://drive.google.com/file/d/.../view?usp=sharing"
            placeholderTextColor="rgba(255, 255, 255, 0.25)"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isSubmitting}
          />

          {errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : null}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleClose}
              disabled={isSubmitting}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Batal</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.submitBtnText}>Unduh & Terapkan</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#171717',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    lineHeight: 18,
    marginBottom: 16,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    fontWeight: '600',
  },
  submitBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 130,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
