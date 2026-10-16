import os
import json
import yt_dlp
from yt_dlp.utils import download_range_func

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def _is_rate_limit_or_restricted(err_text: str) -> bool:
    if not err_text:
        return False
    msg = str(err_text).lower()
    return any(k in msg for k in [
        "429", "403", "forbidden", "access denied", "rate limit",
        "bot", "sign in to confirm", "confirm you're not a bot", "captcha", "code 8"
    ])

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
        tuple: (output_path: str | None, stream_url: str | None, code: str | None, error: str | None)
    """
    if not video_id:
        return None, None, "VIDEO_ID_REQUIRED", "Parameter 'video_id' wajib diisi."
    if start is None or end is None:
        return None, None, "INVALID_RANGE", "Parameter 'start' dan 'end' wajib disertakan."
    if not output_path:
        return None, None, "OUTPUT_PATH_REQUIRED", "Parameter 'output_path' wajib disertakan."

    try:
        start_num = float(start)
        end_num = float(end)
    except (ValueError, TypeError):
        return None, None, "INVALID_RANGE", "Parameter 'start' dan 'end' harus berupa angka waktu valid."

    if end_num <= start_num:
        return None, None, "INVALID_RANGE", f"Waktu 'end' ({end_num}) harus lebih besar daripada 'start' ({start_num})."

    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    opts = (ydl_opts or {}).copy()
    opts["outtmpl"] = output_path
    opts["download_ranges"] = download_range_func(None, [(start_num, end_num)])
    opts["force_keyframes_at_cuts"] = True

    info_json_path = opts.get("load_info_filename")
    youtube_url = f"https://www.youtube.com/watch?v={video_id}"

    def execute_dl(target_url):
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

        # 2. Mode Cookies (jika anonim gagal & cookie_path tersedia)
        if cookie_path and os.path.exists(cookie_path):
            opts_cookies = opts.copy()
            opts_cookies['cookiefile'] = cookie_path
            try:
                with yt_dlp.YoutubeDL(opts_cookies) as ydl:
                    ydl.download([target_url])
                if os.path.exists(output_path):
                    return True, None
            except Exception as e_cookies:
                return False, str(e_cookies)

        return False, first_err

    # 1. Jika frontend mengirimkan stream_url ter-cache, coba gunakan URL tersebut langsung
    if stream_url:
        success, _ = execute_dl(stream_url)
        if success:
            return output_path, stream_url, None, None
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

    if success and os.path.exists(output_path):
        return output_path, new_stream_url, None, None

    err_text = last_error or "File output tidak ditemukan setelah eksekusi download selesai."
    code = "RATE_LIMIT_EXCEEDED" if _is_rate_limit_or_restricted(err_text) else "DOWNLOAD_FAILED"
    return None, new_stream_url, code, err_text
