import os
import yt_dlp

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def get_direct_stream_url(video_id: str, ydl_opts: dict) -> tuple:
    """
    Ekstrak direct stream URL dari video YouTube menggunakan yt-dlp secara murni pass-through.
    TIDAK ADA fallback value di backend. Seluruh konfigurasi wajib dikirim dari frontend.
    
    Returns:
        tuple: (url: str | None, error: str | None)
    """
    if not video_id:
        return None, "Parameter 'video_id' wajib diisi."
        
    if not ydl_opts or not isinstance(ydl_opts, dict):
        return None, "Parameter 'ydl_opts' (konfigurasi yt-dlp) wajib dikirim oleh frontend."

    opts = ydl_opts.copy()

    # Sertakan cookies jika file cookies.txt tersedia di direktori
    cookie_path = os.path.join(BASE_DIR, 'cookies.txt')
    if os.path.exists(cookie_path):
        opts['cookiefile'] = cookie_path

    url = f"https://www.youtube.com/watch?v={video_id}"
    
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
            result_url = info.get('url')
            if not result_url:
                return None, "Direct stream URL tidak ditemukan dalam respon metadata YouTube."
            return result_url, None
    except Exception as e:
        error_msg = str(e)
        return None, error_msg
