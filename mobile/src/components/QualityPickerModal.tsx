import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Check, Film, Sparkles, Zap, X } from 'lucide-react-native';
import { VideoVersionItem } from './WorkshopCard';

interface QualityPickerModalProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  versions: VideoVersionItem[];
  selectedQualityId?: string;
  onSelectQuality: (qualityId: string) => void;
  onClose: () => void;
  isLoading?: boolean;
}

export const QualityPickerModal: React.FC<QualityPickerModalProps> = ({
  visible,
  title,
  subtitle,
  versions,
  selectedQualityId,
  onSelectQuality,
  onClose,
  isLoading = false,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            <TouchableOpacity
              onPress={onClose}
              disabled={isLoading}
              style={styles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} color="rgba(255, 255, 255, 0.6)" />
            </TouchableOpacity>
          </View>

          {/* List of Versions */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#38bdf8" />
              <Text style={styles.loadingText}>Menyiapkan URL kualitas video...</Text>
            </View>
          ) : versions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Tidak ada pilihan kualitas yang tersedia.</Text>
            </View>
          ) : (
            <ScrollView style={styles.scrollList} showsVerticalScrollIndicator={false}>
              {versions.map((ver) => {
                const isSelected = selectedQualityId === ver.id;
                const is60Fps = ver.fps >= 55;
                const isFullHd = ver.height >= 1080;

                return (
                  <TouchableOpacity
                    key={ver.id}
                    style={[styles.itemCard, isSelected && styles.itemCardSelected]}
                    onPress={() => onSelectQuality(ver.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.itemLeft}>
                      <View style={[styles.iconBox, isSelected && styles.iconBoxSelected]}>
                        {is60Fps ? (
                          <Zap size={16} color={isSelected ? '#38bdf8' : '#e2e8f0'} />
                        ) : isFullHd ? (
                          <Sparkles size={16} color={isSelected ? '#38bdf8' : '#e2e8f0'} />
                        ) : (
                          <Film size={16} color={isSelected ? '#38bdf8' : '#94a3b8'} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.labelRow}>
                          <Text style={[styles.itemLabel, isSelected && styles.itemLabelSelected]}>
                            {ver.label}
                          </Text>
                          {is60Fps ? (
                            <View style={styles.badgeFps}>
                              <Text style={styles.badgeFpsText}>60 FPS</Text>
                            </View>
                          ) : null}
                          {ver.is_progressive ? (
                            <View style={styles.badgeProg}>
                              <Text style={styles.badgeProgText}>Single</Text>
                            </View>
                          ) : null}
                        </View>
                        {ver.note ? <Text style={styles.itemNote}>{ver.note}</Text> : null}
                      </View>
                    </View>

                    <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                      {isSelected ? <Check size={14} color="#0f172a" strokeWidth={3} /> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Footer */}
          <View style={styles.footerRow}>
            <TouchableOpacity onPress={onClose} style={styles.closeFooterBtn}>
              <Text style={styles.closeFooterBtnText}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.55)',
    lineHeight: 17,
  },
  closeBtn: {
    padding: 4,
    marginLeft: 8,
  },
  scrollList: {
    maxHeight: 340,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  itemCardSelected: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: '#38bdf8',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBoxSelected: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
  },
  itemLabelSelected: {
    color: '#38bdf8',
  },
  badgeFps: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  badgeFpsText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
  },
  badgeProg: {
    backgroundColor: '#10b981',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  badgeProgText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
  },
  itemNote: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.45)',
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  radioCircleSelected: {
    backgroundColor: '#38bdf8',
    borderColor: '#38bdf8',
  },
  loadingContainer: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  emptyContainer: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.45)',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 14,
  },
  closeFooterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  closeFooterBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.75)',
  },
});
