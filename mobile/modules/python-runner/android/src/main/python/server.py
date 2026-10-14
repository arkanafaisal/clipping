from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import time
import sys
import uvicorn

app = FastAPI(title="Clipping Local Engine")

# Setup CORS agar bisa diakses lancar oleh React Native di localhost
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

START_TIME = time.time()
LOGS = []

def record_log(level: str, msg: str):
    LOGS.append({
        "id": len(LOGS) + 1,
        "time": time.strftime("%H:%M:%S"),
        "level": level,
        "message": msg
    })
    # Batasi 300 log terakhir
    if len(LOGS) > 300:
        LOGS.pop(0)

@app.get("/ping")
def ping():
    uptime = round(time.time() - START_TIME, 1)
    record_log("INFO", f"GET /ping - 200 OK (Uptime: {uptime}s)")
    return {
        "status": "ok",
        "uptime_seconds": uptime,
        "python_version": sys.version.split()[0],
        "message": "Server Python berjalan mandiri di dalam HP!"
    }

@app.get("/logs")
def get_logs():
    return {"logs": LOGS, "total": len(LOGS)}

@app.get("/test-error")
def test_error():
    record_log("ERROR", "ZeroDivisionError: division by zero pada simulasi test error")
    raise HTTPException(
        status_code=500, 
        detail="Simulasi error FastAPI berhasil ditangkap oleh server internal HP!"
    )

@app.post("/clear-logs")
def clear_logs():
    LOGS.clear()
    record_log("INFO", "Log buffer telah dibersihkan.")
    return {"status": "ok", "message": "Log berhasil dibersihkan"}

def start_server():
    record_log("INFO", "🚀 Server FastAPI mulai aktif di dalam HP pada 127.0.0.1:8080...")
    uvicorn.run(app, host="127.0.0.1", port=8080, log_level="info")

if __name__ == "__main__":
    start_server()
