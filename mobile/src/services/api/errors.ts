/**
 * Kamus pemetaan kode error API dari backend ke pesan ramah pengguna (Bahasa Indonesia).
 * Backend hanya mengembalikan KODE (misal: "STREAM_NOT_FOUND"), frontend memegang 100% kamus teks.
 */
export const API_ERROR_MAP: Record<string, string> = {
  VIDEO_ID_REQUIRED: 'ID video YouTube tidak boleh kosong.',
  YDL_OPTS_REQUIRED: 'Konfigurasi ekstraksi (ydl_opts) tidak valid.',
  STREAM_NOT_FOUND: 'Direct stream video tidak ditemukan atau video dibatasi (Private/Age-restricted).',
  HEATMAP_NOT_FOUND: 'Video ini belum memiliki data Most Replayed (Heatmap) dari YouTube.',
  RATE_LIMIT_EXCEEDED: 'Batas permintaan YouTube terlampaui (Error 429) pada mode anonim. Silakan impor cookies dari Google Drive untuk melanjutkan.',
  COOKIES_INVALID_OR_EXPIRED: 'Gagal mengunduh klip: Cookies telah digunakan ke yt-dlp namun ditolak oleh YouTube (kedaluwarsa atau terkena verifikasi bot). Harap perbarui file cookies.txt Anda.',
  COOKIES_FILE_NOT_FOUND: 'File cookies tidak ditemukan di direktori storage server (/storage/emulated/0/clipping/cookies.txt). Harap impor ulang cookies dari Google Drive.',
  GDRIVE_DOWNLOAD_FAILED: 'Gagal mengunduh file dari Google Drive. Pastikan file bukan folder dan link dapat diakses oleh publik.',
  GDRIVE_HTML_CONTENT: 'Link Google Drive yang dimasukkan mengarah ke halaman HTML atau Folder, bukan file cookies.txt. Harap salin link langsung dari file cookies.txt.',
  GDRIVE_FILE_EMPTY: 'File cookies hasil unduhan Google Drive kosong atau tidak tersimpan.',
  FORMAT_NOT_AVAILABLE: 'Format video yang diminta tidak tersedia di YouTube untuk video ini.',
  INVALID_PARAMS: 'Parameter permintaan tidak lengkap atau tidak valid.',
  INVALID_RANGE: 'Rentang waktu klip tidak valid.',
  OUTPUT_PATH_REQUIRED: 'Lokasi tujuan penyimpanan file (output_path) wajib disertakan.',
  FFMPEG_CUT_ERROR: 'Pemotongan presisi klip dengan FFmpeg gagal.',
  STORAGE_PERMISSION_DENIED: 'Akses penyimpanan perangkat ditolak (Permission Denied). Harap berikan izin "Akses Semua File" di Pengaturan HP untuk aplikasi Clipping.',
  DOWNLOAD_FAILED: 'Gagal mengunduh klip video dari YouTube.',
  SUBTITLE_NOT_FOUND: 'Subtitle maupun automatic caption tidak ditemukan pada video YouTube ini.',
  SUBTITLE_URL_MISSING: 'Track subtitle tidak memiliki URL unduhan yang valid.',
  SUBTITLE_ERROR: 'Gagal mengambil data subtitle dari video.',
  INPUT_VIDEO_NOT_FOUND: 'File klip video sumber tidak ditemukan untuk proses export subtitle.',
  NO_SUBTITLES_TO_BURN: 'Daftar subtitle kosong atau tidak memiliki baris teks untuk ditempelkan.',
  FFMPEG_BURN_ERROR: 'Gagal menempelkan (burn) subtitle ke video menggunakan FFmpeg.',
  OUTPUT_FILE_EMPTY: 'File video hasil export subtitle kosong atau gagal dibuat.',
  ASS_GENERATION_FAILED: 'Gagal mengonversi konfigurasi subtitle ke format ASS.',
  SERVER_OFFLINE: 'Server internal Python belum aktif pada port 8080.',
  DEV_SERVER_OFFLINE: 'Server Mobile Dev/Mock API belum aktif pada port 3006.',
  INTERNAL_ERROR: 'Terjadi kesalahan internal pada server Python.',
  FUNCTION_NOT_FOUND: 'Fungsi Python tidak ditemukan pada modul skrip. Pastikan file skrip di shared storage (clipping/scripts) sudah diperbarui.',
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

/**
 * Memeriksa apakah error yang terjadi merupakan akibat pembatasan akses YouTube
 * (Rate Limit 429, 403 Forbidden, token access denied, bot verification check, ffmpeg exit code 8, dll).
 */
export function isRateLimitOrRestrictedError(err: any): boolean {
  if (!err) return false;
  if (err.code === 'STORAGE_PERMISSION_DENIED') return false;
  const fullText = `${err.name || ''} ${err.code || ''} ${err.message || ''} ${err.rawError || ''}`.toLowerCase();
  if (
    fullText.includes('permission denied') ||
    fullText.includes('operation not permitted') ||
    fullText.includes('not permitted') ||
    fullText.includes('errno 13') ||
    fullText.includes('errno 1')
  ) {
    return false;
  }
  return (
    fullText.includes('sign in to confirm') ||
    fullText.includes('bot verification') ||
    fullText.includes('confirm you’re not a bot') ||
    fullText.includes('confirm you\'re not a bot')
  );
}
