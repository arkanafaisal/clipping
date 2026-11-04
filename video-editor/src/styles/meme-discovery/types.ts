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
  hp?: number;
  attackName?: string;
  attackDesc?: string;
  // Panduan visual safe zone 80% (untuk inspeksi di browser editor)
  showSafeZoneGuides?: boolean;
  [key: string]: unknown;
}
