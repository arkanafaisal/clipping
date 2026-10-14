from flask import Flask, jsonify, request
from datetime import datetime
import time
import sys

app = Flask(__name__)
START_TIME = time.time()
LOGS = []

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

@app.route("/test-error", methods=["GET"])
def test_error():
    record_log("ERROR", "ZeroDivisionError: division by zero pada simulasi test error")
    return jsonify({
        "status": "error",
        "message": "Simulasi error berhasil ditangkap oleh server internal HP!"
    }), 500

@app.route("/clear-logs", methods=["POST"])
def clear_logs():
    LOGS.clear()
    record_log("INFO", "Log buffer telah dibersihkan.")
    return jsonify({"status": "ok", "message": "Log berhasil dibersihkan"})

def start_server():
    record_log("INFO", "🚀 Server Python Flask aktif di dalam HP pada 127.0.0.1:8080...")
    app.run(host="127.0.0.1", port=8080, debug=False, use_reloader=False, threaded=True)

if __name__ == "__main__":
    start_server()
