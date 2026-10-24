import React, { useState } from 'react';
import { StyleSheet, View, Text, useWindowDimensions } from 'react-native';

export interface WatermarkOverlayProps {
  isVisible?: boolean;
  text: string;
  size?: number; // Skala font size dp (default 14)
  x?: number; // 0 - 100 (% horizontal relatif terhadap container luar canvas)
  y?: number; // 0 - 100 (% vertikal relatif terhadap container luar canvas)
}

// 8 arah offset untuk outline teks watermark agar terbaca di background terang maupun gelap
const STROKE_OFFSETS = [
  { x: -1, y: -1 },
  { x: 0, y: -1.5 },
  { x: 1, y: -1 },
  { x: -1.5, y: 0 },
  { x: 1.5, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1.5 },
  { x: 1, y: 1 },
];

export const WatermarkOverlay: React.FC<WatermarkOverlayProps> = ({
  isVisible = true,
  text,
  size = 14,
  x = 85,
  y = 15,
}) => {
  const { width: windowWidth } = useWindowDimensions();

  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: windowWidth,
    height: (windowWidth * 9) / 16,
  });

  if (!isVisible || !text || !text.trim()) return null;

  const containerWidth = containerSize.width || windowWidth;
  const containerHeight = containerSize.height || (windowWidth * 9) / 16;

  // Skala ukuran font proporsional dengan dimensi terpendek container canvas luar (1:1 dengan FFmpeg export)
  const currentRefDim = Math.min(containerWidth, containerHeight);
  const baseViewportRef = (windowWidth * 9) / 16;
  const scaleFactor = baseViewportRef > 0 ? currentRefDim / baseViewportRef : 1;
  const scaledFontSize = Math.max(9, Math.round(size * scaleFactor));
  const lineHeight = Math.round(scaledFontSize * 1.3);

  // Offset relatif terhadap titik pusat (50%, 50%) container luar
  const translateX = ((x - 50) / 100) * containerWidth;
  const translateY = ((y - 50) / 100) * containerHeight;

  return (
    <View
      style={styles.watermarkOverlayContainer}
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
          styles.watermarkAnchor,
          {
            transform: [{ translateX }, { translateY }],
          },
        ]}
      >
        <View style={styles.textStack}>
          {/* 8 arah stroke outline hitam untuk keterbacaan kontras tinggi */}
          {STROKE_OFFSETS.map((offset, idx) => (
            <Text
              key={`wm-stroke-${idx}`}
              style={[
                styles.strokeLayer,
                {
                  fontSize: scaledFontSize,
                  lineHeight,
                  transform: [{ translateX: offset.x }, { translateY: offset.y }],
                },
              ]}
              numberOfLines={2}
            >
              {text}
            </Text>
          ))}

          {/* Layer Foreground Teks Watermark */}
          <Text
            style={[
              styles.foregroundText,
              {
                fontSize: scaledFontSize,
                lineHeight,
              },
            ]}
            numberOfLines={2}
          >
            {text}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  watermarkOverlayContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 15,
  },
  watermarkAnchor: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textStack: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  strokeLayer: {
    position: 'absolute',
    color: '#000000',
    fontWeight: '800',
    textAlign: 'center',
    opacity: 0.85,
  },
  foregroundText: {
    color: 'rgba(255, 255, 255, 0.92)',
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
});
