import os
import sys
import logging
import threading

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
from logger import log_incoming_message
from state_manager import init_state, STATE_IDLE, STATE_CLIP_MODE
from general_commands import handle_general_commands
from clip_mode import handle_clip_mode

logging.basicConfig(level=logging.INFO)
client = NewClient("bot_session.sqlite3")

# Help message text
HELP_MESSAGE = (
    "🤖 *YT Clipper Bot*\n\n"
    "Available Modes & Commands:\n"
    "🔸 `clip` - Enter Clip Mode to find and download top clips\n"
    "🔸 `mode` - Check your current mode\n"
    "🔸 `exit` - Exit the current mode and return to General Menu\n\n"
    "Please select a command to begin."
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
    
    # --- DEBUGGING JID ---
    print(f"[DEBUG] Raw Sender Object: {sender_jid_obj}")
    print(f"[DEBUG] Extracted Number: '{sender_number}'")
    
    # --- AUTHORIZATION CHECK ---
    if ALLOWED_NUMBERS and sender_number not in ALLOWED_NUMBERS:
        print(f"[BLOCKED] Pesan dari {sender_number} diabaikan karena tidak ada di ALLOWED_NUMBERS.")
        # Jika daftar ALLOWED_NUMBERS ada isinya, dan pengirim tidak ada di daftar, abaikan pesannya.
        return
        
    text = ev.Message.conversation or ev.Message.extendedTextMessage.text
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
        
    # Inisialisasi state user
    state_obj = init_state(sender_jid)
    current_state = state_obj["state"]
    
    # 2. Tangani Perintah Umum (Overrides) terlebih dahulu
    is_general = handle_general_commands(client, ev, text_lower, sender_jid, current_state)
    if is_general:
        return # Berhenti jika sudah ditangani oleh general command
        
    # Perbarui current state jaga-jaga kalau diubah oleh general_commands
    state_obj = init_state(sender_jid)
    current_state = state_obj["state"]
    
    # 3. Lempar sisa pesan ke mode spesifik (Clip Mode)
    if current_state == STATE_CLIP_MODE:
        if handle_clip_mode(client, ev, text, text_lower, quoted_text, sender_jid):
            return
            
    # 4. Jika pesan tidak ditangkap oleh siapapun dan user sedang IDLE, tampilkan HELP MENU
    if current_state == STATE_IDLE:
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
    client.connect()
