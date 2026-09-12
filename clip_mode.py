import re
from reply_handler import handle_reply_download
from heatmap_handler import handle_heatmap_request
from edit_handler import handle_edit_command

def handle_clip_mode(client, ev, text, text_lower, quoted_text, sender_jid):
    """
    Menangani semua perintah yang dikirim selama user berada di Clip Mode.
    Termasuk menangkap link YouTube dan balasan angka.
    """
    
    # 1. Cek apakah ini balasan (reply) berupa angka
    if text.isdigit() and quoted_text and "🔗 https://" in quoted_text:
        if handle_reply_download(client, ev, text, quoted_text, sender_jid):
            return True
            
    # 2. Cek apakah ini perintah edit heatmap (!modify) pada reply
    if text_lower.startswith("!modify ") and quoted_text and "🔗 https://" in quoted_text:
        url_match = re.search(r"🔗 (https?://[^\s]+)", quoted_text)
        if url_match:
            url = url_match.group(1).strip()
            # Rekonstruksi seolah-olah user mengirimkan link baru dengan parameter
            fake_text = url + " " + text[len("!modify "):].strip()
            if handle_heatmap_request(client, ev, fake_text, sender_jid):
                return True
                
    # 3. Cek apakah ini link YouTube
    if text_lower.startswith("https://") and ("youtube.com" in text_lower or "youtu.be" in text_lower):
        if handle_heatmap_request(client, ev, text, sender_jid):
            return True
            
    # 4. Cek apakah ini perintah edit video
    if text_lower.startswith("!edit"):
        if handle_edit_command(client, ev, text_lower, sender_jid):
            return True
            
    # 5. Jika bukan semuanya, berikan panduan mode clip
    client.send_message(
        ev.Info.MessageSource.Chat,
        "❌ Perintah tidak dikenali dalam *Clip Mode*.\n\n"
        "- Kirimkan *Link YouTube* untuk memproses heatmap.\n"
        "- *Balas (Reply)* pesan hasil heatmap dengan angka untuk mendownload.\n"
        "- Ketik `exit` untuk keluar dari mode."
    )
    return True
