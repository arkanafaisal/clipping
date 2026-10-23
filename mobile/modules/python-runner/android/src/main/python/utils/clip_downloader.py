import os
import sys
import time
import json
import traceback
import subprocess
import urllib.request
import http.cookiejar
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
    ydl_opts: dict = None,
    progress_path: str = None,
    source_video_path: str = None
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

    # Kompensasi universal timeline drift HLS vs preview:
    # Tambahkan 500ms (+0.5s) pada rentang akhir agar pemotongan FFmpeg
    # mencakup frame dan audio penutup klip secara presisi tanpa terpotong prematur.
    end_num += 0.5

    # Mekanisme Realtime Progress Throttling (250ms)
    last_write_time = 0.0

    def write_progress(stage: str, code: str, percent: int = 0, force: bool = False):
        nonlocal last_write_time
        if not progress_path:
            return
        now = time.time()
        # Throttled write minimal 250ms interval agar tidak membebani I/O flash memory
        if not force and (now - last_write_time) < 0.25:
            return
        last_write_time = now
        try:
            payload = {
                "stage": stage,
                "code": code,
                "percent": max(0, min(100, int(percent))),
                "time": now
            }
            tmp_prog = f"{progress_path}.tmp"
            with open(tmp_prog, "w", encoding="utf-8") as f:
                json.dump(payload, f)
            if os.path.exists(tmp_prog):
                os.replace(tmp_prog, progress_path)
        except Exception:
            pass

    write_progress("STAGE_INIT", "PREPARING_METADATA", 0, force=True)

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
    temp_v = f"{output_path}.temp_v.ts"
    temp_a = f"{output_path}.temp_a.ts"
    ffmpeg_prog_file = f"{output_path}.ffprog"
    ffmpeg_err_file = f"{output_path}.fferr"

    def cleanup_temp_files():
        """Hapus seluruh file sementara (.temp.mp4, .temp_v.ts, .temp_a.ts, .part, .ffprog, .fferr) agar tidak membebani storage."""
        for p in [
            temp_path, temp_v, temp_a,
            f"{temp_path}.part", f"{temp_v}.part", f"{temp_a}.part", f"{output_path}.part",
            ffmpeg_prog_file, ffmpeg_err_file
        ]:
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

    youtube_url = f"https://www.youtube.com/watch?v={video_id}"
    captured_stream_url = stream_url

    # 3.1. Jalur Cepat: Jika file fisik full video lokal tersedia di shared storage, potong langsung dengan FFmpeg offline
    if source_video_path and os.path.exists(source_video_path) and os.path.getsize(source_video_path) > 0:
        write_progress("STAGE_INIT", "CUTTING_FROM_LOCAL_SOURCE", 0, force=True)
        cut_start = start_num
        cut_dur = end_num - start_num
        fast_seek = max(0.0, cut_start - 10.0)
        rel_start = cut_start - fast_seek

        filter_str = (
            f"[0:v]trim=start={rel_start}:duration={cut_dur},setpts=PTS-STARTPTS[v];"
            f"[0:a]atrim=start={rel_start}:duration={cut_dur},asetpts=PTS-STARTPTS[a]"
        )
        ffmpeg_cut_cmd = [
            ffmpeg_bin, "-y",
            "-ss", str(fast_seek),
            "-i", source_video_path,
            "-filter_complex", filter_str,
            "-map", "[v]",
            "-map", "[a]",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "22",
            "-maxrate", "8M",
            "-bufsize", "12M",
            "-pix_fmt", "yuv420p",
            "-profile:v", "high",
            "-level", "4.2",
            "-movflags", "+faststart",
            "-c:a", "aac",
            "-b:a", "128k",
            "-progress", ffmpeg_prog_file,
            "-nostats",
            "-loglevel", "warning",
            output_path
        ]

        write_progress("STAGE_2_CUT", "STARTING_FFMPEG", 0, force=True)
        try:
            with open(ffmpeg_err_file, "w", encoding="utf-8", errors="replace") as err_f:
                proc = subprocess.Popen(ffmpeg_cut_cmd, stdout=subprocess.DEVNULL, stderr=err_f, text=True)
                while proc.poll() is None:
                    time.sleep(0.25)
                    if os.path.exists(ffmpeg_prog_file):
                        try:
                            with open(ffmpeg_prog_file, "r", encoding="utf-8", errors="replace") as f_p:
                                lines = f_p.read().splitlines()
                            for line in reversed(lines):
                                if line.startswith("out_time_us="):
                                    val = line.split("=")[1].strip()
                                    us = int(val)
                                    dur_us = cut_dur * 1000000.0
                                    pct = int((us / dur_us) * 100) if dur_us > 0 else 50
                                    write_progress("STAGE_2_CUT", "CUTTING_PRECISION", pct)
                                    break
                        except Exception:
                            pass
                proc.wait(timeout=180)
        except Exception as e_proc:
            cleanup_temp_files()
            return {
                "status": "error",
                "code": "FFMPEG_CUT_ERROR",
                "error": f"Eksekusi FFmpeg potong lokal gagal: {str(e_proc)}",
                "traceback": traceback.format_exc(),
                "stream_url": captured_stream_url
            }

        err_output = ""
        if os.path.exists(ffmpeg_err_file):
            try:
                with open(ffmpeg_err_file, "r", encoding="utf-8", errors="replace") as err_f:
                    err_output = err_f.read()
            except Exception:
                pass

        cleanup_temp_files()

        if proc.returncode != 0 or not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
            return {
                "status": "error",
                "code": "FFMPEG_CUT_ERROR",
                "error": f"Pemotongan FFmpeg lokal gagal (exit code {proc.returncode}):\n{err_output}",
                "traceback": err_output or f"Exit code {proc.returncode}",
                "stream_url": captured_stream_url
            }

        write_progress("STAGE_COMPLETE", "COMPLETED", 100, force=True)
        return {
            "status": "success",
            "output_path": output_path,
            "stream_url": captured_stream_url,
            "source": "local_full_video"
        }

    cookies_available = bool(cookie_path and os.path.exists(cookie_path))
    cookies_attempted = False
    captured_errors = []

    stage1_type = None
    stage1_offsets = None

    def make_urllib_request(target_url: str, headers: dict = None, active_cookie: str = None) -> urllib.request.Request:
        req_headers = (headers or {}).copy()
        if active_cookie and os.path.exists(active_cookie):
            try:
                import http.cookiejar
                cj = http.cookiejar.MozillaCookieJar(active_cookie)
                cj.load(ignore_discard=True, ignore_expires=True)
                cookie_strs = []
                for c in cj:
                    if "youtube.com" in c.domain or "googlevideo.com" in c.domain:
                        cookie_strs.append(f"{c.name}={c.value}")
                if cookie_strs:
                    req_headers["Cookie"] = "; ".join(cookie_strs)
            except Exception:
                pass
        return urllib.request.Request(target_url, headers=req_headers)

    def parse_m3u8_playlist(m3u8_url: str, headers: dict = None, active_cookie: str = None) -> list:
        req = make_urllib_request(m3u8_url, headers, active_cookie)
        with urllib.request.urlopen(req, timeout=30) as resp:
            content = resp.read().decode("utf-8", errors="replace")

        # Cek jika playlist adalah master playlist (sub-streams)
        if "#EXT-X-STREAM-INF" in content:
            lines = content.splitlines()
            for idx, l in enumerate(lines):
                if l.startswith("#EXT-X-STREAM-INF"):
                    sub_url = lines[idx + 1].strip()
                    return parse_m3u8_playlist(sub_url, headers, active_cookie)

        segments = []
        elapsed = 0.0
        current_dur = 0.0
        for line in content.splitlines():
            line = line.strip()
            if line.startswith("#EXTINF:"):
                val = line[8:].split(",")[0].strip()
                try:
                    current_dur = float(val)
                except ValueError:
                    current_dur = 0.0
            elif line and not line.startswith("#"):
                segments.append({
                    "url": line,
                    "start": elapsed,
                    "end": elapsed + current_dur,
                    "duration": current_dur
                })
                elapsed += current_dur
        return segments

    def download_file_segments(segments: list, headers: dict, dest_path: str, active_cookie: str = None, start_idx: int = 0, total_segs: int = 1):
        with open(dest_path, "wb") as f_out:
            for seg_idx, s in enumerate(segments):
                current_seg_num = start_idx + seg_idx
                req = make_urllib_request(s["url"], headers, active_cookie)
                with urllib.request.urlopen(req, timeout=30) as resp:
                    cl = resp.headers.get("Content-Length")
                    seg_total = int(cl) if cl and cl.isdigit() else 0
                    seg_bytes = 0
                    while True:
                        chunk = resp.read(65536)
                        if not chunk:
                            break
                        f_out.write(chunk)
                        seg_bytes += len(chunk)
                        if total_segs > 0:
                            frac = (seg_bytes / seg_total) if seg_total > 0 else 0.5
                            pct = int(((current_seg_num + frac) / total_segs) * 100)
                            write_progress("STAGE_1_COPY", "DOWNLOADING_SEGMENTS", pct)
                if total_segs > 0:
                    pct = int(((current_seg_num + 1) / total_segs) * 100)
                    write_progress("STAGE_1_COPY", "DOWNLOADING_SEGMENTS", pct)

    def run_stage1_download(use_cookie: bool) -> bool:
        nonlocal captured_stream_url, cookies_attempted, stage1_type, stage1_offsets
        yt_logger = YtLogger()
        run_opts = opts.copy()
        run_opts["quiet"] = True
        run_opts["no_warnings"] = True
        run_opts["logger"] = yt_logger
        run_opts.pop("download_ranges", None)
        run_opts.pop("external_downloader", None)

        if use_cookie and cookies_available:
            cookies_attempted = True
            run_opts["cookiefile"] = cookie_path
            active_cookie = cookie_path
            # Reset player_client ke web & mweb karena browser cookies (format Netscape)
            # hanya didukung oleh web player, bukan native app (android/ios).
            if "extractor_args" in run_opts and isinstance(run_opts["extractor_args"], dict):
                new_ext = {k: (v.copy() if isinstance(v, dict) else v) for k, v in run_opts["extractor_args"].items()}
                if "youtube" in new_ext and isinstance(new_ext["youtube"], dict):
                    yt_args = new_ext["youtube"].copy()
                    yt_args["player_client"] = ["web", "mweb"]
                    new_ext["youtube"] = yt_args
                run_opts["extractor_args"] = new_ext
        else:
            run_opts.pop("cookiefile", None)
            active_cookie = None

        try:
            write_progress("STAGE_1_COPY", "FETCHING_PLAYLIST", 0, force=True)
            with yt_dlp.YoutubeDL(run_opts) as ydl:
                info = ydl.extract_info(youtube_url, download=False)

            if not info:
                raise Exception("Metadata video tidak dapat diekstrak dari YouTube.")

            formats = info.get("formats", [])

            # 1. Prioritas Utama: Format HLS 1080p / 720p 60fps (MPEG-TS Native Segments)
            hls_v_formats = [
                f for f in formats
                if f.get("protocol") in ("m3u8", "m3u8_native") and f.get("vcodec") != "none" and (f.get("height") or 0) <= 1080
            ]
            hls_v_formats.sort(key=lambda f: (f.get("height") or 0, f.get("fps") or 0), reverse=True)
            v_fmt = hls_v_formats[0] if hls_v_formats else None

            hls_a_formats = [
                f for f in formats
                if f.get("protocol") in ("m3u8", "m3u8_native") and (f.get("acodec") != "none" or f.get("vcodec") == "none")
            ]
            hls_a_formats.sort(key=lambda f: f.get("abr") or 0, reverse=True)
            a_fmt = hls_a_formats[0] if hls_a_formats else None

            if v_fmt and a_fmt:
                v_segs = parse_m3u8_playlist(v_fmt["url"], v_fmt.get("http_headers", {}), active_cookie)
                a_segs = parse_m3u8_playlist(a_fmt["url"], a_fmt.get("http_headers", {}), active_cookie)

                pad = 4.0
                req_s = max(0.0, start_num - pad)
                req_e = end_num + pad

                sel_v = [x for x in v_segs if x["end"] > req_s and x["start"] < req_e]
                sel_a = [x for x in a_segs if x["end"] > req_s and x["start"] < req_e]

                if not sel_v or not sel_a:
                    raise Exception(f"Tidak ada segmen HLS pada rentang {start_num}s - {end_num}s.")

                v_offset = start_num - sel_v[0]["start"]
                a_offset = start_num - sel_a[0]["start"]
                duration = end_num - start_num
                total_segs = len(sel_v) + len(sel_a)

                print(f"[ClipDownloader] Mengunduh {len(sel_v)} segmen video ({v_fmt.get('height')}p {v_fmt.get('fps')}fps) dan {len(sel_a)} segmen audio via Python...")
                download_file_segments(sel_v, v_fmt.get("http_headers", {}), temp_v, active_cookie, start_idx=0, total_segs=total_segs)
                download_file_segments(sel_a, a_fmt.get("http_headers", {}), temp_a, active_cookie, start_idx=len(sel_v), total_segs=total_segs)

                if os.path.exists(temp_v) and os.path.getsize(temp_v) > 0 and os.path.exists(temp_a) and os.path.getsize(temp_a) > 0:
                    captured_stream_url = v_fmt.get("url") or captured_stream_url
                    stage1_type = "hls"
                    stage1_offsets = (v_offset, a_offset, duration)
                    write_progress("STAGE_1_COPY", "COPY_COMPLETED", 100, force=True)
                    return True

            # 2. Alternatif: Format Progressive MP4
            prog_formats = [
                f for f in formats
                if f.get("url") and f.get("vcodec") != "none" and f.get("acodec") != "none" and f.get("ext") == "mp4"
            ]
            if prog_formats:
                prog_fmt = prog_formats[0]
                req = make_urllib_request(prog_fmt["url"], prog_fmt.get("http_headers", {}), active_cookie)
                with urllib.request.urlopen(req, timeout=30) as resp, open(temp_path, "wb") as f_out:
                    cl = resp.headers.get("Content-Length")
                    total_bytes = int(cl) if cl and cl.isdigit() else 0
                    read_bytes = 0
                    while True:
                        chunk = resp.read(65536)
                        if not chunk:
                            break
                        f_out.write(chunk)
                        read_bytes += len(chunk)
                        if total_bytes > 0:
                            pct = int((read_bytes / total_bytes) * 100)
                            write_progress("STAGE_1_COPY", "DOWNLOADING_SEGMENTS", pct)

                if os.path.exists(temp_path) and os.path.getsize(temp_path) > 0:
                    captured_stream_url = prog_fmt.get("url") or captured_stream_url
                    stage1_type = "prog"
                    stage1_offsets = (start_num, 0, end_num - start_num)
                    write_progress("STAGE_1_COPY", "COPY_COMPLETED", 100, force=True)
                    return True

            raise Exception("Tidak ditemukan format video/audio HLS atau progressive yang valid.")

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

    if not stage1_success or not stage1_type:
        full_err_text = "\n\n".join(captured_errors) if captured_errors else "Gagal mengunduh segmen video sementara dari YouTube."
        eval_err = captured_errors[-1].lower() if captured_errors else full_err_text.lower()

        if any(k in eval_err for k in ["429", "rate limit", "too many requests"]):
            code = "RATE_LIMIT_EXCEEDED"
        elif any(k in eval_err for k in ["403", "forbidden", "access denied", "bot", "captcha", "sign in"]):
            code = "COOKIES_INVALID_OR_EXPIRED" if cookies_attempted else "RATE_LIMIT_EXCEEDED"
        elif "requested format is not available" in eval_err:
            code = "FORMAT_NOT_AVAILABLE"
        elif any(k in eval_err for k in ["permission denied", "errno 13", "operation not permitted"]):
            code = "STORAGE_PERMISSION_DENIED"
        else:
            code = "DOWNLOAD_FAILED"

        cleanup_temp_files()
        return {
            "status": "error",
            "code": code,
            "error": full_err_text,
            "traceback": full_err_text,
            "stream_url": captured_stream_url
        }

    # 4. Tahap 2: Pemotongan Presisi Menggunakan FFmpeg 100% Offline dari File Disk Lokal
    # Menggunakan filter_complex (trim + setpts & atrim + asetpts) agar pemotongan
    # benar-benar frame-accurate dan audio-video terkunci sinkron sempurna dari t=0.0s
    # tanpa freeze di awal atau drift/looping di akhir akibat desync PTS container MPEG-TS.
    write_progress("STAGE_2_CUT", "STARTING_FFMPEG", 0, force=True)

    if stage1_type == "hls":
        v_offset, a_offset, cut_dur = stage1_offsets
        filter_str = (
            f"[0:v]trim=start={v_offset}:duration={cut_dur},setpts=PTS-STARTPTS[v];"
            f"[1:a]atrim=start={a_offset}:duration={cut_dur},asetpts=PTS-STARTPTS[a]"
        )
        ffmpeg_cut_cmd = [
            ffmpeg_bin, "-y",
            "-i", temp_v,
            "-i", temp_a,
            "-filter_complex", filter_str,
            "-map", "[v]",
            "-map", "[a]",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "22",
            "-maxrate", "8M",
            "-bufsize", "12M",
            "-pix_fmt", "yuv420p",
            "-profile:v", "high",
            "-level", "4.2",
            "-movflags", "+faststart",
            "-c:a", "aac",
            "-b:a", "128k",
            "-progress", ffmpeg_prog_file,
            "-nostats",
            "-loglevel", "warning",
            output_path
        ]
    else:
        cut_start, _, cut_dur = stage1_offsets
        filter_str = (
            f"[0:v]trim=start={cut_start}:duration={cut_dur},setpts=PTS-STARTPTS[v];"
            f"[0:a]atrim=start={cut_start}:duration={cut_dur},asetpts=PTS-STARTPTS[a]"
        )
        ffmpeg_cut_cmd = [
            ffmpeg_bin, "-y",
            "-i", temp_path,
            "-filter_complex", filter_str,
            "-map", "[v]",
            "-map", "[a]",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "22",
            "-maxrate", "8M",
            "-bufsize", "12M",
            "-pix_fmt", "yuv420p",
            "-profile:v", "high",
            "-level", "4.2",
            "-movflags", "+faststart",
            "-c:a", "aac",
            "-b:a", "128k",
            "-progress", ffmpeg_prog_file,
            "-nostats",
            "-loglevel", "warning",
            output_path
        ]

    try:
        with open(ffmpeg_err_file, "w", encoding="utf-8", errors="replace") as err_f:
            proc = subprocess.Popen(ffmpeg_cut_cmd, stdout=subprocess.DEVNULL, stderr=err_f, text=True)
            while proc.poll() is None:
                time.sleep(0.25)
                if os.path.exists(ffmpeg_prog_file):
                    try:
                        with open(ffmpeg_prog_file, "r", encoding="utf-8", errors="replace") as f_p:
                            lines = f_p.read().splitlines()
                        for line in reversed(lines):
                            if line.startswith("out_time_us="):
                                val = line.split("=")[1].strip()
                                us = int(val)
                                dur_us = cut_dur * 1000000.0
                                pct = int((us / dur_us) * 100) if dur_us > 0 else 50
                                write_progress("STAGE_2_CUT", "CUTTING_PRECISION", pct)
                                break
                    except Exception:
                        pass
            proc.wait(timeout=120)
    except Exception as e_proc:
        cleanup_temp_files()
        return {
            "status": "error",
            "code": "FFMPEG_CUT_ERROR",
            "error": f"Eksekusi FFmpeg gagal: {str(e_proc)}",
            "traceback": traceback.format_exc(),
            "stream_url": captured_stream_url
        }

    err_output = ""
    if os.path.exists(ffmpeg_err_file):
        try:
            with open(ffmpeg_err_file, "r", encoding="utf-8", errors="replace") as err_f:
                err_output = err_f.read()
        except Exception:
            pass

    cleanup_temp_files()

    if proc.returncode != 0 or not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
        return {
            "status": "error",
            "code": "FFMPEG_CUT_ERROR",
            "error": f"Pemotongan FFmpeg gagal (exit code {proc.returncode}):\n{err_output}",
            "traceback": err_output or f"Exit code {proc.returncode}",
            "stream_url": captured_stream_url
        }

    write_progress("STAGE_COMPLETE", "COMPLETED", 100, force=True)

    # 5. Berhasil: Kembalikan Path Hasil dan Stream URL
    return {
        "status": "success",
        "output_path": output_path,
        "stream_url": captured_stream_url
    }


def download_full_video_direct(
    video_id: str,
    output_path: str,
    cookie_path: str = None,
    ydl_opts: dict = None,
    progress_path: str = None,
    proxy_output_path: str = None,
    proxy_ydl_opts: dict = None
) -> dict:
    """
    Mendownload satu video YouTube utuh secara mandiri menggunakan yt-dlp ke shared storage.
    Video di-download dalam format MP4 prime 1080p/720p H.264 + AAC dengan progress tracking realtime.
    Jika proxy_output_path diberikan, otomatis mendownload video proxy 480p (client ios/android)
    untuk pemutaran super ringan di player UI.
    """
    if not video_id:
        return {"status": "error", "code": "VIDEO_ID_REQUIRED", "error": "Parameter 'video_id' wajib diisi."}
    if not output_path:
        return {"status": "error", "code": "OUTPUT_PATH_REQUIRED", "error": "Parameter 'output_path' wajib disertakan."}

    output_dir = os.path.dirname(output_path)
    if output_dir:
        try:
            os.makedirs(output_dir, exist_ok=True)
        except Exception as e:
            return {"status": "error", "code": "STORAGE_PERMISSION_DENIED", "error": f"Gagal membuat direktori tujuan: {str(e)}"}

    last_write_time = 0.0
    def write_progress(stage: str, code: str, percent: int = 0, force: bool = False):
        nonlocal last_write_time
        if not progress_path:
            return
        now = time.time()
        if not force and (now - last_write_time) < 0.25:
            return
        last_write_time = now
        try:
            payload = {"stage": stage, "code": code, "percent": max(0, min(100, int(percent))), "time": now}
            tmp_prog = f"{progress_path}.tmp"
            with open(tmp_prog, "w", encoding="utf-8") as f:
                json.dump(payload, f)
            if os.path.exists(tmp_prog):
                os.replace(tmp_prog, progress_path)
        except Exception:
            pass

    write_progress("STAGE_INIT", "PREPARING_METADATA", 0, force=True)

    opts = (ydl_opts or {}).copy()
    ffmpeg_bin = opts.get("ffmpeg_location") or os.getenv("FFMPEG_BINARY") or "ffmpeg"
    if os.path.isabs(ffmpeg_bin):
        ffmpeg_dir = os.path.dirname(ffmpeg_bin)
        if ffmpeg_dir and ffmpeg_dir not in os.environ.get("PATH", ""):
            os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")

    cookies_available = bool(cookie_path and os.path.exists(cookie_path))
    captured_errors = []

    def ytdl_hook(d):
        if d.get("status") == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            downloaded = d.get("downloaded_bytes") or 0
            pct = int((downloaded / total) * 100) if total > 0 else 0
            write_progress("STAGE_1_COPY", "DOWNLOADING_FULL_VIDEO", pct)
        elif d.get("status") == "finished":
            write_progress("STAGE_2_CUT", "MERGING_STREAMS", 98)

    def run_full_download(use_cookie: bool) -> bool:
        yt_logger = YtLogger()
        run_opts = {
            "format": "bestvideo[ext=mp4][vcodec^=avc1]+bestaudio[ext=m4a]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
            "outtmpl": output_path,
            "merge_output_format": "mp4",
            "ffmpeg_location": ffmpeg_bin,
            "quiet": True,
            "no_warnings": True,
            "continuedl": True,
            "logger": yt_logger,
            "progress_hooks": [ytdl_hook],
            "nocheckcertificate": True,
            "postprocessors": [{
                "key": "FFmpegVideoConvertor",
                "preferedformat": "mp4",
            }],
        }
        if use_cookie and cookies_available:
            run_opts["cookiefile"] = cookie_path

        youtube_url = f"https://www.youtube.com/watch?v={video_id}"
        try:
            with yt_dlp.YoutubeDL(run_opts) as ydl:
                ydl.download([youtube_url])
            if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                return True
            raise Exception("File output tidak terbentuk setelah proses unduh selesai.")
        except Exception as e:
            tail = yt_logger.get_tail()
            err_msg = f"{str(e)}\n\nLog yt-dlp:\n{tail}" if tail else str(e)
            captured_errors.append(f"[{'Cookies' if use_cookie else 'Anonim'}] {err_msg}")
            return False

    # 1. Cek apakah Master 1080p sudah terunduh dan valid (> 1KB)
    master_already_exists = os.path.exists(output_path) and os.path.getsize(output_path) > 1024
    if master_already_exists:
        write_progress("STAGE_1_COPY", "MASTER_ALREADY_EXISTS", 50)
        success = True
    else:
        # Coba Anonim
        success = run_full_download(use_cookie=False)

        # Coba Cookies jika anonim gagal
        if not success and cookies_available:
            success = run_full_download(use_cookie=True)

    if not success or not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
        full_err_text = "\n\n".join(captured_errors) if captured_errors else "Gagal mengunduh video utuh dari YouTube."
        eval_err = captured_errors[-1].lower() if captured_errors else full_err_text.lower()
        if any(k in eval_err for k in ["429", "rate limit", "too many requests"]):
            code = "RATE_LIMIT_EXCEEDED"
        elif any(k in eval_err for k in ["403", "forbidden", "access denied", "bot", "captcha", "sign in"]):
            code = "COOKIES_INVALID_OR_EXPIRED" if cookies_available else "RATE_LIMIT_EXCEEDED"
        elif "requested format is not available" in eval_err:
            code = "FORMAT_NOT_AVAILABLE"
        elif any(k in eval_err for k in ["permission denied", "errno 13", "operation not permitted"]):
            code = "STORAGE_PERMISSION_DENIED"
        else:
            code = "DOWNLOAD_FAILED"
        return {"status": "error", "code": code, "error": full_err_text}

    # 3. Download Proxy Preview 480p (Penyamaran client iOS & Android) jika diminta
    if proxy_output_path:
        proxy_already_exists = os.path.exists(proxy_output_path) and os.path.getsize(proxy_output_path) > 1024
        if proxy_already_exists:
            write_progress("STAGE_PROXY", "PROXY_ALREADY_EXISTS", 98)
        else:
            write_progress("STAGE_PROXY", "DOWNLOADING_PROXY_PREVIEW", 98)
            p_opts = {
                "format": "best[height<=480][ext=mp4]/best[ext=mp4]",
                "outtmpl": proxy_output_path,
                "continuedl": True,
                "quiet": True,
                "no_warnings": True,
                "nocheckcertificate": True,
                "extractor_args": {
                    "youtube": {
                        "player_client": ["ios", "android"],
                    },
                },
            }
            if proxy_ydl_opts and isinstance(proxy_ydl_opts, dict):
                p_opts.update(proxy_ydl_opts)
                p_opts["outtmpl"] = proxy_output_path
                p_opts["continuedl"] = True

            youtube_url = f"https://www.youtube.com/watch?v={video_id}"
            try:
                with yt_dlp.YoutubeDL(p_opts) as ydl:
                    ydl.download([youtube_url])
            except Exception as e_proxy:
                print(f"[FullVideo] Proxy download warning (non-fatal): {str(e_proxy)}")

    write_progress("STAGE_COMPLETE", "COMPLETED", 100, force=True)
    return {
        "status": "success",
        "output_path": output_path,
        "proxy_output_path": proxy_output_path if (proxy_output_path and os.path.exists(proxy_output_path)) else None
    }


def download_youtube_clip_range(
    video_id: str,
    start: float,
    end: float,
    output_path: str,
    ydl_opts: dict = None,
    stream_url: str = None,
    cookie_path: str = None,
    progress_path: str = None,
    source_video_path: str = None
):
    """
    Backward compatibility wrapper yang mendelegasikan pemanggilan ke download_clip_direct.
    """
    res = download_clip_direct(
        video_id=video_id,
        start=start,
        end=end,
        output_path=output_path,
        stream_url=stream_url,
        cookie_path=cookie_path,
        ydl_opts=ydl_opts,
        progress_path=progress_path,
        source_video_path=source_video_path
    )
    if res.get("status") == "success":
        return res.get("output_path"), res.get("stream_url"), None, None, res
    else:
        return None, res.get("stream_url"), res.get("code"), res.get("error"), res

