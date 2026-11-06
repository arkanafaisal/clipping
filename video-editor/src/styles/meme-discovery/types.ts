export const RARITY_CONFIG = {
  Common: {
    label: 'Common',
    color: '#9ca3af',
    desc: 'Abu-abu',
  },
  Uncommon: {
    label: 'Uncommon',
    color: '#22c55e',
    desc: 'Hijau',
  },
  Rare: {
    label: 'Rare',
    color: '#f97316',
    desc: 'Oranye',
  },
  Epic: {
    label: 'Epic',
    color: '#a855f7',
    desc: 'Ungu',
  },
  Legendary: {
    label: 'Legendary',
    color: '#eab308',
    desc: 'Kuning / Emas',
  },
  Mythic: {
    label: 'Mythic',
    color: '#ef4444',
    desc: 'Merah',
  },
} as const;

export type CardRarityType = keyof typeof RARITY_CONFIG;

export function getRarityColor(rarity?: string): string {
  if (!rarity) return RARITY_CONFIG.Common.color;
  const match = Object.entries(RARITY_CONFIG).find(
    ([key]) => key.toLowerCase() === rarity.toLowerCase()
  );
  return match ? match[1].color : RARITY_CONFIG.Common.color;
}

export interface CardSkill {
  name: string;
  desc: string;
  nameFontSize?: number;
  descFontSize?: number;
}

export interface MemeDiscoveryProps {
  videoSrc: string;
  title?: string;
  gameTitle?: string;
  // Posisi timestamp frame relatif terhadap detik 0 (misal: "00:03.466" atau "3.466")
  targetUndoTimestamp: string;
  // Total durasi video penuh dalam detik (default: 10.95s, dihitung otomatis)
  totalVideoDurationSeconds?: number;
  // Data kartu Meme Discovery (Minimalis Jimat)
  cardTitle?: string;
  cardRarity?: string;
  cardDesc?: string;
  skills?: CardSkill[]; // Daftar skill kartu (maks 3 skill)
  passiveName?: string;
  passiveDesc?: string;
  cardColor?: string; // Warna tema kartu kustom (hex, misal: "#f59e0b")
  // Ukuran font teks kartu yang dapat disetel langsung oleh pengguna (pixel)
  titleFontSize?: number;
  rarityFontSize?: number;
  descFontSize?: number;
  passiveNameFontSize?: number;
  passiveDescFontSize?: number;
  cardImageSrc?: string; // bisa dari file gambar 1:1 di Drive atau freeze video frame
  targetFrameImage?: string;
  // Opsi Mode Eksekusi: Screenshot flash (default true) vs langsung reveal kartu tanpa jeda
  enableScreenshot?: boolean;
  // Efek Suara (SFX)
  sfxSrc?: string; // SFX Magical Reveal saat kartu kecil muncul dari bawah
  cardEmergeSfxSrc?: string; // fallback alias kompatibilitas
  cameraShutterSfxSrc?: string; // SFX Camera Shutter saat screenshot frame momen
  enableSfx?: boolean;
  // Panduan visual safe zone 80% (untuk inspeksi di browser editor)
  showSafeZoneGuides?: boolean;
  [key: string]: unknown;
}
