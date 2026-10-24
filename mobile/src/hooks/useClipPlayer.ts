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
  setActiveSubtitleText?: (text: string, fontSize?: number) => void;
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

  // Linear Clock & Zero-Lag Timeline Interpolator refs (Animasi linier 0-X tanpa bridge lag)
  const playStartWallTimeRef = useRef<number | null>(null);
  const playStartClipTimeRef = useRef<number>(0);
  const isPlaybackActiveRef = useRef<boolean>(false);
  const linearClockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopGraceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDispatchedSubtitleTextRef = useRef<string>('');

  useEffect(() => {
    isContinueStateRef.current = isContinueState;
  }, [isContinueState]);

  useEffect(() => {
    streamUrlRef.current = streamUrl;
  }, [streamUrl]);

  // Video Player instance via expo-video (UI interpolasi linier di 50ms)
  // - bufferOptions: minBufferForPlayback: 0.05s memangkas delay inisialisasi decoder ExoPlayer dari default 2 detik menjadi 50ms!
  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.25;
    p.bufferOptions = {
      preferredForwardBufferDuration: 4.0,
      minBufferForPlayback: 2.0,
    };
  });

  // Secondary Video Player khusus Facecam Highlight (Muted, decoupled 100% saat nonaktif)
  const facecamPlayer = useVideoPlayer(null, (p) => {
    p.loop = false;
    p.muted = true;
    p.bufferOptions = {
      preferredForwardBufferDuration: 4.0,
      minBufferForPlayback: 2.0,
    };
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

  // Cleanup debounce timers and linear clock on unmount
  useEffect(() => {
    return () => {
      if (seekDebounceTimerRef.current) clearTimeout(seekDebounceTimerRef.current);
      if (seekSafetyTimeoutRef.current) clearTimeout(seekSafetyTimeoutRef.current);
      if (linearClockTimerRef.current) clearInterval(linearClockTimerRef.current);
      if (stopGraceTimerRef.current) clearTimeout(stopGraceTimerRef.current);
      debouncedSeekTargetRef.current = null;
      isDebouncingSeekRef.current = false;
    };
  }, []);

  /**
   * Evaluasi cue subtitle pada detik target secara efisien.
   * Hanya memicu pembaruan state jika teks subtitle benar-benar berubah untuk memangkas 95% re-render.
   */
  const syncSubtitleCueAtTime = useCallback(
    (targetRelTime: number) => {
      if (subtitlesRef?.current && subtitlesRef.current.length > 0 && setActiveSubtitleText) {
        const match = subtitlesRef.current.find(
          (c) => targetRelTime >= c.start && targetRelTime <= c.end
        );
        const text = match ? match.text : '';
        const fontSize = match?.fontSize || 14;
        if (text !== lastDispatchedSubtitleTextRef.current) {
          lastDispatchedSubtitleTextRef.current = text;
          setActiveSubtitleText(text, fontSize);
        }
      } else if (setActiveSubtitleText && lastDispatchedSubtitleTextRef.current !== '') {
        lastDispatchedSubtitleTextRef.current = '';
        setActiveSubtitleText('', 14);
      }
    },
    [subtitlesRef, setActiveSubtitleText]
  );

  /**
   * Menghentikan jam linier saat video dipause / distop, dan mengunci timestamp detik saat ini.
   */
  const stopLinearClock = useCallback(() => {
    if (stopGraceTimerRef.current) {
      clearTimeout(stopGraceTimerRef.current);
      stopGraceTimerRef.current = null;
    }
    isPlaybackActiveRef.current = false;
    if (linearClockTimerRef.current) {
      clearInterval(linearClockTimerRef.current);
      linearClockTimerRef.current = null;
    }
    if (playStartWallTimeRef.current !== null) {
      const currentActive = getActiveClip();
      const duration = currentActive.end - currentActive.start;
      const now = Date.now();
      const rate = player?.playbackRate || 1.0;
      const elapsed = ((now - playStartWallTimeRef.current) / 1000) * rate;
      const finalTime = Math.max(0, Math.min(duration, playStartClipTimeRef.current + elapsed));
      playStartClipTimeRef.current = finalTime;
      playStartWallTimeRef.current = null;
      setCurrentClipTime(finalTime);
      if (duration > 0) {
        setProgressPercent(Math.max(0, Math.min(100, (finalTime / duration) * 100)));
      }
      syncSubtitleCueAtTime(finalTime);
    }
  }, [getActiveClip, player, syncSubtitleCueAtTime]);

  /**
   * Memulai jam linier (linear wall-clock) independen:
   * Menggerakkan progress bar & subtitle secara deterministik dari waktu fisik Date.now()
   * tanpa menunggu antrean event bridge native ExoPlayer, menghasilkan sinkronisasi 0ms lag.
   */
  const startLinearClock = useCallback(
    (fromRelTime?: number, forceReset: boolean = false) => {
      // Jika jam linier sudah aktif berputar dan bukan instruksi reset eksplisit,
      // jangan reset jam kembali ke detik awal! Biarkan jam terus berjalan mulus tanpa lompat mundur.
      if (isPlaybackActiveRef.current && !forceReset) {
        return;
      }

      if (stopGraceTimerRef.current) {
        clearTimeout(stopGraceTimerRef.current);
        stopGraceTimerRef.current = null;
      }

      const currentActive = getActiveClip();
      const duration = currentActive.end - currentActive.start;
      const initialTime =
        typeof fromRelTime === 'number'
          ? Math.max(0, Math.min(duration, fromRelTime))
          : playStartClipTimeRef.current;

      playStartClipTimeRef.current = initialTime;
      playStartWallTimeRef.current = Date.now();
      isPlaybackActiveRef.current = true;

      // Cara 2 Catch-Up Instan: perbarui posisi UI seketika tanpa menunggu interval 50ms pertama
      setCurrentClipTime(initialTime);
      if (duration > 0) {
        setProgressPercent(Math.max(0, Math.min(100, (initialTime / duration) * 100)));
      }
      syncSubtitleCueAtTime(initialTime);

      if (linearClockTimerRef.current) {
        clearInterval(linearClockTimerRef.current);
      }

      // Interval 50ms (20 FPS) super ringan dan mulus di layar
      linearClockTimerRef.current = setInterval(() => {
        if (!isPlaybackActiveRef.current || playStartWallTimeRef.current === null) return;

        const curActive = getActiveClip();
        const curDuration = curActive.end - curActive.start;
        if (curDuration <= 0) return;

        const now = Date.now();
        const rate = player?.playbackRate || 1.0;
        const elapsed = ((now - playStartWallTimeRef.current) / 1000) * rate;
        const curTime = playStartClipTimeRef.current + elapsed;

        // Loop boundary check jika telah melewati durasi klip
        if (curTime >= curDuration) {
          playStartClipTimeRef.current = 0;
          playStartWallTimeRef.current = Date.now();
          setCurrentClipTime(0);
          setProgressPercent(0);
          syncSubtitleCueAtTime(0);

          if (player) {
            const isIndividualCutClip =
              curActive.status === 'done' &&
              Boolean(downloadedClipsRef.current[curActive.id]) &&
              !currentSourceUriRef.current.endsWith('/full.mp4') &&
              !currentSourceUriRef.current.endsWith('/full_video.mp4') &&
              !currentSourceUriRef.current.endsWith('/full_proxy.mp4');
            const loopTarget = isIndividualCutClip ? 0 : curActive.start;
            setPendingSeek(loopTarget);
            player.currentTime = loopTarget;
            if (isFacecamActiveRef.current && facecamPlayer) {
              try {
                facecamPlayer.currentTime = loopTarget;
                if (isContinueStateRef.current) facecamPlayer.play();
              } catch (e) {}
            }
            if (isContinueStateRef.current) {
              player.play();
            }
          }
          return;
        }

        const clampedTime = Math.max(0, Math.min(curDuration, curTime));
        const pct = (clampedTime / curDuration) * 100;
        setCurrentClipTime(clampedTime);
        setProgressPercent(pct);
        syncSubtitleCueAtTime(clampedTime);
      }, 50);
    },
    [
      getActiveClip,
      player,
      facecamPlayer,
      setPendingSeek,
      downloadedClipsRef,
      syncSubtitleCueAtTime,
    ]
  );

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
      stopLinearClock();
      playStartClipTimeRef.current = 0;
      setCurrentClipTime(0);
      setProgressPercent(0);
      syncSubtitleCueAtTime(0);

      // 1. PRIORITAS UTAMA: Jika full video lokal (terutama full_proxy.mp4 480p) tersedia,
      // SELALU gunakan full video proxy lokal untuk SEMUA mode player (clipping, mark as done, editor non-facecam, editor facecam)
      // agar pemutaran 100% offline, 0ms seek, dan super lancar 60 FPS tanpa beban decoder!
      const fullVideoUri = playMode === 'stream' ? null : await resolvePlayableFullVideoUri(videoId);
      if (fullVideoUri) {
        const targetTime = Math.max(0, clip.start);
        setPendingSeek(targetTime);

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
            console.warn('[Feed] Replace full video proxy error:', err);
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
            console.warn('[Feed] Play full video proxy error:', err);
          }
        }
        return;
      }

      // 2. JIKA TIDAK ADA FULL VIDEO LOKAL:
      // A. Jika mode facecam aktif (2 player berjalan):
      // Wajib gunakan streamUrl (480p progressive YouTube) agar hardware decoder tidak terbebani 2x video 1080p!
      // B. Jika facecam tidak aktif & klip individual lokal sudah di-download:
      // Putar file klip lokal (00.12 - 01.35.mp4) mulai dari detik 0.
      const isDownloaded = Boolean(downloadedClipsRef.current[clip.id]);
      const isClipDoneLocal = clip.status === 'done' && isDownloaded && !isFacecamActiveRef.current;

      if (isClipDoneLocal) {
        setPendingSeek(0);
        const fileUri = await resolvePlayableClipUri(videoId, clip.start, clip.end, clip.rank);
        if (fileUri) {
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
          return;
        }
      }

      // 3. FALLBACK UNIVERSAL: Mode stream online YouTube (480p)
      const activeStream = streamUrlRef.current;
      const targetTime = Math.max(0, clip.start);
      setPendingSeek(targetTime);

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
    },
    [
      player,
      facecamPlayer,
      videoId,
      setPendingSeek,
      downloadedClipsRef,
      playMode,
      stopLinearClock,
      syncSubtitleCueAtTime,
    ]
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

      // Update linear clock state immediately
      const currentActive = getActiveClip();
      const currentSource = currentSourceUriRef.current;
      const isIndividualCutClip =
        currentActive.status === 'done' &&
        Boolean(downloadedClipsRef.current[currentActive.id]) &&
        !currentSource.endsWith('/full.mp4') &&
        !currentSource.endsWith('/full_video.mp4') &&
        !currentSource.endsWith('/full_proxy.mp4');
      const duration = currentActive.end - currentActive.start;
      const targetRel = isIndividualCutClip ? targetTime : targetTime - currentActive.start;
      const clampedRel = Math.max(0, Math.min(duration, targetRel));

      playStartClipTimeRef.current = clampedRel;
      if (stopGraceTimerRef.current) {
        clearTimeout(stopGraceTimerRef.current);
        stopGraceTimerRef.current = null;
      }
      stopLinearClock();
      setCurrentClipTime(clampedRel);
      if (duration > 0) {
        setProgressPercent(Math.max(0, Math.min(100, (clampedRel / duration) * 100)));
      }
      syncSubtitleCueAtTime(clampedRel);

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
    [
      player,
      facecamPlayer,
      setPendingSeek,
      getActiveClip,
      downloadedClipsRef,
      syncSubtitleCueAtTime,
      stopLinearClock,
    ]
  );

  // Track playback time update & handle segment loop
  useEffect(() => {
    if (!player) return;

    // 1. Listen for playback state changes (Play / Pause)
    const playingSub = player.addListener('playingChange', (payload: any) => {
      const isPlaying = payload?.isPlaying ?? player.playing;
      if (isPlaying) {
        // Batalkan pending grace timer stop jika video melanjutkan pemutaran (micro-buffering recovery)
        if (stopGraceTimerRef.current) {
          clearTimeout(stopGraceTimerRef.current);
          stopGraceTimerRef.current = null;
        }

        // Buka kembali lock seek target jika video sudah mulai berputar di native
        pendingSeekTargetRef.current = null;

        // HANYA jalankan jika linear clock BELUM aktif!
        // Start jam linier tepat di detik saat video player mulai berputar di native ExoPlayer
        if (!isPlaybackActiveRef.current) {
          const curActive = getActiveClip();
          const curSource = currentSourceUriRef.current;
          const isIndividualCutClip =
            curActive.status === 'done' &&
            Boolean(downloadedClipsRef.current[curActive.id]) &&
            !curSource.endsWith('/full.mp4') &&
            !curSource.endsWith('/full_video.mp4') &&
            !curSource.endsWith('/full_proxy.mp4');

          const rawCurrent = player.currentTime;
          const currentPos =
            typeof rawCurrent === 'number' && !isNaN(rawCurrent)
              ? rawCurrent
              : isIndividualCutClip
              ? 0
              : curActive.start;

          const rel = isIndividualCutClip
            ? Math.max(0, currentPos)
            : Math.max(0, currentPos - curActive.start);

          startLinearClock(rel, true);
        }
      } else {
        // Redam micro-buffering (Cara 1): Berikan grace period 150ms sebelum mematikan jam linier.
        // Jika ExoPlayer hanya buffering sesaat (misal < 100ms) lalu lanjut playing,
        // jam linier tidak akan terbunuh/stuck di awal.
        if (stopGraceTimerRef.current) {
          clearTimeout(stopGraceTimerRef.current);
        }
        stopGraceTimerRef.current = setTimeout(() => {
          stopLinearClock();
          stopGraceTimerRef.current = null;
        }, 150);
      }
    });

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
        !currentSource.endsWith('/full_video.mp4') &&
        !currentSource.endsWith('/full_proxy.mp4');

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

      const nativeRel = isClipDoneLocal
        ? Math.max(0, Math.min(duration, current))
        : Math.max(0, Math.min(duration, current - currentActive.start));

      if (!isPlaybackActiveRef.current) {
        // Fallback pengaman: jika player sudah berstatus playing di native tapi linear clock belum start,
        // segera start linear clock sekarang juga!
        if (player.playing && pendingSeekTargetRef.current === null) {
          startLinearClock(nativeRel, true);
        } else {
          // Mode Pause/Diam: Kalibrasi instan 100% mengikuti player native
          playStartClipTimeRef.current = nativeRel;
          setCurrentClipTime(nativeRel);
          if (duration > 0) {
            setProgressPercent(Math.max(0, Math.min(100, (nativeRel / duration) * 100)));
          }
          syncSubtitleCueAtTime(nativeRel);
        }
      } else {
        // Mode Play: Untuk file lokal, biarkan progress bar berjalan 100% mulus sebagai animasi linier 0-X tanpa kalkulasi mundur/reset!
        // Hanya kalibrasi jika mode stream online YouTube mengalami lag/stall jaringan ekstrem (> 1.5 detik)
        if (playMode === 'stream' && playStartWallTimeRef.current !== null) {
          const now = Date.now();
          const rate = player?.playbackRate || 1.0;
          const elapsed = ((now - playStartWallTimeRef.current) / 1000) * rate;
          const currentInterpolated = playStartClipTimeRef.current + elapsed;
          const drift = Math.abs(nativeRel - currentInterpolated);

          if (drift > 1.5) {
            playStartClipTimeRef.current = nativeRel;
            playStartWallTimeRef.current = Date.now();
          }
        }
      }

      // 3. Loop current segment & boundary enforcement fallback
      if (isClipDoneLocal) {
        if (current >= duration) {
          setPendingSeek(0);
          player.currentTime = 0;
          playStartClipTimeRef.current = 0;
          playStartWallTimeRef.current = Date.now();
          setCurrentClipTime(0);
          setProgressPercent(0);
          syncSubtitleCueAtTime(0);
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
          playStartClipTimeRef.current = 0;
          playStartWallTimeRef.current = Date.now();
          setCurrentClipTime(0);
          setProgressPercent(0);
          syncSubtitleCueAtTime(0);
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
            !currentSource.endsWith('/full_video.mp4') &&
            !currentSource.endsWith('/full_proxy.mp4');

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
      playingSub.remove();
      statusSub.remove();
    };
  }, [
    player,
    facecamPlayer,
    videoId,
    setPendingSeek,
    getActiveClip,
    downloadedClipsRef,
    startLinearClock,
    stopLinearClock,
    syncSubtitleCueAtTime,
  ]);

  // Playback Control Handlers (Force manual control terisolasi dari auto-seek/auto-play)
  const togglePlayPause = useCallback(() => {
    if (!player) return;
    if (isContinueStateRef.current) {
      // Pindah dari continue ke pause: force pause jika video sedang berputar
      setIsContinueState(false);
      if (stopGraceTimerRef.current) {
        clearTimeout(stopGraceTimerRef.current);
        stopGraceTimerRef.current = null;
      }
      stopLinearClock();
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
  }, [
    player,
    facecamPlayer,
    stopLinearClock,
  ]);

  const skipSeconds = useCallback(
    (seconds: number) => {
      const currentActive = getActiveClip();
      const currentSource = currentSourceUriRef.current;
      const isClipDoneLocal =
        currentActive.status === 'done' &&
        Boolean(downloadedClipsRef.current[currentActive.id]) &&
        !currentSource.endsWith('/full.mp4') &&
        !currentSource.endsWith('/full_video.mp4') &&
        !currentSource.endsWith('/full_proxy.mp4');
      const duration = currentActive.end - currentActive.start;

      if (isClipDoneLocal) {
        const baseTime =
          debouncedSeekTargetRef.current !== null
            ? debouncedSeekTargetRef.current
            : pendingSeekTargetRef.current !== null
            ? pendingSeekTargetRef.current
            : playStartClipTimeRef.current;

        const nextTime = Math.max(0, Math.min(Math.max(0, duration - 0.2), baseTime + seconds));
        if (duration > 0) {
          const pct = Math.max(0, Math.min(100, (nextTime / duration) * 100));
          setProgressPercent(pct);
          setCurrentClipTime(nextTime);
        }
        playStartClipTimeRef.current = nextTime;
        if (isPlaybackActiveRef.current) {
          playStartWallTimeRef.current = Date.now();
        }
        syncSubtitleCueAtTime(nextTime);
        centralizedSeek(nextTime, true);
      } else {
        const baseTime =
          debouncedSeekTargetRef.current !== null
            ? debouncedSeekTargetRef.current
            : pendingSeekTargetRef.current !== null
            ? pendingSeekTargetRef.current
            : currentActive.start + playStartClipTimeRef.current;

        let nextTime = baseTime + seconds;
        if (nextTime < currentActive.start) nextTime = currentActive.start;
        if (nextTime >= currentActive.end) nextTime = Math.max(currentActive.start, currentActive.end - 0.2);

        const rel = Math.max(0, Math.min(duration, nextTime - currentActive.start));
        if (duration > 0) {
          const pct = Math.max(0, Math.min(100, (rel / duration) * 100));
          setProgressPercent(pct);
          setCurrentClipTime(rel);
        }
        playStartClipTimeRef.current = rel;
        if (isPlaybackActiveRef.current) {
          playStartWallTimeRef.current = Date.now();
        }
        syncSubtitleCueAtTime(rel);
        centralizedSeek(nextTime, true);
      }
    },
    [
      player,
      centralizedSeek,
      activeClip,
      clipsRef,
      activeClipIdRef,
      getActiveClip,
      downloadedClipsRef,
      syncSubtitleCueAtTime,
    ]
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
