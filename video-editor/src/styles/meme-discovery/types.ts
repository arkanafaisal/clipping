export interface MemeDiscoveryProps {
  videoSrc: string;
  title: string;
  gameTitle: string;
  // Detik dan milidetik target saat berhenti undo (format: "00:03.450" atau detik float)
  targetUndoTimestamp: string;
  // Durasi animasi rewind dalam detik (default: 0.8s)
  rewindDurationSeconds?: number;
  // Data kartu Pokemon / Trading Card
  cardTitle?: string;
  cardSubtitle?: string;
  cardRarity?: string;
  cardImageSrc?: string; // bisa dari file gambar 1:1 di Drive atau video frame
  hp?: number;
  attackName?: string;
  attackDesc?: string;
  [key: string]: unknown;
}
