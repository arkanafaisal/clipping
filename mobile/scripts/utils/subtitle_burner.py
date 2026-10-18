import os
import sys
import time
import json
import traceback
import subprocess
import shutil
import re


def get_video_dimensions(ffmpeg_bin: str, video_path: str) -> tuple[int, int]:
    """
    Mendeteksi resolusi video (width, height) menggunakan ffmpeg -hide_banner -i.
    Cepat, tanpa transcoder, dan tidak memerlukan ffprobe terpisah.
    """
    if not video_path or not os.path.exists(video_path):
        return 1280, 720
    try:
        bin_path = ffmpeg_bin or "ffmpeg"
        cmd = [bin_path, "-hide_banner", "-i", video_path]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=10)
        match = re.search(r"Video:.*?(\d{2,5})x(\d{2,5})", res.stderr)
        if match:
            w, h = int(match.group(1)), int(match.group(2))
            if w > 0 and h > 0:
                return w, h
    except Exception:
        pass
    return 1280, 720


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


def build_ass_content(cues: list, style: dict = None, video_width: int = 1920, video_height: int = 1080) -> str:
    r"""
    Mengonversi konfigurasi subtitle JSON (cues & global style) menjadi naskah ASS (Advanced SubStation Alpha).
    ASS adalah standar industri yang didukung oleh filter `subtitles` di FFmpeg libass.
    - Kanvas video: 1920x1080 (16:9) atau 1080x1920 (9:16 Portrait)
    - Titik jangkar tengah (Center Anchor: \an5)
    - Posisi X & Y global (0-100 persen)
    - Font scaling dinamis berbasis rasio 14dp mobile UI -> 69px pada kanvas acuan 1080p
    """
    if style is None:
        style = {}

    vw = max(240, int(video_width)) if video_width else 1920
    vh = max(240, int(video_height)) if video_height else 1080
    is_portrait = vw < vh

    play_res_x = 1080 if is_portrait else 1920
    play_res_y = 1920 if is_portrait else 1080

    pos_x_pct = float(style.get("positionX", 50))
    pos_y_pct = float(style.get("positionY", 85))

    # Konversi koordinat persen (0-100) ke pixel kanvas ASS
    ass_x = int(round((pos_x_pct / 100.0) * play_res_x))
    ass_y = int(round((pos_y_pct / 100.0) * play_res_y))

    base_font_size = float(style.get("baseFontSize", 14))
    if base_font_size <= 0:
        base_font_size = 14.0

    # 14dp di layar mobile (~220dp viewport 16:9) setara dengan rasio ~0.0638.
    # Pada kanvas acuan 1080p (dimensi pendek 1080), 1080 * 0.0638 = 69px.
    ass_base_fs = 69

    ass_header = f"""[Script Info]
Title: Clipped Video Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: {play_res_x}
PlayResY: {play_res_y}

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


def build_drawtext_pipeline(cues: list, style: dict, output_base: str, video_width: int = 1280, video_height: int = 720):
    """
    Membangun filterchain drawtext menggunakan opsi 'textfile' per cue.
    Solusi native FFmpeg saat libass / filter 'subtitles' tidak dikompilasi di binary perangkat.
    - Opsi textfile membaca UTF-8 tanpa kendala escaping karakter khusus/multiline.
    - enable='between(t, start, end)' hanya merender teks pada jendela waktu masing-masing.
    - Koordinat dinamis berbasis persen: x=(w-text_w)*x_pct/100, y=(h-text_h)*y_pct/100.
    - Skala font integer absolut berbasis dimensi acuan min(w, h):
      fontsize = round(min(w, h) * 0.0638 * (cue_fs / 14)).
      Rasio 0.0638 sinkron 1:1 dengan 14dp preview pada viewport mobile ~220dp,
      serta aman untuk mode 16:9 maupun 9:16 Portrait tanpa meluap keluar batas lebar video.
    - Border hitam pekat (borderw proporsional) untuk keterbacaan tinggi.
    """
    temp_files = []
    font_path = resolve_system_font()
    font_opt = f":fontfile='{escape_ffmpeg_filter_path(font_path)}'" if font_path else ""

    pos_x = float(style.get("positionX", 50))
    pos_y = float(style.get("positionY", 85))
    x_expr = "(w-text_w)/2" if abs(pos_x - 50) < 0.1 else f"(w-text_w)*{pos_x/100.0:.3f}"
    y_expr = "(h-text_h)*0.85" if abs(pos_y - 85) < 0.1 else f"(h-text_h)*{pos_y/100.0:.3f}"

    vw = max(240, int(video_width)) if video_width else 1280
    vh = max(240, int(video_height)) if video_height else 720
    ref_dim = min(vw, vh)
    base_fs = max(14, int(round(ref_dim * 0.0638)))
    border_w = max(2, int(round(base_fs * 0.08)))

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
        final_fs = max(10, int(round(base_fs * fs_scale)))

        item = (
            f"drawtext=textfile='{esc_cue_file}'"
            f"{font_opt}"
            f":fontsize={final_fs}"
            f":fontcolor=white"
            f":borderw={border_w}:bordercolor=black"
            f":x={x_expr}:y={y_expr}"
            f":enable='between(t,{s:.3f},{e:.3f})'"
        )
        filter_items.append(item)

    script_path = f"{output_base}.fffilter"
    with open(script_path, "w", encoding="utf-8") as f:
        f.write(",\n".join(filter_items))
    temp_files.append(script_path)

    return script_path, temp_files


def build_multi_layer_pipeline(
    cues: list,
    style: dict,
    template_data: dict,
    output_base: str,
    video_width: int = 1280,
    video_height: int = 720,
    subtitles_supported: bool = True
) -> tuple[str, list[str], int, int]:
    """
    Membangun script complex filtergraph (-filter_complex_script) untuk 1-pass multi-layer template video export:
    - Layer 1 (Base/Canvas): 9:16 Portrait (1080x1920 / 720x1280) jika facecam atau context aktif, atau 16:9 Landscape asli.
    - Layer 2 (Facecam): Viewport 4:3 diposisikan di atas (setelah banner), di-crop & di-zoom dinamis dari input 16:9.
    - Layer 3 (Gameplay / Main Video): Viewport 4:3 (jika facecam aktif) atau 16:9 (jika facecam nonaktif), di-crop & di-zoom dinamis.
    - Layer 4 (Context Banner): Box putih di bagian paling atas (Y=0) dengan judul teks hitam tebal terpusat.
    - Layer 5 (Subtitles): Burn-in cue subtitle dinamis (libass atau drawtext per cue) terposisikan di atas canvas kanvas luar.

    Semua filter digabungkan dalam 1 PASS tanpa file intermediate dan menjaga sinkronisasi audio murni.
    Mengembalikan (complex_script_path, temp_files, out_w, out_h).
    """
    if not template_data or not isinstance(template_data, dict):
        template_data = {}

    context_cfg = template_data.get("context") or {}
    facecam_cfg = template_data.get("facecam") or {}
    main_cfg = template_data.get("mainVideo") or {}

    ctx_enabled = bool(context_cfg.get("enabled", False))
    fc_enabled = bool(facecam_cfg.get("enabled", False))

    is_portrait = fc_enabled or ctx_enabled

    vw = max(240, int(video_width)) if video_width else 1280
    vh = max(240, int(video_height)) if video_height else 720

    if is_portrait:
        if vh >= 1080:
            out_w, out_h = 1080, 1920
        elif vh >= 720:
            out_w, out_h = 720, 1280
        else:
            out_w, out_h = 540, 960
    else:
        out_w, out_h = vw, vh

    out_w = out_w - (out_w % 2)
    out_h = out_h - (out_h % 2)

    temp_files = []
    font_path = resolve_system_font()
    font_opt = f":fontfile='{escape_ffmpeg_filter_path(font_path)}'" if font_path else ""

    # 1. Hitung Banner Konteks
    banner_h = 0
    ctx_text = str(context_cfg.get("text", "")).strip() if ctx_enabled else ""
    ctx_fs = 24
    if ctx_enabled and ctx_text:
        scale_factor = out_w / 390.0
        ctx_fs_dp = float(context_cfg.get("fontSize", 16))
        ctx_pad_dp = float(context_cfg.get("paddingY", 10))
        ctx_fs = max(14, int(round(ctx_fs_dp * scale_factor)))
        ctx_pad = max(4, int(round(ctx_pad_dp * scale_factor)))
        banner_h = int(round(ctx_fs * 1.35 + 2 * ctx_pad))
        if banner_h % 2 != 0:
            banner_h += 1

        ctx_file = f"{output_base}.context.txt"
        with open(ctx_file, "w", encoding="utf-8") as f:
            f.write(ctx_text)
        temp_files.append(ctx_file)
        esc_ctx_file = escape_ffmpeg_filter_path(ctx_file)

    # 2. Hitung Geometri Facecam (Viewport 4:3)
    if fc_enabled:
        w_fc = out_w
        h_fc = int(round(out_w * 0.75))
        if h_fc % 2 != 0:
            h_fc += 1
        y_fc = banner_h

        fc_zoom = max(1.0, float(facecam_cfg.get("zoom", 2.0)))
        fc_crop_x = max(0.0, min(100.0, float(facecam_cfg.get("cropX", 80.0))))
        fc_crop_y = max(0.0, min(100.0, float(facecam_cfg.get("cropY", 20.0))))

        cw_fc = int(round((0.75 * vw) / fc_zoom))
        ch_fc = int(round(vh / fc_zoom))
        cw_fc = max(2, min(vw, cw_fc - (cw_fc % 2)))
        ch_fc = max(2, min(vh, ch_fc - (ch_fc % 2)))

        max_pan_fc_x = max(0, vw - cw_fc)
        max_pan_fc_y = max(0, vh - ch_fc)
        cx_fc = int(round(max_pan_fc_x * (fc_crop_x / 100.0)))
        cy_fc = int(round(max_pan_fc_y * (fc_crop_y / 100.0)))
        cx_fc = max(0, min(vw - cw_fc, cx_fc - (cx_fc % 2)))
        cy_fc = max(0, min(vh - ch_fc, cy_fc - (cy_fc % 2)))

    # 3. Hitung Geometri Main Video Gameplay
    main_zoom = max(1.0, float(main_cfg.get("zoom", 1.0)))
    main_crop_x = max(0.0, min(100.0, float(main_cfg.get("cropX", 50.0))))
    main_crop_y = max(0.0, min(100.0, float(main_cfg.get("cropY", 50.0))))

    if is_portrait:
        if fc_enabled:
            w_main = out_w
            h_main = int(round(out_w * 0.75))
            if h_main % 2 != 0:
                h_main += 1
            y_main = banner_h + h_fc

            cw_main = int(round((0.75 * vw) / main_zoom))
            ch_main = int(round(vh / main_zoom))
        else:
            w_main = out_w
            h_main = int(round(out_w * (9.0 / 16.0)))
            if h_main % 2 != 0:
                h_main += 1
            y_main = banner_h

            cw_main = int(round(vw / main_zoom))
            ch_main = int(round(vh / main_zoom))

        cw_main = max(2, min(vw, cw_main - (cw_main % 2)))
        ch_main = max(2, min(vh, ch_main - (ch_main % 2)))

        max_pan_main_x = max(0, vw - cw_main)
        max_pan_main_y = max(0, vh - ch_main)
        cx_main = int(round(max_pan_main_x * (main_crop_x / 100.0)))
        cy_main = int(round(max_pan_main_y * (main_crop_y / 100.0)))
        cx_main = max(0, min(vw - cw_main, cx_main - (cx_main % 2)))
        cy_main = max(0, min(vh - ch_main, cy_main - (cy_main % 2)))
    else:
        w_main = out_w
        h_main = out_h
        y_main = 0

        cw_main = int(round(vw / main_zoom))
        ch_main = int(round(vh / main_zoom))
        cw_main = max(2, min(vw, cw_main - (cw_main % 2)))
        ch_main = max(2, min(vh, ch_main - (ch_main % 2)))

        max_pan_main_x = max(0, vw - cw_main)
        max_pan_main_y = max(0, vh - ch_main)
        cx_main = int(round(max_pan_main_x * (main_crop_x / 100.0)))
        cy_main = int(round(max_pan_main_y * (main_crop_y / 100.0)))
        cx_main = max(0, min(vw - cw_main, cx_main - (cx_main % 2)))
        cy_main = max(0, min(vh - ch_main, cy_main - (cy_main % 2)))

    # 4. Susun Baris-Baris Filtergraph FFmpeg
    filter_lines = []

    if is_portrait:
        if fc_enabled:
            filter_lines.append("[0:v]split=2[in_fc][in_main];")
            filter_lines.append(f"[in_fc]crop={cw_fc}:{ch_fc}:{cx_fc}:{cy_fc},scale={w_fc}:{h_fc}[fc_box];")
            filter_lines.append(f"[in_main]crop={cw_main}:{ch_main}:{cx_main}:{cy_main},scale={w_main}:{h_main},pad={out_w}:{out_h}:0:{y_main}:black[canvas_pad];")
            filter_lines.append(f"[canvas_pad][fc_box]overlay=0:{y_fc}[canvas_comp];")
        else:
            filter_lines.append(f"[0:v]crop={cw_main}:{ch_main}:{cx_main}:{cy_main},scale={w_main}:{h_main},pad={out_w}:{out_h}:0:{y_main}:black[canvas_comp];")
    else:
        is_cropped = (cw_main < vw) or (ch_main < vh)
        if is_cropped:
            filter_lines.append(f"[0:v]crop={cw_main}:{ch_main}:{cx_main}:{cy_main},scale={out_w}:{out_h}[canvas_comp];")
        else:
            filter_lines.append("[0:v]null[canvas_comp];")

    current_node = "[canvas_comp]"

    # 5. Pasang Banner Konteks jika aktif
    if ctx_enabled and ctx_text:
        banner_filters = [
            f"drawbox=x=0:y=0:w={out_w}:h={banner_h}:color=white:t=fill",
            f"drawtext=textfile='{esc_ctx_file}'{font_opt}:fontsize={ctx_fs}:fontcolor=black:x=(w-text_w)/2:y=({banner_h}-text_h)/2"
        ]
        filter_lines.append(f"{current_node}{','.join(banner_filters)}[canvas_banner];")
        current_node = "[canvas_banner]"

    # 6. Pasang Subtitle Burn-In jika tersedia
    has_cues = bool(cues and isinstance(cues, list) and len(cues) > 0)

    if has_cues:
        if subtitles_supported:
            ass_content = build_ass_content(cues, style, video_width=out_w, video_height=out_h)
            ass_path = f"{output_base}.temp.ass"
            with open(ass_path, "w", encoding="utf-8") as f:
                f.write(ass_content)
            temp_files.append(ass_path)
            esc_ass = escape_ffmpeg_filter_path(ass_path)
            filter_lines.append(f"{current_node}subtitles='{esc_ass}'[v_out]")
        else:
            ref_dim = min(out_w, out_h)
            base_fs = max(14, int(round(ref_dim * 0.0638)))
            border_w = max(2, int(round(base_fs * 0.08)))
            pos_x = float(style.get("positionX", 50))
            pos_y = float(style.get("positionY", 85))
            x_expr = "(w-text_w)/2" if abs(pos_x - 50) < 0.1 else f"(w-text_w)*{pos_x/100.0:.3f}"
            y_expr = "(h-text_h)*0.85" if abs(pos_y - 85) < 0.1 else f"(h-text_h)*{pos_y/100.0:.3f}"

            drawtext_items = []
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
                final_fs = max(10, int(round(base_fs * fs_scale)))

                item = (
                    f"drawtext=textfile='{esc_cue_file}'"
                    f"{font_opt}"
                    f":fontsize={final_fs}"
                    f":fontcolor=white"
                    f":borderw={border_w}:bordercolor=black"
                    f":x={x_expr}:y={y_expr}"
                    f":enable='between(t,{s:.3f},{e:.3f})'"
                )
                drawtext_items.append(item)

            if drawtext_items:
                filter_lines.append(f"{current_node}{','.join(drawtext_items)}[v_out]")
            else:
                filter_lines.append(f"{current_node}null[v_out]")
    else:
        filter_lines.append(f"{current_node}null[v_out]")

    complex_script_path = f"{output_base}.ffcomplex"
    with open(complex_script_path, "w", encoding="utf-8") as f:
        f.write("\n".join(filter_lines))
    temp_files.append(complex_script_path)

    return complex_script_path, temp_files, out_w, out_h


def burn_subtitles_to_video(
    input_video_path: str,
    output_video_path: str,
    subtitle_data: dict,
    ffmpeg_bin: str = None,
    progress_path: str = None,
    duration: float = None,
    template_data: dict = None
) -> dict:
    """
    Mengeksekusi penempelan (hardcode burn-in) subtitle dan template layout ke video klip menggunakan FFmpeg.
    - Menghasilkan file video BARU pada output_video_path dalam 1 PASS FFmpeg murni.
    - File input asli tetap utuh 100% tanpa modifikasi.
    - Mendukung mode 9:16 Portrait terpadu (Konteks + Facecam + Gameplay) dan 16:9 Landscape.
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
        subtitle_data = {}

    # Normalisasi template_data jika disertakan terpisah atau tertanam di subtitle_data
    if template_data is None:
        template_data = subtitle_data.get("template")

    if isinstance(template_data, str):
        try:
            template_data = json.loads(template_data)
        except Exception:
            template_data = {}

    if not isinstance(template_data, dict):
        template_data = {}

    cues = subtitle_data.get("cues") or []
    if not isinstance(cues, list):
        cues = []

    has_template = False
    fc = template_data.get("facecam") or {}
    ctx = template_data.get("context") or {}
    main_v = template_data.get("mainVideo") or {}
    if (
        fc.get("enabled")
        or ctx.get("enabled")
        or float(main_v.get("zoom", 1.0)) > 1.001
        or float(main_v.get("cropX", 50)) != 50
        or float(main_v.get("cropY", 50)) != 50
    ):
        has_template = True

    if len(cues) == 0 and not has_template:
        return {
            "status": "error",
            "code": "NO_CONTENT_TO_BURN",
            "error": "Daftar cue subtitle dan template video kosong."
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

    ffmpeg_prog_file = f"{output_video_path}.ffprog"
    ffmpeg_err_file = f"{output_video_path}.fferr"
    temp_files_to_clean = []

    def cleanup_temp_files():
        for p in [ffmpeg_prog_file, ffmpeg_err_file] + temp_files_to_clean:
            if os.path.exists(p):
                try:
                    os.remove(p)
                except Exception:
                    pass

    # 4. Bangun 1-Pass Multi-Layer Pipeline Script
    v_width, v_height = get_video_dimensions(resolved_ffmpeg, input_video_path)
    subtitles_supported = is_filter_supported(resolved_ffmpeg, "subtitles")

    complex_script, created_files, out_w, out_h = build_multi_layer_pipeline(
        cues=cues,
        style=subtitle_data.get("style", {}),
        template_data=template_data,
        output_base=output_video_path,
        video_width=v_width,
        video_height=v_height,
        subtitles_supported=subtitles_supported
    )
    temp_files_to_clean.extend(created_files)

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

    # 6. Susun Argumen FFmpeg 1-Pass Multi-Layer
    ffmpeg_cmd = [
        resolved_ffmpeg,
        "-y",
        "-i", input_video_path,
        "-filter_complex_script", complex_script,
        "-map", "[v_out]",
        "-map", "0:a?",
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
            "error": f"Eksekusi FFmpeg export multi-layer gagal: {str(e_proc)}",
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
    if proc.returncode != 0 and subtitles_supported and ("No such filter: 'subtitles'" in err_output or "subtitles" in err_output.lower() or "filter" in err_output.lower()):
        # Retry dengan native drawtext fallback pipeline
        fb_script, fb_files, _, _ = build_multi_layer_pipeline(
            cues=cues,
            style=subtitle_data.get("style", {}),
            template_data=template_data,
            output_base=output_video_path,
            video_width=v_width,
            video_height=v_height,
            subtitles_supported=False
        )
        temp_files_to_clean.extend(fb_files)
        fallback_cmd = [
            resolved_ffmpeg,
            "-y",
            "-i", input_video_path,
            "-filter_complex_script", fb_script,
            "-map", "[v_out]",
            "-map", "0:a?",
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
            "error": f"Ekspor video FFmpeg gagal (exit code {proc.returncode}):\n{err_output}",
            "traceback": err_output or f"Exit code {proc.returncode}"
        }

    write_progress("STAGE_COMPLETE", "COMPLETED", 100, force=True)

    return {
        "status": "success",
        "output_path": output_video_path
    }
