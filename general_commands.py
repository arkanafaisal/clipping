# general_commands.py

from state_manager import clear_state, STATE_IDLE

def handle_general_commands(client, ev, text_lower, sender_jid, current_state):
    """
    Menangani perintah global (override) dengan prioritas tertinggi.
    Mengembalikan True jika perintah berhasil ditangani (sehingga bot.py tidak lanjut ke bawah).
    """
    
    # 1. PRIORITAS TERTINGGI: !exit (Mencegah stuck)
    if text_lower == "!exit":
        if current_state == STATE_IDLE:
            client.reply_message("You are already in the General Menu.", ev)
        else:
            clear_state(sender_jid)
            client.reply_message("Exited current mode. Memory cleared. Returned to General Menu.", ev)
        return True
        
    # 2. Perintah !mode
    if text_lower == "!mode":
        if current_state == STATE_IDLE:
            mode_text = "General Menu (IDLE)"
        else:
            mode_text = "Clip Mode"
        client.reply_message(f"ℹ️ Your current mode is: *{mode_text}*", ev)
        return True
        
    # 3. Perintah dasar ping
    if text_lower == "ping":
        client.reply_message("Pong! Bot is responding.", ev)
        return True
        
    return False
