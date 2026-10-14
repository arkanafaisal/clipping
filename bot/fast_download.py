import re
import os
import threading
from utils.downloader import download_single_clip
from utils.file_utils import get_output_filename
from neonize.proto.waE2E.WAWebProtobufsE2E_pb2 import Message, VideoMessage, ContextInfo

CANCEL_FLAGS = {}

def format_time(seconds):
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    return f"{h:02d}:{m:02d}:{s:02d}"

def parse_time_with_ms(time_str):
    parts = time_str.split(":")
    if len(parts) != 3:
        return float(time_str) # fallback
    
    h, m, s_ms = parts
    s_parts = s_ms.split(".")
    s = int(s_parts[0])
    ms = float(f"0.{s_parts[1]}") if len(s_parts) > 1 else 0.0
    
    return int(h) * 3600 + int(m) * 60 + s + ms

def handle_fast_download(client, ev, text, sender_jid):
    # !download https://www.youtube.com/watch?v=XXXXX
    # 00:00:10.500 - 00:00:25.000
    # 00:01:10.500 - 00:01:25.000
    
    url_match = re.search(r"!download\s+(https?://[^\s]+)", text, re.IGNORECASE)
    if not url_match:
        if text.startswith("!stop"):
            parts = text.split(maxsplit=1)
            if len(parts) > 1:
                stop_url = parts[1].strip()
                
                # Ekstrak ID untuk nama folder (YouTube atau GDrive)
                if "drive.google.com" in stop_url:
                    gdrive_match = re.search(r'/d/([a-zA-Z0-9_-]+)', stop_url) or re.search(r'id=([a-zA-Z0-9_-]+)', stop_url)
                    video_id = gdrive_match.group(1) if gdrive_match else None
                else:
                    video_id_match = re.search(r'(?:v=|\/)([0-9A-Za-z_-]{11})', stop_url)
                    video_id = video_id_match.group(1) if video_id_match else None
                    
                if video_id:
                    CANCEL_FLAGS[video_id] = True
                    client.send_message(ev.Info.MessageSource.Chat, f"🛑 Menerima perintah untuk menghentikan proses pengunduhan video: {video_id}")
                else:
                    client.send_message(ev.Info.MessageSource.Chat, "❌ Link (YouTube/GDrive) tidak valid untuk dihentikan.")
            else:
                client.send_message(ev.Info.MessageSource.Chat, "❌ Format salah. Gunakan: !stop <link_youtube>")
            return True
        client.send_message(ev.Info.MessageSource.Chat, "❌ Format salah. Gunakan:\n!download <youtube_url>\n<start> - <end>")
        return True
        
    url = url_match.group(1).strip()
    
    force_portrait = bool(re.search(r'--portrait|-p\b', text, re.IGNORECASE))
    combine_all = bool(re.search(r'--all|-a\b', text, re.IGNORECASE))
    no_clip = bool(re.search(r'--noclip\b', text, re.IGNORECASE))
    no_send = bool(re.search(r'--nosend\b', text, re.IGNORECASE))
    
    if no_clip:
        combine_all = True
        force_portrait = False
        
    safe_mode = bool(re.search(r"--safe\b", text, re.IGNORECASE))
    
    # Cari semua rentang waktu
    ranges = re.findall(r"([\d:.]+)\s*-\s*([\d:.]+)", text)
    if not ranges:
        client.send_message(ev.Info.MessageSource.Chat, "❌ Tidak ada rentang waktu ditemukan. Format: hh:mm:ss.ms - hh:mm:ss.ms")
        return True
        
    def download_async():
        # Ekstrak ID untuk nama folder (YouTube atau GDrive)
        if "drive.google.com" in url:
            import time
            gdrive_match = re.search(r'/d/([a-zA-Z0-9_-]+)', url) or re.search(r'id=([a-zA-Z0-9_-]+)', url)
            video_id = gdrive_match.group(1) if gdrive_match else f"gdrive_{int(time.time())}"
        else:
            video_id_match = re.search(r'(?:v=|\/)([0-9A-Za-z_-]{11})', url)
            video_id = video_id_match.group(1) if video_id_match else "Unknown_Video"
        
        output_dir = os.path.join(os.getcwd(), "output", video_id)
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            
        ranges_list = []
        for idx, (start_str_raw, end_str_raw) in enumerate(ranges):
            start_time = parse_time_with_ms(start_str_raw.strip())
            end_time = parse_time_with_ms(end_str_raw.strip())
            ranges_list.append({
                'rank': idx + 1,
                'start_time': start_time,
                'end_time': end_time,
                'start_str': format_time(int(start_time)),
                'end_str': format_time(int(end_time))
            })
            
        downloaded_landscape_clips = []
        total_duration = 0
              # Reset bendera batal untuk video ini
        CANCEL_FLAGS[video_id] = False
        
        def check_cancel():
            return CANCEL_FLAGS.get(video_id, False)
            
        def safe_send_message(text_or_msg):
            try:
                client.send_message(ev.Info.MessageSource.Chat, text_or_msg)
            except Exception as e:
                print(f"[WA_ERROR] Gagal mengirim pesan ke WA (Socket terputus?): {e}")

        mode_str = "SAFE MODE" if safe_mode else "FAST MODE"
        safe_send_message(f"⏳ Memproses {len(ranges_list)} klip secara bertahap dengan {mode_str}...")
        from utils.downloader import process_clips_generator
        
        clip_generator = process_clips_generator(url, output_dir, ranges_list, force_portrait=False, cancel_check=check_cancel, safe_mode=safe_mode)
        if True:
            
            full_video_path_ref = None
            import time
            landscape_mtime_base = time.time()
            
            for idx, (filepath, full_video_path) in enumerate(clip_generator):
                full_video_path_ref = full_video_path
                if check_cancel():
                    break
                    
                clip = ranges_list[idx]
                start_time = clip['start_time']
                end_time = clip['end_time']
                start_str = clip['start_str']
                end_str = clip['end_str']
                
                if filepath and os.path.exists(filepath):
                    mtime = landscape_mtime_base + idx
                    os.utime(filepath, (mtime, mtime))
                    
                    downloaded_landscape_clips.append(filepath)
                    total_duration += (end_time - start_time)
                    
                    if not no_clip and not force_portrait and not no_send:
                        retry_count = 0
                        while retry_count < 999:
                            if check_cancel(): break
                            try:
                                with open(filepath, 'rb') as f:
                                    buff = f.read()
                                
                                upload = client.upload(buff)
                                duration = end_time - start_time
                                
                                msg_proto = Message(
                                    videoMessage=VideoMessage(
                                        URL=upload.url,
                                        seconds=int(duration),
                                        directPath=upload.DirectPath,
                                        fileEncSHA256=upload.FileEncSHA256,
                                        fileLength=upload.FileLength,
                                        fileSHA256=upload.FileSHA256,
                                        mediaKey=upload.MediaKey,
                                        mimetype="video/mp4",
                                        contextInfo=ContextInfo()
                                    )
                                )
                                
                                if ev.Message:
                                    msg_proto.videoMessage.contextInfo.MergeFrom(client._make_quoted_message(ev))
                                    
                                msg_proto.videoMessage.caption = f"{start_str} - {end_str}"
                                    
                                response = safe_send_message(msg_proto)
                                break
                            except Exception as e:
                                err_str = str(e).lower()
                                retry_count += 1
                                safe_send_message(f"⚠️ Gagal mengirim klip {idx+1} ke WA ({err_str}). Mencoba ulang ({retry_count})...")
                                import time; time.sleep(3)
                else:
                    safe_send_message(f"❌ Download gagal untuk klip {idx+1}.")
        else:
            full_video_path_ref = None # Kode tidak akan ke sini
            
        # Full Video dibiarkan agar dihapus otomatis setelah 1 hari oleh daemon
        # if full_video_path_ref and os.path.exists(full_video_path_ref):
        #     try:
        #         os.remove(full_video_path)
        #         print(f"[CLEANUP] Full Video dihapus karena semua klip sudah berhasil dikirim.")
        #     except Exception as e:
        #         print(f"[CLEANUP FAIL] Gagal menghapus Full Video: {e}")
                
        # Proses penggabungan jika --all diaktifkan DAN tidak dibatalkan
        if combine_all and len(downloaded_landscape_clips) > 1 and not check_cancel():
            safe_send_message(f"⏳ Menggabungkan {len(downloaded_landscape_clips)} klip menjadi satu video Full...")
            import subprocess
            import time
            
            concat_txt = os.path.join(output_dir, "concat.txt")
            with open(concat_txt, "w", encoding="utf-8") as f:
                for clip_path in downloaded_landscape_clips:
                    # Escape single quotes in filename if any
                    safe_path = clip_path.replace("'", "'\\''")
                    f.write(f"file '{safe_path}'\n")
                    
            combined_filename = f"Combined_{len(downloaded_landscape_clips)}_Clips_{int(time.time())}.mp4"
            combined_filepath = os.path.join(output_dir, combined_filename)
            ffmpeg_exe = os.getenv('FFMPEG_BINARY', 'ffmpeg')
            
            # Gunakan Stream Copy agar secepat kilat dan kualitas 100% asli
            ffmpeg_cmd = [ffmpeg_exe, '-y', '-f', 'concat', '-safe', '0', '-i', concat_txt, '-c', 'copy', combined_filepath]
            
            try:
                subprocess.run(ffmpeg_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                if os.path.exists(combined_filepath):
                    if not no_send:
                        safe_send_message(f"⏳ Mengunggah video gabungan ke Google Drive...")
                        from utils.gdrive import upload_to_gdrive
                        retry_count = 0
                        while retry_count < 999: # Paksa terus sampai sukses (kecuali storage full)
                            if check_cancel(): break
                            try:
                                link = upload_to_gdrive(combined_filepath)
                                if link:
                                    safe_send_message(f"🎬 Full Combined Video ({len(downloaded_landscape_clips)} klip)\n\n🔗 *Link GDrive:* {link}")
                                else:
                                    safe_send_message(f"❌ Gagal mengunggah video gabungan ke GDrive.")
                                break
                            except Exception as upload_err:
                                err_str = str(upload_err).lower()
                                if "quota" in err_str or "storage" in err_str or "space" in err_str:
                                    safe_send_message(f"❌ Google Drive penuh/limit quota: {str(upload_err)}")
                                    break
                                retry_count += 1
                                safe_send_message(f"⚠️ Gagal mengunggah ke GDrive ({err_str}). Mencoba ulang ({retry_count})...")
                                import time; time.sleep(3)
                    else:
                        safe_send_message(f"✅ Video gabungan berhasil dibuat secara lokal (Skip upload GDrive karena --nosend).")
                    
                    # Bersihkan file sampah concat text saja (video gabungan dibiarkan untuk cleanup 1 hari)
                    os.remove(concat_txt)
            except Exception as e:
                safe_send_message(f"❌ Gagal memproses video gabungan: {str(e)}")
                
        # --- Proses Portrait Di Akhir (Berat) ---
        if force_portrait and not no_clip and not check_cancel():
            safe_send_message(f"⏳ Memulai proses pembuatan format Portrait untuk {len(downloaded_landscape_clips)} klip...")
            from utils.downloader import apply_portrait_padding
            ffmpeg_exe = os.getenv('FFMPEG_BINARY', 'ffmpeg')
            
            import time
            portrait_mtime_base = time.time()
            
            for idx, landscape_path in enumerate(downloaded_landscape_clips):
                if check_cancel():
                    break
                
                clip = ranges_list[idx]
                start_time = clip['start_time']
                end_time = clip['end_time']
                start_str = clip['start_str']
                end_str = clip['end_str']
                
                portrait_path = apply_portrait_padding(landscape_path, idx + 1, ffmpeg_exe)
                if portrait_path and os.path.exists(portrait_path):
                    mtime = portrait_mtime_base + idx
                    os.utime(portrait_path, (mtime, mtime))
                    if not no_send:
                        retry_count = 0
                        while retry_count < 999:
                            if check_cancel(): break
                            try:
                                with open(portrait_path, 'rb') as f:
                                    buff = f.read()
                                
                                upload = client.upload(buff)
                                duration = end_time - start_time
                                
                                msg_proto = Message(
                                    videoMessage=VideoMessage(
                                        URL=upload.url,
                                        seconds=int(duration),
                                        directPath=upload.DirectPath,
                                        fileEncSHA256=upload.FileEncSHA256,
                                        fileLength=upload.FileLength,
                                        fileSHA256=upload.FileSHA256,
                                        mediaKey=upload.MediaKey,
                                        mimetype="video/mp4",
                                        contextInfo=ContextInfo()
                                    )
                                )
                                
                                if ev.Message:
                                    msg_proto.videoMessage.contextInfo.MergeFrom(client._make_quoted_message(ev))
                                    
                                msg_proto.videoMessage.caption = f"{start_str} - {end_str} (Portrait)"
                                response = safe_send_message(msg_proto)
                                break
                            except Exception as e:
                                err_str = str(e).lower()
                                retry_count += 1
                                safe_send_message(f"⚠️ Gagal mengirim klip portrait {idx+1} ke WA ({err_str}). Mencoba ulang ({retry_count})...")
                                import time; time.sleep(3)
                    else:
                        pass # Hanya diproses di lokal, tidak dikirim
                else:
                    safe_send_message(f"❌ Gagal memproses portrait klip {idx+1}.")
                    
        if not check_cancel():
            try:
                client.reply_message("✅ Tugas selesai!", ev)
            except Exception as e:
                print(f"[WA_ERROR] Gagal mengirim pesan reply WA (Socket terputus?): {e}")
            
    threading.Thread(target=download_async, daemon=True).start()
    return True
