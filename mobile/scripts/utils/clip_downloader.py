import os
import sys
import traceback
import subprocess
import yt_dlp
from yt_dlp.utils import download_range_func


class YtLogger:
    """
    Logger untuk menangkap seluruh output, warning, dan error dari yt-dlp & FFmpeg
    agar dapat disajikan 100% mentah ke modal debug frontend tanpa terpotong.
    """
    def __init__(self):
        self.logs = []

    def debug(self, msg):
        self.logs.append(str(msg))

    def warning(self, msg):
        self.logs.append(f"[WARN] {msg}")

    def error(self, msg):
        self.logs.append(f"[ERROR] {msg}")

    def get_tail(self, count=40):
        return "\n".join(self.logs[-count:]) if self.logs else ""


def download_clip_direct(
    video_id: str,
    start: float,
    end: float,
    output_path: str,
    stream_url: str = None,
    cookie_path: str = None,
    ydl_opts: dict = None
) -> dict:
    """
    Mendownload satu klip video YouTube secara mandiri menggunakan metode 2-tahap:
    1. Tahap 1: Unduh segmen temporary dengan rentang yang diperluas (keyframe terdekat / copy mode cepat).
    2. Tahap 2: Potong offline secara presisi (frame-accurate) menggunakan FFmpeg re-encode ke lokasi tujuan akhir.
    3. Cleanup: Hapus file temporary dan kembalikan URL stream (aktif/diperbarui) ke frontend.
    """
    # 1. Validasi Properti Wajib di Awal
    if not video_id:
        return {
            "status": "error",
            "code": "VIDEO_ID_REQUIRED",
            "error": "Parameter 'video_id' wajib diisi."
        }

    if not output_path:
        return {
            "status": "error",
            "code": "OUTPUT_PATH_REQUIRED",
            "error": "Parameter 'output_path' wajib disertakan."
        }

    try:
        start_num = float(start)
        end_num = float(end)
    except (ValueError, TypeError):
        return {
            "status": "error",
            "code": "INVALID_RANGE",
            "error": "Parameter 'start' dan 'end' harus berupa angka waktu yang valid."
        }

    if start_num < 0:
        start_num = 0.0

    if end_num <= start_num:
        return {
            "status": "error",
            "code": "INVALID_RANGE",
            "error": f"Waktu 'end' ({end_num}) harus lebih besar daripada 'start' ({start_num})."
        }

    # 2. Persiapan Direktori Tujuan & File Temporary
    output_dir = os.path.dirname(output_path)
    if output_dir:
        try:
            os.makedirs(output_dir, exist_ok=True)
        except Exception as e:
            return {
                "status": "error",
                "code": "STORAGE_PERMISSION_DENIED",
                "error": f"Gagal membuat direktori tujuan '{output_dir}': {str(e)}",
                "traceback": traceback.format_exc()
            }

    temp_path = f"{output_path}.temp.mp4"

    def cleanup_temp_files():
        """Hapus seluruh file sementara (.temp.mp4, .part) agar tidak membebani storage."""
        for p in [temp_path, f"{temp_path}.part", f"{output_path}.part"]:
            if os.path.exists(p):
                try:
                    os.remove(p)
                except Exception:
                    pass

    # Bersihkan file temporary sisa proses sebelumnya jika ada
    cleanup_temp_files()

    # 3. Konfigurasi FFmpeg Binary
    opts = (ydl_opts or {}).copy()
    ffmpeg_bin = (
        opts.get("ffmpeg_location")
        or os.getenv("FFMPEG_BINARY")
        or "ffmpeg"
    )

    if os.path.isabs(ffmpeg_bin):
        ffmpeg_dir = os.path.dirname(ffmpeg_bin)
        if ffmpeg_dir and ffmpeg_dir not in os.environ.get("PATH", ""):
            os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")

    # Daftarkan binary ffmpeg kustom (misal: libffmpeg.so pada Android native) ke yt-dlp
    # agar dikenali oleh FFmpegFD dan FFmpegPostProcessor saat mengunduh time ranges
    try:
        from yt_dlp.downloader.external import FFmpegFD
        from yt_dlp.postprocessor.ffmpeg import FFmpegPostProcessor

        FFmpegFD.available = classmethod(lambda cls, path=None: True)
        FFmpegFD.EXE_NAME = ffmpeg_bin

        original_determine = FFmpegPostProcessor._determine_executables
        def _patched_determine_executables(self):
            paths = original_determine(self)
            if ffmpeg_bin:
                paths["ffmpeg"] = ffmpeg_bin
            return paths
        FFmpegPostProcessor._determine_executables = _patched_determine_executables
    except Exception as e_patch:
        print(f"[ClipDownloader] Warning patch ffmpeg: {e_patch}")

    # 4. Perhitungan Rentang Keyframe Diperluas (Stage 1)
    # Rentang dimundurkan 5 detik dan dimajukan 5 detik agar keyframe utuh tercakup
    EXPAND_OFFSET = 5.0
    expanded_start = max(0.0, start_num - EXPAND_OFFSET)
    expanded_end = end_num + EXPAND_OFFSET

    # 5. Persiapan yt-dlp Options untuk Download Temporary (Copy Method)
    yt_logger = YtLogger()
    opts["outtmpl"] = temp_path
    opts["download_ranges"] = download_range_func(None, [(expanded_start, expanded_end)])
    opts["force_keyframes_at_cuts"] = True
    opts["ffmpeg_location"] = ffmpeg_bin
    opts["external_downloader"] = {"default": "ffmpeg"}
    opts["logger"] = yt_logger
    opts["quiet"] = False
    opts["no_warnings"] = True

    # External downloader args untuk stream reconnect dan copy tanpa re-encode
    ext_args = opts.get("external_downloader_args", {})
    if not isinstance(ext_args, dict):
        ext_args = {}

    ffmpeg_i_args = list(ext_args.get("ffmpeg_i") or [
        "-reconnect", "1",
        "-reconnect_streamed", "1",
        "-reconnect_delay_max", "5",
    ])
    ffmpeg_args = list(ext_args.get("ffmpeg") or [
        "-c", "copy",
        "-loglevel", "warning"
    ])
    opts["external_downloader_args"] = {
        "ffmpeg_i": ffmpeg_i_args,
        "ffmpeg": ffmpeg_args
    }

    if "format" not in opts:
        opts["format"] = "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best"
    opts["merge_output_format"] = "mp4"

    # Penyamaran client default jika belum diset dari frontend
    if "extractor_args" not in opts:
        opts["extractor_args"] = {
            "youtube": {
                "player_client": ["ios", "android"],
            }
        }

    youtube_url = f"https://www.youtube.com/watch?v={video_id}"
    captured_stream_url = stream_url
    cookies_available = bool(cookie_path and os.path.exists(cookie_path))
    cookies_attempted = False
    captured_errors = []

    def run_stage1_download(use_cookie: bool) -> bool:
        nonlocal captured_stream_url, cookies_attempted
        run_opts = opts.copy()
        if use_cookie and cookies_available:
            cookies_attempted = True
            run_opts["cookiefile"] = cookie_path
        else:
            run_opts.pop("cookiefile", None)

        try:
            with yt_dlp.YoutubeDL(run_opts) as ydl:
                info = ydl.extract_info(youtube_url, download=True)
                if info:
                    # Tangkap direct URL dari format yang dipilih
                    req_fmts = info.get("requested_formats")
                    if req_fmts and len(req_fmts) > 0:
                        captured_stream_url = req_fmts[0].get("url") or captured_stream_url
                    else:
                        captured_stream_url = info.get("url") or captured_stream_url

            return os.path.exists(temp_path) and os.path.getsize(temp_path) > 0
        except Exception as e:
            tail = yt_logger.get_tail()
            err_msg = f"{str(e)}\n\nLog yt-dlp:\n{tail}" if tail else str(e)
            captured_errors.append(f"[{'Cookies' if use_cookie else 'Anonim'}] {err_msg}")
            return False

    # Percobaan 1: Mode Anonim
    stage1_success = run_stage1_download(use_cookie=False)

    # Percobaan 2: Mode Cookies jika anonim gagal dan file cookies tersedia
    if not stage1_success and cookies_available:
        print("[ClipDownloader] Unduhan anonim gagal, mencoba kembali dengan cookies...")
        stage1_success = run_stage1_download(use_cookie=True)

    if not stage1_success or not os.path.exists(temp_path) or os.path.getsize(temp_path) == 0:
        full_err_text = "\n\n".join(captured_errors) if captured_errors else "Gagal mengunduh segmen video sementara dari YouTube."
        lower_err = full_err_text.lower()

        if any(k in lower_err for k in ["429", "rate limit", "too many requests"]):
            code = "RATE_LIMIT_EXCEEDED"
        elif any(k in lower_err for k in ["403", "forbidden", "access denied", "bot", "captcha", "sign in"]):
            code = "COOKIES_INVALID_OR_EXPIRED" if cookies_attempted else "RATE_LIMIT_EXCEEDED"
        elif "requested format is not available" in lower_err:
            code = "FORMAT_NOT_AVAILABLE"
        elif any(k in lower_err for k in ["permission denied", "errno 13", "operation not permitted"]):
            code = "STORAGE_PERMISSION_DENIED"
        else:
            code = "DOWNLOAD_FAILED"

        # Bersihkan file temporary jika unduhan tahap 1 gagal
        cleanup_temp_files()
        return {
            "status": "error",
            "code": code,
            "error": full_err_text,
            "traceback": full_err_text,
            "stream_url": captured_stream_url
        }

    # 6. Tahap 2: Pemotongan Presisi Menggunakan FFmpeg (Offline Re-encode)
    cut_start = start_num - expanded_start
    cut_duration = end_num - start_num

    ffmpeg_cut_cmd = [
        ffmpeg_bin, "-y",
        "-ss", str(cut_start),
        "-t", str(cut_duration),
        "-i", temp_path,
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-c:a", "aac",
        "-avoid_negative_ts", "make_zero",
        "-loglevel", "warning",
        output_path
    ]

    try:
        proc = subprocess.run(ffmpeg_cut_cmd, capture_output=True, text=True, timeout=120)
    except Exception as e_proc:
        return {
            "status": "error",
            "code": "FFMPEG_CUT_ERROR",
            "error": f"Eksekusi FFmpeg gagal: {str(e_proc)}",
            "traceback": traceback.format_exc(),
            "stream_url": captured_stream_url
        }
    finally:
        # Bersihkan file temporary (.temp.mp4, .part) secara otomatis setelah pemotongan selesai
        cleanup_temp_files()

    if proc.returncode != 0 or not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
        return {
            "status": "error",
            "code": "FFMPEG_CUT_ERROR",
            "error": f"Pemotongan FFmpeg gagal (exit code {proc.returncode}):\n{proc.stderr or ''}",
            "traceback": proc.stderr or f"Exit code {proc.returncode}",
            "stream_url": captured_stream_url
        }

    # 7. Berhasil: Kembalikan Path Hasil dan Stream URL (Baik Sama Maupun Baru)
    return {
        "status": "success",
        "output_path": output_path,
        "stream_url": captured_stream_url
    }
