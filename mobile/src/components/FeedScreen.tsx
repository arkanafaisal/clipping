import React, { useState, useEffect } from 'react';
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
  ArrowLeft,
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

  // Handle Android hardware back button
  useEffect(() => {
    const backAction = () => {
      onBack();
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [onBack]);

  // 1. Load Real Clips from Local Storage (sudah di-fetch sebelumnya di Dashboard)
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);
        const savedDraft = await LocalStorage.getItem(DRAFT_KEY);

        if (!savedDraft) {
          Alert.alert('Data Klip Kosong', 'Tidak ditemukan data klip untuk video ini. Kembali ke Dashboard.');
          onBack();
          return;
        }

        const parsed: ClipItem[] = JSON.parse(savedDraft);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          Alert.alert('Data Klip Kosong', 'Draft klip tidak valid. Kembali ke Dashboard.');
          onBack();
          return;
        }

        if (isMounted) {
          setClips(parsed);
          setActiveClipId(parsed[0].id);
          setLoading(false);
        }

        // 2. Fetch direct stream URL untuk video playback
        try {
          const directUrl = await fetchStreamUrl(videoId);
          if (isMounted && directUrl) {
            setStreamUrl(directUrl);
            player.replace(directUrl);
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

  // Save changes to storage whenever clips change
  useEffect(() => {
    if (clips.length > 0) {
      LocalStorage.setItem(DRAFT_KEY, JSON.stringify(clips));
      const doneCount = clips.filter((c) => c.status === 'done').length;
      onUpdateWorkshopDone?.(videoId, doneCount);
    }
  }, [clips]);

  // Jump player to clip start when active clip changes
  useEffect(() => {
    if (activeClip && player) {
      try {
        player.currentTime = activeClip.start;
        setProgressPercent(0);
        player.play();
        setIsPlaying(true);
      } catch (e) {
        console.log('Player seek error:', e);
      }
    }
  }, [activeClipId]);

  // Track playback time update & handle segment loop
  useEffect(() => {
    if (!player) return;

    const sub = player.addListener('timeUpdate', (event) => {
      const current = event.currentTime;
      const duration = activeClip.end - activeClip.start;
      if (duration > 0) {
        const pct = Math.max(0, Math.min(100, ((current - activeClip.start) / duration) * 100));
        setProgressPercent(pct);
      }

      // Loop current segment
      if (current >= activeClip.end) {
        player.currentTime = activeClip.start;
        player.play();
      }
    });

    const statusSub = player.addListener('statusChange', () => {
      setIsPlaying(player.playing);
    });

    return () => {
      sub.remove();
      statusSub.remove();
    };
  }, [player, activeClip.start, activeClip.end]);

  // Extend & Crop Handlers
  const handleUpdateStart = (delta: number) => {
    setClips((prev) =>
      prev.map((c) => {
        if (c.id === activeClipId) {
          const newStart = Math.max(0, Math.min(c.start + delta, c.end - 1));
          if (player) player.currentTime = newStart;
          return { ...c, start: newStart };
        }
        return c;
      })
    );
  };

  const handleUpdateEnd = (delta: number) => {
    setClips((prev) =>
      prev.map((c) => {
        if (c.id === activeClipId) {
          const newEnd = Math.max(c.start + 1, c.end + delta);
          if (player) player.currentTime = Math.max(c.start, newEnd - 3);
          return { ...c, end: newEnd };
        }
        return c;
      })
    );
  };

  // Toggle clip Done status (hijau)
  const handleToggleDone = () => {
    setClips((prev) =>
      prev.map((c) => {
        if (c.id === activeClipId) {
          const nextStatus = c.status === 'done' ? 'none' : 'done';
          return { ...c, status: nextStatus };
        }
        return c;
      })
    );
  };

  // Toggle clip Trash/Skip status (merah)
  const handleToggleTrash = () => {
    setClips((prev) =>
      prev.map((c) => {
        if (c.id === activeClipId) {
          const nextStatus = c.status === 'trash' ? 'none' : 'trash';
          return { ...c, status: nextStatus };
        }
        return c;
      })
    );
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
    if (!player) return;
    let nextTime = player.currentTime + seconds;
    if (nextTime < activeClip.start) nextTime = activeClip.start;
    if (nextTime > activeClip.end) nextTime = activeClip.end;
    player.currentTime = nextTime;
  };

  // Group clips into pairs (columns of 2 rows) for true 2-row horizontal grid
  const clipColumns: ClipItem[][] = [];
  for (let i = 0; i < clips.length; i += 2) {
    clipColumns.push(clips.slice(i, i + 2));
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
      {/* 1. TOP CONTROLS (Back di kiri | Rentang Waktu di tengah | Trash & Done di kanan) */}
      <View style={styles.topSection}>
        <View style={styles.timeRangeRow}>
          {/* KIRI: Tombol Kembali (Back) saja, tanpa unduh */}
          <View style={styles.leftActionGroup}>
            <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
              <ArrowLeft size={17} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {/* TENGAH: Rentang Waktu (100% Dead Center) */}
          <View style={styles.centerTimeWrapper} pointerEvents="box-none">
            <View style={styles.timeDisplay}>
              <Text style={styles.timeNumberText}>{formatTime(activeClip.start)}</Text>
              <Text style={styles.timeSeparatorText}>-</Text>
              <Text style={styles.timeNumberText}>{formatTime(activeClip.end)}</Text>
            </View>
          </View>

          {/* KANAN: Tombol Manajemen Klip (Merah Trash/Skip & Hijau Done) */}
          <View style={styles.rightActionGroup}>
            {/* Tombol Merah: Tandai Trash / Lewati */}
            <TouchableOpacity
              style={[
                styles.statusBtn,
                activeClip.status === 'trash' ? styles.trashBtnActive : styles.trashBtnInactive,
              ]}
              onPress={handleToggleTrash}
              activeOpacity={0.7}
            >
              <Trash2
                size={16}
                color={activeClip.status === 'trash' ? '#ffffff' : '#f87171'}
              />
            </TouchableOpacity>

            {/* Tombol Hijau: Tandai Berhasil / Selesai (Done) */}
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
        {/* Scrubber Progress Bar */}
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          <View style={[styles.progressKnob, { left: `${progressPercent}%` }]} />
        </View>

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
            onPress={() => skipSeconds(3)}
            activeOpacity={0.7}
          >
            <ChevronRight size={24} color="rgba(255, 255, 255, 0.6)" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => skipSeconds(10)}
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
                    onPress={() => setActiveClipId(clip.id)}
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
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 13,
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
    gap: 8,
    zIndex: 10,
  },
  statusBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
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
