import React from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { ClipItem } from '../../services/api';
import { ClipCardItem } from './ClipCardItem';

export interface FeedClipCarouselProps {
  clipColumns: ClipItem[][];
  activeClipId: string | null;
  onSelectClip: (id: string) => void;
}

export const FeedClipCarousel: React.FC<FeedClipCarouselProps> = ({
  clipColumns,
  activeClipId,
  onSelectClip,
}) => {
  return (
    <View style={styles.clipGridContainer}>
      <ScrollView
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
};

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
