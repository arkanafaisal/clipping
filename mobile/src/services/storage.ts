import * as FileSystem from 'expo-file-system/legacy';

// Shared target directory path yang dikelola Termux di Android:
export const SHARED_ROOT_PATH = '/storage/emulated/0/clipping';
export const SHARED_DATA_PATH = `${SHARED_ROOT_PATH}/data`;
export const SHARED_OUTPUT_PATH = `${SHARED_ROOT_PATH}/output`;

// Private sandbox directory untuk penyimpanan lokal cepat & offline di Expo
const STORAGE_DIR = `${FileSystem.documentDirectory || ''}clipping_data/`;

// In-memory cache for instant synchronous access and resilient fallback
const MEMORY_CACHE = new Map<string, string>();

let isMigrationDone = false;

// Ensure local private directory exists
async function ensureDir() {
  try {
    if (!FileSystem.documentDirectory) return;
    const info = await FileSystem.getInfoAsync(STORAGE_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(STORAGE_DIR, { intermediates: true });
    }
  } catch (e) {
    // Silent
  }
}

/**
 * Sinkronisasi asinkron ke shared folder (/storage/emulated/0/clipping/data/) via Termux API (port 3006).
 * Termux memiliki akses Linux langsung ke root shared storage Android, sehingga file JSON
 * dapat langsung muncul di File Manager HP tanpa terkendala batasan Scoped Storage Expo.
 */
async function syncToSharedStorage(filename: string, content: string): Promise<void> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    await fetch('http://127.0.0.1:3006/api/storage/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, content }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch {
    // Abaikan jika Termux sedang tidak aktif (data tetap 100% aman di private storage & cache)
  }
}

/**
 * Migrasi satu kali (One-Time Transfer) dari folder private ke shared folder via Termux.
 */
async function runOneTimeMigration(): Promise<void> {
  if (isMigrationDone || !FileSystem.documentDirectory) return;

  try {
    const flagFile = `${STORAGE_DIR}.migration_synced`;
    const flagInfo = await FileSystem.getInfoAsync(flagFile);
    if (flagInfo.exists) {
      isMigrationDone = true;
      return;
    }

    const files = await FileSystem.readDirectoryAsync(STORAGE_DIR);
    for (const file of files) {
      if (file.endsWith('.json') && !file.startsWith('.')) {
        const filePath = `${STORAGE_DIR}${file}`;
        const content = await FileSystem.readAsStringAsync(filePath);
        const cleanName = file.replace(/\.json$/, '');
        await syncToSharedStorage(cleanName, content);
      }
    }

    await FileSystem.writeAsStringAsync(flagFile, JSON.stringify({
      migratedAt: new Date().toISOString(),
    }));
    isMigrationDone = true;
  } catch {
    // Silent
  }
}

/**
 * LocalStorage emulator for mobile React Native (Expo)
 * Menyimpan data lokal secara instan dan otomatis menyinkronkan ke
 * folder publik shared (/storage/emulated/0/clipping/data/) saat Termux aktif.
 */
export const LocalStorage = {
  /**
   * Mengambil data berdasarkan key
   */
  async getItem(key: string): Promise<string | null> {
    try {
      if (MEMORY_CACHE.has(key)) {
        return MEMORY_CACHE.get(key) || null;
      }
      if (!FileSystem.documentDirectory) return null;
      await ensureDir();
      const filePath = `${STORAGE_DIR}${key}.json`;
      const info = await FileSystem.getInfoAsync(filePath);
      if (!info.exists) return null;
      const content = await FileSystem.readAsStringAsync(filePath);
      MEMORY_CACHE.set(key, content);
      return content;
    } catch (e) {
      return MEMORY_CACHE.get(key) || null;
    }
  },

  /**
   * Menyimpan data berdasarkan key ke private storage & sinkron ke shared storage
   */
  async setItem(key: string, value: string): Promise<void> {
    try {
      MEMORY_CACHE.set(key, value);
      if (!FileSystem.documentDirectory) return;
      await ensureDir();
      const filePath = `${STORAGE_DIR}${key}.json`;
      await FileSystem.writeAsStringAsync(filePath, value);

      // Sinkronkan ke shared storage via Termux di background
      syncToSharedStorage(key, value);

      // Pemicu migrasi satu kali jika ada file lama
      if (!isMigrationDone) {
        runOneTimeMigration();
      }
    } catch (e) {
      console.warn(`[Storage] setItem error for ${key}:`, e);
    }
  },

  /**
   * Menghapus data berdasarkan key
   */
  async removeItem(key: string): Promise<void> {
    try {
      MEMORY_CACHE.delete(key);
      if (!FileSystem.documentDirectory) return;
      const filePath = `${STORAGE_DIR}${key}.json`;
      const info = await FileSystem.getInfoAsync(filePath);
      if (info.exists) {
        await FileSystem.deleteAsync(filePath);
      }
    } catch (e) {
      console.warn(`[Storage] removeItem error for ${key}:`, e);
    }
  },

  get(key: string): Promise<string | null> {
    return this.getItem(key);
  },
  set(key: string, value: string): Promise<void> {
    return this.setItem(key, value);
  },
  delete(key: string): Promise<void> {
    return this.removeItem(key);
  },
  deleteItem(key: string): Promise<void> {
    return this.removeItem(key);
  },

  getItemSync(key: string): string | null {
    return MEMORY_CACHE.get(key) || null;
  },
};

export const localStorage = LocalStorage;
export default LocalStorage;
