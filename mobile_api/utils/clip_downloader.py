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

    source_url = stream_url if stream_url else f"https://www.youtube.com/watch?v={video_id}"
    extracted_stream_url = stream_url
    info_json_path = opts.get("load_info_filename")

    # 1. Percobaan Pertama: Mode Anonim (tanpa cookies)
    opts_anon = opts.copy()
    opts_anon.pop('cookiefile', None)

    first_error_msg = None
    try:
        with yt_dlp.YoutubeDL(opts_anon) as ydl:
            ydl.download([source_url])

        if os.path.exists(output_path):
            if not extracted_stream_url and info_json_path and os.path.exists(info_json_path):
                try:
                    with open(info_json_path, 'r', encoding='utf-8') as f:
                        info_data = json.load(f)
                        extracted_stream_url = info_data.get('url') or (info_data.get('formats', [{}])[-1].get('url'))
                except Exception:
                    pass
            return output_path, extracted_stream_url, None, None
    except Exception as e_anon:
        first_error_msg = str(e_anon)

    # 2. Percobaan Kedua: Mode Cookies jika percobaan pertama gagal & cookie_path dikirim oleh frontend
    if cookie_path and os.path.exists(cookie_path):
        opts_cookies = opts.copy()
        opts_cookies['cookiefile'] = cookie_path
        try:
            with yt_dlp.YoutubeDL(opts_cookies) as ydl:
                ydl.download([source_url])

            if os.path.exists(output_path):
                if not extracted_stream_url and info_json_path and os.path.exists(info_json_path):
                    try:
                        with open(info_json_path, 'r', encoding='utf-8') as f:
                            info_data = json.load(f)
                            extracted_stream_url = info_data.get('url') or (info_data.get('formats', [{}])[-1].get('url'))
                    except Exception:
                        pass
                return output_path, extracted_stream_url, None, None
        except Exception as e_cookies:
            error_msg = str(e_cookies)
            code = "RATE_LIMIT_EXCEEDED" if ("429" in error_msg or "rate limit" in error_msg.lower()) else "DOWNLOAD_FAILED"
            return None, extracted_stream_url, code, error_msg

    error_msg = first_error_msg or "File output tidak ditemukan setelah eksekusi download selesai."
    code = "RATE_LIMIT_EXCEEDED" if ("429" in error_msg or "rate limit" in error_msg.lower()) else "DOWNLOAD_FAILED"
    return None, extracted_stream_url, code, error_msg
