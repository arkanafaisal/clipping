from state_manager import (
    user_states,
    clear_state,
    STATE_IDLE, 
    STATE_HEATMAP_URL, 
    STATE_HEATMAP_COUNT, 
    STATE_HEATMAP_OFFSET,
    STATE_HEATMAP_SORT,
    STATE_HEATMAP_CONFIRM,
    STATE_HEATMAP_SWITCH_DOWNLOAD
)
from heatmap import get_top_clips

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
            
        user_states[sender_jid]["state"] = STATE_HEATMAP_CONFIRM
        
        url = user_states[sender_jid]["url"]
        count = user_states[sender_jid]["count"]
        offset = user_states[sender_jid]["offset"]
        sort_pref = "By Points" if user_states[sender_jid]["sort_by_point"] else "Chronological (By Time)"
        
        summary = (
            "✅ *Input Summary*:\n"
            f"🔗 URL: {url}\n"
            f"✂️ Clips: {count}\n"
            f"⏱️ Offset: {offset}s\n"
            f"🔄 Sorting: {sort_pref}\n\n"
            "Proceed? (yes/no)"
        )
        client.reply_message(summary, ev)
        return True
        
    elif current_state == STATE_HEATMAP_CONFIRM:
        if text_lower in ["y", "ya", "yes", "ok"]:
            url = user_states[sender_jid]["url"]
            count = int(user_states[sender_jid]["count"])
            offset = int(user_states[sender_jid]["offset"])
            
            try:
                clips, title = get_top_clips(url, count, offset)
                
                if not clips:
                    user_states[sender_jid]["state"] = STATE_HEATMAP_URL
                    client.reply_message("❌ Failed to find heatmap data.\nPlease provide a different YouTube Link:", ev)
                    return True
                
                msg = f"🎬 *{title}*\n"
                
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
                    msg += f"{c['display_rank']}. {start_str} - {end_str} ({c['value']:.3f} point)\n"
                
                client.reply_message(msg, ev)
                
                # Switch to Download Mode prompt
                from state_manager import STATE_DOWNLOAD_CLIP_DATA
                user_states[sender_jid]["state"] = STATE_HEATMAP_SWITCH_DOWNLOAD
                user_states[sender_jid]["video_title"] = title
                
                client.reply_message("Do you want to switch to Download Mode? (yes/no)", ev)
                return True
                
            except Exception as e:
                user_states[sender_jid]["state"] = STATE_HEATMAP_URL
                client.reply_message(f"❌ An error occurred: {str(e)}\nPlease provide a different YouTube Link:", ev)
            return True
            
        elif text_lower in ["n", "no", "batal"]:
            clear_state(sender_jid)
            client.reply_message("Process cancelled. Returned to General Menu.", ev)
            return True
            
        else:
            client.reply_message("Please type *yes* or *no*.", ev)
            return True
            
    elif current_state == STATE_HEATMAP_SWITCH_DOWNLOAD:
        if text_lower in ["y", "ya", "yes", "ok"]:
            from state_manager import STATE_DOWNLOAD_CLIP_DATA
            user_states[sender_jid]["state"] = STATE_DOWNLOAD_CLIP_DATA
            client.reply_message("Entering Download Mode.\nPlease paste the ENTIRE heatmap result you just got:", ev)
        else:
            clear_state(sender_jid)
            client.reply_message("Okay, returning to General Menu.", ev)
        return True

    return False
