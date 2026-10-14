import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image } from 'react-native';
import { Play, Trash2, MessageCircle } from 'lucide-react-native';

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
  onBulkWA?: (videoId: string) => void;
}

export const WorkshopCard: React.FC<WorkshopCardProps> = ({
  workshop,
  onPress,
  onDelete,
  onBulkWA,
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

        {/* Bottom Row: Stats (KLIP & DONE) aligned with WhatsApp and Delete Buttons */}
        <View style={styles.cardFooter}>
          {/* Left: Badges (KLIP & DONE) */}
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

          {/* Right: Actions Group (WhatsApp & Delete) */}
          <View style={styles.actionsRow}>
            {onBulkWA && (
              <TouchableOpacity
                style={styles.waBtn}
                onPress={() => onBulkWA(workshop.videoId)}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <MessageCircle size={13} color="#34d399" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => onDelete(workshop.videoId)}
              activeOpacity={0.7}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Trash2 size={13} color="#f87171" />
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
    gap: 8,
  },
  waBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
});
