import json
import os
import time

HISTORY_FILE = "clip_history.json"

def save_clip_history(message_id, url, start_time, end_time, local_path):
    """Menyimpan data klip video ke dalam JSON berdasarkan Message ID"""
    try:
        history = {}
        if os.path.exists(HISTORY_FILE):
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                history = json.load(f)
                
        history[message_id] = {
            "url": url,
            "start": start_time,
            "end": end_time,
            "local_path": local_path,
            "timestamp": time.time()
        }
        
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(history, f, indent=4)
    except Exception as e:
        print(f"[HISTORY] Gagal menyimpan history: {e}")

def get_clip_history(message_id):
    """Membaca metadata klip video berdasarkan Message ID yang di-reply"""
    try:
        if os.path.exists(HISTORY_FILE):
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                history = json.load(f)
                return history.get(message_id)
    except Exception as e:
        print(f"[HISTORY] Gagal membaca history: {e}")
    return None

def clean_old_history(max_age_seconds=3600):
    """Menghapus entri JSON yang lebih tua dari batas usia (misal: 1 jam)"""
    try:
        if not os.path.exists(HISTORY_FILE):
            return
            
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            history = json.load(f)
            
        current_time = time.time()
        keys_to_delete = []
        
        for msg_id, data in history.items():
            if current_time - data.get("timestamp", 0) > max_age_seconds:
                keys_to_delete.append(msg_id)
                
        if not keys_to_delete:
            return
            
        for key in keys_to_delete:
            del history[key]
            
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(history, f, indent=4)
            
        print(f"[HISTORY] Berhasil menghapus {len(keys_to_delete)} data kedaluwarsa dari clip_history.json")
    except Exception as e:
        print(f"[HISTORY] Gagal membersihkan history lama: {e}")

def find_existing_clip(url, start_time, end_time):
    """Mencari apakah klip dengan url, start, dan end yang sama persis sudah ada di lokal."""
    try:
        if not os.path.exists(HISTORY_FILE):
            return None
            
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            history = json.load(f)
            
        for msg_id, data in history.items():
            if data.get("url") == url and data.get("start") == start_time and data.get("end") == end_time:
                local_path = data.get("local_path")
                if local_path and os.path.exists(local_path):
                    return local_path
    except Exception as e:
        print(f"[HISTORY] Gagal mencari existing clip: {e}")
    return None
