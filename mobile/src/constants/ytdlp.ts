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
  extractor_args: {
    youtube: {
      player_client: ['web', 'tv'],
    },
  },
};

/**
 * Konfigurasi Fixed FFmpeg (Tanpa Fallback):
 * Pemotongan presisi tinggi menggunakan filter seek
 */
export const FFMPEG_FIXED_CONFIG = {
  videoCodec: 'copy',
  audioCodec: 'copy',
  preset: 'ultrafast',
  avoidNegativeTs: 'make_zero',
};
