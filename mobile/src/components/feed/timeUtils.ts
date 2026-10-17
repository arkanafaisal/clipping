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
  if (seconds === undefined || seconds === null || isNaN(seconds)) return '00:00';
  const centis = Math.floor((seconds % 1) * 100);
  const base = formatTime(seconds);
  if (centis > 0) {
    return `${base}.${centis.toString().padStart(2, '0')}`;
  }
  return base;
}
