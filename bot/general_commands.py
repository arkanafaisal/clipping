from bot.state_manager import user_states, clear_state, STATE_IDLE, STATE_CLIP_MODE

def handle_general_commands(client, ev, text_lower, sender_jid, current_state):
    """
    Menangani perintah global seperti clip, exit, mode.
    Mengembalikan True jika diproses, False jika bukan perintah global.
    """
    
    if text_lower == "exit":
        if current_state == STATE_IDLE:
            client.send_message(ev.Info.MessageSource.Chat, "Anda sedang tidak berada di dalam mode apapun.")
        else:
            clear_state(sender_jid)
            client.send_message(ev.Info.MessageSource.Chat, "🚪 Keluar dari mode. Anda kembali ke Menu Utama.")
        return True
        
    if text_lower == "mode":
        if current_state == STATE_IDLE:
            msg = "Current Mode: IDLE (Ketik clip untuk masuk)"
        elif current_state == STATE_CLIP_MODE:
            msg = "Current Mode: CLIP MODE (Kirim link YouTube atau reply untuk download)"
        else:
            msg = f"Current Mode: UNKNOWN ({current_state})"
        client.send_message(ev.Info.MessageSource.Chat, msg)
        return True
        
    if text_lower == "clip":
        if current_state == STATE_CLIP_MODE:
            client.send_message(ev.Info.MessageSource.Chat, "Anda sudah berada di dalam Clip Mode.")
        else:
            user_states[sender_jid]["state"] = STATE_CLIP_MODE
            client.send_message(
                ev.Info.MessageSource.Chat, 
                "*Clip Mode Aktif*, Ketik `exit` untuk keluar.\n\n"
                "Silakan kirimkan link YouTube untuk mendapatkan daftar klip,\n"
                "atau *reply* hasil daftarnya dengan angka untuk mengunduh klip tersebut.\n\n"
            )
        return True
        
    return False
