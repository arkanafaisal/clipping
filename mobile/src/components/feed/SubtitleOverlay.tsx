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

  const containerWidth = containerSize.width || windowWidth;
  const containerHeight = containerSize.height || (windowWidth * 9) / 16;

  // Dimensi acuan (shorter dimension min(W, H)) dari kontainer video aktif (baik 16:9 maupun 9:16).
  // Pada mode 16:9 mobile standar, containerHeight adalah ~220dp.
  // Rasio dasar: baseFontSize 14dp terhadap viewport ~220dp adalah 14 / 220 = 0.0638.
  // Dengan mengaitkan fontSize ke min(containerWidth, containerHeight),
  // ukuran teks selalu proporsional 1:1 dengan render FFmpeg di resolusi dan rasio apa pun.
  const currentRefDim = Math.min(containerWidth, containerHeight);
  const baseViewportRef = (windowWidth * 9) / 16;
  const scaleFactor = baseViewportRef > 0 ? currentRefDim / baseViewportRef : 1;
  const scaledFontSize = Math.max(8, Math.round(fontSize * scaleFactor));
  const lineHeight = Math.round(scaledFontSize * 1.35);
  const strokeScale = Math.max(0.8, scaleFactor);

  // Offset relatif terhadap titik pusat (50%, 50%) video player
  // Contoh default (X=50, Y=85):
  // translateX = (50 - 50)% = 0 (tepat di tengah horizontal tanpa perlu ukur lebar teks)
  // translateY = (85 - 50)% = +35% * height (di area lower-third tanpa perlu ukur tinggi teks)
  const translateX = ((positionX - 50) / 100) * containerWidth;
  const translateY = ((positionY - 50) / 100) * containerHeight;

  // Pisahkan baris hanya jika ada explicit newline (\n).
  // Teks yang panjang tidak di-auto-break/wrap (overflow dibiarkan melebar tanpa wrap),
  // identik 100% dengan mekanisme FFmpeg.
  const lines = subtitleText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  // Menghilangkan duplikasi bayangan dobel pada emoji di 8 layer stroke belakang:
  // Karakter emoji disembunyikan (opacity: 0) pada layer stroke agar tidak memunculkan bayangan warna-warni,
  // namun tetap mempertahankan metrik lebar/tinggi karakter (zero layout shift).
  const renderStrokeContent = (text: string) => {
    if (!text) return null;
    if (!/\p{Extended_Pictographic}|\p{Emoji_Presentation}/u.test(text)) {
      return text;
    }
    const parts = text.split(/(\p{Extended_Pictographic}+|\p{Emoji_Presentation}+)/gu);
    return parts.map((part, pIdx) => {
      if (/\p{Extended_Pictographic}|\p{Emoji_Presentation}/u.test(part)) {
        return (
          <Text key={pIdx} style={{ opacity: 0 }}>
            {part}
          </Text>
        );
      }
      return part;
    });
  };

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
            transform: [{ translateX }, { translateY }],
          },
        ]}
      >
        {lines.map((lineText, lineIdx) => (
          <View key={lineIdx} style={styles.lineWrapper}>
            {/* Layer Border / Stroke Hitam Pekat (8 arah) */}
            {STROKE_OFFSETS.map((offset, index) => (
              <Text
                key={index}
                numberOfLines={1}
                ellipsizeMode="clip"
                style={[
                  styles.subtitleText,
                  styles.strokeText,
                  {
                    fontSize: scaledFontSize,
                    lineHeight,
                    transform: [{ translateX: offset.x * strokeScale }, { translateY: offset.y * strokeScale }],
                  },
                ]}
                aria-hidden
              >
                {renderStrokeContent(lineText)}
              </Text>
            ))}

            {/* Layer Teks Utama Putih Bersih */}
            <Text
              numberOfLines={1}
              ellipsizeMode="clip"
              style={[
                styles.subtitleText,
                styles.foregroundText,
                {
                  fontSize: scaledFontSize,
                  lineHeight,
                },
              ]}
            >
              {lineText}
            </Text>
          </View>
        ))}
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
  lineWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  subtitleText: {
    textAlign: 'center',
    fontWeight: '800',
    letterSpacing: 0.2,
    includeFontPadding: false,
    flexWrap: 'nowrap',
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
