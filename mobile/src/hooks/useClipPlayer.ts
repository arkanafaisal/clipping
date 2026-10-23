import { useState, useEffect, useRef, useCallback } from 'react';
import { BackHandler } from 'react-native';
import { useVideoPlayer } from 'expo-video';
import {
  ClipItem,
  fetchStreamUrl,
  getClipOutputFilePath,
  resolvePlayableClipUri,
  resolvePlayableFullVideoUri,
  SubtitleCue,
} from '../services/api';
import { ToastManager } from '../components/Toast';

export interface UseClipPlayerParams {
  videoId: string;
  clipsRef: React.MutableRefObject<ClipItem[]>;
  activeClipIdRef: React.MutableRefObject<string | null>;
  activeClip?: ClipItem;
  downloadedClipsRef: React.MutableRefObject<Record<string, boolean>>;
  playMode?: 'local' | 'stream';
  subtitlesRef?: React.MutableRefObject<SubtitleCue[]>;
  setActiveSubtitleText?: (text: string) => void;
  onBack: () => void;
}

export function useClipPlayer({
  videoId,
  clipsRef,
  activeClipIdRef,
  activeClip,
  downloadedClipsRef,
  playMode = 'local',
  subtitlesRef,
  setActiveSubtitleText,
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
  const debouncedSeekTargetRef = useRef<number | null>(null);
  const debouncedShouldPlayRef = useRef<boolean>(true);
  const isDebouncingSeekRef = useRef<boolean>(false);
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

  // Secondary Video Player khusus Facecam Highlight (Muted, decoupled 100% saat nonaktif)
  const facecamPlayer = useVideoPlayer(null, (p) => {
    p.loop = false;
    p.muted = true;
  });

  const isFacecamActiveRef = useRef<boolean>(false);
  const setIsFacecamActive = useCallback((active: boolean) => {
    isFacecamActiveRef.current = active;
    if (active && facecamPlayer) {
      try {
        const curUri = currentSourceUriRef.current;
        if (curUri) {
          facecamPlayer.replace(curUri);
          facecamPlayer.muted = true;
          if (player) {
            facecamPlayer.currentTime = player.currentTime;
            if (player.playing && isContinueStateRef.current) {
              facecamPlayer.play();
            }
          }
        }
      } catch (e) {
        console.warn('[useClipPlayer] Sync facecam active error:', e);
      }
    } else if (!active && facecamPlayer) {
      try {
        if (facecamPlayer.playing) facecamPlayer.pause();
      } catch (e) {}
    }
  }, [facecamPlayer, player]);

  // Aspect ratio video (default 16/9, dinamis membaca track asli video)
  const [videoAspectRatio, setVideoAspectRatio] = useState<number>(16 / 9);

  // Monitor perubahan track dan load video untuk menyesuaikan rasio aspek secara dinamis
  useEffect(() => {
    if (!player) return;

    const updateRatioFromTrack = (track: any) => {
      if (track?.size?.width && track?.size?.height && track.size.height > 0) {
        const ratio = track.size.width / track.size.height;
        if (ratio > 0.1 && ratio < 10) {
          setVideoAspectRatio(ratio);
        }
      }
    };

    const subTrack = player.addListener('videoTrackChange', (payload: any) => {
      updateRatioFromTrack(payload?.videoTrack);
    });

    const subSource = player.addListener('sourceLoad', (payload: any) => {
      if (payload?.availableVideoTracks && payload.availableVideoTracks.length > 0) {
        updateRatioFromTrack(payload.availableVideoTracks[0]);
      }
    });

    return () => {
      subTrack.remove();
      subSource.remove();
    };
  }, [player]);

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

  const cancelPendingSeekDebounce = useCallback(() => {
    if (seekDebounceTimerRef.current) {
      clearTimeout(seekDebounceTimerRef.current);
      seekDebounceTimerRef.current = null;
    }
    debouncedSeekTargetRef.current = null;
    isDebouncingSeekRef.current = false;
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
      debouncedSeekTargetRef.current = null;
      isDebouncingSeekRef.current = false;
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
      cancelPendingSeekDebounce();
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
            if (isFacecamActiveRef.current && facecamPlayer) {
              facecamPlayer.replace(fileUri);
              facecamPlayer.muted = true;
            }
          } catch (err) {
            console.warn('[Feed] Replace local file error:', err);
          }
        } else {
          try {
            player.currentTime = 0;
            if (isFacecamActiveRef.current && facecamPlayer) {
              facecamPlayer.currentTime = 0;
              if (autoPlay && isContinueStateRef.current) facecamPlayer.play();
            }
            if (autoPlay && isContinueStateRef.current) {
              player.play();
            }
          } catch (err) {
            console.warn('[Feed] Play local error:', err);
          }
        }
      } else {
        // Prioritas Utama: Periksa apakah file full video lokal tersedia di shared storage (HANYA jika playMode !== 'stream')
        const fullVideoUri = playMode === 'stream' ? null : await resolvePlayableFullVideoUri(videoId);
        const targetTime = Math.max(0, clip.start);
        setPendingSeek(targetTime);

        if (fullVideoUri) {
          if (currentSourceUriRef.current !== fullVideoUri) {
            currentSourceUriRef.current = fullVideoUri;
            isSourceSwitchingRef.current = true;
            try {
              player.replace(fullVideoUri);
              if (isFacecamActiveRef.current && facecamPlayer) {
                facecamPlayer.replace(fullVideoUri);
                facecamPlayer.muted = true;
              }
            } catch (err) {
              console.warn('[Feed] Replace full video error:', err);
            }
          } else {
            try {
              player.currentTime = targetTime;
              if (isFacecamActiveRef.current && facecamPlayer) {
                facecamPlayer.currentTime = targetTime;
                if (autoPlay && isContinueStateRef.current) facecamPlayer.play();
              }
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
              if (isFacecamActiveRef.current && facecamPlayer) {
                facecamPlayer.replace(activeStream);
                facecamPlayer.muted = true;
              }
            } catch (err) {
              console.warn('[Feed] Replace stream error:', err);
            }
          } else {
            try {
              player.currentTime = targetTime;
              if (isFacecamActiveRef.current && facecamPlayer) {
                facecamPlayer.currentTime = targetTime;
                if (autoPlay && isContinueStateRef.current) facecamPlayer.play();
              }
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
    [player, videoId, setPendingSeek, downloadedClipsRef, playMode]
  );

  /**
   * Centralized universal debounced seek handler:
   * Menampung SEMUA seek (crop, extend, skip waktu, tap scrubber) ke dalam 1 gerbang terpusat.
   * Debounce trailing edge: 150ms (file lokal) / 350ms (stream online).
   * UI (progress bar, angka rentang, active card) langsung di-update secara instan 0ms tanpa animasi/delay.
   */
  const centralizedSeek = useCallback(
    (targetTime: number, shouldPlay: boolean = true) => {
      // Simpan target seek dan status play di ref terisolasi khusus debounce
      debouncedSeekTargetRef.current = targetTime;
      debouncedShouldPlayRef.current = shouldPlay;
      isDebouncingSeekRef.current = true;

      // Auto-pause video seketika jika sedang berputar agar frame lama freeze (tanpa mengubah state tombol isContinueState)
      if (player && player.playing) {
        try {
          player.pause();
        } catch (e) {}
      }
      if (isFacecamActiveRef.current && facecamPlayer && facecamPlayer.playing) {
        try {
          facecamPlayer.pause();
        } catch (e) {}
      }

      if (seekDebounceTimerRef.current) {
        clearTimeout(seekDebounceTimerRef.current);
      }

      // Debounce seek:
      // 1. File lokal fisik (file://): Gunakan debounce 150ms agar hardware decoder HP tidak tersedak (choked)
      //    oleh banjir micro-events saat user menggeser/menahan progress bar scrubber.
      // 2. Stream online: Gunakan 350ms untuk menghemat kuota dan rate limit server YouTube.
      const isLocalMode = currentSourceUriRef.current.startsWith('file://');
      const debounceMs = isLocalMode ? 150 : 350;

      const executeSeek = () => {
        isDebouncingSeekRef.current = false;
        const targetToSeek = debouncedSeekTargetRef.current;
        const playAfterSeek = debouncedShouldPlayRef.current;
        debouncedSeekTargetRef.current = null;

        if (player && targetToSeek !== null && !isNaN(targetToSeek)) {
          try {
            const seekTime = Math.max(0, targetToSeek);
            setPendingSeek(seekTime);
            player.currentTime = seekTime;
            if (isFacecamActiveRef.current && facecamPlayer) {
              facecamPlayer.currentTime = seekTime;
              if (playAfterSeek && isContinueStateRef.current) {
                facecamPlayer.play();
              }
            }
            if (playAfterSeek && isContinueStateRef.current) {
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
        } else if (player && playAfterSeek && isContinueStateRef.current) {
          // Fallback penyelamat: pastikan playback tetap berjalan jika continue aktif
          try {
            if (!player.playing) player.play();
            if (isFacecamActiveRef.current && facecamPlayer && !facecamPlayer.playing) facecamPlayer.play();
          } catch (e) {}
        }
        seekDebounceTimerRef.current = null;
      };

      seekDebounceTimerRef.current = setTimeout(executeSeek, debounceMs);
    },
    [player, setPendingSeek]
  );

  // Track playback time update & handle segment loop
  useEffect(() => {
    if (!player) return;

    const sub = player.addListener('timeUpdate', (event) => {
      // 1. Selama masa debounce seek (user sedang menggeser scrubber atau klik crop/ms berturut-turut):
      // Abaikan seluruh event timeUpdate agar frame lama tidak menimpa progress UI dan tidak mentrigger boundary loop
      if (isDebouncingSeekRef.current) {
        return;
      }

      const currentActive = getActiveClip();
      const currentSource = currentSourceUriRef.current;
      const isClipDoneLocal =
        currentActive.status === 'done' &&
        Boolean(downloadedClipsRef.current[currentActive.id]) &&
        !currentSource.endsWith('/full.mp4') &&
        !currentSource.endsWith('/full_video.mp4');

      const current = event.currentTime;
      const duration = currentActive.end - currentActive.start;

      // 2. Cek apakah native player sedang dalam proses seek menuju targetTime yang baru saja dieksekusi
      if (pendingSeekTargetRef.current !== null) {
        const diff = Math.abs(current - pendingSeekTargetRef.current);
        if (diff < 0.4) {
          // Native player telah tiba di target seek, buka kembali kunci update UI
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

        // Sinkronisasi teks subtitle secara realtime dengan frame video
        const currentRel = isClipDoneLocal
          ? Math.max(0, Math.min(duration, current))
          : Math.max(0, Math.min(duration, current - currentActive.start));

        if (subtitlesRef?.current && subtitlesRef.current.length > 0 && setActiveSubtitleText) {
          const matchCue = subtitlesRef.current.find(
            (c) => currentRel >= c.start && currentRel <= c.end
          );
          setActiveSubtitleText(matchCue ? matchCue.text : '');
        } else if (setActiveSubtitleText) {
          setActiveSubtitleText('');
        }
      }

      // 3. Loop current segment & boundary enforcement
      if (isClipDoneLocal) {
        if (current >= duration) {
          setPendingSeek(0);
          player.currentTime = 0;
          if (isFacecamActiveRef.current && facecamPlayer) {
            try {
              facecamPlayer.currentTime = 0;
              if (isContinueStateRef.current) facecamPlayer.play();
            } catch (e) {}
          }
          if (isContinueStateRef.current) {
            player.play();
          }
        }
      } else {
        // Enforce boundary klip (baik mode full video lokal maupun online stream):
        // Loop jika mencapai batas akhir klip (current >= end) atau di luar batas start
        if (current >= currentActive.end || current < currentActive.start - 0.5) {
          setPendingSeek(currentActive.start);
          player.currentTime = currentActive.start;
          if (isFacecamActiveRef.current && facecamPlayer) {
            try {
              facecamPlayer.currentTime = currentActive.start;
              if (isContinueStateRef.current) facecamPlayer.play();
            } catch (e) {}
          }
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
          const currentSource = currentSourceUriRef.current;
          const isIndividualCutClip =
            currentActive.status === 'done' &&
            Boolean(downloadedClipsRef.current[currentActive.id]) &&
            !currentSource.endsWith('/full.mp4') &&
            !currentSource.endsWith('/full_video.mp4');

          const targetTime =
            pendingSeekTargetRef.current !== null
              ? pendingSeekTargetRef.current
              : isIndividualCutClip
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
        if (facecamPlayer && facecamPlayer.playing) facecamPlayer.pause();
      } catch (e) {}
    } else {
      // Pindah dari pause ke continue: force play jika video sedang berhenti
      setIsContinueState(true);
      try {
        if (!player.playing) player.play();
        if (isFacecamActiveRef.current && facecamPlayer && !facecamPlayer.playing) {
          facecamPlayer.play();
        }
      } catch (e) {}
    }
  }, [player, facecamPlayer]);

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
          debouncedSeekTargetRef.current !== null
            ? debouncedSeekTargetRef.current
            : pendingSeekTargetRef.current !== null
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
          debouncedSeekTargetRef.current !== null
            ? debouncedSeekTargetRef.current
            : pendingSeekTargetRef.current !== null
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
        if (isFacecamActiveRef.current && facecamPlayer) {
          try {
            facecamPlayer.replace(fileUri);
            facecamPlayer.muted = true;
            facecamPlayer.currentTime = 0;
            facecamPlayer.play();
          } catch (e) {}
        }
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

      // 2. Prioritas Kedua: Cek apakah file fisik full video lokal sudah ada di shared storage (HANYA jika playMode !== 'stream')
      if (playMode !== 'stream') {
        try {
          const fullVideoUri = await resolvePlayableFullVideoUri(videoId);
          if (fullVideoUri) {
            currentSourceUriRef.current = fullVideoUri;
            setPendingSeek(firstClipStart);
            isSourceSwitchingRef.current = true;
            player.replace(fullVideoUri);
            if (isFacecamActiveRef.current && facecamPlayer) {
              try {
                facecamPlayer.replace(fullVideoUri);
                facecamPlayer.muted = true;
                facecamPlayer.currentTime = firstClipStart;
                facecamPlayer.play();
              } catch (e) {}
            }
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
          if (isFacecamActiveRef.current && facecamPlayer) {
            try {
              facecamPlayer.replace(directUrl);
              facecamPlayer.muted = true;
              facecamPlayer.currentTime = firstClipStart;
              facecamPlayer.play();
            } catch (e) {}
          }
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
    [videoId, player, facecamPlayer, setPendingSeek, playMode]
  );

  return {
    player,
    facecamPlayer,
    isFacecamActiveRef,
    setIsFacecamActive,
    videoAspectRatio,
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
    cancelPendingSeekDebounce,
    isSourceSwitchingRef,
    centralizedSeek,
    syncPlayerSourceForClip,
    togglePlayPause,
    skipSeconds,
    initializeStreamAndPlayback,
  };
}
