# state_manager.py

user_states = {}

# State Constants
STATE_IDLE = 0

# Heatmap Mode States
STATE_HEATMAP_URL = 1
STATE_HEATMAP_PARAMS = 2

# Download Mode States
STATE_DOWNLOAD_URL = 7
STATE_DOWNLOAD_CLIP_DATA = 8

def init_state(sender_jid):
    """Membaca state atau membuat baru jika belum ada."""
    if sender_jid not in user_states:
        user_states[sender_jid] = {
            "state": STATE_IDLE,
            "url": "",
            "count": "",
            "offset": "",
            "sort_by_point": True,
            "clips": [],
            "video_title": "",
            "current_clip_index": 0
        }
    return user_states[sender_jid]

def clear_state(sender_jid):
    """Menghapus total semua memori dari user tersebut agar kembali bersih."""
    user_states[sender_jid] = {
        "state": STATE_IDLE,
        "url": "",
        "count": "",
        "offset": "",
        "sort_by_point": True,
        "clips": [],
        "video_title": "",
        "current_clip_index": 0
    }
