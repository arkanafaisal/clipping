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

// Support both embedded Chaquopy Python (port 8080) and Termux / local server (port 3006)
const CANDIDATE_BASE_URLS = [
  'http://127.0.0.1:8080',
  'http://127.0.0.1:3006',
];

let activeBaseUrl = CANDIDATE_BASE_URLS[0];

/**
 * Ping internal Python server on 8080 or 3006
 */
export async function pingServer(): Promise<{ status: string; uptime_seconds?: number; port?: number }> {
  for (const baseUrl of CANDIDATE_BASE_URLS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`${baseUrl}/ping`, { 
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        activeBaseUrl = baseUrl;
        return { ...data, port: baseUrl.includes('8080') ? 8080 : 3006 };
      }
    } catch {
      // Try next candidate
    }
  }
  throw new Error('Server Python tidak merespons di port 8080 maupun 3006.');
}

/**
 * Fetches the direct stream URL for a given YouTube video ID.
 * 100% parity with frontend/src/services/api.js
 */
export async function fetchStreamUrl(videoId: string): Promise<string> {
  const urlsToTry = [
    activeBaseUrl,
    ...CANDIDATE_BASE_URLS.filter((u) => u !== activeBaseUrl),
  ];

  let lastError: Error | null = null;

  for (const baseUrl of urlsToTry) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(`${baseUrl}/api/stream/${videoId}`, {
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
      activeBaseUrl = baseUrl;
      return data.stream_url;
    } catch (e: any) {
      clearTimeout(timeoutId);
      lastError = e;
    }
  }

  throw lastError || new Error('Gagal mengekstrak direct stream URL.');
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
  const urlsToTry = [
    activeBaseUrl,
    ...CANDIDATE_BASE_URLS.filter((u) => u !== activeBaseUrl),
  ];

  let lastError: Error | null = null;

  for (const baseUrl of urlsToTry) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(
        `${baseUrl}/api/heatmap/${videoId}?num_clips=${numClips}&offset=${offset}`,
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
      activeBaseUrl = baseUrl;
      return data;
    } catch (e: any) {
      clearTimeout(timeoutId);
      lastError = e;
    }
  }

  throw lastError || new Error('Gagal mengambil heatmap.');
}

/**
 * Downloads a specific clip (preserved for parity with web api.js, not invoked automatically)
 */
export async function downloadClip(videoId: string, start: number, end: number): Promise<void> {
  const url = `${activeBaseUrl}/api/download_clip/${videoId}?start=${start}&end=${end}`;
  const response = await fetch(url, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`Gagal mendownload klip (Status: ${response.status})`);
  }
}
