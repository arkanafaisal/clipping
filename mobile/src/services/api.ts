import { LocalStorage } from './storage';
import { STREAM_YTDL_OPTS, HEATMAP_YTDL_OPTS } from '../constants/ytdlp';

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

// Termux / Mobile API running on port 3006
export const API_BASE_URL = 'http://127.0.0.1:3006';

/**
 * Ping Python server on 127.0.0.1:3006 (Termux / Mobile API)
 */
export async function pingServer(): Promise<{ status: string; message?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${API_BASE_URL}/ping`, { 
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal 
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      return await res.json();
    }
  } catch (e: any) {
    throw new Error('Server Python belum aktif pada 127.0.0.1:3006.');
  }
  throw new Error('Server Python tidak merespons di port 3006.');
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
    const response = await fetch(`${API_BASE_URL}/api/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        video_id: videoId,
        ydl_opts: STREAM_YTDL_OPTS,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok || !data.stream_url) {
      const errorMsg = data.error || (response.status === 404 
        ? 'Video tidak ditemukan atau dibatasi (Private/Age-restricted).'
        : `Gagal mengekstrak stream (Status: ${response.status})`);
      throw new Error(errorMsg);
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
    throw error;
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
    const response = await fetch(`${API_BASE_URL}/api/heatmap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        video_id: videoId,
        ydl_opts: HEATMAP_YTDL_OPTS,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok || !Array.isArray(data.heatmap)) {
      const errorMsg = data.error || (response.status === 404 
        ? 'Video tidak memiliki data heatmap (Most Replayed).'
        : `Gagal mengambil heatmap (Status: ${response.status})`);
      throw new Error(errorMsg);
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
    throw error;
  }
}

/**
 * Downloads a specific clip (preserved for parity with web api.js, not invoked automatically)
 */
export async function downloadClip(videoId: string, start: number, end: number): Promise<void> {
  const url = `${API_BASE_URL}/api/download_clip/${videoId}?start=${start}&end=${end}`;
  const response = await fetch(url, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`Gagal mendownload klip (Status: ${response.status})`);
  }
}
