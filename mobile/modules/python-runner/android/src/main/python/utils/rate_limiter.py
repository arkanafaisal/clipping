import time
import os
import json

# Gunakan file untuk mencatat agar state bertahan jika bot direstart
RATE_LIMIT_FILE = os.path.join(os.path.dirname(__file__), 'gate1_ratelimit.json')

class Gate1RateLimiter:
    def __init__(self, limit_per_hour=15):
        self.limit_per_hour = limit_per_hour

    def _load(self):
        if os.path.exists(RATE_LIMIT_FILE):
            try:
                with open(RATE_LIMIT_FILE, 'r') as f:
                    return json.load(f)
            except:
                pass
        return []

    def _save(self, data):
        with open(RATE_LIMIT_FILE, 'w') as f:
            json.dump(data, f)

    def check_and_add(self) -> bool:
        """Mengembalikan True jika masih dalam limit, melempar Exception jika sudah kena limit"""
        now = time.time()
        timestamps = self._load()
        
        # Bersihkan timestamp yang lebih dari 1 jam (3600 detik)
        timestamps = [ts for ts in timestamps if now - ts < 3600]
        
        if len(timestamps) >= self.limit_per_hour:
            print(f"🚫 [GERBANG 1 RATE LIMITER] LIMIT TERCAPAI! ({len(timestamps)}/{self.limit_per_hour} dalam 1 jam). Tolong tunggu sebelum mencoba lagi.")
            self._save(timestamps)
            raise Exception("RATE_LIMIT_EXCEEDED")
            
        timestamps.append(now)
        self._save(timestamps)
        print(f"✅ [GERBANG 1 RATE LIMITER] Hit API tercatat ({len(timestamps)}/{self.limit_per_hour} request dalam 1 jam terakhir).")
        return True

gate1_limiter = Gate1RateLimiter(limit_per_hour=15)
