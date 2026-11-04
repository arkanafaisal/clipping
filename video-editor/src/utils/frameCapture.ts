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
    let timer: any = null;

    const cleanup = () => {
      clearTimeout(timer);
      video.oncanplay = null;
      video.onseeked = null;
      video.onerror = null;
      video.src = '';
      video.remove();
    };

    // Timeout keamanan wajar (5s)
    timer = setTimeout(() => {
      if (!isDone) {
        isDone = true;
        cleanup();
        reject(new Error(`Timeout mengekstrak frame pada detik ${timeInSeconds}`));
      }
    }, 5000);

    const doDraw = () => {
      if (isDone) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || width;
        canvas.height = video.videoHeight || height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          isDone = true;
          cleanup();
          reject(new Error('Gagal mendapatkan 2D context canvas'));
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

        // Validasi: jika frame masih hitam/kosong (ukuran < 30KB pada 1080x1920), tunggu buffer hardware decoder
        if (dataUrl.length < 30000) {
          setTimeout(() => {
            if (isDone) return;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const retryData = canvas.toDataURL('image/jpeg', 0.88);
            if (retryData.length >= 30000) {
              frameCache.set(cacheKey, retryData);
            }
            isDone = true;
            cleanup();
            resolve(retryData);
          }, 70);
          return;
        }

        frameCache.set(cacheKey, dataUrl);
        isDone = true;
        cleanup();
        resolve(dataUrl);
      } catch (err) {
        isDone = true;
        cleanup();
        reject(err);
      }
    };

    const doSeek = () => {
      if (isDone) return;
      const duration = video.duration || 1;
      const maxTime = Math.max(0, duration - 0.08);
      const targetTime = Math.max(0, Math.min(timeInSeconds, maxTime));

      video.addEventListener(
        'seeked',
        () => {
          // Beri jeda 60ms agar GPU hardware decoder selesai mem-paint tekstur frame
          setTimeout(doDraw, 60);
        },
        { once: true }
      );

      video.currentTime = targetTime;
    };

    video.onerror = (e) => {
      if (isDone) return;
      isDone = true;
      cleanup();
      reject(new Error(`Error saat memuat video: ${e}`));
    };

    video.addEventListener('canplay', doSeek, { once: true });
    video.src = videoSrc;
    video.load();
  });
}
