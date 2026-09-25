import os
import sys
import logging
import threading
import time

# Tambahkan root directory ke sys.path agar bisa import utils
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Waktu bot mulai dinyalakan (dalam epoch seconds)
BOT_START_TIME = int(time.time())

# [BUGFIX] Monkeypatch for Python 3.10 to support neonize's 'Self' import
import typing
if not hasattr(typing, 'Self'):
    try:
        from typing_extensions import Self
        typing.Self = Self
    except ImportError:
        pass

from neonize.client import NewClient
from neonize.events import MessageEv, ConnectedEv

# Import Modules yang telah direfactor
from utils.logger import log_incoming_message
from utils.cleanup import start_cleanup_thread
from utils.youtube_auth import check_youtube_auth
from bot.fast_download import handle_fast_download
from bot.heatmap_handler import handle_heatmap_request

logging.basicConfig(level=logging.INFO)
client = NewClient("bot_session.sqlite3")

# Help message text
HELP_MESSAGE = (
    "🤖 *YT Clipper Bot*\n\n"
    "Available Commands:\n"
    "🔸 `!heatmap <url> [params]` - Find top clips from a video\n"
    "🔸 `!download <url> <ranges>` - Download clips directly\n"
    "🔸 `!edit [params]` - Regenerate a heatmap by replying to it\n"
)

# List Nomor yang Diizinkan (Whitelist)
# Isi dengan format kode negara tanpa '+', misalnya "6281234567890"
# Jika list ini kosong ([]), maka SEMUA orang diizinkan mengakses bot.
ALLOWED_NUMBERS = [
    # "6281234567890",
    "40901258817536", #6285791572090
    "65446929793277"
]

@client.event(ConnectedEv)
def on_connected(client: NewClient, ev: ConnectedEv):
    print("\n=====================================================")
    print("✅ WhatsApp Bot Connected (Mockup Stage)!")
    print("Waiting for incoming messages...")
    print("=====================================================\n")

def process_message(client: NewClient, ev: MessageEv):
    # Dapatkan pengirim unik
    sender_jid_obj = ev.Info.MessageSource.Sender
    sender_number = getattr(sender_jid_obj, 'User', str(sender_jid_obj).split('@')[0])
    sender_jid = f"{sender_number}@s.whatsapp.net"
    

    # --- IGNORE HISTORICAL/OLD MESSAGES ---
    # Coba ambil timestamp dari neonize
    msg_time = getattr(ev.Info, 'Timestamp', 0) / 1000
    

    if msg_time:    
        if msg_time <= BOT_START_TIME:
            return
    else:
        if time.time() - BOT_START_TIME < 30:
            return
            
    # --- AUTHORIZATION CHECK ---
    if ALLOWED_NUMBERS and sender_number not in ALLOWED_NUMBERS:
        print(f"[BLOCKED] Pesan dari {sender_number} diabaikan karena tidak ada di ALLOWED_NUMBERS.")
        # Jika daftar ALLOWED_NUMBERS ada isinya, dan pengirim tidak ada di daftar, abaikan pesannya.
        return
        
    # --- DOCUMENT HANDLER (Update Cookies) ---
    if ev.Message.documentMessage:
        doc = ev.Message.documentMessage
        filename = getattr(doc, 'fileName', '')
        if filename.lower() == 'cookies.txt':
            try:
                client.send_message(ev.Info.MessageSource.Chat, "⏳ Memperbarui cookies.txt...")
                data = client.download_any(ev.Message)
                base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                cookie_path = os.path.join(base_dir, 'cookies.txt')
                with open(cookie_path, 'wb') as f:
                    f.write(data)
                client.send_message(ev.Info.MessageSource.Chat, "✅ File cookies.txt berhasil diperbarui! IP/Sesi telah di-reset.")
            except Exception as e:
                client.send_message(ev.Info.MessageSource.Chat, f"❌ Gagal memperbarui cookies: {e}")
            return
            
    text = ev.Message.conversation or (ev.Message.extendedTextMessage.text if ev.Message.extendedTextMessage else "")
    if not text:
        return

    text = text.strip()
    text_lower = text.lower()
    
    # 1. Catat ke terminal menggunakan module logger
    log_incoming_message(sender_jid, text)
    
    # --- REPLY EXTRACTOR ---
    quoted_text = ""
    if ev.Message.extendedTextMessage and ev.Message.extendedTextMessage.contextInfo and ev.Message.extendedTextMessage.contextInfo.quotedMessage:
        quoted_msg = ev.Message.extendedTextMessage.contextInfo.quotedMessage
        quoted_text = quoted_msg.conversation or (quoted_msg.extendedTextMessage.text if quoted_msg.extendedTextMessage else "")
        
    # --- ROUTING PERINTAH (STATELESS) ---
    
    # 1. Perintah Heatmap
    if text_lower.startswith("!heatmap"):
        handle_heatmap_request(client, ev, text, sender_jid)
        return
        
    # 2. Perintah Download & Stop
    if text_lower.startswith("!download") or text_lower.startswith("!stop"):
        handle_fast_download(client, ev, text, sender_jid)
        return
        
    # 3. Perintah Edit (Regenerate Heatmap)
    if text_lower.startswith("!edit") or text_lower.startswith("!modify"):
        if quoted_text and "🔗 https" in quoted_text and "🎬" in quoted_text:
            # Ekstrak URL dari pesan yang di-reply
            import re
            url_match = re.search(r"🔗\s+(https?://[^\s]+)", quoted_text)
            if url_match:
                url = url_match.group(1).strip()
                # Gabungkan perintah dengan URL dan serahkan ke heatmap_handler
                params = text.split(' ', 1)[1] if ' ' in text else ""
                new_text = f"!heatmap {url} {params}".strip()
                handle_heatmap_request(client, ev, new_text, sender_jid)
            else:
                client.send_message(ev.Info.MessageSource.Chat, "❌ Tidak dapat menemukan URL pada pesan yang Anda balas.")
        else:
            client.send_message(ev.Info.MessageSource.Chat, "❌ Mohon balas (reply) hasil Heatmap jika ingin mengubah parameternya.")
        return
        
    # 5. Fallback ke Help Message
    client.reply_message(HELP_MESSAGE, ev)
    return

@client.event(MessageEv)
def on_message(client: NewClient, ev: MessageEv):
    # Spawn a thread for every incoming message
    thread = threading.Thread(target=process_message, args=(client, ev))
    thread.daemon = True
    thread.start()

if __name__ == "__main__":
    print("Starting WhatsApp Bot...")
    # Jalankan auto-destroy daemon: mengecek folder 'output' tiap 5 menit, hapus file yg usianya lebih dari 1 jam (3600 detik)
    start_cleanup_thread(output_dir="output", max_age_seconds=3600, check_interval=300)
    
    # Mengecek auth YouTube sebelum bot standby
    check_youtube_auth()
    
    client.connect()
