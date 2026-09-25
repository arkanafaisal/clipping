import re
import os
import threading
from utils.downloader import download_single_clip
from utils.file_utils import get_output_filename
from neonize.proto.waE2E.WAWebProtobufsE2E_pb2 import Message, VideoMessage, ContextInfo

def parse_time_to_seconds(time_str):
    parts = time_str.split(":")
    if len(parts) == 3:
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    elif len(parts) == 2:
        return int(parts[0]) * 60 + int(parts[1])
    return int(time_str)

def handle_reply_download(client, ev, text, quoted_text, sender_jid):
    """
    Menangani aksi saat user mereply list heatmap dengan angka.
    """
    # Pastikan itu balasan ke list heatmap (memiliki URL dan judul)
    if "🔗 https://" not in quoted_text or "🎬" not in quoted_text:
        return False
        
    url_match = re.search(r"🔗 (https?://[^\s]+)", quoted_text)
    if not url_match:
        return False
        
    url = url_match.group(1).strip()
    
    title_match = re.search(r"🎬 \*(.*?)\*", quoted_text)
    title = title_match.group(1).strip() if title_match else "YouTube_Clips"
    
    # Cari baris yang direply, misalnya "2. 01:17:36 - 01:18:24"
    clip_num = text.strip()
    
    # Regex untuk mencari format: "2. 01:17:36 - 01:18:24"
    pattern = rf"^{clip_num}\. (\d{{2}}:\d{{2}}:\d{{2}}) - (\d{{2}}:\d{{2}}:\d{{2}})"
    match = re.search(pattern, quoted_text, re.MULTILINE)
    
    if not match:
        client.send_message(ev.Info.MessageSource.Chat, f"❌ Could not find clip number {clip_num} in the replied message.")
        return True
        
    start_str = match.group(1)
    end_str = match.group(2)
    
    start_time = parse_time_to_seconds(start_str)
    end_time = parse_time_to_seconds(end_str)
    
    selected_clip = {
        'rank': int(clip_num),
        'start_time': start_time,
        'end_time': end_time
    }
    
    
    def download_async():
        def sanitize_filename(name):
            return re.sub(r'[\\/*?:"<>|]', "", name).strip()
            
        safe_title = sanitize_filename(title)
        output_dir = os.path.join(os.getcwd(), "output", safe_title)
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            
        filename, exists = get_output_filename(output_dir, int(clip_num), start_time, end_time)
        
        if not exists:
            client.send_message(ev.Info.MessageSource.Chat, f"⏳ Downloading clip {clip_num} ({start_str} - {end_str})...")
        
        # Eksekusi download single clip (synchronous di dalam thread ini)
        filepath = download_single_clip(url, output_dir, selected_clip, int(clip_num)-1, int(clip_num))
        
        
        if filepath and os.path.exists(filepath):
            try:
                with open(filepath, 'rb') as f:
                    buff = f.read()
                
                upload = client.upload(buff)
                duration = end_time - start_time
                
                msg_proto = Message(
                    videoMessage=VideoMessage(
                        URL=upload.url,
                        seconds=duration,
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
                    
                # [MODIFIED] Tambahkan caption minimalis (hanya waktu)
                msg_proto.videoMessage.caption = f"{start_str} - {end_str}"
                    
                response = client.send_message(ev.Info.MessageSource.Chat, msg_proto)
                
                # [NEW] Tangkap ID pesan (StanzaID) dan simpan ke history
                if response and hasattr(response, 'ID'):
                    from bot.history_manager import save_clip_history
                    save_clip_history(response.ID, url, start_time, end_time, filepath)
                    
            except Exception as e:
                client.send_message(ev.Info.MessageSource.Chat, f"❌ Failed to send video: {str(e)}")
        else:
            client.send_message(ev.Info.MessageSource.Chat, f"❌ Download failed for Clip {clip_num}.")
            
    threading.Thread(target=download_async, daemon=True).start()
    return True
