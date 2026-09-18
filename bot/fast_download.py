import re
import os
import threading
from utils.downloader import download_single_clip, get_output_filename
from neonize.proto.waE2E.WAWebProtobufsE2E_pb2 import Message, VideoMessage, ContextInfo

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
        client.send_message(ev.Info.MessageSource.Chat, "❌ Format salah. Gunakan:\n!download <youtube_url>\n<start> - <end>")
        return True
        
    url = url_match.group(1).strip()
    
    force_portrait = bool(re.search(r'--portrait|-p\b', text, re.IGNORECASE))
    combine_all = bool(re.search(r'--all|-a\b', text, re.IGNORECASE))
    
    # Cari semua rentang waktu
    ranges = re.findall(r"([\d:.]+)\s*-\s*([\d:.]+)", text)
    if not ranges:
        client.send_message(ev.Info.MessageSource.Chat, "❌ Tidak ada rentang waktu ditemukan. Format: hh:mm:ss.ms - hh:mm:ss.ms")
        return True
        
    def download_async():
        title = "Fast_Download"
        output_dir = os.path.join(os.getcwd(), "output", title)
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            
        client.send_message(ev.Info.MessageSource.Chat, f"⏳ Memproses {len(ranges)} klip Fast Download...")
        
        downloaded_landscape_clips = []
        total_duration = 0
        
        for idx, (start_str_raw, end_str_raw) in enumerate(ranges):
            start_time = parse_time_with_ms(start_str_raw.strip())
            end_time = parse_time_with_ms(end_str_raw.strip())
            
            start_str = format_time(int(start_time))
            end_str = format_time(int(end_time))
            
            selected_clip = {
                'rank': idx + 1,
                'start_time': start_time,
                'end_time': end_time
            }
            
            filepath = download_single_clip(url, output_dir, selected_clip, idx, len(ranges), force_portrait)
            
            if filepath and os.path.exists(filepath):
                landscape_path = filepath.replace(".portrait.mp4", ".mp4")
                if os.path.exists(landscape_path):
                    downloaded_landscape_clips.append(landscape_path)
                    total_duration += (end_time - start_time)
                    
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
                        
                    response = client.send_message(ev.Info.MessageSource.Chat, msg_proto)
                    
                    # Simpan ke history
                    if response and hasattr(response, 'ID'):
                        from bot.history_manager import save_clip_history
                        save_clip_history(response.ID, url, start_time, end_time, filepath)
                        
                    # Hapus file portrait setelah dikirim agar tidak memenuhi disk
                    if force_portrait and filepath.endswith(".portrait.mp4"):
                        if os.path.exists(filepath):
                            os.remove(filepath)
                            
                except Exception as e:
                    client.send_message(ev.Info.MessageSource.Chat, f"❌ Gagal mengirim klip {idx+1}: {str(e)}")
            else:
                client.send_message(ev.Info.MessageSource.Chat, f"❌ Download gagal untuk klip {idx+1}.")
                
        # Proses penggabungan jika --all diaktifkan
        if combine_all and len(downloaded_landscape_clips) > 1:
            client.send_message(ev.Info.MessageSource.Chat, f"⏳ Menggabungkan {len(downloaded_landscape_clips)} klip menjadi satu video Full...")
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
                    with open(combined_filepath, 'rb') as f:
                        buff = f.read()
                    
                    upload = client.upload(buff)
                    
                    msg_proto = Message(
                        videoMessage=VideoMessage(
                            URL=upload.url,
                            seconds=int(total_duration),
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
                        
                    msg_proto.videoMessage.caption = f"🎬 Full Combined Video ({len(downloaded_landscape_clips)} klip)"
                    client.send_message(ev.Info.MessageSource.Chat, msg_proto)
                    
                    # Bersihkan file sampah gabungan
                    os.remove(concat_txt)
                    os.remove(combined_filepath)
            except Exception as e:
                client.send_message(ev.Info.MessageSource.Chat, f"❌ Gagal mengirim video gabungan: {str(e)}")
            
    threading.Thread(target=download_async, daemon=True).start()
    return True
