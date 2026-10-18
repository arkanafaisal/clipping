import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ClipItem,
  ClipTemplateConfig,
  DEFAULT_TEMPLATE_CONFIG,
  loadClipTemplate,
  saveClipTemplate,
} from '../services/api';

export interface UseClipTemplateParams {
  videoId: string;
  activeClip?: ClipItem;
}

export function useClipTemplate({ videoId, activeClip }: UseClipTemplateParams) {
  const [templateConfig, setTemplateConfig] = useState<ClipTemplateConfig>(DEFAULT_TEMPLATE_CONFIG);
  const activeClipRef = useRef<ClipItem | undefined>(activeClip);
  activeClipRef.current = activeClip;

  // Auto-load template tersimpan saat klip aktif berubah
  useEffect(() => {
    let isCurrent = true;
    async function checkSavedTemplate() {
      if (!activeClip || !activeClip.videoId) return;
      try {
        const saved = await loadClipTemplate(activeClip.videoId, activeClip.start, activeClip.end);
        if (isCurrent) {
          if (saved) {
            setTemplateConfig(saved);
          } else {
            setTemplateConfig(DEFAULT_TEMPLATE_CONFIG);
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

  // Simpan perubahan template ke disk
  const persistTemplate = useCallback(
    (newConfig: ClipTemplateConfig) => {
      const clip = activeClipRef.current;
      if (!clip || !clip.videoId) return;
      saveClipTemplate(clip.videoId, clip.start, clip.end, newConfig).catch(() => {});
    },
    []
  );

  const handleUpdateContext = useCallback(
    (updates: Partial<ClipTemplateConfig['context']>) => {
      setTemplateConfig((prev) => {
        const next: ClipTemplateConfig = {
          ...prev,
          context: {
            ...prev.context,
            ...updates,
          },
        };
        persistTemplate(next);
        return next;
      });
    },
    [persistTemplate]
  );

  const handleUpdateFacecam = useCallback(
    (updates: Partial<ClipTemplateConfig['facecam']>) => {
      setTemplateConfig((prev) => {
        const next: ClipTemplateConfig = {
          ...prev,
          facecam: {
            ...prev.facecam,
            ...updates,
          },
        };
        persistTemplate(next);
        return next;
      });
    },
    [persistTemplate]
  );

  const handleUpdateMainVideo = useCallback(
    (updates: Partial<ClipTemplateConfig['mainVideo']>) => {
      setTemplateConfig((prev) => {
        const next: ClipTemplateConfig = {
          ...prev,
          mainVideo: {
            ...prev.mainVideo,
            ...updates,
          },
        };
        persistTemplate(next);
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
