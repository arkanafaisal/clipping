import yt_dlp
from utils.downloader import add_cookies

def get_direct_stream_url(video_id: str) -> str:
    """
    Ekstrak direct stream URL dari video YouTube menggunakan yt-dlp.
    """
    url = f"https://www.youtube.com/watch?v={video_id}"
    
    ydl_opts = {
        'format': 'best[ext=mp4]/best',
        'quiet': True,
        'skip_download': True,
        'extract_flat': False
    }
    
    # Tambahkan konfigurasi cookie (dan po-token workaround) untuk menghindari blokir
    ydl_opts = add_cookies(ydl_opts)
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return info.get('url')
    except Exception as e:
        print(f"[STREAM EXTRACTOR] Error mengekstrak URL untuk {video_id}: {e}")
        return None
