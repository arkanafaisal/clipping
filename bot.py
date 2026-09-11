import os
import sys
import logging

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
from state_manager import init_state, STATE_IDLE
from general_commands import handle_general_commands
from clip_mode import handle_clip_mode

logging.basicConfig(level=logging.INFO)

client = NewClient("bot_session.sqlite3")

# Help message text
HELP_MESSAGE = (
    "🤖 *YT Clipper Bot*\n\n"
    "Available Modes & Commands:\n"
    "🔸 `!clip` - Enter Video Clipping Mode\n"
    "🔸 `!mode` - Check your current mode\n"
    "🔸 `!exit` - Exit the current mode and return to General Menu\n\n"
    "Please select a mode to begin."
)

@client.event(ConnectedEv)
def on_connected(client: NewClient, ev: ConnectedEv):
    print("\n=====================================================")
    print("✅ WhatsApp Bot Connected (Mockup Stage)!")
    print("Waiting for incoming messages...")
    print("=====================================================\n")

@client.event(MessageEv)
def on_message(client: NewClient, ev: MessageEv):
    # Dapatkan pengirim unik
    sender_jid = str(ev.Info.MessageSource.Sender)
    
    text = ev.Message.conversation or ev.Message.extendedTextMessage.text
    if not text:
        return

    text = text.strip()
    text_lower = text.lower()
    
    # 1. Catat ke terminal menggunakan module logger
    log_incoming_message(sender_jid, text)
    
    # Inisialisasi state user
    state_obj = init_state(sender_jid)
    current_state = state_obj["state"]
    
    # 2. Tangani Perintah Umum (Overrides) terlebih dahulu
    # Ini menjamin !exit dieksekusi lebih dulu daripada validasi input apapun.
    is_general = handle_general_commands(client, ev, text_lower, sender_jid, current_state)
    if is_general:
        return # Berhenti jika sudah ditangani oleh general command
        
    # Perbarui current state jaga-jaga kalau diubah oleh general_commands
    state_obj = init_state(sender_jid)
    current_state = state_obj["state"]

    # 3. Lempar sisa pesan ke mode klip (State Machine)
    is_clip_mode = handle_clip_mode(client, ev, text, text_lower, sender_jid, current_state)
    if is_clip_mode:
        return # Berhenti jika sudah ditangani oleh clip_mode
        
    # 4. Jika pesan tidak ditangkap oleh siapapun dan user sedang IDLE, tampilkan HELP MENU
    if current_state == STATE_IDLE:
        client.reply_message(HELP_MESSAGE, ev)
        return

if __name__ == "__main__":
    print("Starting WhatsApp Bot...")
    client.connect()
