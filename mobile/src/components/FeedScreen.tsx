import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  BackHandler,
  Alert,
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
} from 'lucide-react-native';
import {
  ClipItem,
  fetchStreamUrl,
  fetchHeatmap,
} from '../services/api';
import { LocalStorage } from '../services/storage';
import { ToastManager } from './Toast';

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

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);

  // Debounce refs for smooth, leak-proof UI adjustments & storage sync
  const seekDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSeekTargetRef = useRef<number | null>(null);
  const isSeekingRef = useRef(false);
  const seekTargetTimeRef = useRef<number | null>(null);
  const seekUnlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackWidthRef = useRef<number>(1);
  const storageDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clipsRef = useRef<ClipItem[]>(clips);
  const activeClipIdRef = useRef<string | null>(activeClipId);

  useEffect(() => {
    clipsRef.current = clips;
  }, [clips]);

  useEffect(() => {
    activeClipIdRef.current = activeClipId;
  }, [activeClipId]);

  // Active clip reference
  const activeClip = clips.find((c) => c.id === activeClipId) || clips[0] || {
    id: 'temp',
    rank: 1,
    videoId,
    start: 0,
    end: 15,
    status: 'none',
  };

  // Video Player instance via expo-video
  const player = useVideoPlayer(streamUrl || '', (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.2;
  });

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
      if (storageDebounceTimerRef.current) clearTimeout(storageDebounceTimerRef.current);
      if (seekUnlockTimerRef.current) clearTimeout(seekUnlockTimerRef.current);
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
        if (isMounted) {
          setClips(loadedClips);
          const initialVisible = [...loadedClips].sort((a, b) => a.start - b.start);
          if (initialVisible.length > 0) {
            setActiveClipId(initialVisible[0].id);
            firstClipStart = initialVisible[0].start;
          }
          setLoading(false);
        }

        // 2. Fetch direct stream URL untuk video playback
        try {
          const directUrl = await fetchStreamUrl(videoId);
          if (isMounted && directUrl) {
            setStreamUrl(directUrl);
            player.replace(directUrl);
            // AUTO PLAY: Mulai putar langsung dari posisi start klip pertama
            try {
              player.currentTime = firstClipStart;
              player.play();
              setIsPlaying(true);
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
        } catch (streamErr: any) {
          console.warn('[Feed] Stream fetch error:', streamErr.message);
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
          Alert.alert('Gagal Membuka Workshop', err.message);
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
   * Centralized universal debounced seek handler:
   * Menampung SEMUA seek (crop, extend, skip waktu, pindah klip, tap scrubber) ke dalam 1 gerbang terpusat.
   * Debounce trailing edge: 500ms sejak interaksi TERAKHIR user.
   * UI (progress bar, angka rentang, active card) langsung di-update secara instan 0ms tanpa animasi/delay.
   * Kunci seeking (isSeekingRef) menjaga agar event timeUpdate usang dari native player tidak meng-overwrite
   * atau membuat progress bar mental bolak-balik (rubberbanding).
   */
  const centralizedSeek = useCallback((targetTime: number, shouldPlay: boolean = true) => {
    pendingSeekTargetRef.current = targetTime;
    isSeekingRef.current = true;
    seekTargetTimeRef.current = targetTime;

    // Auto-pause seketika jika player sedang berjalan agar video freeze di frame terakhir
    if (player && player.playing) {
      try {
        player.pause();
        setIsPlaying(false);
      } catch (e) {}
    }

    if (seekDebounceTimerRef.current) {
      clearTimeout(seekDebounceTimerRef.current);
    }
    if (seekUnlockTimerRef.current) {
      clearTimeout(seekUnlockTimerRef.current);
    }

    seekDebounceTimerRef.current = setTimeout(() => {
      const finalTarget = pendingSeekTargetRef.current;
      if (player && finalTarget !== null && !isNaN(finalTarget)) {
        try {
          player.currentTime = Math.max(0, finalTarget);
          if (shouldPlay) {
            player.play();
            setIsPlaying(true);
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
      // Jangan langsung buka lock seeking sebelum native player selesai memproses seek!
      // Berikan batas waktu pengaman 700ms jika event timeUpdate belum tiba persis di target
      seekUnlockTimerRef.current = setTimeout(() => {
        isSeekingRef.current = false;
        seekTargetTimeRef.current = null;
        pendingSeekTargetRef.current = null;
      }, 700);
    }, 500);
  }, [player]);

  // Track playback time update & handle segment loop
  useEffect(() => {
    if (!player) return;

    const sub = player.addListener('timeUpdate', (event) => {
      const current = event.currentTime;

      // Jika user sedang aktif menekan seek/crop/extend/skip (debounce / seek lock aktif)
      if (pendingSeekTargetRef.current !== null || isSeekingRef.current) {
        if (seekTargetTimeRef.current !== null) {
          // Buka kunci HANYA jika native player sudah benar-benar tiba di dekat target waktu
          if (Math.abs(current - seekTargetTimeRef.current) <= 0.4) {
            isSeekingRef.current = false;
            seekTargetTimeRef.current = null;
            pendingSeekTargetRef.current = null;
            if (seekUnlockTimerRef.current) {
              clearTimeout(seekUnlockTimerRef.current);
              seekUnlockTimerRef.current = null;
            }
          } else {
            // Abaikan timeUpdate usang agar progress bar TIDAK mental kembali ke posisi lama
            return;
          }
        } else {
          return;
        }
      }

      const currentActiveId = activeClipIdRef.current || activeClipId;
      const currentActive = clipsRef.current.find((c) => c.id === currentActiveId) || activeClip;

      const duration = currentActive.end - currentActive.start;
      if (duration > 0) {
        const pct = Math.max(0, Math.min(100, ((current - currentActive.start) / duration) * 100));
        setProgressPercent(pct);
      }

      // Loop current segment
      if (current >= currentActive.end) {
        player.currentTime = currentActive.start;
        player.play();
      }
    });

    const statusSub = player.addListener('statusChange', async () => {
      setIsPlaying(player.playing);
      // Auto-recovery: Jika stream URL kadaluwarsa (player status error), fetch ulang secara otomatis
      if (player.status === 'error') {
        console.warn('[Feed] Player error detected, stream URL mungkin kadaluwarsa. Mengambil URL baru...');
        try {
          const freshUrl = await fetchStreamUrl(videoId, true); // forceRefresh = true
          if (freshUrl) {
            setStreamUrl(freshUrl);
            player.replace(freshUrl);
            player.currentTime = activeClip.start;
            player.play();
            setIsPlaying(true);
          }
        } catch (e: any) {
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
  }, [player, activeClip.start, activeClip.end]);

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
    }

    centralizedSeek(targetSeek, true);
  };

  // Switch klip dengan debounce seek terpusat & optimistic UI update instan
  const handleSelectClip = (clipId: string) => {
    activeClipIdRef.current = clipId;
    setActiveClipId(clipId);
    // Optimistic: Progress bar seketika langsung balik ke 0
    setProgressPercent(0);

    const targetClip = clipsRef.current.find((c) => c.id === clipId);
    if (!targetClip) return;
    centralizedSeek(targetClip.start, true);
  };

  // Toggle clip Done status (hijau)
  const handleToggleDone = () => {
    const currentActiveId = activeClipIdRef.current || activeClipId;
    const updated = clipsRef.current.map((c) => {
      if (c.id === currentActiveId) {
        const nextStatus = (c.status === 'done' ? 'none' : 'done') as 'none' | 'done';
        return { ...c, status: nextStatus };
      }
      return c;
    });
    clipsRef.current = updated;
    setClips(updated);
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

  // Playback Control Handlers
  const togglePlayPause = () => {
    if (!player) return;
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.play();
      setIsPlaying(true);
    }
  };

  const skipSeconds = (seconds: number) => {
    const currentActiveId = activeClipIdRef.current || activeClipId;
    const currentActive = clipsRef.current.find((c) => c.id === currentActiveId) || activeClip;
    
    // Utamakan seekTargetTimeRef agar multi-klik beruntun tidak membaca player.currentTime yang sedang pending
    const baseTime =
      seekTargetTimeRef.current !== null
        ? seekTargetTimeRef.current
        : pendingSeekTargetRef.current !== null
        ? pendingSeekTargetRef.current
        : player
        ? player.currentTime
        : currentActive.start;

    let nextTime = baseTime + seconds;
    if (nextTime < currentActive.start) nextTime = currentActive.start;
    if (nextTime > currentActive.end) nextTime = currentActive.end;

    // Optimistic: Scrubber langsung pindah ke posisi target seketika (0ms, tanpa animasi / delay)
    const duration = currentActive.end - currentActive.start;
    if (duration > 0) {
      const pct = Math.max(0, Math.min(100, ((nextTime - currentActive.start) / duration) * 100));
      setProgressPercent(pct);
    }

    centralizedSeek(nextTime, true);
  };

  // Group clips into pairs (columns of 2 rows) sorted chronologically (parity with Feed.jsx)
  const sortedClips = [...clips].sort((a, b) => a.start - b.start);
  const clipColumns: ClipItem[][] = [];
  for (let i = 0; i < sortedClips.length; i += 2) {
    clipColumns.push(sortedClips.slice(i, i + 2));
  }

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
      {/* 1. TOP CONTROLS (Kiri: Trash/Skip | Tengah: Rentang Waktu Luas | Kanan: Done) */}
      <View style={styles.topSection}>
        <View style={styles.timeRangeRow}>
          {/* KIRI: Tombol Merah Trash / Skip (Icon Only, Tanpa Teks, Menggantikan Back) */}
          <View style={styles.leftActionGroup}>
            <TouchableOpacity
              style={[
                styles.statusBtn,
                activeClip.status === 'trash' ? styles.trashBtnActive : styles.trashBtnInactive,
              ]}
              onPress={handleToggleTrash}
              activeOpacity={0.7}
            >
              <Trash2
                size={18}
                color={activeClip.status === 'trash' ? '#ffffff' : '#f87171'}
              />
            </TouchableOpacity>
          </View>

          {/* TENGAH: Rentang Waktu (Leluasa & Luas) */}
          <View style={styles.centerTimeWrapper} pointerEvents="box-none">
            <View style={styles.timeDisplay}>
              <Text style={styles.timeNumberText}>{formatTime(activeClip.start)}</Text>
              <Text style={styles.timeSeparatorText}>-</Text>
              <Text style={styles.timeNumberText}>{formatTime(activeClip.end)}</Text>
            </View>
          </View>

          {/* KANAN: Tombol Hijau Done / Selesai (Icon Only, Tanpa Teks) */}
          <View style={styles.rightActionGroup}>
            <TouchableOpacity
              style={[
                styles.statusBtn,
                activeClip.status === 'done' ? styles.doneBtnActive : styles.doneBtnInactive,
              ]}
              onPress={handleToggleDone}
              activeOpacity={0.7}
            >
              <CheckCircle2
                size={18}
                color={activeClip.status === 'done' ? '#ffffff' : '#34d399'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Row 2: Extend Row (Emerald) */}
        <View style={styles.extendRow}>
          <View style={styles.fineTuneGroup}>
            <TouchableOpacity
              style={styles.extendBtn}
              onPress={() => handleUpdateStart(-5)}
              activeOpacity={0.7}
            >
              <Text style={styles.extendBtnText}>+5</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.extendBtn}
              onPress={() => handleUpdateStart(-1)}
              activeOpacity={0.7}
            >
              <Text style={styles.extendBtnText}>+1</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.extendLabel}>EXTEND</Text>

          <View style={styles.fineTuneGroup}>
            <TouchableOpacity
              style={styles.extendBtn}
              onPress={() => handleUpdateEnd(1)}
              activeOpacity={0.7}
            >
              <Text style={styles.extendBtnText}>+1</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.extendBtn}
              onPress={() => handleUpdateEnd(5)}
              activeOpacity={0.7}
            >
              <Text style={styles.extendBtnText}>+5</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Row 3: Crop Row (Rose/Red) */}
        <View style={styles.cropRow}>
          <View style={styles.fineTuneGroup}>
            <TouchableOpacity
              style={styles.cropBtn}
              onPress={() => handleUpdateStart(5)}
              activeOpacity={0.7}
            >
              <Text style={styles.cropBtnText}>-5</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cropBtn}
              onPress={() => handleUpdateStart(1)}
              activeOpacity={0.7}
            >
              <Text style={styles.cropBtnText}>-1</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.cropLabel}>CROP</Text>

          <View style={styles.fineTuneGroup}>
            <TouchableOpacity
              style={styles.cropBtn}
              onPress={() => handleUpdateEnd(-1)}
              activeOpacity={0.7}
            >
              <Text style={styles.cropBtnText}>-1</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cropBtn}
              onPress={() => handleUpdateEnd(-5)}
              activeOpacity={0.7}
            >
              <Text style={styles.cropBtnText}>-5</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 2. VIDEO PLAYER AREA (expo-video) */}
      <View style={styles.playerContainer}>
        {streamUrl ? (
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
      </View>

      {/* 3. BOTTOM PLAYBACK CONTROLS (Fixed Height) */}
      <View style={styles.bottomPlayback}>
        {/* Scrubber Progress Bar (Direct click to seek, zero animation, instant jump) */}
        <TouchableOpacity
          style={styles.progressBarTrack}
          activeOpacity={1}
          hitSlop={{ top: 12, bottom: 12, left: 0, right: 0 }}
          onLayout={(e) => {
            trackWidthRef.current = e.nativeEvent.layout.width;
          }}
          onPress={(e) => {
            const currentActiveId = activeClipIdRef.current || activeClipId;
            const currentActive = clipsRef.current.find((c) => c.id === currentActiveId) || activeClip;
            const duration = currentActive.end - currentActive.start;
            if (duration <= 0 || trackWidthRef.current <= 0) return;

            const locationX = e.nativeEvent.locationX;
            const pct = Math.max(0, Math.min(100, (locationX / trackWidthRef.current) * 100));
            const targetTime = currentActive.start + (pct / 100) * duration;

            // Langsung pindah seketika (0ms, tanpa animasi / delay)
            setProgressPercent(pct);
            centralizedSeek(targetTime, true);
          }}
        >
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          <View style={[styles.progressKnob, { left: `${progressPercent}%` }]} />
        </TouchableOpacity>

        {/* Playback Buttons (-10s, -3s, Play/Pause, +3s, +10s) */}
        <View style={styles.playbackControlsRow}>
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => skipSeconds(-10)}
            activeOpacity={0.7}
          >
            <Rewind size={20} color="rgba(255, 255, 255, 0.6)" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => skipSeconds(-3)}
            activeOpacity={0.7}
          >
            <ChevronLeft size={24} color="rgba(255, 255, 255, 0.6)" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.playPauseBtn}
            onPress={togglePlayPause}
            activeOpacity={0.85}
          >
            {isPlaying ? (
              <Pause size={22} color="#000000" fill="#000000" />
            ) : (
              <Play size={22} color="#000000" fill="#000000" style={{ marginLeft: 2 }} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => skipSeconds(5)}
            activeOpacity={0.7}
          >
            <ChevronRight size={24} color="rgba(255, 255, 255, 0.6)" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => skipSeconds(15)}
            activeOpacity={0.7}
          >
            <FastForward size={20} color="rgba(255, 255, 255, 0.6)" />
          </TouchableOpacity>
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
                const isActive = clip.id === activeClipId;
                const isDone = clip.status === 'done';
                const isTrash = clip.status === 'trash';

                return (
                  <TouchableOpacity
                    key={clip.id}
                    style={[
                      styles.clipCard,
                      isDone && styles.clipCardDone,
                      isTrash && styles.clipCardTrash,
                      isActive && styles.clipCardActive,
                    ]}
                    onPress={() => handleSelectClip(clip.id)}
                    activeOpacity={0.8}
                  >
                    {/* Rank Badge */}
                    <View style={[styles.rankBadge, isTrash && styles.rankBadgeTrash]}>
                      <Text style={styles.rankBadgeText}>#{clip.rank || clipNumber}</Text>
                    </View>

                    <Text style={[styles.clipCardTitle, isTrash && styles.clipCardTitleTrash]}>
                      KLIP {clipNumber}
                    </Text>
                    <Text style={styles.clipCardTime}>{formatTime(clip.start)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </View>
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
