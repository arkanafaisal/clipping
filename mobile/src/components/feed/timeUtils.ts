export function formatTime(seconds: number): string {
  if (seconds === undefined || seconds === null || isNaN(seconds)) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (num: number) => num.toString().padStart(2, '0');
  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

export function formatTimeWithMs(seconds: number): string {
  if (seconds === undefined || seconds === null || isNaN(seconds)) return '00:00.000';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  const pad = (num: number, size: number = 2) => num.toString().padStart(size, '0');
  return `${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
}

export function formatDisplayTime(seconds: number): string {
  // Banner rentang atas fix hanya menampilkan menit dan detik murni (MM:SS), jam dan milidetik di-hide total
  if (seconds === undefined || seconds === null || isNaN(seconds)) return '00:00';
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (num: number) => num.toString().padStart(2, '0');
  return `${pad(m)}:${pad(s)}`;
}

/**
 * Mengonversi string format waktu ("HH:MM:SS", "MM:SS", atau "SS") menjadi detik murni (number).
 */
export function parseTimeToSeconds(input: string): number {
  if (!input) return 0;
  const trimmed = input.trim();
  const parts = trimmed.split(':');
  if (parts.length === 3) {
    const h = parseFloat(parts[0]) || 0;
    const m = parseFloat(parts[1]) || 0;
    const s = parseFloat(parts[2]) || 0;
    return Math.max(0, h * 3600 + m * 60 + s);
  }
  if (parts.length === 2) {
    const m = parseFloat(parts[0]) || 0;
    const s = parseFloat(parts[1]) || 0;
    return Math.max(0, m * 60 + s);
  }
  const s = parseFloat(trimmed) || 0;
  return Math.max(0, s);
}
