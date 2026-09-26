import os
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

# If modifying these scopes, delete the file token.json.
SCOPES = ['https://www.googleapis.com/auth/drive.file']

def get_gdrive_service():
    """Shows basic usage of the Drive v3 API.
    Prints the names and ids of the first 10 files the user has access to.
    """
    creds = None
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    token_path = os.path.join(base_dir, 'token.json')
    creds_path = os.path.join(base_dir, 'credentials.json')

    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)
        
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(creds_path, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(token_path, 'w') as token:
            token.write(creds.to_json())

    return build('drive', 'v3', credentials=creds)

def upload_video_to_gdrive(file_path: str, video_id: str) -> str:
    """
    Uploads a video to Google Drive if it doesn't already exist.
    Returns the public shareable link.
    """
    service = get_gdrive_service()
    
    file_name = f"{video_id}.mp4"
    
    # 1. Cek apakah file sudah ada
    query = f"name='{file_name}' and trashed=false"
    results = service.files().list(q=query, fields="files(id, webViewLink)").execute()
    items = results.get('files', [])
    
    if items:
        print(f"[GDRIVE] File {file_name} sudah ada! Skip upload.")
        # Make sure it's public just in case
        file_id = items[0]['id']
        try:
            service.permissions().create(
                fileId=file_id,
                body={'type': 'anyone', 'role': 'reader'}
            ).execute()
        except Exception:
            pass
        return items[0]['webViewLink']
        
    print(f"[GDRIVE] Mengupload {file_name} ke Google Drive...")
    
    # 2. Upload file baru
    file_metadata = {'name': file_name}
    media = MediaFileUpload(file_path, mimetype='video/mp4', resumable=True, chunksize=1024*1024*5) # 5MB chunks
    
    request = service.files().create(
        body=file_metadata, 
        media_body=media,
        fields='id, webViewLink'
    )
    
    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            print(f"\r[GDRIVE] Mengupload... {int(status.progress() * 100)}%", end='', flush=True)
            
    print("\n[GDRIVE] Upload selesai, memproses link...")
    file = response
    
    file_id = file.get('id')
    
    # 3. Ubah permission jadi Public (Anyone with the link can read)
    service.permissions().create(
        fileId=file_id,
        body={'type': 'anyone', 'role': 'reader'}
    ).execute()
    
    link = file.get('webViewLink')
    print(f"[GDRIVE] Berhasil diupload: {link}")
    return link
