import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, jsonify, request, Response
from utils.stream_extractor import get_direct_stream_url
from utils.heatmap import get_raw_heatmap

app = Flask(__name__)

# Setup CORS agar bisa di-hit dari frontend React Native / Web
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response

@app.route("/ping", methods=["GET"])
def ping():
    return jsonify({
        "status": "ok",
        "message": "Server Python berjalan di Termux / Mobile API (port 3006)!"
    })

@app.route("/api/stream", methods=["GET", "POST"])
@app.route("/api/stream/<video_id>", methods=["GET", "POST"])
def get_stream(video_id=None):
    """
    Endpoint Pass-Through untuk mengekstrak direct stream URL dari YouTube.
    100% dinamis: Menerima video_id dan custom ydl_opts langsung dari request body (POST) atau query/path (GET).
    Tidak ada in-memory cache dan tidak ada rate limiter di backend;
    error dari YouTube diteruskan secara mentah (raw) ke frontend.
    """
    body = request.get_json(silent=True) or {}
    vid = body.get("video_id") or video_id or request.args.get("video_id")
    
    if not vid:
        return jsonify({
            "status": "error",
            "error": "Parameter 'video_id' wajib disertakan dalam path, query, atau body."
        }), 400

    custom_opts = body.get("ydl_opts") or body.get("options")
    
    url, err = get_direct_stream_url(vid, custom_opts=custom_opts)
    if err or not url:
        return jsonify({
            "status": "error",
            "video_id": vid,
            "error": err or "Gagal mendapatkan stream URL dari YouTube."
        }), 400
        
    return jsonify({
        "status": "ok",
        "video_id": vid,
        "stream_url": url
    })

@app.route("/api/heatmap", methods=["GET", "POST"])
@app.route("/api/heatmap/<video_id>", methods=["GET", "POST"])
def get_heatmap(video_id=None):
    """
    Endpoint Pass-Through untuk mengambil data mentah heatmap ('Most Replayed') dan title video.
    100% dinamis: Backend TIDAK memformat klip, TIDAK menghitung offset (+/- 5s), dan TIDAK mengurutkan ranking.
    Data mentah (raw heatmap array) dan error dikembalikan langsung ke frontend untuk diolah di client.
    """
    body = request.get_json(silent=True) or {}
    vid = body.get("video_id") or video_id or request.args.get("video_id")
    
    if not vid:
        return jsonify({
            "status": "error",
            "error": "Parameter 'video_id' wajib disertakan dalam path, query, atau body."
        }), 400

    custom_opts = body.get("ydl_opts") or body.get("options")
    
    raw_heatmap, title, err = get_raw_heatmap(vid, custom_opts=custom_opts)
    if err and not raw_heatmap:
        return jsonify({
            "status": "error",
            "video_id": vid,
            "error": err
        }), 404
        
    # Sediakan juga formatted fallback untuk menjaga kompatibilitas backward frontend lama
    offset = int(request.args.get("offset", body.get("offset", 0)))
    num_clips = int(request.args.get("num_clips", body.get("num_clips", len(raw_heatmap))))
    sorted_moments = sorted(raw_heatmap, key=lambda x: x.get('value', 0), reverse=True)[:num_clips]
    
    fallback_clips = []
    for rank, moment in enumerate(sorted_moments, start=1):
        orig_start = moment.get('start_time', 0)
        orig_end = moment.get('end_time', 0)
        fallback_clips.append({
            "id": f"clip_{orig_start}",
            "rank": rank,
            "videoId": vid,
            "start": max(0, orig_start - offset),
            "end": orig_end + offset,
            "value": moment.get('value', 0)
        })

    return jsonify({
        "status": "ok",
        "video_id": vid,
        "title": title,
        "heatmap": raw_heatmap,      # Raw pass-through array
        "clips": fallback_clips       # Backward-compatible clips
    })

# ==============================================================================
# [OFFLOADED / COMMENTED OUT - TIDAK DIGUNAKAN DI MOBILE NATIVE]
# 1. /api/proxy_stream:
#    Pemutar video native Android (ExoPlayer / expo-video) TIDAK dibatasi oleh CORS browser web,
#    sehingga memutar langsung direct URL HTTPS Google Video dengan kecepatan penuh.
#    Proxy ini dahulu hanya dibuat untuk browser web (Chrome/Firefox) dan justru memperlambat
#    koneksi saat memakai tunnel/Tailscale karena bandwidth terbagi dua (YouTube -> Server -> HP).
#
# @app.route("/api/proxy_stream", methods=["GET"])
# def proxy_stream():
#     url = request.args.get("url")
#     if not url: return jsonify({"detail": "Missing url"}), 400
#     ...
#
# 2. /api/download-to-gdrive & Full video downloader:
#    Diberhentikan untuk fase streaming-only agar Python backend tetap minimalis & instan.
# ==============================================================================

def start_server(port=3006):
    print(f"[API] Starting Minimalist Pass-Through Flask Server di port {port}...")
    app.run(host="0.0.0.0", port=port, debug=False, use_reloader=False, threaded=True)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3006))
    start_server(port=port)
