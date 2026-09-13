import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from utils.stream_extractor import get_direct_stream_url
from utils.heatmap import get_top_clips
import uvicorn

app = FastAPI(title="YT Clipper Stream API")

# Setup CORS agar bisa di-hit dari frontend React
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Sangat permissif untuk development lokal
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/stream/{video_id}")
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
        print(f"[API CRITICAL ERROR] Failed to process video '{video_id}': {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@app.get("/heatmap/{video_id}")
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

if __name__ == "__main__":
    print("[API] Starting Uvicorn Server di port 8000...")
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
