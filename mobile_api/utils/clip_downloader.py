import os
import json
import urllib.parse
import subprocess
import yt_dlp
from yt_dlp.utils import download_range_func

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class YtLogger:
    """
    Logger kustom untuk menangkap seluruh log output, warning, dan stderr dari yt-dlp dan FFmpeg.
    Mencegah hilangnya detail error (seperti pada kasus Exit Code 8) dan menyajikannya ke frontend.
    """
    def __init__(self):
        self.logs = []

    def debug(self, msg):
        self.logs.append(str(msg))

    def warning(self, msg):
        self.logs.append(f"[WARN] {msg}")

    def error(self, msg):
        self.logs.append(f"[ERROR] {msg}")

    def get_tail(self, count=25):
        return "\n".join(self.logs[-count:]) if self.logs else ""


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
    Download rentang klip spesifik YouTube secara murni pass-through.
    
    Arsitektur Opsi 2 (Anti-Exit Code 8):
    1. Metode Utama: Localhost Proxy Range Cut (Python Range Proxy -> FFmpeg Localhost Cut).
       FFmpeg membaca dari http://127.0.0.1:8080/api/proxy_stream?url=...
       Python requests yang menyedot range chunk dari Google Video CDN dengan SSL/headers lengkap,
       sehingga FFmpeg tidak pernah menyentuh internet langsung dan terbebas dari Exit Code 8.
    2. Metode Fallback: 2-Tahap Download Stream Sementara -> Offline FFmpeg Cut.
    3. Error Logging Lengkap: Menangkap seluruh stderr FFmpeg & yt-dlp untuk modal debug frontend.
    
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
    ffmpeg_bin = opts.get("ffmpeg_location") or os.getenv("FFMPEG_BINARY") or "ffmpeg"
    server_port = os.getenv("PORT", "3006")
    youtube_url = f"https://www.youtube.com/watch?v={video_id}"

    cookies_file_exists = bool(cookie_path and os.path.exists(cookie_path))
    cookies_attempted = False
    captured_errors = []

    # Ekstraksi konfigurasi encoder dari opts jika dikirim frontend (100% re-encode untuk presisi frame-by-frame)
    encoder_args = list(opts.get("external_downloader_args", {}).get("ffmpeg") or [
        "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-avoid_negative_ts", "make_zero", "-loglevel", "warning"
    ])
    if "-c:a" not in encoder_args:
        encoder_args.extend(["-c:a", "aac"])
    if "-avoid_negative_ts" not in encoder_args:
        encoder_args.extend(["-avoid_negative_ts", "make_zero"])

    # Helper untuk memanggil FFmpeg via Local Proxy (Metode Utama Opsi 2)
    def try_proxy_clipping(target_info):
        formats = target_info.get("formats", [])
        if not formats:
            return False, "Tidak ada daftar format yang ditemukan dari YouTube.", None

        v_fmt = None
        a_fmt = None
        prog_fmt = None

        # 1. Cari progressive MP4 sebagai alternatif
        for f in formats:
            if f.get("url") and f.get("vcodec") != "none" and f.get("acodec") != "none" and f.get("ext") == "mp4":
                prog_fmt = f

        # 2. Cari format video Prime (DASH video up to 1080p, prioritizing 1080p 60fps MP4/AVC)
        dash_v_formats = [
            f for f in formats
            if f.get("url") and f.get("vcodec") != "none" and f.get("acodec") == "none" and (f.get("height") or 0) <= 1080
        ]
        if dash_v_formats:
            def v_score(f):
                h = f.get("height") or 0
                fps = f.get("fps") or 0
                is_mp4 = 1 if (f.get("ext") == "mp4" or "avc" in (f.get("vcodec") or "").lower()) else 0
                tbr = f.get("tbr") or 0
                return (h, fps, is_mp4, tbr)
            dash_v_formats.sort(key=v_score, reverse=True)
            v_fmt = dash_v_formats[0]

        # 3. Cari format audio Prime (DASH AAC / Opus)
        dash_a_formats = [
            f for f in formats
            if f.get("url") and f.get("acodec") != "none" and f.get("vcodec") == "none"
        ]
        if dash_a_formats:
            def a_score(f):
                abr = f.get("abr") or 0
                is_m4a = 1 if (f.get("ext") == "m4a" or "mp4a" in (f.get("acodec") or "").lower()) else 0
                return (abr, is_m4a)
            dash_a_formats.sort(key=a_score, reverse=True)
            a_fmt = dash_a_formats[0]

        proxy_base = f"http://127.0.0.1:{server_port}/api/proxy_stream"
        chosen_stream_url = None
        cookie_arg = f"&cookie_path={urllib.parse.quote(cookie_path)}" if (cookie_path and cookies_file_exists) else ""
        duration = end_num - start_num

        if v_fmt and a_fmt:
            chosen_stream_url = v_fmt["url"]
            v_ua = (v_fmt.get("http_headers") or {}).get("User-Agent") or ""
            a_ua = (a_fmt.get("http_headers") or {}).get("User-Agent") or ""
            v_ua_arg = f"&ua={urllib.parse.quote(v_ua)}" if v_ua else ""
            a_ua_arg = f"&ua={urllib.parse.quote(a_ua)}" if a_ua else ""
            v_in = f"{proxy_base}?url={urllib.parse.quote(v_fmt['url'], safe='')}{cookie_arg}{v_ua_arg}"
            a_in = f"{proxy_base}?url={urllib.parse.quote(a_fmt['url'], safe='')}{cookie_arg}{a_ua_arg}"
            cmd = [
                ffmpeg_bin, "-y",
                "-ss", str(start_num), "-t", str(duration), "-i", v_in,
                "-ss", str(start_num), "-t", str(duration), "-i", a_in,
                *encoder_args,
                output_path
            ]
        elif prog_fmt:
            chosen_stream_url = prog_fmt["url"]
            prog_ua = (prog_fmt.get("http_headers") or {}).get("User-Agent") or ""
            prog_ua_arg = f"&ua={urllib.parse.quote(prog_ua)}" if prog_ua else ""
            prog_in = f"{proxy_base}?url={urllib.parse.quote(prog_fmt['url'], safe='')}{cookie_arg}{prog_ua_arg}"
            cmd = [
                ffmpeg_bin, "-y",
                "-ss", str(start_num), "-t", str(duration), "-i", prog_in,
                *encoder_args,
                output_path
            ]
        else:
            return False, "Tidak ditemukan format video/audio yang memiliki direct URL.", None

        try:
            print(f"[ClipEngine] Executing Localhost Proxy Range Cut (Start: {start_num}s, End: {end_num}s)...")
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            if res.returncode == 0 and os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                print(f"[ClipEngine] Proxy clipping success! File size: {os.path.getsize(output_path)} bytes")
                return True, None, chosen_stream_url
            else:
                stderr_msg = res.stderr or f"FFmpeg exited with code {res.returncode}"
                return False, f"Proxy FFmpeg gagal (exit code {res.returncode}):\n{stderr_msg}", chosen_stream_url
        except Exception as e_proc:
            return False, f"Eksekusi FFmpeg proxy gagal: {str(e_proc)}", chosen_stream_url

    # Ekstraksi Metadata YouTube & Jalankan Proxy Clipping
    def run_pipeline(use_cookie=False):
        nonlocal cookies_attempted
        yt_logger = YtLogger()
        extract_opts = opts.copy()
        extract_opts.pop("download_ranges", None)
        extract_opts["logger"] = yt_logger
        extract_opts["quiet"] = True

        if use_cookie and cookies_file_exists:
            cookies_attempted = True
            extract_opts["cookiefile"] = cookie_path
        else:
            extract_opts.pop("cookiefile", None)

        try:
            with yt_dlp.YoutubeDL(extract_opts) as ydl:
                info = ydl.extract_info(youtube_url, download=False)
            
            # Coba Metode Utama (Proxy Range Cut)
            success, err_msg, ret_url = try_proxy_clipping(info)
            if success:
                return True, None, ret_url
            
            tail_log = yt_logger.get_tail()
            full_err = f"{err_msg}\n--- Log yt-dlp ---\n{tail_log}" if tail_log else err_msg
            return False, full_err, ret_url

        except Exception as e_extract:
            tail_log = yt_logger.get_tail()
            full_err = f"{str(e_extract)}\n--- Log yt-dlp ---\n{tail_log}" if tail_log else str(e_extract)
            return False, full_err, None

    # 1. Coba Mode Anonim terlebih dahulu
    success, last_err, result_url = run_pipeline(use_cookie=False)
    if success and os.path.exists(output_path):
        meta = {
            "cookies_attempted": cookies_attempted,
            "cookies_file_exists": cookies_file_exists,
            "cookies_path": cookie_path
        }
        return output_path, result_url, None, None, meta

    captured_errors.append(f"[Anonim] {last_err}")

    # 2. Jika anonim gagal & cookie_path tersedia di disk server, coba Mode Cookies
    if cookie_path and cookies_file_exists:
        print("[ClipEngine] Mode anonim gagal, mencoba kembali dengan cookies...")
        success, last_err, result_url = run_pipeline(use_cookie=True)
        if success and os.path.exists(output_path):
            meta = {
                "cookies_attempted": True,
                "cookies_file_exists": cookies_file_exists,
                "cookies_path": cookie_path
            }
            return output_path, result_url, None, None, meta
        captured_errors.append(f"[Cookies] {last_err}")

    # 3. Fallback Tradisional yt-dlp jika Proxy mengalami kendala
    print("[ClipEngine] Proxy clipping gagal, mencoba fallback standar yt-dlp...")
    fallback_logger = YtLogger()
    fallback_opts = opts.copy()
    fallback_opts["outtmpl"] = output_path
    fallback_opts["download_ranges"] = download_range_func(None, [(start_num, end_num)])
    fallback_opts["force_keyframes_at_cuts"] = True
    fallback_opts["logger"] = fallback_logger

    if cookie_path and cookies_file_exists:
        fallback_opts["cookiefile"] = cookie_path

    try:
        with yt_dlp.YoutubeDL(fallback_opts) as ydl:
            ydl.download([youtube_url])
        if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
            meta = {
                "cookies_attempted": cookies_attempted,
                "cookies_file_exists": cookies_file_exists,
                "cookies_path": cookie_path
            }
            return output_path, result_url, None, None, meta
    except Exception as e_fb:
        captured_errors.append(f"[Fallback] {str(e_fb)}\n{fallback_logger.get_tail()}")

    # Format detail error lengkap untuk ditampilkan pada debug modal frontend
    final_error_detail = "\n\n".join(captured_errors)
    code = "COOKIES_INVALID_OR_EXPIRED" if cookies_attempted else "DOWNLOAD_FAILED"
    meta = {
        "cookies_attempted": cookies_attempted,
        "cookies_file_exists": cookies_file_exists,
        "cookies_path": cookie_path
    }
    return None, result_url, code, final_error_detail, meta


def download_clip_direct(
    video_id: str,
    start: float,
    end: float,
    output_path: str,
    ydl_opts: dict = None,
    stream_url: str = None,
    cookie_path: str = None
) -> dict:
    """
    Wrapper fungsi skrip murni yang dipanggil langsung oleh runner.py / Native Module.
    Mengembalikan dictionary hasil atau error terstruktur.
    """
    path, ret_url, code, err, meta = download_youtube_clip_range(
        video_id=video_id,
        start=start,
        end=end,
        output_path=output_path,
        ydl_opts=ydl_opts or {},
        stream_url=stream_url,
        cookie_path=cookie_path
    )
    if code or err:
        res = {
            "status": "error",
            "code": code or "DOWNLOAD_FAILED",
            "error": err or str(code),
            "stream_url": ret_url
        }
        if meta:
            res.update(meta)
        return res

    res = {
        "status": "success",
        "output_path": path,
        "stream_url": ret_url
    }
    if meta:
        res.update(meta)
    return res

