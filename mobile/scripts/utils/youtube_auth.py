import os
import json
import time
import subprocess
import yt_dlp

def get_valid_po_token():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    token_path = os.path.join(base_dir, 'bot', 'po_token.json')
    script_path = os.path.join(base_dir, 'bot', 'generate_po.js')
    
    # 1. Periksa apakah token ada dan masih valid (< 6 jam)
    if os.path.exists(token_path):
        try:
            with open(token_path, 'r') as f:
                data = json.load(f)
                timestamp = data.get('timestamp', 0)
                # Jika umur file kurang dari 6 jam (21.600.000 ms)
                if (time.time() * 1000) - timestamp < 21600000:
                    return data
        except Exception:
            pass
            
    # 2. Jika tidak ada / kadaluwarsa, jalankan generator (Puppeteer)
    print("\n[PO TOKEN] Token kadaluwarsa atau belum ada. Sedang memanggil Node.js (Puppeteer) untuk generate...")
    try:
        subprocess.run(['node', script_path], cwd=os.path.dirname(script_path), check=True, timeout=60)
        with open(token_path, 'r') as f:
            return json.load(f)
    except subprocess.CalledProcessError as e:
        # Jika Node.js exit(1), berarti ia tidak menemukan token (IP bersih)
        print(f"[PO TOKEN] Puppeteer tidak menemukan token. Mengasumsikan IP aman, melanjutkan tanpa PO Token...")
        return None
    except Exception as e:
        print(f"[PO TOKEN] Gagal mengeksekusi generate_po.js: {e}")
        return None

def add_cookies(ydl_opts, client_type='web'):
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cookie_path = os.path.join(base_dir, 'cookies.txt')
    if os.path.exists(cookie_path):
        ydl_opts['cookiefile'] = cookie_path
        
    if client_type == 'ios':
        # Bypass PO Token secara paksa dengan iOS (Mentok 360p karena SABR)
        if 'extractor_args' not in ydl_opts:
            ydl_opts['extractor_args'] = {}
        ydl_opts['extractor_args']['youtube'] = {'player_client': ['ios', 'android']}
    elif client_type == 'web_no_po':
        # Mode Cookies Standar: Biarkan yt-dlp menggunakan algoritma 'smart fallback'-nya sendiri
        pass
    else:
        # Gunakan Klien Web dan injeksikan PO Token hasil Puppeteer
        token_data = get_valid_po_token()
        if token_data and 'poToken' in token_data:
            if 'extractor_args' not in ydl_opts:
                ydl_opts['extractor_args'] = {}
            if 'youtube' not in ydl_opts['extractor_args']:
                ydl_opts['extractor_args']['youtube'] = {}
                
            # yt-dlp membutuhkan argument: youtube:player_client=web;po_token=web+...
            ydl_opts['extractor_args']['youtube']['player_client'] = ['web']
            ydl_opts['extractor_args']['youtube']['po_token'] = [f"web+{token_data['poToken']}"]
            
            # (Opsional) jika visitorData dibutuhkan
            # ydl_opts['extractor_args']['youtube']['visitor_data'] = [token_data['visitorData']]
            print(f"[PO TOKEN] Berhasil menyuntikkan po_token: web+{token_data['poToken'][:10]}...")
        
    return ydl_opts

def check_youtube_auth():
    print("\n=====================================================")
    print("🛡️ Mengecek Status Autentikasi YouTube...")
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cookie_path = os.path.join(base_dir, 'cookies.txt')
    
    if not os.path.exists(cookie_path):
        print("❌ File cookies.txt TIDAK ditemukan.")
        print("⚠️ Bot berjalan pada mode Non-Login (Sangat rawan terblokir Anti-Bot YouTube).")
        print("=====================================================\n")
        return False

    print("✅ File cookies.txt ditemukan. Memvalidasi isi...")
    try:
        with open(cookie_path, 'r', encoding='utf-8') as f:
            content = f.read()
            if '.youtube.com' not in content:
                print("❌ Isi cookies.txt tidak valid (tidak mendeteksi sesi untuk .youtube.com).")
                print("⚠️ Pastikan Anda mengekspor cookies saat berada di halaman YouTube.")
                print("=====================================================\n")
                return False
    except Exception as e:
        print(f"❌ Gagal membaca file cookies.txt: {e}")
        return False

    print("⏳ Mencoba simulasi koneksi ke YouTube...")
    ydl_opts = {
        'cookiefile': cookie_path,
        'quiet': True,
        'no_warnings': True,
        'extract_flat': True,
        'skip_download': True,
        'extractor_args': {'youtube': {'player_client': ['ios', 'android']}}
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Menggunakan ytsearch agar tidak perlu parsing format video yang berat
            ydl.extract_info("ytsearch1:test", download=False)
            print("✅ Autentikasi SUKSES! YouTube menerima Cookies Anda.")
            print("🛡️ Anda bebas dari blokir Anti-Bot!")
            print("=====================================================\n")
            return True
    except Exception as e:
        err_msg = str(e).lower()
        if "sign in to confirm" in err_msg or "bot" in err_msg or "cookies" in err_msg:
            print("❌ Autentikasi GAGAL! Cookies mungkin sudah kedaluwarsa, tidak punya akses, atau IP terblokir keras.")
        else:
            print(f"⚠️ Koneksi bermasalah: {e}")
        print("=====================================================\n")
        return False
