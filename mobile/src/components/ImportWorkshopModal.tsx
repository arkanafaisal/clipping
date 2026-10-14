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
} from 'react-native';

interface ImportWorkshopModalProps {
  visible: boolean;
  onClose: () => void;
  onImport: (jsonText: string) => void;
}

export const ImportWorkshopModal: React.FC<ImportWorkshopModalProps> = ({
  visible,
  onClose,
  onImport,
}) => {
  const [importText, setImportText] = useState('');

  const handleSave = () => {
    onImport(importText.trim());
    setImportText('');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalCard}>
          <Text style={styles.title}>Import Workshop</Text>
          <Text style={styles.subtitle}>
            Paste data JSON workshop yang telah Anda salin di sini.
          </Text>

          <TextInput
            style={styles.textarea}
            value={importText}
            onChangeText={setImportText}
            placeholder='{"workshop": {...}, "draft": "[...]"}'
            placeholderTextColor="rgba(255, 255, 255, 0.2)"
            multiline
            textAlignVertical="top"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Batal</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
              <Text style={styles.saveBtnText}>Simpan & Muat</Text>
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
    padding: 20,
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
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.55)',
    marginBottom: 14,
    lineHeight: 18,
  },
  textarea: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 12,
    color: '#ffffff',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    height: 140,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancelBtnText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
