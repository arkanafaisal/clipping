import React from 'react';
import { StyleSheet, View, Text } from 'react-native';

export interface SubtitleOverlayProps {
  isVisible: boolean;
  subtitleText: string;
}

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({
  isVisible,
  subtitleText,
}) => {
  if (!isVisible || !subtitleText) return null;

  return (
    <View style={styles.subtitleOverlayContainer} pointerEvents="none">
      <View style={styles.subtitlePill}>
        <Text style={styles.subtitleText}>{subtitleText}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  subtitleOverlayContainer: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  subtitlePill: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    maxWidth: '90%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  subtitleText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
});
