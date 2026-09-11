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
            client.send_message(ev.Info.MessageSource.Chat, "❌ Invalid YouTube Link! It must start with 'https://' and contain no spaces.\nPlease send the link again:")
            return True
            
        user_states[sender_jid]["url"] = text
        user_states[sender_jid]["state"] = STATE_HEATMAP_COUNT
        client.send_message(ev.Info.MessageSource.Chat, "How many clips?")
        
        # Check if the video has a heatmap or is blocked (asynchronous)
        import threading
        def check_url_async():
            clips, title = get_top_clips(text, 1, 0)
            if not clips:
                # Reset state to URL if verification fails
                user_states[sender_jid]["state"] = STATE_HEATMAP_URL
                client.send_message(
                    ev.Info.MessageSource.Chat, 
                    "❌ *INTERRUPT:* Failed to fetch heatmap for the previous link. The video might be blocked, private, or has no heatmap data.\n\nPlease send a different YouTube Link:"
                )
        
        threading.Thread(target=check_url_async, daemon=True).start()
        
        return True
            

        
    elif current_state == STATE_HEATMAP_COUNT:
        if not text.isdigit() or not (1 <= int(text) <= 50):
            client.send_message(ev.Info.MessageSource.Chat, "❌ Invalid count! Please enter a number between 1 and 50:")
            return True
            
        user_states[sender_jid]["count"] = text
        user_states[sender_jid]["state"] = STATE_HEATMAP_OFFSET
        client.send_message(ev.Info.MessageSource.Chat, "How much offset in seconds?")
        return True
        
    elif current_state == STATE_HEATMAP_OFFSET:
        if not text.isdigit() or not (0 <= int(text) <= 30):
            client.send_message(ev.Info.MessageSource.Chat, "❌ Invalid offset! Please enter a number between 0 and 30:")
            return True
            
        user_states[sender_jid]["offset"] = text
        user_states[sender_jid]["state"] = STATE_HEATMAP_SORT
        client.send_message(ev.Info.MessageSource.Chat, "Sort by total views? (yes/no)")
        return True
        
    elif current_state == STATE_HEATMAP_SORT:
        if text_lower in ["y", "ya", "yes", "ok"]:
            user_states[sender_jid]["sort_by_point"] = True
        elif text_lower in ["n", "no", "tidak", "batal"]:
            user_states[sender_jid]["sort_by_point"] = False
        else:
            client.send_message(ev.Info.MessageSource.Chat, "❌ Please type *yes* or *no*:")
            return True
            
        # Langsung proses heatmap (tanpa input confirm)
        url = user_states[sender_jid]["url"]
        count = int(user_states[sender_jid]["count"])
        offset = int(user_states[sender_jid]["offset"])
        
        try:
            clips, title = get_top_clips(url, count, offset)
            
            if not clips:
                user_states[sender_jid]["state"] = STATE_HEATMAP_URL
                client.send_message(ev.Info.MessageSource.Chat, "❌ Failed to find heatmap data.\nPlease provide a different YouTube Link:")
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
            
            client.send_message(ev.Info.MessageSource.Chat, msg)
            
            # Auto switch to Download Mode
            from state_manager import STATE_DOWNLOAD_CLIP_DATA
            user_states[sender_jid]["state"] = STATE_DOWNLOAD_CLIP_DATA
            user_states[sender_jid]["clips"] = clips
            user_states[sender_jid]["video_title"] = title
            
            client.reply_message("Entering Download Mode.", ev)
            client.send_message(ev.Info.MessageSource.Chat, "Type the clip number to download:")
            return True
            
        except Exception as e:
            user_states[sender_jid]["state"] = STATE_HEATMAP_URL
            client.send_message(ev.Info.MessageSource.Chat, f"❌ An error occurred: {str(e)}\nPlease provide a different YouTube Link:")
        return True
            
    return False
