import yt_dlp
from utils.youtube_auth import add_cookies

def get_direct_stream_url(video_id: str, custom_opts: dict = None) -> tuple:
    """
    Ekstrak direct stream URL dari video YouTube menggunakan yt-dlp secara minimalis (pass-through).
    Tidak menggunakan cache in-memory atau file rate limiter di backend;
    seluruh konfigurasi dan caching didelegasikan ke frontend.
    
    Returns:
        tuple: (url: str | None, error: str | None)
    """
    url = f"https://www.youtube.com/watch?v={video_id}"
    
    # Konfigurasi default jika frontend tidak mengirimkan custom ydl_opts
    ydl_opts = {
        'format': 'best[height<=480][ext=mp4]/best[ext=mp4]',
        'quiet': True,
        'skip_download': True,
        'extract_flat': False
    }
    
    # 100% Dynamic: Override dengan konfigurasi dari request body jika disediakan
    if custom_opts and isinstance(custom_opts, dict):
        ydl_opts.update(custom_opts)
            
    # Menggunakan jalur iOS (Sangat aman dari BotGuard, format mp4 langsung)
    ydl_opts_ios = add_cookies(ydl_opts.copy(), client_type='ios')
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts_ios) as ydl_ios:
            info_ios = ydl_ios.extract_info(url, download=False)
            result_url = info_ios.get('url')
            if not result_url:
                return None, "Direct stream URL tidak ditemukan dalam metadata YouTube."
            return result_url, None
    except Exception as e_ios:
        error_msg = str(e_ios)
        print(f"[STREAM EXTRACTOR ERROR] Gagal mengekstrak video '{video_id}': {error_msg}")
        return None, error_msg
