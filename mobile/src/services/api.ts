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
  from_cache?: boolean;
}

export interface StreamResponse {
  video_id: string;
  stream_url: string;
  from_cache?: boolean;
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
      const res = await fetch(`${baseUrl}/ping`, { signal: controller.signal });
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
 * Fetch YouTube Heatmap ("Most Replayed") from local Python engine
 * Will attempt activeBaseUrl first, then fallback to alternate candidate
 */
export async function fetchHeatmap(
  videoId: string,
  numClips: number = 50,
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
      const url = `${baseUrl}/api/heatmap/${videoId}?num_clips=${numClips}&offset=${offset}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data: HeatmapResponse = await res.json();
        activeBaseUrl = baseUrl;
        return data;
      }

      if (res.status === 404) {
        lastError = new Error(`Video tidak memiliki data heatmap atau rute belum aktif di ${baseUrl} (HTTP 404)`);
      } else if (res.status === 429) {
        lastError = new Error('Limit request YouTube tercapai. Tunggu beberapa menit.');
      } else {
        lastError = new Error(`Server error HTTP ${res.status}`);
      }
    } catch (e: any) {
      clearTimeout(timeoutId);
      lastError = new Error(`Koneksi ke ${baseUrl} gagal: ${e.message || 'Timeout'}`);
    }
  }

  throw lastError || new Error('Gagal mengekstrak Heatmap.');
}

/**
 * Fetch direct stream URL from local Python engine
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
      const url = `${baseUrl}/api/stream/${videoId}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data: StreamResponse = await res.json();
        activeBaseUrl = baseUrl;
        return data.stream_url;
      }

      if (res.status === 404) {
        lastError = new Error(`Endpoint stream belum ada di ${baseUrl} (HTTP 404)`);
      } else if (res.status === 429) {
        lastError = new Error('Rate limit YouTube tercapai.');
      } else {
        lastError = new Error(`Server stream error HTTP ${res.status}`);
      }
    } catch (e: any) {
      clearTimeout(timeoutId);
      lastError = new Error(`Koneksi stream ke ${baseUrl} gagal: ${e.message || 'Timeout'}`);
    }
  }

  throw lastError || new Error('Gagal mendapatkan stream URL.');
}
