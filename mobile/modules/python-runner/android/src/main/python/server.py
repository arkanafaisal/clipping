from flask import Flask, jsonify, request, Response
from datetime import datetime
import time
import sys
import os
import yt_dlp

app = Flask(__name__)
START_TIME = time.time()
LOGS = []

# In-memory caches to save YouTube API quota & prevent rate limits
STREAM_CACHE = {}   # { video_id: { "url": str, "expires_at": float } }
HEATMAP_CACHE = {}  # { f"{video_id}_{num_clips}_{offset}": { "title": str, "clips": list, "cached_at": float } }

# Rate limiter in-memory (Gate 1: Max 20 hits/hour to YouTube)
GATE1_TIMESTAMPS = []
GATE1_LIMIT_PER_HOUR = 20

def record_log(level: str, msg: str):
    LOGS.append({
        "id": len(LOGS) + 1,
        "time": datetime.now().strftime("%H:%M:%S"),
        "level": level,
        "message": msg
    })
    # Batasi 300 log terakhir
    if len(LOGS) > 300:
        LOGS.pop(0)
    print(f"[{level}] {msg}")

def check_gate1_rate_limit():
    global GATE1_TIMESTAMPS
    now = time.time()
    # Hapus timestamp yang lebih dari 1 jam lalu (3600s)
    GATE1_TIMESTAMPS = [t for t in GATE1_TIMESTAMPS if now - t < 3600]
    if len(GATE1_TIMESTAMPS) >= GATE1_LIMIT_PER_HOUR:
        record_log("WARN", f"Gate 1 Rate limit reached: {len(GATE1_TIMESTAMPS)}/{GATE1_LIMIT_PER_HOUR} per hour")
        raise Exception("RATE_LIMIT_EXCEEDED")
    GATE1_TIMESTAMPS.append(now)

@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response

@app.route("/ping", methods=["GET"])
def ping():
    uptime = round(time.time() - START_TIME, 1)
    record_log("INFO", f"GET /ping - 200 OK (Uptime: {uptime}s)")
    return jsonify({
        "status": "ok",
        "uptime_seconds": uptime,
        "python_version": sys.version.split()[0],
        "message": "Server Python berjalan mandiri di dalam HP!"
    })

@app.route("/logs", methods=["GET"])
def get_logs():
    return jsonify({"logs": LOGS, "total": len(LOGS)})

@app.route("/clear-logs", methods=["POST"])
def clear_logs():
    LOGS.clear()
    record_log("INFO", "Log buffer telah dibersihkan.")
    return jsonify({"status": "ok", "message": "Log berhasil dibersihkan"})

# -------------------------------------------------------------
# 1. HEATMAP EXTRACTOR (/api/heatmap/<video_id>)
# -------------------------------------------------------------
@app.route("/api/heatmap/<video_id>", methods=["GET"])
def get_heatmap(video_id: str):
    num_clips = request.args.get("num_clips", default=50, type=int)
    offset = request.args.get("offset", default=0, type=int)

    cache_key = f"{video_id}_{num_clips}_{offset}"
    now = time.time()

    # Cek Heatmap Cache (valid selama 24 jam)
    if cache_key in HEATMAP_CACHE:
        cached = HEATMAP_CACHE[cache_key]
        if now - cached.get("cached_at", 0) < 86400:
            record_log("INFO", f"⚡ [CACHE HIT] Heatmap untuk {video_id} diambil dari cache ({len(cached['clips'])} klip)")
            return jsonify({
                "title": cached["title"],
                "clips": cached["clips"],
                "from_cache": True
            })

    record_log("INFO", f"🔍 [HEATMAP] Mengekstrak heatmap YouTube untuk {video_id} (num_clips={num_clips}, offset={offset})...")

    video_url = f"https://www.youtube.com/watch?v={video_id}"
    ydl_opts = {
        'skip_download': True,
        'quiet': True,
        'no_warnings': True,
        'extractor_args': {'youtube': {'player_client': ['ios', 'android']}}
    }

    try:
        check_gate1_rate_limit()

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)
            heatmap = info.get('heatmap')
            title = info.get('title', f"Video {video_id}")

        if not heatmap:
            record_log("WARN", f"⚠️ Heatmap tidak ditemukan untuk video {video_id}. Belum ada data 'Most Replayed'.")
            return jsonify({
                "status": "error",
                "message": "Heatmap tidak ditemukan. Video ini belum memiliki data 'Most Replayed'."
            }), 404

        # Urutkan berdasarkan intensitas tertinggi
        top_moments = sorted(heatmap, key=lambda x: x.get('value', 0), reverse=True)[:num_clips]

        formatted_clips = []
        for rank, moment in enumerate(top_moments, start=1):
            original_start = moment.get('start_time', 0)
            original_end = moment.get('end_time', 0)

            start_time = original_start - offset
            end_time = original_end + offset

            if end_time <= start_time:
                mid = (original_start + original_end) / 2
                start_time = max(0, int(mid - 1))
                end_time = start_time + 2
            else:
                start_time = max(0, start_time)

            formatted_clips.append({
                "id": f"clip_{original_start}",
                "rank": rank,
                "videoId": video_id,
                "start": float(start_time),
                "end": float(end_time),
                "value": moment.get('value', 0)
            })

        # Simpan ke Cache
        HEATMAP_CACHE[cache_key] = {
            "title": title,
            "clips": formatted_clips,
            "cached_at": now
        }

        record_log("INFO", f"✅ [HEATMAP SUCCESS] Berhasil ekstrak {len(formatted_clips)} klip untuk '{title}'")
        return jsonify({
            "title": title,
            "clips": formatted_clips,
            "from_cache": False
        })

    except Exception as e:
        if "RATE_LIMIT_EXCEEDED" in str(e):
            return jsonify({"status": "error", "message": "Rate limit tercapai. Silakan coba beberapa saat lagi."}), 429
        record_log("ERROR", f"❌ [HEATMAP ERROR] {video_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

# -------------------------------------------------------------
# 2. STREAM URL EXTRACTOR (/api/stream/<video_id>)
# -------------------------------------------------------------
@app.route("/api/stream/<video_id>", methods=["GET"])
def get_stream(video_id: str):
    now = time.time()

    # Cek Stream Cache (valid selama 2 jam / 7200s)
    if video_id in STREAM_CACHE:
        cache_data = STREAM_CACHE[video_id]
        if now < cache_data["expires_at"]:
            record_log("INFO", f"⚡ [CACHE HIT] Stream URL untuk {video_id} diambil dari cache.")
            return jsonify({
                "video_id": video_id,
                "stream_url": cache_data["url"],
                "from_cache": True
            })
        else:
            del STREAM_CACHE[video_id]

    record_log("INFO", f"🎬 [STREAM] Mengekstrak stream URL untuk {video_id}...")
    video_url = f"https://www.youtube.com/watch?v={video_id}"

    # Format video seimbang untuk mobile: max 720p mp4, fallback 480p mp4
    ydl_opts = {
        'format': 'best[height<=720][ext=mp4]/best[height<=480][ext=mp4]/best[ext=mp4]',
        'quiet': True,
        'skip_download': True,
        'extract_flat': False,
        'extractor_args': {'youtube': {'player_client': ['ios', 'android']}}
    }

    try:
        check_gate1_rate_limit()

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)
            stream_url = info.get('url')
            if not stream_url and 'formats' in info:
                # Cari format yang memiliki url langsung dan audio+video
                valid_formats = [f for f in info['formats'] if f.get('url')]
                muxed = [f for f in valid_formats if f.get('acodec') != 'none' and f.get('vcodec') != 'none']
                if muxed:
                    stream_url = muxed[-1]['url']
                elif valid_formats:
                    stream_url = valid_formats[-1]['url']

        if not stream_url:
            record_log("WARN", f"⚠️ Stream URL tidak ditemukan untuk {video_id}")
            return jsonify({"status": "error", "message": "Stream URL tidak ditemukan"}), 404

        # Simpan ke cache (2 jam)
        STREAM_CACHE[video_id] = {
            "url": stream_url,
            "expires_at": now + 7200
        }

        record_log("INFO", f"✅ [STREAM SUCCESS] Berhasil mendapatkan stream URL untuk {video_id}")
        return jsonify({
            "video_id": video_id,
            "stream_url": stream_url,
            "from_cache": False
        })

    except Exception as e:
        if "RATE_LIMIT_EXCEEDED" in str(e):
            return jsonify({"status": "error", "message": "Rate limit YouTube tercapai."}), 429
        record_log("ERROR", f"❌ [STREAM ERROR] {video_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

def start_server():
    record_log("INFO", "🚀 Server Python Flask aktif di dalam HP pada 127.0.0.1:8080...")
    app.run(host="127.0.0.1", port=8080, debug=False, use_reloader=False, threaded=True)

if __name__ == "__main__":
    start_server()
