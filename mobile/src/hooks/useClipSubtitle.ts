import { useState, useEffect, useRef, useCallback } from 'react';
import * as FileSystem from 'expo-file-system';
import {
  ClipItem,
  SubtitleCue,
  DEFAULT_SUBTITLE_STYLE,
  loadClipSubtitle,
  saveClipSubtitle,
  loadVideoGlobalConfig,
  saveVideoGlobalConfig,
  fetchSubtitlesForVideo,
  sliceCuesForClip,
  normalizeSingleTrackCues,
  burnClipSubtitles,
  resolvePlayableClipUri,
  getClipOutputFilePath,
  getClipInternalOutputFilePath,
  getSubtitledClipOutputFilePath,
  ClipSubtitleData,
  ClipTemplateConfig,
  DEFAULT_TEMPLATE_CONFIG,
  loadClipTemplate,
} from '../services/api';
import { ToastManager } from '../components/Toast';

export interface UseClipSubtitleParams {
  videoId: string;
  activeClip?: ClipItem;
  subtitlesRef?: React.MutableRefObject<SubtitleCue[]>;
  templateConfig?: ClipTemplateConfig;
  onSeek?: (timeSec: number, shouldPlay?: boolean) => void;
}

export function useClipSubtitle({
  videoId,
  activeClip,
  subtitlesRef: externalSubtitlesRef,
  templateConfig,
  onSeek,
}: UseClipSubtitleParams) {
  const [subtitles, setSubtitles] = useState<SubtitleCue[]>([]);
  const [activeSubtitleText, setActiveSubtitleText] = useState<string>('');
  const [isSubtitleVisible, setIsSubtitleVisible] = useState<boolean>(true);
  const [selectedCueId, setSelectedCueId] = useState<string | null>(null);
  const [isFetchingSubtitles, setIsFetchingSubtitles] = useState<boolean>(false);
  const [isExportingSubtitle, setIsExportingSubtitle] = useState<boolean>(false);
  const [subtitlePosition, setSubtitlePosition] = useState<{ x: number; y: number }>({ x: 50, y: 85 });

  const internalSubtitlesRef = useRef<SubtitleCue[]>(subtitles);
  const subtitlePosRef = useRef<{ x: number; y: number }>(subtitlePosition);
  const subtitlesRef = externalSubtitlesRef || internalSubtitlesRef;

  useEffect(() => {
    subtitlesRef.current = subtitles;
    internalSubtitlesRef.current = subtitles;
  }, [subtitles, subtitlesRef]);

  useEffect(() => {
    subtitlePosRef.current = subtitlePosition;
  }, [subtitlePosition]);

  // Auto-load subtitle: Cues spesifik per-klip, sedangkan posisi (X/Y) konstan global per video
  useEffect(() => {
    let isCurrent = true;
    async function checkSavedSubtitle() {
      if (!activeClip || !activeClip.videoId) return;
      try {
        const [saved, globalConf] = await Promise.all([
          loadClipSubtitle(activeClip.videoId, activeClip.start, activeClip.end),
          loadVideoGlobalConfig(activeClip.videoId),
        ]);

        if (isCurrent) {
          if (saved && Array.isArray(saved.cues)) {
            const clipDuration = activeClip.end - activeClip.start;
            const normalized = normalizeSingleTrackCues(saved.cues, clipDuration);
            setSubtitles(normalized);
          } else {
            setSubtitles([]);
          }

          // Posisi Subtitle: Mewarisi Global Video Config agar konsisten di seluruh klip
          let posX = 50;
          let posY = 85;
          if (globalConf?.subtitlePosition) {
            posX = globalConf.subtitlePosition.x;
            posY = globalConf.subtitlePosition.y;
          } else if (saved && saved.style) {
            const rawX = typeof saved.style.positionX === 'number' ? saved.style.positionX : 50;
            const rawY = typeof saved.style.positionY === 'number' ? saved.style.positionY : 85;
            posX = rawX <= 1 && rawX > 0 ? Math.round(rawX * 100) : rawX;
            posY = rawY <= 1 && rawY > 0 ? Math.round(rawY * 100) : rawY;
            // Backfill ke global config
            saveVideoGlobalConfig(activeClip.videoId, { subtitlePosition: { x: posX, y: posY } }).catch(() => {});
          }
          setSubtitlePosition({ x: posX, y: posY });
          subtitlePosRef.current = { x: posX, y: posY };

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
      };

      setSubtitles((prev) => {
        const updated = normalizeSingleTrackCues([...prev, newCue], clipDuration);
        saveClipSubtitle({
          videoId: activeClip.videoId,
          start: activeClip.start,
          end: activeClip.end,
          lang: 'id',
          style: {
            ...DEFAULT_SUBTITLE_STYLE,
            positionX: subtitlePosRef.current.x,
            positionY: subtitlePosRef.current.y,
          },
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
              merged.text = updates.text.replace(/\r/g, '').trim();
            }
            if (typeof updates.start === 'number' || typeof updates.end === 'number') {
              merged.rawStart = activeClip.start + (typeof updates.start === 'number' ? updates.start : merged.start);
              merged.rawEnd = activeClip.start + (typeof updates.end === 'number' ? updates.end : merged.end);
            }
            if ('fontSize' in updates) {
              if (updates.fontSize === undefined || updates.fontSize === 14) {
                delete merged.fontSize;
              } else {
                merged.fontSize = updates.fontSize;
              }
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
          style: {
            ...DEFAULT_SUBTITLE_STYLE,
            positionX: subtitlePosRef.current.x,
            positionY: subtitlePosRef.current.y,
          },
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
          style: {
            ...DEFAULT_SUBTITLE_STYLE,
            positionX: subtitlePosRef.current.x,
            positionY: subtitlePosRef.current.y,
          },
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

        saveClipSubtitle({
          videoId: activeClip.videoId,
          start: activeClip.start,
          end: activeClip.end,
          lang: res.lang,
          isAuto: res.isAuto,
          style: DEFAULT_SUBTITLE_STYLE,
          cues: sliced,
          updatedAt: Date.now(),
        }).catch((e) => console.warn('[useClipSubtitle] Gagal auto-save subtitle:', e));

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

  // Update posisi subtitle secara global (skala 0 - 100 terhadap frame video)
  const handleUpdateSubtitlePosition = useCallback(
    (x: number, y: number) => {
      setSubtitlePosition({ x, y });
      subtitlePosRef.current = { x, y };
      if (activeClip && activeClip.videoId) {
        // Simpan ke Global Video Config (video_config.json) agar seluruh klip lain di video ini otomatis mewarisi
        saveVideoGlobalConfig(activeClip.videoId, { subtitlePosition: { x, y } }).catch(() => {});

        const currentCues =
          subtitlesRef.current && subtitlesRef.current.length > 0
            ? subtitlesRef.current
            : subtitles;
        saveClipSubtitle({
          videoId: activeClip.videoId,
          start: activeClip.start,
          end: activeClip.end,
          lang: 'id',
          style: {
            ...DEFAULT_SUBTITLE_STYLE,
            positionX: x,
            positionY: y,
          },
          cues: currentCues,
          updatedAt: Date.now(),
        }).catch(() => {});
      }
    },
    [activeClip, subtitles, subtitlesRef]
  );

  // Ekspor klip baru dengan subtitle tertempel permanen via FFmpeg
  const handleExportSubtitledVideo = useCallback(async () => {
    if (!activeClip || !activeClip.videoId) return;

    // 1. Ambil cue saat ini: Cek ref terlebih dahulu, fallback ke state subtitles
    let currentCues =
      subtitlesRef.current && subtitlesRef.current.length > 0
        ? subtitlesRef.current
        : subtitles;

    // 2. Jika ref dan state masih kosong, baca langsung dari disk (loadClipSubtitle)
    if (!currentCues || currentCues.length === 0) {
      try {
        const saved = await loadClipSubtitle(activeClip.videoId, activeClip.start, activeClip.end);
        if (saved && Array.isArray(saved.cues) && saved.cues.length > 0) {
          const clipDuration = activeClip.end - activeClip.start;
          const normalized = normalizeSingleTrackCues(saved.cues, clipDuration);
          currentCues = normalized;
          subtitlesRef.current = normalized;
          internalSubtitlesRef.current = normalized;
          setSubtitles(normalized);
        }
      } catch (err) {
        console.warn('[handleExportSubtitledVideo] Gagal memuat subtitle dari disk:', err);
      }
    }

    // 3. Resolusi Konfigurasi Template (Memory State atau Disk Fallback)
    let activeTemplateConfig = templateConfig;
    if (
      !activeTemplateConfig ||
      (!activeTemplateConfig.context.enabled &&
        !activeTemplateConfig.facecam.enabled &&
        !activeTemplateConfig.watermark?.enabled)
    ) {
      try {
        const savedTemplate = await loadClipTemplate(activeClip.videoId, activeClip.start, activeClip.end);
        const globalConfig = await loadVideoGlobalConfig(activeClip.videoId);
        if (savedTemplate || globalConfig) {
          activeTemplateConfig = {
            context: savedTemplate?.context || DEFAULT_TEMPLATE_CONFIG.context,
            facecam: {
              ...DEFAULT_TEMPLATE_CONFIG.facecam,
              zoom: globalConfig?.facecam?.zoom ?? savedTemplate?.facecam?.zoom ?? DEFAULT_TEMPLATE_CONFIG.facecam.zoom,
              cropX: globalConfig?.facecam?.cropX ?? savedTemplate?.facecam?.cropX ?? DEFAULT_TEMPLATE_CONFIG.facecam.cropX,
              cropY: globalConfig?.facecam?.cropY ?? savedTemplate?.facecam?.cropY ?? DEFAULT_TEMPLATE_CONFIG.facecam.cropY,
              ratioWidth: globalConfig?.facecam?.ratioWidth ?? savedTemplate?.facecam?.ratioWidth ?? DEFAULT_TEMPLATE_CONFIG.facecam.ratioWidth,
              ratioHeight: globalConfig?.facecam?.ratioHeight ?? savedTemplate?.facecam?.ratioHeight ?? DEFAULT_TEMPLATE_CONFIG.facecam.ratioHeight,
              enabled: savedTemplate?.facecam?.enabled ?? false,
            },
            mainVideo: {
              ...DEFAULT_TEMPLATE_CONFIG.mainVideo,
              zoom: globalConfig?.mainVideo?.zoom ?? savedTemplate?.mainVideo?.zoom ?? DEFAULT_TEMPLATE_CONFIG.mainVideo.zoom,
              cropX: globalConfig?.mainVideo?.cropX ?? savedTemplate?.mainVideo?.cropX ?? DEFAULT_TEMPLATE_CONFIG.mainVideo.cropX,
              cropY: globalConfig?.mainVideo?.cropY ?? savedTemplate?.mainVideo?.cropY ?? DEFAULT_TEMPLATE_CONFIG.mainVideo.cropY,
              ratioWidth: globalConfig?.mainVideo?.ratioWidth ?? savedTemplate?.mainVideo?.ratioWidth ?? DEFAULT_TEMPLATE_CONFIG.mainVideo.ratioWidth,
              ratioHeight: globalConfig?.mainVideo?.ratioHeight ?? savedTemplate?.mainVideo?.ratioHeight ?? DEFAULT_TEMPLATE_CONFIG.mainVideo.ratioHeight,
              enabled: savedTemplate?.mainVideo?.enabled !== undefined ? savedTemplate.mainVideo.enabled : true,
            },
            watermark: {
              ...DEFAULT_TEMPLATE_CONFIG.watermark,
              enabled: globalConfig?.watermark?.enabled ?? savedTemplate?.watermark?.enabled ?? false,
              text: globalConfig?.watermark?.text ?? savedTemplate?.watermark?.text ?? '',
              size: globalConfig?.watermark?.size ?? savedTemplate?.watermark?.size ?? DEFAULT_TEMPLATE_CONFIG.watermark.size,
              x: globalConfig?.watermark?.x ?? savedTemplate?.watermark?.x ?? DEFAULT_TEMPLATE_CONFIG.watermark.x,
              y: globalConfig?.watermark?.y ?? savedTemplate?.watermark?.y ?? DEFAULT_TEMPLATE_CONFIG.watermark.y,
            },
          };
        }
      } catch (e) {}
    }

    const hasTemplate = Boolean(
      activeTemplateConfig &&
        (activeTemplateConfig.facecam?.enabled ||
          activeTemplateConfig.context?.enabled ||
          activeTemplateConfig.mainVideo?.enabled === false ||
          (activeTemplateConfig.watermark?.enabled && Boolean(activeTemplateConfig.watermark?.text?.trim())) ||
          (activeTemplateConfig.facecam?.ratioWidth && activeTemplateConfig.facecam?.ratioHeight) ||
          (activeTemplateConfig.mainVideo?.ratioWidth && activeTemplateConfig.mainVideo?.ratioHeight))
    );

    if ((!currentCues || currentCues.length === 0) && !hasTemplate) {
      ToastManager.show({
        type: 'info',
        title: 'Konten Kosong',
        message: 'Klip ini belum memiliki subtitle atau konfigurasi template untuk diekspor.',
        duration: 3000,
      });
      return;
    }

    // 4. Resolusi video input lokal (resolvePlayableClipUri)
    let inputVideoPath = '';
    try {
      const resolvedUri = await resolvePlayableClipUri(
        activeClip.videoId,
        activeClip.start,
        activeClip.end,
        activeClip.rank
      );
      if (resolvedUri && resolvedUri.startsWith('file://')) {
        inputVideoPath = resolvedUri.replace('file://', '');
      }
    } catch {}

    // Fallback direct check jika resolvePlayableClipUri belum mengembalikan path lokal
    if (!inputVideoPath) {
      const sharedTarget = getClipOutputFilePath(activeClip.videoId, activeClip.start, activeClip.end, activeClip.rank);
      const internalTarget = getClipInternalOutputFilePath(activeClip.videoId, activeClip.start, activeClip.end, activeClip.rank);
      try {
        const sharedInfo = await FileSystem.getInfoAsync(sharedTarget.fileUri);
        if (sharedInfo.exists) {
          inputVideoPath = sharedTarget.nativePath;
        } else {
          const internalInfo = await FileSystem.getInfoAsync(internalTarget.fileUri);
          if (internalInfo.exists) {
            inputVideoPath = internalTarget.nativePath;
          }
        }
      } catch {}
    }

    if (!inputVideoPath) {
      ToastManager.show({
        type: 'error',
        title: 'Video Belum Diunduh',
        message: 'File klip lokal tidak ditemukan. Silakan unduh klip terlebih dahulu.',
        duration: 4000,
      });
      return;
    }

    setIsExportingSubtitle(true);
    ToastManager.show({
      type: 'info',
      title: hasTemplate ? 'Mengekspor Template & Subtitle' : 'Mengekspor Subtitle',
      message: hasTemplate
        ? 'Sedang memproses 1-pass multi-layer template & subtitle via FFmpeg...'
        : 'Sedang menempelkan subtitle ke video via FFmpeg...',
      duration: 3500,
    });

    try {
      const targetOutput = getSubtitledClipOutputFilePath(
        activeClip.videoId,
        activeClip.start,
        activeClip.end
      );

      const subtitleData: ClipSubtitleData = {
        videoId: activeClip.videoId,
        start: activeClip.start,
        end: activeClip.end,
        lang: 'id',
        style: {
          ...DEFAULT_SUBTITLE_STYLE,
          positionX: subtitlePosRef.current.x,
          positionY: subtitlePosRef.current.y,
        },
        cues: currentCues,
        updatedAt: Date.now(),
      };

      const result = await burnClipSubtitles({
        videoId: activeClip.videoId,
        start: activeClip.start,
        end: activeClip.end,
        inputVideoPath,
        outputVideoPath: targetOutput.nativePath,
        subtitleData,
        templateData: activeTemplateConfig,
        duration: activeClip.end - activeClip.start,
      });

      const filename = result.outputPath.split(/[/\\]/).pop() || 'video';
      ToastManager.show({
        type: 'success',
        title: 'Ekspor Berhasil!',
        message: `Tersimpan: ${filename}`,
        duration: 4000,
      });
    } catch (err: any) {
      ToastManager.show({
        type: 'error',
        title: 'Ekspor Gagal',
        message: err.message || 'Gagal memproses ekspor video.',
        rawError: err.rawError,
        errorCode: err.code,
        duration: 5000,
      });
    } finally {
      setIsExportingSubtitle(false);
    }
  }, [activeClip, subtitles, subtitlesRef, templateConfig]);

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
    isExportingSubtitle,
    subtitlePosition,
    handleUpdateSubtitlePosition,
    handleAddCue,
    handleUpdateCue,
    handleShiftCueTime,
    handleDeleteCue,
    handleFetchSubtitles,
    handleExportSubtitledVideo,
    subtitlesRef,
  };
}
