import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ClipItem,
  fetchHeatmap,
  getClipOutputFilePath,
  checkClipFileExists,
} from '../services/api';
import { LocalStorage } from '../services/storage';
import { ToastManager } from '../components/Toast';

export interface UseClipDataParams {
  videoId: string;
  initialCount?: number;
  onBack: () => void;
  onUpdateWorkshopDone?: (videoId: string, doneCount: number) => void;
  onSeek: (targetTime: number, shouldPlay?: boolean) => void;
  syncPlayerSourceForClip: (clip: ClipItem, autoPlay?: boolean) => Promise<void> | void;
  downloadedClipsRef: React.MutableRefObject<Record<string, boolean>>;
  setDownloadedClips: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  currentSourceUriRef: React.MutableRefObject<string>;
  seekDebounceTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  setProgressPercent: React.Dispatch<React.SetStateAction<number>>;
  setCurrentClipTime: React.Dispatch<React.SetStateAction<number>>;
  onClipsLoaded?: (
    loadedClips: ClipItem[],
    existingDownloadMap: Record<string, boolean>,
    initialActiveClip: ClipItem | null
  ) => void;
  clipsRef?: React.MutableRefObject<ClipItem[]>;
  activeClipIdRef?: React.MutableRefObject<string | null>;
}

export function useClipData({
  videoId,
  initialCount = 50,
  onBack,
  onUpdateWorkshopDone,
  onSeek,
  syncPlayerSourceForClip,
  downloadedClipsRef,
  setDownloadedClips,
  currentSourceUriRef,
  seekDebounceTimerRef,
  setProgressPercent,
  setCurrentClipTime,
  onClipsLoaded,
  clipsRef: externalClipsRef,
  activeClipIdRef: externalActiveClipIdRef,
}: UseClipDataParams) {
  const DRAFT_KEY = `clips_draft_${videoId}`;

  const [clips, setClips] = useState<ClipItem[]>([]);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Memuat data klip...');

  // State Jumlah Klip Heatmap yang Terlihat (1 - 100, default 50)
  const [visibleHeatmapCount, setVisibleHeatmapCount] = useState<number>(initialCount || 50);

  // State Edit Presisi Milidetik (Mode Klip)
  const [activeTimeEdit, setActiveTimeEdit] = useState<'start' | 'end' | null>(null);
  const [tempTimeValue, setTempTimeValue] = useState<string>('');

  const storageDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const internalClipsRef = useRef<ClipItem[]>(clips);
  const internalActiveClipIdRef = useRef<string | null>(activeClipId);
  const clipsRef = externalClipsRef || internalClipsRef;
  const activeClipIdRef = externalActiveClipIdRef || internalActiveClipIdRef;

  useEffect(() => {
    clipsRef.current = clips;
  }, [clips]);

  useEffect(() => {
    activeClipIdRef.current = activeClipId;
  }, [activeClipId]);

  const FALLBACK_VIRTUAL_CLIP_ID = 'fallback_init';

  // Active clip reference (Fallback virtual 1 klip jika belum ada klip sama sekali di workspace)
  const activeClip = useMemo(() => {
    if (clips.length === 0) {
      return {
        id: FALLBACK_VIRTUAL_CLIP_ID,
        rank: 1,
        videoId,
        start: 0,
        end: 15,
        status: 'none' as const,
        isCustom: false,
      };
    }
    return (
      clips.find((c) => c.id === activeClipId) ||
      clips[0] || {
        id: FALLBACK_VIRTUAL_CLIP_ID,
        rank: 1,
        videoId,
        start: 0,
        end: 15,
        status: 'none' as const,
        isCustom: false,
      }
    );
  }, [clips, activeClipId, videoId]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (storageDebounceTimerRef.current) clearTimeout(storageDebounceTimerRef.current);
    };
  }, []);

  // 1. Load Real Clips from Local Storage & Pre-scan physical files
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

        // Baca konfigurasi visible heatmap count tersimpan jika ada
        try {
          const savedCount = await LocalStorage.getItem(`clipping_visible_count_${videoId}`);
          if (savedCount) {
            const parsedCount = parseInt(savedCount, 10);
            if (!isNaN(parsedCount) && parsedCount > 0) {
              setVisibleHeatmapCount(parsedCount);
            }
          }
        } catch {}

        // Jika room sudah memiliki klip heatmap lama (<100) dan belum pernah full-fetch, lakukan upgrade di latar belakang
        const nonCustomClips = loadedClips.filter((c) => !c.isCustom && c.rank !== 'custom');
        const hasAttemptedFull = await LocalStorage.getItem(`clipping_full_fetched_${videoId}`);

        if (nonCustomClips.length > 0 && nonCustomClips.length < 100 && !hasAttemptedFull) {
          try {
            const heatmapData = await fetchHeatmap(videoId, 100, 0);
            if (heatmapData.clips && heatmapData.clips.length > 0) {
              const existingStatusMap = new Map<string, ClipItem>();
              loadedClips.forEach((c) => {
                existingStatusMap.set(c.id, c);
              });

              const customClips = loadedClips.filter((c) => c.isCustom || c.rank === 'custom');
              const mergedHeatmap = heatmapData.clips.map((c, idx) => {
                const existing = existingStatusMap.get(c.id);
                if (existing) {
                  return {
                    ...c,
                    status: existing.status,
                    start: existing.start,
                    end: existing.end,
                    rank: c.rank || idx + 1,
                    isCustom: false,
                  };
                }
                return {
                  ...c,
                  status: 'none' as const,
                  rank: c.rank || idx + 1,
                  isCustom: false,
                };
              });
              loadedClips = [...customClips, ...mergedHeatmap];
              await LocalStorage.setItem(DRAFT_KEY, JSON.stringify(loadedClips));
              await LocalStorage.setItem(`clipping_full_fetched_${videoId}`, 'true');
            }
          } catch (err: any) {
            console.warn('[useClipData] Heatmap upgrade error:', err);
          }
        }

        let initialActiveClip: ClipItem | null = null;
        if (loadedClips.length > 0) {
          const initialVisible = [...loadedClips].sort((a, b) => a.start - b.start);
          initialActiveClip = initialVisible[0];
          if (isMounted) {
            setActiveClipId(initialVisible[0].id);
            activeClipIdRef.current = initialVisible[0].id;
          }
        } else {
          initialActiveClip = {
            id: FALLBACK_VIRTUAL_CLIP_ID,
            rank: 1,
            videoId,
            start: 0,
            end: 15,
            status: 'none' as const,
            isCustom: false,
          };
          if (isMounted) {
            setActiveClipId(FALLBACK_VIRTUAL_CLIP_ID);
            activeClipIdRef.current = FALLBACK_VIRTUAL_CLIP_ID;
          }
        }

        if (isMounted) {
          setClips([...loadedClips]);
          clipsRef.current = loadedClips;
          setDownloadedClips({});
          downloadedClipsRef.current = {};
          setLoading(false);
        }

        if (isMounted && onClipsLoaded) {
          onClipsLoaded(loadedClips, {}, initialActiveClip);
        }
      } catch (err: any) {
        if (isMounted) {
          setLoading(false);
          ToastManager.show({
            type: 'error',
            title: 'Gagal Membuka Workshop',
            rawError: err.rawError || err.stack || err.message,
            errorCode: err.code || 'LOAD_ERROR',
            duration: 5000,
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
  }, [clips, videoId, onUpdateWorkshopDone]);

  // Extend & Crop Handlers:
  // - UI langsung ter-update secara instan 0ms tanpa animasi/delay
  // - Menggunakan clipsRef.current secara sinkron sehingga tidak terkena stale closure saat multi-klik cepat
  // - Seek video terpusat dieksekusi 1x setelah user berhenti menekan tombol (debounce 500ms trailing)
  const handleUpdateStart = useCallback(
    (delta: number) => {
      const currentActiveId = activeClipIdRef.current || activeClipId;

      // Jika belum ada klip asli di workspace (sedang berinteraksi dengan visual fallback), konversi jadi klip custom
      if (clipsRef.current.length === 0 || currentActiveId === FALLBACK_VIRTUAL_CLIP_ID) {
        const targetStart = Math.max(0, Math.min(0 + delta, 15 - 1));
        const newClip: ClipItem = {
          id: `custom_${Date.now()}`,
          rank: 'custom',
          videoId,
          start: targetStart,
          end: 15,
          status: 'none',
          isCustom: true,
        };
        const updated = [newClip];
        clipsRef.current = updated;
        setClips(updated);
        activeClipIdRef.current = newClip.id;
        setActiveClipId(newClip.id);
        LocalStorage.setItem(DRAFT_KEY, JSON.stringify(updated));
        setProgressPercent(0);
        setCurrentClipTime(0);
        onSeek(targetStart, true);
        return;
      }

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
      onSeek(targetStart, true);
    },
    [activeClipId, videoId, onSeek, setProgressPercent, setCurrentClipTime, setClips, setActiveClipId, clipsRef, activeClipIdRef]
  );

  const handleUpdateEnd = useCallback(
    (delta: number) => {
      const currentActiveId = activeClipIdRef.current || activeClipId;

      // Jika belum ada klip asli di workspace, konversi visual fallback jadi klip custom
      if (clipsRef.current.length === 0 || currentActiveId === FALLBACK_VIRTUAL_CLIP_ID) {
        const newEnd = Math.max(0 + 1, 15 + delta);
        const targetSeek = Math.max(0, newEnd - 3);
        const newClip: ClipItem = {
          id: `custom_${Date.now()}`,
          rank: 'custom',
          videoId,
          start: 0,
          end: newEnd,
          status: 'none',
          isCustom: true,
        };
        const updated = [newClip];
        clipsRef.current = updated;
        setClips(updated);
        activeClipIdRef.current = newClip.id;
        setActiveClipId(newClip.id);
        LocalStorage.setItem(DRAFT_KEY, JSON.stringify(updated));
        if (newEnd > 0) {
          const pct = Math.max(0, Math.min(100, (targetSeek / newEnd) * 100));
          setProgressPercent(pct);
          setCurrentClipTime(targetSeek);
        }
        onSeek(targetSeek, true);
        return;
      }

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

      onSeek(targetSeek, true);
    },
    [activeClipId, videoId, onSeek, setProgressPercent, setCurrentClipTime, setClips, setActiveClipId, clipsRef, activeClipIdRef]
  );

  // Handler Edit Presisi Milidetik (Start / End)
  // - Nilai input 1 digit otomatis dievaluasi sebagai ratusan (misal '6' -> '60' centiseconds = 600ms)
  // - Nilai input 2 digit (misal '65' centiseconds = 650ms, digit ke-3 otomatis 0)
  // - Seek otomatis mengikuti centralizedSeek yang sudah ter-debounce (500ms trailing)
  const handleMsTimeChange = useCallback(
    (type: 'start' | 'end', valStr: string) => {
      const cleaned = valStr.replace(/[^0-9]/g, '').slice(0, 2);
      setTempTimeValue(cleaned);

      if (cleaned === '') return;

      const msStr = cleaned.padEnd(2, '0').slice(0, 2);
      const msValue = parseInt(msStr, 10);
      if (isNaN(msValue)) return;

      const currentActiveId = activeClipIdRef.current || activeClipId;

      // Jika visual fallback diedit milidetiknya, konversi jadi klip custom
      if (clipsRef.current.length === 0 || currentActiveId === FALLBACK_VIRTUAL_CLIP_ID) {
        const safeMs = Math.max(0, Math.min(99, msValue));
        if (type === 'start') {
          const validStart = Math.max(0, Math.min(safeMs / 100, 15 - 0.1));
          const newClip: ClipItem = {
            id: `custom_${Date.now()}`,
            rank: 'custom',
            videoId,
            start: validStart,
            end: 15,
            status: 'none',
            isCustom: true,
          };
          const updated = [newClip];
          clipsRef.current = updated;
          setClips(updated);
          activeClipIdRef.current = newClip.id;
          setActiveClipId(newClip.id);
          LocalStorage.setItem(DRAFT_KEY, JSON.stringify(updated));
          setProgressPercent(0);
          setCurrentClipTime(0);
          onSeek(validStart, true);
        } else {
          const validEnd = Math.max(0.1, 15 + safeMs / 100);
          const targetSeek = Math.max(0, validEnd - 3);
          const newClip: ClipItem = {
            id: `custom_${Date.now()}`,
            rank: 'custom',
            videoId,
            start: 0,
            end: validEnd,
            status: 'none',
            isCustom: true,
          };
          const updated = [newClip];
          clipsRef.current = updated;
          setClips(updated);
          activeClipIdRef.current = newClip.id;
          setActiveClipId(newClip.id);
          LocalStorage.setItem(DRAFT_KEY, JSON.stringify(updated));
          if (validEnd > 0) {
            const pct = Math.max(0, Math.min(100, (targetSeek / validEnd) * 100));
            setProgressPercent(pct);
            setCurrentClipTime(targetSeek);
          }
          onSeek(targetSeek, true);
        }
        return;
      }

      const currentClip = clipsRef.current.find((c) => c.id === currentActiveId);
      if (!currentClip) return;

      const baseSeconds = Math.floor(type === 'start' ? currentClip.start : currentClip.end);
      const safeMs = Math.max(0, Math.min(99, msValue));
      const newFinalValue = baseSeconds + safeMs / 100;

      let targetSeek = 0;
      const updated = clipsRef.current.map((c) => {
        if (c.id === currentActiveId) {
          if (type === 'start') {
            const validStart = Math.max(0, Math.min(newFinalValue, c.end - 0.1));
            targetSeek = validStart;
            return { ...c, start: validStart };
          } else {
            const validEnd = Math.max(c.start + 0.1, newFinalValue);
            targetSeek = Math.max(c.start, validEnd - 3);
            return { ...c, end: validEnd };
          }
        }
        return c;
      });

      clipsRef.current = updated;
      setClips(updated);

      if (type === 'start') {
        setProgressPercent(0);
        setCurrentClipTime(0);
      } else {
        const active = updated.find((c) => c.id === currentActiveId);
        if (active && active.end > active.start) {
          const pct = Math.max(0, Math.min(100, ((targetSeek - active.start) / (active.end - active.start)) * 100));
          setProgressPercent(pct);
          const rel = Math.max(0, Math.min(active.end - active.start, targetSeek - active.start));
          setCurrentClipTime(rel);
        }
      }

      onSeek(targetSeek, true);
    },
    [activeClipId, videoId, onSeek, setProgressPercent, setCurrentClipTime, setClips, setActiveClipId, setTempTimeValue, clipsRef, activeClipIdRef]
  );

  // Switch klip langsung instan (tanpa debounce) khusus carousel klip
  const handleSelectClip = useCallback(
    (clipId: string) => {
      setActiveTimeEdit(null);
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

      const targetClip =
        clipsRef.current.find((c) => c.id === clipId) ||
        (clipId === FALLBACK_VIRTUAL_CLIP_ID
          ? {
              id: FALLBACK_VIRTUAL_CLIP_ID,
              rank: 1,
              videoId,
              start: 0,
              end: 15,
              status: 'none' as const,
              isCustom: false,
            }
          : undefined);
      if (!targetClip) return;

      // Pindahkan playback sumber secara dinamis (Lokal vs Stream) dan lakukan seek seketika
      syncPlayerSourceForClip(targetClip, true);
    },
    [syncPlayerSourceForClip, setProgressPercent, setCurrentClipTime, seekDebounceTimerRef, videoId]
  );

  // Toggle clip Done status (hijau)
  const handleToggleDone = useCallback(async () => {
    const currentActiveId = activeClipIdRef.current || activeClipId;

    // Jika visual fallback ditandai done, konversi menjadi klip custom selesai
    if (clipsRef.current.length === 0 || currentActiveId === FALLBACK_VIRTUAL_CLIP_ID) {
      const newClip: ClipItem = {
        id: `custom_${Date.now()}`,
        rank: 'custom',
        videoId,
        start: 0,
        end: 15,
        status: 'done',
        isCustom: true,
      };
      const updated = [newClip];
      clipsRef.current = updated;
      setClips(updated);
      activeClipIdRef.current = newClip.id;
      setActiveClipId(newClip.id);
      LocalStorage.setItem(DRAFT_KEY, JSON.stringify(updated));
      onUpdateWorkshopDone?.(videoId, 1);
      ToastManager.show({
        type: 'success',
        title: 'Klip Ditandai Selesai',
        duration: 2000,
      });
      return;
    }

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

    // Jika berubah jadi done, cek apakah filenya sudah pernah diunduh (hanya cek file tanpa me-load video yang membebani memori)
    if (nextStatus === 'done') {
      const { fileUri } = getClipOutputFilePath(videoId, targetClip.start, targetClip.end, targetClip.rank);
      const exists = await checkClipFileExists(fileUri);
      if (exists) {
        setDownloadedClips((prev) => ({ ...prev, [targetClip!.id]: true }));
        downloadedClipsRef.current[targetClip.id] = true;
      }
    }
  }, [activeClipId, videoId, onUpdateWorkshopDone, setClips, setActiveClipId, downloadedClipsRef, setDownloadedClips, clipsRef, activeClipIdRef]);

  // Toggle clip Trash/Skip status (merah)
  const handleToggleTrash = useCallback(() => {
    const currentActiveId = activeClipIdRef.current || activeClipId;

    if (clipsRef.current.length === 0 || currentActiveId === FALLBACK_VIRTUAL_CLIP_ID) {
      ToastManager.show({
        type: 'info',
        title: 'Klip Fallback',
        duration: 2500,
      });
      return;
    }

    const currentClip = clipsRef.current.find((c) => c.id === currentActiveId);

    // Jika klip custom: benar-benar hapus secara permanen (bukan hanya menandai trash)
    if (currentClip && (currentClip.isCustom || currentClip.rank === 'custom')) {
      const updated = clipsRef.current.filter((c) => c.id !== currentActiveId);
      clipsRef.current = updated;
      setClips(updated);
      LocalStorage.setItem(DRAFT_KEY, JSON.stringify(updated));

      // Pindahkan active clip ke klip terdekat yang masih ada
      const remaining = [...updated].sort((a, b) => a.start - b.start);
      if (remaining.length > 0) {
        handleSelectClip(remaining[0].id);
      }
      ToastManager.show({
        type: 'info',
        title: 'Klip Custom Dihapus',
        duration: 2000,
      });
      return;
    }

    // Klip heatmap biasa: toggle status 'trash' vs 'none'
    const updated = clipsRef.current.map((c) => {
      if (c.id === currentActiveId) {
        const nextStatus = (c.status === 'trash' ? 'none' : 'trash') as 'none' | 'trash';
        return { ...c, status: nextStatus };
      }
      return c;
    });
    clipsRef.current = updated;
    setClips(updated);
  }, [activeClipId, handleSelectClip, setClips, clipsRef, activeClipIdRef]);

  // Tambah Rentang Klip Custom dari pengguna
  const handleAddCustomClip = (start: number, end: number) => {
    const newClip: ClipItem = {
      id: `custom_${Date.now()}`,
      rank: 'custom',
      videoId,
      start: Number(start.toFixed(3)),
      end: Number(end.toFixed(3)),
      status: 'none',
      isCustom: true,
    };

    const updated = [...clipsRef.current, newClip];
    clipsRef.current = updated;
    setClips(updated);
    LocalStorage.setItem(DRAFT_KEY, JSON.stringify(updated));

    handleSelectClip(newClip.id);
    ToastManager.show({
      type: 'success',
      title: 'Klip Custom Ditambahkan',
      duration: 2500,
    });
  };

  // Ubah Jumlah Klip Heatmap yang Terlihat (atau Ekstrak Heatmap on-demand jika belum ada)
  const handleSetVisibleHeatmapCount = async (count: number) => {
    const validCount = Math.max(1, Math.min(100, count));
    setVisibleHeatmapCount(validCount);
    LocalStorage.setItem(`clipping_visible_count_${videoId}`, String(validCount));

    const existingHeatmapClips = clipsRef.current.filter((c) => !c.isCustom && c.rank !== 'custom');

    // Jika belum ada klip heatmap (misal room dibuat tanpa fetch heatmap atau video baru),
    // lakukan ekstraksi heatmap AI saat user menekan 'Terapkan'
    if (existingHeatmapClips.length === 0) {
      ToastManager.show({
        type: 'info',
        title: 'Mengekstrak Heatmap AI...',
        duration: 4000,
      });
      try {
        const heatmapData = await fetchHeatmap(videoId, 100, 0);
        if (heatmapData.clips && heatmapData.clips.length > 0) {
          const customClips = clipsRef.current.filter((c) => c.isCustom || c.rank === 'custom');
          const formattedHeatmap: ClipItem[] = heatmapData.clips.map((c: any, idx: number) => ({
            ...c,
            status: 'none' as const,
            rank: c.rank || idx + 1,
            isCustom: false,
          }));

          const updated = [...customClips, ...formattedHeatmap];
          clipsRef.current = updated;
          setClips(updated);
          await LocalStorage.setItem(DRAFT_KEY, JSON.stringify(updated));
          await LocalStorage.setItem(`clipping_full_fetched_${videoId}`, 'true');

          if (heatmapData.title) {
            try {
              const savedWorkshops = await LocalStorage.getItem('workshops_list');
              if (savedWorkshops) {
                const list = JSON.parse(savedWorkshops);
                const idx = list.findIndex((w: any) => w.videoId === videoId);
                if (idx >= 0) {
                  list[idx].title = heatmapData.title;
                  await LocalStorage.setItem('workshops_list', JSON.stringify(list));
                }
              }
            } catch {}
          }

          // Pilih klip pertama dari daftar yang tampak
          const visibleList = [...customClips, ...formattedHeatmap.slice(0, validCount)].sort((a, b) => a.start - b.start);
          if (visibleList.length > 0) {
            handleSelectClip(visibleList[0].id);
          }

          ToastManager.show({
            type: 'success',
            title: `Heatmap Dimuat (${formattedHeatmap.length} Klip)`,
            duration: 2500,
          });
        } else {
          ToastManager.show({
            type: 'info',
            title: 'Heatmap Tidak Tersedia',
            duration: 3000,
          });
        }
      } catch (err: any) {
        console.warn('[useClipData] Heatmap fetch error on apply count:', err);
        ToastManager.show({
          type: 'error',
          title: 'Gagal Mengambil Heatmap',
          rawError: err.rawError || err.stack || err.message,
          errorCode: err.code || 'HEATMAP_ERROR',
          duration: 5000,
        });
      }
      return;
    }

    // Jika klip heatmap sudah ada di memori/storage, sesuaikan count seperti biasa
    const customClips = clipsRef.current.filter((c) => c.isCustom || c.rank === 'custom');
    const heatmapClips = clipsRef.current
      .filter((c) => !c.isCustom && c.rank !== 'custom')
      .sort((a, b) => {
        const numA = typeof a.rank === 'number' ? a.rank : parseInt(String(a.rank), 10);
        const numB = typeof b.rank === 'number' ? b.rank : parseInt(String(b.rank), 10);
        const rankA = isNaN(numA) ? 999 : numA;
        const rankB = isNaN(numB) ? 999 : numB;
        return rankA - rankB;
      })
      .slice(0, validCount);

    const visibleList = [...customClips, ...heatmapClips].sort((a, b) => a.start - b.start);
    const currentActiveId = activeClipIdRef.current || activeClipId;
    const isCurrentStillVisible = visibleList.some((c) => c.id === currentActiveId);

    if (!isCurrentStillVisible && visibleList.length > 0) {
      const currentActive = clipsRef.current.find((c) => c.id === currentActiveId);
      const currentStart = currentActive ? currentActive.start : 0;

      let closestClip = visibleList[0];
      let minDiff = Math.abs(visibleList[0].start - currentStart);
      for (let i = 1; i < visibleList.length; i++) {
        const diff = Math.abs(visibleList[i].start - currentStart);
        if (diff < minDiff) {
          minDiff = diff;
          closestClip = visibleList[i];
        }
      }

      handleSelectClip(closestClip.id);
    }

    ToastManager.show({
      type: 'success',
      title: `Menampilkan ${validCount} Klip Heatmap`,
      duration: 2000,
    });
  };

  // Filter klip yang tampak:
  // 1. Klip Custom: SELALU DITAMPILKAN
  // 2. Klip Heatmap: Diambil N klip teratas berdasarkan ranking intensitas (rank 1..N)
  // 3. Gabungan keduanya diurutkan secara kronologis berdasarkan waktu mulai (start)
  // 4. Jika clips.length === 0 (belum ada klip di workspace), sediakan 1 klip fallback virtual murni di UI
  const visibleClips = useMemo(() => {
    if (clips.length === 0) {
      return [
        {
          id: FALLBACK_VIRTUAL_CLIP_ID,
          rank: 1,
          videoId,
          start: 0,
          end: 15,
          status: 'none' as const,
          isCustom: false,
        },
      ];
    }

    const customClips = clips.filter((c) => c.isCustom || c.rank === 'custom');
    const heatmapClips = clips
      .filter((c) => !c.isCustom && c.rank !== 'custom')
      .sort((a, b) => {
        const numA = typeof a.rank === 'number' ? a.rank : parseInt(String(a.rank), 10);
        const numB = typeof b.rank === 'number' ? b.rank : parseInt(String(b.rank), 10);
        const rankA = isNaN(numA) ? 999 : numA;
        const rankB = isNaN(numB) ? 999 : numB;
        return rankA - rankB;
      })
      .slice(0, visibleHeatmapCount);

    return [...customClips, ...heatmapClips].sort((a, b) => a.start - b.start);
  }, [clips, visibleHeatmapCount, videoId]);

  const clipColumns = useMemo(() => {
    const cols: ClipItem[][] = [];
    for (let i = 0; i < visibleClips.length; i += 2) {
      cols.push(visibleClips.slice(i, i + 2));
    }
    return cols;
  }, [visibleClips]);

  return {
    clips,
    setClips,
    clipsRef,
    activeClipId,
    setActiveClipId,
    activeClipIdRef,
    activeClip,
    loading,
    setLoading,
    loadingMessage,
    setLoadingMessage,
    visibleHeatmapCount,
    setVisibleHeatmapCount: handleSetVisibleHeatmapCount,
    handleAddCustomClip,
    activeTimeEdit,
    setActiveTimeEdit,
    tempTimeValue,
    setTempTimeValue,
    sortedClips: visibleClips,
    clipColumns,
    handleUpdateStart,
    handleUpdateEnd,
    handleMsTimeChange,
    handleSelectClip,
    handleToggleDone,
    handleToggleTrash,
  };
}
