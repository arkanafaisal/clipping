import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { HardDrive, Globe, X } from 'lucide-react-native';

export interface PlayModeModalProps {
  visible: boolean;
  onSelectLocal: () => void;
  onSelectStream: () => void;
  onClose: () => void;
}

export const PlayModeModal: React.FC<PlayModeModalProps> = ({
  visible,
  onSelectLocal,
  onSelectStream,
  onClose,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTextGroup}>
              <Text style={styles.title}>Pilih Sumber Pemutar</Text>
              <Text style={styles.subtitle}>
                Video utuh (Full Video) terdeteksi di penyimpanan HP Anda.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} color="rgba(255, 255, 255, 0.6)" />
            </TouchableOpacity>
          </View>

          {/* Opsi 1: Video Lokal */}
          <TouchableOpacity
            style={styles.optionCard}
            onPress={onSelectLocal}
            activeOpacity={0.8}
          >
            <View style={[styles.iconWrapper, styles.localIconBg]}>
              <HardDrive size={22} color="#34d399" />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Gunakan Video Lokal</Text>
              <Text style={styles.optionSubtitle}>
                Memutar langsung dari file fisik HP. Mode offline, bebas kuota, dan tanpa buffering.
              </Text>
            </View>
          </TouchableOpacity>

          {/* Opsi 2: Streaming YouTube */}
          <TouchableOpacity
            style={styles.optionCard}
            onPress={onSelectStream}
            activeOpacity={0.8}
          >
            <View style={[styles.iconWrapper, styles.streamIconBg]}>
              <Globe size={22} color="#38bdf8" />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Streaming YouTube</Text>
              <Text style={styles.optionSubtitle}>
                Memutar online dari server YouTube. Gunakan jika file lokal bermasalah atau korup.
              </Text>
            </View>
          </TouchableOpacity>

          {/* Footer Cancel */}
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelBtnText}>Batal</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#18181b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerTextGroup: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    lineHeight: 16,
  },
  closeBtn: {
    padding: 4,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 14,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  localIconBg: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  streamIconBg: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.55)',
    lineHeight: 15,
  },
  cancelBtn: {
    marginTop: 6,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  cancelBtnText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '600',
  },
});
