/**
 * Cache in-memory hasil ekstraksi frame agar tidak perlu decode ulang video
 */
const frameCache = new Map<string, string>();

/**
 * Mengekstrak frame tertentu dari file video dan mengembalikannya sebagai data URL gambar (JPEG).
 * Berjalan langsung di browser menggunakan HTML5 video & canvas (zero backend dependency).
 */
export function captureVideoFrame(
  videoSrc: string,
  timeInSeconds: number,
  width = 1080,
  height = 1920
): Promise<string> {
  const cacheKey = `${videoSrc}_${timeInSeconds.toFixed(3)}`;
  if (frameCache.has(cacheKey)) {
    return Promise.resolve(frameCache.get(cacheKey)!);
  }

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    (video as any).defaultMuted = true;
    video.playsInline = true;
    video.preload = 'auto'; // Sangat krusial agar browser langsung mendownload frame

    let isDone = false;
    const cleanup = () => {
      clearTimeout(timer);
      video.onloadeddata = null;
      video.onseeked = null;
      video.onerror = null;
      video.src = '';
      video.remove();
    };

    // Timeout keamanan singkat (3.5s)
    const timer = setTimeout(() => {
      if (!isDone) {
        isDone = true;
        cleanup();
        reject(new Error(`Timeout mengekstrak frame pada detik ${timeInSeconds}`));
      }
    }, 3500);

    video.onloadeddata = () => {
      const maxTime = Math.max(0, (video.duration || 1) - 0.08);
      const targetTime = Math.max(0, Math.min(timeInSeconds, maxTime));
      video.currentTime = targetTime;
    };

    video.onseeked = () => {
      if (isDone) return;
      isDone = true;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || width;
        canvas.height = video.videoHeight || height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          reject(new Error('Gagal mendapatkan 2D context canvas'));
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        frameCache.set(cacheKey, dataUrl);
        cleanup();
        resolve(dataUrl);
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    video.onerror = (e) => {
      if (isDone) return;
      isDone = true;
      cleanup();
      reject(new Error(`Error saat memuat video: ${e}`));
    };

    video.src = videoSrc;
    video.load(); // Inisiasi loading secara eksplisit
  });
}
