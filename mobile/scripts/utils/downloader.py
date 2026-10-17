import os
import sys
import time
import imageio_ffmpeg
import shutil
import re
import glob
import json
import subprocess

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
from utils.youtube_auth import get_valid_po_token, add_cookies, check_youtube_auth
from utils.file_utils import sanitize_filename, format_time_filename, get_output_filename

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

def apply_portrait_padding(filepath, rank, ffmpeg_exe):
    import subprocess
    import shutil
    import os
    
    portrait_filepath = filepath.replace(".mp4", ".portrait.mp4")
    if os.path.exists(portrait_filepath):
        return portrait_filepath
        
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
            shutil.move(temp_filepath, portrait_filepath)
            print(f"Klip berhasil diformat menjadi Portrait Shorts! (Landscape asli tetap aman)")
            return portrait_filepath
    except subprocess.CalledProcessError as e:
        print(f"Peringatan: Gagal melakukan Auto-Padding pada klip {rank}: {e}")
        if os.path.exists(temp_filepath):
            os.remove(temp_filepath)
            
    return filepath

def download_single_clip(video_url, output_dir, clip, i=0, total_clips=1, force_portrait=False):
    # FUNGSI INI SUDAH TIDAK DIPAKAI (DEPRECATED)
    # Semua download dialihkan ke download_full_video_and_cut
    return None
    
    start_str_print = format_time_filename(start_time).replace('.', ':')
    end_str_print = format_time_filename(end_time).replace('.', ':')
    
    if exists:
        print(f"\n[{i+1}/{total_clips}] Melewati Klip Peringkat {rank} (Klip dengan waktu yang sama persis sudah ada di folder)")
        if force_portrait:
            filepath = apply_portrait_padding(filepath, rank, ffmpeg_exe)
        return filepath
        
    print(f"\n[{i+1}/{total_clips}] Mengunduh Klip Peringkat {rank} ({start_str_print} - {end_str_print})")
    print(f"Menyimpan ke: {filepath}")
    
    ydl_opts = {
        'format': 'bestvideo+bestaudio/best',
        'outtmpl': filepath,
        'download_ranges': download_range_func(None, [(start_time, end_time)]),
        'force_keyframes_at_cuts': True,
        'external_downloader_args': {
            'ffmpeg_i': [
                '-user_agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1',
                '-headers', 'Origin: https://www.youtube.com\r\nReferer: https://www.youtube.com/\r\n',
                '-reconnect', '1', 
                '-reconnect_streamed', '1', 
                '-reconnect_delay_max', '5'
            ],
            'ffmpeg': ['-c:v', 'libx264', '-preset', 'ultrafast', '-loglevel', 'warning']
        },
        'quiet': False,
        'no_warnings': True,
        'merge_output_format': 'mp4'
    }
    
    # 1. Coba Mode Anonim (Tanpa Cookies) - Bebas PO Token, Target Prime HD
    ydl_opts_anon = ydl_opts.copy() # Asli, tanpa cookies
    
    download_start_time = time.time()
    try:
        with yt_dlp.YoutubeDL(ydl_opts_anon) as ydl_anon:
            ydl_anon.download([video_url])
    except Exception as e_anon:
        print(f"⚠️ Mode Anonim gagal (Mungkin video Age-Restricted/Terblokir IP): {e_anon}")
        print(f"Mencoba Mode Cookies (Web) demi mempertahankan Kualitas Prime...")
        
        # 2. Coba gunakan Web Client + Cookies
        ydl_opts_main = add_cookies(ydl_opts.copy(), client_type='web')
        try:
            with yt_dlp.YoutubeDL(ydl_opts_main) as ydl:
                ydl.download([video_url])
        except Exception as e:
            print(f"⚠️ Mode Cookies gagal: {e}")
            print(f"Mencoba jalur darurat penyamaran iOS (Kualitas terpaksa mentok di 360p)...")
            
            # 3. Coba iOS + Cookies (Pasti tembus tapi 360p karena SABR)
            ydl_opts_ios = add_cookies(ydl_opts.copy(), client_type='ios')
            try:
                with yt_dlp.YoutubeDL(ydl_opts_ios) as ydl_ios:
                    ydl_ios.download([video_url])
            except Exception as e_ios:
                elapsed_time = time.time() - download_start_time
                print(f"[GAGAL] Semua metode pengunduhan Klip Peringkat {rank} gagal setelah {elapsed_time:.1f} detik: {e_ios}")
                return None
            
    # Post-Processing: Force Portrait 9:16 Padding using FFmpeg
    if force_portrait and os.path.exists(filepath):
        filepath = apply_portrait_padding(filepath, rank, ffmpeg_exe)

    elapsed_time = time.time() - download_start_time
    print(f"[SUKSES] Klip Peringkat {rank} berhasil diunduh! (waktu proses: {elapsed_time:.1f} detik)")
    return filepath

def download_full_video_robust(video_url, full_video_path, cancel_check=None, extra_hooks=None):
    if os.path.exists(full_video_path):
        return True
        
    def my_hook(d):
        if cancel_check and cancel_check():
            raise Exception("DibatalkanOlehUser")
            
    hooks = [my_hook]
    if extra_hooks:
        hooks.extend(extra_hooks)
            
    ydl_opts = {
        'format': 'bestvideo+bestaudio/best',
        'outtmpl': full_video_path,
        'quiet': False,
        'no_warnings': True,
        'merge_output_format': 'mp4',
        'progress_hooks': hooks,
        'retries': 15,
        'fragment_retries': 15,
        'socket_timeout': 60
    }
    
    info_json_path = full_video_path.replace(".mp4", ".info.json")
    
    def try_download(opts_base, use_cookies=False):
        opts = opts_base.copy()
        if use_cookies:
            from utils.youtube_auth import add_cookies
            opts = add_cookies(opts, client_type='web_no_po')
            
        if os.path.exists(info_json_path):
            opts_cache = opts.copy()
            opts_cache['load_info_filename'] = info_json_path
            print("\n🚀 Melanjutkan progress download menggunakan CACHE URL Stream...")
            try:
                with yt_dlp.YoutubeDL(opts_cache) as ydl:
                    ydl.download([video_url])
                return True
            except Exception as e:
                if "DibatalkanOlehUser" in str(e):
                    raise e
                print(f"⚠️ Cache URL kedaluwarsa ({e}). Menghapus cache dan mengambil URL stream baru dari YouTube...")
                try: os.remove(info_json_path)
                except: pass
                
        opts['writeinfojson'] = True
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.download([video_url])
        return True

    try:
        try_download(ydl_opts, use_cookies=False)
        return True
    except Exception as e_anon:
        if "DibatalkanOlehUser" in str(e_anon):
            print("\n🛑 Download video utuh DIBATALKAN oleh user!")
            return False
        print(f"⚠️ Mode Anonim gagal: {e_anon}")
        print(f"Mencoba Mode Cookies (Web) standar...")
        
        try:
            try_download(ydl_opts, use_cookies=True)
            return True
        except Exception as e:
            if "DibatalkanOlehUser" in str(e):
                print("\n🛑 Download video utuh DIBATALKAN oleh user!")
                return False
            print(f"[GAGAL] Semua metode pengunduhan Prime gagal: {e}")
            return False

def process_clips_generator(video_url, output_dir, clips, force_portrait=False, cancel_check=None):
    import subprocess
    import tempfile
    
    full_video_path = os.path.join(output_dir, "Full_Video.mp4")
    
    # 1. Cek apakah semua klip sudah ada
    all_exist = True
    for clip in clips:
        rank = clip['rank']
        start_time = clip['start_time']
        end_time = clip['end_time']
        filename, exists = get_output_filename(output_dir, rank, start_time, end_time)
        if not exists:
            all_exist = False
            break
            
    # 2. Download video utuh jika ada yang kurang
    if not all_exist:
        if cancel_check and cancel_check():
            return
            
        print(f"\n[SAFE MODE] Men-download video utuh untuk memotong bagian yang belum ada...")
        success = download_full_video_robust(video_url, full_video_path, cancel_check)
                    
        if not success or not os.path.exists(full_video_path):
            print(f"[GAGAL] Video utuh tidak ditemukan setelah proses pengunduhan.")
            return
            
        print(f"[SUKSES] Video utuh berhasil diunduh. Memulai pemotongan offline...")
    else:
        print("\n[SAFE MODE] Semua klip sudah tersedia secara presisi di server. Melewati pengunduhan video utuh!")
        full_video_path = None
    
    ffmpeg_exe = os.getenv('FFMPEG_BINARY', 'ffmpeg')
    
    # 3. Looping pemotongan dan Yield
    for i, clip in enumerate(clips):
        if cancel_check and cancel_check():
            print(f"\n🛑 Proses dibatalkan oleh user pada klip ke-{i+1}!")
            break
            
        rank = clip['rank']
        start_time = clip['start_time']
        end_time = clip['end_time']
        
        filename, exists = get_output_filename(output_dir, rank, start_time, end_time)
        filepath = os.path.join(output_dir, filename)
        
        if exists:
            print(f"\n[{i+1}/{len(clips)}] Melewati Klip Peringkat {rank} (sudah ada secara presisi)")
            if force_portrait:
                filepath = apply_portrait_padding(filepath, rank, ffmpeg_exe)
            yield filepath, full_video_path
            continue
            
        print(f"\n[{i+1}/{len(clips)}] Memotong Klip Peringkat {rank} secara offline...")
        
        ffmpeg_cmd = [
            ffmpeg_exe, '-y',
            '-ss', str(start_time),
            '-to', str(end_time),
            '-i', full_video_path,
            '-c', 'copy',
            filepath
        ]
        
        try:
            import time
            process = subprocess.Popen(ffmpeg_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            while process.poll() is None:
                if cancel_check and cancel_check():
                    process.terminate()
                    print(f"\n🛑 Proses FFmpeg dibatalkan secara paksa oleh user!")
                    if os.path.exists(filepath):
                        os.remove(filepath)
                    break
                time.sleep(0.5)
                
            if process.returncode == 0:
                if force_portrait and os.path.exists(filepath):
                    filepath = apply_portrait_padding(filepath, rank, ffmpeg_exe)
                print(f"[SUKSES] Klip Peringkat {rank} berhasil dipotong!")
                yield filepath, full_video_path
            else:
                if not (cancel_check and cancel_check()):
                    print(f"[GAGAL] Gagal memotong klip {rank}")
                yield None, full_video_path
        except Exception as e:
            print(f"[GAGAL] Gagal memotong klip {rank}: {e}")
            yield None, full_video_path

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

