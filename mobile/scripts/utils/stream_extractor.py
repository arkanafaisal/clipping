import os
import yt_dlp

def get_direct_stream_url(video_id: str, ydl_opts: dict, cookie_path: str = None) -> tuple:
    """
    Ekstrak direct stream URL dari video YouTube menggunakan yt-dlp secara murni pass-through.
    Mencoba mode anonim terlebih dahulu. Jika gagal dan parameter cookie_path valid dikirimkan,
    mencoba sekali lagi menggunakan cookies.
    
    Returns:
        tuple: (url: str | None, code: str | None, error: str | None)
    """
    if not video_id:
        return None, "VIDEO_ID_REQUIRED", "Parameter 'video_id' wajib diisi."
        
    if not ydl_opts or not isinstance(ydl_opts, dict):
        return None, "YDL_OPTS_REQUIRED", "Parameter 'ydl_opts' (konfigurasi yt-dlp) wajib dikirim oleh frontend."

    url = f"https://www.youtube.com/watch?v={video_id}"

    # 1. Percobaan Pertama: Mode Anonim (100% tanpa cookies)
    opts_anon = ydl_opts.copy()
    opts_anon.pop('cookiefile', None)
    
    first_error_msg = None
    try:
        with yt_dlp.YoutubeDL(opts_anon) as ydl:
            info = ydl.extract_info(url, download=False)
            result_url = info.get('url')
            if result_url:
                return result_url, None, None
    except Exception as e:
        first_error_msg = str(e)

    # 2. Percobaan Kedua: Mode Cookies (Hanya jika mode anonim gagal & cookie_path dikirim oleh frontend)
    if cookie_path and os.path.exists(cookie_path):
        opts_cookies = ydl_opts.copy()
        opts_cookies['cookiefile'] = cookie_path
        try:
            with yt_dlp.YoutubeDL(opts_cookies) as ydl:
                info = ydl.extract_info(url, download=False)
                result_url = info.get('url')
                if result_url:
                    return result_url, None, None
                return None, "STREAM_NOT_FOUND", "Direct stream URL tidak ditemukan dalam respon metadata YouTube."
        except Exception as e:
            error_msg = str(e)
            is_limit = any(k in error_msg.lower() for k in ["429", "403", "forbidden", "access denied", "rate limit", "bot", "captcha", "sign in"])
            code = "RATE_LIMIT_EXCEEDED" if is_limit else "EXTRACTOR_ERROR"
            return None, code, error_msg

    error_msg = first_error_msg or "Direct stream URL tidak ditemukan dalam respon metadata YouTube."
    is_limit = any(k in error_msg.lower() for k in ["429", "403", "forbidden", "access denied", "rate limit", "bot", "captcha", "sign in"])
    code = "RATE_LIMIT_EXCEEDED" if is_limit else ("STREAM_NOT_FOUND" if "not found" in error_msg.lower() else "EXTRACTOR_ERROR")
    return None, code, error_msg


def extract_stream_url(video_id: str, ydl_opts: dict = None, cookie_path: str = None) -> dict:
    """
    Wrapper fungsi skrip murni yang dipanggil langsung oleh runner.py / Native Module.
    Mengembalikan dictionary hasil atau error terstruktur.
    """
    url, code, err = get_direct_stream_url(video_id, ydl_opts or {}, cookie_path)
    if code or err:
        return {
            "status": "error",
            "code": code or "STREAM_ERROR",
            "error": err or str(code)
        }
    return {
        "status": "success",
        "stream_url": url
    }

