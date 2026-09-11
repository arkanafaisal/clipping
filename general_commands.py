# general_commands.py

from state_manager import user_states, clear_state, STATE_IDLE, STATE_HEATMAP_URL, STATE_DOWNLOAD_URL

def handle_general_commands(client, ev, text_lower, sender_jid, current_state):
    """
    Menangani perintah global (override) dengan prioritas tertinggi.
    Mengembalikan True jika perintah berhasil ditangani (sehingga bot.py tidak lanjut ke bawah).
    """
    
    # 1. PRIORITAS TERTINGGI: exit (Mencegah stuck)
    if text_lower == "exit":
        if current_state == STATE_IDLE:
            client.reply_message("You are already in the General Menu.", ev)
        else:
            clear_state(sender_jid)
            client.reply_message("Exited current mode. Memory cleared. Returned to General Menu.", ev)
        return True
        
    if text_lower == "heatmap":
        user_states[sender_jid]["state"] = STATE_HEATMAP_URL
        client.reply_message("Entering Heatmap Mode.", ev)
        client.send_message(ev.Info.MessageSource.Chat, "Please paste your YouTube link:")
        return True
        
    if text_lower == "download":
        from state_manager import STATE_DOWNLOAD_CLIP_DATA
        user_states[sender_jid]["state"] = STATE_DOWNLOAD_CLIP_DATA
        client.reply_message("Entering Download Mode.", ev)
        client.send_message(ev.Info.MessageSource.Chat, "Please paste the ENTIRE heatmap result")
        return True

    # 2. Perintah mode
    if text_lower == "mode":
        if current_state == STATE_IDLE:
            menu = (
                "🤖 *yt-clipper Bot Menu*\n\n"
                "Commands:\n"
                "🔹 *heatmap* - Generate heatmap from a YouTube video\n"
                "🔹 *download* - Download a specific clip using heatmap data\n"
                "🔹 *ping* - Check bot status\n"
                "🔹 *exit* - Cancel current operation"
            )
            client.reply_message(menu, ev)
        else:
            # Tampilkan state
            client.reply_message(f"ℹ️ Your current state is: *{current_state}*", ev)
        return True
        
    # 3. Perintah dasar ping
    if text_lower == "ping":
        client.reply_message("Pong! Bot is responding.", ev)
        return True
        
    return False
