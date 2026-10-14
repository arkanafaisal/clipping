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
}

// Embedded Chaquopy Python server running internally inside Android on port 8080
export const API_BASE_URL = 'http://127.0.0.1:8080';

/**
 * Ping internal Python server on 127.0.0.1:8080
 */
export async function pingServer(): Promise<{ status: string; uptime_seconds?: number }> {
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
    throw new Error('Server Python internal belum aktif pada 127.0.0.1:8080.');
  }
  throw new Error('Server Python tidak merespons di port 8080.');
}

/**
 * Fetches the direct stream URL for a given YouTube video ID.
 * 100% parity with frontend/src/services/api.js
 */
export async function fetchStreamUrl(videoId: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(`${API_BASE_URL}/api/stream/${videoId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Video tidak ditemukan atau dibatasi (Private/Age-restricted).');
      } else if (response.status === 429) {
        throw new Error('Terlalu banyak request ke YouTube (Rate Limit). Coba lagi nanti.');
      } else if (response.status >= 500) {
        throw new Error('Terjadi kesalahan pada server saat mengekstrak stream.');
      } else {
        throw new Error(`Error tidak dikenal (Status: ${response.status})`);
      }
    }

    const data: StreamResponse = await response.json();
    return data.stream_url;
  } catch (error: any) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Fetches the heatmap data for a given YouTube video ID.
 * 100% parity with frontend/src/services/api.js
 */
export async function fetchHeatmap(
  videoId: string,
  numClips: number = 100,
  offset: number = 0
): Promise<HeatmapResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/heatmap/${videoId}?num_clips=${numClips}&offset=${offset}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Video tidak memiliki data heatmap (Most Replayed).');
      } else {
        throw new Error(`Gagal mengambil heatmap (Status: ${response.status})`);
      }
    }

    const data: HeatmapResponse = await response.json();
    return data;
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
