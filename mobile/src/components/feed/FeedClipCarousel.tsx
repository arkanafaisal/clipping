import React, { useRef, useEffect } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { ClipItem } from '../../services/api';
import { ClipCardItem } from './ClipCardItem';

export interface FeedClipCarouselProps {
  clipColumns: ClipItem[][];
  activeClipId: string | null;
  onSelectClip: (id: string) => void;
}

export const FeedClipCarousel: React.FC<FeedClipCarouselProps> = React.memo(({
  clipColumns,
  activeClipId,
  onSelectClip,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll ke kolom kartu klip yang aktif agar selalu terlihat di pandangan layar
  useEffect(() => {
    if (!activeClipId || clipColumns.length === 0) return;
    const colIndex = clipColumns.findIndex((col) => col.some((c) => c.id === activeClipId));
    if (colIndex >= 0) {
      // 94px = 84px (lebar kartu) + 10px (gap antar kolom). Berikan offset -40 agar posisi kartu pas di tengah pandangan
      const targetX = Math.max(0, colIndex * 94 - 40);
      scrollViewRef.current?.scrollTo({ x: targetX, animated: true });
    } else {
      // Jika klip aktif berada di luar kolom (misal count dikurangi), reset posisi scroll ke paling awal (0)
      scrollViewRef.current?.scrollTo({ x: 0, animated: true });
    }
  }, [activeClipId, clipColumns]);

  return (
    <View style={styles.clipGridContainer}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.clipGridScrollContent}
      >
        {clipColumns.map((col, colIdx) => (
          <View key={colIdx} style={styles.clipColumn}>
            {col.map((clip, rowIdx) => {
              const clipNumber = colIdx * 2 + rowIdx + 1;
              return (
                <ClipCardItem
                  key={clip.id}
                  id={clip.id}
                  rank={clip.rank}
                  start={clip.start}
                  clipNumber={clipNumber}
                  isActive={clip.id === activeClipId}
                  status={clip.status || 'none'}
                  isCustom={Boolean(clip.isCustom || clip.rank === 'custom')}
                  onSelect={onSelectClip}
                />
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  clipGridContainer: {
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 10,
    height: 146,
  },
  clipGridScrollContent: {
    paddingHorizontal: 12,
    gap: 10,
  },
  clipColumn: {
    flexDirection: 'column',
    gap: 8,
    justifyContent: 'center',
  },
});
