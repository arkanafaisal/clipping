import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { LocalStorage } from '../storage';
import { DEFAULT_GDRIVE_DOWNLOAD_CONFIG } from '../../constants/gdrive';
import { isPythonInitialized, executePythonScript } from '../../../modules/python-runner';
import { ApiError } from './errors';
import { DEV_API_BASE_URL } from './client';
import {
  COOKIES_STORAGE_KEY,
  INTERNAL_COOKIES_FILE_PATH,
  COOKIES_FILE_PATH,
  INTERNAL_CLIPPING_ROOT,
} from './paths';

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
