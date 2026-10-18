import React from 'react';
import { StyleSheet, View, Text } from 'react-native';

export interface SubtitleOverlayProps {
  isVisible: boolean;
  subtitleText: string;
  fontSize?: number;
}

// 8 arah offset untuk membentuk outline/border solid di sekeliling teks tanpa celah
const STROKE_OFFSETS = [
  { x: -1.5, y: -1.5 },
  { x: 0, y: -2 },
  { x: 1.5, y: -1.5 },
  { x: -2, y: 0 },
  { x: 2, y: 0 },
  { x: -1.5, y: 1.5 },
  { x: 0, y: 2 },
  { x: 1.5, y: 1.5 },
];

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({
  isVisible,
  subtitleText,
  fontSize = 14,
}) => {
  if (!isVisible || !subtitleText) return null;

  const lineHeight = Math.round(fontSize * 1.35);

  return (
    <View style={styles.subtitleOverlayContainer} pointerEvents="none">
      <View style={styles.textContainer}>
        {/* Layer Border / Stroke Hitam Pekat (8 arah) */}
        {STROKE_OFFSETS.map((offset, index) => (
          <Text
            key={index}
            style={[
              styles.subtitleText,
              styles.strokeText,
              {
                fontSize,
                lineHeight,
                transform: [{ translateX: offset.x }, { translateY: offset.y }],
              },
            ]}
            aria-hidden
          >
            {subtitleText}
          </Text>
        ))}

        {/* Layer Teks Utama Putih Bersih */}
        <Text
          style={[
            styles.subtitleText,
            styles.foregroundText,
            {
              fontSize,
              lineHeight,
            },
          ]}
        >
          {subtitleText}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  subtitleOverlayContainer: {
    position: 'absolute',
    bottom: 28,
    left: 16,
    right: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  textContainer: {
    position: 'relative',
    maxWidth: '92%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  subtitleText: {
    textAlign: 'center',
    fontWeight: '800',
    letterSpacing: 0.2,
    includeFontPadding: false,
  },
  strokeText: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    color: '#000000',
    textShadowColor: '#000000',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 2,
  },
  foregroundText: {
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
});
