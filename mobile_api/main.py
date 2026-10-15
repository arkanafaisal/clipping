import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, jsonify, request
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

@app.route("/api/stream", methods=["POST", "GET"])
@app.route("/api/stream/<video_id>", methods=["POST", "GET"])
def get_stream(video_id=None):
    """
    Endpoint Pass-Through murni untuk mengekstrak direct stream URL dari YouTube.
    Validasi didelegasikan seutuhnya ke get_direct_stream_url.
    """
    body = request.get_json(silent=True) or {}
    url, err = get_direct_stream_url(
        body.get("video_id") or video_id or request.args.get("video_id"),
        body.get("ydl_opts")
    )
    if err:
        return jsonify({"error": err}), 400
        
    return jsonify({
        "stream_url": url
    }), 200

@app.route("/api/heatmap", methods=["POST", "GET"])
@app.route("/api/heatmap/<video_id>", methods=["POST", "GET"])
def get_heatmap(video_id=None):
    """
    Endpoint Pass-Through murni untuk mengambil data mentah heatmap ('Most Replayed') dan title.
    Validasi didelegasikan seutuhnya ke get_raw_heatmap.
    """
    body = request.get_json(silent=True) or {}
    raw_heatmap, title, err = get_raw_heatmap(
        body.get("video_id") or video_id or request.args.get("video_id"),
        body.get("ydl_opts")
    )
    if err:
        return jsonify({"error": err}), 400

    return jsonify({
        "title": title,
        "heatmap": raw_heatmap
    }), 200

# ==============================================================================
# [COMMENTED OUT - TIDAK DIGUNAKAN DI MOBILE NATIVE]
# 1. /api/proxy_stream:
#    Pemutar video native Android (ExoPlayer / expo-video) langsung memutar
#    direct URL HTTPS Google Video tanpa terhambat CORS browser.
# 2. /api/download-to-gdrive & Full video downloader.
# ==============================================================================

def start_server(port=3006):
    print(f"[API] Starting Pure Pass-Through Flask Server di port {port}...")
    app.run(host="0.0.0.0", port=port, debug=False, use_reloader=False, threaded=True)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3006))
    start_server(port=port)
