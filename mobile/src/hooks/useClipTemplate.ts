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
}

export function useClipTemplate({ videoId, activeClip }: UseClipTemplateParams) {
  const [templateConfig, setTemplateConfig] = useState<ClipTemplateConfig>(DEFAULT_TEMPLATE_CONFIG);
  const activeClipRef = useRef<ClipItem | undefined>(activeClip);
  activeClipRef.current = activeClip;

  // Auto-load template dengan hierarki: Global Video Config (Shared) + Clip Specific Overrides
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
          // 1. Elemen Facecam & Main Video: Mewarisi konfigurasi global video
          const mergedFacecam = {
            ...DEFAULT_TEMPLATE_CONFIG.facecam,
            ...(globalConf?.facecam ?? clipSaved?.facecam ?? {}),
          };
          const mergedMainVideo = {
            ...DEFAULT_TEMPLATE_CONFIG.mainVideo,
            ...(globalConf?.mainVideo ?? clipSaved?.mainVideo ?? {}),
          };

          // 2. Elemen Konteks: Gaya teks (fontSize/padding) mewarisi global, isi teks & status spesifik klip
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
            enabled: clipSaved?.context?.enabled ?? Boolean(clipSaved?.context?.text),
            text: clipSaved?.context?.text ?? '',
          };

          const merged: ClipTemplateConfig = {
            context: mergedContext,
            facecam: mergedFacecam,
            mainVideo: mergedMainVideo,
          };
          setTemplateConfig(merged);

          // Seed ke global config jika file global belum ada tetapi klip ini memiliki konfigurasi
          if (!globalConf?.facecam && clipSaved?.facecam) {
            saveVideoGlobalConfig(activeClip.videoId, {
              facecam: clipSaved.facecam,
              mainVideo: clipSaved.mainVideo,
              contextStyle: {
                fontSize: mergedContext.fontSize,
                paddingY: mergedContext.paddingY,
              },
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

        // Jika mengubah fontSize atau paddingY, sinkronkan ke Global Video Config
        if (clip && clip.videoId && (updates.fontSize !== undefined || updates.paddingY !== undefined)) {
          saveVideoGlobalConfig(clip.videoId, {
            contextStyle: {
              fontSize: next.context.fontSize,
              paddingY: next.context.paddingY,
            },
          }).catch(() => {});
        }

        return next;
      });
    },
    [persistTemplate]
  );

  // Update elemen Facecam (Konstan / Global per videoId)
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

        // Sinkronkan ke Global Video Config agar seluruh klip lain di video ini otomatis mewarisi
        if (clip && clip.videoId) {
          saveVideoGlobalConfig(clip.videoId, {
            facecam: updatedFacecam,
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

        // Sinkronkan ke Global Video Config agar seluruh klip lain di video ini otomatis mewarisi
        if (clip && clip.videoId) {
          saveVideoGlobalConfig(clip.videoId, {
            mainVideo: updatedMain,
          }).catch(() => {});
        }

        return next;
      });
    },
    [persistTemplate]
  );

  // Status apakah kanvas berpindah ke mode portrait 9:16
  const isPortrait = useMemo(() => {
    return templateConfig.context.enabled || templateConfig.facecam.enabled;
  }, [templateConfig.context.enabled, templateConfig.facecam.enabled]);

  return {
    templateConfig,
    setTemplateConfig,
    isPortrait,
    handleUpdateContext,
    handleUpdateFacecam,
    handleUpdateMainVideo,
  };
}
