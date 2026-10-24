import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ClipItem,
  ClipTemplateConfig,
  DEFAULT_TEMPLATE_CONFIG,
  loadClipTemplate,
  saveClipTemplate,
  loadVideoGlobalConfig,
  saveVideoGlobalConfig,
} from '../services/api';

export interface UseClipTemplateParams {
  videoId: string;
  activeClip?: ClipItem;
  isDownloaded?: boolean;
}

export function useClipTemplate({ videoId, activeClip, isDownloaded }: UseClipTemplateParams) {
  const [templateConfig, setTemplateConfig] = useState<ClipTemplateConfig>(DEFAULT_TEMPLATE_CONFIG);
  const activeClipRef = useRef<ClipItem | undefined>(activeClip);
  activeClipRef.current = activeClip;

  // Auto-load template dengan hierarki: Global Video Config (Shared Framing) + Clip Specific Overrides
  useEffect(() => {
    let isCurrent = true;
    async function checkSavedTemplate() {
      if (!activeClip || !activeClip.videoId) return;
      try {
        const [clipSaved, globalConf] = await Promise.all([
          loadClipTemplate(activeClip.videoId, activeClip.start, activeClip.end),
          loadVideoGlobalConfig(activeClip.videoId),
        ]);

        if (isCurrent) {
          // 1. Elemen Facecam:
          // enabled: WAJIB per-klip (default false jika klip ini belum menyalakan facecam)
          // zoom, cropX, cropY: Mewarisi global video config jika tersedia
          const mergedFacecam = {
            ...DEFAULT_TEMPLATE_CONFIG.facecam,
            zoom: globalConf?.facecam?.zoom ?? clipSaved?.facecam?.zoom ?? DEFAULT_TEMPLATE_CONFIG.facecam.zoom,
            cropX: globalConf?.facecam?.cropX ?? clipSaved?.facecam?.cropX ?? DEFAULT_TEMPLATE_CONFIG.facecam.cropX,
            cropY: globalConf?.facecam?.cropY ?? clipSaved?.facecam?.cropY ?? DEFAULT_TEMPLATE_CONFIG.facecam.cropY,
            enabled: clipSaved?.facecam?.enabled ?? false,
          };

          // 2. Elemen Main Video:
          // zoom, cropX, cropY: Mewarisi global video config jika tersedia
          const mergedMainVideo = {
            ...DEFAULT_TEMPLATE_CONFIG.mainVideo,
            zoom: globalConf?.mainVideo?.zoom ?? clipSaved?.mainVideo?.zoom ?? DEFAULT_TEMPLATE_CONFIG.mainVideo.zoom,
            cropX: globalConf?.mainVideo?.cropX ?? clipSaved?.mainVideo?.cropX ?? DEFAULT_TEMPLATE_CONFIG.mainVideo.cropX,
            cropY: globalConf?.mainVideo?.cropY ?? clipSaved?.mainVideo?.cropY ?? DEFAULT_TEMPLATE_CONFIG.mainVideo.cropY,
          };

          // 3. Elemen Konteks:
          // enabled: WAJIB per-klip (default false jika belum dinyalakan)
          // text: per-klip
          // fontSize, paddingY & align: Mewarisi global video config jika tersedia
          const mergedContext = {
            ...DEFAULT_TEMPLATE_CONFIG.context,
            fontSize:
              globalConf?.contextStyle?.fontSize ??
              clipSaved?.context?.fontSize ??
              DEFAULT_TEMPLATE_CONFIG.context.fontSize,
            paddingY:
              globalConf?.contextStyle?.paddingY ??
              clipSaved?.context?.paddingY ??
              DEFAULT_TEMPLATE_CONFIG.context.paddingY,
            align:
              globalConf?.contextStyle?.align ??
              clipSaved?.context?.align ??
              DEFAULT_TEMPLATE_CONFIG.context.align,
            enabled: clipSaved?.context?.enabled ?? false,
            text: clipSaved?.context?.text ?? '',
          };

          // 4. Elemen Watermark:
          // Global tingkat video: text, size, x, y (mewarisi global video config)
          // enabled: Bebas dipilih per-klip (bisa tanpa atau dengan watermark)
          const mergedWatermark = {
            ...DEFAULT_TEMPLATE_CONFIG.watermark,
            enabled:
              clipSaved?.watermark?.enabled !== undefined
                ? clipSaved.watermark.enabled
                : globalConf?.watermark?.enabled ?? false,
            text: globalConf?.watermark?.text ?? clipSaved?.watermark?.text ?? '',
            size: globalConf?.watermark?.size ?? clipSaved?.watermark?.size ?? DEFAULT_TEMPLATE_CONFIG.watermark.size,
            x: globalConf?.watermark?.x ?? clipSaved?.watermark?.x ?? DEFAULT_TEMPLATE_CONFIG.watermark.x,
            y: globalConf?.watermark?.y ?? clipSaved?.watermark?.y ?? DEFAULT_TEMPLATE_CONFIG.watermark.y,
          };

          const merged: ClipTemplateConfig = {
            context: mergedContext,
            facecam: mergedFacecam,
            mainVideo: mergedMainVideo,
            watermark: mergedWatermark,
          };
          setTemplateConfig(merged);

          // Seed ke global config jika file global belum ada
          if (!globalConf?.facecam && clipSaved?.facecam) {
            saveVideoGlobalConfig(activeClip.videoId, {
              facecam: {
                zoom: clipSaved.facecam.zoom,
                cropX: clipSaved.facecam.cropX,
                cropY: clipSaved.facecam.cropY,
              },
              mainVideo: clipSaved.mainVideo ? {
                zoom: clipSaved.mainVideo.zoom,
                cropX: clipSaved.mainVideo.cropX,
                cropY: clipSaved.mainVideo.cropY,
              } : undefined,
              contextStyle: {
                fontSize: mergedContext.fontSize,
                paddingY: mergedContext.paddingY,
                align: mergedContext.align,
              },
              watermark: mergedWatermark,
            }).catch(() => {});
          }
        }
      } catch {
        if (isCurrent) {
          setTemplateConfig(DEFAULT_TEMPLATE_CONFIG);
        }
      }
    }
    checkSavedTemplate();
    return () => {
      isCurrent = false;
    };
  }, [activeClip?.videoId, activeClip?.start, activeClip?.end]);

  // Simpan perubahan template ke disk (per-klip)
  const persistTemplate = useCallback(
    (newConfig: ClipTemplateConfig) => {
      const clip = activeClipRef.current;
      if (!clip || !clip.videoId) return;
      saveClipTemplate(clip.videoId, clip.start, clip.end, newConfig).catch(() => {});
    },
    []
  );

  // Update elemen Konteks (teks judul per-klip, tipografi global)
  const handleUpdateContext = useCallback(
    (updates: Partial<ClipTemplateConfig['context']>) => {
      const clip = activeClipRef.current;
      setTemplateConfig((prev) => {
        const next: ClipTemplateConfig = {
          ...prev,
          context: {
            ...prev.context,
            ...updates,
          },
        };
        persistTemplate(next);

        // Jika mengubah fontSize, paddingY, atau align, sinkronkan ke Global Video Config
        if (
          clip &&
          clip.videoId &&
          (updates.fontSize !== undefined || updates.paddingY !== undefined || updates.align !== undefined)
        ) {
          saveVideoGlobalConfig(clip.videoId, {
            contextStyle: {
              fontSize: next.context.fontSize,
              paddingY: next.context.paddingY,
              align: next.context.align,
            },
          }).catch(() => {});
        }

        return next;
      });
    },
    [persistTemplate]
  );

  // Update elemen Facecam (Konstan / Global framing zoom & crop per videoId, enabled per-klip)
  const handleUpdateFacecam = useCallback(
    (updates: Partial<ClipTemplateConfig['facecam']>) => {
      const clip = activeClipRef.current;
      setTemplateConfig((prev) => {
        const updatedFacecam = {
          ...prev.facecam,
          ...updates,
        };
        const next: ClipTemplateConfig = {
          ...prev,
          facecam: updatedFacecam,
        };
        persistTemplate(next);

        // Sinkronkan HANYA properti framing (zoom, cropX, cropY) ke Global Video Config (tanpa enabled flag)
        if (clip && clip.videoId) {
          saveVideoGlobalConfig(clip.videoId, {
            facecam: {
              zoom: updatedFacecam.zoom,
              cropX: updatedFacecam.cropX,
              cropY: updatedFacecam.cropY,
            },
          }).catch(() => {});
        }

        return next;
      });
    },
    [persistTemplate]
  );

  // Update elemen Main Video / Gameplay (Konstan / Global per videoId)
  const handleUpdateMainVideo = useCallback(
    (updates: Partial<ClipTemplateConfig['mainVideo']>) => {
      const clip = activeClipRef.current;
      setTemplateConfig((prev) => {
        const updatedMain = {
          ...prev.mainVideo,
          ...updates,
        };
        const next: ClipTemplateConfig = {
          ...prev,
          mainVideo: updatedMain,
        };
        persistTemplate(next);

        // Sinkronkan HANYA properti framing (zoom, cropX, cropY) ke Global Video Config
        if (clip && clip.videoId) {
          saveVideoGlobalConfig(clip.videoId, {
            mainVideo: {
              zoom: updatedMain.zoom,
              cropX: updatedMain.cropX,
              cropY: updatedMain.cropY,
            },
          }).catch(() => {});
        }

        return next;
      });
    },
    [persistTemplate]
  );

  // Update elemen Watermark (Global tingkat video: enabled, text, size, x, y)
  const handleUpdateWatermark = useCallback(
    (updates: Partial<ClipTemplateConfig['watermark']>) => {
      const clip = activeClipRef.current;
      setTemplateConfig((prev) => {
        const updatedWatermark = {
          ...prev.watermark,
          ...updates,
        };
        const next: ClipTemplateConfig = {
          ...prev,
          watermark: updatedWatermark,
        };
        persistTemplate(next);

        // Karena watermark bersifat global per video, sinkronkan ke Global Video Config
        if (clip && clip.videoId) {
          saveVideoGlobalConfig(clip.videoId, {
            watermark: updatedWatermark,
          }).catch(() => {});
        }

        return next;
      });
    },
    [persistTemplate]
  );

  // Status apakah kanvas berpindah ke mode portrait 9:16
  const isPortrait = useMemo(() => {
    // Syarat mutlak mode portrait 9:16 aktif:
    // 1. Klip harus berstatus 'done' (mode edit)
    // 2. Video klip harus sudah selesai diunduh secara lokal
    // 3. Elemen facecam dinyalakan (facecam.enabled === true) atau konteks dinyalakan (context.enabled === true)
    const isDone = activeClip?.status === 'done';
    if (!isDone || !isDownloaded) {
      return false;
    }
    return Boolean(templateConfig.facecam.enabled || templateConfig.context.enabled);
  }, [activeClip?.status, isDownloaded, templateConfig.facecam.enabled, templateConfig.context.enabled]);

  return {
    templateConfig,
    setTemplateConfig,
    isPortrait,
    handleUpdateContext,
    handleUpdateFacecam,
    handleUpdateMainVideo,
    handleUpdateWatermark,
  };
}
