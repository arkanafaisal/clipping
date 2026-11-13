import * as FileSystem from 'expo-file-system/legacy';
import {
  SHARED_CLIPPING_OUTPUT_DIR,
  INTERNAL_CLIPPING_OUTPUT_DIR,
  getFullVideoFilePath,
  getFullVideoProxyFilePath,
  getClipOutputFilePath,
  getClipInternalOutputFilePath,
} from './paths';

// In-Memory cache deteksi file download klip: key = fileUri, value = exists boolean
export const DOWNLOADED_CLIPS_CACHE = new Map<string, boolean>();

/**
 * Memeriksa apakah file video utuh (full video) sudah terunduh lengkap & valid di shared storage.
 * Wajib memverifikasi keberadaan KEDUA file:
 * 1. File Master 1080p: full.mp4 (atau full_video.mp4) > 1024 bytes
 * 2. File Proxy 480p: full_proxy.mp4 > 1024 bytes
 * Jika salah satunya tidak ada atau korup (0 byte), mengembalikan false.
 */
export async function checkFullVideoExists(videoId: string): Promise<boolean> {
  try {
    const { fileUri: masterUri } = getFullVideoFilePath(videoId);
    const { fileUri: proxyUri } = getFullVideoProxyFilePath(videoId);

    // 1. Cek Master 1080p
    let masterOk = false;
    const masterInfo = await FileSystem.getInfoAsync(masterUri);
    if (masterInfo.exists && ((masterInfo as any).size === undefined || (masterInfo as any).size > 1024)) {
      masterOk = true;
    } else {
      const altPath = `file://${SHARED_CLIPPING_OUTPUT_DIR}/${videoId}/full_video.mp4`;
      const altInfo = await FileSystem.getInfoAsync(altPath);
      if (altInfo.exists && ((altInfo as any).size === undefined || (altInfo as any).size > 1024)) {
        masterOk = true;
      }
    }

    if (!masterOk) return false;

    // 2. Cek Proxy 480p
    const proxyInfo = await FileSystem.getInfoAsync(proxyUri);
    if (proxyInfo.exists && ((proxyInfo as any).size === undefined || (proxyInfo as any).size > 1024)) {
      return true;
    }
  } catch {}

  return false;
}

/**
 * Menyelesaikan fileUri video utuh lokal jika ada di shared storage.
 * Prioritas 1: Gunakan file proxy 480p (full_proxy.mp4) agar pemutaran UI super lancar 60 FPS dan 100% offline.
 * Prioritas 2: Fallback ke file master 1080p (full.mp4 / full_video.mp4).
 */
export async function resolvePlayableFullVideoUri(videoId: string): Promise<string | null> {
  // Prioritas 1: Gunakan file proxy 480p yang sangat ringan untuk player UI
  try {
    const { fileUri: proxyUri } = getFullVideoProxyFilePath(videoId);
    const proxyInfo = await FileSystem.getInfoAsync(proxyUri);
    if (proxyInfo.exists && ((proxyInfo as any).size === undefined || (proxyInfo as any).size > 1024)) {
      return proxyUri;
    }
  } catch {}

  // Prioritas 2: Fallback ke master full.mp4 jika proxy belum ada
  try {
    const { fileUri } = getFullVideoFilePath(videoId);
    const info = await FileSystem.getInfoAsync(fileUri);
    if (info.exists && ((info as any).size === undefined || (info as any).size > 1024)) {
      return fileUri;
    }
  } catch {}
  try {
    const altPath = `file://${SHARED_CLIPPING_OUTPUT_DIR}/${videoId}/full_video.mp4`;
    const altInfo = await FileSystem.getInfoAsync(altPath);
    if (altInfo.exists && ((altInfo as any).size === undefined || (altInfo as any).size > 1024)) {
      return altPath;
    }
  } catch {}
  return null;
}

/**
 * Menyelesaikan fileUri yang valid dan dapat diputar untuk klip lokal.
 * Mendeteksi format baru "<start> - <end>.mp4" terlebih dahulu, dengan fallback backward-compatible ke format lama.
 */
export async function resolvePlayableClipUri(
  videoId: string,
  start: number,
  end: number,
  rank?: number | string
): Promise<string> {
  // 1. Cek format baru presisi ms di shared storage
  const shared = getClipOutputFilePath(videoId, start, end, rank);
  try {
    const info = await FileSystem.getInfoAsync(shared.fileUri);
    if (info.exists) return shared.fileUri;
  } catch {}

  // 2. Cek format baru presisi ms di internal sandbox
  const internal = getClipInternalOutputFilePath(videoId, start, end, rank);
  try {
    const internalInfo = await FileSystem.getInfoAsync(internal.fileUri);
    if (internalInfo.exists) return internal.fileUri;
  } catch {}

  // 3. Fallback format lama (clip_${rank}_${start}_${end}.mp4 & clip_${videoId}_${start}_${end}.mp4)
  const startStr = Math.round(start).toString();
  const endStr = Math.round(end).toString();
  if (rank) {
    const legacyRankShared = `file://${SHARED_CLIPPING_OUTPUT_DIR}/${videoId}/clip_${rank}_${startStr}_${endStr}.mp4`;
    try {
      const fbInfo = await FileSystem.getInfoAsync(legacyRankShared);
      if (fbInfo.exists) return legacyRankShared;
    } catch {}
  }

  const fallbackShared = `file://${SHARED_CLIPPING_OUTPUT_DIR}/${videoId}/clip_${videoId}_${startStr}_${endStr}.mp4`;
  try {
    const fbInfo = await FileSystem.getInfoAsync(fallbackShared);
    if (fbInfo.exists) return fallbackShared;
  } catch {}

  const fallbackInternal = `file://${INTERNAL_CLIPPING_OUTPUT_DIR}/${videoId}/clip_${videoId}_${startStr}_${endStr}.mp4`;
  try {
    const fbInternalInfo = await FileSystem.getInfoAsync(fallbackInternal);
    if (fbInternalInfo.exists) return fallbackInternal;
  } catch {}

  return shared.fileUri;
}

/**
 * Memeriksa keberadaan file klip video di local file system dengan in-memory caching.
 * Dijalankan murni di sisi frontend menggunakan FileSystem Expo tanpa panggilan API ke server.
 * Memeriksa baik direktori shared storage maupun internal sandbox storage.
 */
export async function checkClipFileExists(fileUri: string, forceCheckDisk: boolean = false): Promise<boolean> {
  if (!forceCheckDisk && DOWNLOADED_CLIPS_CACHE.has(fileUri)) {
    return DOWNLOADED_CLIPS_CACHE.get(fileUri) || false;
  }
  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    const exists = Boolean(info.exists);
    if (exists) {
      DOWNLOADED_CLIPS_CACHE.set(fileUri, true);
      return true;
    }

    // Jika URI shared storage tidak ditemukan, cek padanannya di internal sandbox
    if (fileUri.includes(SHARED_CLIPPING_OUTPUT_DIR)) {
      const internalUri = fileUri.replace(SHARED_CLIPPING_OUTPUT_DIR, INTERNAL_CLIPPING_OUTPUT_DIR);
      const internalInfo = await FileSystem.getInfoAsync(internalUri);
      if (internalInfo.exists) {
        DOWNLOADED_CLIPS_CACHE.set(fileUri, true);
        DOWNLOADED_CLIPS_CACHE.set(internalUri, true);
        return true;
      }
    }
    DOWNLOADED_CLIPS_CACHE.set(fileUri, false);
    return false;
  } catch {
    return false;
  }
}
