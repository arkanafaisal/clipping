import yt_dlp

# Ganti dengan link video YouTube target
VIDEO_URL = "https://youtu.be/t6h8Uae2Q_E"
ydl_opts = {
    'skip_download': True,
    'quiet': True,
    'no_warnings': True,
}

def format_time(seconds):
    hours = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    
    if hours > 0:
        return f"{hours:02d}:{mins:02d}:{secs:02d}"
    return f"{mins:02d}:{secs:02d}"

def get_top_clips(video_url, num_clips=10):
    """
    Mengambil data heatmap dari video YouTube dan mengembalikan list of raw clips.
    """
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)
            heatmap = info.get('heatmap')

        if not heatmap:
            print("Heatmap tidak ditemukan. Video ini mungkin belum memiliki data 'Most Replayed'.")
            return []
            
        # Urutkan berdasarkan intensitas tertinggi
        top_moments = sorted(heatmap, key=lambda x: x.get('value', 0), reverse=True)[:num_clips]
        
        print(f"Judul Video: {info.get('title')}\n")
        print(f"{len(top_moments)} Rekomendasi Klip (Original Data Heatmap):")
        print("-" * 65)
        
        for rank, moment in enumerate(top_moments, start=1):
            start_time = moment['start_time']
            end_time = moment['end_time']
            
            start_str = format_time(start_time)
            end_str = format_time(end_time)
            
            print(f"Peringkat {rank}: {start_str} - {end_str} (Durasi: {end_time - start_time:.0f} detik) | Skor Puncak: {moment['value']:.3f}")
            
        return top_moments

    except Exception as e:
        print(f"Terjadi kesalahan: {e}")
        return []

if __name__ == "__main__":
    # Variabel raw_clips ini berisi data mentah list of dictionary 
    # yang siap digunakan untuk step selanjutnya (download dsb)
    raw_clips = get_top_clips(VIDEO_URL, num_clips=10)