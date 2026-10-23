import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Daftarkan mobile/scripts ke sys.path sebagai source of truth utama modul python
_mobile_scripts = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "mobile", "scripts")
if os.path.exists(_mobile_scripts) and _mobile_scripts not in sys.path:
    sys.path.insert(0, _mobile_scripts)

from flask import Flask, jsonify, request
from utils.stream_extractor import get_direct_stream_url
from utils.heatmap import get_raw_heatmap
from utils.clip_downloader import download_clip_direct, download_full_video_direct
from utils.subtitle_burner import burn_subtitles_to_video
from utils.subtitle_fetcher import extract_subtitles_data

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
        progress_path = body.get("progress_path")
        source_video_path = body.get("source_video_path")

        res = download_clip_direct(
            video_id=vid,
            start=start,
            end=end,
            output_path=output_path,
            stream_url=stream_url,
            cookie_path=cookie_path,
            ydl_opts=opts,
            progress_path=progress_path,
            source_video_path=source_video_path
        )
        if res.get("status") == "error":
            err_code = res.get("code") or "DOWNLOAD_FAILED"
            status_code = 400 if ("REQUIRED" in str(err_code) or "INVALID" in str(err_code)) else 500
            return jsonify({
                "code": err_code,
                "message": err_code,
                "error": res.get("error") or str(err_code),
                "stream_url": res.get("stream_url")
            }), status_code

        return jsonify({
            "status": "success",
            "output_path": res.get("output_path"),
            "stream_url": res.get("stream_url"),
            "source": res.get("source")
        }), 200
    except Exception as e:
        return jsonify({
            "code": "DOWNLOAD_FAILED",
            "message": "DOWNLOAD_FAILED",
            "error": str(e)
        }), 500

@app.route("/api/download-full-video", methods=["POST"])
@app.route("/api/download-full-video/<video_id>", methods=["POST"])
def download_full_video(video_id=None):
    """
    Endpoint Pass-Through murni untuk mendownload satu video penuh YouTube secara utuh ke shared storage.
    Front-end mengirimkan konfigurasi dinamis: video_id, output_path, ydl_opts, cookie_path, progress_path.
    """
    try:
        body = request.get_json(silent=True) or {}
        vid = body.get("video_id") or video_id or request.args.get("video_id")
        output_path = body.get("output_path")
        opts = body.get("ydl_opts")
        cookie_path = body.get("cookie_path")
        progress_path = body.get("progress_path")

        res = download_full_video_direct(
            video_id=vid,
            output_path=output_path,
            cookie_path=cookie_path,
            ydl_opts=opts,
            progress_path=progress_path
        )
        if res.get("status") == "error":
            err_code = res.get("code") or "DOWNLOAD_FAILED"
            status_code = 400 if ("REQUIRED" in str(err_code) or "INVALID" in str(err_code)) else 500
            return jsonify({
                "code": err_code,
                "message": err_code,
                "error": res.get("error") or str(err_code)
            }), status_code

        return jsonify({
            "status": "success",
            "output_path": res.get("output_path")
        }), 200
    except Exception as e:
        return jsonify({
            "code": "DOWNLOAD_FAILED",
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

        file_size = os.path.getsize(output_path) if os.path.exists(output_path) else 0
        return jsonify({
            "status": "success",
            "output_path": output_path,
            "file_size": file_size,
            "message": "SUCCESS"
        }), 200
    except Exception as e:
        return jsonify({
            "code": "GDRIVE_DOWNLOAD_FAILED",
            "message": "GDRIVE_DOWNLOAD_FAILED",
            "error": str(e)
        }), 500


@app.route("/api/subtitles", methods=["POST"])
@app.route("/api/subtitles/<video_id>", methods=["POST"])
def get_subtitles(video_id=None):
    """
    Endpoint Pass-Through murni untuk ekstraksi subtitle YouTube via yt-dlp.
    Mendelegasikan ke utils.subtitle_fetcher.extract_subtitles_data.
    """
    try:
        body = request.get_json(silent=True) or {}
        vid = body.get("video_id") or video_id or request.args.get("video_id")
        ydl_opts = body.get("ydl_opts")
        cookie_path = body.get("cookie_path")
        preferred_lang = body.get("preferred_lang", "id")

        res = extract_subtitles_data(
            video_id=vid,
            ydl_opts=ydl_opts,
            cookie_path=cookie_path,
            preferred_lang=preferred_lang
        )

        status_code = 200 if res.get("status") == "success" else (
            404 if res.get("code") == "SUBTITLE_NOT_FOUND" else (
                429 if res.get("code") == "RATE_LIMIT_EXCEEDED" else 400
            )
        )
        return jsonify(res), status_code
    except Exception as e:
        return jsonify({
            "status": "error",
            "code": "SUBTITLE_ERROR",
            "error": str(e)
        }), 500



@app.route("/api/burn-subtitles", methods=["POST"])
def api_burn_subtitles():
    """
    Endpoint Pass-Through murni untuk menempelkan (hardcode burn-in) subtitle ke video klip.
    Front-end mengirimkan konfigurasi: input_video_path, output_video_path, subtitle_data, template_data, ffmpeg_bin, progress_path, duration.
    Server memproses pembuatan video baru secara mandiri tanpa mengubah video asli yang sudah ada.
    """
    try:
        body = request.get_json(silent=True) or {}
        input_video_path = body.get("input_video_path")
        output_video_path = body.get("output_video_path")
        subtitle_data = body.get("subtitle_data")
        template_data = body.get("template_data")
        ffmpeg_bin = body.get("ffmpeg_bin")
        progress_path = body.get("progress_path")
        duration = body.get("duration")

        res = burn_subtitles_to_video(
            input_video_path=input_video_path,
            output_video_path=output_video_path,
            subtitle_data=subtitle_data,
            template_data=template_data,
            ffmpeg_bin=ffmpeg_bin,
            progress_path=progress_path,
            duration=duration
        )

        status_code = 200 if res.get("status") == "success" else (
            400 if res.get("code") in ["INPUT_VIDEO_NOT_FOUND", "OUTPUT_PATH_REQUIRED", "INVALID_PARAMS", "NO_SUBTITLES_TO_BURN", "NO_CONTENT_TO_BURN"] else 500
        )
        return jsonify(res), status_code
    except Exception as e:
        return jsonify({
            "status": "error",
            "code": "FFMPEG_BURN_ERROR",
            "error": str(e)
        }), 500


@app.route("/api/proxy_stream", methods=["GET"])
def proxy_stream():
    """
    Endpoint proxy internal untuk membypass pemblokiran HTTPS / TLS / CORS Google Video.
    Meneruskan Range requests ke Google Video CDN menggunakan Python requests stack.
    Digunakan oleh internal FFmpeg untuk range clipping tanpa terkena blokir Exit Code 8.
    """
    url = request.args.get("url")
    if not url:
        return jsonify({"message": "INVALID_PARAMS", "error": "Missing 'url' query parameter"}), 400

    ua = request.args.get("ua") or "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"
    headers = {
        "User-Agent": ua,
        "Accept": "*/*",
        "Accept-Language": "en-us,en;q=0.5",
        "Sec-Fetch-Mode": "navigate",
    }
    range_header = request.headers.get("Range")
    if range_header:
        headers["Range"] = range_header

    try:
        import requests
        from flask import Response

        session = requests.Session()
        cookie_path = request.args.get("cookie_path")
        if cookie_path and os.path.exists(cookie_path):
            import http.cookiejar
            cj = http.cookiejar.MozillaCookieJar(cookie_path)
            try:
                cj.load(ignore_discard=True, ignore_expires=True)
                session.cookies = cj
            except Exception:
                pass

        req = session.get(url, headers=headers, stream=True, timeout=20)

        def iterfile():
            for chunk in req.iter_content(chunk_size=65536):
                if chunk:
                    yield chunk

        res_headers = {}
        for k in ["Content-Type", "Content-Range", "Content-Length", "Accept-Ranges"]:
            if k in req.headers:
                res_headers[k] = req.headers[k]

        return Response(iterfile(), status=req.status_code, headers=res_headers)
    except Exception as e:
        return jsonify({"message": "PROXY_STREAM_ERROR", "error": str(e)}), 500

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
