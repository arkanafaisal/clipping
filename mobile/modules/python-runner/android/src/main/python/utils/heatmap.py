import os
import yt_dlp

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def get_raw_heatmap(video_id: str, ydl_opts: dict) -> tuple:
    """
    Ekstrak data mentah heatmap ('Most Replayed') dan title video dari YouTube secara murni pass-through.
    TIDAK ADA fallback value di backend. Parameter video_id dan ydl_opts wajib dikirim oleh frontend.
    
    Returns:
        tuple: (heatmap: list, title: str, code: str | None, error: str | None)
    """
    if not video_id:
        return [], "", "VIDEO_ID_REQUIRED", "Parameter 'video_id' wajib diisi."
        
    if not ydl_opts or not isinstance(ydl_opts, dict):
        return [], "", "YDL_OPTS_REQUIRED", "Parameter 'ydl_opts' (konfigurasi yt-dlp) wajib dikirim oleh frontend."

    opts = ydl_opts.copy()

    # Sertakan cookies jika file cookies.txt tersedia
    cookie_path = os.path.join(BASE_DIR, 'cookies.txt')
    if os.path.exists(cookie_path):
        opts['cookiefile'] = cookie_path

    url = f"https://www.youtube.com/watch?v={video_id}"

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
            heatmap = info.get('heatmap') or []
            title = info.get('title') or ""
            
            if not heatmap:
                return [], title, "HEATMAP_NOT_FOUND", "Heatmap tidak ditemukan. Video ini mungkin belum memiliki data 'Most Replayed'."
                
            return heatmap, title, None, None
    except Exception as e:
        error_msg = str(e)
        code = "RATE_LIMIT_EXCEEDED" if ("429" in error_msg or "rate limit" in error_msg.lower()) else "EXTRACTOR_ERROR"
        return [], "", code, error_msg