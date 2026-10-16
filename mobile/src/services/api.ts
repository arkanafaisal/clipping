import * as FileSystem from 'expo-file-system/legacy';
import { LocalStorage } from './storage';
import { STREAM_YTDL_OPTS, HEATMAP_YTDL_OPTS, PRIME_CLIP_DOWNLOAD_OPTS } from '../constants/ytdlp';

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

import { startPythonServer } from '../../modules/python-runner';

// 1. EMBEDDED INTERNAL SERVER (Port 8080):
// Khusus endpoint stabil V1 yang sudah tertanam dan teruji di dalam APK build:
// - GET /ping (koneksi internal Chaquopy)
// - POST /api/stream (direct stream URL extraction)
// - POST /api/heatmap (metadata & most replayed raw extraction)
export let EMBEDDED_API_BASE_URL = 'http://127.0.0.1:8080';

export function setEmbeddedApiBaseUrl(url: string) {
  EMBEDDED_API_BASE_URL = url;
}

// 2. MOBILE DEV / MOCK SERVER (Port 3006):
// Khusus endpoint update baru & eksperimental yang dikembangkan terpisah di mobile_api (port 3006):
// - POST /api/download-clip (pengunduhan klip dinamis yt-dlp)
// - Fitur lanjutan berikutnya (subtitles, full download, mock)
export let DEV_API_BASE_URL = 'http://127.0.0.1:3006';

export function setDevApiBaseUrl(url: string) {
  DEV_API_BASE_URL = url;
}

// Backward compatibility alias jika ada komponen yang memanggil API_BASE_URL
export let API_BASE_URL = EMBEDDED_API_BASE_URL;
export function setApiBaseUrl(url: string) {
  EMBEDDED_API_BASE_URL = url;
  API_BASE_URL = url;
}

/**
 * Kamus pemetaan kode error API dari backend ke pesan ramah pengguna (Bahasa Indonesia).
 * Backend hanya mengembalikan KODE (misal: "STREAM_NOT_FOUND"), frontend memegang 100% kamus teks.
 */
export const API_ERROR_MAP: Record<string, string> = {
  VIDEO_ID_REQUIRED: 'ID video YouTube tidak boleh kosong.',
  YDL_OPTS_REQUIRED: 'Konfigurasi ekstraksi (ydl_opts) tidak valid.',
  STREAM_NOT_FOUND: 'Direct stream video tidak ditemukan atau video dibatasi (Private/Age-restricted).',
  HEATMAP_NOT_FOUND: 'Video ini belum memiliki data Most Replayed (Heatmap) dari YouTube.',
  RATE_LIMIT_EXCEEDED: 'Batas permintaan YouTube terlampaui (Error 429). Silakan tunggu beberapa menit.',
  EXTRACTOR_ERROR: 'Ekstraktor video mengalami kendala saat membaca metadata YouTube.',
  INVALID_PARAMS: 'Parameter pengunduhan klip tidak lengkap.',
  INVALID_RANGE: 'Rentang waktu klip tidak valid.',
  DOWNLOAD_FAILED: 'Gagal mengunduh klip video dari YouTube.',
  SERVER_OFFLINE: 'Server internal Python belum aktif pada port 8080.',
  DEV_SERVER_OFFLINE: 'Server Mobile Dev/Mock API belum aktif pada port 3006.',
  INTERNAL_ERROR: 'Terjadi kesalahan internal pada server Python.',
  NETWORK_ERROR: 'Gagal terhubung ke jaringan internal server.',
};

/**
 * Mengubah kode error API menjadi pesan Bahasa Indonesia yang ramah pengguna.
 */
export function resolveErrorMessage(codeOrMessage?: string): string {
  if (!codeOrMessage) return 'Terjadi kesalahan sistem.';
  return API_ERROR_MAP[codeOrMessage] || codeOrMessage;
}

/**
 * Custom Error Class untuk membungkus kode error, pesan pengguna terjemahan,
 * serta log raw error asli dari backend untuk kebutuhan debugging.
 */
export class ApiError extends Error {
  code: string;
  rawError?: string;

  constructor(code: string, rawError?: string) {
    super(resolveErrorMessage(code));
    this.name = 'ApiError';
    this.code = code;
    this.rawError = rawError;
  }
}

async function pingDirect(baseUrl: string): Promise<{ status: string; message?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1200);
  try {
    const res = await fetch(`${baseUrl}/ping`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      return await res.json();
    }
    throw new Error(`HTTP ${res.status}`);
  } catch (e: any) {
    clearTimeout(timeoutId);
    throw e;
  }
}

/**
 * Ping Python server internal Chaquopy (port 8080).
 * Jika belum aktif pada Android, otomatis memicu "percikan" startPythonServer().
 */
export async function pingServer(): Promise<{ status: string; port: number; message?: string }> {
  // 1. Coba port 8080 dulu (Embedded APK Chaquopy)
  try {
    const res8080 = await pingDirect(EMBEDDED_API_BASE_URL);
    return { status: 'ok', port: 8080, message: res8080.message || 'Server internal Chaquopy aktif (port 8080)' };
  } catch {}

  // 2. Beri "percikan" startPythonServer() jika di Android native
  try {
    startPythonServer();
  } catch (err) {
    console.log('[Api] Gagal memicu startPythonServer:', err);
  }

  // Tunggu sejenak agar thread Python siap mendengarkan port
  await new Promise((r) => setTimeout(r, 1200));

  try {
    const resRetry8080 = await pingDirect(EMBEDDED_API_BASE_URL);
    return { status: 'ok', port: 8080, message: resRetry8080.message || 'Server internal Chaquopy berhasil dinyalakan (port 8080)' };
  } catch {}

  throw new ApiError('SERVER_OFFLINE', 'Server Python internal (port 8080) belum aktif.');
}

/**
 * Ping server pengembangan / mock eksternal (port 3006).
 */
export async function pingDevServer(): Promise<{ status: string; port: number; message?: string }> {
  try {
    const res3006 = await pingDirect(DEV_API_BASE_URL);
    return { status: 'ok', port: 3006, message: res3006.message || 'Server Mobile API (port 3006) aktif' };
  } catch {}

  throw new ApiError('DEV_SERVER_OFFLINE', `Server Mobile API belum aktif pada port 3006 (${DEV_API_BASE_URL}).`);
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
    const response = await fetch(`${EMBEDDED_API_BASE_URL}/api/stream`, {
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

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.stream_url) {
      const code = data.message || (response.status === 404 ? 'STREAM_NOT_FOUND' : 'EXTRACTOR_ERROR');
      const rawError = data.error || `HTTP ${response.status}: ${response.statusText || 'Gagal mengekstrak stream'}`;
      throw new ApiError(code, rawError);
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
    if (error instanceof ApiError) throw error;
    throw new ApiError(error.name === 'AbortError' ? 'NETWORK_ERROR' : 'EXTRACTOR_ERROR', error.message);
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
    const response = await fetch(`${EMBEDDED_API_BASE_URL}/api/heatmap`, {
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

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !Array.isArray(data.heatmap)) {
      const code = data.message || (response.status === 404 ? 'HEATMAP_NOT_FOUND' : 'EXTRACTOR_ERROR');
      const rawError = data.error || `HTTP ${response.status}: ${response.statusText || 'Gagal mengambil heatmap'}`;
      throw new ApiError(code, rawError);
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
    if (error instanceof ApiError) throw error;
    throw new ApiError(error.name === 'AbortError' ? 'NETWORK_ERROR' : 'EXTRACTOR_ERROR', error.message);
  }
}

// In-Memory cache deteksi file download klip: key = fileUri, value = exists boolean
export const DOWNLOADED_CLIPS_CACHE = new Map<string, boolean>();

// Shared clipping output directory:
// fileUri: file:///storage/emulated/0/clipping/output/<videoId>/clip_<rank>_<start>_<end>.mp4
// nativePath: /storage/emulated/0/clipping/output/<videoId>/clip_<rank>_<start>_<end>.mp4
export const SHARED_CLIPPING_ROOT = '/storage/emulated/0/clipping';
export const SHARED_CLIPPING_OUTPUT_DIR = `${SHARED_CLIPPING_ROOT}/output`;

/**
 * Menghasilkan alokasi lokasi file tujuan download klip pada shared storage (/storage/emulated/0/clipping/output/).
 * Frontend memegang kendali 100% path & nama folder, backend Termux hanya menerima path final.
 */
export function getClipOutputFilePath(
  videoId: string,
  start: number,
  end: number,
  rank?: number
): { fileUri: string; nativePath: string } {
  const startStr = Math.round(start);
  const endStr = Math.round(end);
  const filename = rank
    ? `clip_${rank}_${startStr}_${endStr}.mp4`
    : `clip_${videoId}_${startStr}_${endStr}.mp4`;
  const nativePath = `${SHARED_CLIPPING_OUTPUT_DIR}/${videoId}/${filename}`;
  const fileUri = `file://${nativePath}`;
  return { fileUri, nativePath };
}

/**
 * Memeriksa keberadaan file klip video di local file system dengan in-memory caching.
 * Menggunakan deteksi lokal FileSystem Expo dan fallback ke Termux native check jika di luar sandbox.
 */
export async function checkClipFileExists(fileUri: string, forceCheckDisk: boolean = false): Promise<boolean> {
  if (!forceCheckDisk && DOWNLOADED_CLIPS_CACHE.has(fileUri)) {
    return DOWNLOADED_CLIPS_CACHE.get(fileUri) || false;
  }
  // 1. Cek langsung via FileSystem Expo
  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    if (info.exists) {
      DOWNLOADED_CLIPS_CACHE.set(fileUri, true);
      return true;
    }
  } catch {}

  // 2. Fallback cek native via Termux Linux (jika di luar sandbox Android)
  try {
    const nativePath = fileUri.replace(/^file:\/\//, '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`${DEV_API_BASE_URL}/api/check-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: nativePath }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      const exists = Boolean(data.exists);
      DOWNLOADED_CLIPS_CACHE.set(fileUri, exists);
      return exists;
    }
  } catch {}

  return false;
}

/**
 * Mendownload rentang klip tertentu secara dinamis dengan kualitas prime dan stream reconnect.
 * Non-blocking: berjalan di background tanpa menghambat thread interaksi UI.
 */
export async function downloadClip(
  videoId: string,
  start: number,
  end: number,
  rank?: number
): Promise<{ status: string; output_path: string; fileUri: string }> {
  const { fileUri, nativePath } = getClipOutputFilePath(videoId, start, end, rank);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 menit timeout download klip

  try {
    const response = await fetch(`${DEV_API_BASE_URL}/api/download-clip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        video_id: videoId,
        start,
        end,
        output_path: nativePath,
        ydl_opts: PRIME_CLIP_DOWNLOAD_OPTS,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.status !== 'success') {
      const code = data.message || (response.status === 400 ? 'INVALID_PARAMS' : 'DOWNLOAD_FAILED');
      const rawError = data.error || `HTTP ${response.status}: Gagal mengunduh klip`;
      throw new ApiError(code, rawError);
    }

    // Tandai pada in-memory cache
    DOWNLOADED_CLIPS_CACHE.set(fileUri, true);

    return {
      status: 'success',
      output_path: nativePath,
      fileUri,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      error.name === 'AbortError' ? 'NETWORK_ERROR' : 'DOWNLOAD_FAILED',
      error.message
    );
  }
}

// ==============================================================================
// [WORK IN PROGRESS - COMMENTED OUT] LOGIKA EKSTRAKSI & SLICING SUBTITLE
// 1. SubtitleCue interface (format cue dengan start & end ternormalisasi per klip)
// 2. parseTimestampToSeconds (parser string timestamp VTT/SRT ke float detik)
// 3. parseVttToCues (parser raw file WebVTT teks menjadi cue terstruktur)
// 4. sliceCuesForClip (filter & normalisasi cue relatif 0.000s sesuai start klip)
// 5. fetchSubtitles (pass-through request ke server internal Python)
// ==============================================================================
/*
export interface SubtitleCue {
  id: string;
  start: number;    // Detik relatif terhadap awal klip (0.000s)
  end: number;      // Detik relatif terhadap awal klip
  rawStart: number; // Detik absolut pada video penuh YouTube
  rawEnd: number;   // Detik absolut pada video penuh YouTube
  text: string;     // Teks caption yang sudah dibersihkan dari tag VTT
}

// In-Memory cache subtitle per klip: key = clipId, value = SubtitleCue[]
export const SUBTITLE_CUES_CACHE = new Map<string, SubtitleCue[]>();

export function parseTimestampToSeconds(timestamp: string): number {
  const clean = timestamp.trim().replace(',', '.');
  const parts = clean.split(':');
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]) || 0;
    const minutes = parseFloat(parts[1]) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    const minutes = parseFloat(parts[0]) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    return minutes * 60 + seconds;
  }
  return parseFloat(clean) || 0;
}

export function parseVttToCues(vttContent: string): SubtitleCue[] {
  const lines = vttContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const cues: SubtitleCue[] = [];
  let index = 0;
  let currentStart = 0;
  let currentEnd = 0;
  let currentTextLines: string[] = [];
  let isParsingCue = false;

  const timeRegex = /((?:\d{2}:)?\d{2}:\d{2}[\.,]\d{3})\s*-->\s*((?:\d{2}:)?\d{2}:\d{2}[\.,]\d{3})/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === 'WEBVTT' || trimmed.startsWith('NOTE') || trimmed.startsWith('STYLE')) {
      if (isParsingCue && currentTextLines.length > 0) {
        cues.push({
          id: `cue_${index++}`,
          start: currentStart,
          end: currentEnd,
          rawStart: currentStart,
          rawEnd: currentEnd,
          text: currentTextLines.join(' ').replace(/<[^>]+>/g, '').trim(),
        });
        currentTextLines = [];
        isParsingCue = false;
      }
      continue;
    }

    const match = trimmed.match(timeRegex);
    if (match) {
      if (isParsingCue && currentTextLines.length > 0) {
        cues.push({
          id: `cue_${index++}`,
          start: currentStart,
          end: currentEnd,
          rawStart: currentStart,
          rawEnd: currentEnd,
          text: currentTextLines.join(' ').replace(/<[^>]+>/g, '').trim(),
        });
        currentTextLines = [];
      }
      currentStart = parseTimestampToSeconds(match[1]);
      currentEnd = parseTimestampToSeconds(match[2]);
      isParsingCue = true;
      continue;
    }

    if (isParsingCue) {
      currentTextLines.push(trimmed);
    }
  }

  if (isParsingCue && currentTextLines.length > 0) {
    cues.push({
      id: `cue_${index++}`,
      start: currentStart,
      end: currentEnd,
      rawStart: currentStart,
      rawEnd: currentEnd,
      text: currentTextLines.join(' ').replace(/<[^>]+>/g, '').trim(),
    });
  }

  return cues;
}

export function sliceCuesForClip(
  allCues: SubtitleCue[],
  clipStart: number,
  clipEnd: number
): SubtitleCue[] {
  const clipDuration = clipEnd - clipStart;
  const filtered: SubtitleCue[] = [];

  for (const cue of allCues) {
    if (cue.rawEnd > clipStart && cue.rawStart < clipEnd) {
      const relStart = Math.max(0, cue.rawStart - clipStart);
      const relEnd = Math.min(clipDuration, cue.rawEnd - clipStart);
      filtered.push({
        ...cue,
        start: relStart,
        end: relEnd,
      });
    }
  }

  return filtered;
}

export async function fetchSubtitles(
  videoId: string,
  lang: string = 'id'
): Promise<SubtitleCue[]> {
  const subDir = new File(Paths.document, 'output', videoId, 'subtitles');
  const nativeSubDir = subDir.uri.replace(/^file:\/\//, '');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${DEV_API_BASE_URL}/api/subtitles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_id: videoId,
        output_dir: nativeSubDir,
        lang,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.content) {
      const code = data.message || 'SUBTITLE_NOT_FOUND';
      const rawError = data.error || 'Gagal mengekstrak subtitle';
      throw new ApiError(code, rawError);
    }

    return parseVttToCues(data.content);
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      error.name === 'AbortError' ? 'NETWORK_ERROR' : 'SUBTITLE_ERROR',
      error.message
    );
  }
}
*/


