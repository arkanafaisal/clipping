import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
import requests
from utils.stream_extractor import get_direct_stream_url
from utils.heatmap import get_top_clips
from pydantic import BaseModel
import uvicorn
import os
import threading
import time

# Dictionary untuk menyimpan status progress download/upload
gdrive_upload_tasks = {}

class GDriveDownloadRequest(BaseModel):
    video_id: str

app = FastAPI(title="YT Clipper Stream API")

# Setup CORS agar bisa di-hit dari frontend React
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Sangat permissif untuk development lokal
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/stream/{video_id}")
def get_stream(video_id: str):
    """
    Endpoint untuk mendapatkan direct stream URL dari video YouTube
    """
    try:
        url = get_direct_stream_url(video_id)
        if not url:
            print(f"[API ERROR] Stream URL for '{video_id}' could not be extracted (Returned None).")
            raise HTTPException(status_code=404, detail="Not Found")
            
        return {
            "video_id": video_id,
            "stream_url": url
        }
    except HTTPException:
        raise
    except Exception as e:
        if "RATE_LIMIT_EXCEEDED" in str(e):
            raise HTTPException(status_code=429, detail="Too Many Requests to YouTube API. Silakan tunggu beberapa menit.")
        print(f"[API CRITICAL ERROR] Failed to process video '{video_id}': {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

def background_download_and_upload(video_id: str):
    import yt_dlp
    from utils.gdrive_uploader import upload_video_to_gdrive
    from utils.youtube_auth import add_cookies
    
    gdrive_upload_tasks[video_id] = {"status": "downloading", "link": None, "error": None}
    
    try:
        output_dir = os.path.join(os.getcwd(), "output", video_id)
        os.makedirs(output_dir, exist_ok=True)
        file_path = os.path.join(output_dir, "Full_Video.mp4")
        
        if not os.path.exists(file_path):
            video_url = f"https://www.youtube.com/watch?v={video_id}"
            
            def yt_progress_hook(d):
                if d['status'] == 'downloading':
                    percent = d.get('_percent_str', 'N/A')
                    eta = d.get('_eta_str', 'N/A')
                    print(f"\r[YTDLP LOKAL] Mendownload: {percent} | ETA: {eta}", end='', flush=True)
                elif d['status'] == 'finished':
                    print("\n[YTDLP LOKAL] Download selesai, memproses file...")
                    
            from utils.downloader import download_full_video_robust
            print(f"[LOKAL API] Memulai download video {video_id} dengan metode tangguh (4-Tahap)...")
            success = download_full_video_robust(video_url, file_path, extra_hooks=[yt_progress_hook])
            if not success:
                raise Exception("Semua metode download gagal.")
                
        gdrive_upload_tasks[video_id]["status"] = "uploading"
        print(f"[LOKAL API] Mengupload {video_id} ke GDrive...")
        link = upload_video_to_gdrive(file_path, video_id)
        
        gdrive_upload_tasks[video_id]["status"] = "done"
        gdrive_upload_tasks[video_id]["link"] = link
        
    except Exception as e:
        print(f"[LOKAL API ERROR] {e}")
        gdrive_upload_tasks[video_id]["status"] = "error"
        gdrive_upload_tasks[video_id]["error"] = str(e)

@app.post("/api/download-to-gdrive")
def download_to_gdrive(req: GDriveDownloadRequest, background_tasks: BackgroundTasks):
    video_id = req.video_id
    
    # Cek apakah sudah ada di tasks
    if video_id in gdrive_upload_tasks:
        task = gdrive_upload_tasks[video_id]
        if task["status"] in ["downloading", "uploading", "done"]:
            return task
            
    # Quick check GDrive existence directly without downloading
    from utils.gdrive_uploader import get_gdrive_service
    try:
        service = get_gdrive_service()
        file_name = f"{video_id}.mp4"
        query = f"name='{file_name}' and trashed=false"
        results = service.files().list(q=query, fields="files(id, webViewLink)").execute()
        items = results.get('files', [])
        if items:
            link = items[0]['webViewLink']
            gdrive_upload_tasks[video_id] = {"status": "done", "link": link, "error": None}
            return gdrive_upload_tasks[video_id]
    except Exception as e:
        print("GDrive check error:", e)

    # Kalau belum ada, kita jalankan di background
    background_tasks.add_task(background_download_and_upload, video_id)
    gdrive_upload_tasks[video_id] = {"status": "starting", "link": None, "error": None}
    
    return gdrive_upload_tasks[video_id]

@app.get("/api/download-to-gdrive/active-tasks")
def get_active_gdrive_tasks():
    return gdrive_upload_tasks

@app.get("/api/proxy_stream")
def proxy_stream(url: str, request: Request):
    """
    Endpoint proxy untuk membypass pemblokiran CORS / User-Agent dari YouTube
    hanya untuk video yang bermasalah. Mendukung Range request.
    """
    headers = {}
    range_header = request.headers.get("Range")
    if range_header:
        headers["Range"] = range_header
        
    try:
        # Stream=True agar tidak memuat seluruh video ke memori
        req = requests.get(url, headers=headers, stream=True, timeout=10)
        
        def iterfile():
            for chunk in req.iter_content(chunk_size=1024 * 1024):  # 1MB chunks
                if chunk:
                    yield chunk

        response_headers = {
            k: v for k, v in req.headers.items() 
            if k.lower() in ("content-type", "content-length", "content-range", "accept-ranges")
        }

        return StreamingResponse(
            iterfile(), 
            status_code=req.status_code, 
            headers=response_headers
        )
    except Exception as e:
        print(f"[API ERROR] Proxy stream failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to proxy stream")

@app.get("/api/heatmap/{video_id}")
def get_heatmap(video_id: str, num_clips: int = 5, offset: int = 5):
    """
    Endpoint untuk mendapatkan daftar klip berdasarkan heatmap (most replayed)
    """
    try:
        url = f"https://www.youtube.com/watch?v={video_id}"
        clips, title = get_top_clips(url, num_clips=num_clips, offset=offset)
        
        if not clips:
            raise HTTPException(status_code=404, detail="Gagal mengekstrak heatmap. Mungkin video tidak punya data 'Most Replayed'.")
        
        # Mapping response ke struktur yang dipahami frontend: { id, videoId, start, end }
        formatted_clips = []
        for clip in clips:
            formatted_clips.append({
                "id": f"clip_{clip['original_start']}",
                "rank": clip["rank"],
                "videoId": video_id,
                "start": clip["start_time"],
                "end": clip["end_time"]
            })
            
        return {
            "title": title,
            "clips": formatted_clips
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[API CRITICAL ERROR] Failed to fetch heatmap '{video_id}': {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Server Error")



# Setup path untuk dist frontend
FRONTEND_DIST_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "dist")

# Mount folder statis (pastikan diletakkan paling bawah agar tidak menimpa endpoint API)
if os.path.exists(FRONTEND_DIST_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST_DIR, html=True), name="frontend")
else:
    print(f"[WARNING] Frontend dist folder not found at {FRONTEND_DIST_DIR}. Make sure to build the React app first.")

if __name__ == "__main__":
    print("[API] Starting Uvicorn Server di port 3006...")
    uvicorn.run("api.main:app", host="0.0.0.0", port=3006, reload=True)
