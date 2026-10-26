import os
import yt_dlp

def get_raw_heatmap(video_id: str, ydl_opts: dict, cookie_path: str = None) -> tuple:
    """
    Ekstrak data mentah heatmap ('Most Replayed') dan title video dari YouTube secara murni pass-through.
    Mengeksekusi sekali jalan (single pass) tanpa retry otomatis:
    - Jika cookie_path valid dikirimkan oleh frontend, gunakan cookies.
    - Jika tidak, jalankan dalam mode anonim.
    
    Returns:
        tuple: (heatmap: list, title: str, code: str | None, error: str | None)
    """
    if not video_id:
        return [], "", "VIDEO_ID_REQUIRED", "Parameter 'video_id' wajib diisi."
        
    if not ydl_opts or not isinstance(ydl_opts, dict):
        return [], "", "YDL_OPTS_REQUIRED", "Parameter 'ydl_opts' (konfigurasi yt-dlp) wajib dikirim oleh frontend."

    url = f"https://www.youtube.com/watch?v={video_id}"

    opts = ydl_opts.copy()
    if cookie_path and os.path.exists(cookie_path):
        opts['cookiefile'] = cookie_path
        # Reset player_client ke web & mweb karena browser cookies (format Netscape)
        # hanya didukung oleh web player, bukan native app (android/ios).
        if 'extractor_args' in opts and isinstance(opts['extractor_args'], dict):
            new_ext_args = {k: (v.copy() if isinstance(v, dict) else v) for k, v in opts['extractor_args'].items()}
            if 'youtube' in new_ext_args and isinstance(new_ext_args['youtube'], dict):
                yt_args = new_ext_args['youtube'].copy()
                yt_args['player_client'] = ['web', 'mweb']
                new_ext_args['youtube'] = yt_args
            opts['extractor_args'] = new_ext_args
    else:
        opts.pop('cookiefile', None)

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
            heatmap = info.get('heatmap') or []
            title = info.get('title') or ""
            if not heatmap:
                return [], title, "HEATMAP_NOT_FOUND", "Heatmap tidak ditemukan. Video ini mungkin belum memiliki data 'Most Replayed'."
            return heatmap, title, None, None
    except Exception as e:
        return [], "", "HEATMAP_ERROR", str(e)


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