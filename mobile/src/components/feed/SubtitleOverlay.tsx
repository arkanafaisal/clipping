import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StyleSheet, View, Text, useWindowDimensions } from 'react-native';

export interface SubtitleOverlayProps {
  isVisible: boolean;
  subtitleText?: string;
  fontSize?: number;
  positionX?: number; // Skala 0 - 100 terhadap lebar video player (default 50 = horizontal center)
  positionY?: number; // Skala 0 - 100 terhadap tinggi video player (default 85 = lower third)
  subtitleListenerRef?: React.MutableRefObject<((text: string, fontSize?: number) => void) | null>;
}

// 8 arah offset (kardinal & diagonal) solid tanpa shadow dan tanpa blur
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

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = React.memo(({
  isVisible,
  subtitleText: initialSubtitleText = '',
  fontSize: initialFontSize = 14,
  positionX = 50,
  positionY = 85,
  subtitleListenerRef,
}) => {
  const { width: windowWidth } = useWindowDimensions();

  // Isolasi state teks dan font size lokal:
  // SubtitleOverlay memperbarui dirinya sendiri tanpa memicu re-render pada FeedScreen / VideoView
  const [currentText, setCurrentText] = useState<string>(initialSubtitleText);
  const [currentFontSize, setCurrentFontSize] = useState<number>(initialFontSize);
  const lastNonEmptyTextRef = useRef<string>(' ');

  useEffect(() => {
    if (subtitleListenerRef) {
      subtitleListenerRef.current = (text: string, size: number = 14) => {
        setCurrentText(text);
        setCurrentFontSize(size);
      };
      return () => {
        subtitleListenerRef.current = null;
      };
    }
  }, [subtitleListenerRef]);

  useEffect(() => {
    if (!subtitleListenerRef) {
      setCurrentText(initialSubtitleText);
      setCurrentFontSize(initialFontSize);
    }
  }, [initialSubtitleText, initialFontSize, subtitleListenerRef]);

  // Inisialisasi dimensi container langsung berbasis lebar layar & rasio 16:9 fixed
  // Menghilangkan jeda asinkron onLayout teks yang menyebabkan flicker/lompat posisi
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: windowWidth,
    height: (windowWidth * 9) / 16,
  });

  if (!isVisible) return null;

  const hasText = Boolean(currentText && currentText.trim().length > 0);
  if (hasText) {
    lastNonEmptyTextRef.current = currentText;
  }
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
  const scaledFontSize = Math.max(8, Math.round(currentFontSize * scaleFactor));
  const lineHeight = Math.round(scaledFontSize * 1.35);
  const strokeScale = Math.max(0.8, scaleFactor);

  // Offset relatif terhadap titik pusat (50%, 50%) video player
  // Contoh default (X=50, Y=85):
  // translateX = (50 - 50)% = 0 (tepat di tengah horizontal tanpa perlu ukur lebar teks)
  // translateY = (85 - 50)% = +35% * height (di area lower-third tanpa perlu ukur tinggi teks)
  const translateX = ((positionX - 50) / 100) * containerWidth;
  const translateY = ((positionY - 50) / 100) * containerHeight;

  // Pertahankan layer Text yang sudah mounted di memory tanpa unmount/re-mount:
  // Saat jeda bicara (hasText = false), container ber-opacity 0 dan teks terakhir tetap disimpan
  const displayText = hasText ? currentText : lastNonEmptyTextRef.current;

  // Menghilangkan duplikasi bayangan hitam pada emoji di 4 layer stroke:
  // Karakter emoji disembunyikan (opacity: 0) pada layer stroke agar tidak memunculkan kotak hitam,
  // namun tetap mempertahankan metrik lebar/tinggi karakter (zero layout shift).
  const strokeContent = useMemo(() => {
    if (!displayText || !/\p{Extended_Pictographic}|\p{Emoji_Presentation}/u.test(displayText)) {
      return displayText;
    }
    const parts = displayText.split(/(\p{Extended_Pictographic}+|\p{Emoji_Presentation}+)/gu);
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
  }, [displayText]);

  return (
    <View
      style={[
        styles.subtitleOverlayContainer,
        { opacity: hasText ? 1 : 0 },
      ]}
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
        {/* Layer Border / Stroke Hitam Pekat (8 arah) tanpa shadow atau blur */}
        {STROKE_OFFSETS.map((offset, index) => (
          <Text
            key={index}
            style={[
              styles.subtitleText,
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
            {strokeContent}
          </Text>
        ))}

        {/* Layer Teks Utama Putih Bersih */}
        <Text
          style={[
            styles.subtitleText,
            styles.foregroundText,
            {
              fontSize: scaledFontSize,
              lineHeight,
            },
          ]}
        >
          {displayText}
        </Text>
      </View>
    </View>
  );
});

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
  },
  foregroundText: {
    color: '#ffffff',
  },
});
