import os
import yt_dlp

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def get_raw_heatmap(video_id_or_url: str, custom_opts: dict = None) -> tuple:
    """
    Mengambil data mentah heatmap ('Most Replayed') dan title video dari YouTube secara pass-through.
    Seluruh kalkulasi offset, sorting ranking, dan formatting klip didelegasikan ke frontend.
    
    Returns:
        tuple: (heatmap: list, title: str, error: str | None)
    """
    if "youtube.com" in video_id_or_url or "youtu.be" in video_id_or_url:
        video_url = video_id_or_url
    else:
        video_url = f"https://www.youtube.com/watch?v={video_id_or_url}"

    ydl_opts = {
        'skip_download': True,
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False
    }

    # Inject cookies jika ada
    cookie_path = os.path.join(BASE_DIR, 'cookies.txt')
    if os.path.exists(cookie_path):
        ydl_opts['cookiefile'] = cookie_path
        
    ydl_opts['extractor_args'] = {'youtube': {'player_client': ['ios', 'android']}}

    # 100% Dynamic: Override dengan opsi yang dikirim oleh request body frontend
    if custom_opts and isinstance(custom_opts, dict):
        ydl_opts.update(custom_opts)

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)
            heatmap = info.get('heatmap') or []
            title = info.get('title') or ""
            
            if not heatmap:
                return [], title, "Heatmap tidak ditemukan. Video ini mungkin belum memiliki data 'Most Replayed'."
                
            return heatmap, title, None

    except Exception as e:
        error_msg = str(e)
        print(f"[HEATMAP EXTRACTOR ERROR] Gagal mengambil heatmap: {error_msg}")
        return [], "", error_msg

# Backward-compatibility alias
def get_top_clips(video_url, num_clips=10, offset=0):
    heatmap, title, err = get_raw_heatmap(video_url)
    if err or not heatmap:
        return [], title
    # Sort and return raw for legacy callers
    top = sorted(heatmap, key=lambda x: x.get('value', 0), reverse=True)[:num_clips]
    return top, title