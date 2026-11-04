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
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.src = videoSrc;
    video.muted = true;
    video.playsInline = true;

    // Timeout keamanan jika video gagal dimuat
    const timer = setTimeout(() => {
      video.src = '';
      video.remove();
      reject(new Error(`Timeout mengekstrak frame pada detik ${timeInSeconds}`));
    }, 8000);

    video.onloadedmetadata = () => {
      const maxTime = Math.max(0, (video.duration || 1) - 0.05);
      const targetTime = Math.max(0, Math.min(timeInSeconds, maxTime));
      video.currentTime = targetTime;
    };

    video.onseeked = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || width;
        canvas.height = video.videoHeight || height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Gagal mendapatkan 2D context canvas'));
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        resolve(dataUrl);
      } catch (err) {
        reject(err);
      } finally {
        video.src = '';
        video.remove();
      }
    };

    video.onerror = (e) => {
      clearTimeout(timer);
      video.src = '';
      video.remove();
      reject(new Error(`Error saat memuat video: ${e}`));
    };
  });
}
