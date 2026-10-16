import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, jsonify, request
from utils.stream_extractor import get_direct_stream_url
from utils.heatmap import get_raw_heatmap
from utils.clip_downloader import download_youtube_clip_range

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
    Server bertindak sebagai bridge pass-through minimal yang mendelegasikan ke utils/clip_downloader.py.
    """
    try:
        body = request.get_json(silent=True) or {}
        vid = body.get("video_id") or video_id or request.args.get("video_id")
        start = body.get("start")
        end = body.get("end")
        output_path = body.get("output_path")
        opts = body.get("ydl_opts")

        path, code, err = download_youtube_clip_range(vid, start, end, output_path, opts)
        if code or err:
            status_code = 400 if ("REQUIRED" in str(code) or "INVALID" in str(code)) else (429 if code == "RATE_LIMIT_EXCEEDED" else 500)
            return jsonify({
                "message": code or "DOWNLOAD_FAILED",
                "error": err or str(code)
            }), status_code

        return jsonify({
            "status": "success",
            "output_path": path
        }), 200
    except Exception as e:
        return jsonify({
            "message": "DOWNLOAD_FAILED",
            "error": str(e)
        }), 500

# ==============================================================================
# [WORK IN PROGRESS - COMMENTED OUT]
# Endpoint Pass-Through murni untuk ekstraksi subtitle YouTube via yt-dlp.
# Frontend mengirimkan: video_id, output_dir, lang (default: 'id'), dan ydl_opts.
# Backend mengekstrak subtitle (.vtt) tanpa mendownload video, dan mengembalikan kontennya.
# ==============================================================================
# @app.route("/api/subtitles", methods=["POST"])
# @app.route("/api/subtitles/<video_id>", methods=["POST"])
# def get_subtitles(video_id=None):
#     try:
#         body = request.get_json(silent=True) or {}
#         vid = body.get("video_id") or video_id or request.args.get("video_id")
#         output_sub_dir = body.get("output_dir")
#         ydl_opts_in = body.get("ydl_opts") or {}
#         lang = body.get("lang", "id")
# 
#         if not vid or not output_sub_dir:
#             return jsonify({
#                 "message": "INVALID_PARAMS",
#                 "error": "Parameter 'video_id' dan 'output_dir' wajib disertakan oleh frontend."
#             }), 400
# 
#         if not os.path.exists(output_sub_dir):
#             os.makedirs(output_sub_dir, exist_ok=True)
# 
#         import yt_dlp
#         outtmpl = os.path.join(output_sub_dir, f"{vid}.%(ext)s")
#         ydl_opts = dict(ydl_opts_in)
#         ydl_opts["skip_download"] = True
#         ydl_opts["writesubtitles"] = True
#         ydl_opts["writeautomaticsub"] = True
#         ydl_opts["subtitleslangs"] = [lang, "en"]
#         ydl_opts["subtitlesformat"] = "vtt"
#         ydl_opts["outtmpl"] = outtmpl
# 
#         url = f"https://www.youtube.com/watch?v={vid}"
#         with yt_dlp.YoutubeDL(ydl_opts) as ydl:
#             ydl.download([url])
# 
#         # Cari file .vtt yang dihasilkan di direktori output
#         found_file = None
#         for fname in os.listdir(output_sub_dir):
#             if fname.startswith(vid) and fname.endswith(".vtt"):
#                 found_file = os.path.join(output_sub_dir, fname)
#                 break
# 
#         if not found_file or not os.path.exists(found_file):
#             return jsonify({
#                 "message": "SUBTITLE_NOT_FOUND",
#                 "error": f"Subtitle untuk video '{vid}' tidak ditemukan di YouTube."
#             }), 404
# 
#         with open(found_file, "r", encoding="utf-8") as f:
#             vtt_content = f.read()
# 
#         return jsonify({
#             "status": "success",
#             "sub_path": found_file,
#             "content": vtt_content
#         }), 200
#     except Exception as e:
#         return jsonify({
#             "message": "SUBTITLE_ERROR",
#             "error": str(e)
#         }), 500


# ==============================================================================
# [COMMENTED OUT - TIDAK DIGUNAKAN DI MOBILE NATIVE]
# 1. /api/proxy_stream:
#    Pemutar video native Android (ExoPlayer / expo-video) langsung memutar
#    direct URL HTTPS Google Video tanpa terhambat CORS browser.
# 2. /api/download-to-gdrive & Full video downloader.
# ==============================================================================

@app.route("/api/storage/sync", methods=["POST"])
def sync_storage():
    """
    Menyimpan file JSON data (draft, heatmap, workshops) langsung ke shared folder:
    /storage/emulated/0/clipping/data/<filename>.json
    Termux memiliki izin akses Linux langsung ke root shared storage Android.
    """
    try:
        body = request.get_json(silent=True) or {}
        filename = body.get("filename")
        content = body.get("content")

        if not filename or content is None:
            return jsonify({
                "message": "INVALID_PARAMS",
                "error": "Parameter 'filename' dan 'content' wajib disertakan."
            }), 400

        data_dir = "/storage/emulated/0/clipping/data"
        os.makedirs(data_dir, exist_ok=True)

        clean_name = filename if filename.endswith(".json") else f"{filename}.json"
        file_path = os.path.join(data_dir, clean_name)
        with open(file_path, "w", encoding="utf-8") as f:
            if isinstance(content, str):
                f.write(content)
            else:
                import json
                f.write(json.dumps(content, ensure_ascii=False, indent=2))

        return jsonify({
            "status": "success",
            "path": file_path
        }), 200
    except Exception as e:
        return jsonify({
            "message": "STORAGE_SYNC_ERROR",
            "error": str(e)
        }), 500

@app.route("/api/check-file", methods=["POST"])
def check_file():
    """
    Memeriksa keberadaan file di penyimpanan HP secara native dari Termux Linux.
    """
    try:
        body = request.get_json(silent=True) or {}
        path = body.get("path")
        if not path:
            return jsonify({"exists": False}), 400
        return jsonify({"exists": os.path.exists(path)}), 200
    except Exception as e:
        return jsonify({"exists": False, "error": str(e)}), 500

def start_server(port=3006):
    print(f"[API] Starting Pure Pass-Through Flask Server di port {port}...")
    app.run(host="0.0.0.0", port=port, debug=False, use_reloader=False, threaded=True)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3006))
    start_server(port=port)
