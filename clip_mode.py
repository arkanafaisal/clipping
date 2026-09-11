# clip_mode.py

from state_manager import (
    user_states,
    STATE_IDLE, 
    STATE_WAITING_URL, 
    STATE_WAITING_COUNT, 
    STATE_WAITING_OFFSET
)

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
        user_states[sender_jid]["state"] = STATE_IDLE # Akhiri proses
        
        # Kirim rangkuman akhir (MOCK)
        url = user_states[sender_jid]["url"]
        count = user_states[sender_jid]["count"]
        offset = user_states[sender_jid]["offset"]
        
        summary = (
            "✅ *Input Summary (Simulation)*:\n"
            f"🔗 URL: {url}\n"
            f"✂️ Clips: {count}\n"
            f"⏱️ Offset: {offset}s\n\n"
            "(Process stopped here for mockup purposes. Returned to General Menu.)"
        )
        client.reply_message(summary, ev)
        
        # Bersihkan variabel agar aman
        user_states[sender_jid]["url"] = ""
        user_states[sender_jid]["count"] = ""
        user_states[sender_jid]["offset"] = ""
        
        return True
        
    return False
