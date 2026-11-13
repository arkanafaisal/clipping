import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { SUBTITLE_YTDL_OPTS } from '../../constants/ytdlp';
import { isPythonInitialized, executePythonScript } from '../../../modules/python-runner';
import { ApiError } from './errors';
import { DEV_API_BASE_URL } from './client';
import { getValidCookiesPath } from './cookies';
import {
  SHARED_CLIPPING_OUTPUT_DIR,
  getClipSubtitleFilename,
  getClipSubtitleFilePath,
  getRawSubtitlesCacheFilePath,
} from './paths';
import { SubtitleCue, ClipSubtitleData, DEFAULT_SUBTITLE_STYLE } from './types';

export { DEFAULT_SUBTITLE_STYLE };

const RAW_SUBTITLES_MEMORY_MAP = new Map<string, { cues: SubtitleCue[]; lang: string; isAuto: boolean }>();

/**
 * Parse data YouTube json3 menjadi daftar SubtitleCue terstruktur.
 */
export function parseJson3ToCues(json3Data: any): SubtitleCue[] {
  if (!json3Data || !Array.isArray(json3Data.events)) return [];
  const cues: SubtitleCue[] = [];
  let index = 0;

  for (const ev of json3Data.events) {
    if (!ev || typeof ev.tStartMs !== 'number') continue;
    const startSec = ev.tStartMs / 1000;
    const durSec = (typeof ev.dDurationMs === 'number' && ev.dDurationMs > 0) ? ev.dDurationMs / 1000 : 2.0;
    const endSec = startSec + durSec;

    let text = '';
    if (Array.isArray(ev.segs)) {
      text = ev.segs.map((s: any) => s?.utf8 || '').join('');
    }
    const cleanText = text.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleanText) continue;

    cues.push({
      id: `cue_${index++}`,
      start: startSec,
      end: endSec,
      rawStart: startSec,
      rawEnd: endSec,
      text: cleanText,
    });
  }
  return cues;
}

/**
 * Parse string WebVTT teks menjadi daftar SubtitleCue terstruktur.
 */
export function parseVttToCues(vttContent: string): SubtitleCue[] {
  const lines = vttContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const cues: SubtitleCue[] = [];
  let index = 0;
  let currentStart = 0;
  let currentEnd = 0;
  let currentTextLines: string[] = [];
  let isParsingCue = false;

  const timeRegex = /((?:\d{2}:)?\d{2}:\d{2}[\.,]\d{3})\s*-->\s*((?:\d{2}:)?\d{2}:\d{2}[\.,]\d{3})/;

  const parseTime = (timestamp: string): number => {
    const clean = timestamp.trim().replace(',', '.');
    const parts = clean.split(':');
    if (parts.length === 3) {
      return (parseFloat(parts[0]) || 0) * 3600 + (parseFloat(parts[1]) || 0) * 60 + (parseFloat(parts[2]) || 0);
    } else if (parts.length === 2) {
      return (parseFloat(parts[0]) || 0) * 60 + (parseFloat(parts[1]) || 0);
    }
    return parseFloat(clean) || 0;
  };

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
      currentStart = parseTime(match[1]);
      currentEnd = parseTime(match[2]);
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

/**
 * Menormalisasi daftar SubtitleCue agar strictly single-line & non-overlapping:
 * 1. Diurutkan berdasarkan start time lalu end time.
 * 2. Teks dibersihkan menjadi 1 baris (single line, no newlines).
 * 3. Jika ada tumpang tindih waktu (current.start < prev.end):
 *    - TIDAK menggabungkan teks (no auto-merge) agar setiap kalimat tetap independen.
 *    - Memprioritaskan detik awal cue kedua (current.start): waktu akhir cue sebelumnya (prev.end) dipotong tepat di current.start.
 *    - Jika current.start <= prev.start, cue yang lebih lama digantikan oleh cue yang lebih baru.
 * 4. Memastikan end > start untuk setiap cue.
 */
export function normalizeSingleTrackCues(cues: SubtitleCue[], maxDuration?: number): SubtitleCue[] {
  if (!Array.isArray(cues) || cues.length === 0) return [];

  const sorted = [...cues]
    .map((c, idx) => {
      const cue: SubtitleCue = {
        ...c,
        id: c.id || `cue_${idx}`,
        start: Math.max(0, Math.round(c.start * 100) / 100),
        end: Math.max(0, Math.round(c.end * 100) / 100),
        rawStart: typeof c.rawStart === 'number' ? c.rawStart : c.start,
        rawEnd: typeof c.rawEnd === 'number' ? c.rawEnd : c.end,
        text: (c.text || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim(),
      };
      if (typeof c.fontSize === 'number' && c.fontSize !== 14) {
        cue.fontSize = c.fontSize;
      } else {
        delete cue.fontSize;
      }
      return cue;
    })
    .filter((c) => c.text.length > 0)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const normalized: SubtitleCue[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const current = { ...sorted[i] };
    if (normalized.length === 0) {
      if (current.end <= current.start) {
        current.end = Math.round((current.start + 1.5) * 100) / 100;
      }
      if (maxDuration && current.end > maxDuration) {
        current.end = maxDuration;
      }
      normalized.push(current);
      continue;
    }

    const prev = normalized[normalized.length - 1];

    // Jika terjadi tumpang tindih waktu (current.start < prev.end):
    if (current.start < prev.end) {
      if (current.start <= prev.start) {
        // Jika detik awal sama persis atau lebih kecil, prioritaskan cue yang lebih baru/kedua
        normalized.pop();
      } else {
        // Potong (trim) waktu akhir cue sebelumnya agar tepat berakhir saat cue kedua dimulai
        prev.end = current.start;
      }
    }

    if (current.end <= current.start) {
      current.end = Math.round((current.start + 1.5) * 100) / 100;
    }
    if (maxDuration && current.end > maxDuration) {
      current.end = maxDuration;
    }

    normalized.push(current);
  }

  return normalized;
}

/**
 * Filter dan normalisasi cue subtitle agar pas dengan rentang waktu klip (relatif 0.00s)
 * dan strictly single-line non-overlapping.
 */
export function sliceCuesForClip(
  allCues: SubtitleCue[],
  clipStart: number,
  clipEnd: number
): SubtitleCue[] {
  const clipDuration = clipEnd - clipStart;
  const filtered: SubtitleCue[] = [];
  let index = 0;

  for (const cue of allCues) {
    if (cue.rawEnd > clipStart && cue.rawStart < clipEnd) {
      const relStart = Math.max(0, cue.rawStart - clipStart);
      const relEnd = Math.min(clipDuration, cue.rawEnd - clipStart);
      if (relEnd > relStart) {
        const cueObj: SubtitleCue = {
          id: `clip_cue_${index++}`,
          start: Math.round(relStart * 100) / 100,
          end: Math.round(relEnd * 100) / 100,
          rawStart: cue.rawStart,
          rawEnd: cue.rawEnd,
          text: cue.text.replace(/\r?\n+/g, ' ').trim(),
        };
        if (typeof cue.fontSize === 'number' && cue.fontSize !== 14) {
          cueObj.fontSize = cue.fontSize;
        }
        filtered.push(cueObj);
      }
    }
  }

  return normalizeSingleTrackCues(filtered, clipDuration);
}

/**
 * Mengambil track subtitle video utuh dari YouTube dengan arsitektur 2-Tier Caching di Frontend:
 * 1. Tier 1: In-Memory Map (0ms latency)
 * 2. Tier 2: File raw_subtitles.json di Shared Storage (/storage/emulated/0/clipping/output/<videoId>/)
 * 3. Eksekusi Python jika belum ada cache.
 */
export async function fetchSubtitlesForVideo(
  videoId: string,
  preferredLang?: string
): Promise<{ cues: SubtitleCue[]; lang: string; isAuto: boolean }> {
  // 1. Cek Tier 1 In-Memory
  if (RAW_SUBTITLES_MEMORY_MAP.has(videoId)) {
    const cached = RAW_SUBTITLES_MEMORY_MAP.get(videoId);
    if (cached) return cached;
  }

  // 2. Cek Tier 2 File Fisik di Shared Storage
  const cachePath = getRawSubtitlesCacheFilePath(videoId);
  try {
    const info = await FileSystem.getInfoAsync(cachePath.fileUri);
    if (info.exists && !info.isDirectory) {
      const rawJson = await FileSystem.readAsStringAsync(cachePath.fileUri);
      const parsed = JSON.parse(rawJson);
      if (parsed && Array.isArray(parsed.cues)) {
        const result = {
          cues: parsed.cues as SubtitleCue[],
          lang: parsed.lang || 'id',
          isAuto: Boolean(parsed.isAuto),
        };
        RAW_SUBTITLES_MEMORY_MAP.set(videoId, result);
        return result;
      }
    }
  } catch {}

  // 3. Eksekusi Skrip Python Native Chaquopy
  const cookiePath = await getValidCookiesPath();
  let data: any = null;
  const isNative = Platform.OS === 'android' && isPythonInitialized();

  if (isNative) {
    data = await executePythonScript('utils.subtitle_fetcher', 'extract_subtitles_data', {
      video_id: videoId,
      ydl_opts: SUBTITLE_YTDL_OPTS,
      cookie_path: cookiePath,
      preferred_lang: preferredLang,
    });
  } else {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(`${DEV_API_BASE_URL}/api/subtitles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_id: videoId,
          ydl_opts: SUBTITLE_YTDL_OPTS,
          cookie_path: cookiePath,
          preferred_lang: preferredLang,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      data = await response.json().catch(() => ({}));
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      throw fetchErr;
    }
  }

  const payload = (data?.data && typeof data.data === 'object' && !Array.isArray(data.data)) ? data.data : data;

  if (!payload) {
    throw new ApiError('EMPTY_RESPONSE', 'Python engine tidak mengembalikan data subtitle.');
  }

  if (payload.status === 'error') {
    const rawError = payload.traceback || payload.error || JSON.stringify(payload, null, 2);
    let code = payload.code || 'SUBTITLE_ERROR';
    const lower = rawError.toLowerCase();
    const isBotOrSign = lower.includes('bot') || lower.includes('sign in') || lower.includes('captcha') || lower.includes('confirm you');
    if (isBotOrSign) {
      code = cookiePath ? 'COOKIES_INVALID_OR_EXPIRED' : 'RATE_LIMIT_EXCEEDED';
    }
    throw new ApiError(code, rawError);
  }

  let cues: SubtitleCue[] = [];
  if (payload.format === 'json3' && typeof payload.raw_data === 'object') {
    cues = parseJson3ToCues(payload.raw_data);
  } else if (typeof payload.raw_data === 'string') {
    if (payload.raw_data.trim().startsWith('{')) {
      try {
        const parsedJson = JSON.parse(payload.raw_data);
        cues = parseJson3ToCues(parsedJson);
      } catch {
        cues = parseVttToCues(payload.raw_data);
      }
    } else {
      cues = parseVttToCues(payload.raw_data);
    }
  }

  if (!cues || cues.length === 0) {
    throw new ApiError('SUBTITLE_NOT_FOUND', 'Track subtitle kosong atau tidak memiliki caption yang dapat diparse.');
  }

  const result = {
    cues,
    lang: payload.lang || 'id',
    isAuto: Boolean(payload.is_auto),
  };

  // Simpan ke Tier 1 In-Memory
  RAW_SUBTITLES_MEMORY_MAP.set(videoId, result);

  // Simpan ke Tier 2 File Fisik Private Storage secara asynchronous
  try {
    const folderUri = cachePath.fileUri.substring(0, cachePath.fileUri.lastIndexOf('/'));
    const dirInfo = await FileSystem.getInfoAsync(folderUri);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(folderUri, { intermediates: true });
    }
    await FileSystem.writeAsStringAsync(cachePath.fileUri, JSON.stringify(result, null, 2));
  } catch (err) {
    console.warn('[SubtitleCache] Gagal menyimpan raw_subtitles.json ke private storage:', err);
  }

  return result;
}

/**
 * Membaca data subtitle yang sudah disimpan untuk klip tertentu dari private storage aplikasi.
 */
export async function loadClipSubtitle(
  videoId: string,
  start: number,
  end: number
): Promise<ClipSubtitleData | null> {
  const { fileUri } = getClipSubtitleFilePath(videoId, start, end);

  // 1. Cek Private Storage (Internal Sandbox)
  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    if (info.exists && !info.isDirectory) {
      const content = await FileSystem.readAsStringAsync(fileUri);
      const parsed = JSON.parse(content);
      if (parsed && Array.isArray(parsed.cues)) {
        return parsed as ClipSubtitleData;
      }
    }
  } catch {}

  // 2. Fallback jika pernah tersimpan di Shared Storage
  try {
    const filename = getClipSubtitleFilename(start, end);
    const legacySharedUri = `file://${SHARED_CLIPPING_OUTPUT_DIR}/${videoId}/${filename}`;
    const legacyInfo = await FileSystem.getInfoAsync(legacySharedUri);
    if (legacyInfo.exists && !legacyInfo.isDirectory) {
      const content = await FileSystem.readAsStringAsync(legacySharedUri);
      const parsed = JSON.parse(content);
      if (parsed && Array.isArray(parsed.cues)) {
        return parsed as ClipSubtitleData;
      }
    }
  } catch {}

  return null;
}

/**
 * Menyimpan data subtitle klip ke file JSON di private storage aplikasi (internal sandbox).
 */
export async function saveClipSubtitle(data: ClipSubtitleData): Promise<void> {
  const { fileUri } = getClipSubtitleFilePath(data.videoId, data.start, data.end);
  const folderUri = fileUri.substring(0, fileUri.lastIndexOf('/'));
  const dirInfo = await FileSystem.getInfoAsync(folderUri);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(folderUri, { intermediates: true });
  }
  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(data, null, 2));
}

/**
 * Menghapus file subtitle klip dari private storage aplikasi.
 */
export async function deleteClipSubtitle(
  videoId: string,
  start: number,
  end: number
): Promise<boolean> {
  const { fileUri } = getClipSubtitleFilePath(videoId, start, end);
  let deleted = false;

  try {
    await FileSystem.deleteAsync(fileUri, { idempotent: true });
    deleted = true;
  } catch {}

  // Bersihkan juga legacy file di shared storage jika ada
  try {
    const filename = getClipSubtitleFilename(start, end);
    const legacySharedUri = `file://${SHARED_CLIPPING_OUTPUT_DIR}/${videoId}/${filename}`;
    await FileSystem.deleteAsync(legacySharedUri, { idempotent: true });
    deleted = true;
  } catch {}

  return deleted;
}

/**
 * Memeriksa apakah subtitle klip sudah tersimpan di private storage aplikasi.
 */
export async function checkClipSubtitleExists(
  videoId: string,
  start: number,
  end: number
): Promise<boolean> {
  const { fileUri } = getClipSubtitleFilePath(videoId, start, end);
  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    if (info.exists && !info.isDirectory) return true;
  } catch {}

  try {
    const filename = getClipSubtitleFilename(start, end);
    const legacySharedUri = `file://${SHARED_CLIPPING_OUTPUT_DIR}/${videoId}/${filename}`;
    const legacyInfo = await FileSystem.getInfoAsync(legacySharedUri);
    return Boolean(legacyInfo.exists && !legacyInfo.isDirectory);
  } catch {
    return false;
  }
}
