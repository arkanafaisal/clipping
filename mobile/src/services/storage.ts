import * as FileSystem from 'expo-file-system/legacy';

const STORAGE_DIR = `${FileSystem.documentDirectory || ''}clipping_data/`;

// Ensure directory exists
async function ensureDir() {
  try {
    if (!FileSystem.documentDirectory) return;
    const info = await FileSystem.getInfoAsync(STORAGE_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(STORAGE_DIR, { intermediates: true });
    }
  } catch (e) {
    console.warn('[Storage] ensureDir error:', e);
  }
}

// In-memory cache for instant synchronous access and resilient fallback
const MEMORY_CACHE = new Map<string, string>();

/**
 * LocalStorage emulator for mobile React Native (Expo)
 * Provides 100% parity with web localStorage (getItem, setItem, removeItem)
 * backed by both in-memory cache and persistent JSON storage.
 */
export const LocalStorage = {
  /**
   * Mengambil data berdasarkan key (sama seperti web localStorage.getItem)
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
      console.warn(`[Storage] getItem error for ${key}:`, e);
      return MEMORY_CACHE.get(key) || null;
    }
  },

  /**
   * Menyimpan data berdasarkan key (sama seperti web localStorage.setItem)
   */
  async setItem(key: string, value: string): Promise<void> {
    try {
      MEMORY_CACHE.set(key, value);
      if (!FileSystem.documentDirectory) return;
      await ensureDir();
      const filePath = `${STORAGE_DIR}${key}.json`;
      await FileSystem.writeAsStringAsync(filePath, value);
    } catch (e) {
      console.warn(`[Storage] setItem error for ${key}:`, e);
    }
  },

  /**
   * Menghapus data berdasarkan key (sama seperti web localStorage.removeItem)
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

  // Aliases for convenience matching user request (get, set, delete)
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

  // Synchronous in-memory lookup if needed
  getItemSync(key: string): string | null {
    return MEMORY_CACHE.get(key) || null;
  },
};

export const localStorage = LocalStorage;
export default LocalStorage;
