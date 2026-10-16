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
        cookie_path = body.get("cookie_path")
        url, code, err = get_direct_stream_url(vid, opts, cookie_path)
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
        cookie_path = body.get("cookie_path")
        raw_heatmap, title, code, err = get_raw_heatmap(vid, opts, cookie_path)
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
    Front-end mengirimkan konfigurasi dinamis: video_id, start, end, output_path, ydl_opts, stream_url, cookie_path.
    Server bertindak sebagai bridge pass-through minimal yang mendelegasikan ke utils/clip_downloader.py.
    """
    try:
        body = request.get_json(silent=True) or {}
        vid = body.get("video_id") or video_id or request.args.get("video_id")
        start = body.get("start")
        end = body.get("end")
        output_path = body.get("output_path")
        opts = body.get("ydl_opts")
        stream_url = body.get("stream_url")
        cookie_path = body.get("cookie_path")

        path, ret_url, code, err = download_youtube_clip_range(vid, start, end, output_path, opts, stream_url, cookie_path)
        if code or err:
            status_code = 400 if ("REQUIRED" in str(code) or "INVALID" in str(code)) else 500
            return jsonify({
                "message": code or "DOWNLOAD_FAILED",
                "error": err or str(code),
                "stream_url": ret_url
            }), status_code

        return jsonify({
            "status": "success",
            "output_path": path,
            "stream_url": ret_url
        }), 200
    except Exception as e:
        return jsonify({
            "message": "DOWNLOAD_FAILED",
            "error": str(e)
        }), 500

@app.route("/api/download-gdrive-file", methods=["POST"])
def download_gdrive_file():
    """
    Endpoint Pass-Through murni untuk mengunduh file publik dari Google Drive tanpa login.
    Frontend mengirimkan: file_id dan output_path.
    """
    try:
        body = request.get_json(silent=True) or {}
        file_id = body.get("file_id")
        output_path = body.get("output_path")
        cfg = body.get("config") or {}

        if not file_id or not output_path:
            return jsonify({
                "code": "INVALID_PARAMS",
                "message": "INVALID_PARAMS",
                "error": "Parameter 'file_id' and 'output_path' are required"
            }), 400

        output_dir = os.path.dirname(output_path)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)

        import requests
        import re

        session = requests.Session()
        headers = cfg.get("headers") or {}
        if headers:
            session.headers.update(headers)

        timeout = cfg.get("timeout", 30)
        url_templates = cfg.get("urlTemplates") or [
            "https://drive.usercontent.google.com/download?id={file_id}&export=download&authuser=0&confirm=t",
            "https://drive.google.com/uc?export=download&id={file_id}&confirm=t",
            "https://drive.google.com/uc?id={file_id}&export=download",
        ]
        urls_to_try = [tpl.replace("{file_id}", file_id) for tpl in url_templates]

        res = None
        last_req_error = None
        for u in urls_to_try:
            try:
                temp_res = session.get(u, stream=True, timeout=timeout)
                if temp_res.status_code == 200:
                    res = temp_res
                    break
                else:
                    last_req_error = f"HTTP {temp_res.status_code} from {u}"
            except Exception as e_req:
                last_req_error = str(e_req)
                continue

        if not res or res.status_code != 200:
            status_code = res.status_code if res else 500
            err_detail = last_req_error or f"HTTP {status_code}: Google Drive request failed"
            return jsonify({
                "code": "GDRIVE_DOWNLOAD_FAILED",
                "message": "GDRIVE_DOWNLOAD_FAILED",
                "error": err_detail
            }), 400

        # Cek jika respons awal adalah halaman HTML konfirmasi virus scan Google
        content_type = res.headers.get("Content-Type", "")
        if "text/html" in content_type:
            confirm_token = None
            for k, v in session.cookies.items():
                if k.startswith("download_warning"):
                    confirm_token = v
                    break
            if not confirm_token:
                match = re.search(r'confirm=([0-9A-Za-z_]+)', res.text)
                if match:
                    confirm_token = match.group(1)

            if confirm_token:
                confirm_url = f"https://drive.google.com/uc?export=download&id={file_id}&confirm={confirm_token}"
                try:
                    res = session.get(confirm_url, stream=True, timeout=timeout)
                except Exception as e_conf:
                    return jsonify({
                        "code": "GDRIVE_DOWNLOAD_FAILED",
                        "message": "GDRIVE_DOWNLOAD_FAILED",
                        "error": str(e_conf)
                    }), 500

        with open(output_path, "wb") as f:
            for chunk in res.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)

        if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
            return jsonify({
                "code": "GDRIVE_FILE_EMPTY",
                "message": "GDRIVE_FILE_EMPTY",
                "error": f"Downloaded file at '{output_path}' is empty or not created"
            }), 500

        # Validasi isi file: pastikan bukan halaman HTML (misal preview folder atau pesan error HTML)
        with open(output_path, "rb") as f:
            header_sample = f.read(512).decode('utf-8', errors='ignore').strip()
            if header_sample.startswith("<!DOCTYPE html") or header_sample.startswith("<html"):
                try:
                    os.remove(output_path)
                except Exception:
                    pass
                return jsonify({
                    "code": "GDRIVE_HTML_CONTENT",
                    "message": "GDRIVE_HTML_CONTENT",
                    "error": "Google Drive returned an HTML page instead of plain text cookies.txt"
                }), 400

        return jsonify({
            "status": "success",
            "output_path": output_path
        }), 200
    except Exception as e:
        return jsonify({
            "code": "GDRIVE_DOWNLOAD_FAILED",
            "message": "GDRIVE_DOWNLOAD_FAILED",
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
