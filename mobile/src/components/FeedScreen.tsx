import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { VideoView } from 'expo-video';
import { ClipItem } from '../services/api';
import { LocalStorage } from '../services/storage';
import { FeedTopControls } from './feed/FeedTopControls';
import { FeedPlaybackControls } from './feed/FeedPlaybackControls';
import { FeedClipCarousel } from './feed/FeedClipCarousel';
import { CustomRangeModal } from './feed/CustomRangeModal';
import { VisibleCountModal } from './feed/VisibleCountModal';
import {
  FacecamHighlightSection,
  FacecamConfig,
  DEFAULT_FACECAM_CONFIG,
} from './feed/FacecamHighlightSection';
import { useClipData } from '../hooks/useClipData';
import { useClipPlayer } from '../hooks/useClipPlayer';
import { useClipDownload } from '../hooks/useClipDownload';

interface FeedScreenProps {
  videoId: string;
  initialCount?: number;
  playMode?: 'local' | 'stream';
  onBack: () => void;
  onUpdateWorkshopDone?: (videoId: string, doneCount: number) => void;
}

export const FeedScreen: React.FC<FeedScreenProps> = ({
  videoId,
  initialCount = 50,
  playMode = 'local',
  onBack,
  onUpdateWorkshopDone,
}) => {
  // Shared refs for data, player & download hooks
  const clipsRef = useRef<ClipItem[]>([]);
  const activeClipIdRef = useRef<string | null>(null);
  const downloadedClipsRef = useRef<Record<string, boolean>>({});
  const setDownloadedClipsRef = useRef<React.Dispatch<React.SetStateAction<Record<string, boolean>>>>(() => {});

  // Modal dialog states
  const [isCustomModalVisible, setIsCustomModalVisible] = useState(false);
  const [isVisibleCountModalVisible, setIsVisibleCountModalVisible] = useState(false);

  const handleSetDownloadedClips = useCallback<React.Dispatch<React.SetStateAction<Record<string, boolean>>>>((val) => {
    setDownloadedClipsRef.current(val);
  }, []);

  // Hook 2: useClipPlayer
  const {
    player,
    facecamPlayer,
    setIsFacecamActive,
    videoAspectRatio,
    streamUrl,
    isContinueState,
    progressPercent,
    setProgressPercent,
    currentClipTime,
    setCurrentClipTime,
    trackWidthRef,
    currentSourceUriRef,
    seekDebounceTimerRef,
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
    playMode,
    onBack,
  });

  // Facecam Highlight State & Persistent Framing Settings
  const [facecamConfig, setFacecamConfig] = useState<FacecamConfig>(DEFAULT_FACECAM_CONFIG);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = await LocalStorage.getItem(`clipping_facecam_${videoId}`);
        if (saved && mounted) {
          const parsed = JSON.parse(saved);
          setFacecamConfig((prev) => ({ ...prev, ...parsed }));
        }
      } catch (e) {}
    })();
    return () => {
      mounted = false;
    };
  }, [videoId]);

  const handleUpdateFacecamConfig = useCallback(
    (updates: Partial<FacecamConfig>) => {
      setFacecamConfig((prev) => {
        const next = { ...prev, ...updates };
        LocalStorage.setItem(`clipping_facecam_${videoId}`, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [videoId]
  );

  useEffect(() => {
    setIsFacecamActive(facecamConfig.enabled);
  }, [facecamConfig.enabled, setIsFacecamActive]);

  // Layout player container untuk anchoring video tepat di atas progress bar
  const [playerLayout, setPlayerLayout] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const videoContainerStyle = useMemo(() => {
    const { width: cWidth, height: cHeight } = playerLayout;
    const targetRatio = videoAspectRatio || 16 / 9;

    if (cWidth <= 0 || cHeight <= 0) {
      return { width: '100%' as const, aspectRatio: targetRatio };
    }

    const containerRatio = cWidth / cHeight;
    if (containerRatio > targetRatio) {
      // Container lebih lebar dari rasio video
      return {
        width: cHeight * targetRatio,
        height: cHeight,
      };
    } else {
      // Container lebih tinggi dari rasio video (kondisi portrait standar): lebar penuh, tinggi sesuai aspek rasio
      return {
        width: cWidth,
        height: cWidth / targetRatio,
      };
    }
  }, [playerLayout, videoAspectRatio]);

  // Hook 1: useClipData
  const {
    clips,
    setClips,
    activeClipId,
    activeClip,
    loading,
    loadingMessage,
    visibleHeatmapCount,
    setVisibleHeatmapCount,
    handleAddCustomClip,
    activeTimeEdit,
    setActiveTimeEdit,
    tempTimeValue,
    setTempTimeValue,
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
    setDownloadedClipsRef.current = setDownloadedClips;
  }, [setDownloadedClips]);

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

      {/* 1. TOP CONTROLS (Trimming, Done/Trash, Download, Custom & Visible Count) */}
      <FeedTopControls
        activeClip={activeClip}
        currentClipTime={currentClipTime}
        isDownloaded={Boolean(downloadedClips[activeClip.id])}
        isDownloading={Boolean(downloadingClips[activeClip.id])}
        downloadProgressInfo={downloadProgress[activeClip.id]}
        activeTimeEdit={activeTimeEdit}
        tempTimeValue={tempTimeValue}
        visibleHeatmapCount={visibleHeatmapCount}
        onAddCustomPress={() => setIsCustomModalVisible(true)}
        onChangeVisibleCountPress={() => setIsVisibleCountModalVisible(true)}
        getDownloadProgressLabel={getDownloadProgressLabel}
        onToggleTrash={handleToggleTrash}
        onToggleDone={handleToggleDone}
        onDownloadClip={handleDownloadClip}
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

      {/* 2. VIDEO PLAYER AREA (expo-video, diturunkan mepet di atas seek bar) */}
      <View
        style={styles.playerContainer}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (width > 0 && height > 0) {
            setPlayerLayout({ width, height });
          }
        }}
      >
        {/* Facecam Highlight Preview & Framing Controls (Mengisi space celah atas) */}
        <FacecamHighlightSection
          facecamPlayer={facecamPlayer}
          config={facecamConfig}
          onUpdateConfig={handleUpdateFacecamConfig}
          hasPlayableSource={Boolean(currentSourceUriRef.current || streamUrl)}
        />

        {currentSourceUriRef.current || streamUrl || (activeClip.status === 'done' && downloadedClips[activeClip.id]) ? (
          <View style={videoContainerStyle}>
            <VideoView
              style={styles.videoPlayer}
              player={player}
              contentFit="contain"
              nativeControls={false}
            />
          </View>
        ) : (
          <View style={styles.streamPendingBox}>
            <ActivityIndicator size="small" color="#ef4444" />
            <Text style={styles.streamPendingText}>
              Memuat direct stream dari internal server...
            </Text>
          </View>
        )}
      </View>

      {/* 3. BOTTOM PLAYBACK CONTROLS (Scrubber, Play/Pause, Skip) */}
      <FeedPlaybackControls
        progressPercent={progressPercent}
        isContinueState={isContinueState}
        onScrubberPress={(e) => {
          const currentActiveId = activeClipIdRef.current || activeClipId;
          const currentActive = clipsRef.current.find((c) => c.id === currentActiveId) || activeClip;
          const duration = currentActive.end - currentActive.start;
          if (duration <= 0 || trackWidthRef.current <= 0) return;

          const currentSource = currentSourceUriRef.current;
          const isIndividualCutClip =
            currentActive.status === 'done' &&
            Boolean(downloadedClipsRef.current[currentActive.id]) &&
            !currentSource.endsWith('/full.mp4') &&
            !currentSource.endsWith('/full_video.mp4');

          const locationX = e.nativeEvent.locationX;
          const pct = Math.max(0, Math.min(100, (locationX / trackWidthRef.current) * 100));
          const targetTime = isIndividualCutClip
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

      {/* Modal Dialog: Tambah Rentang Custom */}
      <CustomRangeModal
        visible={isCustomModalVisible}
        currentPlaybackTime={player?.currentTime || (activeClip ? activeClip.start + currentClipTime : 0)}
        onClose={() => setIsCustomModalVisible(false)}
        onAddCustomRange={handleAddCustomClip}
      />

      {/* Modal Dialog: Ubah Jumlah Klip Heatmap yang Terlihat */}
      <VisibleCountModal
        visible={isVisibleCountModalVisible}
        currentCount={visibleHeatmapCount}
        onClose={() => setIsVisibleCountModalVisible(false)}
        onApplyCount={setVisibleHeatmapCount}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
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
