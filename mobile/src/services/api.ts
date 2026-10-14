import { LocalStorage } from './storage';

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
  video_id: string;
  stream_url: string;
  error?: string;
}

// Termux / Mobile API running on port 3006
export const API_BASE_URL = 'http://127.0.0.1:3006';

/**
 * Ping Python server on 127.0.0.1:3006 (Termux / Mobile API)
 */
export async function pingServer(): Promise<{ status: string; message?: string; uptime_seconds?: number }> {
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

/**
 * Fetches the direct stream URL for a given YouTube video ID.
 * Caches stream URLs in frontend LocalStorage (2 hours expiration).
 * Sends dynamic options via request body to keep backend 100% pass-through.
 */
export async function fetchStreamUrl(videoId: string): Promise<string> {
  // 1. Cek cache frontend terlebih dahulu
  try {
    const cached = await LocalStorage.getItem(`stream_cache_${videoId}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.url && parsed.expiresAt && Date.now() < parsed.expiresAt) {
        console.log(`[Frontend Cache] Menggunakan stream URL tersimpan untuk ${videoId}`);
        return parsed.url;
      }
    }
  } catch (e) {
    // Abaikan cache read error
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    // Kirim opsi konfigurasi langsung dari Frontend (Dynamic Options)
    const response = await fetch(`${API_BASE_URL}/api/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        video_id: videoId,
        ydl_opts: {
          format: 'best[height<=480][ext=mp4]/best[ext=mp4]',
        }
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok || data.status === 'error' || !data.stream_url) {
      const errorMsg = data.error || (response.status === 404 
        ? 'Video tidak ditemukan atau dibatasi (Private/Age-restricted).'
        : `Gagal mengekstrak stream (Status: ${response.status})`);
      throw new Error(errorMsg);
    }
    
    // 2. Simpan ke cache frontend (valid 2 jam = 7200 detik)
    try {
      await LocalStorage.setItem(
        `stream_cache_${videoId}`,
        JSON.stringify({
          url: data.stream_url,
          expiresAt: Date.now() + 7200 * 1000,
        })
      );
    } catch (e) {
      // Abaikan cache write error
    }

    return data.stream_url;
  } catch (error: any) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Fetches the heatmap data for a given YouTube video ID.
 * Mengambil data mentah (raw pass-through) dari Python dan melakukan formatting,
 * kalkulasi offset, serta sorting klip 100% di Frontend.
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
        offset: offset,
        num_clips: numClips
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok || data.status === 'error') {
      const errorMsg = data.error || (response.status === 404 
        ? 'Video tidak memiliki data heatmap (Most Replayed).'
        : `Gagal mengambil heatmap (Status: ${response.status})`);
      throw new Error(errorMsg);
    }

    // Jika backend mengirim raw heatmap array, lakukan kalkulasi 100% di frontend
    if (Array.isArray(data.heatmap) && data.heatmap.length > 0) {
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
          status: 'none'
        };
      });

      return {
        title: data.title || '',
        clips: formattedClips
      };
    }

    // Fallback jika backend mengirim clips yang sudah diformat
    return {
      title: data.title || '',
      clips: data.clips || []
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
