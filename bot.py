import os
import sys
import logging

# [BUGFIX] Monkeypatch untuk mendukung Python 3.10 ke bawah karena neonize butuh 'Self'
import typing
if not hasattr(typing, 'Self'):
    try:
        from typing_extensions import Self
        typing.Self = Self
    except ImportError:
        pass

from neonize.client import NewClient
from neonize.events import MessageEv, ConnectedEv

logging.basicConfig(level=logging.INFO)

client = NewClient("bot_session.sqlite3")

@client.event(ConnectedEv)
def on_connected(client: NewClient, ev: ConnectedEv):
    print("\n=====================================================")
    print("✅ Bot WhatsApp Berhasil Terhubung!")
    print("Menunggu pesan masuk...")
    print("=====================================================\n")

@client.event(MessageEv)
def on_message(client: NewClient, ev: MessageEv):
    # Dapatkan pengirim dan isi teks pesan
    chat_jid = ev.Info.MessageSource.Chat
    sender_jid = ev.Info.MessageSource.Sender
    
    text = ev.Message.conversation or ev.Message.extendedTextMessage.text
    if not text:
        return

    text = text.strip()
    
    # Cetak pesan masuk ke layar terminal
    print(f"[Pesan Masuk] Dari: {sender_jid}")
    print(f"Isi: {text}")
    print("-" * 40)
    
    # Contoh balasan ke pengirim:
    # Perhatikan bahwa argumen kedua untuk reply_message adalah `ev`, BUKAN `ev.Message`
    if text.lower() == "ping":
        client.reply_message("Pong! Bot berhasil merespons.", ev)

if __name__ == "__main__":
    print("Menghidupkan bot WhatsApp...")
    client.connect()
