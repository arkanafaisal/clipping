import os
import json
import traceback
import yt_dlp

def extract_subtitles_data(video_id: str, ydl_opts: dict = None, cookie_path: str = None, preferred_lang: str = None) -> dict:
    """
    Ekstrak data mentah subtitle / caption dari YouTube secara murni pass-through tanpa pemrosesan berlebih.
    Mengeksekusi sekali jalan (single pass) tanpa retry otomatis:
    - Jika cookie_path valid dikirimkan oleh frontend, gunakan cookies.
    - Jika tidak, jalankan dalam mode anonim.
    
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

    if cookie_path and os.path.exists(cookie_path):
        base_opts['cookiefile'] = cookie_path
        # Reset player_client ke web & mweb karena browser cookies (format Netscape)
        # hanya didukung oleh web player, bukan native app (android/ios).
        if 'extractor_args' in base_opts and isinstance(base_opts['extractor_args'], dict):
            new_ext_args = {k: (v.copy() if isinstance(v, dict) else v) for k, v in base_opts['extractor_args'].items()}
            if 'youtube' in new_ext_args and isinstance(new_ext_args['youtube'], dict):
                yt_args = new_ext_args['youtube'].copy()
                yt_args['player_client'] = ['web', 'mweb']
                new_ext_args['youtube'] = yt_args
            base_opts['extractor_args'] = new_ext_args
    else:
        base_opts.pop('cookiefile', None)

    try:
        with yt_dlp.YoutubeDL(base_opts) as ydl:
            return _process_extraction(ydl, url, video_id, preferred_lang)
    except Exception as e:
        return {
            "status": "error",
            "code": "SUBTITLE_ERROR",
            "error": str(e),
            "traceback": traceback.format_exc()
        }


def _process_extraction(ydl, url: str, video_id: str, preferred_lang: str = None) -> dict:
    info = ydl.extract_info(url, download=False)
    # Filter keluar 'live_chat' karena live_chat replay bukan track subtitle/caption
    manual_subs = {k: v for k, v in (info.get('subtitles') or {}).items() if k != 'live_chat'}
    auto_subs = {k: v for k, v in (info.get('automatic_captions') or {}).items() if k != 'live_chat'}

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

    if preferred_lang:
        if preferred_lang in target_subs:
            chosen_lang = preferred_lang
        else:
            pref_match = next((l for l in available_langs if l.startswith(preferred_lang)), None)
            if pref_match:
                chosen_lang = pref_match

    if not chosen_lang:
        if 'id' in target_subs:
            chosen_lang = 'id'
        elif 'en' in target_subs:
            chosen_lang = 'en'
        elif 'ja' in target_subs:
            chosen_lang = 'ja'
        else:
            id_match = next((l for l in available_langs if l.startswith('id')), None)
            en_match = next((l for l in available_langs if l.startswith('en')), None)
            ja_match = next((l for l in available_langs if l.startswith('ja')), None)
            chosen_lang = id_match or en_match or ja_match or available_langs[0]

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
