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

    # Gunakan resolusi video nyata sebagai resolusi virtual ASS (100% dinamis untuk semua rasio 16:9, 9:16, 1:1, dsb.)
    play_res_x = vw
    play_res_y = vh

    pos_x_pct = float(style.get("positionX", 50))
    pos_y_pct = float(style.get("positionY", 85))

    # Konversi koordinat persen (0-100) ke pixel kanvas ASS
    ass_x = int(round((pos_x_pct / 100.0) * play_res_x))
    ass_y = int(round((pos_y_pct / 100.0) * play_res_y))

    base_font_size = float(style.get("baseFontSize", 14))
    if base_font_size <= 0:
        base_font_size = 14.0

    # Rasio acuan dinamis 0.073 (min(vw, vh) * 0.073):
    # Mengalibrasi ukuran visual agar 100% presisi dan selaras dengan preview React Native (14dp).
    ref_dim = min(vw, vh)
    ass_base_fs = max(14, int(round(ref_dim * 0.073)))
    ass_outline = max(1.5, round(ass_base_fs * 0.065, 1))

    ass_header = f"""[Script Info]
Title: Clipped Video Subtitles
ScriptType: v4.00+
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: {play_res_x}
PlayResY: {play_res_y}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Roboto,Noto Color Emoji,{ass_base_fs},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,{ass_outline},0,5,10,10,10,1

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
    - Opsi textfile membaca UTF-8 tanpa kendala escaping karakter khusus.
    - Mendukung multiline (break line \n) dengan memecah setiap baris menjadi filter drawtext mandiri,
      sehingga SETIAP baris 100% terposisikan JUSTIFY CENTER (x=(w-text_w)/2) tanpa terikat panjang baris lain.
    - Tidak ada auto-break line: teks panjang dibiarkan melebar tanpa wrap, identik dengan preview front.
    - Skala font kalibrasi 0.070 dan borderw 0.065 proporsional presisi dengan preview React Native.
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
    base_fs = max(14, int(round(ref_dim * 0.073)))
    border_w = max(2, int(round(base_fs * 0.065)))

    filter_items = []
    for idx, cue in enumerate(cues):
        raw_text = str(cue.get("text", "")).strip()
        if not raw_text:
            continue

        s = max(0.0, float(cue.get("start", 0)))
        e = max(s + 0.1, float(cue.get("end", 0)))

        cue_fs = float(cue.get("fontSize", 14))
        fs_scale = cue_fs / 14.0 if cue_fs > 0 else 1.0
        final_fs = max(10, int(round(base_fs * fs_scale)))
        line_h = int(round(final_fs * 1.35))

        # Pecah baris jika ada newline (\n / \r\n) agar setiap baris memiliki drawtext independen
        # yang 100% justify center (x=(w-text_w)/2) tanpa start-alignment
        text_lines = [line.strip() for line in raw_text.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
        text_lines = [l for l in text_lines if l]
        if not text_lines:
            continue

        total_lines = len(text_lines)
        for line_idx, line_content in enumerate(text_lines):
            cue_file = f"{output_base}.cue_{idx}_{line_idx}.txt"
            with open(cue_file, "w", encoding="utf-8") as f:
                f.write(line_content)
            temp_files.append(cue_file)

            esc_cue_file = escape_ffmpeg_filter_path(cue_file)

            # Hitung offset vertikal per baris relatif terhadap titik pusat (justify center vertikal & horizontal)
            line_y_offset = int(round((line_idx - (total_lines - 1) / 2.0) * line_h))
            if line_y_offset > 0:
                y_pos_expr = f"{y_expr}+{line_y_offset}"
            elif line_y_offset < 0:
                y_pos_expr = f"{y_expr}{line_y_offset}"
            else:
                y_pos_expr = y_expr

            item = (
                f"drawtext=textfile='{esc_cue_file}'"
                f"{font_opt}"
                f":fontsize={final_fs}"
                f":fontcolor=white"
                f":borderw={border_w}:bordercolor=black"
                f":x={x_expr}:y={y_pos_expr}"
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
    main_enabled = bool(main_cfg.get("enabled", True))

    is_portrait = fc_enabled or ctx_enabled or (not main_enabled)

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

    # 1. Hitung Dimensi Banner Konteks
    banner_h = 0
    ctx_text = str(context_cfg.get("text", "")).strip() if ctx_enabled else ""
    ctx_fs = 24
    ctx_align = str(context_cfg.get("align", "start")).lower().strip()
    if ctx_align not in ("center", "start"):
        ctx_align = "start"

    num_lines = 1
    ctx_lines = []
    line_height = 0
    pad_x = 10

    if ctx_enabled and ctx_text:
        ref_dim = min(out_w, out_h)
        base_unit = ref_dim * 0.073  # Rasio acuan dinamis setara 14dp di preview React Native
        ctx_fs_dp = float(context_cfg.get("fontSize", 16))
        ctx_pad_dp = float(context_cfg.get("paddingY", 10))

        # Skala font konteks proporsional dengan kalibrasi visual subtitle (14dp -> base_unit):
        ctx_fs = max(8, int(round(base_unit * (ctx_fs_dp / 14.0))))

        # Skala padding Y proporsional dengan rasio dimensi acuan yang sama:
        ctx_pad = max(0, int(round(base_unit * (ctx_pad_dp / 14.0))))

        # Padding horizontal saat rata kiri (start): selaras dengan 12dp preview
        pad_x = max(10, int(round(base_unit * (12.0 / 14.0))))

        # Pisahkan baris teks (maksimal 3 baris sesuai spesifikasi)
        raw_lines = [l.strip() for l in ctx_text.splitlines() if l.strip()]
        ctx_lines = raw_lines[:3] if raw_lines else [ctx_text]
        num_lines = max(1, len(ctx_lines))

        # Tinggi banner: ruang teks vertikal (lineHeight ~1.35 * ctx_fs per baris) + 2 * padding
        line_height = int(round(ctx_fs * 1.35))
        banner_h = int(round(num_lines * line_height + 2 * ctx_pad))
        if banner_h % 2 != 0:
            banner_h += 1

    # 2. Hitung Geometri Facecam (Viewport 4:3)
    w_fc = out_w
    h_fc = 0
    cw_fc, ch_fc, cx_fc, cy_fc = 0, 0, 0, 0
    if fc_enabled:
        h_fc = int(round(out_w * 0.75))
        if h_fc % 2 != 0:
            h_fc += 1

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
            cw_main = int(round((0.75 * vw) / main_zoom))
            ch_main = int(round(vh / main_zoom))
        else:
            w_main = out_w
            h_main = int(round(out_w * (9.0 / 16.0)))
            if h_main % 2 != 0:
                h_main += 1
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

    # 4. Hitung Posisi Y Tiap Layer (Centered Vertikal Otomatis pada Mode Portrait)
    h_banner_act = banner_h if (ctx_enabled and ctx_text) else 0
    h_fc_act = h_fc if fc_enabled else 0
    h_main_act = h_main if main_enabled else 0

    if is_portrait:
        total_content_h = h_banner_act + h_fc_act + h_main_act
        offset_y = max(0, int(round((out_h - total_content_h) / 2)))
        if offset_y % 2 != 0:
            offset_y += 1

        y_banner = offset_y
        y_fc = offset_y + h_banner_act
        y_main = offset_y + h_banner_act + h_fc_act
    else:
        y_banner = 0
        y_fc = 0
        y_main = 0

    # 5. Susun Filter Teks Banner Konteks
    ctx_drawtext_filters = []
    if ctx_enabled and ctx_text:
        if num_lines == 1:
            ctx_file = f"{output_base}.context.txt"
            with open(ctx_file, "w", encoding="utf-8") as f:
                f.write(ctx_lines[0])
            temp_files.append(ctx_file)
            esc_ctx_file = escape_ffmpeg_filter_path(ctx_file)
            x_expr = "(w-text_w)/2" if ctx_align == "center" else f"{pad_x}"
            ctx_drawtext_filters.append(
                f"drawtext=textfile='{esc_ctx_file}'{font_opt}:fontsize={ctx_fs}:fontcolor=black:x={x_expr}:y={y_banner}+({banner_h}-text_h)/2"
            )
        else:
            total_text_h = num_lines * line_height
            start_y = max(0, int(round((banner_h - total_text_h) / 2)))
            for i, line in enumerate(ctx_lines):
                line_file = f"{output_base}.context_{i}.txt"
                with open(line_file, "w", encoding="utf-8") as f:
                    f.write(line)
                temp_files.append(line_file)
                esc_line_file = escape_ffmpeg_filter_path(line_file)
                x_expr = "(w-text_w)/2" if ctx_align == "center" else f"{pad_x}"
                y_pos = y_banner + start_y + i * line_height
                ctx_drawtext_filters.append(
                    f"drawtext=textfile='{esc_line_file}'{font_opt}:fontsize={ctx_fs}:fontcolor=black:x={x_expr}:y={y_pos}"
                )

    # 6. Susun Baris-Baris Filtergraph FFmpeg
    filter_lines = []

    if is_portrait:
        avail_main_h = max(2, out_h - y_main)
        if avail_main_h % 2 != 0:
            avail_main_h -= 1
        if h_main > avail_main_h:
            main_scale_filter = f"scale={w_main}:{h_main},crop={w_main}:{avail_main_h}:0:0"
        else:
            main_scale_filter = f"scale={w_main}:{h_main}"

        avail_fc_h = max(2, out_h - y_fc)
        if avail_fc_h % 2 != 0:
            avail_fc_h -= 1
        if h_fc > avail_fc_h:
            fc_scale_filter = f"scale={w_fc}:{h_fc},crop={w_fc}:{avail_fc_h}:0:0"
        else:
            fc_scale_filter = f"scale={w_fc}:{h_fc}"

        if fc_enabled and main_enabled:
            filter_lines.append("[0:v]split=2[in_fc][in_main];")
            filter_lines.append(f"[in_fc]crop={cw_fc}:{ch_fc}:{cx_fc}:{cy_fc},{fc_scale_filter}[fc_box];")
            filter_lines.append(f"[in_main]crop={cw_main}:{ch_main}:{cx_main}:{cy_main},{main_scale_filter},pad={out_w}:{out_h}:0:{y_main}:black[canvas_pad];")
            filter_lines.append(f"[canvas_pad][fc_box]overlay=0:{y_fc}[canvas_comp];")
        elif fc_enabled and not main_enabled:
            # Facecam Saja (tanpa gameplay) pada kanvas 9:16 portrait
            filter_lines.append(f"[0:v]crop={cw_fc}:{ch_fc}:{cx_fc}:{cy_fc},{fc_scale_filter},pad={out_w}:{out_h}:0:{y_fc}:black[canvas_comp];")
        elif not fc_enabled and main_enabled:
            # Gameplay Saja (16:9) pada kanvas 9:16 portrait
            filter_lines.append(f"[0:v]crop={cw_main}:{ch_main}:{cx_main}:{cy_main},{main_scale_filter},pad={out_w}:{out_h}:0:{y_main}:black[canvas_comp];")
        else:
            # Keduanya nonaktif (misal hanya banner konteks / watermark / subtitle)
            filter_lines.append(f"[0:v]scale={out_w}:{out_h},drawbox=x=0:y=0:w={out_w}:h={out_h}:color=black:t=fill[canvas_comp];")
    else:
        is_cropped = (cw_main < vw) or (ch_main < vh)
        if is_cropped:
            filter_lines.append(f"[0:v]crop={cw_main}:{ch_main}:{cx_main}:{cy_main},scale={out_w}:{out_h}[canvas_comp];")
        else:
            filter_lines.append("[0:v]null[canvas_comp];")

    current_node = "[canvas_comp]"

    # 7. Pasang Banner Konteks jika aktif
    if ctx_enabled and ctx_text and ctx_drawtext_filters:
        banner_filters = [
            f"drawbox=x=0:y={y_banner}:w={out_w}:h={banner_h}:color=white:t={banner_h}"
        ] + ctx_drawtext_filters
        filter_lines.append(f"{current_node}{','.join(banner_filters)}[canvas_banner];")
        current_node = "[canvas_banner]"

    # 5.1 Pasang Watermark jika aktif
    watermark_cfg = template_data.get("watermark") or {}
    wm_enabled = bool(watermark_cfg.get("enabled", False))
    wm_text = str(watermark_cfg.get("text", "")).strip() if wm_enabled else ""

    if wm_enabled and wm_text:
        ref_dim = min(out_w, out_h)
        base_unit = ref_dim * 0.073
        wm_size_dp = float(watermark_cfg.get("size", 14))
        wm_fs = max(10, int(round(base_unit * (wm_size_dp / 14.0))))
        wm_border = max(1, int(round(wm_fs * 0.07)))

        wm_x = max(0.0, min(100.0, float(watermark_cfg.get("x", 85.0))))
        wm_y = max(0.0, min(100.0, float(watermark_cfg.get("y", 15.0))))

        wm_x_expr = f"(w-text_w)*{wm_x/100.0:.3f}"
        wm_y_expr = f"(h-text_h)*{wm_y/100.0:.3f}"

        wm_file = f"{output_base}.watermark.txt"
        with open(wm_file, "w", encoding="utf-8") as f:
            f.write(wm_text)
        temp_files.append(wm_file)
        esc_wm_file = escape_ffmpeg_filter_path(wm_file)

        wm_filter = (
            f"drawtext=textfile='{esc_wm_file}'{font_opt}"
            f":fontsize={wm_fs}:fontcolor=white"
            f":borderw={wm_border}:bordercolor=black"
            f":x={wm_x_expr}:y={wm_y_expr}"
        )
        filter_lines.append(f"{current_node}{wm_filter}[canvas_wm];")
        current_node = "[canvas_wm]"

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
            fonts_dir = "/system/fonts" if os.path.exists("/system/fonts") else ""
            fonts_dir_opt = f":fontsdir='{escape_ffmpeg_filter_path(fonts_dir)}'" if fonts_dir else ""
            filter_lines.append(f"{current_node}subtitles='{esc_ass}'{fonts_dir_opt}[v_out]")
        else:
            ref_dim = min(out_w, out_h)
            base_fs = max(14, int(round(ref_dim * 0.073)))
            border_w = max(2, int(round(base_fs * 0.065)))
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

                cue_fs = float(cue.get("fontSize", 14))
                fs_scale = cue_fs / 14.0 if cue_fs > 0 else 1.0
                final_fs = max(10, int(round(base_fs * fs_scale)))
                line_h = int(round(final_fs * 1.35))

                # Pecah baris jika ada newline (\n / \r\n) agar setiap baris 100% justify center
                text_lines = [line.strip() for line in raw_text.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
                text_lines = [l for l in text_lines if l]
                if not text_lines:
                    continue

                total_lines = len(text_lines)
                for line_idx, line_content in enumerate(text_lines):
                    cue_file = f"{output_base}.cue_{idx}_{line_idx}.txt"
                    with open(cue_file, "w", encoding="utf-8") as f:
                        f.write(line_content)
                    temp_files.append(cue_file)
                    esc_cue_file = escape_ffmpeg_filter_path(cue_file)

                    line_y_offset = int(round((line_idx - (total_lines - 1) / 2.0) * line_h))
                    if line_y_offset > 0:
                        y_pos_expr = f"{y_expr}+{line_y_offset}"
                    elif line_y_offset < 0:
                        y_pos_expr = f"{y_expr}{line_y_offset}"
                    else:
                        y_pos_expr = y_expr

                    item = (
                        f"drawtext=textfile='{esc_cue_file}'"
                        f"{font_opt}"
                        f":fontsize={final_fs}"
                        f":fontcolor=white"
                        f":borderw={border_w}:bordercolor=black"
                        f":x={x_expr}:y={y_pos_expr}"
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
    wm = template_data.get("watermark") or {}
    if (
        fc.get("enabled")
        or ctx.get("enabled")
        or (main_v.get("enabled") is False)
        or (wm.get("enabled") and bool(str(wm.get("text", "")).strip()))
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
        "-crf", "22",
        "-maxrate", "8M",
        "-bufsize", "12M",
        "-pix_fmt", "yuv420p",
        "-profile:v", "high",
        "-level", "4.2",
        "-movflags", "+faststart",
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
            "-crf", "22",
            "-maxrate", "8M",
            "-bufsize", "12M",
            "-pix_fmt", "yuv420p",
            "-profile:v", "high",
            "-level", "4.2",
            "-movflags", "+faststart",
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
