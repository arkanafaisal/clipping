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
ffmpeg_target_name = 'ffmpeg.exe' if os.name == 'nt' else 'ffmpeg'
ffmpeg_exe = os.path.join(ffmpeg_dir, ffmpeg_target_name)

if not os.path.exists(ffmpeg_exe):
    shutil.copyfile(ffmpeg_src, ffmpeg_exe)
    # Ensure it's executable on Linux
    if os.name != 'nt':
        os.chmod(ffmpeg_exe, 0o755)
    
# Hanya injeksi ke PATH jika ffmpeg bawaan sistem tidak ditemukan
import shutil as sys_shutil
if not sys_shutil.which('ffmpeg') and ffmpeg_dir not in os.environ['PATH']:
    os.environ['PATH'] = os.environ.get('PATH', '') + os.pathsep + ffmpeg_dir

import yt_dlp
from yt_dlp.utils import download_range_func

def sanitize_filename(name):
    return re.sub(r'[\\/*?:"<>|]', "", name).strip()

def add_cookies(ydl_opts):
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cookie_path = os.path.join(base_dir, 'cookies.txt')
    if os.path.exists(cookie_path):
        ydl_opts['cookiefile'] = cookie_path
        
    # Bypass PO Token / "The page needs to be reloaded"
    if 'extractor_args' not in ydl_opts:
        ydl_opts['extractor_args'] = {}
    ydl_opts['extractor_args']['youtube'] = {'player_client': ['ios', 'android']}
    
    return ydl_opts

def format_time_filename(seconds):
    hours = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    # Menggunakan titik (.) karena titik dua (:) ilegal di nama file Windows
    return f"{hours:02d}.{mins:02d}.{secs:02d}"

def get_output_filename(folder, rank, start_time, end_time, base_ext='.mp4'):
    start_str = format_time_filename(start_time)
    end_str = format_time_filename(end_time)
    time_suffix = f"{start_str} - {end_str}"
    
    existing_files = glob.glob(os.path.join(folder, f"*{time_suffix}*.mp4"))
    
    if existing_files:
        return os.path.basename(existing_files[0]), True
            
    return f"{time_suffix}{base_ext}", False

def download_preview_clip(video_url, clip, temp_dir):
    start_time = clip['start_time']
    end_time = clip['end_time']
    
    filename = f"preview_{int(time.time())}_{start_time}_{end_time}.mp4"
    filepath = os.path.join(temp_dir, filename)
    
    ydl_opts = {
        'format': 'worstvideo[ext=mp4]+worstaudio[ext=m4a]/worst[ext=mp4]/worst',
        'outtmpl': filepath,
        'download_ranges': download_range_func(None, [(start_time, end_time)]),
        'force_keyframes_at_cuts': True,
        'external_downloader_args': {
            'ffmpeg_i': [
                '-reconnect', '1', 
                '-reconnect_streamed', '1', 
                '-reconnect_delay_max', '5'
            ],
            'ffmpeg': ['-c:v', 'libx264', '-preset', 'ultrafast', '-loglevel', 'warning']
        },
        'quiet': True,
        'no_warnings': True,
    }
    ydl_opts = add_cookies(ydl_opts)
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([video_url])
        if os.path.exists(filepath):
            return filepath
    except Exception as e:
        print(f"[GAGAL PREVIEW] {e}")
    return None

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
            'ffmpeg': ['-c:v', 'libx264', '-preset', 'ultrafast', '-loglevel', 'warning']
        },
        'quiet': False,
        'no_warnings': True,
    }
    ydl_opts = add_cookies(ydl_opts)
    
    download_start_time = time.time()
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([video_url])
            
        # Post-Processing: Force Portrait 9:16 Padding using FFmpeg
        if os.path.exists(filepath):
            import subprocess
            temp_filepath = filepath + ".temp.mp4"
            print(f"Menyematkan dinding hitam (Auto-Padding) ke format Shorts (1080x1920)...")
            ffmpeg_cmd = [
                ffmpeg_exe, '-y', '-i', filepath, 
                '-c:v', 'libx264', '-preset', 'ultrafast', 
                '-vf', 'scale=1080:-2,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black', 
                '-c:a', 'copy', temp_filepath
            ]
            try:
                subprocess.run(ffmpeg_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                if os.path.exists(temp_filepath):
                    import shutil
                    shutil.move(temp_filepath, filepath)
                    print(f"Klip berhasil diformat menjadi Portrait Shorts!")
            except subprocess.CalledProcessError as e:
                print(f"Peringatan: Gagal melakukan Auto-Padding pada klip {rank}: {e}")
                if os.path.exists(temp_filepath):
                    os.remove(temp_filepath)

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
    output_dir = os.path.join(os.getcwd(), "output", safe_title)
    
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

def check_youtube_auth():
    print("\n=====================================================")
    print("🛡️ Mengecek Status Autentikasi YouTube...")
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cookie_path = os.path.join(base_dir, 'cookies.txt')
    
    if not os.path.exists(cookie_path):
        print("❌ File cookies.txt TIDAK ditemukan.")
        print("⚠️ Bot berjalan pada mode Non-Login (Sangat rawan terblokir Anti-Bot YouTube).")
        print("=====================================================\n")
        return False

    print("✅ File cookies.txt ditemukan. Memvalidasi isi...")
    try:
        with open(cookie_path, 'r', encoding='utf-8') as f:
            content = f.read()
            if '.youtube.com' not in content:
                print("❌ Isi cookies.txt tidak valid (tidak mendeteksi sesi untuk .youtube.com).")
                print("⚠️ Pastikan Anda mengekspor cookies saat berada di halaman YouTube.")
                print("=====================================================\n")
                return False
    except Exception as e:
        print(f"❌ Gagal membaca file cookies.txt: {e}")
        return False

    print("⏳ Mencoba simulasi koneksi ke YouTube...")
    ydl_opts = {
        'cookiefile': cookie_path,
        'quiet': True,
        'no_warnings': True,
        'extract_flat': True,
        'skip_download': True,
        'extractor_args': {'youtube': {'player_client': ['ios', 'android']}}
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Menggunakan ytsearch agar tidak perlu parsing format video yang berat
            ydl.extract_info("ytsearch1:test", download=False)
            print("✅ Autentikasi SUKSES! YouTube menerima Cookies Anda.")
            print("🛡️ Anda bebas dari blokir Anti-Bot!")
            print("=====================================================\n")
            return True
    except Exception as e:
        err_msg = str(e).lower()
        if "sign in to confirm" in err_msg or "bot" in err_msg or "cookies" in err_msg:
            print("❌ Autentikasi GAGAL! Cookies mungkin sudah kedaluwarsa, tidak punya akses, atau IP terblokir keras.")
        else:
            print(f"⚠️ Koneksi bermasalah: {e}")
        print("=====================================================\n")
        return False
