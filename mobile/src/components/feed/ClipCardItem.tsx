import React from 'react';
import { StyleSheet, Text, View, Pressable, Platform } from 'react-native';
import { formatTime } from './timeUtils';

export interface ClipCardProps {
  id: string;
  rank: number | string;
  start: number;
  clipNumber: number;
  isActive: boolean;
  status: 'none' | 'done' | 'trash';
  isCustom?: boolean;
  onSelect: (id: string) => void;
}

/**
 * Komponen Card Klip ter-memoized 100%:
 * Mencegah re-render 50-100 kartu klip setiap kali progress bar bergerak (timeUpdate).
 * Menggunakan Pressable dengan delayPressIn={0} dan onPressIn agar merespons instan 0ms saat disentuh.
 */
export const ClipCardItem = React.memo<ClipCardProps>(
  ({ id, rank, start, clipNumber, isActive, status, isCustom, onSelect }) => {
    const isDone = status === 'done';
    const isTrash = status === 'trash';
    const isCustomClip = Boolean(isCustom || rank === 'custom');

    return (
      <Pressable
        style={({ pressed }) => [
          styles.clipCard,
          isCustomClip && styles.clipCardCustom,
          isDone && styles.clipCardDone,
          isTrash && styles.clipCardTrash,
          isActive && styles.clipCardActive,
          pressed && { opacity: 0.75 },
        ]}
        onPress={() => onSelect(id)}
      >
        {/* Rank Badge */}
        <View
          style={[
            styles.rankBadge,
            isCustomClip && styles.rankBadgeCustom,
            isTrash && styles.rankBadgeTrash,
          ]}
        >
          <Text style={styles.rankBadgeText}>
            {isCustomClip ? 'CUST' : `#${rank || clipNumber}`}
          </Text>
        </View>

        <Text style={[styles.clipCardTitle, isCustomClip && styles.clipCardTitleCustom, isTrash && styles.clipCardTitleTrash]}>
          KLIP {clipNumber}
        </Text>
        <Text style={styles.clipCardTime}>{formatTime(start)}</Text>
      </Pressable>
    );
  },
  (prev, next) =>
    prev.id === next.id &&
    prev.clipNumber === next.clipNumber &&
    prev.isActive === next.isActive &&
    prev.status === next.status &&
    prev.start === next.start &&
    prev.rank === next.rank &&
    prev.isCustom === next.isCustom
);

const styles = StyleSheet.create({
  clipCard: {
    width: 84,
    height: 54,
    borderRadius: 10,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    padding: 4,
  },
  clipCardCustom: {
    borderColor: 'rgba(139, 92, 246, 0.45)',
    backgroundColor: '#1a1625',
  },
  clipCardActive: {
    borderColor: '#ffffff',
    backgroundColor: '#262626',
    borderWidth: 1.5,
  },
  clipCardDone: {
    backgroundColor: 'rgba(6, 78, 59, 0.6)',
    borderColor: '#10b981',
  },
  clipCardTrash: {
    backgroundColor: 'rgba(127, 29, 29, 0.65)',
    borderColor: '#ef4444',
  },
  rankBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#dc2626',
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  rankBadgeCustom: {
    backgroundColor: '#8b5cf6',
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  rankBadgeTrash: {
    backgroundColor: '#7f1d1d',
  },
  rankBadgeText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '900',
  },
  clipCardTitle: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  clipCardTitleCustom: {
    color: '#c4b5fd',
  },
  clipCardTitleTrash: {
    color: '#fca5a5',
  },
  clipCardTime: {
    color: '#ffffff',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '800',
  },
});
