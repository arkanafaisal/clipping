from state_manager import (
    user_states,
    STATE_IDLE, 
    STATE_WAITING_URL, 
    STATE_WAITING_COUNT, 
    STATE_WAITING_OFFSET,
    STATE_WAITING_CONFIRM
)
from heatmap import get_top_clips

def handle_clip_mode(client, ev, text, text_lower, sender_jid, current_state):
    """
    Menangani semua logika tanya-jawab dan validasi khusus untuk fitur kliping.
    Mengembalikan True jika input diproses oleh mode ini.
    """
    
    # Pendeteksian awal untuk masuk ke mode
    if text_lower == "!clip":
        user_states[sender_jid]["state"] = STATE_WAITING_URL
        client.reply_message("✂️ Entering Clip Mode!\nPlease paste your YouTube Link:", ev)
        return True
        
    # Jika masih di General Menu (IDLE), hiraukan dan kembalikan False agar bot merespons Help Menu
    if current_state == STATE_IDLE:
        return False
        
    # --- LOGIKA TANYA JAWAB (STATE MACHINE) ---
    
    if current_state == STATE_WAITING_URL:
        # Validasi: URL harus HTTPS, YouTube, dan tidak ada spasi
        if " " in text or not text.startswith("https://") or not ("youtube.com" in text or "youtu.be" in text):
            client.reply_message("❌ Invalid YouTube Link! It must start with 'https://' and contain no spaces.\nPlease send the link again:", ev)
            return True
            
        user_states[sender_jid]["url"] = text
        user_states[sender_jid]["state"] = STATE_WAITING_COUNT
        client.reply_message("✅ YouTube Link received. How many top clips do you want to extract? (Max: 25)", ev)
        return True
        
    elif current_state == STATE_WAITING_COUNT:
        # Validasi: Harus angka, maksimal 25
        if not text.isdigit() or not (1 <= int(text) <= 25):
            client.reply_message("❌ Invalid count! Please enter a number between 1 and 25:", ev)
            return True
            
        user_states[sender_jid]["count"] = text
        user_states[sender_jid]["state"] = STATE_WAITING_OFFSET
        client.reply_message("✅ Clip count received. What is the desired padding offset in seconds? (Max: 30)", ev)
        return True
        
    elif current_state == STATE_WAITING_OFFSET:
        # Validasi: Harus angka, maksimal 30
        if not text.isdigit() or not (0 <= int(text) <= 30):
            client.reply_message("❌ Invalid offset! Please enter a number between 0 and 30:", ev)
            return True
            
        user_states[sender_jid]["offset"] = text
        user_states[sender_jid]["state"] = STATE_WAITING_CONFIRM
        
        # Kirim rangkuman untuk meminta persetujuan
        url = user_states[sender_jid]["url"]
        count = user_states[sender_jid]["count"]
        offset = user_states[sender_jid]["offset"]
        
        summary = (
            "✅ *Input Summary*:\n"
            f"🔗 URL: {url}\n"
            f"✂️ Clips: {count}\n"
            f"⏱️ Offset: {offset}s\n\n"
            "Do you want to proceed and fetch the Heatmap data for this video? (Type *yes* or *no*)"
        )
        client.reply_message(summary, ev)
        return True
        
    elif current_state == STATE_WAITING_CONFIRM:
        if text_lower in ["y", "ya", "yes", "ok"]:
            client.reply_message("🔍 Fetching heatmap data from YouTube... Please wait.", ev)
            
            url = user_states[sender_jid]["url"]
            count = int(user_states[sender_jid]["count"])
            offset = int(user_states[sender_jid]["offset"])
            
            try:
                clips, title = get_top_clips(url, count, offset)
                
                if not clips:
                    # Gagal mendapatkan heatmap, minta ulangi link
                    user_states[sender_jid]["state"] = STATE_WAITING_URL
                    client.reply_message("❌ Failed to find heatmap data. The video might not have 'most replayed' data.\nPlease provide a different YouTube Link:", ev)
                    return True
                
                # Sukses!
                msg = f"✅ Heatmap Data Found!\n\n🎬 *{title}*\n"
                
                def format_time(seconds):
                    h = int(seconds // 3600)
                    m = int((seconds % 3600) // 60)
                    s = int(seconds % 60)
                    return f"{h:02d}:{m:02d}:{s:02d}"
                
                for c in clips:
                    start_str = format_time(c['start_time'])
                    end_str = format_time(c['end_time'])
                    msg += f"{c['rank']}. {start_str} - {end_str} ({c['score']:.3f} point)\n"
                msg += "\n(Process stopped here as requested. Returned to General Menu.)"
                
                client.reply_message(msg, ev)
                
                # Selesai, kembali ke idle
                user_states[sender_jid]["state"] = STATE_IDLE
                user_states[sender_jid]["url"] = ""
                user_states[sender_jid]["count"] = ""
                user_states[sender_jid]["offset"] = ""
                
            except Exception as e:
                user_states[sender_jid]["state"] = STATE_WAITING_URL
                client.reply_message(f"❌ An error occurred: {str(e)}\nPlease provide a different YouTube Link:", ev)
                
            return True
            
        elif text_lower in ["n", "no", "batal"]:
            user_states[sender_jid]["state"] = STATE_IDLE
            user_states[sender_jid]["url"] = ""
            user_states[sender_jid]["count"] = ""
            user_states[sender_jid]["offset"] = ""
            client.reply_message("Process cancelled. Returned to General Menu.", ev)
            return True
            
        else:
            client.reply_message("Please type *yes* or *no*.", ev)
            return True
            
    return False
