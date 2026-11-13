import * as FileSystem from 'expo-file-system/legacy';
import { LocalStorage } from '../storage';
import { ApiError } from './errors';
import {
  SHARED_CLIPPING_OUTPUT_DIR,
  getDownloadStreamCacheFilePath,
  getFullVideoFilePath,
} from './paths';
import {
  getCachedQualityUrl,
  getPlayableUrlFromQuality,
  saveCachedQualityUrl,
  clearCachedQualityUrl,
  fetchQualityUrl,
} from './youtubeStream';
import { CachedQualityUrl } from './types';

// 2-Tier Caching untuk URL Stream Pengunduhan Klip (Key = videoId, Value = Direct Stream URL)
// Tier 1: In-Memory Map (0ms latency, zero disk I/O)
// Tier 2: File Fisik di shared folder (/storage/emulated/0/clipping/output/<videoId>/stream_url.txt) & LocalStorage
export const DOWNLOAD_STREAM_MEMORY_MAP = new Map<string, string>();

/**
 * Mengambil cached download stream URL dengan arsitektur 2-Tier:
 * 1. Cek cache kualitas jika qualityId diberikan (Tier 1 In-Memory & Tier 2 LocalStorage)
 * 2. Cek Tier 1 (In-Memory Map)
 * 3. Cek Tier 2 (File stream_url.txt di folder video pada shared storage)
 * 4. Fallback Tier 2 (LocalStorage internal)
 */
export async function getCachedDownloadStreamUrl(videoId: string, qualityId?: string): Promise<string | undefined> {
  // 1. Cek cache kualitas jika qualityId diberikan
  if (qualityId) {
    const qData = await getCachedQualityUrl(videoId, qualityId);
    const playable = getPlayableUrlFromQuality(qData);
    if (playable) return playable;
  }

  // 2. Cek Tier 1
  if (DOWNLOAD_STREAM_MEMORY_MAP.has(videoId)) {
    const mem = DOWNLOAD_STREAM_MEMORY_MAP.get(videoId);
    if (mem) return mem;
  }

  // 3. Cek Tier 2: File Fisik di shared directory
  try {
    const { fileUri } = getDownloadStreamCacheFilePath(videoId);
    const info = await FileSystem.getInfoAsync(fileUri);
    if (info.exists && !info.isDirectory) {
      const saved = await FileSystem.readAsStringAsync(fileUri);
      if (saved && saved.trim().startsWith('http')) {
        const trimmed = saved.trim();
        DOWNLOAD_STREAM_MEMORY_MAP.set(videoId, trimmed);
        return trimmed;
      }
    }
  } catch {}

  // 4. Fallback Tier 2: LocalStorage
  try {
    const savedLocal = await LocalStorage.getItem(`download_stream_${videoId}`);
    if (savedLocal && savedLocal.trim().startsWith('http')) {
      const trimmed = savedLocal.trim();
      DOWNLOAD_STREAM_MEMORY_MAP.set(videoId, trimmed);
      return trimmed;
    }
  } catch {}

  return undefined;
}

/**
 * Menyimpan URL download stream ke Tier 1 dan Tier 2 (file stream_url.txt & LocalStorage).
 */
export async function saveCachedDownloadStreamUrl(
  videoId: string,
  streamUrl: string,
  qualityId?: string,
  qualityData?: CachedQualityUrl
): Promise<void> {
  if (!streamUrl) return;
  DOWNLOAD_STREAM_MEMORY_MAP.set(videoId, streamUrl);

  if (qualityId && qualityData) {
    await saveCachedQualityUrl(videoId, qualityId, qualityData);
  }

  try {
    const { fileUri } = getDownloadStreamCacheFilePath(videoId);
    const dirUri = `file://${SHARED_CLIPPING_OUTPUT_DIR}/${videoId}`;
    const dirInfo = await FileSystem.getInfoAsync(dirUri);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true });
    }
    await FileSystem.writeAsStringAsync(fileUri, streamUrl);
  } catch {}

  try {
    await LocalStorage.setItem(`download_stream_${videoId}`, streamUrl);
  } catch {}
}

/**
 * Menghapus cache URL download stream dari Tier 1 dan Tier 2 jika kedaluwarsa.
 */
export async function clearCachedDownloadStreamUrl(videoId: string, qualityId?: string): Promise<void> {
  DOWNLOAD_STREAM_MEMORY_MAP.delete(videoId);
  try {
    const { fileUri } = getDownloadStreamCacheFilePath(videoId);
    await FileSystem.deleteAsync(fileUri, { idempotent: true });
  } catch {}
  try {
    await LocalStorage.removeItem(`download_stream_${videoId}`);
  } catch {}
  if (qualityId) {
    await clearCachedQualityUrl(videoId, qualityId);
  }
}

/**
 * Memeriksa apakah download stream URL sudah tersedia di cache (atau ada file video utuh lokal).
 * Jika ada file full video lokal, return true (karena pemotongan klip dilakukan offline tanpa perlu URL online).
 */
export async function hasCachedDownloadStreamUrl(videoId: string, qualityId?: string): Promise<boolean> {
  const fullVideo = getFullVideoFilePath(videoId);
  try {
    const fullInfo = await FileSystem.getInfoAsync(fullVideo.fileUri);
    if (fullInfo.exists && ((fullInfo as any).size === undefined || (fullInfo as any).size > 0)) {
      return true;
    }
  } catch {}

  const url = await getCachedDownloadStreamUrl(videoId, qualityId);
  return Boolean(url && url.length > 0);
}

/**
 * Mengambil (GET) direct download stream URL baru dari YouTube metadata (hanya ~100 KB payload teks)
 * dan menyimpannya ke cache Tier 1 & Tier 2. Tidak melakukan pengunduhan file video.
 * Sesuai arsitektur True Pass-Through: Tidak ada fallback otomatis tersembunyi ke 480p.
 * Parameter qualityId wajib ditentukan oleh pemanggil.
 */
export async function fetchAndCacheDownloadStreamUrl(videoId: string, qualityId?: string): Promise<string> {
  if (!qualityId) {
    throw new ApiError(
      'QUALITY_REQUIRED',
      'Parameter qualityId wajib ditentukan untuk unduh video. Fallback otomatis dinonaktifkan.'
    );
  }

  const qData = await fetchQualityUrl(videoId, qualityId, true);
  const playable = getPlayableUrlFromQuality(qData);
  if (playable) {
    await saveCachedDownloadStreamUrl(videoId, playable, qualityId, qData);
    return playable;
  }

  throw new ApiError('STREAM_NOT_FOUND', `Direct stream URL untuk kualitas download ${qualityId} tidak ditemukan.`);
}
