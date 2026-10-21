import { useState, useEffect, useRef, useCallback } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import {
  ClipItem,
  downloadClip,
  getClipOutputFilePath,
  checkClipFileExists,
} from '../services/api';
import { LocalStorage } from '../services/storage';
import { ToastManager } from '../components/Toast';

export interface UseClipDownloadParams {
  videoId: string;
  activeClip?: ClipItem;
  activeClipId?: string | null;
  clipsRef: React.MutableRefObject<ClipItem[]>;
  activeClipIdRef: React.MutableRefObject<string | null>;
  setClips: React.Dispatch<React.SetStateAction<ClipItem[]>>;
  syncPlayerSourceForClip?: (clip: ClipItem, autoPlay?: boolean) => Promise<void>;
  onUpdateWorkshopDone?: (videoId: string, doneCount: number) => void;
  downloadedClipsRef?: React.MutableRefObject<Record<string, boolean>>;
}

export function useClipDownload({
  videoId,
  activeClip,
  activeClipId,
  clipsRef,
  activeClipIdRef,
  setClips,
  syncPlayerSourceForClip,
  onUpdateWorkshopDone,
  downloadedClipsRef: externalDownloadedClipsRef,
}: UseClipDownloadParams) {
  const [downloadingClips, setDownloadingClips] = useState<Record<string, boolean>>({});
  const [downloadedClips, setDownloadedClips] = useState<Record<string, boolean>>({});
  const [downloadProgress, setDownloadProgress] = useState<
    Record<string, { stage: string; code: string; percent: number }>
  >({});
  const activeDownloadPollersRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const internalDownloadedClipsRef = useRef<Record<string, boolean>>(downloadedClips);
  const downloadedClipsRef = externalDownloadedClipsRef || internalDownloadedClipsRef;

  useEffect(() => {
    downloadedClipsRef.current = downloadedClips;
  }, [downloadedClips, downloadedClipsRef]);

  // Cleanup active download pollers on unmount
  useEffect(() => {
    return () => {
      Object.values(activeDownloadPollersRef.current).forEach((intervalId) => clearInterval(intervalId));
    };
  }, []);

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
  }, [activeClipId, activeClip?.status, activeClip?.start, activeClip?.end, videoId]);

  const getDownloadProgressLabel = useCallback(
    (info?: { stage: string; code: string; percent: number }): string => {
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
    },
    []
  );

  // Download clip handler (Non-blocking background download dengan in-memory cache & progress polling)
  const handleDownloadClip = useCallback(async () => {
    if (!activeClip || activeClip.status !== 'done') return;
    const clipId = activeClip.id;

    if (downloadedClips[clipId]) {
      ToastManager.show({
        type: 'info',
        title: 'Klip Sudah Ada',
        duration: 2500,
      });
      return;
    }

    if (downloadingClips[clipId]) {
      ToastManager.show({
        type: 'info',
        title: 'Sedang Mengunduh Klip',
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
      duration: 2500,
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
      const DRAFT_KEY = `clips_draft_${videoId}`;
      await LocalStorage.setItem(DRAFT_KEY, JSON.stringify(updated));
      const doneCount = updated.filter((c) => c.status === 'done').length;
      onUpdateWorkshopDone?.(videoId, doneCount);

      // Jika klip yang baru selesai diunduh adalah klip yang sedang aktif ditonton, langsung switch ke local playback
      const currentActiveId = activeClipIdRef.current || activeClipId;
      if (currentActiveId === clipId) {
        syncPlayerSourceForClip?.({ ...activeClip, status: 'done' }, true);
      }

      ToastManager.show({
        type: 'success',
        title: 'Unduh Klip Berhasil',
        duration: 3000,
      });
    } catch (err: any) {
      setDownloadingClips((prev) => ({ ...prev, [clipId]: false }));
      ToastManager.show({
        type: 'error',
        title: 'Unduh Klip Gagal',
        rawError: err.rawError || err.message,
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
  }, [
    activeClip,
    downloadedClips,
    downloadingClips,
    videoId,
    clipsRef,
    setClips,
    onUpdateWorkshopDone,
    activeClipIdRef,
    activeClipId,
    syncPlayerSourceForClip,
    downloadedClipsRef,
  ]);

  return {
    downloadingClips,
    setDownloadingClips,
    downloadedClips,
    setDownloadedClips,
    downloadProgress,
    setDownloadProgress,
    downloadedClipsRef,
    getDownloadProgressLabel,
    handleDownloadClip,
  };
}
