/**
 * Mengubah string timestamp (MM:SS.mmm, MM:SS, atau SS.mmm) ke detik float
 */
export function parseTimestampToSeconds(ts: string): number {
  if (!ts) return 0;
  const parts = ts.trim().split(':');
  if (parts.length === 1) {
    return parseFloat(parts[0]) || 0;
  }
  if (parts.length === 2) {
    const minutes = parseInt(parts[0], 10) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    return minutes * 60 + seconds;
  }
  if (parts.length === 3) {
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  }
  return 0;
}

/**
 * Mengubah detik float ke format timestamp MM:SS.mmm
 */
export function secondsToTimestamp(sec: number): string {
  if (isNaN(sec) || sec < 0) sec = 0;
  const minutes = Math.floor(sec / 60);
  const remainingSec = sec % 60;
  const wholeSec = Math.floor(remainingSec);
  const millis = Math.floor((remainingSec - wholeSec) * 1000);

  const pad = (n: number, width = 2) => String(n).padStart(width, '0');
  return `${pad(minutes)}:${pad(wholeSec)}.${pad(millis, 3)}`;
}

/**
 * Mengubah frame ke timestamp MM:SS.mmm
 */
export function framesToTimestamp(frame: number, fps: number): string {
  return secondsToTimestamp(frame / fps);
}

/**
 * Mengubah timestamp ke nomor frame
 */
export function timestampToFrames(ts: string, fps: number): number {
  return Math.round(parseTimestampToSeconds(ts) * fps);
}

