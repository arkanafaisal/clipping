import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
  BackHandler,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  Trash2,
  CheckCircle2,
  Play,
  Pause,
  Rewind,
  FastForward,
  ChevronLeft,
  ChevronRight,
  Download,
  Subtitles,
} from 'lucide-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import {
  ClipItem,
  fetchStreamUrl,
  fetchHeatmap,
  downloadClip,
  getClipOutputFilePath,
  getClipFilename,
  formatTimeForFilename,
  resolvePlayableClipUri,
  checkClipFileExists,
  isRateLimitOrRestrictedError,
  SHARED_CLIPPING_OUTPUT_DIR,
  INTERNAL_CLIPPING_OUTPUT_DIR,
  SubtitleCue,
  loadClipSubtitle,
} from '../services/api';
import { LocalStorage } from '../services/storage';
import { ToastManager } from './Toast';
import { CookiesModal } from './CookiesModal';
import { SubtitleEditModal } from './SubtitleEditModal';

interface FeedScreenProps {
  videoId: string;
  initialCount?: number;
  onBack: () => void;
  onUpdateWorkshopDone?: (videoId: string, doneCount: number) => void;
}

function formatTime(seconds: number): string {
  if (seconds === undefined || seconds === null || isNaN(seconds)) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (num: number) => num.toString().padStart(2, '0');
  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

function formatTimeWithMs(seconds: number): string {
  if (seconds === undefined || seconds === null || isNaN(seconds)) return '00:00.000';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  const pad = (num: number, size: number = 2) => num.toString().padStart(size, '0');
  return `${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
}

interface ClipCardProps {
  id: string;
  rank: number;
  start: number;
  clipNumber: number;
  isActive: boolean;
  status: 'none' | 'done' | 'trash';
  onSelect: (id: string) => void;
}

/**
 * Komponen Card Klip ter-memoized 100%:
 * Mencegah re-render 50-100 kartu klip setiap kali progress bar bergerak (timeUpdate).
 * Menggunakan Pressable dengan delayPressIn={0} dan onPressIn agar merespons instan 0ms saat disentuh.
 */
const ClipCardItem = React.memo<ClipCardProps>(
  ({ id, rank, start, clipNumber, isActive, status, onSelect }) => {
    const isDone = status === 'done';
    const isTrash = status === 'trash';

    return (
      <Pressable
        style={({ pressed }) => [
          styles.clipCard,
          isDone && styles.clipCardDone,
          isTrash && styles.clipCardTrash,
          isActive && styles.clipCardActive,
          pressed && { opacity: 0.75 },
        ]}
        onPress={() => onSelect(id)}
      >
        {/* Rank Badge */}
        <View style={[styles.rankBadge, isTrash && styles.rankBadgeTrash]}>
          <Text style={styles.rankBadgeText}>#{rank || clipNumber}</Text>
        </View>

        <Text style={[styles.clipCardTitle, isTrash && styles.clipCardTitleTrash]}>
          KLIP {clipNumber}
        </Text>
        <Text style={styles.clipCardTime}>{formatTime(start)}</Text>
      </Pressable>
    );
  },
  (prev, next) =>
    prev.id === next.id &&
    prev.isActive === next.isActive &&
    prev.status === next.status &&
    prev.start === next.start &&
    prev.rank === next.rank
);

export const FeedScreen: React.FC<FeedScreenProps> = ({
  videoId,
  initialCount = 50,
  onBack,
  onUpdateWorkshopDone,
}) => {
  const DRAFT_KEY = `clips_draft_${videoId}`;

  const [clips, setClips] = useState<ClipItem[]>([]);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Memuat data klip...');

  // Manual play/pause button state (decoupled from automated seek/freeze/loop events)
  const [isContinueState, setIsContinueState] = useState<boolean>(true);
  const [progressPercent, setProgressPercent] = useState(0);
  const [currentClipTime, setCurrentClipTime] = useState<number>(0);
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

  // Debounce refs for smooth, leak-proof UI adjustments & storage sync
  const seekDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekSafetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSeekTargetRef = useRef<number | null>(null);
  const trackWidthRef = useRef<number>(1);
  const storageDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clipsRef = useRef<ClipItem[]>(clips);
  const activeClipIdRef = useRef<string | null>(activeClipId);
  const currentSourceUriRef = useRef<string>('');
  const downloadedClipsRef = useRef<Record<string, boolean>>(downloadedClips);
  const isContinueStateRef = useRef<boolean>(isContinueState);
  const streamUrlRef = useRef<string | null>(streamUrl);
  const isSourceSwitchingRef = useRef<boolean>(false);

  useEffect(() => {
    clipsRef.current = clips;
  }, [clips]);

  useEffect(() => {
    activeClipIdRef.current = activeClipId;
  }, [activeClipId]);

  useEffect(() => {
    downloadedClipsRef.current = downloadedClips;
  }, [downloadedClips]);

  useEffect(() => {
    isContinueStateRef.current = isContinueState;
  }, [isContinueState]);

  useEffect(() => {
    streamUrlRef.current = streamUrl;
  }, [streamUrl]);

  // Active clip reference
  const activeClip = clips.find((c) => c.id === activeClipId) || clips[0] || {
    id: 'temp',
    rank: 1,
    videoId,
    start: 0,
    end: 15,
    status: 'none',
  };

  // Video Player instance via expo-video (100ms interval for smooth millisecond UI)
  // Gunakan null agar player instance stabil dan tidak di-recreate berulang kali saat streamUrl terisi
  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.1;
  });

  // Helper untuk lock seek target dan auto-release safety timeout
  const setPendingSeek = useCallback((targetTime: number) => {
    pendingSeekTargetRef.current = targetTime;
    if (seekSafetyTimeoutRef.current) {
      clearTimeout(seekSafetyTimeoutRef.current);
    }
    seekSafetyTimeoutRef.current = setTimeout(() => {
      if (pendingSeekTargetRef.current === targetTime) {
        pendingSeekTargetRef.current = null;
      }
    }, 1500);
  }, []);

  // Handle Android hardware back button (No on-screen back button)
  useEffect(() => {
    const backAction = () => {
      onBack();
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [onBack]);

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      if (seekDebounceTimerRef.current) clearTimeout(seekDebounceTimerRef.current);
      if (seekSafetyTimeoutRef.current) clearTimeout(seekSafetyTimeoutRef.current);
      if (storageDebounceTimerRef.current) clearTimeout(storageDebounceTimerRef.current);
    };
  }, []);

  // 1. Load Real Clips from Local Storage
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);
        const savedDraft = await LocalStorage.getItem(DRAFT_KEY);

        let loadedClips: ClipItem[] = [];
        if (savedDraft) {
          try {
            const parsed: ClipItem[] = JSON.parse(savedDraft);
            if (Array.isArray(parsed) && parsed.length > 0) {
              loadedClips = parsed.map((c: any, idx: number) => ({ ...c, rank: c.rank || idx + 1 }));
            }
          } catch (e) {}
        }

        if (loadedClips.length === 0) {
          setLoadingMessage('Mengekstrak Heatmap AI (Bisa memakan waktu belasan detik)...');
          const heatmapData = await fetchHeatmap(videoId, initialCount, 5);
          loadedClips = heatmapData.clips.map((c: any, idx: number) => ({
            ...c,
            status: 'none' as const,
            rank: c.rank || idx + 1,
          }));
          await LocalStorage.setItem(DRAFT_KEY, JSON.stringify(loadedClips));
        }

        let firstClipStart = 0;
        let initialActiveClip: ClipItem | null = null;
        if (isMounted) {
          setClips(loadedClips);
          const initialVisible = [...loadedClips].sort((a, b) => a.start - b.start);
          if (initialVisible.length > 0) {
            initialActiveClip = initialVisible[0];
            setActiveClipId(initialVisible[0].id);
            firstClipStart = initialVisible[0].start;
          }
          setLoading(false);
        }

        // Pre-scan keberadaan file klip di shared dan internal sandbox storage untuk SEMUA klip
        const existingDownloadMap: Record<string, boolean> = {};
        let hasNewDone = false;

        const videoDirUri = `file://${SHARED_CLIPPING_OUTPUT_DIR}/${videoId}`;
        const internalVideoDirUri = `file://${INTERNAL_CLIPPING_OUTPUT_DIR}/${videoId}`;
        let dirFiles: string[] = [];
        try {
          const dirInfo = await FileSystem.getInfoAsync(videoDirUri);
          if (dirInfo.exists && dirInfo.isDirectory) {
            dirFiles = await FileSystem.readDirectoryAsync(videoDirUri);
          }
        } catch {}
        try {
          const internalDirInfo = await FileSystem.getInfoAsync(internalVideoDirUri);
          if (internalDirInfo.exists && internalDirInfo.isDirectory) {
            const internalFiles = await FileSystem.readDirectoryAsync(internalVideoDirUri);
            dirFiles = [...dirFiles, ...internalFiles];
          }
        } catch {}

        for (let i = 0; i < loadedClips.length; i++) {
          const clip = loadedClips[i];
          const filename = getClipFilename(clip.start, clip.end);
          const startStr = Math.round(clip.start).toString();
          const endStr = Math.round(clip.end).toString();
          const startFormatted = formatTimeForFilename(clip.start);
          const endFormatted = formatTimeForFilename(clip.end);

          // 1. Pencocokan nama file di direktori (Format baru: "00.12 - 01.35.mp4", atau format lama)
          const fileMatchInDir = dirFiles.find((f) => {
            if (!f.endsWith('.mp4')) return false;
            if (f === filename || (f.includes(startFormatted) && f.includes(endFormatted))) {
              return true;
            }
            return f.includes(`_${startStr}_${endStr}.mp4`);
          });

          let exists = false;
          if (fileMatchInDir) {
            exists = true;
          } else {
            // 2. Pencocokan langsung format baru & fallback
            const { fileUri } = getClipOutputFilePath(videoId, clip.start, clip.end, clip.rank);
            exists = await checkClipFileExists(fileUri);
            if (!exists) {
              const legacyUri = await resolvePlayableClipUri(videoId, clip.start, clip.end, clip.rank);
              exists = await checkClipFileExists(legacyUri);
            }
          }

          if (exists) {
            existingDownloadMap[clip.id] = true;
            if (clip.status !== 'done') {
              loadedClips[i] = { ...clip, status: 'done' };
              hasNewDone = true;
            }
          }
        }

        if (hasNewDone) {
          await LocalStorage.setItem(DRAFT_KEY, JSON.stringify(loadedClips));
          onUpdateWorkshopDone?.(videoId, loadedClips.filter((c) => c.status === 'done').length);
        }

        if (isMounted) {
          setClips([...loadedClips]);
          clipsRef.current = loadedClips;
          setDownloadedClips(existingDownloadMap);
          downloadedClipsRef.current = existingDownloadMap;
        }

        // 2. Fetch direct stream URL untuk video playback
        try {
          const directUrl = await fetchStreamUrl(videoId);
          if (isMounted && directUrl) {
            setStreamUrl(directUrl);
            streamUrlRef.current = directUrl;
            const isFirstClipLocal = Boolean(
              initialActiveClip &&
                initialActiveClip.status === 'done' &&
                existingDownloadMap[initialActiveClip.id]
            );

            if (isFirstClipLocal && initialActiveClip) {
              const { fileUri } = getClipOutputFilePath(
                videoId,
                initialActiveClip.start,
                initialActiveClip.end,
                initialActiveClip.rank
              );
              currentSourceUriRef.current = fileUri;
              setPendingSeek(0);
              isSourceSwitchingRef.current = true;
              player.replace(fileUri);
              try {
                player.currentTime = 0;
                player.play();
              } catch (playErr) {
                console.log('[Feed] Auto-play initial local clip error:', playErr);
              }
              ToastManager.show({
                type: 'success',
                title: 'Memutar File Lokal',
                message: 'Memutar video klip berkualitas prime dari HP.',
                duration: 2500,
              });
            } else {
              currentSourceUriRef.current = directUrl;
              setPendingSeek(firstClipStart);
              isSourceSwitchingRef.current = true;
              player.replace(directUrl);
              // AUTO PLAY: Mulai putar langsung dari posisi start klip pertama
              try {
                player.currentTime = firstClipStart;
                player.play();
              } catch (playErr) {
                console.log('[Feed] Auto-play initial clip error:', playErr);
              }
              ToastManager.show({
                type: 'success',
                title: 'Stream URL Aktif',
                message: 'Pemutar video siap.',
                duration: 2500,
              });
            }
          }
        } catch (streamErr: any) {
          console.warn('[Feed] Stream fetch error:', streamErr.message);
          if (isRateLimitOrRestrictedError(streamErr)) {
            setCookiesModalVisible(true);
          }
          ToastManager.show({
            type: 'info',
            title: 'Stream Belum Siap',
            message: streamErr.message || 'Stream URL tidak dapat dimuat.',
            rawError: streamErr.rawError,
            errorCode: streamErr.code,
            duration: 4000,
          });
        }
      } catch (err: any) {
        if (isMounted) {
          setLoading(false);
          ToastManager.show({
            type: 'error',
            title: 'Gagal Membuka Workshop',
            message: err.message || 'Gagal memuat data workshop.',
            rawError: err.rawError || err.stack || err.message,
            errorCode: err.code || 'LOAD_ERROR',
            duration: 6000,
          });
          onBack();
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [videoId]);

  // Save changes to storage whenever clips change (debounced 400ms to avoid disk thrashing)
  useEffect(() => {
    if (clips.length > 0) {
      if (storageDebounceTimerRef.current) {
        clearTimeout(storageDebounceTimerRef.current);
      }
      storageDebounceTimerRef.current = setTimeout(() => {
        LocalStorage.setItem(DRAFT_KEY, JSON.stringify(clips));
        const doneCount = clips.filter((c) => c.status === 'done').length;
        onUpdateWorkshopDone?.(videoId, doneCount);
      }, 400);
    }
  }, [clips]);

  /**
   * Sinkronisasi sumber pemutar video secara dinamis:
   * - Mode Lokal: Jika klip berstatus 'done' dan file fisik MP4 sudah terunduh di HP,
   *   putar file fisik lokal (file://...) dari detik 0.0s s/d durasi klip.
   * - Mode Stream: Jika klip belum 'done' (atau 'done' tapi belum diunduh),
   *   putar direct stream online YouTube dan seek ke detik clip.start.
   */
  const syncPlayerSourceForClip = useCallback(
    async (clip: ClipItem, autoPlay: boolean = true) => {
      if (!player) return;
      const isDownloaded = Boolean(downloadedClipsRef.current[clip.id]);
      const isLocalMode = clip.status === 'done' && isDownloaded;
      const targetTime = isLocalMode ? 0 : Math.max(0, clip.start);

      // Kunci target seek agar timeUpdate tidak menimpa UI sebelum player tiba di target
      setPendingSeek(targetTime);

      if (isLocalMode) {
        const fileUri = await resolvePlayableClipUri(videoId, clip.start, clip.end, clip.rank);
        if (currentSourceUriRef.current !== fileUri) {
          currentSourceUriRef.current = fileUri;
          isSourceSwitchingRef.current = true;
          try {
            player.replace(fileUri);
          } catch (err) {
            console.warn('[Feed] Replace local file error:', err);
          }
        } else {
          // File lokal sama: seek langsung ke 0
          try {
            player.currentTime = 0;
            if (autoPlay && isContinueStateRef.current) {
              player.play();
            }
          } catch (err) {
            console.warn('[Feed] Play local error:', err);
          }
        }
      } else {
        const activeStream = streamUrlRef.current;
        if (activeStream && currentSourceUriRef.current !== activeStream) {
          currentSourceUriRef.current = activeStream;
          isSourceSwitchingRef.current = true;
          try {
            player.replace(activeStream);
          } catch (err) {
            console.warn('[Feed] Replace stream error:', err);
          }
        } else {
          // Stream sama: seek langsung ke start klip
          try {
            player.currentTime = targetTime;
            if (autoPlay && isContinueStateRef.current) {
              player.play();
            }
          } catch (err) {
            console.warn('[Feed] Play stream error:', err);
          }
        }
      }
    },
    [player, videoId, setPendingSeek]
  );

  /**
   * Centralized universal debounced seek handler:
   * Menampung SEMUA seek (crop, extend, skip waktu, tap scrubber) ke dalam 1 gerbang terpusat.
   * Debounce trailing edge: 500ms sejak interaksi TERAKHIR user.
   * UI (progress bar, angka rentang, active card) langsung di-update secara instan 0ms tanpa animasi/delay.
   */
  const centralizedSeek = useCallback((targetTime: number, shouldPlay: boolean = true) => {
    setPendingSeek(targetTime);

    // Auto-pause video seketika jika sedang berputar agar frame lama freeze (tanpa mengubah state tombol)
    if (player && player.playing) {
      try {
        player.pause();
      } catch (e) {}
    }

    if (seekDebounceTimerRef.current) {
      clearTimeout(seekDebounceTimerRef.current);
    }

    // Jika memutar file lokal fisik (file://), matikan debounce (seek instan 0ms)
    // karena file disk lokal tidak terkena rate limit YouTube
    const isLocalMode = currentSourceUriRef.current.startsWith('file://');
    const debounceMs = isLocalMode ? 0 : 500;

    const executeSeek = () => {
      const finalTarget = pendingSeekTargetRef.current;
      if (player && finalTarget !== null && !isNaN(finalTarget)) {
        try {
          player.currentTime = Math.max(0, finalTarget);
          if (shouldPlay && isContinueStateRef.current) {
            player.play();
          }
        } catch (e: any) {
          ToastManager.show({
            type: 'error',
            title: 'Gagal Memindahkan Pemutar',
            message: e?.message || 'Player gagal melakukan seek ke durasi target.',
            duration: 3500,
          });
        }
      }
      seekDebounceTimerRef.current = null;
    };

    if (debounceMs === 0) {
      executeSeek();
    } else {
      seekDebounceTimerRef.current = setTimeout(executeSeek, debounceMs);
    }
  }, [player, setPendingSeek]);

  // Track playback time update & handle segment loop
  useEffect(() => {
    if (!player) return;

    const sub = player.addListener('timeUpdate', (event) => {
      const currentActiveId = activeClipIdRef.current || activeClipId;
      const currentActive = clipsRef.current.find((c) => c.id === currentActiveId) || activeClip;
      const isLocalMode = currentSourceUriRef.current.startsWith('file://');

      const current = event.currentTime;
      const duration = currentActive.end - currentActive.start;

      // Cek apakah player sedang dalam proses seek menuju targetTime
      if (pendingSeekTargetRef.current !== null) {
        const diff = Math.abs(current - pendingSeekTargetRef.current);
        if (diff < 1.0) {
          // Player sudah tiba di sekitar target seek, buka kembali kunci update UI
          pendingSeekTargetRef.current = null;
        } else {
          // Masih dalam transisi seek: jangan biarkan frame lama menimpa progress UI atau mentrigger loop
          return;
        }
      }

      if (duration > 0) {
        if (isLocalMode) {
          const pct = Math.max(0, Math.min(100, (current / duration) * 100));
          setProgressPercent(pct);
          setCurrentClipTime(Math.max(0, Math.min(duration, current)));
        } else {
          const pct = Math.max(0, Math.min(100, ((current - currentActive.start) / duration) * 100));
          setProgressPercent(pct);
          const rel = Math.max(0, Math.min(duration, current - currentActive.start));
          setCurrentClipTime(rel);
        }

        // Sinkronisasi teks subtitle secara realtime dengan frame video
        const currentRel = isLocalMode
          ? Math.max(0, Math.min(duration, current))
          : Math.max(0, Math.min(duration, current - currentActive.start));

        if (subtitlesRef.current.length > 0) {
          const matchCue = subtitlesRef.current.find(
            (c) => currentRel >= c.start && currentRel <= c.end
          );
          setActiveSubtitleText(matchCue ? matchCue.text : '');
        } else {
          setActiveSubtitleText('');
        }
      }

      // Loop current segment & boundary enforcement
      if (isLocalMode) {
        if (current >= duration) {
          player.currentTime = 0;
          if (isContinueStateRef.current) {
            player.play();
          }
        }
      } else {
        // Enforce boundary klip stream:
        // 1. Loop jika mencapai batas akhir klip (current >= end)
        // 2. Koreksi seketika jika video meleset atau nyangkut di luar rentang klip (misal detik nol: current < start - 0.5s)
        if (current >= currentActive.end || current < currentActive.start - 0.5) {
          player.currentTime = currentActive.start;
          if (isContinueStateRef.current) {
            player.play();
          }
        }
      }
    });

    const statusSub = player.addListener('statusChange', async () => {
      if (player.status === 'readyToPlay') {
        // HANYA snap posisi jika sedang terjadi pergantian media source (player.replace),
        // JANGAN snap pada seek biasa (crop/extend/skip/scrubber) agar posisi seek user tidak tertimpa ke awal klip!
        if (isSourceSwitchingRef.current) {
          isSourceSwitchingRef.current = false;
          const currentActiveId = activeClipIdRef.current || activeClipId;
          const currentActive = clipsRef.current.find((c) => c.id === currentActiveId) || activeClip;
          const isLocalMode = currentSourceUriRef.current.startsWith('file://');
          const targetTime =
            pendingSeekTargetRef.current !== null
              ? pendingSeekTargetRef.current
              : isLocalMode
              ? 0
              : Math.max(0, currentActive.start);

          if (Math.abs(player.currentTime - targetTime) > 0.5) {
            try {
              player.currentTime = targetTime;
            } catch (e) {}
          }
          if (isContinueStateRef.current && !player.playing) {
            try {
              player.play();
            } catch (e) {}
          }
        }
        return;
      }

      if (player.status === 'error') {
        const isLocalMode = currentSourceUriRef.current.startsWith('file://');
        if (isLocalMode) {
          console.warn('[Feed] Local file playback error, falling back to stream...');
          const activeStream = streamUrlRef.current;
          if (activeStream) {
            currentSourceUriRef.current = activeStream;
            setPendingSeek(activeClip.start);
            isSourceSwitchingRef.current = true;
            player.replace(activeStream);
            player.currentTime = activeClip.start;
            if (isContinueStateRef.current) {
              player.play();
            }
          }
          return;
        }

        console.warn('[Feed] Player error detected, stream URL mungkin kadaluwarsa. Mengambil URL baru...');
        try {
          const freshUrl = await fetchStreamUrl(videoId, true); // forceRefresh = true
          if (freshUrl) {
            setStreamUrl(freshUrl);
            streamUrlRef.current = freshUrl;
            currentSourceUriRef.current = freshUrl;
            setPendingSeek(activeClip.start);
            isSourceSwitchingRef.current = true;
            player.replace(freshUrl);
            player.currentTime = activeClip.start;
            if (isContinueStateRef.current) {
              player.play();
            }
          }
        } catch (e: any) {
          if (isRateLimitOrRestrictedError(e)) {
            setCookiesModalVisible(true);
          }
          ToastManager.show({
            type: 'error',
            title: 'Gagal Memperbarui Stream',
            message: e?.message || 'Server gagal me-refresh stream video.',
            rawError: e?.rawError,
            errorCode: e?.code,
            duration: 4000,
          });
        }
      }
    });

    return () => {
      sub.remove();
      statusSub.remove();
    };
  }, [player, videoId, setPendingSeek]);

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

  // Extend & Crop Handlers:
  // - UI langsung ter-update secara instan 0ms tanpa animasi/delay
  // - Menggunakan clipsRef.current secara sinkron sehingga tidak terkena stale closure saat multi-klik cepat
  // - Seek video terpusat dieksekusi 1x setelah user berhenti menekan tombol (debounce 500ms trailing)
  const handleUpdateStart = (delta: number) => {
    const currentActiveId = activeClipIdRef.current || activeClipId;
    let targetStart = 0;
    const updated = clipsRef.current.map((c) => {
      if (c.id === currentActiveId) {
        targetStart = Math.max(0, Math.min(c.start + delta, c.end - 1));
        return { ...c, start: targetStart };
      }
      return c;
    });
    clipsRef.current = updated;
    setClips(updated);

    // Optimistic progress bar: langsung snap ke posisi awal klip (0%) seketika
    setProgressPercent(0);
    setCurrentClipTime(0);
    centralizedSeek(targetStart, true);
  };

  const handleUpdateEnd = (delta: number) => {
    const currentActiveId = activeClipIdRef.current || activeClipId;
    let targetSeek = 0;
    let newEnd = 0;
    const updated = clipsRef.current.map((c) => {
      if (c.id === currentActiveId) {
        newEnd = Math.max(c.start + 1, c.end + delta);
        targetSeek = Math.max(c.start, newEnd - 3);
        return { ...c, end: newEnd };
      }
      return c;
    });
    clipsRef.current = updated;
    setClips(updated);

    // Optimistic progress bar: langsung snap ke posisi preview akhir seketika tanpa delay
    const active = updated.find((c) => c.id === currentActiveId);
    if (active && active.end > active.start) {
      const pct = Math.max(0, Math.min(100, ((targetSeek - active.start) / (active.end - active.start)) * 100));
      setProgressPercent(pct);
      const rel = Math.max(0, Math.min(active.end - active.start, targetSeek - active.start));
      setCurrentClipTime(rel);
    }

    centralizedSeek(targetSeek, true);
  };

  // Switch klip langsung instan (tanpa debounce) khusus carousel klip
  const handleSelectClip = useCallback(
    (clipId: string) => {
      // Batalkan debounce seek yang mungkin sedang berjalan dari scrubber/crop
      if (seekDebounceTimerRef.current) {
        clearTimeout(seekDebounceTimerRef.current);
        seekDebounceTimerRef.current = null;
      }

      activeClipIdRef.current = clipId;
      setActiveClipId(clipId);
      // Optimistic: Progress bar seketika langsung balik ke 0
      setProgressPercent(0);
      setCurrentClipTime(0);

      const targetClip = clipsRef.current.find((c) => c.id === clipId);
      if (!targetClip) return;

      // Pindahkan playback sumber secara dinamis (Lokal vs Stream) dan lakukan seek seketika
      syncPlayerSourceForClip(targetClip, true);
    },
    [syncPlayerSourceForClip]
  );

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

  // Toggle clip Done status (hijau)
  const handleToggleDone = async () => {
    const currentActiveId = activeClipIdRef.current || activeClipId;
    let nextStatus: 'none' | 'done' = 'done';
    let targetClip: ClipItem | undefined;
    const updated = clipsRef.current.map((c) => {
      if (c.id === currentActiveId) {
        nextStatus = (c.status === 'done' ? 'none' : 'done') as 'none' | 'done';
        targetClip = { ...c, status: nextStatus };
        return targetClip;
      }
      return c;
    });
    clipsRef.current = updated;
    setClips(updated);

    if (!targetClip) return;

    // Jika berubah jadi done, cek apakah filenya sudah pernah diunduh
    if (nextStatus === 'done') {
      const { fileUri } = getClipOutputFilePath(videoId, targetClip.start, targetClip.end, targetClip.rank);
      const exists = await checkClipFileExists(fileUri);
      if (exists) {
        setDownloadedClips((prev) => ({ ...prev, [targetClip!.id]: true }));
        downloadedClipsRef.current[targetClip.id] = true;
        syncPlayerSourceForClip(targetClip, true);
        ToastManager.show({
          type: 'success',
          title: 'Memutar File Lokal',
          message: 'Klip telah terunduh, beralih ke video lokal offline.',
          duration: 2500,
        });
      }
    } else {
      // Jika di-toggle off dari done ke none, kembali ke stream YouTube jika sebelumnya memutar file lokal
      if (currentSourceUriRef.current.startsWith('file://')) {
        syncPlayerSourceForClip(targetClip, true);
        ToastManager.show({
          type: 'info',
          title: 'Mode Stream',
          message: 'Beralih kembali ke streaming YouTube.',
          duration: 2000,
        });
      }
    }
  };

  // Toggle clip Trash/Skip status (merah)
  const handleToggleTrash = () => {
    const currentActiveId = activeClipIdRef.current || activeClipId;
    const updated = clipsRef.current.map((c) => {
      if (c.id === currentActiveId) {
        const nextStatus = (c.status === 'trash' ? 'none' : 'trash') as 'none' | 'trash';
        return { ...c, status: nextStatus };
      }
      return c;
    });
    clipsRef.current = updated;
    setClips(updated);
  };

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

  // Playback Control Handlers (Force manual control terisolasi dari auto-seek/auto-play)
  const togglePlayPause = () => {
    if (!player) return;
    if (isContinueState) {
      // Pindah dari continue ke pause: force pause jika video sedang berputar
      setIsContinueState(false);
      if (player.playing) {
        try {
          player.pause();
        } catch (e) {}
      }
    } else {
      // Pindah dari pause ke continue: force play jika video sedang berhenti
      setIsContinueState(true);
      if (!player.playing) {
        try {
          player.play();
        } catch (e) {}
      }
    }
  };

  const skipSeconds = (seconds: number) => {
    const currentActiveId = activeClipIdRef.current || activeClipId;
    const currentActive = clipsRef.current.find((c) => c.id === currentActiveId) || activeClip;
    const isLocalMode = currentSourceUriRef.current.startsWith('file://');
    const duration = currentActive.end - currentActive.start;

    if (isLocalMode) {
      const baseTime =
        pendingSeekTargetRef.current !== null
          ? pendingSeekTargetRef.current
          : player
          ? player.currentTime
          : 0;

      const nextTime = Math.max(0, Math.min(Math.max(0, duration - 0.2), baseTime + seconds));
      if (duration > 0) {
        const pct = Math.max(0, Math.min(100, (nextTime / duration) * 100));
        setProgressPercent(pct);
        setCurrentClipTime(nextTime);
      }
      centralizedSeek(nextTime, true);
    } else {
      const baseTime =
        pendingSeekTargetRef.current !== null
          ? pendingSeekTargetRef.current
          : player
          ? player.currentTime
          : currentActive.start;

      let nextTime = baseTime + seconds;
      if (nextTime < currentActive.start) nextTime = currentActive.start;
      if (nextTime >= currentActive.end) nextTime = Math.max(currentActive.start, currentActive.end - 0.2);

      if (duration > 0) {
        const pct = Math.max(0, Math.min(100, ((nextTime - currentActive.start) / duration) * 100));
        setProgressPercent(pct);
        const rel = Math.max(0, Math.min(duration, nextTime - currentActive.start));
        setCurrentClipTime(rel);
      }
      centralizedSeek(nextTime, true);
    }
  };

  // Group clips into pairs (columns of 2 rows) sorted chronologically (memoized agar tidak di-recompute setiap tick)
  const sortedClips = useMemo(() => [...clips].sort((a, b) => a.start - b.start), [clips]);
  const clipColumns = useMemo(() => {
    const cols: ClipItem[][] = [];
    for (let i = 0; i < sortedClips.length; i += 2) {
      cols.push(sortedClips.slice(i, i + 2));
    }
    return cols;
  }, [sortedClips]);

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
      {/* 1. TOP CONTROLS */}
      <View style={styles.topSection}>
        <View style={styles.timeRangeRow}>
          {/* SISI KIRI: Jika Mode Done -> Tombol Unduh, Jika Mode Normal -> Tombol Trash */}
          <View style={styles.leftActionGroup}>
            {activeClip.status === 'done' ? (
              <>
                {!downloadedClips[activeClip.id] ? (
                  /* Mode Belum Terdownload: Tampilkan Tombol Download */
                  <Pressable
                    style={({ pressed }) => [
                      styles.statusBtn,
                      styles.downloadBtn,
                      Boolean(downloadingClips[activeClip.id]) && styles.downloadBtnActive,
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={handleDownloadClip}
                    disabled={Boolean(downloadingClips[activeClip.id])}
                  >
                    {downloadingClips[activeClip.id] ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <ActivityIndicator size="small" color="#38bdf8" />
                        <Text style={styles.downloadProgressText}>
                          {getDownloadProgressLabel(downloadProgress[activeClip.id])}
                        </Text>
                      </View>
                    ) : (
                      <Download size={18} color="#38bdf8" />
                    )}
                  </Pressable>
                ) : (
                  /* Mode Sudah Terdownload: Tombol Download disembunyikan, diganti Tombol Subtitle */
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.statusBtn,
                        styles.subtitleBtn,
                        subtitles.length > 0 && styles.subtitleBtnActive,
                        pressed && { opacity: 0.7 },
                      ]}
                      onPress={() => setSubtitleModalVisible(true)}
                    >
                      <Subtitles size={18} color={subtitles.length > 0 ? '#38bdf8' : '#94a3b8'} />
                    </Pressable>

                    {/* Tombol Toggle CC Overlay (jika subtitle sudah tersedia) */}
                    {subtitles.length > 0 && (
                      <Pressable
                        style={({ pressed }) => [
                          styles.statusBtn,
                          styles.subtitleToggleBtn,
                          isSubtitleVisible && styles.subtitleToggleBtnActive,
                          pressed && { opacity: 0.7 },
                        ]}
                        onPress={() => setIsSubtitleVisible((prev) => !prev)}
                      >
                        <Text
                          style={[
                            styles.subtitleBtnText,
                            isSubtitleVisible && { color: '#38bdf8' },
                          ]}
                        >
                          CC
                        </Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.statusBtn,
                  activeClip.status === 'trash' ? styles.trashBtnActive : styles.trashBtnInactive,
                  pressed && { opacity: 0.7 },
                ]}
                onPressIn={handleToggleTrash}
              >
                <Trash2
                  size={18}
                  color={activeClip.status === 'trash' ? '#ffffff' : '#f87171'}
                />
              </Pressable>
            )}
          </View>

          {/* SISI TENGAH: Jika Mode Done -> Durasi realtime presisi ms, Jika Normal -> Rentang Waktu */}
          <View style={styles.centerTimeWrapper} pointerEvents="box-none">
            {activeClip.status === 'done' ? (
              <View style={styles.timeDisplay}>
                <Text style={[styles.timeNumberText, styles.timeMsText]}>
                  {formatTimeWithMs(currentClipTime)}
                </Text>
                <Text style={styles.timeSeparatorText}>/</Text>
                <Text style={[styles.timeNumberText, styles.timeMsText, styles.timeMsDim]}>
                  {formatTimeWithMs(activeClip.end - activeClip.start)}
                </Text>
              </View>
            ) : (
              <View style={styles.timeDisplay}>
                <Text style={styles.timeNumberText}>{formatTime(activeClip.start)}</Text>
                <Text style={styles.timeSeparatorText}>-</Text>
                <Text style={styles.timeNumberText}>{formatTime(activeClip.end)}</Text>
              </View>
            )}
          </View>

          {/* SISI KANAN: Tombol Done (Tetap ada, jika diklik mengembalikan mode ke normal) */}
          <View style={styles.rightActionGroup}>
            <Pressable
              style={({ pressed }) => [
                styles.statusBtn,
                activeClip.status === 'done' ? styles.doneBtnActive : styles.doneBtnInactive,
                pressed && { opacity: 0.7 },
              ]}
              onPressIn={handleToggleDone}
            >
              <CheckCircle2
                size={18}
                color={activeClip.status === 'done' ? '#ffffff' : '#34d399'}
              />
            </Pressable>
          </View>
        </View>

        {/* Baris Extend & Crop HANYA muncul saat klip belum berstatus 'done' */}
        {activeClip.status !== 'done' && (
          <>
            {/* Row 2: Extend Row (Emerald) */}
            <View style={styles.extendRow}>
              <View style={styles.fineTuneGroup}>
                <Pressable
                  style={({ pressed }) => [styles.extendBtn, pressed && { opacity: 0.6 }]}
                  onPressIn={() => handleUpdateStart(-5)}
                >
                  <Text style={styles.extendBtnText}>+5</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.extendBtn, pressed && { opacity: 0.6 }]}
                  onPressIn={() => handleUpdateStart(-1)}
                >
                  <Text style={styles.extendBtnText}>+1</Text>
                </Pressable>
              </View>

              <Text style={styles.extendLabel}>EXTEND</Text>

              <View style={styles.fineTuneGroup}>
                <Pressable
                  style={({ pressed }) => [styles.extendBtn, pressed && { opacity: 0.6 }]}
                  onPressIn={() => handleUpdateEnd(1)}
                >
                  <Text style={styles.extendBtnText}>+1</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.extendBtn, pressed && { opacity: 0.6 }]}
                  onPressIn={() => handleUpdateEnd(5)}
                >
                  <Text style={styles.extendBtnText}>+5</Text>
                </Pressable>
              </View>
            </View>

            {/* Row 3: Crop Row (Rose/Red) */}
            <View style={styles.cropRow}>
              <View style={styles.fineTuneGroup}>
                <Pressable
                  style={({ pressed }) => [styles.cropBtn, pressed && { opacity: 0.6 }]}
                  onPressIn={() => handleUpdateStart(5)}
                >
                  <Text style={styles.cropBtnText}>-5</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.cropBtn, pressed && { opacity: 0.6 }]}
                  onPressIn={() => handleUpdateStart(1)}
                >
                  <Text style={styles.cropBtnText}>-1</Text>
                </Pressable>
              </View>

              <Text style={styles.cropLabel}>CROP</Text>

              <View style={styles.fineTuneGroup}>
                <Pressable
                  style={({ pressed }) => [styles.cropBtn, pressed && { opacity: 0.6 }]}
                  onPressIn={() => handleUpdateEnd(-1)}
                >
                  <Text style={styles.cropBtnText}>-1</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.cropBtn, pressed && { opacity: 0.6 }]}
                  onPressIn={() => handleUpdateEnd(-5)}
                >
                  <Text style={styles.cropBtnText}>-5</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}
      </View>

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
        {isSubtitleVisible && activeSubtitleText ? (
          <View style={styles.subtitleOverlayContainer} pointerEvents="none">
            <View style={styles.subtitlePill}>
              <Text style={styles.subtitleText}>{activeSubtitleText}</Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* 3. BOTTOM PLAYBACK CONTROLS (Fixed Height) */}
      <View style={styles.bottomPlayback}>
        {/* Scrubber Progress Bar (Direct click to seek, zero animation, instant jump) */}
        <Pressable
          style={styles.progressBarTrack}
          hitSlop={{ top: 12, bottom: 12, left: 0, right: 0 }}
          onLayout={(e) => {
            trackWidthRef.current = e.nativeEvent.layout.width;
          }}
          onPressIn={(e) => {
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

            // Langsung pindah seketika (0ms, tanpa animasi / delay)
            setProgressPercent(pct);
            setCurrentClipTime((pct / 100) * duration);
            centralizedSeek(targetTime, true);
          }}
        >
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          <View style={[styles.progressKnob, { left: `${progressPercent}%` }]} />
        </Pressable>

        {/* Playback Buttons (-10s, -3s, Play/Pause, +5s, +15s) */}
        <View style={styles.playbackControlsRow}>
          <Pressable
            style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.5 }]}
            onPressIn={() => skipSeconds(-10)}
          >
            <Rewind size={20} color="rgba(255, 255, 255, 0.6)" />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.5 }]}
            onPressIn={() => skipSeconds(-3)}
          >
            <ChevronLeft size={24} color="rgba(255, 255, 255, 0.6)" />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.playPauseBtn, pressed && { transform: [{ scale: 0.95 }] }]}
            onPressIn={togglePlayPause}
          >
            {isContinueState ? (
              <Pause size={22} color="#000000" fill="#000000" />
            ) : (
              <Play size={22} color="#000000" fill="#000000" style={{ marginLeft: 2 }} />
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.5 }]}
            onPressIn={() => skipSeconds(5)}
          >
            <ChevronRight size={24} color="rgba(255, 255, 255, 0.6)" />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.5 }]}
            onPressIn={() => skipSeconds(15)}
          >
            <FastForward size={20} color="rgba(255, 255, 255, 0.6)" />
          </Pressable>
        </View>
      </View>

      {/* 4. 2-ROW HORIZONTAL CLIP GRID */}
      <View style={styles.clipGridContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.clipGridScrollContent}
        >
          {clipColumns.map((col, colIdx) => (
            <View key={colIdx} style={styles.clipColumn}>
              {col.map((clip, rowIdx) => {
                const clipNumber = colIdx * 2 + rowIdx + 1;
                return (
                  <ClipCardItem
                    key={clip.id}
                    id={clip.id}
                    rank={clip.rank}
                    start={clip.start}
                    clipNumber={clipNumber}
                    isActive={clip.id === activeClipId}
                    status={clip.status || 'none'}
                    onSelect={handleSelectClip}
                  />
                );
              })}
            </View>
          ))}
        </ScrollView>
      </View>
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
  topSection: {
    backgroundColor: '#121212',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  timeRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 46,
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  leftActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  centerTimeWrapper: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  timeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeNumberText: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  timeSeparatorText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: '700',
  },
  rightActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  statusBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  downloadBtnActive: {
    width: 'auto',
    paddingHorizontal: 8,
    flexDirection: 'row',
  },
  downloadProgressText: {
    color: '#38bdf8',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  downloadBtnSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  subtitleBtn: {
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  subtitleBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
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
  subtitleToggleBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  subtitleToggleBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderColor: '#38bdf8',
  },
  subtitleBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  timeMsText: {
    fontSize: 13,
    letterSpacing: 0.2,
  },
  timeMsDim: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  trashBtnInactive: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  trashBtnActive: {
    backgroundColor: '#dc2626',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 4,
  },
  doneBtnInactive: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  doneBtnActive: {
    backgroundColor: '#059669',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 4,
  },
  extendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  cropRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: 'rgba(225, 29, 72, 0.08)',
  },
  fineTuneGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  extendBtn: {
    width: 38,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  extendBtnText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '800',
  },
  extendLabel: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  cropBtn: {
    width: 38,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(225, 29, 72, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(225, 29, 72, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cropBtnText: {
    color: '#fb7185',
    fontSize: 11,
    fontWeight: '800',
  },
  cropLabel: {
    color: '#f43f5e',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
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
  clipGridContainer: {
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 10,
    height: 146,
  },
  clipGridScrollContent: {
    paddingHorizontal: 12,
    gap: 10,
  },
  clipColumn: {
    flexDirection: 'column',
    gap: 8,
    justifyContent: 'center',
  },
  clipCard: {
    width: 84,
    height: 54,
    borderRadius: 10,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    padding: 4,
  },
  clipCardActive: {
    borderColor: '#ffffff',
    backgroundColor: '#262626',
    borderWidth: 1.5,
  },
  clipCardDone: {
    backgroundColor: 'rgba(6, 78, 59, 0.6)',
    borderColor: '#10b981',
  },
  clipCardTrash: {
    backgroundColor: 'rgba(127, 29, 29, 0.65)',
    borderColor: '#ef4444',
  },
  rankBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#dc2626',
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  rankBadgeTrash: {
    backgroundColor: '#7f1d1d',
  },
  rankBadgeText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '900',
  },
  clipCardTitle: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  clipCardTitleTrash: {
    color: '#fca5a5',
  },
  clipCardTime: {
    color: '#ffffff',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '800',
  },
});
