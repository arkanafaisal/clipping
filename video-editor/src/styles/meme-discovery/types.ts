export interface MemeDiscoveryProps {
  videoSrc: string;
  title?: string;
  gameTitle?: string;
  // Posisi timestamp frame relatif terhadap detik 0 (misal: "00:03.466" atau "3.466")
  targetUndoTimestamp: string;
  // Total durasi video penuh dalam detik (default: 10.95s, dihitung otomatis)
  totalVideoDurationSeconds?: number;
  // Data kartu Pokemon / Trading Card
  cardTitle?: string;
  cardSubtitle?: string;
  cardRarity?: string;
  cardImageSrc?: string; // bisa dari file gambar 1:1 di Drive atau freeze video frame
  // Gambar frame beku statis (hasil tangkapan canvas, menghilangkan jeda/seek video)
  lastFrameImage?: string;
  targetFrameImage?: string;
  hp?: number;
  attackName?: string;
  attackDesc?: string;
  // Elemen anatomi kartu Pokemon TCG autentik
  stage?: string; // e.g. "BASIC MEME"
  energyType?: string; // e.g. "⚡" atau "💀"
  speciesInfo?: string; // e.g. "NO. 001 Grim Reaper • HT: 5'11\" • WT: 0 lbs"
  abilityName?: string; // e.g. "Momen Spontan"
  abilityDesc?: string; // e.g. "Setiap kali viewer kaget, momen ini otomatis viral."
  weakness?: string; // e.g. "⚡ x2"
  resistance?: string; // e.g. "🛡️ -30"
  retreatCost?: string; // e.g. "⚪⚪"
  illustrator?: string; // e.g. "Antigravity Editor"
  // Panduan visual safe zone 80% (untuk inspeksi di browser editor)
  showSafeZoneGuides?: boolean;
  [key: string]: unknown;
}
