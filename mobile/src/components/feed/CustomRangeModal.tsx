import React, { useState, useEffect } from 'react';
import {
  Modal,
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { PlusCircle, Clock, X } from 'lucide-react-native';
import { formatTime, parseTimeToSeconds } from './timeUtils';

export interface CustomRangeModalProps {
  visible: boolean;
  currentPlaybackTime: number;
  onClose: () => void;
  onAddCustomRange: (start: number, end: number) => void;
}

export const CustomRangeModal: React.FC<CustomRangeModalProps> = ({
  visible,
  currentPlaybackTime,
  onClose,
  onAddCustomRange,
}) => {
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Saat modal terbuka, inisialisasi default dari waktu pemutaran saat ini
  useEffect(() => {
    if (visible) {
      const cur = Math.max(0, Math.floor(currentPlaybackTime));
      const sFormatted = formatTime(cur);
      const eFormatted = formatTime(cur + 5);
      setStartInput(sFormatted);
      setEndInput(eFormatted);
      setErrorMessage('');
    }
  }, [visible, currentPlaybackTime]);

  const handleUseCurrentTime = () => {
    const cur = Math.max(0, Math.floor(currentPlaybackTime));
    setStartInput(formatTime(cur));
    setEndInput(formatTime(cur + 5));
    setErrorMessage('');
  };

  const handleQuickDuration = (extraSec: number) => {
    const s = parseTimeToSeconds(startInput);
    setEndInput(formatTime(s + extraSec));
    setErrorMessage('');
  };

  const handleSubmit = () => {
    const s = parseTimeToSeconds(startInput);
    const e = parseTimeToSeconds(endInput);

    if (e <= s) {
      setErrorMessage('Waktu selesai harus lebih besar dari waktu mulai.');
      return;
    }

    onAddCustomRange(s, e);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardContainer}
          >
            <View style={styles.modalContent}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <View style={styles.titleRow}>
                  <PlusCircle size={20} color="#8b5cf6" />
                  <Text style={styles.modalTitle}>Tambah Rentang Custom</Text>
                </View>
                <Pressable
                  style={styles.closeBtn}
                  onPress={onClose}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={18} color="rgba(255, 255, 255, 0.6)" />
                </Pressable>
              </View>

              <Text style={styles.modalSubtitle}>
                Buat rentang klip khusus di luar rekomendasi heatmap YouTube.
              </Text>

              {/* Gunakan Waktu Saat Ini Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.useCurrentBtn,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={handleUseCurrentTime}
              >
                <Clock size={14} color="#a78bfa" />
                <Text style={styles.useCurrentText}>
                  Ambil Posisi Playback Sekarang ({formatTime(currentPlaybackTime)})
                </Text>
              </Pressable>

              {/* Input Row */}
              <View style={styles.inputRow}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>MULAI (START)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={startInput}
                    onChangeText={(val) => {
                      setStartInput(val);
                      setErrorMessage('');
                    }}
                    placeholder="00:00"
                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
                    keyboardType="numbers-and-punctuation"
                    autoCapitalize="none"
                  />
                </View>

                <Text style={styles.inputSeparator}>—</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>SELESAI (END)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={endInput}
                    onChangeText={(val) => {
                      setEndInput(val);
                      setErrorMessage('');
                    }}
                    placeholder="00:05"
                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
                    keyboardType="numbers-and-punctuation"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {/* Quick Durations */}
              <View style={styles.durationPresetsRow}>
                <Text style={styles.durationLabel}>Durasi Cepat:</Text>
                {[5, 10, 15, 30].map((dur) => (
                  <Pressable
                    key={dur}
                    style={({ pressed }) => [
                      styles.presetChip,
                      pressed && { opacity: 0.6 },
                    ]}
                    onPress={() => handleQuickDuration(dur)}
                  >
                    <Text style={styles.presetChipText}>+{dur}s</Text>
                  </Pressable>
                ))}
              </View>

              {/* Error Message */}
              {errorMessage ? (
                <Text style={styles.errorText}>{errorMessage}</Text>
              ) : null}

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.cancelBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={onClose}
                >
                  <Text style={styles.cancelBtnText}>Batal</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.submitBtn,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={handleSubmit}
                >
                  <Text style={styles.submitBtnText}>Tambah Rentang</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  keyboardContainer: {
    width: '100%',
    maxWidth: 360,
  },
  modalContent: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 20,
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  modalSubtitle: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    marginBottom: 14,
    lineHeight: 16,
  },
  useCurrentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  useCurrentText: {
    color: '#c4b5fd',
    fontSize: 12,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 14,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  textInput: {
    height: 40,
    backgroundColor: '#09090b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    color: '#ffffff',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  inputSeparator: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 18,
  },
  durationPresetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  durationLabel: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 11,
    fontWeight: '600',
  },
  presetChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  presetChipText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
  },
  errorText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  cancelBtnText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    fontWeight: '700',
  },
  submitBtn: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#7c3aed',
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
});
