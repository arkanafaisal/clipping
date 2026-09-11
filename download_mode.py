from state_manager import (
    user_states,
    clear_state,
    STATE_IDLE, 
    STATE_DOWNLOAD_URL,
    STATE_DOWNLOAD_CLIP_DATA
)
from downloader import download_single_clip, get_output_filename
import os
import re

def handle_download_mode(client, ev, text, text_lower, sender_jid, current_state):
    """
    Menangani semua logika tanya-jawab dan validasi khusus untuk fitur download.
    Mengembalikan True jika input diproses oleh mode ini.
    """
    
    if current_state == STATE_IDLE:
        return False

    if current_state == STATE_DOWNLOAD_CLIP_DATA:
        if text.strip().isdigit():
            if "clips" not in user_states[sender_jid]:
                client.reply_message("❌ I don't have any heatmap data in memory right now. Please paste the FULL heatmap text first:", ev)
                return True
                
            clip_num = int(text.strip())
            clips = user_states[sender_jid]["clips"]
            
            selected_clip = None
            clip_idx = 0
            for i, c in enumerate(clips):
                if c.get("display_rank") == clip_num or (i + 1) == clip_num:
                    selected_clip = c
                    clip_idx = i
                    break
            
            if not selected_clip:
                client.reply_message(f"❌ Could not find clip number {clip_num}. Please enter a valid number from the list.", ev)
                return True
                
            url = user_states[sender_jid]["url"]
            title = user_states[sender_jid].get("video_title", "YouTube_Clips")
            
            def sanitize_filename(name):
                return re.sub(r'[\\/*?:"<>|]', "", name).strip()
            safe_title = sanitize_filename(title) if title else "YouTube_Clips"
            output_dir = os.path.join(os.getcwd(), "output", safe_title)
            if not os.path.exists(output_dir):
                os.makedirs(output_dir)
                
            filename, exists = get_output_filename(output_dir, selected_clip.get('rank', 1), selected_clip['start_time'], selected_clip['end_time'])
            
            if not exists:
                client.reply_message("⏳ Please wait...", ev)
                
            filepath = download_single_clip(url, output_dir, selected_clip, clip_idx, len(clips))
            
            if filepath and os.path.exists(filepath):
                def format_time_str(seconds):
                    h = int(seconds // 3600)
                    m = int((seconds % 3600) // 60)
                    s = int(seconds % 60)
                    return f"{h:02d}:{m:02d}:{s:02d}"
                    
                start_str = format_time_str(selected_clip['start_time'])
                end_str = format_time_str(selected_clip['end_time'])
                caption = f"{start_str} - {end_str}"
                
                try:
                    from neonize.proto.waE2E.WAWebProtobufsE2E_pb2 import Message, VideoMessage, ContextInfo
                    with open(filepath, "rb") as f:
                        buff = f.read()
                    upload = client.upload(buff)
                    msg = Message(
                        videoMessage=VideoMessage(
                            URL=upload.url,
                            caption=caption,
                            seconds=int(selected_clip['duration']),
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
                        msg.videoMessage.contextInfo.MergeFrom(client._make_quoted_message(ev))
                    client.send_message(ev.Info.MessageSource.Chat, msg)
                    
                    client.reply_message("Type another clip number:", ev)
                except Exception as e:
                    import traceback
                    print("[ERROR SENDING VIDEO]\n", traceback.format_exc())
                    client.reply_message(f"❌ Failed to send video: {str(e)}", ev)
            else:
                client.reply_message("❌ Failed to download this clip. You can try another number, or *exit* to stop.", ev)
            return True
            
        else:
            lines = text.split('\n')
            parsed_clips = []
            
            def parse_time(t_str):
                parts = t_str.strip().split(':')
                if len(parts) == 2:
                    return int(parts[0]) * 60 + int(parts[1])
                elif len(parts) == 3:
                    return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
                return 0
                
            url_match = re.search(r'🔗\s*(https?://[^\s]+)', text)
            if url_match:
                user_states[sender_jid]["url"] = url_match.group(1)
            else:
                client.reply_message("❌ Could not find a YouTube URL in your message. Make sure to paste the full heatmap result including the 🔗 link.", ev)
                return True
                
            for line in lines:
                match = re.search(r'(\d+)\.\s+(\d{2}:\d{2}(?::\d{2})?)\s*-\s*(\d{2}:\d{2}(?::\d{2})?)', line)
                if match:
                    rank_num = int(match.group(1))
                    start_str = match.group(2)
                    end_str = match.group(3)
                    
                    start_sec = parse_time(start_str)
                    end_sec = parse_time(end_str)
                    
                    parsed_clips.append({
                        "display_rank": rank_num,
                        "rank": rank_num,
                        "start_time": start_sec,
                        "end_time": end_sec,
                        "duration": end_sec - start_sec,
                        "value": 0
                    })
                    
            if parsed_clips:
                user_states[sender_jid]["clips"] = parsed_clips
                title_match = re.search(r'🎬 \*(.+?)\*', text)
                if title_match:
                    user_states[sender_jid]["video_title"] = title_match.group(1)
                else:
                    user_states[sender_jid]["video_title"] = "YouTube_Clips"
                    
                client.reply_message(f"✅ Successfully parsed {len(parsed_clips)} clips from the text!\n\nWhich clip number do you want to download? (e.g., type 1)", ev)
            else:
                client.reply_message("❌ Could not parse any clips from your message. Make sure you paste the exact format from the heatmap result (e.g., '1. 00:10 - 00:20').", ev)
            return True

    return False
