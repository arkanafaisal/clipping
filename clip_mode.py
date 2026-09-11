def handle_clip_mode(client, ev, text, text_lower, quoted_text, sender_jid):
    """
    Menangani semua perintah yang dikirim selama user berada di Clip Mode.
    Termasuk menangkap link YouTube dan balasan angka.
    """
    
    # 1. Cek apakah ini balasan (reply) berupa angka
    if text.isdigit() and quoted_text and "🔗 https://" in quoted_text:
        from reply_handler import handle_reply_download
        if handle_reply_download(client, ev, text, quoted_text, sender_jid):
            return True
            
    # 2. Cek apakah ini link YouTube
    if text_lower.startswith("https://") and ("youtube.com" in text_lower or "youtu.be" in text_lower):
        from heatmap_handler import handle_heatmap_request
        if handle_heatmap_request(client, ev, text, sender_jid):
            return True
            
    # 3. Jika bukan keduanya, berikan panduan mode clip
    client.send_message(
        ev.Info.MessageSource.Chat,
        "❌ Perintah tidak dikenali dalam *Clip Mode*.\n\n"
        "- Kirimkan *Link YouTube* untuk memproses heatmap.\n"
        "- *Balas (Reply)* pesan hasil heatmap dengan angka untuk mendownload.\n"
        "- Ketik `exit` untuk keluar dari mode."
    )
    return True
