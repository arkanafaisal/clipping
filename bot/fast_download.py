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
    # !download --url https://www.youtube.com/watch?v=XXXXX --s 00:00:10.500 --e 00:00:25.000
    pattern = r"!download\s+--url\s+(https?://[^\s]+)\s+--s\s+([\d:.]+)\s+--e\s+([\d:.]+)"
    match = re.search(pattern, text, re.IGNORECASE)
    
    if not match:
        client.send_message(ev.Info.MessageSource.Chat, "❌ Format salah. Gunakan:\n!download --url <youtube_url> --s <start> --e <end>")
        return True
        
    url = match.group(1).strip()
    start_time = parse_time_with_ms(match.group(2).strip())
    end_time = parse_time_with_ms(match.group(3).strip())
    
    start_str = format_time(int(start_time))
    end_str = format_time(int(end_time))
    
    # Buat objek clip dummy
    selected_clip = {
        'rank': 1,
        'start_time': start_time,
        'end_time': end_time
    }
    
    def download_async():
        # Karena kita dari fast command, kita belum tahu judul video YouTube.
        # Kita gunakan fallback nama folder "Fast_Download"
        title = "Fast_Download"
        output_dir = os.path.join(os.getcwd(), "output", title)
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            
        client.send_message(ev.Info.MessageSource.Chat, f"⏳ Memproses Fast Download")
        
        # Eksekusi download single clip (synchronous di dalam thread ini)
        filepath = download_single_clip(url, output_dir, selected_clip, 0, 1)
        
        if filepath and os.path.exists(filepath):
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
                       
                response = client.send_message(ev.Info.MessageSource.Chat, msg_proto)
                
                # Simpan ke history
                if response and hasattr(response, 'ID'):
                    from bot.history_manager import save_clip_history
                    save_clip_history(response.ID, url, start_time, end_time, filepath)
                    
            except Exception as e:
                client.send_message(ev.Info.MessageSource.Chat, f"❌ Failed to send video: {str(e)}")
        else:
            client.send_message(ev.Info.MessageSource.Chat, f"❌ Download failed.")
            
    threading.Thread(target=download_async, daemon=True).start()
    return True
