export interface MemeDiscoveryProps {
  videoSrc: string;
  title?: string;
  gameTitle?: string;
  // Detik dan milidetik target saat berhenti undo (format: "00:03.466" atau detik float relatif ke awal video)
  targetUndoTimestamp: string;
  // Durasi animasi rewind dalam detik (default: 0.8s)
  rewindDurationSeconds?: number;
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
