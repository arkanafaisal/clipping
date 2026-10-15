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
    Mengembalikan 100% error terstruktur: { "message": "<CODE>", "error": "<RAW_DETAIL>" }.
    """
    try:
        body = request.get_json(silent=True) or {}
        vid = body.get("video_id") or video_id or request.args.get("video_id")
        opts = body.get("ydl_opts")
        url, code, err = get_direct_stream_url(vid, opts)
        if code or err:
            status_code = 404 if code == "STREAM_NOT_FOUND" else (429 if code == "RATE_LIMIT_EXCEEDED" else 400)
            return jsonify({
                "message": code or "STREAM_ERROR",
                "error": err or str(code)
            }), status_code
            
        return jsonify({
            "stream_url": url
        }), 200
    except Exception as e:
        return jsonify({
            "message": "INTERNAL_ERROR",
            "error": str(e)
        }), 500

@app.route("/api/heatmap", methods=["POST", "GET"])
@app.route("/api/heatmap/<video_id>", methods=["POST", "GET"])
def get_heatmap(video_id=None):
    """
    Endpoint Pass-Through murni untuk mengambil data mentah heatmap ('Most Replayed') dan title.
    Mengembalikan 100% error terstruktur: { "message": "<CODE>", "error": "<RAW_DETAIL>" }.
    """
    try:
        body = request.get_json(silent=True) or {}
        vid = body.get("video_id") or video_id or request.args.get("video_id")
        opts = body.get("ydl_opts")
        raw_heatmap, title, code, err = get_raw_heatmap(vid, opts)
        if code or err:
            status_code = 404 if code == "HEATMAP_NOT_FOUND" else (429 if code == "RATE_LIMIT_EXCEEDED" else 400)
            return jsonify({
                "message": code or "HEATMAP_ERROR",
                "error": err or str(code)
            }), status_code

        return jsonify({
            "title": title,
            "heatmap": raw_heatmap
        }), 200
    except Exception as e:
        return jsonify({
            "message": "INTERNAL_ERROR",
            "error": str(e)
        }), 500

@app.route("/api/download-clip", methods=["POST"])
@app.route("/api/download-clip/<video_id>", methods=["POST"])
def download_clip(video_id=None):
    """
    Endpoint Pass-Through murni untuk mendownload rentang klip spesifik YouTube.
    Front-end mengirimkan konfigurasi dinamis: video_id, start, end, output_path, ydl_opts.
    Server bertindak sebagai bridge pass-through minimal tanpa fallback / hardcoded config.
    """
    try:
        body = request.get_json(silent=True) or {}
        vid = body.get("video_id") or video_id or request.args.get("video_id")
        start = body.get("start")
        end = body.get("end")
        output_path = body.get("output_path")
        ydl_opts_in = body.get("ydl_opts") or {}

        # Validasi ketat kelengkapan parameter tanpa fallback
        if not vid or start is None or end is None or not output_path:
            return jsonify({
                "message": "INVALID_PARAMS",
                "error": "Parameter 'video_id', 'start', 'end', dan 'output_path' wajib disertakan oleh frontend."
            }), 400

        try:
            start_num = float(start)
            end_num = float(end)
        except (ValueError, TypeError):
            return jsonify({
                "message": "INVALID_RANGE",
                "error": "Parameter 'start' dan 'end' harus berupa angka waktu valid."
            }), 400

        if end_num <= start_num:
            return jsonify({
                "message": "INVALID_RANGE",
                "error": f"Waktu 'end' ({end_num}) harus lebih besar daripada 'start' ({start_num})."
            }), 400

        # Alokasi direktori output sesuai path dari frontend
        output_dir = os.path.dirname(output_path)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)

        import yt_dlp
        from yt_dlp.utils import download_range_func

        ydl_opts = dict(ydl_opts_in)
        ydl_opts["outtmpl"] = output_path
        ydl_opts["download_ranges"] = download_range_func(None, [(start_num, end_num)])
        ydl_opts["force_keyframes_at_cuts"] = True

        url = f"https://www.youtube.com/watch?v={vid}"
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        if not os.path.exists(output_path):
            return jsonify({
                "message": "DOWNLOAD_FAILED",
                "error": f"File output tidak ditemukan di '{output_path}' setelah eksekusi download selesai."
            }), 500

        return jsonify({
            "status": "success",
            "output_path": output_path
        }), 200
    except Exception as e:
        return jsonify({
            "message": "DOWNLOAD_FAILED",
            "error": str(e)
        }), 500

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
