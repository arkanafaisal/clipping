export interface ClipItem {
  id: string;
  rank: number | string;
  videoId: string;
  start: number;
  end: number;
  value?: number;
  status?: 'none' | 'done' | 'trash';
  isCustom?: boolean;
}

export interface HeatmapResponse {
  title: string;
  clips: ClipItem[];
}

export interface StreamResponse {
  stream_url: string;
  error?: string;
}

export interface VideoVersionItem {
  id: string; // e.g. "1080p60", "720p60", "720p30", "480p30", "360p30"
  label: string; // "1080p 60fps"
  height: number;
  fps: number;
  is_progressive: boolean;
  format_id: string;
  vcodec?: string;
  ext?: string;
  filesize_approx?: number;
  note?: string;
}

/**
 * Daftar Kualitas Tetap (Fixed Preset Options) untuk Stream & Download.
 * Tanpa perlu melakukan hit fetch ke YouTube diawal.
 * - 360p30: Ditarik via client 'android' -> Format 18 Progressive (Audio & Video 100% menyatu, 0ms delay).
 * - 720p60 & 1080p60: Ditarik via client 'web' -> DASH HLS 60 FPS resmi.
 */
export const FIXED_QUALITY_VERSIONS: VideoVersionItem[] = [
  {
    id: '360p30',
    label: '360p (30 FPS)',
    height: 360,
    fps: 30,
    is_progressive: true,
    format_id: '18',
    note: 'Ringan & Cepat (Progressive, Audio Menyatu 100%)',
  },
  {
    id: '720p60',
    label: '720p (60 FPS)',
    height: 720,
    fps: 60,
    is_progressive: false,
    format_id: 'dash_720p60',
    note: 'Standar HD (DASH 60 FPS, Client Web)',
  },
  {
    id: '1080p60',
    label: '1080p (60 FPS)',
    height: 1080,
    fps: 60,
    is_progressive: false,
    format_id: 'dash_1080p60',
    note: 'Maksimal Full HD (DASH 60 FPS, Client Web)',
  },
];

export interface QualityUrlData {
  isDASH: boolean;
  url?: string;
  videoUrl?: string;
  audioUrl?: string;
  qualityId: string;
  formatId?: string;
  cachedAt?: number;
}

export type CachedQualityUrl = string | QualityUrlData;

export interface QualityStreamSources {
  videoUrl: string;
  audioUrl: string | null;
  isDASH: boolean;
  qualityId: string;
}

export interface SubtitleCue {
  id: string;
  start: number;    // Detik relatif terhadap awal klip (mulai dari 0.00s)
  end: number;      // Detik relatif terhadap awal klip
  rawStart: number; // Detik absolut pada video YouTube utuh
  rawEnd: number;   // Detik absolut pada video YouTube utuh
  text: string;     // Teks subtitle bersih (single line)
  fontSize?: number; // Hanya ada jika di-override dari base global 14 (jika kosong/14 maka di-omit)
}

export interface SubtitleStyle {
  fontSize: number;          // Default 14
  color: string;             // Hex color misal '#FFFFFF'
  backgroundColor: string;   // Background pill misal 'rgba(0,0,0,0.65)'
  strokeColor?: string;      // Outline color misal '#000000'
  strokeWidth?: number;      // Default 1
  fontWeight: 'normal' | 'bold' | '600' | '700'; // Default 'bold'
  positionY: number;         // Skala posisi vertikal 0 - 100 terhadap frame video (default 85)
  positionX: number;         // Skala posisi horizontal 0 - 100 terhadap frame video (default 50)
}

export interface ClipSubtitleData {
  videoId: string;
  start: number;
  end: number;
  lang: string;
  isAuto?: boolean;
  style: SubtitleStyle;
  cues: SubtitleCue[];
  updatedAt: number;
}

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontSize: 14,
  color: '#FFFFFF',
  backgroundColor: 'transparent',
  strokeColor: '#000000',
  strokeWidth: 2,
  fontWeight: 'bold',
  positionY: 85,
  positionX: 50,
};

export interface ClipTemplateConfig {
  context: {
    enabled: boolean;
    text: string;
    fontSize: number;
    paddingY: number;
    align?: 'start' | 'center';
  };
  facecam: {
    enabled: boolean;
    zoom: number;
    cropX: number; // 0 - 100 (% offset from center)
    cropY: number; // 0 - 100 (% offset from center)
    ratioWidth?: number; // Nilai 'a' pada rasio a:b (default: 4)
    ratioHeight?: number; // Nilai 'b' pada rasio a:b (default: 3)
  };
  mainVideo: {
    enabled?: boolean;
    zoom: number;
    cropX: number; // 0 - 100 (% offset from center)
    cropY: number; // 0 - 100 (% offset from center)
    ratioWidth?: number; // Nilai 'a' pada rasio a:b (default: 4 saat facecam aktif, 16 saat nonaktif)
    ratioHeight?: number; // Nilai 'b' pada rasio a:b (default: 3 saat facecam aktif, 9 saat nonaktif)
  };
  watermark: {
    enabled: boolean;
    text: string;
    size: number; // Ukuran font dp
    x: number; // 0 - 100 (% horizontal relatif terhadap container luar)
    y: number; // 0 - 100 (% vertikal relatif terhadap container luar)
  };
}

export const DEFAULT_TEMPLATE_CONFIG: ClipTemplateConfig = {
  context: {
    enabled: false,
    text: 'JUDUL VIDEO CLIP',
    fontSize: 16,
    paddingY: 10,
    align: 'start',
  },
  facecam: {
    enabled: false,
    zoom: 2.0,
    cropX: 80,
    cropY: 20,
    ratioWidth: 4,
    ratioHeight: 3,
  },
  mainVideo: {
    enabled: true,
    zoom: 1.0,
    cropX: 50,
    cropY: 50,
    ratioWidth: 4,
    ratioHeight: 3,
  },
  watermark: {
    enabled: false,
    text: '',
    size: 14,
    x: 85,
    y: 15,
  },
};

export interface VideoGlobalConfig {
  subtitlePosition?: { x: number; y: number };
  facecam?: {
    zoom: number;
    cropX: number;
    cropY: number;
    ratioWidth?: number;
    ratioHeight?: number;
  };
  mainVideo?: {
    zoom: number;
    cropX: number;
    cropY: number;
    ratioWidth?: number;
    ratioHeight?: number;
  };
  contextStyle?: {
    fontSize: number;
    paddingY: number;
    align?: 'start' | 'center';
  };
  watermark?: {
    enabled: boolean;
    text: string;
    size: number;
    x: number;
    y: number;
  };
  updatedAt?: number;
}

export interface BurnSubtitlesParams {
  videoId: string;
  start: number;
  end: number;
  inputVideoPath: string;
  outputVideoPath?: string;
  subtitleData: ClipSubtitleData;
  templateData?: ClipTemplateConfig;
  duration?: number;
}

export interface BurnSubtitlesResult {
  status: 'success' | 'error';
  outputPath: string;
}

export const EXPECTED_SCRIPTS_VERSION = '1.0.1';

export interface ScriptsVersionStatus {
  currentVersion: string | null;
  expectedVersion: string;
  isMatch: boolean;
  isAvailable: boolean;
  hash?: string;
  error?: string;
}
