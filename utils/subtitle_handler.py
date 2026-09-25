import os
import yt_dlp
import requests
from utils.file_utils import format_time_filename

def extract_subtitle(video_url, start_time, end_time, lang='id'):
    print(f"\n[SUBTITLE] Mengekstrak transkrip dari {video_url} ({start_time} - {end_time})")
    
    cookie_path = os.path.join(os.getcwd(), 'cookies.txt')
    ydl_opts = {
        'quiet': True,
        'extract_flat': False,
        'skip_download': True,
        'writesubtitles': True,
        'writeautomaticsub': True,
        'subtitleslangs': [lang, 'en'],
        'subtitlesformat': 'json3',
        'extractor_args': {'youtube': {'player_client': ['ios', 'android']}}
    }
    if os.path.exists(cookie_path):
        ydl_opts['cookiefile'] = cookie_path
        
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)
            
        subs = info.get('subtitles') or {}
        auto_subs = info.get('automatic_captions') or {}
        
        # Prioritas: Manual Lang -> Auto Lang -> Manual EN -> Auto EN
        selected_sub_url = None
        for l in [lang, 'en']:
            if l in subs and len(subs[l]) > 0:
                for s in subs[l]:
                    if s.get('ext') == 'json3':
                        selected_sub_url = s['url']
                        break
                if selected_sub_url: break
                
            if l in auto_subs and len(auto_subs[l]) > 0:
                for s in auto_subs[l]:
                    if s.get('ext') == 'json3':
                        selected_sub_url = s['url']
                        break
                if selected_sub_url: break

        if not selected_sub_url:
            return None, "Video ini tidak memiliki subtitle tertutup (CC) atau auto-caption."
            
        r = requests.get(selected_sub_url)
        data = r.json()
        
        results = []
        events = data.get('events', [])
        for event in events:
            if 'segs' not in event:
                continue
            t_start = event.get('tStartMs', 0) / 1000.0
            t_duration = event.get('dDurationMs', 0) / 1000.0
            t_end = t_start + t_duration
            
            # Cek overlap dengan rentang yang diminta
            if t_end > start_time and t_start < end_time:
                text = "".join([seg.get('utf8', '') for seg in event['segs']]).strip()
                if text and text != '\n':
                    # Hitung waktu relatif terhadap awal klip
                    rel_time = max(0, t_start - start_time)
                    time_str = format_time_filename(rel_time).split('.')
                    # Ambil hanya menit dan detik
                    time_formatted = f"{time_str[1]}:{time_str[2]}" 
                    results.append(f"[{time_formatted}] {text.replace(chr(10), ' ')}")
                    
        if not results:
            return None, "Tidak ada ucapan yang terdeteksi pada rentang waktu ini."
            
        return "\n".join(results), None
        
    except Exception as e:
        return None, f"Gagal mengekstrak transkrip: {e}"
