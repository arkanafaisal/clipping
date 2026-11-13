import { Platform } from 'react-native';
import { isPythonInitialized, setupPythonPaths, getNativeRunnerInfo } from '../../../modules/python-runner';
import { getCurrentStorageRoot } from '../storageConfig';
import { ApiError } from './errors';

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

export async function pingDirect(baseUrl: string): Promise<{ status: string; message?: string }> {
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
