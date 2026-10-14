import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, jsonify, request, Response
import requests
from utils.stream_extractor import get_direct_stream_url
from utils.heatmap import get_top_clips
import os
import threading
import time

# Dictionary untuk menyimpan status progress download/upload
gdrive_upload_tasks = {}

app = Flask(__name__)

# Setup CORS agar bisa di-hit dari frontend React
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*" # Sangat permissif untuk development lokal
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response

@app.route("/ping", methods=["GET"])
def ping():
    return jsonify({
        "status": "ok",
        "message": "Server Python berjalan mandiri di dalam HP!"
    })

@app.route("/api/stream/<video_id>", methods=["GET"])
def get_stream(video_id: str):
    """
    Endpoint untuk mendapatkan direct stream URL dari video YouTube
    """
    try:
        url = get_direct_stream_url(video_id)
        if not url:
            print(f"[API ERROR] Stream URL for '{video_id}' could not be extracted (Returned None).")
            return jsonify({"detail": "Not Found"}), 404
            
        return jsonify({
            "video_id": video_id,
            "stream_url": url
        })
    except Exception as e:
        if "RATE_LIMIT_EXCEEDED" in str(e):
            return jsonify({"detail": "Too Many Requests to YouTube API. Silakan tunggu beberapa menit."}), 429
        print(f"[API CRITICAL ERROR] Failed to process video '{video_id}': {str(e)}")
        return jsonify({"detail": "Internal Server Error"}), 500

def background_download_and_upload(video_id: str):
    gdrive_upload_tasks[video_id] = {"status": "downloading", "link": None, "error": None}
    try:
        gdrive_upload_tasks[video_id]["status"] = "done"
        gdrive_upload_tasks[video_id]["link"] = None
    except Exception as e:
        print(f"[LOKAL API ERROR] {e}")
        gdrive_upload_tasks[video_id]["status"] = "error"
        gdrive_upload_tasks[video_id]["error"] = str(e)

@app.route("/api/download-to-gdrive", methods=["POST"])
def download_to_gdrive():
    req = request.get_json(silent=True) or {}
    video_id = req.get("video_id", "")
    
    # Cek apakah sudah ada di tasks
    if video_id in gdrive_upload_tasks:
        task = gdrive_upload_tasks[video_id]
        if task["status"] in ["downloading", "uploading", "done"]:
            return jsonify(task)

    # Kalau belum ada, kita jalankan di background
    threading.Thread(target=background_download_and_upload, args=(video_id,)).start()
    gdrive_upload_tasks[video_id] = {"status": "starting", "link": None, "error": None}
    
    return jsonify(gdrive_upload_tasks[video_id])

@app.route("/api/download-to-gdrive/active-tasks", methods=["GET"])
def get_active_gdrive_tasks():
    return jsonify(gdrive_upload_tasks)

@app.route("/api/proxy_stream", methods=["GET"])
def proxy_stream():
    """
    Endpoint proxy untuk membypass pemblokiran CORS / User-Agent dari YouTube
    hanya untuk video yang bermasalah. Mendukung Range request.
    """
    url = request.args.get("url")
    if not url:
        return jsonify({"detail": "Missing url"}), 400

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

        return Response(
            iterfile(), 
            status=req.status_code, 
            headers=response_headers
        )
    except Exception as e:
        print(f"[API ERROR] Proxy stream failed: {e}")
        return jsonify({"detail": "Failed to proxy stream"}), 500

@app.route("/api/heatmap/<video_id>", methods=["GET"])
def get_heatmap(video_id: str):
    """
    Endpoint untuk mendapatkan daftar klip berdasarkan heatmap (most replayed)
    """
    num_clips = request.args.get("num_clips", default=5, type=int)
    offset = request.args.get("offset", default=5, type=int)
    try:
        url = f"https://www.youtube.com/watch?v={video_id}"
        clips, title = get_top_clips(url, num_clips=num_clips, offset=offset)
        
        if not clips:
            return jsonify({"detail": "Gagal mengekstrak heatmap. Mungkin video tidak punya data 'Most Replayed'."}), 404
        
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
            
        return jsonify({
            "title": title,
            "clips": formatted_clips
        })
    except Exception as e:
        print(f"[API CRITICAL ERROR] Failed to fetch heatmap '{video_id}': {str(e)}")
        return jsonify({"detail": "Internal Server Error"}), 500

def start_server():
    print("[API] Starting Flask Server di port 8080...")
    app.run(host="127.0.0.1", port=8080, debug=False, use_reloader=False, threaded=True)

if __name__ == "__main__":
    start_server()
