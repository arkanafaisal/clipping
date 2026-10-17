import React from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  GestureResponderEvent,
  LayoutChangeEvent,
} from 'react-native';
import {
  Rewind,
  ChevronLeft,
  Pause,
  Play,
  ChevronRight,
  FastForward,
} from 'lucide-react-native';

export interface FeedPlaybackControlsProps {
  progressPercent: number;
  isContinueState: boolean;
  onScrubberPress: (e: GestureResponderEvent) => void;
  onLayoutTrack: (e: LayoutChangeEvent) => void;
  onTogglePlayPause: () => void;
  onSkipSeconds: (seconds: number) => void;
}

export const FeedPlaybackControls: React.FC<FeedPlaybackControlsProps> = ({
  progressPercent,
  isContinueState,
  onScrubberPress,
  onLayoutTrack,
  onTogglePlayPause,
  onSkipSeconds,
}) => {
  return (
    <View style={styles.bottomPlayback}>
      {/* Scrubber Progress Bar (Direct click to seek, zero animation, instant jump) */}
      <Pressable
        style={styles.progressBarTrack}
        hitSlop={{ top: 12, bottom: 12, left: 0, right: 0 }}
        onLayout={onLayoutTrack}
        onPressIn={onScrubberPress}
      >
        <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        <View style={[styles.progressKnob, { left: `${progressPercent}%` }]} />
      </Pressable>

      {/* Playback Buttons (-10s, -3s, Play/Pause, +5s, +15s) */}
      <View style={styles.playbackControlsRow}>
        <Pressable
          style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.5 }]}
          onPressIn={() => onSkipSeconds(-10)}
        >
          <Rewind size={20} color="rgba(255, 255, 255, 0.6)" />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.5 }]}
          onPressIn={() => onSkipSeconds(-3)}
        >
          <ChevronLeft size={24} color="rgba(255, 255, 255, 0.6)" />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.playPauseBtn, pressed && { transform: [{ scale: 0.95 }] }]}
          onPressIn={onTogglePlayPause}
        >
          {isContinueState ? (
            <Pause size={22} color="#000000" fill="#000000" />
          ) : (
            <Play size={22} color="#000000" fill="#000000" style={{ marginLeft: 2 }} />
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.5 }]}
          onPressIn={() => onSkipSeconds(5)}
        >
          <ChevronRight size={24} color="rgba(255, 255, 255, 0.6)" />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.5 }]}
          onPressIn={() => onSkipSeconds(15)}
        >
          <FastForward size={20} color="rgba(255, 255, 255, 0.6)" />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bottomPlayback: {
    backgroundColor: '#121212',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  progressBarTrack: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    position: 'relative',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#ef4444',
  },
  progressKnob: {
    position: 'absolute',
    top: -4,
    marginLeft: -7,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  playbackControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    paddingVertical: 10,
  },
  skipBtn: {
    padding: 6,
  },
  playPauseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
});
