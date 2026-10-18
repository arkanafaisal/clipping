import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { VideoView } from 'expo-video';
import {
  ClipItem,
  SubtitleCue,
  loadClipSubtitle,
} from '../services/api';
import { ToastManager } from './Toast';
import { CookiesModal } from './CookiesModal';
import { SubtitleEditModal } from './SubtitleEditModal';
import { FeedTopControls } from './feed/FeedTopControls';
import { FeedPlaybackControls } from './feed/FeedPlaybackControls';
import { FeedClipCarousel } from './feed/FeedClipCarousel';
import { SubtitleOverlay } from './feed/SubtitleOverlay';
import { useClipData } from '../hooks/useClipData';
import { useClipPlayer } from '../hooks/useClipPlayer';
import { useClipDownload } from '../hooks/useClipDownload';

interface FeedScreenProps {
  videoId: string;
  initialCount?: number;
  onBack: () => void;
  onUpdateWorkshopDone?: (videoId: string, doneCount: number) => void;
}

export const FeedScreen: React.FC<FeedScreenProps> = ({
  videoId,
  initialCount = 50,
  onBack,
  onUpdateWorkshopDone,
}) => {
  const DRAFT_KEY = `clips_draft_${videoId}`;

  const [subtitleModalVisible, setSubtitleModalVisible] = useState(false);

  // State Subtitle & Overlay (Layer 1 Realtime Preview)
  const [subtitles, setSubtitles] = useState<SubtitleCue[]>([]);
  const [activeSubtitleText, setActiveSubtitleText] = useState<string>('');
  const [isSubtitleVisible, setIsSubtitleVisible] = useState<boolean>(true);
  const subtitlesRef = useRef<SubtitleCue[]>(subtitles);

  useEffect(() => {
    subtitlesRef.current = subtitles;
  }, [subtitles]);

  // Shared refs for data, player & download hooks
  const clipsRef = useRef<ClipItem[]>([]);
  const activeClipIdRef = useRef<string | null>(null);
  const downloadedClipsRef = useRef<Record<string, boolean>>({});
  const setCookiesModalVisibleRef = useRef<(visible: boolean) => void>(() => {});
  const setDownloadedClipsRef = useRef<React.Dispatch<React.SetStateAction<Record<string, boolean>>>>(() => {});

  const handleSetCookiesModalVisible = useCallback((visible: boolean) => {
    setCookiesModalVisibleRef.current(visible);
  }, []);

  const handleSetDownloadedClips = useCallback<React.Dispatch<React.SetStateAction<Record<string, boolean>>>>((val) => {
    setDownloadedClipsRef.current(val);
  }, []);

  // Hook 2: useClipPlayer
  const {
    player,
    streamUrl,
    isContinueState,
    progressPercent,
    setProgressPercent,
    currentClipTime,
    setCurrentClipTime,
    trackWidthRef,
    currentSourceUriRef,
    seekDebounceTimerRef,
    pendingSeekTargetRef,
    centralizedSeek,
    syncPlayerSourceForClip,
    togglePlayPause,
    skipSeconds,
    initializeStreamAndPlayback,
  } = useClipPlayer({
    videoId,
    clipsRef,
    activeClipIdRef,
    downloadedClipsRef,
    subtitlesRef,
    setActiveSubtitleText,
    setCookiesModalVisible: handleSetCookiesModalVisible,
    onBack,
  });

  // Hook 1: useClipData
  const {
    clips,
    setClips,
    activeClipId,
    setActiveClipId,
    activeClip,
    loading,
    loadingMessage,
    activeTimeEdit,
    setActiveTimeEdit,
    tempTimeValue,
    setTempTimeValue,
    sortedClips,
    clipColumns,
    handleUpdateStart,
    handleUpdateEnd,
    handleMsTimeChange,
    handleSelectClip,
    handleToggleDone,
    handleToggleTrash,
  } = useClipData({
    videoId,
    initialCount,
    onBack,
    onUpdateWorkshopDone,
    onSeek: centralizedSeek,
    syncPlayerSourceForClip,
    downloadedClipsRef,
    setDownloadedClips: handleSetDownloadedClips,
    currentSourceUriRef,
    seekDebounceTimerRef,
    setProgressPercent,
    setCurrentClipTime,
    onClipsLoaded: (loadedClips, existingDownloadMap, initialActiveClip) => {
      initializeStreamAndPlayback(initialActiveClip, existingDownloadMap);
    },
    clipsRef,
    activeClipIdRef,
  });

  // Hook 3: useClipDownload
  const {
    downloadingClips,
    downloadedClips,
    setDownloadedClips,
    downloadProgress,
    cookiesModalVisible,
    setCookiesModalVisible,
    getDownloadProgressLabel,
    handleDownloadClip,
  } = useClipDownload({
    videoId,
    activeClip,
    activeClipId,
    clipsRef,
    activeClipIdRef,
    setClips,
    syncPlayerSourceForClip,
    onUpdateWorkshopDone,
    downloadedClipsRef,
  });

  useEffect(() => {
    setCookiesModalVisibleRef.current = setCookiesModalVisible;
  }, [setCookiesModalVisible]);

  useEffect(() => {
    setDownloadedClipsRef.current = setDownloadedClips;
  }, [setDownloadedClips]);

  // Auto-load subtitle yang sudah tersimpan untuk klip aktif
  useEffect(() => {
    let isCurrent = true;
    async function checkSavedSubtitle() {
      if (!activeClip || !activeClip.videoId) return;
      try {
        const saved = await loadClipSubtitle(activeClip.videoId, activeClip.start, activeClip.end);
        if (isCurrent) {
          if (saved && Array.isArray(saved.cues)) {
            setSubtitles(saved.cues);
          } else {
            setSubtitles([]);
          }
        }
      } catch {
        if (isCurrent) setSubtitles([]);
      }
    }
    checkSavedSubtitle();
    return () => {
      isCurrent = false;
    };
  }, [activeClip.videoId, activeClip.start, activeClip.end]);





  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ef4444" />
        <Text style={styles.loadingText}>{loadingMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Overlay dismiss saat input milidetik aktif (ketika menekan sembarang area lainnya otomatis close) */}
      {activeTimeEdit !== null && (
        <Pressable
          style={styles.dismissOverlay}
          onPress={() => {
            Keyboard.dismiss();
            setActiveTimeEdit(null);
          }}
        />
      )}

      {/* 1. TOP CONTROLS */}
      <FeedTopControls
        activeClip={activeClip}
        currentClipTime={currentClipTime}
        isDownloaded={Boolean(downloadedClips[activeClip.id])}
        isDownloading={Boolean(downloadingClips[activeClip.id])}
        downloadProgressInfo={downloadProgress[activeClip.id]}
        hasSubtitles={subtitles.length > 0}
        isSubtitleVisible={isSubtitleVisible}
        activeTimeEdit={activeTimeEdit}
        tempTimeValue={tempTimeValue}
        getDownloadProgressLabel={getDownloadProgressLabel}
        onToggleTrash={handleToggleTrash}
        onToggleDone={handleToggleDone}
        onDownloadClip={handleDownloadClip}
        onOpenSubtitleModal={() => setSubtitleModalVisible(true)}
        onToggleSubtitleVisibility={() => setIsSubtitleVisible((prev) => !prev)}
        onStartEditTime={(type) => {
          setActiveTimeEdit(type);
          const curMs = Math.floor((activeClip[type] % 1) * 100);
          setTempTimeValue(curMs.toString().padStart(2, '0'));
        }}
        onMsTimeChange={handleMsTimeChange}
        onBlurTimeEdit={() => setActiveTimeEdit(null)}
        onUpdateStart={handleUpdateStart}
        onUpdateEnd={handleUpdateEnd}
      />

      {/* 2. VIDEO PLAYER AREA (expo-video) */}
      <View style={styles.playerContainer}>
        {streamUrl || (activeClip.status === 'done' && downloadedClips[activeClip.id]) ? (
          <VideoView
            style={styles.videoPlayer}
            player={player}
            contentFit="contain"
            nativeControls={false}
          />
        ) : (
          <View style={styles.streamPendingBox}>
            <ActivityIndicator size="small" color="#ef4444" />
            <Text style={styles.streamPendingText}>
              Memuat direct stream dari internal server...
            </Text>
          </View>
        )}

        {/* Subtitle Layer 1 (Realtime Non-Destructive Preview) */}
        <SubtitleOverlay
          isVisible={isSubtitleVisible}
          subtitleText={activeSubtitleText}
        />
      </View>

      {/* 3. BOTTOM PLAYBACK CONTROLS (Fixed Height) */}
      <FeedPlaybackControls
        progressPercent={progressPercent}
        isContinueState={isContinueState}
        onScrubberPress={(e) => {
          const currentActiveId = activeClipIdRef.current || activeClipId;
          const currentActive = clipsRef.current.find((c) => c.id === currentActiveId) || activeClip;
          const duration = currentActive.end - currentActive.start;
          if (duration <= 0 || trackWidthRef.current <= 0) return;

          const isLocalMode = currentSourceUriRef.current.startsWith('file://');
          const locationX = e.nativeEvent.locationX;
          const pct = Math.max(0, Math.min(100, (locationX / trackWidthRef.current) * 100));
          const targetTime = isLocalMode
            ? (pct / 100) * duration
            : currentActive.start + (pct / 100) * duration;

          setProgressPercent(pct);
          setCurrentClipTime((pct / 100) * duration);
          centralizedSeek(targetTime, true);
        }}
        onLayoutTrack={(e) => {
          trackWidthRef.current = e.nativeEvent.layout.width;
        }}
        onTogglePlayPause={togglePlayPause}
        onSkipSeconds={skipSeconds}
      />

      {/* 4. 2-ROW HORIZONTAL CLIP GRID */}
      <FeedClipCarousel
        clipColumns={clipColumns}
        activeClipId={activeClipId}
        onSelectClip={handleSelectClip}
      />
      {/* 5. Cookies Modal for Rate Limits */}
      <CookiesModal
        visible={cookiesModalVisible}
        onClose={() => setCookiesModalVisible(false)}
      />

      {/* 6. Subtitle Edit Modal */}
      <SubtitleEditModal
        visible={subtitleModalVisible}
        onClose={() => setSubtitleModalVisible(false)}
        videoId={videoId}
        clip={activeClip}
        onSave={(newCues) => {
          setSubtitles(newCues);
        }}
        onSeekTo={(timeSec) => {
          centralizedSeek(timeSec, true);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 16,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  dismissOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 15,
  },
  playerContainer: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  streamPendingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  streamPendingText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
