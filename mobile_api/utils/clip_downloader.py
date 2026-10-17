import os
import json
import yt_dlp
from yt_dlp.utils import download_range_func

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def download_youtube_clip_range(
    video_id: str,
    start: float,
    end: float,
    output_path: str,
    ydl_opts: dict = None,
    stream_url: str = None,
    cookie_path: str = None
) -> tuple:
    """
    Download rentang klip spesifik YouTube secara murni pass-through menggunakan yt-dlp.
    Mencoba mode anonim terlebih dahulu. Jika gagal dan cookie_path valid dikirimkan oleh frontend,
    mencoba sekali lagi menggunakan cookies.
    
    Returns:
        tuple: (output_path: str | None, stream_url: str | None, code: str | None, error: str | None, meta: dict)
    """
    if not video_id:
        return None, None, "VIDEO_ID_REQUIRED", "Parameter 'video_id' wajib diisi.", {}
    if start is None or end is None:
        return None, None, "INVALID_RANGE", "Parameter 'start' dan 'end' wajib disertakan.", {}
    if not output_path:
        return None, None, "OUTPUT_PATH_REQUIRED", "Parameter 'output_path' wajib disertakan.", {}

    try:
        start_num = float(start)
        end_num = float(end)
    except (ValueError, TypeError):
        return None, None, "INVALID_RANGE", "Parameter 'start' dan 'end' harus berupa angka waktu valid.", {}

    if end_num <= start_num:
        return None, None, "INVALID_RANGE", f"Waktu 'end' ({end_num}) harus lebih besar daripada 'start' ({start_num}).", {}

    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    opts = (ydl_opts or {}).copy()
    opts["outtmpl"] = output_path
    opts["download_ranges"] = download_range_func(None, [(start_num, end_num)])
    opts["force_keyframes_at_cuts"] = True

    info_json_path = opts.get("load_info_filename")
    youtube_url = f"https://www.youtube.com/watch?v={video_id}"

    cookies_attempted = False
    cookies_file_exists = bool(cookie_path and os.path.exists(cookie_path))
    anon_error = None
    cookies_error = None

    def execute_dl(target_url):
        nonlocal cookies_attempted, anon_error, cookies_error
        # 1. Mode Anonim (tanpa cookies)
        opts_anon = opts.copy()
        opts_anon.pop('cookiefile', None)
        first_err = None
        try:
            with yt_dlp.YoutubeDL(opts_anon) as ydl:
                ydl.download([target_url])
            if os.path.exists(output_path):
                return True, None
        except Exception as e_anon:
            first_err = str(e_anon)
            anon_error = first_err

        # 2. Mode Cookies (jika anonim gagal & cookie_path tersedia di disk server)
        if cookie_path and cookies_file_exists:
            cookies_attempted = True
            opts_cookies = opts.copy()
            opts_cookies['cookiefile'] = cookie_path
            try:
                with yt_dlp.YoutubeDL(opts_cookies) as ydl:
                    ydl.download([target_url])
                if os.path.exists(output_path):
                    return True, None
            except Exception as e_cookies:
                cookies_error = str(e_cookies)
                return False, cookies_error

        return False, first_err

    # 1. Jika frontend mengirimkan stream_url ter-cache, coba gunakan URL tersebut langsung
    if stream_url:
        success, _ = execute_dl(stream_url)
        if success:
            meta = {
                "cookies_attempted": cookies_attempted,
                "cookies_file_exists": cookies_file_exists,
                "cookies_path": cookie_path
            }
            return output_path, stream_url, None, None, meta
        # Jika stream_url gagal atau kedaluwarsa, lanjut fallback ke get baru dari YouTube

    # 2. Get baru dari YouTube (jika tanpa cache atau jika stream_url kedaluwarsa)
    success, last_error = execute_dl(youtube_url)

    # Ekstraksi URL baru yang segar untuk dikembalikan ke frontend
    new_stream_url = None
    gen_info = output_path.rsplit(".", 1)[0] + ".info.json"
    target_info = info_json_path if (info_json_path and os.path.exists(info_json_path)) else (gen_info if os.path.exists(gen_info) else None)
    if target_info and os.path.exists(target_info):
        try:
            with open(target_info, 'r', encoding='utf-8') as f:
                info_data = json.load(f)
                new_stream_url = info_data.get('url') or (info_data.get('formats', [{}])[-1].get('url'))
        except Exception:
            pass

    meta = {
        "cookies_attempted": cookies_attempted,
        "cookies_file_exists": cookies_file_exists,
        "cookies_path": cookie_path,
        "anon_error": anon_error,
        "cookies_error": cookies_error
    }

    if success and os.path.exists(output_path):
        return output_path, new_stream_url, None, None, meta

    code = "COOKIES_INVALID_OR_EXPIRED" if cookies_attempted else "DOWNLOAD_FAILED"
    err_text = cookies_error if cookies_attempted else (anon_error or last_error or "File output tidak ditemukan setelah eksekusi download selesai.")
    return None, new_stream_url, code, err_text, meta
