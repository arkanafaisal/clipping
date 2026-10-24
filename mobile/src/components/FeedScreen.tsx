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
import { CustomRangeModal } from './feed/CustomRangeModal';
import { VisibleCountModal } from './feed/VisibleCountModal';
import { SubtitleOverlay } from './feed/SubtitleOverlay';
import { WatermarkOverlay } from './feed/WatermarkOverlay';
import { useClipData } from '../hooks/useClipData';
import { useClipPlayer } from '../hooks/useClipPlayer';
import { useClipDownload } from '../hooks/useClipDownload';
import { useClipSubtitle } from '../hooks/useClipSubtitle';
import { useClipTemplate } from '../hooks/useClipTemplate';

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
  // Shared refs for data, player, download & subtitle hooks
  const clipsRef = useRef<ClipItem[]>([]);
  const activeClipIdRef = useRef<string | null>(null);
  const downloadedClipsRef = useRef<Record<string, boolean>>({});
  const subtitlesRef = useRef<SubtitleCue[]>([]);
  const setCookiesModalVisibleRef = useRef<(visible: boolean) => void>(() => {});
  const setDownloadedClipsRef = useRef<React.Dispatch<React.SetStateAction<Record<string, boolean>>>>(() => {});
  const setActiveSubtitleTextRef = useRef<(text: string, fontSize?: number) => void>(() => {});
  const [activeSubtitleFontSize, setActiveSubtitleFontSize] = useState<number>(14);

  // Modal dialog states
  const [isCustomModalVisible, setIsCustomModalVisible] = useState(false);
  const [isVisibleCountModalVisible, setIsVisibleCountModalVisible] = useState(false);
  const [cookiesModalVisible, setCookiesModalVisible] = useState(false);

  const handleSetDownloadedClips = useCallback<React.Dispatch<React.SetStateAction<Record<string, boolean>>>>((val) => {
    setDownloadedClipsRef.current(val);
  }, []);

  const handleSetActiveSubtitleText = useCallback((text: string, fontSize: number = 14) => {
    setActiveSubtitleTextRef.current(text, fontSize);
  }, []);

  // Hook 2: useClipPlayer
  const {
    player,
    facecamPlayer,
    streamUrl,
    isContinueState,
    progressPercent,
    setProgressPercent,
    progressAnim,
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
    setIsFacecamActive,
  } = useClipPlayer({
    videoId,
    clipsRef,
    activeClipIdRef,
    downloadedClipsRef,
    playMode,
    subtitlesRef,
    setActiveSubtitleText: handleSetActiveSubtitleText,
    onBack,
  });

  // Relative Seek helper (0 to clip duration) compatible with both local MP4 and online stream
  const handleSeekRelative = useCallback(
    (relSec: number, shouldPlay: boolean = true) => {
      const currentActiveId = activeClipIdRef.current;
      const curClip = clipsRef.current.find((c) => c.id === currentActiveId);
      if (!curClip) return;
      const duration = curClip.end - curClip.start;
      if (duration <= 0) return;
      const currentSource = currentSourceUriRef.current;
      const isIndividualCutClip =
        currentSource.startsWith('file://') &&
        !currentSource.endsWith('/full.mp4') &&
        !currentSource.endsWith('/full_video.mp4') &&
        !currentSource.endsWith('/full_proxy.mp4');
      const clampedRel = Math.max(0, Math.min(duration, relSec));
      const targetTime = isIndividualCutClip ? clampedRel : curClip.start + clampedRel;
      const pct = (clampedRel / duration) * 100;
      progressAnim.stopAnimation();
      progressAnim.setValue(pct);
      setProgressPercent(pct);
      setCurrentClipTime(clampedRel);
      centralizedSeek(targetTime, shouldPlay);
    },
    [centralizedSeek, setProgressPercent, setCurrentClipTime, currentSourceUriRef, progressAnim]
  );

  // Hook 1: useClipData
  const {
    clips,
    setClips,
    activeClipId,
    setActiveClipId,
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

  // Hook 4: useClipTemplate
  const {
    templateConfig,
    isPortrait,
    handleUpdateContext,
    handleUpdateFacecam,
    handleUpdateMainVideo,
    handleUpdateWatermark,
  } = useClipTemplate({
    videoId,
    activeClip,
    isDownloaded: Boolean(activeClip && downloadedClips[activeClip.id]),
  });

  // Hook 5: useClipSubtitle
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
    templateConfig,
    onSeek: (timeSec) => handleSeekRelative(timeSec, true),
    onRateLimit: () => setCookiesModalVisible(true),
  });

  useEffect(() => {
    setActiveSubtitleTextRef.current = (text: string, fontSize: number = 14) => {
      setActiveSubtitleText(text);
      setActiveSubtitleFontSize(fontSize);
    };
  }, [setActiveSubtitleText]);

  const [activeEditorMode, setActiveEditorMode] = useState<EditorMode>(null);

  const [facecamLayout, setFacecamLayout] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [mainVideoLayout, setMainVideoLayout] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Layout style murni 16:9 yang menjamin buffer native ExoPlayer mempertahankan 100% frame 16:9 penuh
  const facecamVideoStyle = useMemo(() => {
    const zoom = Math.max(1.0, templateConfig.facecam.zoom || 2.0);
    const cropX = Math.max(0, Math.min(100, templateConfig.facecam.cropX ?? 50));
    const cropY = Math.max(0, Math.min(100, templateConfig.facecam.cropY ?? 50));
    const w = facecamLayout.width || 280;
    const h = facecamLayout.height || (w * 0.75);

    // Dimensi video 16:9 penuh agar native player tidak memotong gambar
    const baseVideoWidth = h * (16 / 9);
    const scaledWidth = baseVideoWidth * zoom;
    const scaledHeight = h * zoom;

    const maxShiftX = Math.max(0, (scaledWidth - w) / 2);
    const maxShiftY = Math.max(0, (scaledHeight - h) / 2);

    const left = (w - scaledWidth) / 2 + ((50 - cropX) / 50) * maxShiftX;
    const top = (h - scaledHeight) / 2 + ((50 - cropY) / 50) * maxShiftY;

    return {
      position: 'absolute' as const,
      width: scaledWidth,
      height: scaledHeight,
      left,
      top,
    };
  }, [templateConfig.facecam, facecamLayout]);

  const isFacecamActive = isPortrait && templateConfig.facecam.enabled;

  useEffect(() => {
    setIsFacecamActive(isFacecamActive);
  }, [isFacecamActive, setIsFacecamActive]);

  const mainVideoStyle = useMemo(() => {
    // Jika tidak dalam mode portrait (misal un-done stream atau facecam nonaktif), tampilkan 100% video standar
    if (!isPortrait) {
      return styles.fillVideo;
    }

    const zoom = Math.max(1.0, templateConfig.mainVideo.zoom || 1.0);
    const cropX = Math.max(0, Math.min(100, templateConfig.mainVideo.cropX ?? 50));
    const cropY = Math.max(0, Math.min(100, templateConfig.mainVideo.cropY ?? 50));
    const w = mainVideoLayout.width || 280;

    if (isFacecamActive) {
      // Saat facecam aktif: viewport gameplay berasio 4:3 (h = w * 0.75)
      // Video sumber tetap murni 16:9 dengan baseVideoWidth = h * (16 / 9)
      // Sisi kiri & kanan dipotong rapi via container overflow hidden tanpa mengubah aspek rasio asli video
      const h = mainVideoLayout.height || (w * 0.75);
      const baseVideoWidth = h * (16 / 9);
      const scaledWidth = baseVideoWidth * zoom;
      const scaledHeight = h * zoom;

      const maxShiftX = Math.max(0, (scaledWidth - w) / 2);
      const maxShiftY = Math.max(0, (scaledHeight - h) / 2);

      const left = (w - scaledWidth) / 2 + ((50 - cropX) / 50) * maxShiftX;
      const top = (h - scaledHeight) / 2 + ((50 - cropY) / 50) * maxShiftY;

      return {
        position: 'absolute' as const,
        width: scaledWidth,
        height: scaledHeight,
        left,
        top,
      };
    }

    // Default 16:9 di dalam mode portrait dengan banner konteks saja
    const h = mainVideoLayout.height || (w * (9 / 16));
    const scaledWidth = w * zoom;
    const scaledHeight = h * zoom;

    const maxShiftX = Math.max(0, (scaledWidth - w) / 2);
    const maxShiftY = Math.max(0, (scaledHeight - h) / 2);

    const left = (w - scaledWidth) / 2 + ((50 - cropX) / 50) * maxShiftX;
    const top = (h - scaledHeight) / 2 + ((50 - cropY) / 50) * maxShiftY;

    return {
      position: 'absolute' as const,
      width: scaledWidth,
      height: scaledHeight,
      left,
      top,
    };
  }, [isPortrait, isFacecamActive, templateConfig.mainVideo, mainVideoLayout]);

  useEffect(() => {
    setActiveEditorMode(null);
  }, [activeClip?.id]);

  useEffect(() => {
    setCookiesModalVisibleRef.current = setCookiesModalVisible;
  }, [setCookiesModalVisible]);

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
        onUpdateWatermark={handleUpdateWatermark}
        downloadProgressInfo={downloadProgress[activeClip.id]}
        visibleHeatmapCount={visibleHeatmapCount}
        onAddCustomPress={() => setIsCustomModalVisible(true)}
        onChangeVisibleCountPress={() => setIsVisibleCountModalVisible(true)}
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
        {/* UNIFIED CANVAS WRAPPER (9:16 Portrait saat Konteks/Facecam aktif, 16:9 Landscape saat nonaktif) */}
        <View
          style={[
            styles.canvasWrapper,
            isPortrait ? styles.canvasPortrait : styles.canvasLandscape,
          ]}
          collapsable={false}
        >
          {currentSourceUriRef.current || streamUrl || (activeClip.status === 'done' && downloadedClips[activeClip.id]) ? (
            <>
              {/* 1. Header Banner Konteks (Hanya saat mode portrait & diaktifkan) */}
              {isPortrait && templateConfig.context.enabled && (
                <View
                  style={[
                    styles.contextBannerBox,
                    {
                      paddingVertical: templateConfig.context.paddingY,
                      alignItems: templateConfig.context.align === 'center' ? 'center' : 'flex-start',
                      paddingHorizontal: templateConfig.context.align === 'center' ? 8 : 12,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.contextBannerText,
                      {
                        fontSize: templateConfig.context.fontSize,
                        textAlign: templateConfig.context.align === 'center' ? 'center' : 'left',
                      },
                    ]}
                    numberOfLines={3}
                  >
                    {templateConfig.context.text || 'JUDUL VIDEO'}
                  </Text>
                </View>
              )}

              {/* 2. Viewport Facecam (Hanya saat mode portrait & diaktifkan) */}
              {isPortrait && templateConfig.facecam.enabled && (
                <View
                  style={styles.facecamBox}
                  collapsable={false}
                  onLayout={(e) => {
                    const { width, height } = e.nativeEvent.layout;
                    if (width > 0 && height > 0) {
                      setFacecamLayout({ width, height });
                    }
                  }}
                >
                  <VideoView
                    style={facecamVideoStyle}
                    player={facecamPlayer}
                    contentFit="cover"
                    nativeControls={false}
                    surfaceType="textureView"
                  />
                </View>
              )}

              {/* 3. Viewport Main Video Gameplay (4:3 saat Facecam aktif, 16:9 saat Facecam nonaktif) */}
              {isPortrait && templateConfig.mainVideo.enabled === false ? (
                // Saat gameplay dinonaktifkan di mode portrait (Facecam Only), sembunyikan visual box namun pertahankan native player aktif di background untuk audio & clock
                <View style={{ width: 0, height: 0, opacity: 0 }} pointerEvents="none">
                  <VideoView
                    style={{ width: 1, height: 1 }}
                    player={player}
                    contentFit="cover"
                    nativeControls={false}
                    surfaceType="textureView"
                  />
                </View>
              ) : (
                <View
                  style={[
                    styles.mainVideoBox,
                    !isPortrait
                      ? styles.mainVideoBoxLandscape
                      : isFacecamActive
                      ? styles.mainVideoBox43
                      : styles.mainVideoBox169,
                  ]}
                  collapsable={false}
                  onLayout={(e) => {
                    const { width, height } = e.nativeEvent.layout;
                    if (width > 0 && height > 0) {
                      setMainVideoLayout({ width, height });
                    }
                  }}
                >
                  <VideoView
                    style={mainVideoStyle}
                    player={player}
                    contentFit="cover"
                    nativeControls={false}
                    surfaceType="textureView"
                  />
                </View>
              )}

              {/* Subtitle Overlay: Selalu dirender relatif terhadap Canvas Wrapper luar */}
              <SubtitleOverlay
                isVisible={isSubtitleVisible}
                subtitleText={activeSubtitleText}
                fontSize={activeSubtitleFontSize}
                positionX={subtitlePosition.x}
                positionY={subtitlePosition.y}
              />

              {/* Watermark Overlay: Selalu dirender relatif terhadap Canvas Wrapper luar */}
              {templateConfig.watermark?.enabled && Boolean(templateConfig.watermark?.text?.trim()) && (
                <WatermarkOverlay
                  text={templateConfig.watermark.text}
                  size={templateConfig.watermark.size}
                  x={templateConfig.watermark.x}
                  y={templateConfig.watermark.y}
                />
              )}
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
      </View>

      {/* 3. BOTTOM PLAYBACK CONTROLS (Fixed Height) */}
      <FeedPlaybackControls
        progressAnim={progressAnim}
        progressPercent={progressPercent}
        isContinueState={isContinueState}
        onScrubberPress={(e) => {
          const currentActiveId = activeClipIdRef.current || activeClipId;
          const currentActive = clipsRef.current.find((c) => c.id === currentActiveId) || activeClip;
          const duration = currentActive.end - currentActive.start;
          if (duration <= 0 || trackWidthRef.current <= 0) return;

          const currentSource = currentSourceUriRef.current;
          const isIndividualCutClip =
            currentSource.startsWith('file://') &&
            !currentSource.endsWith('/full.mp4') &&
            !currentSource.endsWith('/full_video.mp4') &&
            !currentSource.endsWith('/full_proxy.mp4');

          const locationX = e.nativeEvent.locationX;
          const pct = Math.max(0, Math.min(100, (locationX / trackWidthRef.current) * 100));
          const targetTime = isIndividualCutClip
            ? (pct / 100) * duration
            : currentActive.start + (pct / 100) * duration;

          progressAnim.stopAnimation();
          progressAnim.setValue(pct);
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

      {/* 5. Custom Range & Visible Count Modals */}
      <CustomRangeModal
        visible={isCustomModalVisible}
        currentPlaybackTime={isCustomModalVisible ? currentClipTime : 0}
        onClose={() => setIsCustomModalVisible(false)}
        onAddCustomRange={handleAddCustomClip}
      />

      <VisibleCountModal
        visible={isVisibleCountModalVisible}
        currentCount={visibleHeatmapCount}
        onClose={() => setIsVisibleCountModalVisible(false)}
        onApplyCount={(count: number) => {
          setVisibleHeatmapCount(count);
          setIsVisibleCountModalVisible(false);
        }}
      />

      {/* 6. Cookies Modal for Rate Limits */}
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
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  canvasWrapper: {
    backgroundColor: '#000000',
    overflow: 'hidden',
    position: 'relative',
    alignSelf: 'center',
    padding: 0,
    margin: 0,
  },
  canvasPortrait: {
    height: '100%',
    maxHeight: '100%',
    maxWidth: '100%',
    aspectRatio: 9 / 16,
    justifyContent: 'flex-start',
  },
  canvasLandscape: {
    width: '100%',
    maxHeight: '100%',
    maxWidth: '100%',
    aspectRatio: 16 / 9,
    justifyContent: 'center',
    alignItems: 'center',
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
    zIndex: 10,
  },
  mainVideoBox: {
    backgroundColor: '#000000',
    overflow: 'hidden',
    position: 'relative',
    zIndex: 5,
  },
  mainVideoBoxLandscape: {
    width: '100%',
    height: '100%',
  },
  mainVideoBox43: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  mainVideoBox169: {
    width: '100%',
    aspectRatio: 16 / 9,
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
