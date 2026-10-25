import React, { useState, useMemo } from 'react';
import { StyleSheet, View, Text, useWindowDimensions } from 'react-native';

export interface WatermarkOverlayProps {
  isVisible?: boolean;
  text: string;
  size?: number; // Skala font size dp (default 14)
  x?: number; // 0 - 100 (% horizontal relatif terhadap container luar canvas)
  y?: number; // 0 - 100 (% vertikal relatif terhadap container luar canvas)
}

// 8 arah offset (kardinal & diagonal) solid tanpa shadow dan tanpa blur (1:1 dengan SubtitleOverlay)
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

export const WatermarkOverlay: React.FC<WatermarkOverlayProps> = React.memo(({
  isVisible = true,
  text,
  size = 14,
  x = 85,
  y = 15,
}) => {
  const { width: windowWidth } = useWindowDimensions();

  // Dimensi container inisial langsung berbasis rasio acuan untuk menghilangkan layout jump/flicker
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
  const scaledFontSize = Math.max(2, Math.round(size * scaleFactor));
  const lineHeight = Math.round(scaledFontSize * 1.35);
  const strokeScale = Math.max(0.6, scaleFactor);

  // Offset relatif terhadap titik pusat (50%, 50%) container luar
  const translateX = ((x - 50) / 100) * containerWidth;
  const translateY = ((y - 50) / 100) * containerHeight;

  // Parsing baris teks manual & ubah spasi menjadi Non-Breaking Space (\u00A0):
  // 1. Mencegah Android StaticLayout memotong atau menghilangkan orphan words di ujung teks
  // 2. Mencegah auto-word-wrap yang membuat stroke layer dan foreground layer berbeda posisi
  // 3. Efisien di memory tanpa re-parsing konstan (useMemo)
  const linesData = useMemo(() => {
    const rawLines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    return rawLines.map((lineText) => ({
      lineText: lineText.replace(/ /g, '\u00A0'),
    }));
  }, [text]);

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
        <View style={styles.textContainer}>
          {linesData.map((item, lineIdx) => (
            <View key={lineIdx} style={styles.lineWrapper}>
              {/* Layer Border / Stroke Hitam Pekat (8 arah) solid tanpa blur/shadow/transparansi */}
              {STROKE_OFFSETS.map((offset, index) => (
                <Text
                  key={index}
                  textBreakStrategy="simple"
                  style={[
                    styles.watermarkText,
                    styles.strokeText,
                    {
                      fontSize: scaledFontSize,
                      lineHeight,
                      transform: [
                        { translateX: offset.x * strokeScale },
                        { translateY: offset.y * strokeScale },
                      ],
                    },
                  ]}
                  aria-hidden
                >
                  {item.lineText}
                </Text>
              ))}

              {/* Layer Teks Utama Putih Bersih */}
              <Text
                textBreakStrategy="simple"
                style={[
                  styles.watermarkText,
                  styles.foregroundText,
                  {
                    fontSize: scaledFontSize,
                    lineHeight,
                  },
                ]}
              >
                {item.lineText}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  watermarkOverlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 15,
  },
  watermarkAnchor: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  textContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  lineWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  watermarkText: {
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
  },
  foregroundText: {
    color: '#ffffff',
  },
});
