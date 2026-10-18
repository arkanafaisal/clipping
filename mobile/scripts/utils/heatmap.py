import os
import yt_dlp

def get_raw_heatmap(video_id: str, ydl_opts: dict, cookie_path: str = None) -> tuple:
    """
    Ekstrak data mentah heatmap ('Most Replayed') dan title video dari YouTube secara murni pass-through.
    Mencoba mode anonim terlebih dahulu. Jika gagal dan cookie_path valid dikirimkan oleh frontend,
    mencoba sekali lagi menggunakan cookies.
    
    Returns:
        tuple: (heatmap: list, title: str, code: str | None, error: str | None)
    """
    if not video_id:
        return [], "", "VIDEO_ID_REQUIRED", "Parameter 'video_id' wajib diisi."
        
    if not ydl_opts or not isinstance(ydl_opts, dict):
        return [], "", "YDL_OPTS_REQUIRED", "Parameter 'ydl_opts' (konfigurasi yt-dlp) wajib dikirim oleh frontend."

    url = f"https://www.youtube.com/watch?v={video_id}"

    # 1. Percobaan Pertama: Mode Anonim
    opts_anon = ydl_opts.copy()
    opts_anon.pop('cookiefile', None)
    
    first_error_msg = None
    try:
        with yt_dlp.YoutubeDL(opts_anon) as ydl:
            info = ydl.extract_info(url, download=False)
            heatmap = info.get('heatmap') or []
            title = info.get('title') or ""
            if heatmap:
                return heatmap, title, None, None
            first_error_msg = "Heatmap tidak ditemukan. Video ini mungkin belum memiliki data 'Most Replayed'."
    except Exception as e:
        first_error_msg = str(e)

    # 2. Percobaan Kedua: Mode Cookies jika anonim gagal
    if cookie_path and os.path.exists(cookie_path):
        opts_cookies = ydl_opts.copy()
        opts_cookies['cookiefile'] = cookie_path
        # Reset player_client ke web & mweb karena browser cookies (format Netscape)
        # hanya didukung oleh web player, bukan native app (android/ios).
        if 'extractor_args' in opts_cookies and isinstance(opts_cookies['extractor_args'], dict):
            new_ext_args = {k: (v.copy() if isinstance(v, dict) else v) for k, v in opts_cookies['extractor_args'].items()}
            if 'youtube' in new_ext_args and isinstance(new_ext_args['youtube'], dict):
                yt_args = new_ext_args['youtube'].copy()
                yt_args['player_client'] = ['web', 'mweb']
                new_ext_args['youtube'] = yt_args
            opts_cookies['extractor_args'] = new_ext_args
        try:
            with yt_dlp.YoutubeDL(opts_cookies) as ydl:
                info = ydl.extract_info(url, download=False)
                heatmap = info.get('heatmap') or []
                title = info.get('title') or ""
                if not heatmap:
                    second_error = "Heatmap tidak ditemukan. Video ini mungkin belum memiliki data 'Most Replayed'."
                    combined_error = f"[Anonim]: {first_error_msg}\n\n[Cookies]: {second_error}" if first_error_msg else second_error
                    return [], title, "HEATMAP_NOT_FOUND", combined_error
                return heatmap, title, None, None
        except Exception as e:
            second_error = str(e)
            is_limit = any(k in second_error.lower() for k in ["429", "rate limit", "too many requests"])
            is_cookie_err = any(k in second_error.lower() for k in ["403", "forbidden", "access denied", "bot", "captcha", "sign in"])
            if is_limit:
                code = "RATE_LIMIT_EXCEEDED"
            elif is_cookie_err:
                code = "COOKIES_INVALID_OR_EXPIRED"
            else:
                code = "EXTRACTOR_ERROR"
            combined_error = f"[Anonim]: {first_error_msg}\n\n[Cookies]: {second_error}" if first_error_msg else second_error
            return [], "", code, combined_error

    error_msg = first_error_msg or "Heatmap tidak ditemukan. Video ini mungkin belum memiliki data 'Most Replayed'."
    is_limit = any(k in error_msg.lower() for k in ["429", "403", "forbidden", "access denied", "rate limit", "bot", "captcha", "sign in"])
    code = "RATE_LIMIT_EXCEEDED" if is_limit else ("HEATMAP_NOT_FOUND" if "heatmap" in error_msg.lower() else "EXTRACTOR_ERROR")
    return [], "", code, error_msg


def extract_heatmap_data(video_id: str, ydl_opts: dict = None, cookie_path: str = None) -> dict:
    """
    Wrapper fungsi skrip murni yang dipanggil langsung oleh runner.py / Native Module.
    Mengembalikan dictionary hasil atau error terstruktur.
    """
    heatmap, title, code, err = get_raw_heatmap(video_id, ydl_opts or {}, cookie_path)
    if code or err:
        return {
            "status": "error",
            "code": code or "HEATMAP_ERROR",
            "error": err or str(code)
        }
    return {
        "status": "success",
        "title": title,
        "heatmap": heatmap
    }