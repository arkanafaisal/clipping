import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Platform,
  Linking,
  Share,
} from 'react-native';
import { Share2, MessageCircle, X } from 'lucide-react-native';
import { ToastManager } from './Toast';

const BOT_NUMBER = '6285742923730';

export interface ExportWorkshopModalProps {
  visible: boolean;
  workshopTitle?: string;
  videoId?: string;
  exportDataJson: string;
  onClose: () => void;
}

export const ExportWorkshopModal: React.FC<ExportWorkshopModalProps> = ({
  visible,
  workshopTitle,
  videoId,
  exportDataJson,
  onClose,
}) => {
  const handleShare = async () => {
    try {
      await Share.share({
        message: exportDataJson,
        title: `Export Workshop - ${workshopTitle || videoId}`,
      });
    } catch (err: any) {
      ToastManager.show({
        type: 'error',
        title: 'Gagal Membuka Menu Berbagi',
        rawError: err?.message || String(err),
        duration: 3000,
      });
    }
  };

  const handleSendToWA = async () => {
    try {
      const commandText = `!import_json ${exportDataJson}`;
      // Jika ukuran payload panjang (> 1500 karakter), gunakan native share agar tidak terpotong URL browser
      if (commandText.length > 1500) {
        await Share.share({
          message: commandText,
          title: `Export Workshop ${workshopTitle || videoId}`,
        });
        return;
      }

      const encoded = encodeURIComponent(commandText);
      const waUrl = `https://wa.me/${BOT_NUMBER}?text=${encoded}`;

      const supported = await Linking.canOpenURL(waUrl);
      if (supported) {
        await Linking.openURL(waUrl);
      } else {
        await Linking.openURL(`https://api.whatsapp.com/send?phone=${BOT_NUMBER}&text=${encoded}`);
      }

      ToastManager.show({
        type: 'success',
        title: 'Membuka WhatsApp...',
        duration: 3000,
      });
      onClose();
    } catch (err: any) {
      ToastManager.show({
        type: 'error',
        title: 'Gagal Membuka WhatsApp',
        rawError: err?.message || String(err),
        duration: 3500,
      });
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.titleRow}>
              <Share2 size={20} color="#38bdf8" />
              <Text style={styles.title}>Ekspor Data Workshop Utuh</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={18} color="rgba(255, 255, 255, 0.6)" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle} numberOfLines={2}>
            {workshopTitle || `Video ID: ${videoId}`}
          </Text>

          <Text style={styles.description}>
            Cadangkan data utuh workshop: klip heatmap & custom, konfigurasi global (facecam & posisi), serta subtitle & template klip yang telah selesai (mark as done).
          </Text>

          {/* Preview Box (Dapat diseleksi dan disalin manual) */}
          <View style={styles.previewContainer}>
            <ScrollView style={styles.previewScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.previewText} selectable={true}>
                {exportDataJson}
              </Text>
            </ScrollView>
          </View>

          {/* Action Buttons: Bagikan/Salin & Kirim ke WhatsApp */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.shareBtn]}
              onPress={handleShare}
              activeOpacity={0.8}
            >
              <Share2 size={18} color="#38bdf8" />
              <Text style={styles.shareBtnText}>Bagikan / Salin Data JSON</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.waBtn]}
              onPress={handleSendToWA}
              activeOpacity={0.8}
            >
              <MessageCircle size={18} color="#34d399" />
              <Text style={styles.waBtnText}>Kirim ke WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#18181b',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 20,
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
    marginBottom: 4,
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
  subtitle: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  description: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 14,
  },
  previewContainer: {
    height: 110,
    backgroundColor: '#09090b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 10,
    marginBottom: 16,
  },
  previewScroll: {
    flex: 1,
  },
  previewText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 10,
    lineHeight: 14,
  },
  actionsContainer: {
    flexDirection: 'column',
    gap: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    paddingVertical: 12,
    borderWidth: 1,
  },
  shareBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  shareBtnText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
  },
  waBtn: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  waBtnText: {
    color: '#34d399',
    fontSize: 13,
    fontWeight: '700',
  },
});
