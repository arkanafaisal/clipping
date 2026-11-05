import os.path
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow

# Scope akses Google Drive (butuh akses penuh agar bisa membaca folder dan berkas yang dibuat manual)
SCOPES = ['https://www.googleapis.com/auth/drive']

def main():
    """Menampilkan URL untuk login Google dan menyimpan token.json."""
    creds = None
    
    # Token.json menyimpan token akses dan refresh milik pengguna
    # File ini terbuat otomatis saat otorisasi pertama sukses
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
        
    # Jika tidak ada creds valid, minta user login.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists('credentials.json'):
                print("❌ ERROR: File 'credentials.json' tidak ditemukan!")
                print("1. Buka https://console.cloud.google.com/")
                print("2. Buat Project Baru (Gratis) -> Aktifkan 'Google Drive API'")
                print("3. Ke menu 'Credentials' -> 'Create Credentials' -> 'OAuth client ID'")
                print("4. Pilih tipe 'Desktop App'. Download JSON-nya dan simpan sebagai 'credentials.json' di folder ini.")
                return
                
            flow = InstalledAppFlow.from_client_secrets_file(
                'credentials.json', SCOPES)
            
            # Karena Google mematikan fitur copy-paste kode manual (OOB Flow),
            # kita harus menggunakan local server. Jika jalan di VPS, disarankan run script ini di PC lokal saja.
            creds = flow.run_local_server(port=8080, open_browser=False)
                
        # Simpan credentials untuk eksekusi selanjutnya
        token_json_str = creds.to_json()
        with open('token.json', 'w') as token:
            token.write(token_json_str)
        if os.path.exists('video-editor'):
            with open(os.path.join('video-editor', 'token.json'), 'w') as token:
                token.write(token_json_str)
            
    print("✅ Berhasil! token.json telah dibuat/diperbarui.")
    print("Sekarang bot dapat mengunggah file langsung ke Google Drive utama Anda.")

if __name__ == '__main__':
    main()
