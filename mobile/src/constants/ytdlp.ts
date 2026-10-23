/**
 * Konfigurasi Tetap (Fixed Constants) untuk yt-dlp & FFmpeg.
 * Sesuai arsitektur True Pass-Through: Backend Python tidak menyimpan fallback/konfigurasi hardcoded,
 * seluruh parameter yt-dlp dikirim secara eksplisit dari Frontend ke Backend.
 */

export interface YtdlOpts {
  format?: string;
  skip_download?: boolean;
  quiet?: boolean;
  no_warnings?: boolean;
  extract_flat?: boolean;
  extractor_args?: {
    youtube?: {
      player_client?: string[];
      [key: string]: any;
    };
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * Konfigurasi Stream Langsung (Mobile Native Playback):
 * - Resolusi: Maksimal 480p MP4 (ringan dan hemat kuota)
 * - Client: iOS & Android (Bypass BotGuard dan aman dari challenge SABR)
 */
export const STREAM_YTDL_OPTS: YtdlOpts = {
  format: 'best[height<=480][ext=mp4]/best[ext=mp4]',
  skip_download: true,
  quiet: true,
  no_warnings: true,
  extract_flat: false,
  extractor_args: {
    youtube: {
      player_client: ['ios', 'android'],
    },
  },
};

/**
 * Konfigurasi Ekstraksi Heatmap ('Most Replayed'):
 * - Mengambil metadata teks saja tanpa download media
 * - Client: iOS & Android
 */
export const HEATMAP_YTDL_OPTS: YtdlOpts = {
  skip_download: true,
  quiet: true,
  no_warnings: true,
  extract_flat: false,
  extractor_args: {
    youtube: {
      player_client: ['ios', 'android'],
    },
  },
};

/**
 * Konfigurasi Download Klip Fisik (Masa Depan / Full Quality):
 * - Kualitas: Fixed 1080p / 720p (tidak boleh turun kualitas)
 * - Client: Web / TV
 */
export const DOWNLOAD_YTDL_OPTS: YtdlOpts = {
  format: 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]',
};

/**
 * Konfigurasi Download Klip Fisik (Prime Quality + Stream Reconnect + Retries):
 * - Kualitas: Prime HD asli YouTube (bestvideo+bestaudio merged ke MP4 1080p 60fps)
 * - Ekstraksi: Multi-client standar yt-dlp (menghindari blokir format YouTube web)
 * - FFmpeg: Reconnect streamed stream dan ultrafast encoding
 * - Retry: 15x retry untuk fragment & socket timeout 60s
 */
export const PRIME_CLIP_DOWNLOAD_OPTS: YtdlOpts = {
  format: 'bestvideo+bestaudio/best',
  merge_output_format: 'mp4',
  quiet: false,
  no_warnings: true,
  retries: 15,
  fragment_retries: 15,
  skip_unavailable_fragments: false,
  socket_timeout: 60,
  extractor_retries: 5,
  file_access_retries: 5,
  external_downloader_args: {
    ffmpeg_i: [
      '-reconnect',
      '1',
      '-reconnect_streamed',
      '1',
      '-reconnect_delay_max',
      '5',
    ],
    ffmpeg: [
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-crf',
      '22',
      '-maxrate',
      '8M',
      '-bufsize',
      '12M',
      '-pix_fmt',
      'yuv420p',
      '-profile:v',
      'high',
      '-level',
      '4.2',
      '-movflags',
      '+faststart',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-avoid_negative_ts',
      'make_zero',
      '-loglevel',
      'warning',
    ],
  },
};

// ==============================================================================
// Konfigurasi Ekstraksi Subtitle / Closed Captions:
// - Mengambil track subtitle otomatis (ASR) atau manual tanpa mendownload media video
// - Mendukung pemilihan multi-bahasa dinamis (Bahasa Indonesia & English diutamakan)
// ==============================================================================
export const SUBTITLE_YTDL_OPTS: YtdlOpts = {
  skip_download: true,
  writesubtitles: true,
  writeautomaticsub: true,
  subtitleslangs: ['id', 'en', 'ja', 'all'],
  quiet: true,
  no_warnings: true,
  extract_flat: false,
  extractor_args: {
    youtube: {
      player_client: ['android', 'ios'],
    },
  },
};
