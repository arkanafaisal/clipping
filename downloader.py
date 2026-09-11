import os
import sys
import time
import imageio_ffmpeg
import shutil
import re
import glob

# [BUGFIX] Injeksi PATH dilakukan di level modul (sebelum fungsi yt-dlp dipanggil di mana pun)
# Hal ini untuk mencegah yt-dlp menyimpan cache 'ffmpeg = False' saat ia digunakan di file lain (seperti heatmap.py).
ffmpeg_src = imageio_ffmpeg.get_ffmpeg_exe()
ffmpeg_dir = os.path.dirname(ffmpeg_src)
ffmpeg_exe = os.path.join(ffmpeg_dir, 'ffmpeg.exe')

if not os.path.exists(ffmpeg_exe):
    shutil.copyfile(ffmpeg_src, ffmpeg_exe)
    
if ffmpeg_dir not in os.environ['PATH']:
    os.environ['PATH'] = ffmpeg_dir + os.pathsep + os.environ.get('PATH', '')

import yt_dlp
from yt_dlp.utils import download_range_func

def sanitize_filename(name):
    return re.sub(r'[\\/*?:"<>|]', "", name).strip()

def format_time_filename(seconds):
    hours = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    # Menggunakan titik (.) karena titik dua (:) ilegal di nama file Windows
    return f"{hours:02d}.{mins:02d}.{secs:02d}"

def get_output_filename(folder, rank, start_time, end_time, base_ext='.mp4'):
    base_prefix = f"Part {rank}"
    start_str = format_time_filename(start_time)
    end_str = format_time_filename(end_time)
    time_suffix = f"[{start_str} - {end_str}]"
    
    # Cari semua file yang merupakan Part {rank}
    existing_files = glob.glob(os.path.join(folder, f"{base_prefix}*.mp4"))
    
    # Cek apakah persis ada yang detiknya sama
    for f in existing_files:
        if time_suffix in f:
            return os.path.basename(f), True # Menandakan file persis sudah ada
            
    # Jika tidak ada yang detiknya persis sama, cari versi tertinggi
    version = 1
    if existing_files:
        max_ver = 1
        for f in existing_files:
            match = re.search(r'_ver(\d+)', f)
            if match:
                max_ver = max(max_ver, int(match.group(1)))
        version = max_ver + 1
        
    if version == 1:
        return f"{base_prefix} {time_suffix}{base_ext}", False
    else:
        return f"{base_prefix}_ver{version} {time_suffix}{base_ext}", False

def download_single_clip(video_url, output_dir, clip, i=0, total_clips=1):
    """
    Mengunduh satu klip dan mengembalikan absolute path dari file yang diunduh (atau diskip).
    """
    rank = clip['rank']
    start_time = clip['start_time']
    end_time = clip['end_time']
    
    filename, exists = get_output_filename(output_dir, rank, start_time, end_time)
    filepath = os.path.join(output_dir, filename)
    
    start_str_print = format_time_filename(start_time).replace('.', ':')
    end_str_print = format_time_filename(end_time).replace('.', ':')
    
    if exists:
        print(f"\n[{i+1}/{total_clips}] Melewati Klip Peringkat {rank} (Klip dengan waktu yang sama persis sudah ada di folder)")
        return filepath
        
    print(f"\n[{i+1}/{total_clips}] Mengunduh Klip Peringkat {rank} ({start_str_print} - {end_str_print})")
    print(f"Menyimpan ke: {filepath}")
    
    ydl_opts = {
        'format': '22/18/bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        'outtmpl': filepath,
        'download_ranges': download_range_func(None, [(start_time, end_time)]),
        'force_keyframes_at_cuts': True,
        'external_downloader_args': {
            'ffmpeg_i': [
                '-reconnect', '1', 
                '-reconnect_streamed', '1', 
                '-reconnect_delay_max', '5'
            ],
            'ffmpeg': ['-loglevel', 'warning']
        },
        'quiet': False,
        'no_warnings': True,
    }
    
    download_start_time = time.time()
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([video_url])
        elapsed_time = time.time() - download_start_time
        print(f"[SUKSES] Klip Peringkat {rank} berhasil diunduh! (waktu proses: {elapsed_time:.1f} detik)")
        return filepath
    except Exception as e:
        elapsed_time = time.time() - download_start_time
        print(f"[GAGAL] Gagal mengunduh Klip Peringkat {rank} setelah {elapsed_time:.1f} detik: {e}")
        return None

def download_clips(video_url, video_title, clips, batch_size=5, sleep_time=10):
    """
    Mengunduh klip-klip tertentu dari video YouTube.
    
    clips: List of dict, setiap dict harus memiliki 'rank', 'start_time', 'end_time'
    """
    total_clips = len(clips)
    print(f"\nMemulai pengunduhan {total_clips} klip...")
    
    safe_title = sanitize_filename(video_title) if video_title else "YouTube_Clips"
    output_dir = os.path.join(os.getcwd(), safe_title)
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        print(f"Membuat folder output: {output_dir}")
        
    for i, clip in enumerate(clips):
        download_single_clip(video_url, output_dir, clip, i, total_clips)
        
        # Logika Batching & Istirahat (Anti-Rate Limit)
        if (i + 1) < total_clips and (i + 1) % batch_size == 0:
            print(f"\n[INFO] Telah mengunduh {batch_size} klip beruntun.")
            print(f"Beristirahat selama {sleep_time} detik untuk menghindari pemblokiran IP YouTube...")
            time.sleep(sleep_time)

    print("\n[SELESAI] Semua proses pengunduhan selesai!")
