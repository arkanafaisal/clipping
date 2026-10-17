import os
import json
import traceback
import yt_dlp

def extract_subtitles_data(video_id: str, ydl_opts: dict = None, cookie_path: str = None, preferred_lang: str = None) -> dict:
    """
    Ekstrak data mentah subtitle / caption dari YouTube secara murni pass-through tanpa pemrosesan berlebih.
    Mencoba mode anonim terlebih dahulu. Jika gagal dan cookie_path valid dikirimkan oleh frontend,
    mencoba sekali lagi menggunakan cookies.
    
    Returns:
        dict: { status: 'success', video_id, lang, is_auto, format, raw_data, available_languages }
              atau { status: 'error', code, error, traceback }
    """
    if not video_id:
        return {
            "status": "error",
            "code": "VIDEO_ID_REQUIRED",
            "error": "Parameter 'video_id' wajib diisi.",
            "traceback": ""
        }

    url = f"https://www.youtube.com/watch?v={video_id}"
    base_opts = (ydl_opts or {}).copy()
    base_opts['skip_download'] = True
    base_opts['writesubtitles'] = True
    base_opts['writeautomaticsub'] = True
    if 'subtitleslangs' not in base_opts:
        base_opts['subtitleslangs'] = ['id', 'en', 'all']

    first_error = None
    first_tb = None

    # 1. Percobaan Pertama: Mode Anonim
    opts_anon = base_opts.copy()
    opts_anon.pop('cookiefile', None)
    
    try:
        with yt_dlp.YoutubeDL(opts_anon) as ydl:
            return _process_extraction(ydl, url, video_id, preferred_lang)
    except Exception as e:
        first_error = str(e)
        first_tb = traceback.format_exc()

    # 2. Percobaan Kedua: Mode Cookies jika anonim gagal
    if cookie_path and os.path.exists(cookie_path):
        opts_cookies = base_opts.copy()
        opts_cookies['cookiefile'] = cookie_path
        try:
            with yt_dlp.YoutubeDL(opts_cookies) as ydl:
                return _process_extraction(ydl, url, video_id, preferred_lang)
        except Exception as e:
            err_msg = str(e)
            is_limit = any(k in err_msg.lower() for k in ["429", "403", "forbidden", "access denied", "rate limit", "bot", "captcha", "sign in"])
            code = "RATE_LIMIT_EXCEEDED" if is_limit else "EXTRACTOR_ERROR"
            return {
                "status": "error",
                "code": code,
                "error": err_msg,
                "traceback": traceback.format_exc()
            }

    err_msg = first_error or "Gagal mengekstrak data subtitle dari YouTube."
    is_limit = any(k in err_msg.lower() for k in ["429", "403", "forbidden", "access denied", "rate limit", "bot", "captcha", "sign in"])
    code = "RATE_LIMIT_EXCEEDED" if is_limit else "EXTRACTOR_ERROR"
    return {
        "status": "error",
        "code": code,
        "error": err_msg,
        "traceback": first_tb or ""
    }


def _process_extraction(ydl, url: str, video_id: str, preferred_lang: str = None) -> dict:
    info = ydl.extract_info(url, download=False)
    manual_subs = info.get('subtitles') or {}
    auto_subs = info.get('automatic_captions') or {}

    if not manual_subs and not auto_subs:
        return {
            "status": "error",
            "code": "SUBTITLE_NOT_FOUND",
            "error": "Video ini tidak memiliki subtitle manual maupun automatic captions dari YouTube.",
            "traceback": ""
        }

    is_auto = False
    target_subs = manual_subs
    if not target_subs:
        target_subs = auto_subs
        is_auto = True

    available_langs = list(target_subs.keys())
    chosen_lang = None

    if preferred_lang and preferred_lang in target_subs:
        chosen_lang = preferred_lang
    elif 'id' in target_subs:
        chosen_lang = 'id'
    elif 'en' in target_subs:
        chosen_lang = 'en'
    else:
        id_match = next((l for l in available_langs if l.startswith('id')), None)
        en_match = next((l for l in available_langs if l.startswith('en')), None)
        chosen_lang = id_match or en_match or available_langs[0]

    formats = target_subs.get(chosen_lang) or []
    if not formats:
        return {
            "status": "error",
            "code": "SUBTITLE_NOT_FOUND",
            "error": f"Format subtitle untuk bahasa '{chosen_lang}' tidak ditemukan.",
            "traceback": ""
        }

    # Prioritaskan format json3 (terstruktur), fallback ke format umum
    chosen_fmt = next((f for f in formats if f.get('ext') == 'json3'), None)
    if not chosen_fmt:
        chosen_fmt = next((f for f in formats if f.get('ext') in ('vtt', 'srt', 'ttml', 'srv1')), formats[0])

    fmt_ext = chosen_fmt.get('ext', 'unknown')
    fmt_url = chosen_fmt.get('url')

    if not fmt_url:
        return {
            "status": "error",
            "code": "SUBTITLE_URL_MISSING",
            "error": "URL unduhan track subtitle tidak tersedia.",
            "traceback": ""
        }

    resp = ydl.urlopen(fmt_url)
    raw_content = resp.read().decode('utf-8', errors='replace')

    parsed_data = None
    if fmt_ext == 'json3':
        try:
            parsed_data = json.loads(raw_content)
        except Exception:
            parsed_data = raw_content
    else:
        parsed_data = raw_content

    return {
        "status": "success",
        "video_id": video_id,
        "lang": chosen_lang,
        "is_auto": is_auto,
        "format": fmt_ext,
        "raw_data": parsed_data,
        "available_languages": available_langs
    }
