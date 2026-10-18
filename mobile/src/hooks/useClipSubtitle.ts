import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ClipItem,
  SubtitleCue,
  DEFAULT_SUBTITLE_STYLE,
  loadClipSubtitle,
  saveClipSubtitle,
  fetchSubtitlesForVideo,
  sliceCuesForClip,
  normalizeSingleTrackCues,
} from '../services/api';
import { ToastManager } from '../components/Toast';

export interface UseClipSubtitleParams {
  videoId: string;
  activeClip?: ClipItem;
  subtitlesRef?: React.MutableRefObject<SubtitleCue[]>;
  onSeek?: (timeSec: number, shouldPlay?: boolean) => void;
}

export function useClipSubtitle({
  videoId,
  activeClip,
  subtitlesRef: externalSubtitlesRef,
  onSeek,
}: UseClipSubtitleParams) {
  const [subtitles, setSubtitles] = useState<SubtitleCue[]>([]);
  const [activeSubtitleText, setActiveSubtitleText] = useState<string>('');
  const [isSubtitleVisible, setIsSubtitleVisible] = useState<boolean>(true);
  const [selectedCueId, setSelectedCueId] = useState<string | null>(null);
  const [isFetchingSubtitles, setIsFetchingSubtitles] = useState<boolean>(false);

  const internalSubtitlesRef = useRef<SubtitleCue[]>(subtitles);
  const subtitlesRef = externalSubtitlesRef || internalSubtitlesRef;

  useEffect(() => {
    subtitlesRef.current = subtitles;
  }, [subtitles, subtitlesRef]);

  // Auto-load subtitle yang sudah tersimpan untuk klip aktif
  useEffect(() => {
    let isCurrent = true;
    async function checkSavedSubtitle() {
      if (!activeClip || !activeClip.videoId) return;
      try {
        const saved = await loadClipSubtitle(activeClip.videoId, activeClip.start, activeClip.end);
        if (isCurrent) {
          if (saved && Array.isArray(saved.cues)) {
            const clipDuration = activeClip.end - activeClip.start;
            const normalized = normalizeSingleTrackCues(saved.cues, clipDuration);
            setSubtitles(normalized);
          } else {
            setSubtitles([]);
          }
          setSelectedCueId(null);
        }
      } catch {
        if (isCurrent) {
          setSubtitles([]);
          setSelectedCueId(null);
        }
      }
    }
    checkSavedSubtitle();
    return () => {
      isCurrent = false;
    };
  }, [activeClip?.videoId, activeClip?.start, activeClip?.end]);

  // Tambah cue subtitle baru
  const handleAddCue = useCallback(
    (atTime?: number) => {
      if (!activeClip) return;
      const clipDuration = activeClip.end - activeClip.start;
      const startPos = Math.max(0, Math.min(clipDuration - 0.5, typeof atTime === 'number' ? atTime : 0));
      const endPos = Math.min(clipDuration, startPos + 2.0);

      const newCue: SubtitleCue = {
        id: `cue_${Date.now()}`,
        start: Math.round(startPos * 100) / 100,
        end: Math.round(endPos * 100) / 100,
        rawStart: activeClip.start + startPos,
        rawEnd: activeClip.start + endPos,
        text: 'Teks Subtitle',
        fontSize: 20,
      };

      setSubtitles((prev) => {
        const updated = normalizeSingleTrackCues([...prev, newCue], clipDuration);
        saveClipSubtitle({
          videoId: activeClip.videoId,
          start: activeClip.start,
          end: activeClip.end,
          lang: 'id',
          style: DEFAULT_SUBTITLE_STYLE,
          cues: updated,
          updatedAt: Date.now(),
        }).catch(() => {});
        return updated;
      });

      setSelectedCueId(newCue.id);
      onSeek?.(newCue.start, true);
    },
    [activeClip, onSeek]
  );

  // Update properti cue (teks, ukuran font, start, end)
  const handleUpdateCue = useCallback(
    (id: string, updates: Partial<SubtitleCue>) => {
      if (!activeClip) return;
      const clipDuration = activeClip.end - activeClip.start;

      setSubtitles((prev) => {
        const updated = prev.map((c) => {
          if (c.id === id) {
            const merged = { ...c, ...updates };
            if (typeof updates.text === 'string') {
              merged.text = updates.text.replace(/\r?\n+/g, ' ').trim();
            }
            return merged;
          }
          return c;
        });

        const normalized = normalizeSingleTrackCues(updated, clipDuration);
        saveClipSubtitle({
          videoId: activeClip.videoId,
          start: activeClip.start,
          end: activeClip.end,
          lang: 'id',
          style: DEFAULT_SUBTITLE_STYLE,
          cues: normalized,
          updatedAt: Date.now(),
        }).catch(() => {});
        return normalized;
      });
    },
    [activeClip]
  );

  // Geser titik mulai cue (drag horizontal)
  const handleShiftCueTime = useCallback(
    (id: string, newStart: number) => {
      if (!activeClip) return;
      const clipDuration = activeClip.end - activeClip.start;

      setSubtitles((prev) => {
        const targetCue = prev.find((c) => c.id === id);
        if (!targetCue) return prev;

        const dur = Math.max(0.4, targetCue.end - targetCue.start);
        const clampedStart = Math.max(0, Math.min(clipDuration - dur, newStart));
        const clampedEnd = Math.min(clipDuration, clampedStart + dur);

        const updated = prev.map((c) => {
          if (c.id === id) {
            return {
              ...c,
              start: Math.round(clampedStart * 100) / 100,
              end: Math.round(clampedEnd * 100) / 100,
              rawStart: activeClip.start + clampedStart,
              rawEnd: activeClip.start + clampedEnd,
            };
          }
          return c;
        });

        const normalized = normalizeSingleTrackCues(updated, clipDuration);
        saveClipSubtitle({
          videoId: activeClip.videoId,
          start: activeClip.start,
          end: activeClip.end,
          lang: 'id',
          style: DEFAULT_SUBTITLE_STYLE,
          cues: normalized,
          updatedAt: Date.now(),
        }).catch(() => {});
        return normalized;
      });
    },
    [activeClip]
  );

  // Hapus cue subtitle
  const handleDeleteCue = useCallback(
    (id: string) => {
      if (!activeClip) return;

      setSubtitles((prev) => {
        const filtered = prev.filter((c) => c.id !== id);
        saveClipSubtitle({
          videoId: activeClip.videoId,
          start: activeClip.start,
          end: activeClip.end,
          lang: 'id',
          style: DEFAULT_SUBTITLE_STYLE,
          cues: filtered,
          updatedAt: Date.now(),
        }).catch(() => {});
        return filtered;
      });

      setSelectedCueId((prev) => (prev === id ? null : prev));
    },
    [activeClip]
  );

  // Ambil subtitle otomatis dari YouTube via YT-DLP dengan preferensi bahasa
  const handleFetchSubtitles = useCallback(
    async (preferredLang?: string) => {
      if (!activeClip || !activeClip.videoId) return;
      setIsFetchingSubtitles(true);
      try {
        ToastManager.show({
          type: 'info',
          title: 'Mengambil Subtitle',
          message: `Mengambil track subtitle (${preferredLang || 'auto'})...`,
          duration: 2500,
        });

        const res = await fetchSubtitlesForVideo(activeClip.videoId, preferredLang);
        const sliced = sliceCuesForClip(res.cues, activeClip.start, activeClip.end);
        setSubtitles(sliced);
        setSelectedCueId(null);

        await saveClipSubtitle({
          videoId: activeClip.videoId,
          start: activeClip.start,
          end: activeClip.end,
          lang: res.lang,
          isAuto: res.isAuto,
          style: DEFAULT_SUBTITLE_STYLE,
          cues: sliced,
          updatedAt: Date.now(),
        });

        ToastManager.show({
          type: 'success',
          title: 'Subtitle Ditemukan',
          message: `${sliced.length} cue dimuat (Bahasa: ${res.lang.toUpperCase()}).`,
          duration: 3000,
        });
      } catch (err: any) {
        ToastManager.show({
          type: 'error',
          title: 'Subtitle Tidak Tersedia',
          message: err.message || 'Gagal memuat subtitle dari YouTube.',
          rawError: err.rawError,
          errorCode: err.code,
          duration: 4000,
        });
      } finally {
        setIsFetchingSubtitles(false);
      }
    },
    [activeClip]
  );

  return {
    subtitles,
    setSubtitles,
    activeSubtitleText,
    setActiveSubtitleText,
    isSubtitleVisible,
    setIsSubtitleVisible,
    selectedCueId,
    setSelectedCueId,
    isFetchingSubtitles,
    handleAddCue,
    handleUpdateCue,
    handleShiftCueTime,
    handleDeleteCue,
    handleFetchSubtitles,
    subtitlesRef,
  };
}
