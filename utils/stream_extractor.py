import yt_dlp
from utils.downloader import add_cookies

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
    
    # Langsung gunakan iOS client untuk membypass requirement JS Runtime / Signature Cipher
    # Ini jauh lebih aman dan cepat daripada mencoba Web lalu gagal.
    ydl_opts_ios = add_cookies(ydl_opts, client_type='ios')
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts_ios) as ydl_ios:
            info_ios = ydl_ios.extract_info(url, download=False)
            return info_ios.get('url')
    except Exception as e_ios:
        print(f"[STREAM EXTRACTOR] Error mengekstrak URL untuk {video_id}: {e_ios}")
        return None
