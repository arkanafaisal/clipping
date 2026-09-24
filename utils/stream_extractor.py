import time
import yt_dlp
from utils.downloader import add_cookies
from utils.rate_limiter import gate1_limiter

# Cache in-memory: { "video_id": {"url": "...", "expires_at": timestamp} }
# YouTube URLs usually expire in 6 hours, we cache for 2 hours (7200 detik)
STREAM_CACHE = {}

def get_direct_stream_url(video_id: str) -> str:
    """
    Ekstrak direct stream URL dari video YouTube menggunakan yt-dlp.
    """
    url = f"https://www.youtube.com/watch?v={video_id}"
    
    ydl_opts = {
        'format': 'best[height<=480][ext=mp4]/best[ext=mp4]',
        'quiet': True,
        'skip_download': True,
        'extract_flat': False
    }
    
    # Cek Cache dulu sebelum membuang tiket Gate 1
    now = time.time()
    if video_id in STREAM_CACHE:
        cache_data = STREAM_CACHE[video_id]
        if now < cache_data["expires_at"]:
            print(f"[STREAM CACHE] Memakai URL dari cache untuk {video_id}. (Aman dari hitungan Gate 1!)")
            return cache_data["url"]
        else:
            del STREAM_CACHE[video_id] # Expired
            
    # Menggunakan jalur iOS (Sangat aman dari BotGuard, kualitas cukup untuk preview)
    ydl_opts_ios = add_cookies(ydl_opts.copy(), client_type='ios')
    try:
        gate1_limiter.check_and_add()
        with yt_dlp.YoutubeDL(ydl_opts_ios) as ydl_ios:
            info_ios = ydl_ios.extract_info(url, download=False)
            result_url = info_ios.get('url')
            
            # Simpan ke cache (Valid selama 2 jam / 7200 detik)
            if result_url:
                STREAM_CACHE[video_id] = {
                    "url": result_url,
                    "expires_at": time.time() + 7200
                }
            return result_url
    except Exception as e_ios:
        if "RATE_LIMIT_EXCEEDED" in str(e_ios): raise
        print(f"[STREAM EXTRACTOR] Error mengekstrak URL iOS untuk {video_id}: {e_ios}")
        return None
