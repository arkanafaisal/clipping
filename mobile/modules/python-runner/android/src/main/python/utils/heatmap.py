import os
import yt_dlp

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Ganti dengan link video YouTube target
VIDEO_URL = "https://youtu.be/t6h8Uae2Q_E"
ydl_opts = {
    'skip_download': True,
    'quiet': True,
    'no_warnings': True,
}

cookie_path = os.path.join(BASE_DIR, 'cookies.txt')
if os.path.exists(cookie_path):
    ydl_opts['cookiefile'] = cookie_path
    
ydl_opts['extractor_args'] = {'youtube': {'player_client': ['ios', 'android']}}

def format_time(seconds):
    hours = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    
    if hours > 0:
        return f"{hours:02d}:{mins:02d}:{secs:02d}"
    return f"{mins:02d}:{secs:02d}"

def get_top_clips(video_url, num_clips=10, offset=0):
    """
    Mengambil data heatmap dari video YouTube dan mengembalikan list of raw clips.
    """
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)
            heatmap = info.get('heatmap')

        if not heatmap:
            print("Heatmap tidak ditemukan. Video ini mungkin belum memiliki data 'Most Replayed'.")
            return [], ""
            
        # Urutkan berdasarkan intensitas tertinggi
        top_moments = sorted(heatmap, key=lambda x: x.get('value', 0), reverse=True)[:num_clips]
        
        print(f"Judul Video: {info.get('title')}\n")
        print(f"{len(top_moments)} Rekomendasi Klip (Original Data Heatmap):")
        print("-" * 65)
        
        processed_clips = []
        for rank, moment in enumerate(top_moments, start=1):
            original_start = moment['start_time']
            original_end = moment['end_time']
            
            start_time = original_start - offset
            end_time = original_end + offset
            
            # Validasi jika offset negatif menyebabkan durasi terbalik / negatif
            if end_time <= start_time:
                # Sisakan setidaknya 2 detik di tengah
                mid = (original_start + original_end) / 2
                start_time = max(0, int(mid - 1))
                end_time = start_time + 2
            else:
                start_time = max(0, start_time)
            
            start_str = format_time(start_time)
            end_str = format_time(end_time)
            
            print(f"Peringkat {rank}: {start_str} - {end_str} (Durasi: {end_time - start_time:.0f} detik) | Skor Puncak: {moment['value']:.3f}")
            
            processed_clips.append({
                'rank': rank,
                'original_start': original_start,
                'start_time': start_time,
                'end_time': end_time,
                'duration': end_time - start_time,
                'value': moment['value']
            })
            
        return processed_clips, info.get('title')

    except Exception as e:
        print(f"Terjadi kesalahan: {e}")
        return [], ""

if __name__ == "__main__":
    print("--- YT Clipper - Heatmap Extractor ---")
    
    input_url = input("Masukkan URL YouTube: ").strip()
    if not input_url:
        input_url = VIDEO_URL
        
    input_num = input("Masukkan jumlah klip: ").strip()
    num_clips = int(input_num) if input_num.isdigit() else 10
    
    input_offset = input("Masukkan detik offset awal & akhir: ").strip()
    offset = int(input_offset) if input_offset.isdigit() else 0
    
    print("\nMemproses video...")
    raw_clips, video_title = get_top_clips(input_url, num_clips=num_clips, offset=offset)