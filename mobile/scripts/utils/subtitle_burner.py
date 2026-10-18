import os
import sys
import time
import json
import traceback
import subprocess
import shutil


def format_ass_time(sec: float) -> str:
    """
    Format detik (float) menjadi format waktu ASS: H:MM:SS.cs
    Contoh: 1.25 -> 0:00:01.25, 65.4 -> 0:01:05.40
    """
    if sec is None or sec < 0:
        sec = 0.0
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = sec % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def escape_ffmpeg_filter_path(path: str) -> str:
    r"""
    Escape path file agar aman digunakan pada opsi filter FFmpeg.
    Karakter titik dua (:) pada drive letter Windows dan backslash (\) harus dinormalisasi.
    """
    clean = path.replace("\\", "/")
    clean = clean.replace(":", r"\:")
    clean = clean.replace("'", r"\'")
    clean = clean.replace("[", r"\[").replace("]", r"\]")
    return clean


def resolve_system_font() -> str:
    """
    Mendeteksi font sistem yang tersedia di perangkat (Android, Windows dev, atau Linux).
    Di Android, /system/fonts/Roboto-Bold.ttf tersedia di semua versi Android.
    """
    candidates = [
        "/system/fonts/Roboto-Bold.ttf",
        "/system/fonts/Roboto-Regular.ttf",
        "/system/fonts/DroidSans-Bold.ttf",
        "/system/fonts/DroidSans.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    return None


def is_filter_supported(ffmpeg_bin: str, filter_name: str) -> bool:
    """
    Memeriksa apakah binary FFmpeg yang digunakan memiliki filter tertentu.
    Memeriksa langsung dari simbol binary (ff_vf_<filter>) atau melalui flag -filters.
    """
    try:
        if os.path.isabs(ffmpeg_bin) and os.path.exists(ffmpeg_bin):
            with open(ffmpeg_bin, "rb") as f:
                header = f.read(15 * 1024 * 1024)
                return f"ff_vf_{filter_name}".encode() in header
        res = subprocess.run([ffmpeg_bin, "-filters"], capture_output=True, text=True, timeout=5)
        return f" {filter_name} " in res.stdout or f"\n... {filter_name}" in res.stdout
    except Exception:
        return False


def build_ass_content(cues: list, style: dict = None) -> str:
    r"""
    Mengonversi konfigurasi subtitle JSON (cues & global style) menjadi naskah ASS (Advanced SubStation Alpha).
    ASS adalah standar industri yang didukung oleh filter `subtitles` di FFmpeg libass.
    - Kanvas video: 1920x1080 (16:9 PlayRes)
    - Titik jangkar tengah (Center Anchor: \an5)
    - Posisi X & Y global (0-100 persen)
    - Font scaling dinamis berbasis base 14px mobile UI -> 60px 1080p ASS
    """
    if style is None:
        style = {}

    pos_x_pct = float(style.get("positionX", 50))
    pos_y_pct = float(style.get("positionY", 85))

    # Konversi koordinat persen (0-100) ke pixel kanvas 1080p
    ass_x = int(round((pos_x_pct / 100.0) * 1920))
    ass_y = int(round((pos_y_pct / 100.0) * 1080))

    base_font_size = float(style.get("baseFontSize", 14))
    if base_font_size <= 0:
        base_font_size = 14.0

    ass_base_fs = 60

    ass_header = f"""[Script Info]
Title: Clipped Video Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,{ass_base_fs},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3.5,0,5,20,20,20,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    dialogue_lines = []
    for cue in cues:
        raw_text = str(cue.get("text", "")).strip()
        if not raw_text:
            continue

        start_time = float(cue.get("start", 0))
        end_time = float(cue.get("end", 0))
        if end_time <= start_time:
            end_time = start_time + 1.0

        clean_text = raw_text.replace("\r\n", "\n").replace("\r", "\n").replace("\n", r"\N")

        cue_fs = cue.get("fontSize")
        fs_override_tag = ""
        if cue_fs is not None and isinstance(cue_fs, (int, float)) and cue_fs > 0 and cue_fs != 14:
            scaled_fs = int(round((float(cue_fs) / 14.0) * ass_base_fs))
            fs_override_tag = f"\\fs{scaled_fs}"

        tags = f"\\an5\\pos({ass_x},{ass_y}){fs_override_tag}"
        start_str = format_ass_time(start_time)
        end_str = format_ass_time(end_time)

        dialogue_lines.append(f"Dialogue: 0,{start_str},{end_str},Default,,0,0,0,,{{{tags}}}{clean_text}")

    return ass_header + "\n".join(dialogue_lines) + "\n"


def build_drawtext_pipeline(cues: list, style: dict, output_base: str):
    """
    Membangun filterchain drawtext menggunakan opsi 'textfile' per cue.
    Solusi native FFmpeg saat libass / filter 'subtitles' tidak dikompilasi di binary perangkat.
    - Opsi textfile membaca UTF-8 tanpa kendala escaping karakter khusus/multiline.
    - enable='between(t, start, end)' hanya merender teks pada jendela waktu masing-masing.
    - Koordinat dinamis berbasis persen: x=(w-text_w)*x_pct/100, y=(h-text_h)*y_pct/100.
    - Skala font dinamis: fontsize=h*0.045*(cue_fs/14).
    - Border hitam pekat (borderw=3:bordercolor=black) untuk keterbacaan tinggi.
    """
    temp_files = []
    font_path = resolve_system_font()
    font_opt = f":fontfile='{escape_ffmpeg_filter_path(font_path)}'" if font_path else ""

    pos_x = float(style.get("positionX", 50))
    pos_y = float(style.get("positionY", 85))
    x_expr = "(w-text_w)/2" if abs(pos_x - 50) < 0.1 else f"(w-text_w)*{pos_x/100.0:.3f}"
    y_expr = "(h-text_h)*0.85" if abs(pos_y - 85) < 0.1 else f"(h-text_h)*{pos_y/100.0:.3f}"

    filter_items = []
    for idx, cue in enumerate(cues):
        raw_text = str(cue.get("text", "")).strip()
        if not raw_text:
            continue

        s = max(0.0, float(cue.get("start", 0)))
        e = max(s + 0.1, float(cue.get("end", 0)))

        cue_file = f"{output_base}.cue_{idx}.txt"
        with open(cue_file, "w", encoding="utf-8") as f:
            f.write(raw_text)
        temp_files.append(cue_file)

        esc_cue_file = escape_ffmpeg_filter_path(cue_file)

        cue_fs = float(cue.get("fontSize", 14))
        fs_scale = cue_fs / 14.0 if cue_fs > 0 else 1.0
        fs_expr = f"h*0.045*{fs_scale:.3f}" if abs(fs_scale - 1.0) > 0.05 else "h*0.045"

        item = (
            f"drawtext=textfile='{esc_cue_file}'"
            f"{font_opt}"
            f":fontsize={fs_expr}"
            f":fontcolor=white"
            f":borderw=3:bordercolor=black"
            f":x={x_expr}:y={y_expr}"
            f":enable='between(t,{s:.3f},{e:.3f})'"
        )
        filter_items.append(item)

    script_path = f"{output_base}.fffilter"
    with open(script_path, "w", encoding="utf-8") as f:
        f.write(",\n".join(filter_items))
    temp_files.append(script_path)

    return script_path, temp_files


def burn_subtitles_to_video(
    input_video_path: str,
    output_video_path: str,
    subtitle_data: dict,
    ffmpeg_bin: str = None,
    progress_path: str = None,
    duration: float = None
) -> dict:
    """
    Mengeksekusi penempelan (hardcode burn-in) subtitle ke video klip menggunakan FFmpeg.
    - Menghasilkan file video BARU pada output_video_path.
    - File input asli tetap utuh 100% tanpa modifikasi.
    - Mendukung filter 'subtitles' (libass) dan otomatis fallback ke native 'drawtext' pipeline.
    - Parameter 100% dinamis dipasok oleh frontend.
    - Mengembalikan kode status terstandarisasi.
    """
    # 1. Validasi Parameter Wajib
    if not input_video_path or not os.path.exists(input_video_path):
        return {
            "status": "error",
            "code": "INPUT_VIDEO_NOT_FOUND",
            "error": f"File klip video sumber tidak ditemukan: {input_video_path}"
        }

    if not output_video_path:
        return {
            "status": "error",
            "code": "OUTPUT_PATH_REQUIRED",
            "error": "Parameter 'output_video_path' wajib disertakan."
        }

    # Normalisasi subtitle_data (bisa berupa dict atau string JSON)
    if isinstance(subtitle_data, str):
        try:
            subtitle_data = json.loads(subtitle_data)
        except Exception as e:
            return {
                "status": "error",
                "code": "INVALID_PARAMS",
                "error": f"Format subtitle_data JSON tidak valid: {str(e)}"
            }

    if not subtitle_data or not isinstance(subtitle_data, dict):
        return {
            "status": "error",
            "code": "INVALID_PARAMS",
            "error": "Data subtitle_data wajib berupa objek."
        }

    cues = subtitle_data.get("cues") or []
    if not cues or not isinstance(cues, list) or len(cues) == 0:
        return {
            "status": "error",
            "code": "NO_SUBTITLES_TO_BURN",
            "error": "Daftar cue subtitle kosong."
        }

    # 2. Resolusi Path FFmpeg
    resolved_ffmpeg = ffmpeg_bin
    if not resolved_ffmpeg or not os.path.exists(resolved_ffmpeg):
        try:
            import imageio_ffmpeg
            resolved_ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            resolved_ffmpeg = shutil.which("ffmpeg") or "ffmpeg"

    if os.path.isabs(resolved_ffmpeg):
        ffmpeg_dir = os.path.dirname(resolved_ffmpeg)
        if ffmpeg_dir and ffmpeg_dir not in os.environ.get("PATH", ""):
            os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")

    # 3. Buat Folder Tujuan dan Siapkan File Temporary
    out_dir = os.path.dirname(output_video_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    temp_ass_path = f"{output_video_path}.temp.ass"
    ffmpeg_prog_file = f"{output_video_path}.ffprog"
    ffmpeg_err_file = f"{output_video_path}.fferr"
    temp_files_to_clean = []

    def cleanup_temp_files():
        for p in [temp_ass_path, ffmpeg_prog_file, ffmpeg_err_file] + temp_files_to_clean:
            if os.path.exists(p):
                try:
                    os.remove(p)
                except Exception:
                    pass

    # 4. Tentukan Engine Filter (subtitles/libass vs drawtext)
    subtitles_supported = is_filter_supported(resolved_ffmpeg, "subtitles")
    filter_args = []

    if subtitles_supported:
        try:
            ass_content = build_ass_content(cues, subtitle_data.get("style"))
            with open(temp_ass_path, "w", encoding="utf-8") as f:
                f.write(ass_content)
            escaped_ass = escape_ffmpeg_filter_path(temp_ass_path)
            filter_args = ["-vf", f"subtitles='{escaped_ass}'"]
        except Exception:
            subtitles_supported = False

    if not subtitles_supported:
        # Gunakan native drawtext filter pipeline via -filter_script:v
        script_path, created_files = build_drawtext_pipeline(cues, subtitle_data.get("style", {}), output_video_path)
        temp_files_to_clean.extend(created_files)
        filter_args = ["-filter_script:v", script_path]

    # 5. Estimasi Durasi Klip untuk Progress Tracking
    clip_dur = 0.0
    if duration and float(duration) > 0:
        clip_dur = float(duration)
    else:
        for c in cues:
            end_val = float(c.get("end", 0))
            if end_val > clip_dur:
                clip_dur = end_val

    # Mekanisme Realtime Progress Throttling (250ms)
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
            prog_dir = os.path.dirname(progress_path)
            if prog_dir:
                os.makedirs(prog_dir, exist_ok=True)
            with open(progress_path, "w", encoding="utf-8") as f:
                json.dump({
                    "stage": stage,
                    "code": code,
                    "percent": max(0, min(100, int(percent))),
                    "timestamp": now
                }, f)
        except Exception:
            pass

    write_progress("STAGE_BURN_SUB", "BURNING_SUBTITLES", 5, force=True)

    # 6. Susun Argumen FFmpeg
    ffmpeg_cmd = [
        resolved_ffmpeg,
        "-y",
        "-i", input_video_path,
        *filter_args,
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-c:a", "copy",
        "-progress", ffmpeg_prog_file,
        "-nostats",
        "-loglevel", "warning",
        output_video_path
    ]

    # 7. Eksekusi FFmpeg Subprocess
    try:
        with open(ffmpeg_err_file, "w", encoding="utf-8", errors="replace") as err_f:
            proc = subprocess.Popen(ffmpeg_cmd, stdout=subprocess.DEVNULL, stderr=err_f, text=True)
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
                                dur_us = clip_dur * 1000000.0
                                pct = int((us / dur_us) * 90) + 5 if dur_us > 0 else 50
                                write_progress("STAGE_BURN_SUB", "BURNING_SUBTITLES", pct)
                                break
                    except Exception:
                        pass
            proc.wait(timeout=300)
    except Exception as e_proc:
        cleanup_temp_files()
        return {
            "status": "error",
            "code": "FFMPEG_BURN_ERROR",
            "error": f"Eksekusi FFmpeg burning subtitle gagal: {str(e_proc)}",
            "traceback": traceback.format_exc()
        }

    err_output = ""
    if os.path.exists(ffmpeg_err_file):
        try:
            with open(ffmpeg_err_file, "r", encoding="utf-8", errors="replace") as err_f:
                err_output = err_f.read()
        except Exception:
            pass

    # 8. Fallback Otomatis jika filter 'subtitles' gagal saat runtime
    if proc.returncode != 0 and subtitles_supported and ("No such filter: 'subtitles'" in err_output or "filter" in err_output.lower()):
        # Retry dengan native drawtext filter pipeline
        script_path, created_files = build_drawtext_pipeline(cues, subtitle_data.get("style", {}), output_video_path)
        temp_files_to_clean.extend(created_files)
        fallback_cmd = [
            resolved_ffmpeg,
            "-y",
            "-i", input_video_path,
            "-filter_script:v", script_path,
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-c:a", "copy",
            "-progress", ffmpeg_prog_file,
            "-nostats",
            "-loglevel", "warning",
            output_video_path
        ]
        try:
            with open(ffmpeg_err_file, "w", encoding="utf-8", errors="replace") as err_f:
                proc = subprocess.Popen(fallback_cmd, stdout=subprocess.DEVNULL, stderr=err_f, text=True)
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
                                    dur_us = clip_dur * 1000000.0
                                    pct = int((us / dur_us) * 90) + 5 if dur_us > 0 else 50
                                    write_progress("STAGE_BURN_SUB", "BURNING_SUBTITLES", pct)
                                    break
                        except Exception:
                            pass
                proc.wait(timeout=300)
            if os.path.exists(ffmpeg_err_file):
                with open(ffmpeg_err_file, "r", encoding="utf-8", errors="replace") as err_f:
                    err_output = err_f.read()
        except Exception as e_retry:
            err_output += f"\nRetry drawtext error: {str(e_retry)}"

    cleanup_temp_files()

    if proc.returncode != 0 or not os.path.exists(output_video_path) or os.path.getsize(output_video_path) == 0:
        return {
            "status": "error",
            "code": "FFMPEG_BURN_ERROR",
            "error": f"Penempelan subtitle FFmpeg gagal (exit code {proc.returncode}):\n{err_output}",
            "traceback": err_output or f"Exit code {proc.returncode}"
        }

    write_progress("STAGE_COMPLETE", "COMPLETED", 100, force=True)

    return {
        "status": "success",
        "output_path": output_video_path
    }
