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

logging.basicConfig(level=logging.INFO)

client = NewClient("bot_session.sqlite3")

# In-Memory map to keep track of user states
user_states = {}

# State Definitions
STATE_IDLE = "IDLE"
STATE_WAITING_URL = "WAITING_URL"
STATE_WAITING_COUNT = "WAITING_COUNT"
STATE_WAITING_OFFSET = "WAITING_OFFSET"

# Help message text
HELP_MESSAGE = (
    "🤖 *YT Clipper Bot*\n\n"
    "Available Modes & Commands:\n"
    "🔸 `!clip` - Enter Video Clipping Mode\n"
    "🔸 `!mode` - Check your current mode\n"
    "🔸 `!exit` - Exit the current mode and return to IDLE\n\n"
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
    # Get the sender's unique JID
    sender_jid = str(ev.Info.MessageSource.Sender)
    
    text = ev.Message.conversation or ev.Message.extendedTextMessage.text
    if not text:
        return

    text = text.strip()
    text_lower = text.lower()
    
    # Log incoming message to the terminal
    print(f"[Incoming] From: {sender_jid} | Message: {text}")
    
    if text_lower == "ping":
        client.reply_message("Pong! Bot is responding.", ev)
        return

    # Initialize user state if it's their first time interacting
    if sender_jid not in user_states:
        user_states[sender_jid] = {
            "state": STATE_IDLE,
            "url": "",
            "count": "",
            "offset": ""
        }
        
    current_state = user_states[sender_jid]["state"]
    
    # --- 1. HIGHEST PRIORITY GLOBAL OVERRIDES ---
    if text_lower == "!mode":
        if current_state == STATE_IDLE:
            mode_text = "General Menu (IDLE)"
        else:
            mode_text = "Clip Mode"
        client.reply_message(f"ℹ️ Your current mode is: *{mode_text}*", ev)
        return
        
    if text_lower == "!exit":
        if current_state == STATE_IDLE:
            client.reply_message("You are already in the General Menu.", ev)
        else:
            user_states[sender_jid]["state"] = STATE_IDLE
            client.reply_message("Exited current mode. Returned to General Menu.", ev)
        return

    # --- 2. COMMAND TRIGGERS ---
    if text_lower == "!clip":
        user_states[sender_jid] = {
            "state": STATE_WAITING_URL,
            "url": "",
            "count": "",
            "offset": ""
        }
        client.reply_message("✂️ Entering Clip Mode!\nPlease paste your YouTube Link:", ev)
        return

    # --- 3. STATE MACHINE LOGIC ---
    if current_state == STATE_IDLE:
        # If user types anything while IDLE, show the help menu
        client.reply_message(HELP_MESSAGE, ev)
        return
        
    elif current_state == STATE_WAITING_URL:
        # Validasi: URL harus HTTPS, YouTube, dan tidak ada spasi
        if " " in text or not text.startswith("https://") or not ("youtube.com" in text or "youtu.be" in text):
            client.reply_message("❌ Invalid YouTube Link! It must start with 'https://' and contain no spaces.\nPlease send the link again:", ev)
            return
            
        user_states[sender_jid]["url"] = text
        user_states[sender_jid]["state"] = STATE_WAITING_COUNT
        client.reply_message("✅ YouTube Link received. How many top clips do you want to extract? (Max: 25)", ev)
        return
        
    elif current_state == STATE_WAITING_COUNT:
        # Validasi: Harus angka, maksimal 25
        if not text.isdigit() or not (1 <= int(text) <= 25):
            client.reply_message("❌ Invalid count! Please enter a number between 1 and 25:", ev)
            return
            
        user_states[sender_jid]["count"] = text
        user_states[sender_jid]["state"] = STATE_WAITING_OFFSET
        client.reply_message("✅ Clip count received. What is the desired padding offset in seconds? (Max: 30)", ev)
        return
        
    elif current_state == STATE_WAITING_OFFSET:
        # Validasi: Harus angka, maksimal 30
        if not text.isdigit() or not (0 <= int(text) <= 30):
            client.reply_message("❌ Invalid offset! Please enter a number between 0 and 30:", ev)
            return
            
        user_states[sender_jid]["offset"] = text
        user_states[sender_jid]["state"] = STATE_IDLE
        
        # Send a final summary (MOCK)
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
        return

if __name__ == "__main__":
    print("Starting WhatsApp Bot...")
    client.connect()
