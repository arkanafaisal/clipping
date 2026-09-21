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
    
    # 1. Coba Mode Anonim
    ydl_opts_anon = ydl_opts.copy()
    try:
        with yt_dlp.YoutubeDL(ydl_opts_anon) as ydl:
            info = ydl.extract_info(url, download=False)
            return info.get('url')
    except Exception as e_anon:
        pass
        
    # 2. Coba Mode Web Tanpa PO Token
    ydl_opts_web_no_po = add_cookies(ydl_opts.copy(), client_type='web_no_po')
    try:
        with yt_dlp.YoutubeDL(ydl_opts_web_no_po) as ydl:
            info = ydl.extract_info(url, download=False)
            return info.get('url')
    except Exception as e_web:
        pass
        
    # 3. Coba Mode Web DENGAN PO Token (Puppeteer)
    ydl_opts_po = add_cookies(ydl_opts.copy(), client_type='web')
    try:
        with yt_dlp.YoutubeDL(ydl_opts_po) as ydl:
            info = ydl.extract_info(url, download=False)
            return info.get('url')
    except Exception as e_po:
        pass
        
    # 4. Jalur Darurat iOS
    ydl_opts_ios = add_cookies(ydl_opts.copy(), client_type='ios')
    try:
        with yt_dlp.YoutubeDL(ydl_opts_ios) as ydl_ios:
            info_ios = ydl_ios.extract_info(url, download=False)
            return info_ios.get('url')
    except Exception as e_ios:
        print(f"[STREAM EXTRACTOR] Error mengekstrak URL untuk {video_id}: Semua metode gagal.")
        return None
