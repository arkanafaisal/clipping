import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Play, Trash2, MessageCircle, Share2, CloudOff } from 'lucide-react-native';

export interface WorkshopItem {
  videoId: string;
  title?: string;
  count?: number;
  lastUpdated?: number;
  doneCount?: number;
}

interface WorkshopCardProps {
  workshop: WorkshopItem;
  hasFullVideo?: boolean;
  isDownloadingFullVideo?: boolean;
  downloadPercent?: number;
  onPress: (videoId: string) => void;
  onDelete: (videoId: string) => void;
  onBulkWA?: (videoId: string) => void;
  onExport?: (videoId: string) => void;
  onDownloadFullVideo?: (videoId: string) => void;
}

export const WorkshopCard: React.FC<WorkshopCardProps> = ({
  workshop,
  hasFullVideo,
  isDownloadingFullVideo,
  downloadPercent = 0,
  onPress,
  onDelete,
  onBulkWA,
  onExport,
  onDownloadFullVideo,
}) => {
  const thumbnailUrl = `https://img.youtube.com/vi/${workshop.videoId}/mqdefault.jpg`;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(workshop.videoId)}
      activeOpacity={0.88}
    >
      {/* 1. Thumbnail Container (16:9 Aspect Ratio) */}
      <View style={styles.thumbnailContainer}>
        <Image
          source={{ uri: thumbnailUrl }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
        {/* Subtle Dark Gradient Overlay */}
        <View style={styles.thumbnailOverlay} />

        {/* Centered Play Button Overlay */}
        <View style={styles.playButtonWrapper}>
          <View style={styles.playButton}>
            <Play size={20} color="#ffffff" fill="#ffffff" />
          </View>
        </View>
      </View>

      {/* 2. Card Content Body */}
      <View style={styles.cardContent}>
        {/* Video Title */}
        <Text style={styles.videoTitle} numberOfLines={2}>
          {workshop.title || `Video ID: ${workshop.videoId}`}
        </Text>

        {/* Bottom Row: Actions Group (Offline Video, Export JSON, WhatsApp & Delete) */}
        <View style={styles.cardFooter}>
          <Text style={styles.videoDateText}>
            {workshop.lastUpdated ? new Date(workshop.lastUpdated).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : ''}
          </Text>

          <View style={styles.actionsRow}>
            {/* Tombol Unduh / Indikator Full Video Offline */}
            {isDownloadingFullVideo ? (
              <View style={[styles.actionBtn, styles.downloadingBtn]}>
                <ActivityIndicator size="small" color="#fbbf24" />
              </View>
            ) : hasFullVideo ? (
              <View style={[styles.actionBtn, styles.fullVideoReadyBtn]}>
                <CloudOff size={16} color="#34d399" />
              </View>
            ) : (
              onDownloadFullVideo && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.offlineBtnInactive]}
                  onPress={() => onDownloadFullVideo(workshop.videoId)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <CloudOff size={16} color="rgba(255, 255, 255, 0.45)" />
                </TouchableOpacity>
              )
            )}

            {/* Tombol Ekspor JSON */}
            {onExport && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.exportBtn]}
                onPress={() => onExport(workshop.videoId)}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Share2 size={15} color="#38bdf8" />
              </TouchableOpacity>
            )}

            {/* Tombol Kirim ke WhatsApp */}
            {onBulkWA && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.waBtn]}
                onPress={() => onBulkWA(workshop.videoId)}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <MessageCircle size={15} color="#34d399" />
              </TouchableOpacity>
            )}

            {/* Tombol Hapus Workshop */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.deleteBtn]}
              onPress={() => onDelete(workshop.videoId)}
              activeOpacity={0.7}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Trash2 size={15} color="#f87171" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(23, 23, 23, 0.85)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  thumbnailContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000000',
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    opacity: 0.85,
  },
  thumbnailOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  playButtonWrapper: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 15,
    elevation: 8,
  },
  cardContent: {
    padding: 14,
  },
  videoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 20,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  videoDateText: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 11,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  downloadingBtn: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  fullVideoReadyBtn: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  offlineBtnInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  exportBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  waBtn: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  deleteBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
});
