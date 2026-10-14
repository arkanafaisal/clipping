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

// In-memory fallback cache
const MEMORY_CACHE = new Map<string, string>();

export const LocalStorage = {
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
};
