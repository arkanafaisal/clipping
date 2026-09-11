from state_manager import (
    user_states,
    clear_state,
    STATE_IDLE, 
    STATE_HEATMAP_URL, 
    STATE_HEATMAP_COUNT, 
    STATE_HEATMAP_OFFSET,
    STATE_HEATMAP_SORT
)
from heatmap import get_top_clips
from downloader import download_preview_clip
import tempfile
import os

def handle_heatmap_mode(client, ev, text, text_lower, sender_jid, current_state):
    """
    Menangani semua logika tanya-jawab dan validasi khusus untuk fitur heatmap.
    Mengembalikan True jika input diproses oleh mode ini.
    """
    
    if current_state == STATE_IDLE:
        return False
        
    if current_state == STATE_HEATMAP_URL:
        if " " in text or not text.startswith("https://") or not ("youtube.com" in text or "youtu.be" in text):
            client.reply_message("❌ Invalid YouTube Link! It must start with 'https://' and contain no spaces.\nPlease send the link again:", ev)
            return True
            
        user_states[sender_jid]["url"] = text
        user_states[sender_jid]["state"] = STATE_HEATMAP_COUNT
        client.reply_message("How many clips?", ev)
        return True
        
    elif current_state == STATE_HEATMAP_COUNT:
        if not text.isdigit() or not (1 <= int(text) <= 25):
            client.reply_message("❌ Invalid count! Please enter a number between 1 and 25:", ev)
            return True
            
        user_states[sender_jid]["count"] = text
        user_states[sender_jid]["state"] = STATE_HEATMAP_OFFSET
        client.reply_message("How much offset in seconds?", ev)
        return True
        
    elif current_state == STATE_HEATMAP_OFFSET:
        if not text.isdigit() or not (0 <= int(text) <= 30):
            client.reply_message("❌ Invalid offset! Please enter a number between 0 and 30:", ev)
            return True
            
        user_states[sender_jid]["offset"] = text
        user_states[sender_jid]["state"] = STATE_HEATMAP_SORT
        client.reply_message("Sort by total views? (yes/no)", ev)
        return True
        
    elif current_state == STATE_HEATMAP_SORT:
        if text_lower in ["y", "ya", "yes", "ok"]:
            user_states[sender_jid]["sort_by_point"] = True
        elif text_lower in ["n", "no", "tidak", "batal"]:
            user_states[sender_jid]["sort_by_point"] = False
        else:
            client.reply_message("❌ Please type *yes* or *no*:", ev)
            return True
            
        # Langsung proses heatmap (tanpa input confirm)
        url = user_states[sender_jid]["url"]
        count = int(user_states[sender_jid]["count"])
        offset = int(user_states[sender_jid]["offset"])
        
        try:
            clips, title = get_top_clips(url, count, offset)
            
            if not clips:
                user_states[sender_jid]["state"] = STATE_HEATMAP_URL
                client.reply_message("❌ Failed to find heatmap data.\nPlease provide a different YouTube Link:", ev)
                return True
            
            msg = f"🔗 {url}\n🎬 *{title}*\n\n"
            
            def format_time(seconds):
                h = int(seconds // 3600)
                m = int((seconds % 3600) // 60)
                s = int(seconds % 60)
                return f"{h:02d}:{m:02d}:{s:02d}"
            
            if not user_states[sender_jid]["sort_by_point"]:
                clips.sort(key=lambda x: x['start_time'])
                
            for idx, c in enumerate(clips, start=1):
                if not user_states[sender_jid]["sort_by_point"]:
                    c['display_rank'] = idx
                else:
                    c['display_rank'] = c['rank']
                    
            for c in clips:
                start_str = format_time(c['start_time'])
                end_str = format_time(c['end_time'])
                msg += f"{c['display_rank']}. {start_str} - {end_str}\n"
            
            client.reply_message(msg, ev)
            
            # Send Preview
            top_clip = None
            for r in range(1, len(clips) + 1):
                c = next((x for x in clips if x['rank'] == r), None)
                if c and c['start_time'] > 0:
                    top_clip = c
                    break
            if not top_clip:
                top_clip = next((c for c in clips if c['rank'] == 1), clips[0])
            temp_dir = tempfile.gettempdir()
            preview_path = download_preview_clip(url, top_clip, temp_dir)
            
            if preview_path and os.path.exists(preview_path):
                try:
                    from neonize.proto.waE2E.WAWebProtobufsE2E_pb2 import Message, VideoMessage, ContextInfo
                    with open(preview_path, "rb") as f:
                        buff = f.read()
                    upload = client.upload(buff)
                    v_msg = Message(
                        videoMessage=VideoMessage(
                            URL=upload.url,
                            caption="Preview",
                            seconds=int(top_clip['end_time'] - top_clip['start_time']),
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
                        v_msg.videoMessage.contextInfo.MergeFrom(client._make_quoted_message(ev))
                    client.send_message(ev.Info.MessageSource.Chat, v_msg)
                except Exception as ex:
                    print("[GAGAL SEND PREVIEW]", ex)
                finally:
                    # Hapus file sementara
                    try:
                        os.remove(preview_path)
                    except:
                        pass
            else:
                client.reply_message("❌ Failed to download preview.", ev)
                
            # Restart Loop Heatmap Mode
            user_states[sender_jid]["state"] = STATE_HEATMAP_URL
            user_states[sender_jid]["url"] = ""
            user_states[sender_jid]["count"] = ""
            user_states[sender_jid]["offset"] = ""
            user_states[sender_jid]["clips"] = []
            user_states[sender_jid]["video_title"] = ""
            
            client.reply_message("Heatmap data generated! Use the *download* command to download.", ev)
            client.reply_message("Please paste your YouTube link:", ev)
            return True
            
        except Exception as e:
            user_states[sender_jid]["state"] = STATE_HEATMAP_URL
            client.reply_message(f"❌ An error occurred: {str(e)}\nPlease provide a different YouTube Link:", ev)
        return True
            
    return False
