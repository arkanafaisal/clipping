import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import {
  ClipItem,
  fetchHeatmap,
  getClipOutputFilePath,
  getClipFilename,
  formatTimeForFilename,
  resolvePlayableClipUri,
  checkClipFileExists,
  SHARED_CLIPPING_OUTPUT_DIR,
  INTERNAL_CLIPPING_OUTPUT_DIR,
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

  // Active clip reference
  const activeClip = useMemo(() => {
    return (
      clips.find((c) => c.id === activeClipId) ||
      clips[0] || {
        id: 'temp',
        rank: 1,
        videoId,
        start: 0,
        end: 15,
        status: 'none' as const,
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

        if (loadedClips.length === 0) {
          setLoadingMessage('Mengekstrak Heatmap AI (Bisa memakan waktu belasan detik)...');
          // Ekstrak 100 klip penuh dengan offset 0 (tepat pada momen puncak)
          const heatmapData = await fetchHeatmap(videoId, 100, 0);
          loadedClips = heatmapData.clips.map((c: any, idx: number) => ({
            ...c,
            status: 'none' as const,
            rank: c.rank || idx + 1,
            isCustom: false,
          }));
          await LocalStorage.setItem(DRAFT_KEY, JSON.stringify(loadedClips));
        }

        let initialActiveClip: ClipItem | null = null;
        if (isMounted) {
          setClips(loadedClips);
          const initialVisible = [...loadedClips].sort((a, b) => a.start - b.start);
          if (initialVisible.length > 0) {
            initialActiveClip = initialVisible[0];
            setActiveClipId(initialVisible[0].id);
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
            if (!f.endsWith('.mp4') || f === 'full.mp4' || f === 'full_video.mp4') return false;
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

        if (isMounted && onClipsLoaded) {
          onClipsLoaded(loadedClips, existingDownloadMap, initialActiveClip);
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
    onSeek(targetStart, true);
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

    onSeek(targetSeek, true);
  };

  // Handler Edit Presisi Milidetik (Start / End)
  // - Nilai input 1 digit otomatis dievaluasi sebagai ratusan (misal '6' -> '60' centiseconds = 600ms)
  // - Nilai input 2 digit (misal '65' centiseconds = 650ms, digit ke-3 otomatis 0)
  // - Seek otomatis mengikuti centralizedSeek yang sudah ter-debounce (500ms trailing)
  const handleMsTimeChange = (type: 'start' | 'end', valStr: string) => {
    const cleaned = valStr.replace(/[^0-9]/g, '').slice(0, 2);
    setTempTimeValue(cleaned);

    if (cleaned === '') return;

    const msStr = cleaned.padEnd(2, '0').slice(0, 2);
    const msValue = parseInt(msStr, 10);
    if (isNaN(msValue)) return;

    const currentActiveId = activeClipIdRef.current || activeClipId;
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
  };

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

      const targetClip = clipsRef.current.find((c) => c.id === clipId);
      if (!targetClip) return;

      // Pindahkan playback sumber secara dinamis (Lokal vs Stream) dan lakukan seek seketika
      syncPlayerSourceForClip(targetClip, true);
    },
    [syncPlayerSourceForClip, setProgressPercent, setCurrentClipTime, seekDebounceTimerRef]
  );

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
          duration: 2500,
        });
      }
    } else {
      // Jika di-toggle off dari done ke none, kembali ke stream YouTube jika sebelumnya memutar file lokal
      if (currentSourceUriRef.current.startsWith('file://')) {
        syncPlayerSourceForClip(targetClip, true);
        ToastManager.show({
          type: 'info',
          title: 'Mode Stream YouTube',
          duration: 2000,
        });
      }
    }
  };

  // Toggle clip Trash/Skip status (merah)
  const handleToggleTrash = () => {
    const currentActiveId = activeClipIdRef.current || activeClipId;
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
  };

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

  // Ubah Jumlah Klip Heatmap yang Terlihat
  const handleSetVisibleHeatmapCount = (count: number) => {
    const validCount = Math.max(1, Math.min(100, count));
    setVisibleHeatmapCount(validCount);
    LocalStorage.setItem(`clipping_visible_count_${videoId}`, String(validCount));

    // Cek apakah klip aktif saat ini masih termasuk dalam daftar klip yang terlihat
    const customClips = clipsRef.current.filter((c) => c.isCustom || c.rank === 'custom');
    const heatmapClips = clipsRef.current
      .filter((c) => !c.isCustom && c.rank !== 'custom')
      .sort((a, b) => {
        const rankA = typeof a.rank === 'number' ? a.rank : 999;
        const rankB = typeof b.rank === 'number' ? b.rank : 999;
        return rankA - rankB;
      })
      .slice(0, validCount);

    const visibleList = [...customClips, ...heatmapClips].sort((a, b) => a.start - b.start);
    const isCurrentStillVisible = visibleList.some((c) => c.id === (activeClipIdRef.current || activeClipId));
    if (!isCurrentStillVisible && visibleList.length > 0) {
      handleSelectClip(visibleList[0].id);
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
  const visibleClips = useMemo(() => {
    const customClips = clips.filter((c) => c.isCustom || c.rank === 'custom');
    const heatmapClips = clips
      .filter((c) => !c.isCustom && c.rank !== 'custom')
      .sort((a, b) => {
        const rankA = typeof a.rank === 'number' ? a.rank : 999;
        const rankB = typeof b.rank === 'number' ? b.rank : 999;
        return rankA - rankB;
      })
      .slice(0, visibleHeatmapCount);

    return [...customClips, ...heatmapClips].sort((a, b) => a.start - b.start);
  }, [clips, visibleHeatmapCount]);

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
