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
}: UseClipDataParams) {
  const DRAFT_KEY = `clips_draft_${videoId}`;

  const [clips, setClips] = useState<ClipItem[]>([]);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Memuat data klip...');

  // State Edit Presisi Milidetik (Mode Klip)
  const [activeTimeEdit, setActiveTimeEdit] = useState<'start' | 'end' | null>(null);
  const [tempTimeValue, setTempTimeValue] = useState<string>('');

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

        if (isMounted && onClipsLoaded) {
          onClipsLoaded(loadedClips, existingDownloadMap, initialActiveClip);
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

  // Group clips into pairs (columns of 2 rows) sorted chronologically (memoized agar tidak di-recompute setiap tick)
  const sortedClips = useMemo(() => [...clips].sort((a, b) => a.start - b.start), [clips]);
  const clipColumns = useMemo(() => {
    const cols: ClipItem[][] = [];
    for (let i = 0; i < sortedClips.length; i += 2) {
      cols.push(sortedClips.slice(i, i + 2));
    }
    return cols;
  }, [sortedClips]);

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
  };
}
