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
import * as FileSystem from 'expo-file-system/legacy';
import {
  ClipItem,
  downloadClip,
  getClipOutputFilePath,
  checkClipFileExists,
  isRateLimitOrRestrictedError,
  SubtitleCue,
  loadClipSubtitle,
} from '../services/api';
import { LocalStorage } from '../services/storage';
import { ToastManager } from './Toast';
import { CookiesModal } from './CookiesModal';
import { SubtitleEditModal } from './SubtitleEditModal';
import { FeedTopControls } from './feed/FeedTopControls';
import { FeedPlaybackControls } from './feed/FeedPlaybackControls';
import { FeedClipCarousel } from './feed/FeedClipCarousel';
import { SubtitleOverlay } from './feed/SubtitleOverlay';
import { formatTime } from './feed/timeUtils';
import { useClipData } from '../hooks/useClipData';
import { useClipPlayer } from '../hooks/useClipPlayer';

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

  const [downloadingClips, setDownloadingClips] = useState<Record<string, boolean>>({});
  const [downloadedClips, setDownloadedClips] = useState<Record<string, boolean>>({});
  const [downloadProgress, setDownloadProgress] = useState<
    Record<string, { stage: string; code: string; percent: number }>
  >({});
  const activeDownloadPollersRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const [cookiesModalVisible, setCookiesModalVisible] = useState(false);
  const [subtitleModalVisible, setSubtitleModalVisible] = useState(false);

  // State Subtitle & Overlay (Layer 1 Realtime Preview)
  const [subtitles, setSubtitles] = useState<SubtitleCue[]>([]);
  const [activeSubtitleText, setActiveSubtitleText] = useState<string>('');
  const [isSubtitleVisible, setIsSubtitleVisible] = useState<boolean>(true);
  const subtitlesRef = useRef<SubtitleCue[]>(subtitles);

  useEffect(() => {
    subtitlesRef.current = subtitles;
  }, [subtitles]);

  useEffect(() => {
    return () => {
      Object.values(activeDownloadPollersRef.current).forEach((intervalId) => clearInterval(intervalId));
    };
  }, []);

  const downloadedClipsRef = useRef<Record<string, boolean>>(downloadedClips);
  useEffect(() => {
    downloadedClipsRef.current = downloadedClips;
  }, [downloadedClips]);

  // Shared refs for data & player hooks
  const clipsRef = useRef<ClipItem[]>([]);
  const activeClipIdRef = useRef<string | null>(null);

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
    setCookiesModalVisible,
    onBack,
  });

  const getDownloadProgressLabel = (info?: { stage: string; code: string; percent: number }): string => {
    if (!info) return 'Proses...';
    const { stage, code, percent } = info;
    const pct = Math.max(0, Math.min(100, Math.round(percent)));

    switch (stage) {
      case 'STAGE_INIT':
        return 'Siap...';
      case 'STAGE_1_COPY':
        if (code === 'FETCHING_PLAYLIST') return 'Ambil...';
        return `Unduh ${pct}%`;
      case 'STAGE_2_CUT':
        if (code === 'STARTING_FFMPEG') return 'Potong 0%';
        return `Potong ${pct}%`;
      case 'STAGE_COMPLETE':
        return 'Selesai';
      default:
        return `${pct}%`;
    }
  };

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
    setDownloadedClips,
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

  // Deteksi keberadaan file video saat klip aktif berstatus 'done'
  useEffect(() => {
    if (activeClip && activeClip.status === 'done') {
      const { fileUri } = getClipOutputFilePath(videoId, activeClip.start, activeClip.end, activeClip.rank);
      checkClipFileExists(fileUri).then((exists) => {
        if (exists) {
          setDownloadedClips((prev) => ({ ...prev, [activeClip.id]: true }));
        }
      });
    }
  }, [activeClipId, activeClip.status, activeClip.start, activeClip.end, videoId]);

  // Download clip handler (Non-blocking background download dengan in-memory cache & progress polling)
  const handleDownloadClip = async () => {
    if (!activeClip || activeClip.status !== 'done') return;
    const clipId = activeClip.id;

    if (downloadedClips[clipId]) {
      ToastManager.show({
        type: 'info',
        title: 'Klip Sudah Ada',
        message: 'File klip video berkualitas penuh sudah terunduh di folder output.',
        duration: 2500,
      });
      return;
    }

    if (downloadingClips[clipId]) {
      ToastManager.show({
        type: 'info',
        title: 'Sedang Mengunduh',
        message: 'Klip sedang diproses di latar belakang...',
        duration: 2000,
      });
      return;
    }

    const progressFile = `${FileSystem.cacheDirectory}clip_progress_${clipId}.json`;
    const nativeProgressPath = progressFile.replace('file://', '');

    setDownloadingClips((prev) => ({ ...prev, [clipId]: true }));
    setDownloadProgress((prev) => ({
      ...prev,
      [clipId]: { stage: 'STAGE_INIT', code: 'PREPARING_METADATA', percent: 0 },
    }));

    // Polling realtime progress file setiap 300ms dari background Python engine
    let isFinished = false;
    const pollInterval = setInterval(async () => {
      if (isFinished) return;
      try {
        const info = await FileSystem.getInfoAsync(progressFile);
        if (info.exists) {
          const raw = await FileSystem.readAsStringAsync(progressFile);
          if (raw) {
            const data = JSON.parse(raw);
            if (data && data.stage) {
              setDownloadProgress((prev) => ({
                ...prev,
                [clipId]: {
                  stage: data.stage,
                  code: data.code,
                  percent: typeof data.percent === 'number' ? data.percent : 0,
                },
              }));
            }
          }
        }
      } catch (e) {
        // Abaikan sementara jika file sedang di-replace secara atomik oleh Python
      }
    }, 300);
    activeDownloadPollersRef.current[clipId] = pollInterval;

    ToastManager.show({
      type: 'info',
      title: 'Memulai Unduhan Klip',
      message: `Mengunduh Klip #${activeClip.rank || ''} (${formatTime(activeClip.start)} - ${formatTime(activeClip.end)})...`,
      duration: 3000,
    });

    try {
      const res = await downloadClip(videoId, activeClip.start, activeClip.end, activeClip.rank, nativeProgressPath);
      setDownloadingClips((prev) => ({ ...prev, [clipId]: false }));
      setDownloadedClips((prev) => ({ ...prev, [clipId]: true }));
      downloadedClipsRef.current[clipId] = true;

      // Update status klip menjadi 'done' dan simpan ke LocalStorage secara permanen
      const updated = clipsRef.current.map((c) => {
        if (c.id === clipId) {
          return { ...c, status: 'done' as const };
        }
        return c;
      });
      clipsRef.current = updated;
      setClips(updated);
      await LocalStorage.setItem(DRAFT_KEY, JSON.stringify(updated));
      const doneCount = updated.filter((c) => c.status === 'done').length;
      onUpdateWorkshopDone?.(videoId, doneCount);

      // Jika klip yang baru selesai diunduh adalah klip yang sedang aktif ditonton, langsung switch ke local playback
      const currentActiveId = activeClipIdRef.current || activeClipId;
      if (currentActiveId === clipId) {
        syncPlayerSourceForClip({ ...activeClip, status: 'done' }, true);
      }

      ToastManager.show({
        type: 'success',
        title: 'Klip Berhasil Diunduh',
        message: 'Tersimpan di storage & otomatis beralih memutar file lokal.',
        duration: 3500,
      });
    } catch (err: any) {
      setDownloadingClips((prev) => ({ ...prev, [clipId]: false }));
      if (isRateLimitOrRestrictedError(err) || err.code === 'COOKIES_INVALID_OR_EXPIRED') {
        setCookiesModalVisible(true);
      }
      const title = err.code === 'STORAGE_PERMISSION_DENIED'
        ? 'Izin Akses Penyimpanan Ditolak'
        : (err.code === 'COOKIES_INVALID_OR_EXPIRED'
          ? 'Cookies Tidak Valid / Kedaluwarsa'
          : (err.code === 'COOKIES_FILE_NOT_FOUND'
            ? 'File Cookies Tidak Ditemukan'
            : (err.code === 'RATE_LIMIT_EXCEEDED'
              ? 'Batas Permintaan YouTube (Mode Anonim)'
              : 'Gagal Mengunduh Klip')));

      ToastManager.show({
        type: 'error',
        title,
        message: err.message || 'Terjadi kesalahan saat mengunduh klip.',
        rawError: err.rawError,
        errorCode: err.code,
        duration: 5000,
      });
    } finally {
      isFinished = true;
      if (activeDownloadPollersRef.current[clipId]) {
        clearInterval(activeDownloadPollersRef.current[clipId]);
        delete activeDownloadPollersRef.current[clipId];
      }
      FileSystem.deleteAsync(progressFile, { idempotent: true }).catch(() => {});
      setDownloadProgress((prev) => {
        const next = { ...prev };
        delete next[clipId];
        return next;
      });
    }
  };



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
