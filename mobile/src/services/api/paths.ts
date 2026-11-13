import * as FileSystem from 'expo-file-system/legacy';
import { getCurrentStorageRoot } from '../storageConfig';

// Shared clipping output directory:
// fileUri: file:///storage/emulated/0/clipping/output/<videoId>/clip_<rank>_<start>_<end>.mp4
// nativePath: /storage/emulated/0/clipping/output/<videoId>/clip_<rank>_<start>_<end>.mp4
export let SHARED_CLIPPING_ROOT = getCurrentStorageRoot();
export let SHARED_CLIPPING_OUTPUT_DIR = `${SHARED_CLIPPING_ROOT}/output`;

export function syncSharedStorageConfig(root: string) {
  SHARED_CLIPPING_ROOT = root;
  SHARED_CLIPPING_OUTPUT_DIR = `${root}/output`;
}

/**
 * Mengambil path direktori internal sandbox aplikasi (tanpa prefix file://).
 * Direktori ini dijamin 100% memiliki hak akses Read & Write oleh proses Android & Python
 * tanpa bergantung pada izin MANAGE_EXTERNAL_STORAGE di Android 11+.
 */
export function getInternalAppStoragePath(): string {
  if (FileSystem.documentDirectory) {
    const raw = FileSystem.documentDirectory.replace('file://', '');
    return raw.endsWith('/') ? raw.slice(0, -1) : raw;
  }
  return '/data/user/0/com.clipping.app/files';
}

export const INTERNAL_CLIPPING_ROOT = `${getInternalAppStoragePath()}/clipping`;
export const INTERNAL_CLIPPING_OUTPUT_DIR = `${INTERNAL_CLIPPING_ROOT}/output`;

// Path file cookies
export const COOKIES_FILE_NAME = 'cookies.txt';
export const COOKIES_FILE_PATH = `${SHARED_CLIPPING_ROOT}/${COOKIES_FILE_NAME}`;
export const INTERNAL_COOKIES_FILE_PATH = `${INTERNAL_CLIPPING_ROOT}/${COOKIES_FILE_NAME}`;
export const COOKIES_STORAGE_KEY = 'configured_cookies_path';

/**
 * Memformat durasi detik ke format waktu string yang aman untuk sistem file (titik '.' sebagai pemisah).
 * - Jika h > 0: "hh.mm.ss.mmm"
 * - Jika h === 0: "mm.ss.mmm"
 */
export function formatTimeForFilename(seconds: number): string {
  if (seconds === undefined || seconds === null || isNaN(seconds)) return '00.00.000';
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const totalSeconds = Math.floor(totalMs / 1000);
  const ms = totalMs % 1000;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const pad = (num: number, len: number = 2) => num.toString().padStart(len, '0');
  if (h > 0) {
    return `${pad(h)}.${pad(m)}.${pad(s)}.${pad(ms, 3)}`;
  }
  return `${pad(m)}.${pad(s)}.${pad(ms, 3)}`;
}

/**
 * Menghasilkan nama file klip berbasis rentang waktu yang sudah terformat:
 * "<start_terformat> - <end_terformat>.mp4" (contoh: "00.12 - 01.35.mp4").
 */
export function getClipFilename(start: number, end: number): string {
  const startFormatted = formatTimeForFilename(start);
  const endFormatted = formatTimeForFilename(end);
  return `${startFormatted} - ${endFormatted}.mp4`;
}

/**
 * Menghasilkan nama file klip video baru dengan subtitle yang tertempel permanen:
 * "<start> - <end> (Subtitled).mp4" (contoh: "00.12 - 01.35 (Subtitled).mp4").
 */
export function getSubtitledClipFilename(start: number, end: number): string {
  const startFormatted = formatTimeForFilename(start);
  const endFormatted = formatTimeForFilename(end);
  return `${startFormatted} - ${endFormatted} (Subtitled).mp4`;
}

/**
 * Menghasilkan alokasi lokasi file tujuan video klip ber-subtitle pada shared storage (/storage/emulated/0/clipping/output/<videoId>/).
 */
export function getSubtitledClipOutputFilePath(
  videoId: string,
  start: number,
  end: number
): { fileUri: string; nativePath: string } {
  const filename = getSubtitledClipFilename(start, end);
  const nativePath = `${SHARED_CLIPPING_OUTPUT_DIR}/${videoId}/${filename}`;
  const fileUri = `file://${nativePath}`;
  return { fileUri, nativePath };
}

/**
 * Menghasilkan alokasi lokasi file tujuan download klip pada shared storage (/storage/emulated/0/clipping/output/).
 */
export function getClipOutputFilePath(
  videoId: string,
  start: number,
  end: number,
  rank?: number | string
): { fileUri: string; nativePath: string } {
  const filename = getClipFilename(start, end);
  const nativePath = `${SHARED_CLIPPING_OUTPUT_DIR}/${videoId}/${filename}`;
  const fileUri = `file://${nativePath}`;
  return { fileUri, nativePath };
}

/**
 * Menghasilkan alokasi lokasi file tujuan download klip pada internal sandbox storage.
 */
export function getClipInternalOutputFilePath(
  videoId: string,
  start: number,
  end: number,
  rank?: number | string
): { fileUri: string; nativePath: string } {
  const filename = getClipFilename(start, end);
  const nativePath = `${INTERNAL_CLIPPING_OUTPUT_DIR}/${videoId}/${filename}`;
  const fileUri = `file://${nativePath}`;
  return { fileUri, nativePath };
}

/**
 * Menghasilkan alokasi lokasi file tujuan download full video pada shared storage:
 * /storage/emulated/0/clipping/output/<videoId>/full.mp4
 */
export function getFullVideoFilePath(videoId: string): { fileUri: string; nativePath: string } {
  const nativePath = `${SHARED_CLIPPING_OUTPUT_DIR}/${videoId}/full.mp4`;
  const fileUri = `file://${nativePath}`;
  return { fileUri, nativePath };
}

/**
 * Menghasilkan alokasi lokasi file proxy preview full video (480p) pada shared storage:
 * /storage/emulated/0/clipping/output/<videoId>/full_proxy.mp4
 */
export function getFullVideoProxyFilePath(videoId: string): { fileUri: string; nativePath: string } {
  const nativePath = `${SHARED_CLIPPING_OUTPUT_DIR}/${videoId}/full_proxy.mp4`;
  const fileUri = `file://${nativePath}`;
  return { fileUri, nativePath };
}

export function getDownloadStreamCacheFilePath(videoId: string): { fileUri: string; nativePath: string } {
  const nativePath = `${SHARED_CLIPPING_OUTPUT_DIR}/${videoId}/stream_url.txt`;
  return { fileUri: `file://${nativePath}`, nativePath };
}

/**
 * Menghasilkan nama file subtitle klip sesuai format waktu yang sudah terformat:
 * "<start> - <end>.json" (contoh: "00.12 - 01.35.json").
 */
export function getClipSubtitleFilename(start: number, end: number): string {
  const startFormatted = formatTimeForFilename(start);
  const endFormatted = formatTimeForFilename(end);
  return `${startFormatted} - ${endFormatted}.json`;
}

/**
 * Menghasilkan path file subtitle per-klip di private storage aplikasi (internal sandbox).
 */
export function getClipSubtitleFilePath(
  videoId: string,
  start: number,
  end: number
): { fileUri: string; nativePath: string } {
  const filename = getClipSubtitleFilename(start, end);
  const nativePath = `${INTERNAL_CLIPPING_OUTPUT_DIR}/${videoId}/${filename}`;
  return { fileUri: `file://${nativePath}`, nativePath };
}

/**
 * Menghasilkan path cache subtitle mentah video utuh di private storage aplikasi.
 */
export function getRawSubtitlesCacheFilePath(
  videoId: string
): { fileUri: string; nativePath: string } {
  const nativePath = `${INTERNAL_CLIPPING_OUTPUT_DIR}/${videoId}/raw_subtitles.json`;
  return { fileUri: `file://${nativePath}`, nativePath };
}

export function getClipTemplateFilename(start: number, end: number): string {
  const startFormatted = formatTimeForFilename(start);
  const endFormatted = formatTimeForFilename(end);
  return `${startFormatted} - ${endFormatted} (Template).json`;
}

export function getClipTemplateFilePath(
  videoId: string,
  start: number,
  end: number
): { fileUri: string; nativePath: string } {
  const filename = getClipTemplateFilename(start, end);
  const nativePath = `${INTERNAL_CLIPPING_OUTPUT_DIR}/${videoId}/${filename}`;
  const fileUri = `file://${nativePath}`;
  return { fileUri, nativePath };
}

export function getVideoGlobalConfigFilePath(videoId: string): { fileUri: string; nativePath: string } {
  const nativePath = `${INTERNAL_CLIPPING_OUTPUT_DIR}/${videoId}/video_config.json`;
  const fileUri = `file://${nativePath}`;
  return { fileUri, nativePath };
}
