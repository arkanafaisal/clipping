import os
import yt_dlp
from yt_dlp.utils import download_range_func

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def download_youtube_clip_range(
    video_id: str,
    start: float,
    end: float,
    output_path: str,
    ydl_opts: dict = None
) -> tuple:
    """
    Download rentang klip spesifik YouTube secara murni pass-through menggunakan yt-dlp.
    Seluruh konfigurasi parameter dan opsi yt-dlp dikirim secara dinamis oleh frontend.
    
    Returns:
        tuple: (output_path: str | None, code: str | None, error: str | None)
    """
    if not video_id:
        return None, "VIDEO_ID_REQUIRED", "Parameter 'video_id' wajib diisi."
    if start is None or end is None:
        return None, "INVALID_RANGE", "Parameter 'start' dan 'end' wajib disertakan."
    if not output_path:
        return None, "OUTPUT_PATH_REQUIRED", "Parameter 'output_path' wajib disertakan."

    try:
        start_num = float(start)
        end_num = float(end)
    except (ValueError, TypeError):
        return None, "INVALID_RANGE", "Parameter 'start' dan 'end' harus berupa angka waktu valid."

    if end_num <= start_num:
        return None, "INVALID_RANGE", f"Waktu 'end' ({end_num}) harus lebih besar daripada 'start' ({start_num})."

    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    opts = (ydl_opts or {}).copy()
    opts["outtmpl"] = output_path
    opts["download_ranges"] = download_range_func(None, [(start_num, end_num)])
    opts["force_keyframes_at_cuts"] = True

    # Sertakan cookies jika file cookies.txt tersedia
    cookie_path = os.path.join(BASE_DIR, 'cookies.txt')
    if os.path.exists(cookie_path) and 'cookiefile' not in opts:
        opts['cookiefile'] = cookie_path

    url = f"https://www.youtube.com/watch?v={video_id}"
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.download([url])

        if not os.path.exists(output_path):
            return None, "DOWNLOAD_FAILED", f"File output tidak ditemukan di '{output_path}' setelah eksekusi download selesai."

        return output_path, None, None
    except Exception as e:
        error_msg = str(e)
        code = "RATE_LIMIT_EXCEEDED" if ("429" in error_msg or "rate limit" in error_msg.lower()) else "DOWNLOAD_FAILED"
        return None, code, error_msg
