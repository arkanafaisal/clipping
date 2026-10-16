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
        "message": "Server Python berjalan mandiri di dalam HP!"
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
    Server bertindak sebagai bridge pass-through minimal tanpa fallback / hardcoded config.
    """
    try:
        body = request.get_json(silent=True) or {}
        vid = body.get("video_id") or video_id or request.args.get("video_id")
        start = body.get("start")
        end = body.get("end")
        output_path = body.get("output_path")
        ydl_opts_in = body.get("ydl_opts") or {}
        stream_url = body.get("stream_url")
        cookie_path = body.get("cookie_path")

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

        import json
        import yt_dlp
        from yt_dlp.utils import download_range_func

        ydl_opts = dict(ydl_opts_in)
        ydl_opts["outtmpl"] = output_path
        ydl_opts["download_ranges"] = download_range_func(None, [(start_num, end_num)])
        ydl_opts["force_keyframes_at_cuts"] = True

        source_url = stream_url if stream_url else f"https://www.youtube.com/watch?v={vid}"
        extracted_stream_url = stream_url
        info_json_path = ydl_opts.get("load_info_filename")

        # 1. Coba Mode Anonim
        opts_anon = dict(ydl_opts)
        opts_anon.pop('cookiefile', None)

        first_error_msg = None
        download_success = False

        try:
            with yt_dlp.YoutubeDL(opts_anon) as ydl:
                ydl.download([source_url])
            if os.path.exists(output_path):
                download_success = True
        except Exception as e_anon:
            first_error_msg = str(e_anon)

        # 2. Coba Mode Cookies jika anonim gagal
        if not download_success and cookie_path and os.path.exists(cookie_path):
            opts_cookies = dict(ydl_opts)
            opts_cookies['cookiefile'] = cookie_path
            try:
                with yt_dlp.YoutubeDL(opts_cookies) as ydl:
                    ydl.download([source_url])
                if os.path.exists(output_path):
                    download_success = True
            except Exception as e_cookies:
                first_error_msg = str(e_cookies)

        if not extracted_stream_url and info_json_path and os.path.exists(info_json_path):
            try:
                with open(info_json_path, 'r', encoding='utf-8') as f:
                    info_data = json.load(f)
                    extracted_stream_url = info_data.get('url') or (info_data.get('formats', [{}])[-1].get('url'))
            except Exception:
                pass

        if not download_success or not os.path.exists(output_path):
            err_text = first_error_msg or f"File output tidak ditemukan di '{output_path}' setelah eksekusi download selesai."
            code = "RATE_LIMIT_EXCEEDED" if ("429" in err_text or "rate limit" in err_text.lower()) else "DOWNLOAD_FAILED"
            return jsonify({
                "message": code,
                "error": err_text,
                "stream_url": extracted_stream_url
            }), 500

        return jsonify({
            "status": "success",
            "output_path": output_path,
            "stream_url": extracted_stream_url
        }), 200
    except Exception as e:
        return jsonify({
            "message": "DOWNLOAD_FAILED",
            "error": str(e),
            "stream_url": stream_url
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

        if not file_id or not output_path:
            return jsonify({
                "message": "INVALID_PARAMS",
                "error": "Parameter 'file_id' dan 'output_path' wajib disertakan."
            }), 400

        output_dir = os.path.dirname(output_path)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)

        import requests
        download_url = f"https://drive.usercontent.google.com/download?id={file_id}&export=download"
        res = requests.get(download_url, stream=True, timeout=30)
        
        if res.status_code != 200:
            fallback_url = f"https://drive.google.com/uc?export=download&id={file_id}"
            res = requests.get(fallback_url, stream=True, timeout=30)

        if res.status_code != 200:
            return jsonify({
                "message": "GDRIVE_DOWNLOAD_FAILED",
                "error": f"HTTP {res.status_code}: Gagal mengunduh file publik dari Google Drive."
            }), 400

        with open(output_path, "wb") as f:
            for chunk in res.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)

        if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
            return jsonify({
                "message": "GDRIVE_DOWNLOAD_FAILED",
                "error": "File hasil unduhan Google Drive kosong atau tidak tersimpan."
            }), 500

        return jsonify({
            "status": "success",
            "output_path": output_path
        }), 200
    except Exception as e:
        return jsonify({
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

def start_server(port=8080):
    print(f"[Native Python] Starting Pure Pass-Through Server di port {port}...")
    app.run(host="127.0.0.1", port=port, debug=False, use_reloader=False, threaded=True)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    start_server(port=port)
