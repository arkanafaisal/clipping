# logger.py

def log_incoming_message(sender_jid, text):
    """Mencetak pesan masuk ke terminal agar rapi dan terpusat."""
    print(f"[Incoming] From: {sender_jid} | Message: {text}")
