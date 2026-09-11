# state_manager.py

user_states = {}

STATE_IDLE = "IDLE"
STATE_WAITING_URL = "WAITING_URL"
STATE_WAITING_COUNT = "WAITING_COUNT"
STATE_WAITING_OFFSET = "WAITING_OFFSET"
STATE_WAITING_CONFIRM = "WAITING_CONFIRM"

def init_state(sender_jid):
    """Membaca state atau membuat baru jika belum ada."""
    if sender_jid not in user_states:
        user_states[sender_jid] = {
            "state": STATE_IDLE,
            "url": "",
            "count": "",
            "offset": ""
        }
    return user_states[sender_jid]

def clear_state(sender_jid):
    """Menghapus total semua memori dari user tersebut agar kembali bersih."""
    user_states[sender_jid] = {
        "state": STATE_IDLE,
        "url": "",
        "count": "",
        "offset": ""
    }
