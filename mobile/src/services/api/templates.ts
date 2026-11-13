import * as FileSystem from 'expo-file-system/legacy';
import { getClipTemplateFilePath, getVideoGlobalConfigFilePath } from './paths';
import { ClipTemplateConfig, DEFAULT_TEMPLATE_CONFIG, VideoGlobalConfig } from './types';

export { DEFAULT_TEMPLATE_CONFIG };

export async function loadClipTemplate(
  videoId: string,
  start: number,
  end: number
): Promise<ClipTemplateConfig | null> {
  const { fileUri } = getClipTemplateFilePath(videoId, start, end);
  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    if (info.exists && !info.isDirectory) {
      const content = await FileSystem.readAsStringAsync(fileUri);
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') {
        return {
          context: {
            ...DEFAULT_TEMPLATE_CONFIG.context,
            ...(parsed.context || {}),
          },
          facecam: {
            ...DEFAULT_TEMPLATE_CONFIG.facecam,
            ...(parsed.facecam || {}),
          },
          mainVideo: {
            ...DEFAULT_TEMPLATE_CONFIG.mainVideo,
            ...(parsed.mainVideo || {}),
          },
          watermark: {
            ...DEFAULT_TEMPLATE_CONFIG.watermark,
            ...(parsed.watermark || {}),
          },
        };
      }
    }
  } catch {}
  return null;
}

export async function saveClipTemplate(
  videoId: string,
  start: number,
  end: number,
  config: ClipTemplateConfig
): Promise<void> {
  const { fileUri } = getClipTemplateFilePath(videoId, start, end);
  const folderUri = fileUri.substring(0, fileUri.lastIndexOf('/'));
  const dirInfo = await FileSystem.getInfoAsync(folderUri);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(folderUri, { intermediates: true });
  }
  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(config, null, 2));
}

export async function deleteClipTemplate(
  videoId: string,
  start: number,
  end: number
): Promise<boolean> {
  const { fileUri } = getClipTemplateFilePath(videoId, start, end);
  try {
    await FileSystem.deleteAsync(fileUri, { idempotent: true });
    return true;
  } catch {
    return false;
  }
}

// In-Memory map untuk video global config
export const VIDEO_GLOBAL_CONFIG_MEMORY_MAP = new Map<string, VideoGlobalConfig>();

/**
 * Membaca konfigurasi global tingkat video (posisi subtitle, crop/zoom facecam & main video).
 * Menggunakan Tier 1 in-memory map untuk instant 0ms switching antar klip,
 * dan Tier 2 internal storage (video_config.json) untuk persistensi disk.
 */
export async function loadVideoGlobalConfig(videoId: string): Promise<VideoGlobalConfig | null> {
  if (!videoId) return null;
  if (VIDEO_GLOBAL_CONFIG_MEMORY_MAP.has(videoId)) {
    return VIDEO_GLOBAL_CONFIG_MEMORY_MAP.get(videoId)!;
  }

  const { fileUri } = getVideoGlobalConfigFilePath(videoId);
  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    if (info.exists && !info.isDirectory) {
      const content = await FileSystem.readAsStringAsync(fileUri);
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') {
        VIDEO_GLOBAL_CONFIG_MEMORY_MAP.set(videoId, parsed);
        return parsed as VideoGlobalConfig;
      }
    }
  } catch {}
  return null;
}

/**
 * Menyimpan konfigurasi global tingkat video.
 * Otomatis memperbarui in-memory map dan menulis ke video_config.json secara asynchronous.
 */
export async function saveVideoGlobalConfig(
  videoId: string,
  updates: Partial<VideoGlobalConfig>
): Promise<VideoGlobalConfig> {
  if (!videoId) throw new Error('videoId wajib disertakan');
  const current = (await loadVideoGlobalConfig(videoId)) || {};

  const merged: VideoGlobalConfig = {
    ...current,
    ...updates,
    subtitlePosition: updates.subtitlePosition || current.subtitlePosition,
    facecam: updates.facecam
      ? {
          zoom: updates.facecam.zoom ?? current.facecam?.zoom ?? DEFAULT_TEMPLATE_CONFIG.facecam.zoom,
          cropX: updates.facecam.cropX ?? current.facecam?.cropX ?? DEFAULT_TEMPLATE_CONFIG.facecam.cropX,
          cropY: updates.facecam.cropY ?? current.facecam?.cropY ?? DEFAULT_TEMPLATE_CONFIG.facecam.cropY,
          ratioWidth: updates.facecam.ratioWidth ?? current.facecam?.ratioWidth ?? DEFAULT_TEMPLATE_CONFIG.facecam.ratioWidth,
          ratioHeight: updates.facecam.ratioHeight ?? current.facecam?.ratioHeight ?? DEFAULT_TEMPLATE_CONFIG.facecam.ratioHeight,
        }
      : current.facecam,
    mainVideo: updates.mainVideo
      ? {
          zoom: updates.mainVideo.zoom ?? current.mainVideo?.zoom ?? DEFAULT_TEMPLATE_CONFIG.mainVideo.zoom,
          cropX: updates.mainVideo.cropX ?? current.mainVideo?.cropX ?? DEFAULT_TEMPLATE_CONFIG.mainVideo.cropX,
          cropY: updates.mainVideo.cropY ?? current.mainVideo?.cropY ?? DEFAULT_TEMPLATE_CONFIG.mainVideo.cropY,
          ratioWidth: updates.mainVideo.ratioWidth ?? current.mainVideo?.ratioWidth ?? DEFAULT_TEMPLATE_CONFIG.mainVideo.ratioWidth,
          ratioHeight: updates.mainVideo.ratioHeight ?? current.mainVideo?.ratioHeight ?? DEFAULT_TEMPLATE_CONFIG.mainVideo.ratioHeight,
        }
      : current.mainVideo,
    contextStyle: updates.contextStyle
      ? { ...(current.contextStyle || { fontSize: 16, paddingY: 10, align: 'start' }), ...updates.contextStyle }
      : current.contextStyle,
    watermark: updates.watermark
      ? {
          enabled: updates.watermark.enabled ?? current.watermark?.enabled ?? false,
          text: updates.watermark.text ?? current.watermark?.text ?? '',
          size: updates.watermark.size ?? current.watermark?.size ?? DEFAULT_TEMPLATE_CONFIG.watermark.size,
          x: updates.watermark.x ?? current.watermark?.x ?? DEFAULT_TEMPLATE_CONFIG.watermark.x,
          y: updates.watermark.y ?? current.watermark?.y ?? DEFAULT_TEMPLATE_CONFIG.watermark.y,
        }
      : current.watermark,
    updatedAt: Date.now(),
  };

  VIDEO_GLOBAL_CONFIG_MEMORY_MAP.set(videoId, merged);

  try {
    const { fileUri } = getVideoGlobalConfigFilePath(videoId);
    const folderUri = fileUri.substring(0, fileUri.lastIndexOf('/'));
    const dirInfo = await FileSystem.getInfoAsync(folderUri);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(folderUri, { intermediates: true });
    }
    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(merged, null, 2));
  } catch (err) {
    console.warn('[saveVideoGlobalConfig] Gagal menyimpan video_config.json:', err);
  }

  return merged;
}
