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
  // Efek Suara Item Discovery / Achievement Unlocked Chime
  sfxSrc?: string;
  cardEmergeSfxSrc?: string; // SFX Magical Reveal saat kartu kecil muncul dari bawah
  enableSfx?: boolean;
  // Panduan visual safe zone 80% (untuk inspeksi di browser editor)
  showSafeZoneGuides?: boolean;
  [key: string]: unknown;
}
