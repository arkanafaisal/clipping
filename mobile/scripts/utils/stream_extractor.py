import os
import yt_dlp

def get_direct_stream_url(video_id: str, ydl_opts: dict, cookie_path: str = None) -> tuple:
    """
    Ekstrak direct stream URL dari video YouTube menggunakan yt-dlp secara murni pass-through.
    Mengeksekusi sekali jalan (single pass) tanpa retry otomatis:
    - Jika parameter cookie_path valid dikirimkan, gunakan cookies.
    - Jika tidak, jalankan dalam mode anonim.
    
    Returns:
        tuple: (url: str | None, code: str | None, error: str | None)
    """
    if not video_id:
        return None, "VIDEO_ID_REQUIRED", "Parameter 'video_id' wajib diisi."
        
    if not ydl_opts or not isinstance(ydl_opts, dict):
        return None, "YDL_OPTS_REQUIRED", "Parameter 'ydl_opts' (konfigurasi yt-dlp) wajib dikirim oleh frontend."

    url = f"https://www.youtube.com/watch?v={video_id}"

    opts = ydl_opts.copy()
    if cookie_path and os.path.exists(cookie_path):
        opts['cookiefile'] = cookie_path
        # Reset player_client ke web & mweb karena browser cookies (format Netscape)
        # hanya didukung oleh web player, bukan native app (android/ios).
        if 'extractor_args' in opts and isinstance(opts['extractor_args'], dict):
            new_ext_args = {k: (v.copy() if isinstance(v, dict) else v) for k, v in opts['extractor_args'].items()}
            if 'youtube' in new_ext_args and isinstance(new_ext_args['youtube'], dict):
                yt_args = new_ext_args['youtube'].copy()
                yt_args['player_client'] = ['web', 'mweb']
                new_ext_args['youtube'] = yt_args
            opts['extractor_args'] = new_ext_args
    else:
        opts.pop('cookiefile', None)

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
            result_url = info.get('url')
            if result_url:
                return result_url, None, None
            return None, "STREAM_NOT_FOUND", "Direct stream URL tidak ditemukan dalam respon metadata YouTube."
    except Exception as e:
        return None, "STREAM_ERROR", str(e)


def extract_stream_url(video_id: str, ydl_opts: dict = None, cookie_path: str = None) -> dict:
    """
    Wrapper fungsi skrip murni yang dipanggil langsung oleh runner.py / Native Module.
    Mengembalikan dictionary hasil atau error terstruktur.
    """
    url, code, err = get_direct_stream_url(video_id, ydl_opts or {}, cookie_path)
    if code or err:
        return {
            "status": "error",
            "code": code or "STREAM_ERROR",
            "error": err or str(code)
        }
    return {
        "status": "success",
        "stream_url": url
    }


def get_available_video_versions(video_id: str, ydl_opts: dict = None, cookie_path: str = None) -> tuple:
    """
    Mengambil metadata daftar format/resolusi video yang tersedia di YouTube untuk video_id tertentu.
    Hanya mengekstrak metadata JSON tanpa mendownload video (cepat & hemat kuota).
    
    Returns:
        tuple: (result: dict | None, code: str | None, error: str | None)
    """
    if not video_id:
        return None, "VIDEO_ID_REQUIRED", "Parameter 'video_id' wajib diisi."

    url = f"https://www.youtube.com/watch?v={video_id}"
    opts = (ydl_opts or {}).copy()
    opts["skip_download"] = True
    opts["extract_flat"] = False
    opts["quiet"] = True
    opts["no_warnings"] = True
    opts.pop("format", None)
    opts.pop("format_sort", None)

    if cookie_path and os.path.exists(cookie_path):
        opts["cookiefile"] = cookie_path
        if "extractor_args" in opts and isinstance(opts["extractor_args"], dict):
            new_ext_args = {k: (v.copy() if isinstance(v, dict) else v) for k, v in opts["extractor_args"].items()}
            if "youtube" in new_ext_args and isinstance(new_ext_args["youtube"], dict):
                yt_args = new_ext_args["youtube"].copy()
                yt_args["player_client"] = ["web", "mweb"]
                new_ext_args["youtube"] = yt_args
            opts["extractor_args"] = new_ext_args
    else:
        opts.pop("cookiefile", None)
        # Jika mode anonim tanpa cookies, jangan batasi player_client ke mobile-only agar semua resolusi terbaca
        if "extractor_args" in opts and isinstance(opts["extractor_args"], dict):
            if "youtube" in opts["extractor_args"] and isinstance(opts["extractor_args"]["youtube"], dict):
                new_ext_args = {k: (v.copy() if isinstance(v, dict) else v) for k, v in opts["extractor_args"].items()}
                new_yt = new_ext_args["youtube"].copy()
                new_yt.pop("player_client", None)
                new_ext_args["youtube"] = new_yt
                opts["extractor_args"] = new_ext_args

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if not info:
                return None, "METADATA_NOT_FOUND", "Metadata video YouTube tidak ditemukan."

            title = info.get("title") or f"YouTube Video ({video_id})"
            duration = info.get("duration") or 0
            thumbnail = info.get("thumbnail") or ""
            formats = info.get("formats") or []

            # Kelompokkan dan deduplikasi format berdasarkan resolusi (height) dan framerate (fps)
            # Prioritaskan H.264 (avc1) / MP4 untuk kompatibilitas native Android ExoPlayer
            groups = {}
            for f in formats:
                h = f.get("height")
                if not h or h < 240:
                    continue

                raw_fps = f.get("fps") or 30
                fps = int(round(raw_fps))
                # Normalisasi fps (e.g. 59.94 -> 60, 29.97 -> 30, 24 -> 24)
                if fps >= 55:
                    fps = 60
                elif fps >= 28:
                    fps = 30
                elif fps >= 23:
                    fps = 24

                # Identifikasi apakah progressive (video + audio gabungan)
                acodec = f.get("acodec")
                vcodec = f.get("vcodec") or ""
                ext = f.get("ext") or "mp4"
                is_prog = bool(acodec and acodec != "none" and acodec != "unknown")

                # Kunci unik: misal "1080p60", "720p60", "720p30", "480p30", "360p30"
                group_key = f"{h}p{fps}"

                # Hitung score kompatibilitas:
                # MP4/avc1 lebih diutamakan untuk mobile decoder
                score = 0
                if "avc1" in vcodec.lower() or "h264" in vcodec.lower():
                    score += 50
                if ext == "mp4":
                    score += 30
                if is_prog:
                    score += 15

                filesize = f.get("filesize") or f.get("filesize_approx") or 0

                if group_key not in groups or score > groups[group_key]["score"]:
                    # Tentukan label catatan ringkas
                    if h >= 1080 and fps >= 60:
                        note = "Maksimal (Full HD 60 FPS)"
                    elif h >= 1080:
                        note = "Full HD (30 FPS)"
                    elif h >= 720 and fps >= 60:
                        note = "Rekomendasi (Halus & Hemat 55%)"
                    elif h >= 720:
                        note = "Standar HD (30 FPS)"
                    elif h >= 480:
                        note = "Ringan (Hemat Kuota)"
                    else:
                        note = "Super Hemat (360p)"

                    groups[group_key] = {
                        "id": group_key,
                        "label": f"{h}p {fps}fps",
                        "height": h,
                        "fps": fps,
                        "is_progressive": is_prog,
                        "format_id": f.get("format_id"),
                        "vcodec": vcodec,
                        "ext": ext,
                        "filesize_approx": filesize,
                        "note": note,
                        "score": score
                    }

            # Urutkan dari resolusi tertinggi dan fps tertinggi ke terendah
            sorted_versions = sorted(
                list(groups.values()),
                key=lambda x: (x["height"], x["fps"]),
                reverse=True
            )

            # Bersihkan properti internal score
            for item in sorted_versions:
                item.pop("score", None)

            return {
                "title": title,
                "duration": duration,
                "thumbnail": thumbnail,
                "available_versions": sorted_versions
            }, None, None
    except Exception as e:
        return None, "EXTRACT_ERROR", str(e)


def extract_video_versions(video_id: str, ydl_opts: dict = None, cookie_path: str = None) -> dict:
    """
    Wrapper fungsi skrip untuk dipanggil oleh runner.py / Native Module.
    """
    res, code, err = get_available_video_versions(video_id, ydl_opts, cookie_path)
    if code or err:
        return {
            "status": "error",
            "code": code or "EXTRACT_ERROR",
            "error": err or str(code)
        }
    return {
        "status": "success",
        **res
    }


def get_quality_stream_url(video_id: str, quality_id: str, ydl_opts: dict = None, cookie_path: str = None) -> tuple:
    """
    Mengekstrak direct URL untuk kualitas video tertentu (misal '720p60', '1080p60', '720p30', '480p30').
    - Jika Progressive (video + audio menyatu): mengembalikan {"is_dash": False, "url": "https://..."}
    - Jika DASH (video dan audio terpisah): mengembalikan {"is_dash": True, "video_url": "https://...", "audio_url": "https://..."}
    """
    if not video_id:
        return None, "VIDEO_ID_REQUIRED", "Parameter 'video_id' wajib diisi."
    if not quality_id:
        return None, "QUALITY_ID_REQUIRED", "Parameter 'quality_id' (misal '720p60') wajib diisi."

    url = f"https://www.youtube.com/watch?v={video_id}"
    opts = (ydl_opts or {}).copy()
    opts["skip_download"] = True
    opts["extract_flat"] = False
    opts["quiet"] = True
    opts["no_warnings"] = True
    opts.pop("format", None)
    opts.pop("format_sort", None)

    if cookie_path and os.path.exists(cookie_path):
        opts["cookiefile"] = cookie_path
        if "extractor_args" in opts and isinstance(opts["extractor_args"], dict):
            new_ext_args = {k: (v.copy() if isinstance(v, dict) else v) for k, v in opts["extractor_args"].items()}
            if "youtube" in new_ext_args and isinstance(new_ext_args["youtube"], dict):
                yt_args = new_ext_args["youtube"].copy()
                yt_args["player_client"] = ["web", "mweb"]
                new_ext_args["youtube"] = yt_args
            opts["extractor_args"] = new_ext_args
    else:
        opts.pop("cookiefile", None)
        # Jika mode anonim tanpa cookies, jangan batasi player_client ke mobile-only agar semua resolusi terbaca
        if "extractor_args" in opts and isinstance(opts["extractor_args"], dict):
            if "youtube" in opts["extractor_args"] and isinstance(opts["extractor_args"]["youtube"], dict):
                new_ext_args = {k: (v.copy() if isinstance(v, dict) else v) for k, v in opts["extractor_args"].items()}
                new_yt = new_ext_args["youtube"].copy()
                new_yt.pop("player_client", None)
                new_ext_args["youtube"] = new_yt
                opts["extractor_args"] = new_ext_args

    try:
        # Parsing target height & fps dari quality_id, misal "720p60" -> 720, 60
        target_h = 720
        target_fps = 30
        if "p" in quality_id:
            parts = quality_id.split("p")
            try:
                target_h = int(parts[0])
            except ValueError:
                target_h = 720
            if len(parts) > 1 and parts[1]:
                try:
                    target_fps = int(parts[1])
                except ValueError:
                    target_fps = 30

        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if not info:
                return None, "STREAM_NOT_FOUND", "Metadata video YouTube tidak ditemukan."

            formats = info.get("formats") or []
            if not formats:
                single_url = info.get("url")
                if single_url:
                    return {"is_dash": False, "url": single_url, "quality_id": quality_id}, None, None
                return None, "STREAM_NOT_FOUND", "Daftar stream formats kosong."

            # 1. Cari video format yang cocok dengan target_h dan target_fps
            best_v_fmt = None
            best_v_score = -1

            for f in formats:
                h = f.get("height")
                if not h:
                    continue
                vcodec = f.get("vcodec") or ""
                if not vcodec or vcodec == "none":
                    continue

                raw_fps = f.get("fps") or 30
                fps = 60 if raw_fps >= 55 else (30 if raw_fps >= 28 else 24)

                diff_h = abs(h - target_h)
                diff_fps = abs(fps - target_fps)

                score = 1000 - (diff_h * 10) - (diff_fps * 5)
                ext = f.get("ext") or "mp4"
                if "avc1" in vcodec.lower() or "h264" in vcodec.lower():
                    score += 50
                if ext == "mp4":
                    score += 20
                acodec = f.get("acodec")
                if acodec and acodec != "none":
                    score += 10  # progressive bonus

                if score > best_v_score and f.get("url"):
                    best_v_score = score
                    best_v_fmt = f

            if not best_v_fmt:
                fallback_url = info.get("url")
                if fallback_url:
                    return {"is_dash": False, "url": fallback_url, "quality_id": quality_id}, None, None
                return None, "FORMAT_NOT_MATCHED", f"Format video untuk kualitas {quality_id} tidak ditemukan."

            # Cek apakah best_v_fmt sudah memiliki audio (Progressive)
            v_acodec = best_v_fmt.get("acodec")
            if v_acodec and v_acodec != "none" and v_acodec != "unknown":
                return {
                    "is_dash": False,
                    "url": best_v_fmt["url"],
                    "quality_id": quality_id,
                    "format_id": best_v_fmt.get("format_id")
                }, None, None

            # 2. Jika DASH (video-only), cari audio format terbaik (m4a / aac)
            best_a_fmt = None
            best_a_score = -1
            for f in formats:
                acodec = f.get("acodec") or ""
                if not acodec or acodec == "none":
                    continue
                vcodec = f.get("vcodec") or ""
                if vcodec and vcodec != "none":
                    continue  # Jangan ambil video stream sebagai audio

                ext = f.get("ext") or ""
                abr = f.get("abr") or 0
                score = abr
                if "mp4a" in acodec.lower() or ext == "m4a":
                    score += 100  # Prioritaskan M4A/AAC untuk Android compatibility

                if score > best_a_score and f.get("url"):
                    best_a_score = score
                    best_a_fmt = f

            return {
                "is_dash": True,
                "video_url": best_v_fmt["url"],
                "audio_url": best_a_fmt["url"] if best_a_fmt else None,
                "quality_id": quality_id,
                "video_format_id": best_v_fmt.get("format_id"),
                "audio_format_id": best_a_fmt.get("format_id") if best_a_fmt else None
            }, None, None

    except Exception as e:
        return None, "QUALITY_URL_ERROR", str(e)


def extract_quality_url(video_id: str, quality_id: str, ydl_opts: dict = None, cookie_path: str = None) -> dict:
    """
    Wrapper fungsi skrip untuk dipanggil oleh runner.py / Native Module.
    """
    res, code, err = get_quality_stream_url(video_id, quality_id, ydl_opts, cookie_path)
    if code or err:
        return {
            "status": "error",
            "code": code or "QUALITY_URL_ERROR",
            "error": err or str(code)
        }
    return {
        "status": "success",
        **res
    }

