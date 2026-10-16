import * as FileSystem from 'expo-file-system/legacy';

// Shared Parent Directory di root shared storage HP: /storage/emulated/0/clipping/
// Struktur kamar:
// - /storage/emulated/0/clipping/data/   -> untuk metadata workshop, draft klip & heatmap JSON
// - /storage/emulated/0/clipping/output/ -> untuk file video klip hasil download
export const SHARED_ROOT_DIR = 'file:///storage/emulated/0/clipping/';
export const SHARED_DATA_DIR = `${SHARED_ROOT_DIR}data/`;
export const SHARED_OUTPUT_DIR = `${SHARED_ROOT_DIR}output/`;

// Private sandbox directory lama (untuk migrasi satu kali)
const PRIVATE_DATA_DIR = `${FileSystem.documentDirectory || ''}clipping_data/`;
const PRIVATE_OUTPUT_DIR = `${FileSystem.documentDirectory || ''}output/`;

let isMigrationDone = false;

// In-memory cache for instant synchronous access and resilient fallback
const MEMORY_CACHE = new Map<string, string>();

/**
 * Memastikan direktori target ada.
 * Mengembalikan SHARED_DATA_DIR jika berhasil, atau fallback ke PRIVATE_DATA_DIR jika storage shared belum siap.
 */
async function getActiveDataDir(): Promise<string> {
  try {
    const info = await FileSystem.getInfoAsync(SHARED_DATA_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(SHARED_DATA_DIR, { intermediates: true });
    }
    return SHARED_DATA_DIR;
  } catch (e) {
    console.warn('[Storage] Shared directory create warning, fallback to private:', e);
    try {
      if (FileSystem.documentDirectory) {
        const privInfo = await FileSystem.getInfoAsync(PRIVATE_DATA_DIR);
        if (!privInfo.exists) {
          await FileSystem.makeDirectoryAsync(PRIVATE_DATA_DIR, { intermediates: true });
        }
      }
    } catch {}
    return PRIVATE_DATA_DIR;
  }
}

/**
 * Migrasi satu kali (One-Time Transfer) dari folder private sandbox ke shared folder /storage/emulated/0/clipping/
 * Berjalan sekali saja. Setelah selesai, seluruh pembacaan dan penulisan hanya ke shared folder.
 */
async function runOneTimeMigration(): Promise<void> {
  if (isMigrationDone) return;

  try {
    // 1. Cek apakah shared data directory bisa diakses
    const targetDir = await getActiveDataDir();
    if (targetDir !== SHARED_DATA_DIR) {
      return; // Belum bisa akses shared storage, tunda migrasi
    }

    // 2. Cek flag file penanda migrasi di shared storage
    const flagFile = `${SHARED_DATA_DIR}.migration_done`;
    const flagInfo = await FileSystem.getInfoAsync(flagFile);
    if (flagInfo.exists) {
      isMigrationDone = true;
      return;
    }

    // 3. Migrasi file JSON data (workshops_list, clips_draft, stream_url)
    if (FileSystem.documentDirectory) {
      const privDataInfo = await FileSystem.getInfoAsync(PRIVATE_DATA_DIR);
      if (privDataInfo.exists) {
        const files = await FileSystem.readDirectoryAsync(PRIVATE_DATA_DIR);
        console.log(`[Storage Migration] Memindahkan ${files.length} file data ke ${SHARED_DATA_DIR}...`);
        for (const file of files) {
          const src = `${PRIVATE_DATA_DIR}${file}`;
          const dest = `${SHARED_DATA_DIR}${file}`;
          try {
            const destInfo = await FileSystem.getInfoAsync(dest);
            if (!destInfo.exists) {
              await FileSystem.copyAsync({ from: src, to: dest });
              console.log(`[Storage Migration] Berhasil memindahkan data: ${file}`);
            }
          } catch (err) {
            console.warn(`[Storage Migration] Gagal menyalin file ${file}:`, err);
          }
        }
      }

      // 4. Migrasi video klip lama (jika ada di private output)
      const privOutInfo = await FileSystem.getInfoAsync(PRIVATE_OUTPUT_DIR);
      if (privOutInfo.exists) {
        try {
          const outSubdirs = await FileSystem.readDirectoryAsync(PRIVATE_OUTPUT_DIR);
          for (const sub of outSubdirs) {
            const srcSub = `${PRIVATE_OUTPUT_DIR}${sub}`;
            const destSub = `${SHARED_OUTPUT_DIR}${sub}`;
            const subInfo = await FileSystem.getInfoAsync(srcSub);
            if (subInfo.isDirectory) {
              const subDestInfo = await FileSystem.getInfoAsync(destSub);
              if (!subDestInfo.exists) {
                await FileSystem.makeDirectoryAsync(destSub, { intermediates: true });
              }
              const clipFiles = await FileSystem.readDirectoryAsync(srcSub);
              for (const cf of clipFiles) {
                const cSrc = `${srcSub}/${cf}`;
                const cDest = `${destSub}/${cf}`;
                const cDestInfo = await FileSystem.getInfoAsync(cDest);
                if (!cDestInfo.exists) {
                  await FileSystem.copyAsync({ from: cSrc, to: cDest });
                  console.log(`[Storage Migration] Berhasil memindahkan klip video: ${cf}`);
                }
              }
            }
          }
        } catch (err) {
          console.warn('[Storage Migration] Error migrating old video files:', err);
        }
      }
    }

    // 5. Tulis penanda migrasi permanen
    await FileSystem.writeAsStringAsync(flagFile, JSON.stringify({
      migratedAt: new Date().toISOString(),
      status: 'completed',
    }));
    isMigrationDone = true;
    console.log('[Storage Migration] Migrasi One-Time ke Shared Storage Selesai!');
  } catch (e) {
    console.warn('[Storage Migration] Error executing migration:', e);
  }
}

/**
 * LocalStorage emulator for mobile React Native (Expo)
 * Menyimpan data ke shared folder fisik (/storage/emulated/0/clipping/data/)
 * dengan in-memory cache untuk performa instan 0ms.
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
      await runOneTimeMigration();
      const baseDir = await getActiveDataDir();
      const filePath = `${baseDir}${key}.json`;
      const info = await FileSystem.getInfoAsync(filePath);
      if (!info.exists) {
        // Fallback cek private jika belum termigrasi
        const privPath = `${PRIVATE_DATA_DIR}${key}.json`;
        const privInfo = await FileSystem.getInfoAsync(privPath);
        if (privInfo.exists) {
          const content = await FileSystem.readAsStringAsync(privPath);
          MEMORY_CACHE.set(key, content);
          return content;
        }
        return null;
      }
      const content = await FileSystem.readAsStringAsync(filePath);
      MEMORY_CACHE.set(key, content);
      return content;
    } catch (e) {
      console.warn(`[Storage] getItem error for ${key}:`, e);
      return MEMORY_CACHE.get(key) || null;
    }
  },

  /**
   * Menyimpan data berdasarkan key ke shared storage
   */
  async setItem(key: string, value: string): Promise<void> {
    try {
      MEMORY_CACHE.set(key, value);
      await runOneTimeMigration();
      const baseDir = await getActiveDataDir();
      const filePath = `${baseDir}${key}.json`;
      await FileSystem.writeAsStringAsync(filePath, value);
    } catch (e) {
      console.warn(`[Storage] setItem error for ${key}:`, e);
    }
  },

  /**
   * Menghapus data berdasarkan key dari shared storage
   */
  async removeItem(key: string): Promise<void> {
    try {
      MEMORY_CACHE.delete(key);
      await runOneTimeMigration();
      const baseDir = await getActiveDataDir();
      const filePath = `${baseDir}${key}.json`;
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
