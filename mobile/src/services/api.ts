import * as FileSystem from 'expo-file-system/legacy';
import { LocalStorage } from './storage';
import { STREAM_YTDL_OPTS, HEATMAP_YTDL_OPTS, PRIME_CLIP_DOWNLOAD_OPTS } from '../constants/ytdlp';
import { DEFAULT_GDRIVE_DOWNLOAD_CONFIG } from '../constants/gdrive';

export interface ClipItem {
  id: string;
  rank: number;
  videoId: string;
  start: number;
  end: number;
  value?: number;
  status?: 'none' | 'done' | 'trash';
}

export interface HeatmapResponse {
  title: string;
  clips: ClipItem[];
}

export interface StreamResponse {
  stream_url: string;
  error?: string;
}

import { startPythonServer } from '../../modules/python-runner';

// 1. EMBEDDED INTERNAL SERVER (Port 8080):
// Seluruh endpoint produksi tertanam di dalam build APK (Chaquopy):
// - GET /ping (koneksi internal Chaquopy)
// - POST /api/stream (direct stream URL extraction)
// - POST /api/heatmap (metadata & most replayed raw extraction)
// - POST /api/download-clip (pengunduhan klip dinamis yt-dlp)
// - POST /api/download-gdrive-file (sinkronisasi cookies Google Drive publik)
export let EMBEDDED_API_BASE_URL = 'http://127.0.0.1:8080';

export function setEmbeddedApiBaseUrl(url: string) {
  EMBEDDED_API_BASE_URL = url;
}

// 2. MOBILE DEV / MOCK SERVER (Port 3006):
// Server pengembangan eksternal (Termux / PC lokal) sebagai fallback saat debugging tanpa APK native:
export let DEV_API_BASE_URL = 'http://127.0.0.1:3006';

export function setDevApiBaseUrl(url: string) {
  DEV_API_BASE_URL = url;
}

// Backward compatibility alias jika ada komponen yang memanggil API_BASE_URL
export let API_BASE_URL = EMBEDDED_API_BASE_URL;
export function setApiBaseUrl(url: string) {
  EMBEDDED_API_BASE_URL = url;
  API_BASE_URL = url;
}

/**
 * Kamus pemetaan kode error API dari backend ke pesan ramah pengguna (Bahasa Indonesia).
 * Backend hanya mengembalikan KODE (misal: "STREAM_NOT_FOUND"), frontend memegang 100% kamus teks.
 */
export const API_ERROR_MAP: Record<string, string> = {
  VIDEO_ID_REQUIRED: 'ID video YouTube tidak boleh kosong.',
  YDL_OPTS_REQUIRED: 'Konfigurasi ekstraksi (ydl_opts) tidak valid.',
  STREAM_NOT_FOUND: 'Direct stream video tidak ditemukan atau video dibatasi (Private/Age-restricted).',
  HEATMAP_NOT_FOUND: 'Video ini belum memiliki data Most Replayed (Heatmap) dari YouTube.',
  RATE_LIMIT_EXCEEDED: 'Batas permintaan YouTube terlampaui (Error 429) pada mode anonim. Silakan impor cookies dari Google Drive untuk melanjutkan.',
  COOKIES_INVALID_OR_EXPIRED: 'Gagal mengunduh klip: Cookies telah digunakan ke yt-dlp namun ditolak oleh YouTube (kedaluwarsa atau terkena verifikasi bot). Harap perbarui file cookies.txt Anda.',
  COOKIES_FILE_NOT_FOUND: 'File cookies tidak ditemukan di direktori storage server (/storage/emulated/0/clipping/cookies.txt). Harap impor ulang cookies dari Google Drive.',
  GDRIVE_DOWNLOAD_FAILED: 'Gagal mengunduh file dari Google Drive. Pastikan file bukan folder dan link dapat diakses oleh publik.',
  GDRIVE_HTML_CONTENT: 'Link Google Drive yang dimasukkan mengarah ke halaman HTML atau Folder, bukan file cookies.txt. Harap salin link langsung dari file cookies.txt.',
  GDRIVE_FILE_EMPTY: 'File cookies hasil unduhan Google Drive kosong atau tidak tersimpan.',
  FORMAT_NOT_AVAILABLE: 'Format video yang diminta tidak tersedia di YouTube untuk video ini.',
  INVALID_PARAMS: 'Parameter permintaan tidak lengkap atau tidak valid.',
  INVALID_RANGE: 'Rentang waktu klip tidak valid.',
  DOWNLOAD_FAILED: 'Gagal mengunduh klip video dari YouTube.',
  SERVER_OFFLINE: 'Server internal Python belum aktif pada port 8080.',
  DEV_SERVER_OFFLINE: 'Server Mobile Dev/Mock API belum aktif pada port 3006.',
  INTERNAL_ERROR: 'Terjadi kesalahan internal pada server Python.',
  NETWORK_ERROR: 'Gagal terhubung ke jaringan internal server.',
};

/**
 * Mengubah kode error API menjadi pesan Bahasa Indonesia yang ramah pengguna.
 */
export function resolveErrorMessage(codeOrMessage?: string): string {
  if (!codeOrMessage) return 'Terjadi kesalahan sistem.';
  return API_ERROR_MAP[codeOrMessage] || codeOrMessage;
}

/**
 * Custom Error Class untuk membungkus kode error, pesan pengguna terjemahan,
 * serta log raw error asli dari backend untuk kebutuhan debugging.
 */
export class ApiError extends Error {
  code: string;
  rawError?: string;

  constructor(code: string, rawError?: string) {
    super(resolveErrorMessage(code));
    this.name = 'ApiError';
    this.code = code;
    this.rawError = rawError;
  }
}

/**
 * Memeriksa apakah error yang terjadi merupakan akibat pembatasan akses YouTube
 * (Rate Limit 429, 403 Forbidden, token access denied, bot verification check, ffmpeg exit code 8, dll).
 */
export function isRateLimitOrRestrictedError(err: any): boolean {
  if (!err) return false;
  if (err.code === 'RATE_LIMIT_EXCEEDED') return true;
  const fullText = `${err.name || ''} ${err.code || ''} ${err.message || ''} ${err.rawError || ''}`.toLowerCase();
  return (
    fullText.includes('429') ||
    fullText.includes('403') ||
    fullText.includes('forbidden') ||
    fullText.includes('access denied') ||
    fullText.includes('rate limit') ||
    fullText.includes('bot') ||
    fullText.includes('sign in') ||
    fullText.includes('code 8')
  );
}

async function pingDirect(baseUrl: string): Promise<{ status: string; message?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1200);
  try {
    const res = await fetch(`${baseUrl}/ping`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      return await res.json();
    }
    throw new Error(`HTTP ${res.status}`);
  } catch (e: any) {
    clearTimeout(timeoutId);
    throw e;
  }
}

/**
 * Ping Python server internal Chaquopy (port 8080).
 * Jika belum aktif pada Android, otomatis memicu "percikan" startPythonServer().
 */
export async function pingServer(): Promise<{ status: string; port: number; message?: string }> {
  // 1. Coba port 8080 dulu (Embedded APK Chaquopy)
  try {
    const res8080 = await pingDirect(EMBEDDED_API_BASE_URL);
    return { status: 'ok', port: 8080, message: res8080.message || 'Server internal Chaquopy aktif (port 8080)' };
  } catch {}

  // 2. Beri "percikan" startPythonServer() jika di Android native
  try {
    startPythonServer();
  } catch (err) {
    console.log('[Api] Gagal memicu startPythonServer:', err);
  }

  // Tunggu sejenak agar thread Python siap mendengarkan port
  await new Promise((r) => setTimeout(r, 1200));

  try {
    const resRetry8080 = await pingDirect(EMBEDDED_API_BASE_URL);
    return { status: 'ok', port: 8080, message: resRetry8080.message || 'Server internal Chaquopy berhasil dinyalakan (port 8080)' };
  } catch {}

  throw new ApiError('SERVER_OFFLINE', 'Server Python internal (port 8080) belum aktif.');
}

/**
 * Ping server pengembangan / mock eksternal (port 3006).
 */
export async function pingDevServer(): Promise<{ status: string; port: number; message?: string }> {
  try {
    const res3006 = await pingDirect(DEV_API_BASE_URL);
    return { status: 'ok', port: 3006, message: res3006.message || 'Server Mobile API (port 3006) aktif' };
  } catch {}

  throw new ApiError('DEV_SERVER_OFFLINE', `Server Mobile API belum aktif pada port 3006 (${DEV_API_BASE_URL}).`);
}

// In-Memory Stream Cache Map: Key = videoId, Value = direct stream URL
const STREAM_MEMORY_MAP = new Map<string, string>();

/**
 * Fetches the direct stream URL for a given YouTube video ID.
 * Menggunakan arsitektur 2-Tier Caching:
 * 1. Tier 1 (In-Memory Map): Akses instan 0ms tanpa membaca disk storage
 * 2. Tier 2 (Persistent File Storage): Disimpan ke file fisik di HP, dibaca jika memori kosong
 * 3. Fallback / Refresh: Jika forceRefresh = true atau URL gagal diputar, ambil URL baru dari server Python.
 */
export async function fetchStreamUrl(videoId: string, forceRefresh: boolean = false): Promise<string> {
  // 1. Cek Tier 1: In-Memory Map (Paling Cepat, Zero Disk I/O)
  if (!forceRefresh && STREAM_MEMORY_MAP.has(videoId)) {
    const memUrl = STREAM_MEMORY_MAP.get(videoId);
    if (memUrl) {
      console.log(`[StreamCache] In-Memory Map hit untuk ${videoId}`);
      return memUrl;
    }
  }

  // 2. Cek Tier 2: File Fisik di LocalStorage (Jika In-Memory belum ada)
  if (!forceRefresh) {
    try {
      const fileUrl = await LocalStorage.getItem(`stream_url_${videoId}`);
      if (fileUrl) {
        STREAM_MEMORY_MAP.set(videoId, fileUrl);
        console.log(`[StreamCache] File Fisik hit untuk ${videoId}, disimpan ke In-Memory Map`);
        return fileUrl;
      }
    } catch (e) {
      // Abaikan file read error
    }
  }

  // 3. Tier 3: Fetch dari Server Python (Jika memori dan file fisik kosong, atau saat force refresh)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const cookiePath = await getValidCookiesPath();
    const response = await fetch(`${EMBEDDED_API_BASE_URL}/api/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        video_id: videoId,
        ydl_opts: STREAM_YTDL_OPTS,
        cookie_path: cookiePath,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.stream_url) {
      const code = data.message || (response.status === 404 ? 'STREAM_NOT_FOUND' : 'EXTRACTOR_ERROR');
      const rawError = data.error || `HTTP ${response.status}: ${response.statusText || 'Gagal mengekstrak stream'}`;
      throw new ApiError(code, rawError);
    }

    const streamUrl = data.stream_url;
    
    // Simpan ke In-Memory Map
    STREAM_MEMORY_MAP.set(videoId, streamUrl);

    // Simpan ke File Fisik di HP (asynchronous)
    LocalStorage.setItem(`stream_url_${videoId}`, streamUrl).catch((err) => {
      console.warn('[StreamCache] Gagal menyimpan stream ke file fisik:', err);
    });

    return streamUrl;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error instanceof ApiError) throw error;
    throw new ApiError(error.name === 'AbortError' ? 'NETWORK_ERROR' : 'EXTRACTOR_ERROR', error.message);
  }
}

/**
 * Fetches the heatmap data for a given YouTube video ID.
 * Mengirimkan HEATMAP_YTDL_OPTS secara eksplisit ke backend,
 * lalu melakukan formatting, kalkulasi offset, dan sorting klip 100% di Frontend.
 */
export async function fetchHeatmap(
  videoId: string,
  numClips: number = 100,
  offset: number = 5
): Promise<HeatmapResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const cookiePath = await getValidCookiesPath();
    const response = await fetch(`${EMBEDDED_API_BASE_URL}/api/heatmap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        video_id: videoId,
        ydl_opts: HEATMAP_YTDL_OPTS,
        cookie_path: cookiePath,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !Array.isArray(data.heatmap)) {
      const code = data.message || (response.status === 404 ? 'HEATMAP_NOT_FOUND' : 'EXTRACTOR_ERROR');
      const rawError = data.error || `HTTP ${response.status}: ${response.statusText || 'Gagal mengambil heatmap'}`;
      throw new ApiError(code, rawError);
    }

    // Olah raw heatmap 100% di Frontend TypeScript
    const topMoments = [...data.heatmap]
      .sort((a: any, b: any) => (b.value || 0) - (a.value || 0))
      .slice(0, numClips);

    const formattedClips: ClipItem[] = topMoments.map((moment: any, index: number) => {
      const origStart = Number(moment.start_time || 0);
      const origEnd = Number(moment.end_time || 0);
      let start = origStart - offset;
      let end = origEnd + offset;

      if (end <= start) {
        const mid = (origStart + origEnd) / 2;
        start = Math.max(0, Math.floor(mid - 1));
        end = start + 2;
      } else {
        start = Math.max(0, start);
      }

      return {
        id: `clip_${origStart}`,
        rank: index + 1,
        videoId: videoId,
        start: Math.round(start),
        end: Math.round(end),
        value: moment.value,
        status: 'none' as const,
      };
    });

    return {
      title: data.title || '',
      clips: formattedClips,
    };

  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error instanceof ApiError) throw error;
    throw new ApiError(error.name === 'AbortError' ? 'NETWORK_ERROR' : 'EXTRACTOR_ERROR', error.message);
  }
}

// In-Memory cache deteksi file download klip: key = fileUri, value = exists boolean
export const DOWNLOADED_CLIPS_CACHE = new Map<string, boolean>();

// Shared clipping output directory:
// fileUri: file:///storage/emulated/0/clipping/output/<videoId>/clip_<rank>_<start>_<end>.mp4
// nativePath: /storage/emulated/0/clipping/output/<videoId>/clip_<rank>_<start>_<end>.mp4
export const SHARED_CLIPPING_ROOT = '/storage/emulated/0/clipping';
export const SHARED_CLIPPING_OUTPUT_DIR = `${SHARED_CLIPPING_ROOT}/output`;

// Path file cookies pada shared clipping directory
export const COOKIES_FILE_NAME = 'cookies.txt';
export const COOKIES_FILE_PATH = `${SHARED_CLIPPING_ROOT}/${COOKIES_FILE_NAME}`;
export const COOKIES_STORAGE_KEY = 'configured_cookies_path';

// In-Memory cache cookies path
let cachedCookiesPath: string | null = null;

/**
 * Memeriksa dan mengambil path cookies yang valid.
 * Prioritas: In-Memory cache -> LocalStorage.
 * Mempertahankan path yang tersimpan tanpa menghapus LocalStorage secara agresif.
 */
export async function getValidCookiesPath(): Promise<string | undefined> {
  if (cachedCookiesPath) {
    return cachedCookiesPath;
  }

  try {
    const savedPath = await LocalStorage.getItem(COOKIES_STORAGE_KEY);
    if (savedPath && typeof savedPath === 'string' && savedPath.trim().length > 0) {
      cachedCookiesPath = savedPath.trim();
      return cachedCookiesPath;
    }
  } catch {}

  return undefined;
}

/**
 * Memeriksa apakah link yang dimasukkan adalah link folder Google Drive.
 */
export function isGoogleDriveFolderLink(input: string): boolean {
  if (!input) return false;
  return input.includes('/folders/') || input.includes('folders%2F') || input.includes('/drive/folders');
}

/**
 * Ekstraksi Google Drive File ID dari URL publik atau raw input string.
 */
export function extractGoogleDriveFileId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (isGoogleDriveFolderLink(trimmed)) return null;

  const dMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (dMatch && dMatch[1]) return dMatch[1];
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) return idMatch[1];
  if (/^[a-zA-Z0-9_-]{25,}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

/**
 * Mengunduh file cookies dari Google Drive publik via endpoint pass-through /api/download-gdrive-file.
 * Frontend memformat file_id dan menetapkan lokasi output_path (/storage/emulated/0/clipping/cookies.txt).
 * Menyimpan path ke in-memory cache dan LocalStorage setelah berhasil.
 */
export async function syncCookiesFromGoogleDrive(linkOrId: string): Promise<string> {
  if (isGoogleDriveFolderLink(linkOrId)) {
    throw new ApiError(
      'INVALID_PARAMS',
      'Link yang dimasukkan adalah link FOLDER. Harap buka file cookies.txt di Google Drive, lalu salin link langsung dari file tersebut.'
    );
  }

  const fileId = extractGoogleDriveFileId(linkOrId);
  if (!fileId) {
    throw new ApiError('INVALID_PARAMS', 'Link Google Drive tidak valid atau ID file tidak ditemukan.');
  }

  const targetPath = COOKIES_FILE_PATH;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    let response: Response;
    try {
      // Prioritaskan EMBEDDED_API_BASE_URL (port 8080 / APK native)
      response = await fetch(`${EMBEDDED_API_BASE_URL}/api/download-gdrive-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: fileId,
          output_path: targetPath,
          config: DEFAULT_GDRIVE_DOWNLOAD_CONFIG,
        }),
        signal: controller.signal,
      });
    } catch {
      // Fallback ke DEV_API_BASE_URL (port 3006 / Termux) jika mode dev
      response = await fetch(`${DEV_API_BASE_URL}/api/download-gdrive-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: fileId,
          output_path: targetPath,
          config: DEFAULT_GDRIVE_DOWNLOAD_CONFIG,
        }),
        signal: controller.signal,
      });
    }
    clearTimeout(timeoutId);

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.status !== 'success') {
      const code = data.message || 'GDRIVE_DOWNLOAD_FAILED';
      const rawErr = data.error || `HTTP ${response.status}: Gagal mengunduh file dari Google Drive`;
      throw new ApiError(code, rawErr);
    }

    cachedCookiesPath = targetPath;
    await LocalStorage.setItem(COOKIES_STORAGE_KEY, targetPath);
    if (data.file_size) {
      await LocalStorage.setItem('cookies_file_size', String(data.file_size));
    }
    await LocalStorage.setItem('cookies_last_synced', String(Date.now()));
    return targetPath;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error instanceof ApiError) throw error;
    throw new ApiError('GDRIVE_DOWNLOAD_FAILED', error.message);
  }
}

/**
 * Menghasilkan alokasi lokasi file tujuan download klip pada shared storage (/storage/emulated/0/clipping/output/).
 * Frontend memegang kendali 100% path & nama folder, backend Termux hanya menerima path final.
 */
export function getClipOutputFilePath(
  videoId: string,
  start: number,
  end: number,
  rank?: number
): { fileUri: string; nativePath: string } {
  const startStr = Math.round(start);
  const endStr = Math.round(end);
  const filename = rank
    ? `clip_${rank}_${startStr}_${endStr}.mp4`
    : `clip_${videoId}_${startStr}_${endStr}.mp4`;
  const nativePath = `${SHARED_CLIPPING_OUTPUT_DIR}/${videoId}/${filename}`;
  const fileUri = `file://${nativePath}`;
  return { fileUri, nativePath };
}

/**
 * Memeriksa keberadaan file klip video di local file system dengan in-memory caching.
 * Dijalankan murni di sisi frontend menggunakan FileSystem Expo tanpa panggilan API ke server.
 */
export async function checkClipFileExists(fileUri: string, forceCheckDisk: boolean = false): Promise<boolean> {
  if (!forceCheckDisk && DOWNLOADED_CLIPS_CACHE.has(fileUri)) {
    return DOWNLOADED_CLIPS_CACHE.get(fileUri) || false;
  }
  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    const exists = Boolean(info.exists);
    DOWNLOADED_CLIPS_CACHE.set(fileUri, exists);
    return exists;
  } catch {
    return false;
  }
}

// 2-Tier Caching untuk URL Stream Pengunduhan Klip (Key = videoId, Value = Direct Stream URL)
// Tier 1: In-Memory Map (0ms latency, zero disk I/O)
// Tier 2: File Fisik di shared folder (/storage/emulated/0/clipping/output/<videoId>/stream_url.txt) & LocalStorage
const DOWNLOAD_STREAM_MEMORY_MAP = new Map<string, string>();

export function getDownloadStreamCacheFilePath(videoId: string): { fileUri: string; nativePath: string } {
  const nativePath = `${SHARED_CLIPPING_OUTPUT_DIR}/${videoId}/stream_url.txt`;
  return { fileUri: `file://${nativePath}`, nativePath };
}

/**
 * Mengambil cached download stream URL dengan arsitektur 2-Tier:
 * 1. Cek Tier 1 (In-Memory Map)
 * 2. Cek Tier 2 (File stream_url.txt di folder video pada shared storage)
 * 3. Fallback Tier 2 (LocalStorage internal)
 */
export async function getCachedDownloadStreamUrl(videoId: string): Promise<string | undefined> {
  // 1. Cek Tier 1
  if (DOWNLOAD_STREAM_MEMORY_MAP.has(videoId)) {
    const mem = DOWNLOAD_STREAM_MEMORY_MAP.get(videoId);
    if (mem) return mem;
  }

  // 2. Cek Tier 2: File Fisik di shared directory
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

  // 3. Fallback Tier 2: LocalStorage
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
export async function saveCachedDownloadStreamUrl(videoId: string, streamUrl: string): Promise<void> {
  if (!streamUrl) return;
  DOWNLOAD_STREAM_MEMORY_MAP.set(videoId, streamUrl);

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
export async function clearCachedDownloadStreamUrl(videoId: string): Promise<void> {
  DOWNLOAD_STREAM_MEMORY_MAP.delete(videoId);
  try {
    const { fileUri } = getDownloadStreamCacheFilePath(videoId);
    await FileSystem.deleteAsync(fileUri, { idempotent: true });
  } catch {}
  try {
    await LocalStorage.removeItem(`download_stream_${videoId}`);
  } catch {}
}

/**
 * Mendownload rentang klip tertentu secara dinamis dengan kualitas prime dan stream reconnect.
 * Menggunakan 2-tier cache untuk URL stream download agar request klip berikutnya dari video yang sama
 * memakai URL stream yang sama tanpa memicu request baru ke YouTube (aman dari Rate Limit 429).
 * Non-blocking: berjalan di background tanpa menghambat thread interaksi UI.
 */
export async function downloadClip(
  videoId: string,
  start: number,
  end: number,
  rank?: number
): Promise<{ status: string; output_path: string; fileUri: string; stream_url?: string }> {
  const { fileUri, nativePath } = getClipOutputFilePath(videoId, start, end, rank);

  // 1. Cek 2-Tier Cache di Frontend sebelum memanggil server
  const cachedStreamUrl = await getCachedDownloadStreamUrl(videoId);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 menit timeout download klip

  const infoJsonPath = `${SHARED_CLIPPING_OUTPUT_DIR}/${videoId}/video_info.json`;
  const clipYdlOpts = {
    ...PRIME_CLIP_DOWNLOAD_OPTS,
    load_info_filename: infoJsonPath,
    writeinfojson: true,
  };

  try {
    const cookiePath = await getValidCookiesPath();
    let response: Response;
    try {
      // Prioritaskan EMBEDDED_API_BASE_URL (port 8080 / APK native)
      response = await fetch(`${EMBEDDED_API_BASE_URL}/api/download-clip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video_id: videoId,
          start,
          end,
          output_path: nativePath,
          stream_url: cachedStreamUrl || undefined,
          cookie_path: cookiePath,
          ydl_opts: clipYdlOpts,
        }),
        signal: controller.signal,
      });
    } catch {
      // Fallback ke DEV_API_BASE_URL (port 3006 / Termux) jika mode dev
      response = await fetch(`${DEV_API_BASE_URL}/api/download-clip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video_id: videoId,
          start,
          end,
          output_path: nativePath,
          stream_url: cachedStreamUrl || undefined,
          cookie_path: cookiePath,
          ydl_opts: clipYdlOpts,
        }),
        signal: controller.signal,
      });
    }
    clearTimeout(timeoutId);

    const data = await response.json().catch(() => ({}));

    // Tangkap download stream URL dari response server dan simpan jika baru / berbeda
    if (data.stream_url && data.stream_url !== cachedStreamUrl) {
      await saveCachedDownloadStreamUrl(videoId, data.stream_url);
    }

    if (!response.ok || data.status !== 'success') {
      const rawError = data.error || `HTTP ${response.status}: Gagal mengunduh klip`;

      // Bersihkan cache URL stream & file info JSON agar request berikutnya tidak terjebak cache lama
      await clearCachedDownloadStreamUrl(videoId);
      FileSystem.deleteAsync(`file://${infoJsonPath}`, { idempotent: true }).catch(() => {});

      let code = data.code || data.message || 'DOWNLOAD_FAILED';

      const lowerRaw = rawError.toLowerCase();
      if (lowerRaw.includes('requested format is not available') || lowerRaw.includes('format is not available')) {
        code = 'FORMAT_NOT_AVAILABLE';
      } else if (data.cookies_attempted) {
        // Backend sudah benar-benar mencoba yt-dlp dengan opsi cookies, namun tetap ditolak YouTube
        code = 'COOKIES_INVALID_OR_EXPIRED';
      } else if (!cookiePath) {
        // Frontend belum memiliki cookies sama sekali (mode anonim gagal)
        code = 'RATE_LIMIT_EXCEEDED';
      } else if (data.cookies_path && data.cookies_file_exists === false) {
        // Path cookies terkirim namun file fisik tidak ditemukan di disk server
        code = 'COOKIES_FILE_NOT_FOUND';
      } else if (isRateLimitOrRestrictedError({ message: rawError, rawError })) {
        code = cookiePath ? 'COOKIES_INVALID_OR_EXPIRED' : 'RATE_LIMIT_EXCEEDED';
      }

      throw new ApiError(code, rawError);
    }

    // Tandai pada in-memory cache
    DOWNLOADED_CLIPS_CACHE.set(fileUri, true);

    return {
      status: 'success',
      output_path: nativePath,
      fileUri,
      stream_url: data.stream_url,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error instanceof ApiError) throw error;
    const cookiePath = await getValidCookiesPath().catch(() => undefined);
    const isLimit = isRateLimitOrRestrictedError(error);
    let code = 'DOWNLOAD_FAILED';
    if (isLimit) {
      code = cookiePath ? 'COOKIES_INVALID_OR_EXPIRED' : 'RATE_LIMIT_EXCEEDED';
    } else if (error.name === 'AbortError') {
      code = 'NETWORK_ERROR';
    }
    throw new ApiError(code, error.message);
  }
}

// ==============================================================================
// [WORK IN PROGRESS - COMMENTED OUT] LOGIKA EKSTRAKSI & SLICING SUBTITLE
// 1. SubtitleCue interface (format cue dengan start & end ternormalisasi per klip)
// 2. parseTimestampToSeconds (parser string timestamp VTT/SRT ke float detik)
// 3. parseVttToCues (parser raw file WebVTT teks menjadi cue terstruktur)
// 4. sliceCuesForClip (filter & normalisasi cue relatif 0.000s sesuai start klip)
// 5. fetchSubtitles (pass-through request ke server internal Python)
// ==============================================================================
/*
export interface SubtitleCue {
  id: string;
  start: number;    // Detik relatif terhadap awal klip (0.000s)
  end: number;      // Detik relatif terhadap awal klip
  rawStart: number; // Detik absolut pada video penuh YouTube
  rawEnd: number;   // Detik absolut pada video penuh YouTube
  text: string;     // Teks caption yang sudah dibersihkan dari tag VTT
}

// In-Memory cache subtitle per klip: key = clipId, value = SubtitleCue[]
export const SUBTITLE_CUES_CACHE = new Map<string, SubtitleCue[]>();

export function parseTimestampToSeconds(timestamp: string): number {
  const clean = timestamp.trim().replace(',', '.');
  const parts = clean.split(':');
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]) || 0;
    const minutes = parseFloat(parts[1]) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    const minutes = parseFloat(parts[0]) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    return minutes * 60 + seconds;
  }
  return parseFloat(clean) || 0;
}

export function parseVttToCues(vttContent: string): SubtitleCue[] {
  const lines = vttContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const cues: SubtitleCue[] = [];
  let index = 0;
  let currentStart = 0;
  let currentEnd = 0;
  let currentTextLines: string[] = [];
  let isParsingCue = false;

  const timeRegex = /((?:\d{2}:)?\d{2}:\d{2}[\.,]\d{3})\s*-->\s*((?:\d{2}:)?\d{2}:\d{2}[\.,]\d{3})/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === 'WEBVTT' || trimmed.startsWith('NOTE') || trimmed.startsWith('STYLE')) {
      if (isParsingCue && currentTextLines.length > 0) {
        cues.push({
          id: `cue_${index++}`,
          start: currentStart,
          end: currentEnd,
          rawStart: currentStart,
          rawEnd: currentEnd,
          text: currentTextLines.join(' ').replace(/<[^>]+>/g, '').trim(),
        });
        currentTextLines = [];
        isParsingCue = false;
      }
      continue;
    }

    const match = trimmed.match(timeRegex);
    if (match) {
      if (isParsingCue && currentTextLines.length > 0) {
        cues.push({
          id: `cue_${index++}`,
          start: currentStart,
          end: currentEnd,
          rawStart: currentStart,
          rawEnd: currentEnd,
          text: currentTextLines.join(' ').replace(/<[^>]+>/g, '').trim(),
        });
        currentTextLines = [];
      }
      currentStart = parseTimestampToSeconds(match[1]);
      currentEnd = parseTimestampToSeconds(match[2]);
      isParsingCue = true;
      continue;
    }

    if (isParsingCue) {
      currentTextLines.push(trimmed);
    }
  }

  if (isParsingCue && currentTextLines.length > 0) {
    cues.push({
      id: `cue_${index++}`,
      start: currentStart,
      end: currentEnd,
      rawStart: currentStart,
      rawEnd: currentEnd,
      text: currentTextLines.join(' ').replace(/<[^>]+>/g, '').trim(),
    });
  }

  return cues;
}

export function sliceCuesForClip(
  allCues: SubtitleCue[],
  clipStart: number,
  clipEnd: number
): SubtitleCue[] {
  const clipDuration = clipEnd - clipStart;
  const filtered: SubtitleCue[] = [];

  for (const cue of allCues) {
    if (cue.rawEnd > clipStart && cue.rawStart < clipEnd) {
      const relStart = Math.max(0, cue.rawStart - clipStart);
      const relEnd = Math.min(clipDuration, cue.rawEnd - clipStart);
      filtered.push({
        ...cue,
        start: relStart,
        end: relEnd,
      });
    }
  }

  return filtered;
}

export async function fetchSubtitles(
  videoId: string,
  lang: string = 'id'
): Promise<SubtitleCue[]> {
  const subDir = new File(Paths.document, 'output', videoId, 'subtitles');
  const nativeSubDir = subDir.uri.replace(/^file:\/\//, '');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${DEV_API_BASE_URL}/api/subtitles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_id: videoId,
        output_dir: nativeSubDir,
        lang,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.content) {
      const code = data.message || 'SUBTITLE_NOT_FOUND';
      const rawError = data.error || 'Gagal mengekstrak subtitle';
      throw new ApiError(code, rawError);
    }

    return parseVttToCues(data.content);
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      error.name === 'AbortError' ? 'NETWORK_ERROR' : 'SUBTITLE_ERROR',
      error.message
    );
  }
}
*/


