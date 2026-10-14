import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image } from 'react-native';
import { Play, Trash2, MessageCircle, Copy, DownloadCloud } from 'lucide-react-native';

export interface WorkshopItem {
  videoId: string;
  title?: string;
  count?: number;
  lastUpdated?: number;
  doneCount?: number;
}

interface WorkshopCardProps {
  workshop: WorkshopItem;
  onPress: (videoId: string) => void;
  onDelete: (videoId: string) => void;
  onExport?: (workshop: WorkshopItem) => void;
  onBulkWA?: (videoId: string) => void;
  onDownloadDrive?: (videoId: string) => void;
}

export const WorkshopCard: React.FC<WorkshopCardProps> = ({
  workshop,
  onPress,
  onDelete,
  onExport,
  onBulkWA,
  onDownloadDrive,
}) => {
  const thumbnailUrl = `https://img.youtube.com/vi/${workshop.videoId}/mqdefault.jpg`;
  const clipCount = workshop.count || 50;
  const doneCount = workshop.doneCount || 0;

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

        {/* Bottom Row: Stats & Action Buttons */}
        <View style={styles.cardFooter}>
          {/* Badges: KLIP & DONE */}
          <View style={styles.statsRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>KLIP</Text>
              <Text style={styles.badgeValueEmerald}>{clipCount}</Text>
            </View>

            <View style={styles.badge}>
              <Text style={styles.badgeValueBlue}>{doneCount}</Text>
              <Text style={styles.badgeLabel}>DONE</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            {/* GDrive Download */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.btnPurple]}
              onPress={() => onDownloadDrive?.(workshop.videoId)}
              activeOpacity={0.7}
            >
              <DownloadCloud size={16} color="#c084fc" />
            </TouchableOpacity>

            {/* Copy / Export */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.btnBlue]}
              onPress={() => onExport?.(workshop)}
              activeOpacity={0.7}
            >
              <Copy size={16} color="#60a5fa" />
            </TouchableOpacity>

            {/* WA Export */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.btnEmerald]}
              onPress={() => onBulkWA?.(workshop.videoId)}
              activeOpacity={0.7}
            >
              <MessageCircle size={16} color="#34d399" />
            </TouchableOpacity>

            {/* Delete Draft */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.btnRose]}
              onPress={() => onDelete(workshop.videoId)}
              activeOpacity={0.7}
            >
              <Trash2 size={16} color="#f87171" />
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
    flexWrap: 'wrap',
    gap: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  badgeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.4)',
    letterSpacing: 0.5,
  },
  badgeValueEmerald: {
    fontSize: 12,
    fontWeight: '900',
    color: '#34d399',
  },
  badgeValueBlue: {
    fontSize: 12,
    fontWeight: '900',
    color: '#60a5fa',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPurple: {
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
  },
  btnBlue: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  btnEmerald: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  btnRose: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
});
