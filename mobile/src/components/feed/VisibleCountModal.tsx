import React, { useState, useEffect } from 'react';
import {
  Modal,
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { SlidersHorizontal, X, Plus, Minus } from 'lucide-react-native';

export interface VisibleCountModalProps {
  visible: boolean;
  currentCount: number;
  onClose: () => void;
  onApplyCount: (newCount: number) => void;
}

const PRESETS = [10, 20, 30, 50, 75, 100];

export const VisibleCountModal: React.FC<VisibleCountModalProps> = ({
  visible,
  currentCount,
  onClose,
  onApplyCount,
}) => {
  const [countInput, setCountInput] = useState(String(currentCount));

  useEffect(() => {
    if (visible) {
      setCountInput(String(currentCount));
    }
  }, [visible, currentCount]);

  const handleStep = (delta: number) => {
    const cur = parseInt(countInput, 10) || currentCount;
    const next = Math.max(1, Math.min(100, cur + delta));
    setCountInput(String(next));
  };

  const handleApply = () => {
    const parsed = parseInt(countInput, 10);
    const validCount = isNaN(parsed) ? 50 : Math.max(1, Math.min(100, parsed));
    onApplyCount(validCount);
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
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.titleRow}>
                <SlidersHorizontal size={20} color="#38bdf8" />
                <Text style={styles.modalTitle}>Jumlah Klip Heatmap</Text>
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
              Tampilkan N momen teratas dari heatmap YouTube (1–100). Klip custom selalu ditampilkan.
            </Text>

            {/* Stepper & Input */}
            <View style={styles.stepperRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.stepBtn,
                  pressed && { opacity: 0.6 },
                ]}
                onPress={() => handleStep(-5)}
              >
                <Minus size={18} color="#ffffff" />
              </Pressable>

              <TextInput
                style={styles.countInput}
                value={countInput}
                onChangeText={(val) => setCountInput(val.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                maxLength={3}
                selectTextOnFocus
              />

              <Pressable
                style={({ pressed }) => [
                  styles.stepBtn,
                  pressed && { opacity: 0.6 },
                ]}
                onPress={() => handleStep(5)}
              >
                <Plus size={18} color="#ffffff" />
              </Pressable>
            </View>

            {/* Presets Chips */}
            <Text style={styles.presetLabel}>Preset Cepat:</Text>
            <View style={styles.presetsGrid}>
              {PRESETS.map((p) => {
                const isSelected = countInput === String(p);
                return (
                  <Pressable
                    key={p}
                    style={({ pressed }) => [
                      styles.presetChip,
                      isSelected && styles.presetChipSelected,
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={() => setCountInput(String(p))}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        isSelected && styles.presetChipTextSelected,
                      ]}
                    >
                      {p} Klip
                    </Text>
                  </Pressable>
                );
              })}
            </View>

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
                onPress={handleApply}
              >
                <Text style={styles.submitBtnText}>Terapkan</Text>
              </Pressable>
            </View>
          </View>
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
  modalContent: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 20,
    width: '100%',
    maxWidth: 360,
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
    marginBottom: 16,
    lineHeight: 16,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countInput: {
    width: 90,
    height: 44,
    backgroundColor: '#09090b',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    color: '#ffffff',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  presetLabel: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  presetChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  presetChipSelected: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38bdf8',
  },
  presetChipText: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
    fontWeight: '700',
  },
  presetChipTextSelected: {
    color: '#38bdf8',
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
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
    backgroundColor: '#0284c7',
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
});
