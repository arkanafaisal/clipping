import { useState, useEffect, useRef, useCallback } from 'react';
import { BackHandler } from 'react-native';
import { useVideoPlayer } from 'expo-video';
import {
  ClipItem,
  fetchStreamUrl,
  getClipOutputFilePath,
  resolvePlayableClipUri,
  resolvePlayableFullVideoUri,
} from '../services/api';
import { ToastManager } from '../components/Toast';

export interface UseClipPlayerParams {
  videoId: string;
  clipsRef: React.MutableRefObject<ClipItem[]>;
  activeClipIdRef: React.MutableRefObject<string | null>;
  activeClip?: ClipItem;
  downloadedClipsRef: React.MutableRefObject<Record<string, boolean>>;
  onBack: () => void;
}

export function useClipPlayer({
  videoId,
  clipsRef,
  activeClipIdRef,
  activeClip,
  downloadedClipsRef,
  onBack,
}: UseClipPlayerParams) {
  const getActiveClip = useCallback((): ClipItem => {
    const currentActiveId = activeClipIdRef.current;
    return (
      (currentActiveId ? clipsRef.current.find((c) => c.id === currentActiveId) : null) ||
      activeClip || {
        id: 'temp',
        rank: 1,
        videoId,
        start: 0,
        end: 15,
        status: 'none' as const,
      }
    );
  }, [activeClipIdRef, clipsRef, activeClip, videoId]);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);

  // Manual play/pause button state (decoupled from automated seek/freeze/loop events)
  const [isContinueState, setIsContinueState] = useState<boolean>(true);
  const [progressPercent, setProgressPercent] = useState(0);
  const [currentClipTime, setCurrentClipTime] = useState<number>(0);

  // Debounce refs for smooth, leak-proof UI adjustments & storage sync
  const seekDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekSafetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSeekTargetRef = useRef<number | null>(null);
  const trackWidthRef = useRef<number>(1);
  const currentSourceUriRef = useRef<string>('');
  const isContinueStateRef = useRef<boolean>(isContinueState);
  const streamUrlRef = useRef<string | null>(streamUrl);
  const isSourceSwitchingRef = useRef<boolean>(false);

  useEffect(() => {
    isContinueStateRef.current = isContinueState;
  }, [isContinueState]);

  useEffect(() => {
    streamUrlRef.current = streamUrl;
  }, [streamUrl]);

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
    };
  }, []);

  /**
   * Sinkronisasi sumber pemutar video secara dinamis:
   * 1. Mode Klip Done Lokal: Jika klip berstatus 'done' dan file fisik MP4 klip sudah terunduh di HP,
   *    putar file fisik klip lokal (file://...) dari detik 0.0s s/d durasi klip.
   * 2. Mode Full Video Lokal: Jika klip belum berstatus 'done' atau belum di-cut, TETAPI file fisik full video
   *    sudah terunduh di shared storage, putar file full video lokal (file://.../full.mp4) dari detik clip.start.
   * 3. Mode Stream Online: Jika file fisik belum ada sama sekali, putar direct stream online YouTube dari detik clip.start.
   */
  const syncPlayerSourceForClip = useCallback(
    async (clip: ClipItem, autoPlay: boolean = true) => {
      if (!player) return;
      const isDownloaded = Boolean(downloadedClipsRef.current[clip.id]);
      const isClipDoneLocal = clip.status === 'done' && isDownloaded;

      if (isClipDoneLocal) {
        setPendingSeek(0);
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
        // Prioritas Utama: Periksa apakah file full video lokal tersedia di shared storage
        const fullVideoUri = await resolvePlayableFullVideoUri(videoId);
        const targetTime = Math.max(0, clip.start);
        setPendingSeek(targetTime);

        if (fullVideoUri) {
          if (currentSourceUriRef.current !== fullVideoUri) {
            currentSourceUriRef.current = fullVideoUri;
            isSourceSwitchingRef.current = true;
            try {
              player.replace(fullVideoUri);
            } catch (err) {
              console.warn('[Feed] Replace full video error:', err);
            }
          } else {
            try {
              player.currentTime = targetTime;
              if (autoPlay && isContinueStateRef.current) {
                player.play();
              }
            } catch (err) {
              console.warn('[Feed] Play full video error:', err);
            }
          }
        } else {
          // Fallback: Mode stream online YouTube
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
      }
    },
    [player, videoId, setPendingSeek, downloadedClipsRef]
  );

  /**
   * Centralized universal debounced seek handler:
   * Menampung SEMUA seek (crop, extend, skip waktu, tap scrubber) ke dalam 1 gerbang terpusat.
   * Debounce trailing edge: 500ms sejak interaksi TERAKHIR user.
   * UI (progress bar, angka rentang, active card) langsung di-update secara instan 0ms tanpa animasi/delay.
   */
  const centralizedSeek = useCallback(
    (targetTime: number, shouldPlay: boolean = true) => {
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
            const seekTime = Math.max(0, finalTarget);
            player.currentTime = seekTime;
            if (shouldPlay && isContinueStateRef.current) {
              player.play();
            }
          } catch (e: any) {
            ToastManager.show({
              type: 'error',
              title: 'Gagal Memindahkan Pemutar',
              rawError: e?.message,
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
    },
    [player, setPendingSeek]
  );

  // Track playback time update & handle segment loop
  useEffect(() => {
    if (!player) return;

    const sub = player.addListener('timeUpdate', (event) => {
      const currentActive = getActiveClip();
      const currentSource = currentSourceUriRef.current;
      const isClipDoneLocal =
        currentActive.status === 'done' &&
        Boolean(downloadedClipsRef.current[currentActive.id]) &&
        !currentSource.endsWith('/full.mp4') &&
        !currentSource.endsWith('/full_video.mp4');

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
        if (isClipDoneLocal) {
          const pct = Math.max(0, Math.min(100, (current / duration) * 100));
          setProgressPercent(pct);
          setCurrentClipTime(Math.max(0, Math.min(duration, current)));
        } else {
          const pct = Math.max(0, Math.min(100, ((current - currentActive.start) / duration) * 100));
          setProgressPercent(pct);
          const rel = Math.max(0, Math.min(duration, current - currentActive.start));
          setCurrentClipTime(rel);
        }
      }

      // Loop current segment & boundary enforcement
      if (isClipDoneLocal) {
        if (current >= duration) {
          player.currentTime = 0;
          if (isContinueStateRef.current) {
            player.play();
          }
        }
      } else {
        // Enforce boundary klip (baik mode full video lokal maupun online stream):
        // 1. Loop jika mencapai batas akhir klip (current >= end)
        // 2. Koreksi seketika jika video meleset atau nyangkut di luar rentang klip
        if (current >= currentActive.end || current < currentActive.start - 0.5) {
          player.currentTime = currentActive.start;
          if (isContinueStateRef.current) {
            player.play();
          }
        }
      }
    });

    const statusSub = player.addListener('statusChange', async () => {
      const currentActive = getActiveClip();
      if (player.status === 'readyToPlay') {
        // HANYA snap posisi jika sedang terjadi pergantian media source (player.replace),
        // JANGAN snap pada seek biasa (crop/extend/skip/scrubber) agar posisi seek user tidak tertimpa ke awal klip!
        if (isSourceSwitchingRef.current) {
          isSourceSwitchingRef.current = false;
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
          if (isContinueStateRef.current) {
            if (!player.playing) {
              try { player.play(); } catch (e) {}
            }
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
            setPendingSeek(currentActive.start);
            isSourceSwitchingRef.current = true;
            player.replace(activeStream);
            player.currentTime = currentActive.start;
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
            setPendingSeek(currentActive.start);
            isSourceSwitchingRef.current = true;
            player.replace(freshUrl);
            player.currentTime = currentActive.start;
            if (isContinueStateRef.current) {
              player.play();
            }
          }
        } catch (e: any) {
          ToastManager.show({
            type: 'error',
            title: 'Gagal Memperbarui Stream',
            rawError: e?.rawError || e?.message,
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
  }, [
    player,
    videoId,
    setPendingSeek,
    getActiveClip,
  ]);

  // Playback Control Handlers (Force manual control terisolasi dari auto-seek/auto-play)
  const togglePlayPause = useCallback(() => {
    if (!player) return;
    if (isContinueStateRef.current) {
      // Pindah dari continue ke pause: force pause jika video sedang berputar
      setIsContinueState(false);
      try {
        if (player.playing) player.pause();
      } catch (e) {}
    } else {
      // Pindah dari pause ke continue: force play jika video sedang berhenti
      setIsContinueState(true);
      try {
        if (!player.playing) player.play();
      } catch (e) {}
    }
  }, [player]);

  const skipSeconds = useCallback(
    (seconds: number) => {
      const currentActive = getActiveClip();
      const currentSource = currentSourceUriRef.current;
      const isClipDoneLocal =
        currentActive.status === 'done' &&
        Boolean(downloadedClipsRef.current[currentActive.id]) &&
        !currentSource.endsWith('/full.mp4') &&
        !currentSource.endsWith('/full_video.mp4');
      const duration = currentActive.end - currentActive.start;

      if (isClipDoneLocal) {
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
    },
    [player, centralizedSeek, activeClip, clipsRef, activeClipIdRef]
  );

  // Inisialisasi awal stream dan auto-play klip pertama (Prioritaskan offline full video)
  const initializeStreamAndPlayback = useCallback(
    async (initialActiveClip: ClipItem | null, existingDownloadMap: Record<string, boolean>) => {
      const firstClipStart = initialActiveClip ? initialActiveClip.start : 0;
      const isFirstClipLocal = Boolean(
        initialActiveClip &&
          initialActiveClip.status === 'done' &&
          existingDownloadMap[initialActiveClip.id]
      );

      // 1. Jika klip pertama sudah selesai di-cut secara lokal
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
          duration: 2500,
        });
        return;
      }

      // 2. Prioritas Kedua: Cek apakah file fisik full video lokal sudah ada di shared storage
      try {
        const fullVideoUri = await resolvePlayableFullVideoUri(videoId);
        if (fullVideoUri) {
          currentSourceUriRef.current = fullVideoUri;
          setPendingSeek(firstClipStart);
          isSourceSwitchingRef.current = true;
          player.replace(fullVideoUri);
          try {
            player.currentTime = firstClipStart;
            player.play();
          } catch (e) {}
          ToastManager.show({
            type: 'success',
            title: 'Memutar Full Video Lokal',
            duration: 2500,
          });
          return;
        }
      } catch (checkErr) {
        console.warn('[Feed] Check full video error:', checkErr);
      }

      // 3. Fallback: Ambil stream URL YouTube online jika belum ada file lokal
      try {
        const directUrl = await fetchStreamUrl(videoId);
        if (directUrl) {
          setStreamUrl(directUrl);
          streamUrlRef.current = directUrl;
          currentSourceUriRef.current = directUrl;
          setPendingSeek(firstClipStart);
          isSourceSwitchingRef.current = true;
          player.replace(directUrl);
          try {
            player.currentTime = firstClipStart;
            player.play();
          } catch (playErr) {
            console.log('[Feed] Auto-play initial clip error:', playErr);
          }
          ToastManager.show({
            type: 'success',
            title: 'Stream Video Siap',
            duration: 2500,
          });
        }
      } catch (streamErr: any) {
        console.warn('[Feed] Stream fetch error:', streamErr.message);
        ToastManager.show({
          type: 'error',
          title: 'Stream Video Gagal',
          rawError: streamErr.rawError || streamErr.message,
          errorCode: streamErr.code,
          duration: 4000,
        });
      }
    },
    [videoId, player, setPendingSeek]
  );

  return {
    player,
    streamUrl,
    setStreamUrl,
    streamUrlRef,
    isContinueState,
    setIsContinueState,
    progressPercent,
    setProgressPercent,
    currentClipTime,
    setCurrentClipTime,
    trackWidthRef,
    currentSourceUriRef,
    seekDebounceTimerRef,
    pendingSeekTargetRef,
    setPendingSeek,
    isSourceSwitchingRef,
    centralizedSeek,
    syncPlayerSourceForClip,
    togglePlayPause,
    skipSeconds,
    initializeStreamAndPlayback,
  };
}
