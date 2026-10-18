import React, { useState } from 'react';
import { StyleSheet, View, Text, useWindowDimensions } from 'react-native';

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
  const { width: windowWidth } = useWindowDimensions();

  // Inisialisasi dimensi container langsung berbasis lebar layar & rasio 16:9 fixed
  // Menghilangkan jeda asinkron onLayout teks yang menyebabkan flicker/lompat posisi
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: windowWidth,
    height: (windowWidth * 9) / 16,
  });

  if (!isVisible || !subtitleText) return null;

  const lineHeight = Math.round(fontSize * 1.35);

  const containerWidth = containerSize.width || windowWidth;
  const containerHeight = containerSize.height || (windowWidth * 9) / 16;

  // Offset relatif terhadap titik pusat (50%, 50%) video player
  // Contoh default (X=50, Y=85):
  // translateX = (50 - 50)% = 0 (tepat di tengah horizontal tanpa perlu ukur lebar teks)
  // translateY = (85 - 50)% = +35% * height (di area lower-third tanpa perlu ukur tinggi teks)
  const translateX = ((positionX - 50) / 100) * containerWidth;
  const translateY = ((positionY - 50) / 100) * containerHeight;

  return (
    <View
      style={styles.subtitleOverlayContainer}
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (
          width > 0 &&
          height > 0 &&
          (Math.abs(width - containerSize.width) > 1 || Math.abs(height - containerSize.height) > 1)
        ) {
          setContainerSize({ width, height });
        }
      }}
    >
      <View
        style={[
          styles.textContainer,
          {
            maxWidth: containerWidth * 0.92,
            transform: [{ translateX }, { translateY }],
          },
        ]}
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
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  textContainer: {
    position: 'relative',
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
