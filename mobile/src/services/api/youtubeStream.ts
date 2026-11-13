import { Platform } from 'react-native';
import { LocalStorage } from '../storage';
import {
  STREAM_YTDL_OPTS,
  HEATMAP_YTDL_OPTS,
  QUALITY_STREAM_YTDL_OPTS,
} from '../../constants/ytdlp';
import { isPythonInitialized, executePythonScript } from '../../../modules/python-runner';
import { ApiError } from './errors';
import { DEV_API_BASE_URL } from './client';
import { getValidCookiesPath } from './cookies';
import { VideoVersionItem, CachedQualityUrl, HeatmapResponse, ClipItem } from './types';

// In-Memory Quality URL Cache Map: Key = `${videoId}:${qualityId}`, Value = direct string (progressive) or DASH object
export const QUALITY_URL_MEMORY_MAP = new Map<string, CachedQualityUrl>();

// Legacy In-Memory Stream Cache Map: Key = videoId, Value = direct stream URL
export const STREAM_MEMORY_MAP = new Map<string, string>();

/**
 * Mengambil URL stream yang dapat diputar langsung (string URL) dari data cache kualitas video.
 */
export function getPlayableUrlFromQuality(data: CachedQualityUrl | null | undefined): string | null {
  if (!data) return null;
  if (typeof data === 'string') return data;
  return data.videoUrl || data.url || null;
}

/**
 * Mengambil URL stream audio (untuk format DASH) dari data cache kualitas video jika ada.
 * Mengembalikan null jika format merupakan progressive (audio sudah tergabung di dalam video).
 */
export function getAudioUrlFromQuality(data: CachedQualityUrl | null | undefined): string | null {
  if (!data) return null;
  if (typeof data === 'object' && data.audioUrl) {
    return data.audioUrl;
  }
  return null;
}

/**
 * Menyimpan URL kualitas video ke Tier 1 (In-Memory Map) dan Tier 2 (LocalStorage).
 * Jika Progressive: disimpan langsung sebagai string URL.
 * Jika DASH: disimpan sebagai object JSON { isDASH: true, videoUrl, audioUrl, qualityId }.
 */
export async function saveCachedQualityUrl(
  videoId: string,
  qualityId: string,
  data: CachedQualityUrl
): Promise<void> {
  if (!data) return;
  const memKey = `${videoId}:${qualityId}`;
  QUALITY_URL_MEMORY_MAP.set(memKey, data);

  // Sinkronkan juga ke STREAM_MEMORY_MAP untuk pemutaran video
  const playable = getPlayableUrlFromQuality(data);
  if (playable) {
    STREAM_MEMORY_MAP.set(videoId, playable);
  }

  try {
    const serialized = typeof data === 'string' ? data : JSON.stringify(data);
    await LocalStorage.setItem(`quality_url_${videoId}_${qualityId}`, serialized);
  } catch (err) {
    console.warn(`[QualityUrlCache] Gagal menyimpan cache ${memKey}:`, err);
  }
}

/**
 * Mengambil URL kualitas video yang tersimpan di cache (Tier 1 In-Memory atau Tier 2 LocalStorage).
 */
export async function getCachedQualityUrl(
  videoId: string,
  qualityId: string
): Promise<CachedQualityUrl | null> {
  const memKey = `${videoId}:${qualityId}`;
  if (QUALITY_URL_MEMORY_MAP.has(memKey)) {
    const mem = QUALITY_URL_MEMORY_MAP.get(memKey);
    if (mem) return mem;
  }

  try {
    const raw = await LocalStorage.getItem(`quality_url_${videoId}_${qualityId}`);
    if (raw) {
      const trimmed = raw.trim();
      if (trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed && (parsed.isDASH || parsed.videoUrl || parsed.url)) {
            // Guard: Format DASH wajib memiliki audioUrl agar pemutaran stream tidak bisu
            if (parsed.isDASH && !parsed.audioUrl) {
              return null;
            }
            QUALITY_URL_MEMORY_MAP.set(memKey, parsed);
            return parsed;
          }
        } catch {}
      }
      if (trimmed.startsWith('http')) {
        // Guard: Jika format merupakan kualitas yang umumnya DASH (60fps atau 1080p),
        // cache string URL lawas tidak valid karena tidak menyertakan track audio terpisah
        if (qualityId.includes('60') || qualityId.startsWith('1080')) {
          return null;
        }
        QUALITY_URL_MEMORY_MAP.set(memKey, trimmed);
        return trimmed;
      }
    }
  } catch {}

  return null;
}

/**
 * Memeriksa apakah URL kualitas video sudah tersedia di cache tanpa perlu hit ke YouTube.
 */
export async function hasCachedQualityUrl(videoId: string, qualityId: string): Promise<boolean> {
  const data = await getCachedQualityUrl(videoId, qualityId);
  return Boolean(data);
}

/**
 * Menghapus URL kualitas video dari cache (Tier 1 & Tier 2).
 */
export async function clearCachedQualityUrl(videoId: string, qualityId?: string): Promise<void> {
  if (qualityId) {
    const memKey = `${videoId}:${qualityId}`;
    QUALITY_URL_MEMORY_MAP.delete(memKey);
    try {
      await LocalStorage.removeItem(`quality_url_${videoId}_${qualityId}`);
    } catch {}
  } else {
    for (const key of Array.from(QUALITY_URL_MEMORY_MAP.keys())) {
      if (key.startsWith(`${videoId}:`)) {
        QUALITY_URL_MEMORY_MAP.delete(key);
      }
    }
    STREAM_MEMORY_MAP.delete(videoId);
    try {
      await LocalStorage.removeItem(`stream_url_${videoId}`);
      await LocalStorage.removeItem(`download_stream_${videoId}`);
    } catch {}
  }
}



/**
 * Mengekstrak direct URL untuk kualitas video tertentu (misal '720p60', '1080p60', '720p30', '480p30').
 * Menyimpan hasilnya ke arsitektur 2-Tier Caching berbasis kualitas.
 * Jika progressive -> direct string.
 * Jika DASH -> object { isDASH: true, videoUrl, audioUrl, qualityId }.
 */
export async function fetchQualityUrl(
  videoId: string,
  qualityId: string,
  forceRefresh: boolean = false
): Promise<CachedQualityUrl> {
  if (!forceRefresh) {
    const cached = await getCachedQualityUrl(videoId, qualityId);
    if (cached) {
      console.log(`[QualityUrlCache] Hit cache untuk ${videoId} @ ${qualityId}`);
      return cached;
    }
  }

  const cookiePath = await getValidCookiesPath();
  let data: any = null;
  const isNative = Platform.OS === 'android' && isPythonInitialized();

  // Mapping client sesuai resolusi target:
  // 360p30 menggunakan client 'android' agar mendapatkan Format 18 Progressive (video+audio menyatu 100%).
  // Resolusi 720p60 dan 1080p60 menggunakan client web untuk HLS / DASH resmi.
  const targetOpts = {
    ...QUALITY_STREAM_YTDL_OPTS,
    ...(qualityId === '360p30' || qualityId === '360p'
      ? { extractor_args: { youtube: { player_client: ['android'] } } }
      : {}),
  };

  if (isNative) {
    data = await executePythonScript('utils.stream_extractor', 'extract_quality_url', {
      video_id: videoId,
      quality_id: qualityId,
      ydl_opts: targetOpts,
      cookie_path: cookiePath,
    });
  } else {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`${DEV_API_BASE_URL}/api/quality-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_id: videoId,
          quality_id: qualityId,
          ydl_opts: targetOpts,
          cookie_path: cookiePath,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      data = await response.json().catch(() => ({}));
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      throw fetchErr;
    }
  }

  const payload = (data?.data && typeof data.data === 'object') ? data.data : data;
  if (!payload) {
    throw new ApiError('EMPTY_RESPONSE', 'Python engine tidak mengembalikan respons quality URL.');
  }

  if (payload.status === 'error') {
    const code = payload.code || 'PYTHON_EXECUTION_ERROR';
    const rawError = payload.traceback || payload.error || JSON.stringify(payload, null, 2);
    throw new ApiError(code, rawError);
  }

  let result: CachedQualityUrl;
  if (payload.is_dash) {
    result = {
      isDASH: true,
      videoUrl: payload.video_url,
      audioUrl: payload.audio_url,
      qualityId: qualityId,
      formatId: payload.video_format_id,
      cachedAt: Date.now(),
    };
  } else if (payload.url) {
    result = payload.url;
  } else {
    throw new ApiError('STREAM_NOT_FOUND', 'URL stream untuk kualitas ini tidak ditemukan.');
  }

  await saveCachedQualityUrl(videoId, qualityId, result);
  return result;
}

/**
 * Mengambil URL stream yang tersimpan di cache (Tier 1 In-Memory atau Tier 2 LocalStorage) tanpa network call.
 */
export async function getCachedStreamUrl(videoId: string, qualityId?: string): Promise<string | null> {
  if (qualityId) {
    const qData = await getCachedQualityUrl(videoId, qualityId);
    const playable = getPlayableUrlFromQuality(qData);
    if (playable) return playable;
  }

  if (STREAM_MEMORY_MAP.has(videoId)) {
    const memUrl = STREAM_MEMORY_MAP.get(videoId);
    if (memUrl) return memUrl;
  }
  try {
    const fileUrl = await LocalStorage.getItem(`stream_url_${videoId}`);
    if (fileUrl && fileUrl.trim().startsWith('http')) {
      const trimmed = fileUrl.trim();
      STREAM_MEMORY_MAP.set(videoId, trimmed);
      return trimmed;
    }
  } catch {}
  return null;
}

/**
 * Memeriksa apakah direct stream URL sudah tersedia di cache tanpa perlu hit ke YouTube.
 */
export async function hasCachedStreamUrl(videoId: string, qualityId?: string): Promise<boolean> {
  const url = await getCachedStreamUrl(videoId, qualityId);
  return Boolean(url && url.length > 0);
}

/**
 * Menghapus direct stream URL dari Tier 1 dan Tier 2 jika kedaluwarsa.
 */
export async function clearCachedStreamUrl(videoId: string, qualityId?: string): Promise<void> {
  STREAM_MEMORY_MAP.delete(videoId);
  try {
    await LocalStorage.removeItem(`stream_url_${videoId}`);
  } catch {}
  if (qualityId) {
    await clearCachedQualityUrl(videoId, qualityId);
  }
}

/**
 * Mengambil direct stream URL 360p (Format 18 Progressive) untuk pemutar video.
 * Video & audio menyatu 100% (0ms drift, single native ExoPlayer instance).
 */
export async function fetchStreamUrl(
  videoId: string,
  forceRefresh: boolean = false,
  qualityId: string = '360p30'
): Promise<string> {
  const targetQuality = qualityId || '360p30';
  if (!forceRefresh) {
    const cached = await getCachedStreamUrl(videoId, targetQuality);
    if (cached) return cached;
  }

  const qRes = await fetchQualityUrl(videoId, targetQuality, forceRefresh);
  const playable = getPlayableUrlFromQuality(qRes);
  if (playable) {
    STREAM_MEMORY_MAP.set(videoId, playable);
    try {
      await LocalStorage.setItem(`stream_url_${videoId}`, playable);
    } catch {}
    return playable;
  }

  throw new ApiError('STREAM_NOT_FOUND', `Direct stream URL untuk kualitas ${targetQuality} tidak ditemukan.`);
}

/**
 * Fetches the heatmap data for a given YouTube video ID.
 * Mengirimkan HEATMAP_YTDL_OPTS secara eksplisit ke backend,
 * lalu melakukan formatting, kalkulasi offset, dan sorting klip 100% di Frontend.
 */
export async function fetchHeatmap(
  videoId: string,
  numClips: number = 100,
  offset: number = 0
): Promise<HeatmapResponse> {
  try {
    const cookiePath = await getValidCookiesPath();
    let data: any = null;
    const isNative = Platform.OS === 'android' && isPythonInitialized();

    if (isNative) {
      data = await executePythonScript('utils.heatmap', 'extract_heatmap_data', {
        video_id: videoId,
        ydl_opts: HEATMAP_YTDL_OPTS,
        cookie_path: cookiePath,
      });
    } else {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(`${DEV_API_BASE_URL}/api/heatmap`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            video_id: videoId,
            ydl_opts: HEATMAP_YTDL_OPTS,
            cookie_path: cookiePath,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        data = await response.json().catch(() => ({}));
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        throw fetchErr;
      }
    }

    // Unwrap nested data payload if wrapped by generic runner
    const payload = (data?.data && typeof data.data === 'object' && !Array.isArray(data.data)) ? data.data : data;

    if (!payload) {
      throw new ApiError('EMPTY_RESPONSE', 'Python engine tidak mengembalikan data apa pun.');
    }

    if (payload.status === 'error') {
      const code = payload.code || 'PYTHON_EXECUTION_ERROR';
      const rawError = payload.traceback || payload.error || JSON.stringify(payload, null, 2);
      throw new ApiError(code, rawError);
    }

    if (!Array.isArray(payload.heatmap)) {
      const code = payload.code || 'HEATMAP_NOT_FOUND';
      const rawError = payload.error || (payload.message ? String(payload.message) : JSON.stringify(payload, null, 2));
      throw new ApiError(code, rawError);
    }

    // Olah raw heatmap 100% di Frontend TypeScript
    const topMoments = [...payload.heatmap]
      .sort((a: any, b: any) => (b.value || 0) - (a.value || 0))
      .slice(0, numClips);

    const formattedClips: ClipItem[] = topMoments.map((moment: any, index: number) => {
      const origStart = Number(moment.start_time || 0);
      const origEnd = Number(moment.end_time || 0);
      let start = origStart - offset;
      let end = origEnd + offset;

      if (end <= start) {
        const mid = (origStart + origEnd) / 2;
        start = Math.max(0, mid - 1);
        end = start + 2;
      } else {
        start = Math.max(0, start);
      }

      return {
        id: `clip_${origStart}`,
        rank: index + 1,
        videoId: videoId,
        start: Number(start.toFixed(3)),
        end: Number(end.toFixed(3)),
        value: moment.value,
        status: 'none' as const,
        isCustom: false,
      };
    });

    return {
      title: payload.title || data.title || '',
      clips: formattedClips,
    };

  } catch (error: any) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(error.name === 'AbortError' ? 'NETWORK_ERROR' : 'EXTRACTOR_ERROR', error.message);
  }
}
