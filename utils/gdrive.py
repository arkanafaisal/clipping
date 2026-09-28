import os.path
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

# Scope yang diperlukan (harus sama dengan di auth_gdrive.py)
SCOPES = ['https://www.googleapis.com/auth/drive.file']

def upload_to_gdrive(filepath, filename=None):
    """
    Mengunggah file ke Google Drive utama pengguna.
    """
    import os
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    token_path = os.path.join(base_dir, 'token.json')
    
    creds = None
    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)
        
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            from google.auth.transport.requests import Request
            try:
                creds.refresh(Request())
                # Update token.json dengan token baru
                with open(token_path, 'w') as token:
                    token.write(creds.to_json())
            except Exception as e:
                print(f"❌ ERROR GDrive: Gagal me-refresh token: {e}")
                return None
        else:
            print(f"❌ ERROR GDrive: token.json tidak ditemukan atau tidak valid di path: {token_path}")
            print("Silakan jalankan 'python auth_gdrive.py' di terminal server terlebih dahulu.")
            return None

    try:
        # Membangun service Drive API
        service = build('drive', 'v3', credentials=creds)

        if not filename:
            filename = os.path.basename(filepath)

        # Metadata file, kita tidak memberikan 'parents' sehingga akan di-upload ke Root folder
        file_metadata = {'name': filename}
        media = MediaFileUpload(filepath, mimetype='video/mp4', resumable=True)

        print(f"[GDRIVE] Memulai proses upload '{filename}' ke Google Drive...")
        
        # Mengeksekusi upload
        file = service.files().create(body=file_metadata,
                                      media_body=media,
                                      fields='id, webViewLink').execute()
        
        file_id = file.get('id')
        link = file.get('webViewLink')
        
        print(f"[GDRIVE] ✅ Upload Sukses! File ID: {file_id}")
        
        # Mengubah permissions agar 'Anyone with the link can view' (Opsional tapi disarankan agar bisa di-preview di WA)
        try:
            permission = {
                'type': 'anyone',
                'role': 'reader',
            }
            service.permissions().create(fileId=file_id, body=permission).execute()
            print("[GDRIVE] Izin file telah di-set menjadi Public (View Only).")
        except Exception as e_perm:
            print(f"[GDRIVE] Gagal mengubah izin file, link mungkin private: {e_perm}")
            
        return link

    except Exception as e:
        print(f"[GDRIVE] ❌ Terjadi error saat mengupload ke Google Drive: {e}")
        raise e
