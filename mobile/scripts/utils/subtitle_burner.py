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
    Escape path file agar aman digunakan pada opsi filter FFmpeg (subtitles='path').
    Karakter titik dua (:) pada drive letter Windows dan backslash (\) harus dinormalisasi.
    """
    clean = path.replace("\\", "/")
    clean = clean.replace(":", r"\:")
    clean = clean.replace("'", r"\'")
    clean = clean.replace("[", r"\[").replace("]", r"\]")
    return clean


def build_ass_content(cues: list, style: dict = None) -> str:
    r"""
    Mengonversi konfigurasi subtitle JSON (cues & global style) menjadi naskah ASS (Advanced SubStation Alpha).
    ASS adalah standar industri yang didukung penuh oleh filter `subtitles` di FFmpeg libass.
    - Kanvas video: 1920x1080 (16:9 PlayRes)
    - Titik jangkar tengah (Center Anchor: \\an5)
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

    # Base font size di kanvas 1080p (skala proporsional terhadap preview mobile 14px)
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

        # Ganti baris baru menjadi tag ASS \\N
        clean_text = raw_text.replace("\r\n", "\n").replace("\r", "\n").replace("\n", r"\N")

        # Hitung font size override jika ada
        cue_fs = cue.get("fontSize")
        fs_override_tag = ""
        if cue_fs is not None and isinstance(cue_fs, (int, float)) and cue_fs > 0 and cue_fs != 14:
            scaled_fs = int(round((float(cue_fs) / 14.0) * ass_base_fs))
            fs_override_tag = f"\\fs{scaled_fs}"

        # Posisi titik pusat (\\an5 = center anchor)
        tags = f"\\an5\\pos({ass_x},{ass_y}){fs_override_tag}"

        start_str = format_ass_time(start_time)
        end_str = format_ass_time(end_time)

        dialogue_lines.append(f"Dialogue: 0,{start_str},{end_str},Default,,0,0,0,,{{{tags}}}{clean_text}")

    return ass_header + "\n".join(dialogue_lines) + "\n"


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
        # Fallback ke imageio_ffmpeg jika ada (lingkungan dev PC)
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

    def cleanup_temp_files():
        for p in [temp_ass_path, ffmpeg_prog_file, ffmpeg_err_file]:
            if os.path.exists(p):
                try:
                    os.remove(p)
                except Exception:
                    pass

    # 4. Tulis File ASS
    try:
        ass_content = build_ass_content(cues, subtitle_data.get("style"))
        with open(temp_ass_path, "w", encoding="utf-8") as f:
            f.write(ass_content)
    except Exception as e_ass:
        cleanup_temp_files()
        return {
            "status": "error",
            "code": "ASS_GENERATION_FAILED",
            "error": f"Gagal membuat naskah subtitle ASS: {str(e_ass)}"
        }

    # 5. Estimasi Durasi Klip untuk Progress Tracking
    clip_dur = 0.0
    if duration and float(duration) > 0:
        clip_dur = float(duration)
    else:
        # Hitung dari cue terakhir jika durasi tidak dipassing
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
    escaped_ass = escape_ffmpeg_filter_path(temp_ass_path)
    ffmpeg_cmd = [
        resolved_ffmpeg,
        "-y",
        "-i", input_video_path,
        "-vf", f"subtitles='{escaped_ass}'",
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
