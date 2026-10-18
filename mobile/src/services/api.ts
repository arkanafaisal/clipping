import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { LocalStorage } from './storage';
import { getCurrentStorageRoot, getStorageRootPath, getStorageStructure } from './storageConfig';
import { STREAM_YTDL_OPTS, HEATMAP_YTDL_OPTS, PRIME_CLIP_DOWNLOAD_OPTS, SUBTITLE_YTDL_OPTS } from '../constants/ytdlp';
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

import { Platform } from 'react-native';
import { isPythonInitialized, setupPythonPaths, getNativeRunnerInfo, executePythonScript } from '../../modules/python-runner';

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
  OUTPUT_PATH_REQUIRED: 'Lokasi tujuan penyimpanan file (output_path) wajib disertakan.',
  FFMPEG_CUT_ERROR: 'Pemotongan presisi klip dengan FFmpeg gagal.',
  STORAGE_PERMISSION_DENIED: 'Akses penyimpanan perangkat ditolak (Permission Denied). Harap berikan izin "Akses Semua File" di Pengaturan HP untuk aplikasi Clipping.',
  DOWNLOAD_FAILED: 'Gagal mengunduh klip video dari YouTube.',
  SUBTITLE_NOT_FOUND: 'Subtitle maupun automatic caption tidak ditemukan pada video YouTube ini.',
  SUBTITLE_URL_MISSING: 'Track subtitle tidak memiliki URL unduhan yang valid.',
  SUBTITLE_ERROR: 'Gagal mengambil data subtitle dari video.',
  INPUT_VIDEO_NOT_FOUND: 'File klip video sumber tidak ditemukan untuk proses export subtitle.',
  NO_SUBTITLES_TO_BURN: 'Daftar subtitle kosong atau tidak memiliki baris teks untuk ditempelkan.',
  FFMPEG_BURN_ERROR: 'Gagal menempelkan (burn) subtitle ke video menggunakan FFmpeg.',
  OUTPUT_FILE_EMPTY: 'File video hasil export subtitle kosong atau gagal dibuat.',
  ASS_GENERATION_FAILED: 'Gagal mengonversi konfigurasi subtitle ke format ASS.',
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
  if (err.code === 'STORAGE_PERMISSION_DENIED') return false;
  const fullText = `${err.name || ''} ${err.code || ''} ${err.message || ''} ${err.rawError || ''}`.toLowerCase();
  if (
    fullText.includes('permission denied') ||
    fullText.includes('operation not permitted') ||
    fullText.includes('not permitted') ||
    fullText.includes('errno 13') ||
    fullText.includes('errno 1')
  ) {
    return false;
  }
  if (err.code === 'RATE_LIMIT_EXCEEDED' || err.code === 'COOKIES_INVALID_OR_EXPIRED') return true;
  return (
    fullText.includes('429') ||
    fullText.includes('403') ||
    fullText.includes('forbidden') ||
    fullText.includes('rate limit') ||
    fullText.includes('bot') ||
    fullText.includes('sign in')
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
  // 1. Prioritaskan runtime native Python (Chaquopy) jika berjalan di APK Android
  if (Platform.OS === 'android' && isPythonInitialized()) {
    const rootPath = getCurrentStorageRoot();
    try {
      setupPythonPaths(rootPath);
    } catch (err) {
      console.log('[Api] Gagal memicu setupPythonPaths:', err);
    }
    const info = getNativeRunnerInfo();
    const ffmpegMsg = info?.ffmpegExists ? 'FFmpeg Siap' : 'FFmpeg Belum Terdeteksi';
    return {
      status: 'ok',
      port: 0,
      message: `Engine Python Native Aktif (${ffmpegMsg})`,
    };
  }

  // 2. Coba port 8080 jika ada server HTTP lokal yang berjalan
  try {
    const res8080 = await pingDirect(EMBEDDED_API_BASE_URL);
    return { status: 'ok', port: 8080, message: res8080.message || 'Server internal Chaquopy aktif (port 8080)' };
  } catch {}

  // 3. Fallback ke server dev eksternal (port 3006 / Termux)
  try {
    const res3006 = await pingDirect(DEV_API_BASE_URL);
    return { status: 'ok', port: 3006, message: res3006.message || 'Server Mobile Dev aktif (port 3006)' };
  } catch {}

  throw new ApiError('SERVER_OFFLINE', 'Engine Python Native belum aktif dan server dev (port 3006) tidak terjangkau.');
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

  // 3. Tier 3: Eksekusi Skrip Python Langsung (Jika memori dan file fisik kosong, atau saat force refresh)
  try {
    const cookiePath = await getValidCookiesPath();
    let data: any = null;
    const isNative = Platform.OS === 'android' && isPythonInitialized();

    if (isNative) {
      data = await executePythonScript('utils.stream_extractor', 'extract_stream_url', {
        video_id: videoId,
        ydl_opts: STREAM_YTDL_OPTS,
        cookie_path: cookiePath,
      });
    } else {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(`${DEV_API_BASE_URL}/api/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            video_id: videoId,
            ydl_opts: STREAM_YTDL_OPTS,
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
      throw new ApiError('EMPTY_RESPONSE', 'Python engine tidak mengembalikan respons stream.');
    }

    if (payload.status === 'error') {
      const code = payload.code || 'PYTHON_EXECUTION_ERROR';
      const rawError = payload.traceback || payload.error || JSON.stringify(payload, null, 2);
      throw new ApiError(code, rawError);
    }

    if (!payload.stream_url) {
      const code = payload.code || 'STREAM_NOT_FOUND';
      const rawError = payload.error || (payload.message ? String(payload.message) : JSON.stringify(payload, null, 2));
      throw new ApiError(code, rawError);
    }

    const streamUrl = payload.stream_url;
    
    // Simpan ke In-Memory Map
    STREAM_MEMORY_MAP.set(videoId, streamUrl);

    // Simpan ke File Fisik di HP (asynchronous)
    LocalStorage.setItem(`stream_url_${videoId}`, streamUrl).catch((err) => {
      console.warn('[StreamCache] Gagal menyimpan stream ke file fisik:', err);
    });

    return streamUrl;
  } catch (error: any) {
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
      title: payload.title || data.title || '',
      clips: formattedClips,
    };

  } catch (error: any) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(error.name === 'AbortError' ? 'NETWORK_ERROR' : 'EXTRACTOR_ERROR', error.message);
  }
}

// In-Memory cache deteksi file download klip: key = fileUri, value = exists boolean
export const DOWNLOADED_CLIPS_CACHE = new Map<string, boolean>();

// Shared clipping output directory:
// fileUri: file:///storage/emulated/0/clipping/output/<videoId>/clip_<rank>_<start>_<end>.mp4
// nativePath: /storage/emulated/0/clipping/output/<videoId>/clip_<rank>_<start>_<end>.mp4
export let SHARED_CLIPPING_ROOT = getCurrentStorageRoot();
export let SHARED_CLIPPING_OUTPUT_DIR = `${SHARED_CLIPPING_ROOT}/output`;

export function syncSharedStorageConfig(root: string) {
  SHARED_CLIPPING_ROOT = root;
  SHARED_CLIPPING_OUTPUT_DIR = `${root}/output`;
}

/**
 * Mengambil path direktori internal sandbox aplikasi (tanpa prefix file://).
 * Direktori ini dijamin 100% memiliki hak akses Read & Write oleh proses Android & Python
 * tanpa bergantung pada izin MANAGE_EXTERNAL_STORAGE di Android 11+.
 */
export function getInternalAppStoragePath(): string {
  if (FileSystem.documentDirectory) {
    const raw = FileSystem.documentDirectory.replace('file://', '');
    return raw.endsWith('/') ? raw.slice(0, -1) : raw;
  }
  return '/data/user/0/com.clipping.app/files';
}

export const INTERNAL_CLIPPING_ROOT = `${getInternalAppStoragePath()}/clipping`;
export const INTERNAL_CLIPPING_OUTPUT_DIR = `${INTERNAL_CLIPPING_ROOT}/output`;

// Path file cookies
export const COOKIES_FILE_NAME = 'cookies.txt';
export const COOKIES_FILE_PATH = `${SHARED_CLIPPING_ROOT}/${COOKIES_FILE_NAME}`;
export const INTERNAL_COOKIES_FILE_PATH = `${INTERNAL_CLIPPING_ROOT}/${COOKIES_FILE_NAME}`;
export const COOKIES_STORAGE_KEY = 'configured_cookies_path';

// In-Memory cache cookies path
let cachedCookiesPath: string | null = null;

async function isPathReadable(path: string): Promise<boolean> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(`file://${path}`);
    if (!fileInfo.exists || fileInfo.isDirectory || fileInfo.size === 0) {
      return false;
    }
    await FileSystem.readAsStringAsync(`file://${path}`, { length: 50 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Memeriksa dan mengambil path cookies yang valid.
 * Prioritas: In-Memory cache -> LocalStorage -> File Fisik Shared -> File Fisik Internal Sandbox.
 * Memverifikasi keterbacaan fisik file di disk sebelum mengembalikan path ke pemanggil.
 */
export async function getValidCookiesPath(): Promise<string | undefined> {
  // 1. Tier 1: In-Memory cache (verifikasi keterbacaan)
  if (cachedCookiesPath) {
    if (await isPathReadable(cachedCookiesPath)) {
      return cachedCookiesPath;
    }
    cachedCookiesPath = null;
  }

  // 2. Tier 2: Path yang tersimpan di LocalStorage
  try {
    const savedPath = await LocalStorage.getItem(COOKIES_STORAGE_KEY);
    if (savedPath && typeof savedPath === 'string' && savedPath.trim().length > 0) {
      const cleanPath = savedPath.trim();
      if (await isPathReadable(cleanPath)) {
        cachedCookiesPath = cleanPath;
        return cachedCookiesPath;
      }
    }
  } catch {}

  // 3. Tier 3: Auto-detect file cookies fisik di internal sandbox (/data/user/0/com.clipping.app/files/clipping/cookies.txt)
  try {
    const internalPath = INTERNAL_COOKIES_FILE_PATH;
    if (await isPathReadable(internalPath)) {
      cachedCookiesPath = internalPath;
      await LocalStorage.setItem(COOKIES_STORAGE_KEY, internalPath);
      return internalPath;
    }
  } catch {}

  // 4. Tier 4: Auto-detect file cookies fisik di shared clipping folder jika terbaca, otomatis migrasi ke internal sandbox
  try {
    const defaultPath = COOKIES_FILE_PATH;
    if (await isPathReadable(defaultPath)) {
      try {
        await FileSystem.copyAsync({
          from: `file://${defaultPath}`,
          to: `file://${INTERNAL_COOKIES_FILE_PATH}`,
        });
        cachedCookiesPath = INTERNAL_COOKIES_FILE_PATH;
        await LocalStorage.setItem(COOKIES_STORAGE_KEY, INTERNAL_COOKIES_FILE_PATH);
        return INTERNAL_COOKIES_FILE_PATH;
      } catch {}
      cachedCookiesPath = defaultPath;
      await LocalStorage.setItem(COOKIES_STORAGE_KEY, defaultPath);
      return defaultPath;
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
 * Seluruh penyimpanan diarahkan 100% ke Internal Sandbox Storage aplikasi (/data/user/0/com.clipping.app/files/clipping/cookies.txt).
 * Jika file cookies lama sudah ada, file tersebut langsung ditimpa (overwritten) secara otomatis tanpa perlu dihapus terlebih dahulu.
 * Menjamin zero-permission: tidak memerlukan izin akses storage Android.
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

  // Simpan secara privat di internal sandbox aplikasi (/data/user/0/com.clipping.app/files/clipping/cookies.txt)
  // Menjamin 100% hak akses Read & Write privat tanpa batasan Scoped Storage Android (Zero Permission).
  const targetPath = INTERNAL_COOKIES_FILE_PATH;

  // Pastikan direktori internal sudah ada
  try {
    const internalDirUri = `file://${INTERNAL_CLIPPING_ROOT}`;
    const dirInfo = await FileSystem.getInfoAsync(internalDirUri);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(internalDirUri, { intermediates: true });
    }
  } catch {}

  // Hapus file cookies lama terlebih dahulu setelah link tervalidasi sebelum menulis file baru
  try {
    await FileSystem.deleteAsync(`file://${targetPath}`, { idempotent: true });
  } catch {}

  let data: any = null;
  const isNative = Platform.OS === 'android' && isPythonInitialized();

  try {
    if (isNative) {
      data = await executePythonScript('utils.gdrive_downloader', 'download_gdrive_public_file', {
        file_id: fileId,
        output_path: targetPath,
        config: DEFAULT_GDRIVE_DOWNLOAD_CONFIG,
      });
    } else {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      try {
        const response = await fetch(`${DEV_API_BASE_URL}/api/download-gdrive-file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_id: fileId,
            output_path: targetPath,
            config: DEFAULT_GDRIVE_DOWNLOAD_CONFIG,
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

    const payload = (data?.data && typeof data.data === 'object' && !Array.isArray(data.data)) ? data.data : data;

    if (!payload || payload.status !== 'success') {
      const code = payload?.code || payload?.message || 'GDRIVE_DOWNLOAD_FAILED';
      const rawErr = payload?.error || payload?.traceback || JSON.stringify(payload, null, 2);
      throw new ApiError(code, rawErr);
    }

    // Salin juga file cookies ke shared storage (/storage/emulated/0/clipping/cookies.txt) jika memungkinkan
    try {
      await FileSystem.copyAsync({
        from: `file://${targetPath}`,
        to: `file://${COOKIES_FILE_PATH}`,
      });
    } catch {}

    // Menimpa path cookies aktif di memory cache dan LocalStorage
    cachedCookiesPath = targetPath;
    await LocalStorage.setItem(COOKIES_STORAGE_KEY, targetPath);
    if (payload.file_size) {
      await LocalStorage.setItem('cookies_file_size', String(payload.file_size));
    }
    await LocalStorage.setItem('cookies_last_synced', String(Date.now()));
    return targetPath;
  } catch (error: any) {
    if (error instanceof ApiError) throw error;
    if (error.name === 'AbortError') {
      throw new ApiError('NETWORK_ERROR', 'Waktu koneksi pengunduhan Google Drive habis (timeout 30s).');
    }
    throw new ApiError('GDRIVE_DOWNLOAD_FAILED', error.message);
  }
}

/**
 * Menghapus file cookies dari penyimpanan internal & shared, serta mereset state ke mode anonim.
 */
export async function deleteCookies(): Promise<void> {
  cachedCookiesPath = null;
  try {
    await LocalStorage.removeItem(COOKIES_STORAGE_KEY);
  } catch {}
  try {
    await LocalStorage.removeItem('cookies_file_size');
  } catch {}
  try {
    await LocalStorage.removeItem('cookies_last_synced');
  } catch {}
  try {
    await FileSystem.deleteAsync(`file://${INTERNAL_COOKIES_FILE_PATH}`, { idempotent: true });
  } catch {}
  try {
    await FileSystem.deleteAsync(`file://${COOKIES_FILE_PATH}`, { idempotent: true });
  } catch {}
}

/**
 * Memformat durasi detik ke format waktu string yang aman untuk sistem file (titik '.' sebagai pemisah).
 * Menghilangkan prefix/wrapper agar konsisten dengan tampilan waktu pada card klip di UI:
 * - Jika h > 0: "hh.mm.ss" (contoh: "01.15.30")
 * - Jika h === 0: "mm.ss" (contoh: "00.12", "01.35")
 */
export function formatTimeForFilename(seconds: number): string {
  if (seconds === undefined || seconds === null || isNaN(seconds)) return '00.00';
  const totalSeconds = Math.round(seconds);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const pad = (num: number) => num.toString().padStart(2, '0');
  if (h > 0) {
    return `${pad(h)}.${pad(m)}.${pad(s)}`;
  }
  return `${pad(m)}.${pad(s)}`;
}

/**
 * Menghasilkan nama file klip berbasis rentang waktu yang sudah terformat:
 * "<start_terformat> - <end_terformat>.mp4" (contoh: "00.12 - 01.35.mp4").
 */
export function getClipFilename(start: number, end: number): string {
  const startFormatted = formatTimeForFilename(start);
  const endFormatted = formatTimeForFilename(end);
  return `${startFormatted} - ${endFormatted}.mp4`;
}

/**
 * Menghasilkan nama file klip video baru dengan subtitle yang tertempel permanen:
 * "<start> - <end> (Subtitled).mp4" (contoh: "00.12 - 01.35 (Subtitled).mp4").
 */
export function getSubtitledClipFilename(start: number, end: number): string {
  const startFormatted = formatTimeForFilename(start);
  const endFormatted = formatTimeForFilename(end);
  return `${startFormatted} - ${endFormatted} (Subtitled).mp4`;
}

/**
 * Menghasilkan alokasi lokasi file tujuan video klip ber-subtitle pada shared storage (/storage/emulated/0/clipping/output/<videoId>/).
 * File ini merupakan file baru yang terpisah, menjaga file klip asli tetap ada.
 */
export function getSubtitledClipOutputFilePath(
  videoId: string,
  start: number,
  end: number
): { fileUri: string; nativePath: string } {
  const filename = getSubtitledClipFilename(start, end);
  const nativePath = `${SHARED_CLIPPING_OUTPUT_DIR}/${videoId}/${filename}`;
  const fileUri = `file://${nativePath}`;
  return { fileUri, nativePath };
}

/**
 * Menghasilkan alokasi lokasi file tujuan download klip pada shared storage (/storage/emulated/0/clipping/output/).
 * Nama file menggunakan format rentang waktu murni tanpa prefix: "<start> - <end>.mp4".
 */
export function getClipOutputFilePath(
  videoId: string,
  start: number,
  end: number,
  rank?: number
): { fileUri: string; nativePath: string } {
  const filename = getClipFilename(start, end);
  const nativePath = `${SHARED_CLIPPING_OUTPUT_DIR}/${videoId}/${filename}`;
  const fileUri = `file://${nativePath}`;
  return { fileUri, nativePath };
}

/**
 * Menghasilkan alokasi lokasi file tujuan download klip pada internal sandbox storage.
 * Digunakan sebagai fallback jika shared storage belum memiliki izin MANAGE_EXTERNAL_STORAGE.
 */
export function getClipInternalOutputFilePath(
  videoId: string,
  start: number,
  end: number,
  rank?: number
): { fileUri: string; nativePath: string } {
  const filename = getClipFilename(start, end);
  const nativePath = `${INTERNAL_CLIPPING_OUTPUT_DIR}/${videoId}/${filename}`;
  const fileUri = `file://${nativePath}`;
  return { fileUri, nativePath };
}

/**
 * Menyelesaikan fileUri yang valid dan dapat diputar untuk klip lokal.
 * Mendeteksi format baru "<start> - <end>.mp4" terlebih dahulu, dengan fallback backward-compatible ke format lama.
 */
export async function resolvePlayableClipUri(
  videoId: string,
  start: number,
  end: number,
  rank?: number
): Promise<string> {
  // 1. Cek format baru di shared storage
  const shared = getClipOutputFilePath(videoId, start, end, rank);
  try {
    const info = await FileSystem.getInfoAsync(shared.fileUri);
    if (info.exists) return shared.fileUri;
  } catch {}

  // 2. Cek format baru di internal sandbox
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
 * Mendukung dual-storage: mencoba shared storage (/storage/emulated/0/clipping) terlebih dahulu,
 * dan otomatis beralih ke internal sandbox storage jika terkendala izin akses penyimpanan (Permission Denied).
 * Non-blocking: berjalan di background tanpa menghambat thread interaksi UI.
 */
export async function downloadClip(
  videoId: string,
  start: number,
  end: number,
  rank?: number,
  progressPath?: string
): Promise<{ status: string; output_path: string; fileUri: string; stream_url?: string }> {
  // Kandidat 1: Shared Storage (/storage/emulated/0/clipping/output/...)
  // Kandidat 2: Internal Sandbox Storage (/data/user/0/com.clipping.app/files/clipping/output/...)
  const candidates = [
    getClipOutputFilePath(videoId, start, end, rank),
    getClipInternalOutputFilePath(videoId, start, end, rank),
  ];

  const cachedStreamUrl = await getCachedDownloadStreamUrl(videoId);
  const cookiePath = await getValidCookiesPath();
  let lastError: any = null;

  for (let c = 0; c < candidates.length; c++) {
    const { fileUri, nativePath } = candidates[c];
    const isShared = c === 0;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 menit timeout download klip

    // Simpan cache metadata video_info.json murni di internal sandbox privat
    // agar pembacaan & penulisan JSON tidak melanggar Scoped Storage Android di shared storage
    const internalVideoDir = `${INTERNAL_CLIPPING_OUTPUT_DIR}/${videoId}`;
    const infoJsonPath = `${internalVideoDir}/video_info.json`;

    try {
      const internalDirUri = `file://${internalVideoDir}`;
      const dirInfo = await FileSystem.getInfoAsync(internalDirUri);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(internalDirUri, { intermediates: true });
      }
    } catch {}

    const nativeInfo = getNativeRunnerInfo();
    const nativeFfmpeg = nativeInfo?.ffmpegExists ? nativeInfo.ffmpegPath : undefined;

    const clipYdlOpts = {
      ...PRIME_CLIP_DOWNLOAD_OPTS,
      load_info_filename: infoJsonPath,
      writeinfojson: false, // Matikan pembuatan file .info.json di shared storage agar folder bersih & tidak ditolak izin storage
      ...(nativeFfmpeg ? { ffmpeg_location: nativeFfmpeg } : {}),
    };

    if (!isShared) {
      try {
        const internalDirUri = `file://${INTERNAL_CLIPPING_OUTPUT_DIR}/${videoId}`;
        const dirInfo = await FileSystem.getInfoAsync(internalDirUri);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(internalDirUri, { intermediates: true });
        }
      } catch {}
    }

    try {
      let data: any = null;
      const isNative = Platform.OS === 'android' && isPythonInitialized();

      if (isNative) {
        data = await executePythonScript('utils.clip_downloader', 'download_clip_direct', {
          video_id: videoId,
          start,
          end,
          output_path: nativePath,
          ydl_opts: clipYdlOpts,
          stream_url: cachedStreamUrl || undefined,
          cookie_path: cookiePath,
          progress_path: progressPath,
        });
      } else {
        // Fallback ke DEV_API_BASE_URL (port 3006 / Termux) jika mode dev
        const response = await fetch(`${DEV_API_BASE_URL}/api/download-clip`, {
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
            progress_path: progressPath,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        data = await response.json().catch(() => ({}));
      }

      const payload = (data?.data && typeof data.data === 'object') ? data.data : data;

      // Tangkap download stream URL dari response skrip dan simpan jika baru / berbeda
      if (payload?.stream_url && payload.stream_url !== cachedStreamUrl) {
        await saveCachedDownloadStreamUrl(videoId, payload.stream_url);
      }

      if (!payload || payload.status !== 'success') {
        const rawError = payload?.traceback || payload?.error || (payload ? JSON.stringify(payload, null, 2) : 'Gagal mengunduh klip');
        const lowerRaw = rawError.toLowerCase();

        const isPermissionError =
          lowerRaw.includes('permission denied') ||
          lowerRaw.includes('operation not permitted') ||
          lowerRaw.includes('not permitted') ||
          lowerRaw.includes('errno 13') ||
          lowerRaw.includes('errno 1');

        // Jika permission/EPERM error pada shared storage dan masih ada internal sandbox fallback, coba fallback
        if (isPermissionError && isShared) {
          console.warn(`[DownloadClip] Permission/EPERM error pada shared path ${nativePath}, mencoba internal sandbox fallback...`);
          continue;
        }

        // Bersihkan cache URL stream & file info JSON agar request berikutnya tidak terjebak cache lama
        await clearCachedDownloadStreamUrl(videoId);
        FileSystem.deleteAsync(`file://${infoJsonPath}`, { idempotent: true }).catch(() => {});

        let code = payload?.code || data?.code || data?.message || 'DOWNLOAD_FAILED';

        if (isPermissionError) {
          code = 'STORAGE_PERMISSION_DENIED';
        } else if (lowerRaw.includes('requested format is not available') || lowerRaw.includes('format is not available')) {
          code = 'FORMAT_NOT_AVAILABLE';
        } else if (payload?.cookies_attempted || data?.cookies_attempted) {
          code = 'COOKIES_INVALID_OR_EXPIRED';
        } else if (!cookiePath) {
          code = 'RATE_LIMIT_EXCEEDED';
        } else if ((payload?.cookies_path || data?.cookies_path) && (payload?.cookies_file_exists === false || data?.cookies_file_exists === false)) {
          code = 'COOKIES_FILE_NOT_FOUND';
        } else if (isRateLimitOrRestrictedError({ message: rawError, rawError })) {
          code = cookiePath ? 'COOKIES_INVALID_OR_EXPIRED' : 'RATE_LIMIT_EXCEEDED';
        }

        throw new ApiError(code, rawError);
      }

      // Tandai pada in-memory cache untuk kedua URI (shared dan internal)
      DOWNLOADED_CLIPS_CACHE.set(fileUri, true);
      DOWNLOADED_CLIPS_CACHE.set(candidates[0].fileUri, true);

      // Sinkronisasi otomatis ke Shared Storage jika tadi disimpan di internal sandbox
      if (fileUri !== candidates[0].fileUri) {
        try {
          const sharedTargetUri = candidates[0].fileUri;
          const targetDir = `file://${SHARED_CLIPPING_OUTPUT_DIR}/${videoId}`;
          const targetDirInfo = await FileSystem.getInfoAsync(targetDir);
          if (!targetDirInfo.exists) {
            await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });
          }
          await FileSystem.copyAsync({
            from: fileUri,
            to: sharedTargetUri,
          });
          console.log(`[DownloadClip] Berhasil menduplikasi klip ke shared storage: ${sharedTargetUri}`);
        } catch (copyErr) {
          console.warn('[DownloadClip] Gagal menyalin ke shared storage:', copyErr);
        }
      }

      // Sinkronisasi file klip ke Galeri/Shared Storage perangkat via MediaStore (sesuai Rule 20)
      try {
        const { status } = await MediaLibrary.getPermissionsAsync();
        if (status === 'granted') {
          await MediaLibrary.createAssetAsync(fileUri);
        } else {
          const req = await MediaLibrary.requestPermissionsAsync();
          if (req.status === 'granted') {
            await MediaLibrary.createAssetAsync(fileUri);
          }
        }
      } catch (mediaErr) {
        console.warn('[DownloadClip] Gagal mendaftarkan klip ke MediaLibrary:', mediaErr);
      }

      return {
        status: 'success',
        output_path: nativePath,
        fileUri,
        stream_url: data.stream_url,
      };
    } catch (error: any) {
      clearTimeout(timeoutId);
      lastError = error;
      const lowerErr = (error.message || '').toLowerCase() + ' ' + (error.rawError || '').toLowerCase();
      const isErrPermission =
        lowerErr.includes('permission denied') ||
        lowerErr.includes('operation not permitted') ||
        lowerErr.includes('not permitted') ||
        lowerErr.includes('errno 13') ||
        lowerErr.includes('errno 1');

      if (isErrPermission && isShared) {
        console.warn(`[DownloadClip] Error permission pada ${nativePath}, beralih ke internal sandbox...`);
        continue;
      }
      if (error instanceof ApiError) throw error;
      const isLimit = isRateLimitOrRestrictedError(error);
      let code = 'DOWNLOAD_FAILED';
      if (isErrPermission) {
        code = 'STORAGE_PERMISSION_DENIED';
      } else if (isLimit) {
        code = cookiePath ? 'COOKIES_INVALID_OR_EXPIRED' : 'RATE_LIMIT_EXCEEDED';
      } else if (error.name === 'AbortError') {
        code = 'NETWORK_ERROR';
      }
      throw new ApiError(code, error.message);
    }
  }

  throw lastError || new ApiError('DOWNLOAD_FAILED', 'Gagal mengunduh klip video.');
}

// ==============================================================================
// LOGIKA EKSTRAKSI, CACHING, & MANAJEMEN SUBTITLE DINAMIS (SHARED STORAGE)
// ==============================================================================

export interface SubtitleCue {
  id: string;
  start: number;    // Detik relatif terhadap awal klip (mulai dari 0.00s)
  end: number;      // Detik relatif terhadap awal klip
  rawStart: number; // Detik absolut pada video YouTube utuh
  rawEnd: number;   // Detik absolut pada video YouTube utuh
  text: string;     // Teks subtitle bersih (single line)
  fontSize?: number; // Hanya ada jika di-override dari base global 14 (jika kosong/14 maka di-omit)
}

export interface SubtitleStyle {
  fontSize: number;          // Default 14
  color: string;             // Hex color misal '#FFFFFF'
  backgroundColor: string;   // Background pill misal 'rgba(0,0,0,0.65)'
  strokeColor?: string;      // Outline color misal '#000000'
  strokeWidth?: number;      // Default 1
  fontWeight: 'normal' | 'bold' | '600' | '700'; // Default 'bold'
  positionY: number;         // Skala posisi vertikal 0 - 100 terhadap frame video (default 85)
  positionX: number;         // Skala posisi horizontal 0 - 100 terhadap frame video (default 50)
}

export interface ClipSubtitleData {
  videoId: string;
  start: number;
  end: number;
  lang: string;
  isAuto?: boolean;
  style: SubtitleStyle;
  cues: SubtitleCue[];
  updatedAt: number;
}

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontSize: 14,
  color: '#FFFFFF',
  backgroundColor: 'transparent',
  strokeColor: '#000000',
  strokeWidth: 2,
  fontWeight: 'bold',
  positionY: 85,
  positionX: 50,
};

/**
 * Menghasilkan nama file subtitle klip sesuai format waktu yang sudah terformat:
 * "<start> - <end>.json" (contoh: "00.12 - 01.35.json").
 */
export function getClipSubtitleFilename(start: number, end: number): string {
  const startFormatted = formatTimeForFilename(start);
  const endFormatted = formatTimeForFilename(end);
  return `${startFormatted} - ${endFormatted}.json`;
}

/**
 * Menghasilkan path file subtitle per-klip di private storage aplikasi (internal sandbox).
 * Format JSON merupakan file dokumen, bukan media, sehingga disimpan di internal storage
 * agar 100% bebas dari batasan Android Scoped Storage (java.io.IOException isn't writable).
 */
export function getClipSubtitleFilePath(
  videoId: string,
  start: number,
  end: number
): { fileUri: string; nativePath: string } {
  const filename = getClipSubtitleFilename(start, end);
  const nativePath = `${INTERNAL_CLIPPING_OUTPUT_DIR}/${videoId}/${filename}`;
  return { fileUri: `file://${nativePath}`, nativePath };
}

/**
 * Menghasilkan path cache subtitle mentah video utuh di private storage aplikasi.
 */
export function getRawSubtitlesCacheFilePath(
  videoId: string
): { fileUri: string; nativePath: string } {
  const nativePath = `${INTERNAL_CLIPPING_OUTPUT_DIR}/${videoId}/raw_subtitles.json`;
  return { fileUri: `file://${nativePath}`, nativePath };
}

// In-Memory cache subtitle video utuh (Key = videoId)
const RAW_SUBTITLES_MEMORY_MAP = new Map<string, { cues: SubtitleCue[]; lang: string; isAuto: boolean }>();

/**
 * Parse data YouTube json3 menjadi daftar SubtitleCue terstruktur.
 */
export function parseJson3ToCues(json3Data: any): SubtitleCue[] {
  if (!json3Data || !Array.isArray(json3Data.events)) return [];
  const cues: SubtitleCue[] = [];
  let index = 0;

  for (const ev of json3Data.events) {
    if (!ev || typeof ev.tStartMs !== 'number') continue;
    const startSec = ev.tStartMs / 1000;
    const durSec = (typeof ev.dDurationMs === 'number' && ev.dDurationMs > 0) ? ev.dDurationMs / 1000 : 2.0;
    const endSec = startSec + durSec;

    let text = '';
    if (Array.isArray(ev.segs)) {
      text = ev.segs.map((s: any) => s?.utf8 || '').join('');
    }
    const cleanText = text.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleanText) continue;

    cues.push({
      id: `cue_${index++}`,
      start: startSec,
      end: endSec,
      rawStart: startSec,
      rawEnd: endSec,
      text: cleanText,
    });
  }
  return cues;
}

/**
 * Parse string WebVTT teks menjadi daftar SubtitleCue terstruktur.
 */
export function parseVttToCues(vttContent: string): SubtitleCue[] {
  const lines = vttContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const cues: SubtitleCue[] = [];
  let index = 0;
  let currentStart = 0;
  let currentEnd = 0;
  let currentTextLines: string[] = [];
  let isParsingCue = false;

  const timeRegex = /((?:\d{2}:)?\d{2}:\d{2}[\.,]\d{3})\s*-->\s*((?:\d{2}:)?\d{2}:\d{2}[\.,]\d{3})/;

  const parseTime = (timestamp: string): number => {
    const clean = timestamp.trim().replace(',', '.');
    const parts = clean.split(':');
    if (parts.length === 3) {
      return (parseFloat(parts[0]) || 0) * 3600 + (parseFloat(parts[1]) || 0) * 60 + (parseFloat(parts[2]) || 0);
    } else if (parts.length === 2) {
      return (parseFloat(parts[0]) || 0) * 60 + (parseFloat(parts[1]) || 0);
    }
    return parseFloat(clean) || 0;
  };

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
      currentStart = parseTime(match[1]);
      currentEnd = parseTime(match[2]);
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

/**
 * Menormalisasi daftar SubtitleCue agar strictly single-line & non-overlapping:
 * 1. Diurutkan berdasarkan start time lalu end time.
 * 2. Teks dibersihkan menjadi 1 baris (single line, no newlines).
 * 3. Jika ada tumpang tindih waktu (overlap), previous.end dipotong agar tepat di current.start.
 * 4. Jika start sama persis, teks digabungkan.
 * 5. Memastikan setiap cue berdurasi minimal 0.4s.
 */
export function normalizeSingleTrackCues(cues: SubtitleCue[], maxDuration?: number): SubtitleCue[] {
  if (!Array.isArray(cues) || cues.length === 0) return [];

  const sorted = [...cues]
    .map((c, idx) => {
      const cue: SubtitleCue = {
        ...c,
        id: c.id || `cue_${idx}`,
        start: Math.max(0, Math.round(c.start * 100) / 100),
        end: Math.max(0, Math.round(c.end * 100) / 100),
        rawStart: typeof c.rawStart === 'number' ? c.rawStart : c.start,
        rawEnd: typeof c.rawEnd === 'number' ? c.rawEnd : c.end,
        text: (c.text || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim(),
      };
      if (typeof c.fontSize === 'number' && c.fontSize !== 14) {
        cue.fontSize = c.fontSize;
      } else {
        delete cue.fontSize;
      }
      return cue;
    })
    .filter((c) => c.text.length > 0)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const normalized: SubtitleCue[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const current = { ...sorted[i] };
    if (normalized.length === 0) {
      if (current.end <= current.start) {
        current.end = Math.round((current.start + 1.5) * 100) / 100;
      }
      if (maxDuration && current.end > maxDuration) {
        current.end = maxDuration;
      }
      normalized.push(current);
      continue;
    }

    const prev = normalized[normalized.length - 1];

    // Jika start sama persis atau sangat berdekatan (< 0.15s)
    if (Math.abs(current.start - prev.start) < 0.15) {
      if (!prev.text.includes(current.text)) {
        prev.text = `${prev.text} ${current.text}`.trim();
      }
      prev.end = Math.max(prev.end, current.end);
      continue;
    }

    // Jika terjadi overlap waktu (current.start < prev.end)
    if (current.start < prev.end) {
      prev.end = Math.max(prev.start + 0.3, current.start);
      if (prev.end - prev.start < 0.3) {
        if (!current.text.includes(prev.text)) {
          current.text = `${prev.text} ${current.text}`.trim();
        }
        normalized.pop();
      }
    }

    if (current.end <= current.start) {
      current.end = Math.round((current.start + 1.5) * 100) / 100;
    }
    if (maxDuration && current.end > maxDuration) {
      current.end = maxDuration;
    }

    normalized.push(current);
  }

  return normalized;
}

/**
 * Filter dan normalisasi cue subtitle agar pas dengan rentang waktu klip (relatif 0.00s)
 * dan strictly single-line non-overlapping.
 */
export function sliceCuesForClip(
  allCues: SubtitleCue[],
  clipStart: number,
  clipEnd: number
): SubtitleCue[] {
  const clipDuration = clipEnd - clipStart;
  const filtered: SubtitleCue[] = [];
  let index = 0;

  for (const cue of allCues) {
    if (cue.rawEnd > clipStart && cue.rawStart < clipEnd) {
      const relStart = Math.max(0, cue.rawStart - clipStart);
      const relEnd = Math.min(clipDuration, cue.rawEnd - clipStart);
      if (relEnd > relStart) {
        const cueObj: SubtitleCue = {
          id: `clip_cue_${index++}`,
          start: Math.round(relStart * 100) / 100,
          end: Math.round(relEnd * 100) / 100,
          rawStart: cue.rawStart,
          rawEnd: cue.rawEnd,
          text: cue.text.replace(/\r?\n+/g, ' ').trim(),
        };
        if (typeof cue.fontSize === 'number' && cue.fontSize !== 14) {
          cueObj.fontSize = cue.fontSize;
        }
        filtered.push(cueObj);
      }
    }
  }

  return normalizeSingleTrackCues(filtered, clipDuration);
}

/**
 * Mengambil track subtitle video utuh dari YouTube dengan arsitektur 2-Tier Caching di Frontend:
 * 1. Tier 1: In-Memory Map (0ms latency)
 * 2. Tier 2: File raw_subtitles.json di Shared Storage (/storage/emulated/0/clipping/output/<videoId>/)
 * 3. Eksekusi Python jika belum ada cache.
 */
export async function fetchSubtitlesForVideo(
  videoId: string,
  preferredLang?: string
): Promise<{ cues: SubtitleCue[]; lang: string; isAuto: boolean }> {
  // 1. Cek Tier 1 In-Memory
  if (RAW_SUBTITLES_MEMORY_MAP.has(videoId)) {
    const cached = RAW_SUBTITLES_MEMORY_MAP.get(videoId);
    if (cached) return cached;
  }

  // 2. Cek Tier 2 File Fisik di Shared Storage
  const cachePath = getRawSubtitlesCacheFilePath(videoId);
  try {
    const info = await FileSystem.getInfoAsync(cachePath.fileUri);
    if (info.exists && !info.isDirectory) {
      const rawJson = await FileSystem.readAsStringAsync(cachePath.fileUri);
      const parsed = JSON.parse(rawJson);
      if (parsed && Array.isArray(parsed.cues)) {
        const result = {
          cues: parsed.cues as SubtitleCue[],
          lang: parsed.lang || 'id',
          isAuto: Boolean(parsed.isAuto),
        };
        RAW_SUBTITLES_MEMORY_MAP.set(videoId, result);
        return result;
      }
    }
  } catch {}

  // 3. Eksekusi Skrip Python Native Chaquopy
  const cookiePath = await getValidCookiesPath();
  let data: any = null;
  const isNative = Platform.OS === 'android' && isPythonInitialized();

  if (isNative) {
    data = await executePythonScript('utils.subtitle_fetcher', 'extract_subtitles_data', {
      video_id: videoId,
      ydl_opts: SUBTITLE_YTDL_OPTS,
      cookie_path: cookiePath,
      preferred_lang: preferredLang,
    });
  } else {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(`${DEV_API_BASE_URL}/api/subtitles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_id: videoId,
          ydl_opts: SUBTITLE_YTDL_OPTS,
          cookie_path: cookiePath,
          preferred_lang: preferredLang,
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

  const payload = (data?.data && typeof data.data === 'object' && !Array.isArray(data.data)) ? data.data : data;

  if (!payload) {
    throw new ApiError('EMPTY_RESPONSE', 'Python engine tidak mengembalikan data subtitle.');
  }

  if (payload.status === 'error') {
    const rawError = payload.traceback || payload.error || JSON.stringify(payload, null, 2);
    let code = payload.code || 'SUBTITLE_ERROR';
    const lower = rawError.toLowerCase();
    const isBotOrSign = lower.includes('bot') || lower.includes('sign in') || lower.includes('captcha') || lower.includes('confirm you');
    if (isBotOrSign) {
      code = cookiePath ? 'COOKIES_INVALID_OR_EXPIRED' : 'RATE_LIMIT_EXCEEDED';
    }
    throw new ApiError(code, rawError);
  }

  let cues: SubtitleCue[] = [];
  if (payload.format === 'json3' && typeof payload.raw_data === 'object') {
    cues = parseJson3ToCues(payload.raw_data);
  } else if (typeof payload.raw_data === 'string') {
    if (payload.raw_data.trim().startsWith('{')) {
      try {
        const parsedJson = JSON.parse(payload.raw_data);
        cues = parseJson3ToCues(parsedJson);
      } catch {
        cues = parseVttToCues(payload.raw_data);
      }
    } else {
      cues = parseVttToCues(payload.raw_data);
    }
  }

  if (!cues || cues.length === 0) {
    throw new ApiError('SUBTITLE_NOT_FOUND', 'Track subtitle kosong atau tidak memiliki caption yang dapat diparse.');
  }

  const result = {
    cues,
    lang: payload.lang || 'id',
    isAuto: Boolean(payload.is_auto),
  };

  // Simpan ke Tier 1 In-Memory
  RAW_SUBTITLES_MEMORY_MAP.set(videoId, result);

  // Simpan ke Tier 2 File Fisik Private Storage secara asynchronous
  try {
    const folderUri = cachePath.fileUri.substring(0, cachePath.fileUri.lastIndexOf('/'));
    const dirInfo = await FileSystem.getInfoAsync(folderUri);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(folderUri, { intermediates: true });
    }
    await FileSystem.writeAsStringAsync(cachePath.fileUri, JSON.stringify(result, null, 2));
  } catch (err) {
    console.warn('[SubtitleCache] Gagal menyimpan raw_subtitles.json ke private storage:', err);
  }

  return result;
}

/**
 * Membaca data subtitle yang sudah disimpan untuk klip tertentu dari private storage aplikasi.
 */
export async function loadClipSubtitle(
  videoId: string,
  start: number,
  end: number
): Promise<ClipSubtitleData | null> {
  const { fileUri } = getClipSubtitleFilePath(videoId, start, end);

  // 1. Cek Private Storage (Internal Sandbox)
  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    if (info.exists && !info.isDirectory) {
      const content = await FileSystem.readAsStringAsync(fileUri);
      const parsed = JSON.parse(content);
      if (parsed && Array.isArray(parsed.cues)) {
        return parsed as ClipSubtitleData;
      }
    }
  } catch {}

  // 2. Fallback legacy jika pernah tersimpan di Shared Storage lama
  try {
    const filename = getClipSubtitleFilename(start, end);
    const legacySharedUri = `file://${SHARED_CLIPPING_OUTPUT_DIR}/${videoId}/${filename}`;
    const legacyInfo = await FileSystem.getInfoAsync(legacySharedUri);
    if (legacyInfo.exists && !legacyInfo.isDirectory) {
      const content = await FileSystem.readAsStringAsync(legacySharedUri);
      const parsed = JSON.parse(content);
      if (parsed && Array.isArray(parsed.cues)) {
        return parsed as ClipSubtitleData;
      }
    }
  } catch {}

  return null;
}

/**
 * Menyimpan data subtitle klip ke file JSON di private storage aplikasi (internal sandbox).
 */
export async function saveClipSubtitle(data: ClipSubtitleData): Promise<void> {
  const { fileUri } = getClipSubtitleFilePath(data.videoId, data.start, data.end);
  const folderUri = fileUri.substring(0, fileUri.lastIndexOf('/'));
  const dirInfo = await FileSystem.getInfoAsync(folderUri);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(folderUri, { intermediates: true });
  }
  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(data, null, 2));
}

/**
 * Menghapus file subtitle klip dari private storage aplikasi.
 */
export async function deleteClipSubtitle(
  videoId: string,
  start: number,
  end: number
): Promise<boolean> {
  const { fileUri } = getClipSubtitleFilePath(videoId, start, end);
  let deleted = false;

  try {
    await FileSystem.deleteAsync(fileUri, { idempotent: true });
    deleted = true;
  } catch {}

  // Bersihkan juga legacy file di shared storage jika ada
  try {
    const filename = getClipSubtitleFilename(start, end);
    const legacySharedUri = `file://${SHARED_CLIPPING_OUTPUT_DIR}/${videoId}/${filename}`;
    await FileSystem.deleteAsync(legacySharedUri, { idempotent: true });
    deleted = true;
  } catch {}

  return deleted;
}

/**
 * Memeriksa apakah subtitle klip sudah tersimpan di private storage aplikasi.
 */
export async function checkClipSubtitleExists(
  videoId: string,
  start: number,
  end: number
): Promise<boolean> {
  const { fileUri } = getClipSubtitleFilePath(videoId, start, end);
  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    if (info.exists && !info.isDirectory) return true;
  } catch {}

  try {
    const filename = getClipSubtitleFilename(start, end);
    const legacySharedUri = `file://${SHARED_CLIPPING_OUTPUT_DIR}/${videoId}/${filename}`;
    const legacyInfo = await FileSystem.getInfoAsync(legacySharedUri);
    return Boolean(legacyInfo.exists && !legacyInfo.isDirectory);
  } catch {
    return false;
  }
}

export interface ClipTemplateConfig {
  context: {
    enabled: boolean;
    text: string;
    fontSize: number;
    paddingY: number;
  };
  facecam: {
    enabled: boolean;
    zoom: number;
    cropX: number; // 0 - 100 (% offset from center)
    cropY: number; // 0 - 100 (% offset from center)
  };
  mainVideo: {
    zoom: number;
    cropX: number; // 0 - 100 (% offset from center)
    cropY: number; // 0 - 100 (% offset from center)
  };
}

export const DEFAULT_TEMPLATE_CONFIG: ClipTemplateConfig = {
  context: {
    enabled: false,
    text: 'JUDUL VIDEO CLIP',
    fontSize: 16,
    paddingY: 10,
  },
  facecam: {
    enabled: false,
    zoom: 2.0,
    cropX: 80,
    cropY: 20,
  },
  mainVideo: {
    zoom: 1.0,
    cropX: 50,
    cropY: 50,
  },
};

export function getClipTemplateFilename(start: number, end: number): string {
  const startFormatted = formatTimeForFilename(start);
  const endFormatted = formatTimeForFilename(end);
  return `${startFormatted} - ${endFormatted} (Template).json`;
}

export function getClipTemplateFilePath(
  videoId: string,
  start: number,
  end: number
): { fileUri: string; nativePath: string } {
  const filename = getClipTemplateFilename(start, end);
  const nativePath = `${INTERNAL_CLIPPING_OUTPUT_DIR}/${videoId}/${filename}`;
  const fileUri = `file://${nativePath}`;
  return { fileUri, nativePath };
}

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

// ==============================================================================
// KONFIGURASI GLOBAL TINGKAT VIDEO (SHARED / CONSTANT ANTAR KLIP PADA VIDEO SAMA)
// ==============================================================================

export interface VideoGlobalConfig {
  subtitlePosition?: { x: number; y: number };
  facecam?: ClipTemplateConfig['facecam'];
  mainVideo?: ClipTemplateConfig['mainVideo'];
  contextStyle?: {
    fontSize: number;
    paddingY: number;
  };
  portraitEnabled?: boolean;
}

export const VIDEO_GLOBAL_CONFIG_MEMORY_MAP = new Map<string, VideoGlobalConfig>();

export function getVideoGlobalConfigFilePath(videoId: string): { fileUri: string; nativePath: string } {
  const nativePath = `${INTERNAL_CLIPPING_OUTPUT_DIR}/${videoId}/video_config.json`;
  const fileUri = `file://${nativePath}`;
  return { fileUri, nativePath };
}

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
      ? { ...(current.facecam || DEFAULT_TEMPLATE_CONFIG.facecam), ...updates.facecam }
      : current.facecam,
    mainVideo: updates.mainVideo
      ? { ...(current.mainVideo || DEFAULT_TEMPLATE_CONFIG.mainVideo), ...updates.mainVideo }
      : current.mainVideo,
    contextStyle: updates.contextStyle
      ? { ...(current.contextStyle || { fontSize: 16, paddingY: 10 }), ...updates.contextStyle }
      : current.contextStyle,
    portraitEnabled:
      typeof updates.portraitEnabled === 'boolean'
        ? updates.portraitEnabled
        : current.portraitEnabled,
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

export interface BurnSubtitlesParams {
  videoId: string;
  start: number;
  end: number;
  inputVideoPath: string;
  outputVideoPath?: string;
  subtitleData: ClipSubtitleData;
  templateData?: ClipTemplateConfig;
  duration?: number;
}

export interface BurnSubtitlesResult {
  status: 'success' | 'error';
  outputPath: string;
}

/**
 * Mengekspor klip baru dengan subtitle dan template layout yang tertempel permanen (burn-in via FFmpeg).
 * Video klip asli yang sudah di-download tetap utuh di lokasinya.
 */
export async function burnClipSubtitles({
  videoId,
  start,
  end,
  inputVideoPath,
  outputVideoPath,
  subtitleData,
  templateData,
  duration,
}: BurnSubtitlesParams): Promise<BurnSubtitlesResult> {
  const finalOutputPath = outputVideoPath || getSubtitledClipOutputFilePath(videoId, start, end).nativePath;
  const clipDuration = duration ?? (end - start);

  const nativeInfo = getNativeRunnerInfo();
  const nativeFfmpeg = nativeInfo?.ffmpegExists ? nativeInfo.ffmpegPath : undefined;
  const isNative = Platform.OS === 'android' && isPythonInitialized();

  const progressPath = `${INTERNAL_CLIPPING_OUTPUT_DIR}/${videoId}/burn_progress.json`;

  let data: any = null;

  if (isNative) {
    data = await executePythonScript('utils.subtitle_burner', 'burn_subtitles_to_video', {
      input_video_path: inputVideoPath,
      output_video_path: finalOutputPath,
      subtitle_data: subtitleData,
      template_data: templateData,
      ffmpeg_bin: nativeFfmpeg,
      progress_path: progressPath,
      duration: clipDuration,
    });
  } else {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000);
    try {
      const response = await fetch(`${DEV_API_BASE_URL}/api/burn-subtitles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input_video_path: inputVideoPath,
          output_video_path: finalOutputPath,
          subtitle_data: subtitleData,
          template_data: templateData,
          ffmpeg_bin: nativeFfmpeg,
          progress_path: progressPath,
          duration: clipDuration,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      data = await response.json().catch(() => ({}));
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  const payload = (data?.data && typeof data.data === 'object') ? data.data : data;

  if (!payload || payload.status !== 'success') {
    const rawError = payload?.traceback || payload?.error || (payload ? JSON.stringify(payload, null, 2) : 'Gagal menempelkan subtitle');
    const code = payload?.code || 'FFMPEG_BURN_ERROR';
    throw new ApiError(code, rawError);
  }

  return {
    status: 'success',
    outputPath: payload.output_path || finalOutputPath,
  };
}




