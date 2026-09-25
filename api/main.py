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
import uvicorn
import os

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
