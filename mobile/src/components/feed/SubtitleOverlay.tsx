import React, { useState } from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';

export interface SubtitleOverlayProps {
  isVisible: boolean;
  subtitleText: string;
  fontSize?: number;
  positionX?: number; // Skala 0 - 100 terhadap lebar video player (default 50 = horizontal center)
  positionY?: number; // Skala 0 - 100 terhadap tinggi video player (default 85 = lower third)
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
  positionX = 50,
  positionY = 85,
}) => {
  if (!isVisible || !subtitleText) return null;

  const [textLayout, setTextLayout] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const lineHeight = Math.round(fontSize * 1.35);

  return (
    <View
      style={[
        styles.subtitleOverlayContainer,
        {
          left: `${positionX}%`,
          top: `${positionY}%`,
          transform: [
            { translateX: textLayout.width > 0 ? -textLayout.width / 2 : 0 },
            { translateY: textLayout.height > 0 ? -textLayout.height / 2 : 0 },
          ],
        },
      ]}
      pointerEvents="none"
    >
      <View
        style={styles.textContainer}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (width !== textLayout.width || height !== textLayout.height) {
            setTextLayout({ width, height });
          }
        }}
      >
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
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  textContainer: {
    position: 'relative',
    maxWidth: Dimensions.get('window').width * 0.92,
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
