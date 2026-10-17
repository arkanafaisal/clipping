import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { LocalStorage } from './storage';
import { setupPythonPaths, isPythonInitialized, executePythonScript } from '../../modules/python-runner';

export const STORAGE_ROOT_KEY = 'clipping_custom_root_path';
export const DEFAULT_SHARED_ROOT = '/storage/emulated/0/clipping';

let currentStorageRoot: string = DEFAULT_SHARED_ROOT;

export interface StorageVerificationResult {
  success: boolean;
  rootPath: string;
  canWrite: boolean;
  canRead: boolean;
  message: string;
  error?: string;
  traceback?: string;
  testFileUri?: string;
  contentRead?: string;
}

export function getCurrentStorageRoot(): string {
  return currentStorageRoot;
}

export async function getStorageRootPath(): Promise<string> {
  try {
    const saved = await LocalStorage.getItem(STORAGE_ROOT_KEY);
    if (saved && saved.trim().length > 0) {
      currentStorageRoot = saved.trim();
      return currentStorageRoot;
    }
  } catch {}
  currentStorageRoot = DEFAULT_SHARED_ROOT;
  return currentStorageRoot;
}

export async function setStorageRootPath(path: string): Promise<void> {
  const normalized = (path || '').trim() || DEFAULT_SHARED_ROOT;
  currentStorageRoot = normalized;
  await LocalStorage.setItem(STORAGE_ROOT_KEY, normalized);
  try {
    setupPythonPaths(normalized);
  } catch {}
}

export function getStorageStructure(rootPath: string = currentStorageRoot) {
  const cleanRoot = rootPath.replace(/\/+$/, '');
  return {
    root: cleanRoot,
    outputDir: `${cleanRoot}/output`,
    scriptsDir: `${cleanRoot}/scripts`,
    libsDir: `${cleanRoot}/libs`,
    cookiesPath: `${cleanRoot}/cookies.txt`,
  };
}

/**
 * Memverifikasi hak akses Read & Write fisik ke shared storage.
 * Menulis hello.txt secara nyata ke disk dan membaca kembali langsung dari filesystem.
 */
export async function verifyAndInitializeStorage(
  targetRoot?: string
): Promise<StorageVerificationResult> {
  const root = targetRoot || (await getStorageRootPath());
  const structure = getStorageStructure(root);

  // 1. Pada Android dengan engine Python aktif, gunakan Python untuk verifikasi fisik disk.
  // Ini 100% membypass pembatasan sandbox Expo FileSystem (java.io.IOException isn't writable)
  if (Platform.OS === 'android' && isPythonInitialized()) {
    try {
      const pyRes = await executePythonScript('utils.file_utils', 'verify_storage', {
        root_path: structure.root,
      });

      const payload = (pyRes?.data && typeof pyRes.data === 'object') ? pyRes.data : pyRes;

      if (payload?.success) {
        try {
          setupPythonPaths(structure.root);
        } catch {}

        return {
          success: true,
          rootPath: structure.root,
          canWrite: true,
          canRead: true,
          message: payload.message || 'Akses Read & Write fisik ke shared storage 100% Berhasil!',
          testFileUri: payload.testFileUri,
          contentRead: payload.contentRead,
        };
      } else if (payload?.status === 'error') {
        return {
          success: false,
          rootPath: structure.root,
          canWrite: false,
          canRead: false,
          message: payload.message || payload.error || 'Gagal verifikasi storage via Python engine.',
          error: payload.error || payload.message,
          traceback: payload.traceback,
        };
      }
    } catch (pyErr: any) {
      console.warn('[StorageConfig] Python verify_storage gagal, mencoba fallback:', pyErr);
    }
  }

  // 2. Fallback untuk non-Android / dev web:
  const testFileName = 'hello.txt';
  const testFileUri = `file://${structure.root}/${testFileName}`;
  const timestamp = new Date().toISOString();
  const testContent = `Hello from Clipping! Physical disk write verified at ${timestamp}`;

  try {
    for (const dir of [structure.root, structure.outputDir, structure.scriptsDir, structure.libsDir]) {
      const dirUri = `file://${dir}`;
      const dirInfo = await FileSystem.getInfoAsync(dirUri);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true });
      }
    }

    await FileSystem.writeAsStringAsync(testFileUri, testContent);
    const readBack = await FileSystem.readAsStringAsync(testFileUri);

    if (readBack.trim() === testContent.trim()) {
      try {
        setupPythonPaths(structure.root);
      } catch {}

      return {
        success: true,
        rootPath: structure.root,
        canWrite: true,
        canRead: true,
        message: 'Akses Read & Write fisik ke shared storage 100% Berhasil!',
        testFileUri,
        contentRead: readBack,
      };
    } else {
      return {
        success: false,
        rootPath: structure.root,
        canWrite: true,
        canRead: false,
        message: 'Konten file yang dibaca tidak cocok dengan yang ditulis fisik ke disk.',
      };
    }
  } catch (error: any) {
    const rawError = error?.stack || error?.message || String(error);
    return {
      success: false,
      rootPath: structure.root,
      canWrite: false,
      canRead: false,
      message: `Gagal verifikasi storage: ${error?.message || String(error)}`,
      error: error?.message || String(error),
      traceback: rawError,
    };
  }
}
