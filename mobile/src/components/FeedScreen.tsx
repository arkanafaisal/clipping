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
} from '../services/api';
import { ToastManager } from './Toast';
import { CookiesModal } from './CookiesModal';
import { FeedTopControls, EditorMode } from './feed/FeedTopControls';
import { FeedPlaybackControls } from './feed/FeedPlaybackControls';
import { FeedClipCarousel } from './feed/FeedClipCarousel';
import { SubtitleOverlay } from './feed/SubtitleOverlay';
import { useClipData } from '../hooks/useClipData';
import { useClipPlayer } from '../hooks/useClipPlayer';
import { useClipDownload } from '../hooks/useClipDownload';
import { useClipSubtitle } from '../hooks/useClipSubtitle';
import { useClipTemplate } from '../hooks/useClipTemplate';

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

  // Shared refs for data, player, download & subtitle hooks
  const clipsRef = useRef<ClipItem[]>([]);
  const activeClipIdRef = useRef<string | null>(null);
  const downloadedClipsRef = useRef<Record<string, boolean>>({});
  const subtitlesRef = useRef<SubtitleCue[]>([]);
  const setCookiesModalVisibleRef = useRef<(visible: boolean) => void>(() => {});
  const setDownloadedClipsRef = useRef<React.Dispatch<React.SetStateAction<Record<string, boolean>>>>(() => {});
  const setActiveSubtitleTextRef = useRef<(text: string) => void>(() => {});

  const handleSetCookiesModalVisible = useCallback((visible: boolean) => {
    setCookiesModalVisibleRef.current(visible);
  }, []);

  const handleSetDownloadedClips = useCallback<React.Dispatch<React.SetStateAction<Record<string, boolean>>>>((val) => {
    setDownloadedClipsRef.current(val);
  }, []);

  const handleSetActiveSubtitleText = useCallback((text: string) => {
    setActiveSubtitleTextRef.current(text);
  }, []);

  // Hook 2: useClipPlayer
  const {
    player,
    facecamPlayer,
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
    setActiveSubtitleText: handleSetActiveSubtitleText,
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

  // Relative Seek helper (0 to clip duration) compatible with both local MP4 and online stream
  const handleSeekRelative = useCallback(
    (relSec: number, shouldPlay: boolean = true) => {
      const duration = activeClip.end - activeClip.start;
      if (duration <= 0) return;
      const clampedRel = Math.max(0, Math.min(duration, relSec));
      const isLocalMode = currentSourceUriRef.current.startsWith('file://');
      const targetTime = isLocalMode ? clampedRel : activeClip.start + clampedRel;
      const pct = (clampedRel / duration) * 100;
      setProgressPercent(pct);
      setCurrentClipTime(clampedRel);
      centralizedSeek(targetTime, shouldPlay);
    },
    [activeClip.start, activeClip.end, centralizedSeek, setProgressPercent, setCurrentClipTime, currentSourceUriRef]
  );

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

  // Hook 4: useClipSubtitle
  const {
    subtitles,
    setSubtitles,
    activeSubtitleText,
    setActiveSubtitleText,
    isSubtitleVisible,
    setIsSubtitleVisible,
    selectedCueId,
    setSelectedCueId,
    isFetchingSubtitles,
    isExportingSubtitle,
    subtitlePosition,
    handleUpdateSubtitlePosition,
    handleAddCue,
    handleUpdateCue,
    handleShiftCueTime,
    handleDeleteCue,
    handleFetchSubtitles,
    handleExportSubtitledVideo,
  } = useClipSubtitle({
    videoId,
    activeClip,
    subtitlesRef,
    onSeek: (timeSec) => handleSeekRelative(timeSec, true),
    onRateLimit: () => setCookiesModalVisible(true),
  });

  const [activeEditorMode, setActiveEditorMode] = useState<EditorMode>(null);

  // Hook 5: useClipTemplate
  const {
    templateConfig,
    isPortrait,
    handleUpdateContext,
    handleUpdateFacecam,
    handleUpdateMainVideo,
  } = useClipTemplate({
    videoId,
    activeClip,
  });

  useEffect(() => {
    setActiveEditorMode(null);
  }, [activeClip?.id]);

  useEffect(() => {
    setCookiesModalVisibleRef.current = setCookiesModalVisible;
  }, [setCookiesModalVisible]);

  useEffect(() => {
    setDownloadedClipsRef.current = setDownloadedClips;
  }, [setDownloadedClips]);

  useEffect(() => {
    setActiveSubtitleTextRef.current = setActiveSubtitleText;
  }, [setActiveSubtitleText]);

  // Active Subtitle Cue determination based on playback time
  const activeSubtitleCue = useMemo(() => {
    if (subtitles.length === 0) return null;
    return subtitles.find((c) => currentClipTime >= c.start && currentClipTime <= c.end) || null;
  }, [subtitles, currentClipTime]);

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
        isExporting={isExportingSubtitle}
        onExportClip={handleExportSubtitledVideo}
        activeEditorMode={activeEditorMode}
        onSelectEditorMode={setActiveEditorMode}
        templateConfig={templateConfig}
        onUpdateContext={handleUpdateContext}
        onUpdateFacecam={handleUpdateFacecam}
        onUpdateMainVideo={handleUpdateMainVideo}
        downloadProgressInfo={downloadProgress[activeClip.id]}
        hasSubtitles={subtitles.length > 0}
        isSubtitleVisible={isSubtitleVisible}
        subtitles={subtitles}
        selectedCueId={selectedCueId}
        isFetchingSubtitles={isFetchingSubtitles}
        subtitlePosition={subtitlePosition}
        onUpdateSubtitlePosition={handleUpdateSubtitlePosition}
        activeTimeEdit={activeTimeEdit}
        tempTimeValue={tempTimeValue}
        getDownloadProgressLabel={getDownloadProgressLabel}
        onToggleTrash={handleToggleTrash}
        onToggleDone={handleToggleDone}
        onDownloadClip={handleDownloadClip}
        onToggleSubtitleVisibility={() => setIsSubtitleVisible((prev) => !prev)}
        onSelectCue={setSelectedCueId}
        onAddCue={handleAddCue}
        onUpdateCue={handleUpdateCue}
        onShiftCueTime={handleShiftCueTime}
        onDeleteCue={handleDeleteCue}
        onFetchSubtitles={handleFetchSubtitles}
        onSeek={handleSeekRelative}
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
        {isPortrait ? (
          /* CANVAS PORTRAIT 9:16 (Saat Elemen Konteks dan/atau Facecam Aktif) */
          <View
            style={[
              styles.canvas916Container,
              activeEditorMode === 'template' && styles.canvasHelperBorder,
            ]}
          >
            {streamUrl || (activeClip.status === 'done' && downloadedClips[activeClip.id]) ? (
              <>
                {/* 1. Header Banner Konteks (Teks Putih) */}
                {templateConfig.context.enabled && (
                  <View
                    style={[
                      styles.contextBannerBox,
                      { paddingVertical: templateConfig.context.paddingY },
                    ]}
                  >
                    <Text
                      style={[
                        styles.contextBannerText,
                        { fontSize: templateConfig.context.fontSize },
                      ]}
                      numberOfLines={2}
                    >
                      {templateConfig.context.text || 'JUDUL VIDEO'}
                    </Text>
                  </View>
                )}

                {/* 2. Viewport Facecam (Rasio 4:3 di atas) */}
                {templateConfig.facecam.enabled && (
                  <View
                    style={[
                      styles.facecamBox,
                      activeEditorMode === 'template' && styles.elementHelperBorder,
                    ]}
                    collapsable={false}
                  >
                    <VideoView
                      style={[
                        styles.fillVideo,
                        {
                          transform: [
                            { scale: templateConfig.facecam.zoom },
                            { translateX: ((50 - templateConfig.facecam.cropX) / 100) * 160 },
                            { translateY: ((50 - templateConfig.facecam.cropY) / 100) * 120 },
                          ],
                        },
                      ]}
                      player={facecamPlayer}
                      contentFit="cover"
                      nativeControls={false}
                    />
                  </View>
                )}

                {/* 3. Viewport Main Video Gameplay (Fills remaining height) */}
                <View
                  style={[
                    styles.mainVideoBox,
                    activeEditorMode === 'template' && styles.elementHelperBorder,
                  ]}
                  collapsable={false}
                >
                  <VideoView
                    style={[
                      styles.fillVideo,
                      {
                        transform: [
                          { scale: templateConfig.mainVideo.zoom },
                          { translateX: ((50 - templateConfig.mainVideo.cropX) / 100) * 140 },
                          { translateY: ((50 - templateConfig.mainVideo.cropY) / 100) * 100 },
                        ],
                      },
                    ]}
                    player={player}
                    contentFit="cover"
                    nativeControls={false}
                  />
                </View>

                {/* Subtitle Overlay pada Kanvas Portrait */}
                <SubtitleOverlay
                  isVisible={isSubtitleVisible}
                  subtitleText={activeSubtitleCue ? activeSubtitleCue.text : activeSubtitleText}
                  fontSize={activeSubtitleCue?.fontSize || 14}
                  positionX={subtitlePosition.x}
                  positionY={subtitlePosition.y}
                />
              </>
            ) : (
              <View style={styles.streamPendingBox}>
                <ActivityIndicator size="small" color="#ef4444" />
                <Text style={styles.streamPendingText}>
                  Memuat direct stream dari internal server...
                </Text>
              </View>
            )}
          </View>
        ) : (
          /* CANVAS LANDSCAPE 16:9 (Mode Asli saat Template Dimatikan) */
          <View
            style={[
              styles.videoBox169,
              activeEditorMode === 'template' && styles.canvasHelperBorder,
            ]}
          >
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

            {/* Subtitle Layer 1 (Realtime Non-Destructive Preview diposisikan relatif di dalam frame 16:9) */}
            <SubtitleOverlay
              isVisible={isSubtitleVisible}
              subtitleText={activeSubtitleCue ? activeSubtitleCue.text : activeSubtitleText}
              fontSize={activeSubtitleCue?.fontSize || 14}
              positionX={subtitlePosition.x}
              positionY={subtitlePosition.y}
            />
          </View>
        )}
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
    backgroundColor: '#0a0a0a',
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
  },
  videoBox169: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000000',
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  canvas916Container: {
    height: '100%',
    aspectRatio: 9 / 16,
    backgroundColor: '#000000',
    overflow: 'hidden',
    position: 'relative',
    alignSelf: 'center',
    justifyContent: 'flex-start',
  },
  canvasHelperBorder: {
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    borderStyle: 'dashed',
  },
  elementHelperBorder: {
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.6)',
    borderStyle: 'dashed',
  },
  contextBannerBox: {
    width: '100%',
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  contextBannerText: {
    color: '#000000',
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  facecamBox: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#000000',
    overflow: 'hidden',
    position: 'relative',
    borderRadius: 1,
    zIndex: 10,
  },
  mainVideoBox: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000000',
    overflow: 'hidden',
    position: 'relative',
    borderRadius: 1,
    zIndex: 5,
  },
  fillVideo: {
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
