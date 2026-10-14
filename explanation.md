# Penjelasan Mendalam: Arsitektur Endpoint Streaming & Heatmap

Dokumen ini menjelaskan secara rinci **setiap baris kode**, **alasan kenapa saat ini sudah dikategorikan minimalis**, **titik mana yang masih BELUM cukup minimalis**, serta pemetaan **apa yang 100% dinamis per-request** vs **apa yang masih di-hardcode**.

> [!NOTE]
> Pembahasan dibatasi secara ketat hanya pada endpoint **Streaming & Heatmap** (`/ping`, `/api/stream/<video_id>`, `/api/proxy_stream`, dan `/api/heatmap/<video_id>`). Fitur download video utuh, Google Drive, dan bot WhatsApp tidak dibahas.

---

## Daftar Endpoint yang Dianalisis

1. **`GET /ping`** – Healthcheck & Status Konektivitas Server
2. **`GET /api/stream/<video_id>`** – Ekstraksi Direct Stream URL YouTube
3. **`GET /api/proxy_stream`** – Proxy Aliran Video & Range Request (Bypass SOP / CORS)
4. **`GET /api/heatmap/<video_id>`** – Ekstraksi Titik Teramai ("Most Replayed") & Klip Virtual

---

## 1. Endpoint `/ping`

### Cuplikan Kode (`mobile_api/main.py`)
```python
28: @app.route("/ping", methods=["GET"])
29: def ping():
30:     return jsonify({
31:         "status": "ok",
32:         "message": "Server Python berjalan di Termux / Mobile API (port 3006)!"
33:     })
```

### Penjelasan Per Baris:
* **Baris 28 (`@app.route(...)`)**: Mendaftarkan URL path `/ping` dengan HTTP method `GET` ke router Flask.
* **Baris 29 (`def ping():`)**: Fungsi handler yang akan dieksekusi setiap kali ada request ke `/ping`.
* **Baris 30–33 (`return jsonify(...)`)**: Membungkus dictionary Python menjadi HTTP response dengan format JSON bertipe `application/json` dan HTTP status `200 OK`.

### Parameter:
* **Diambil 100% Dinamis dari Request**: **Tidak ada (0%)**. Request tidak membutuhkan body, header khusus, maupun query parameter.
* **Masih Hardcoded**: String status `"ok"` dan teks pesan `"Server Python berjalan di Termux / Mobile API (port 3006)!"`.

### Evaluasi Minimalisme:
* **Kenapa Sudah Minimalis?**: Zero disk I/O, zero network I/O eksternal, eksekusi selesai dalam hitungan sub-milidetik.
* **Kelemahan / Saran**: Tidak ada. Sangat ideal sebagai probe konektivitas frontend ke backend.

---

## 2. Endpoint `/api/stream/<video_id>`

### Cuplikan Kode Controller (`mobile_api/main.py`)
```python
35: @app.route("/api/stream/<video_id>", methods=["GET"])
36: def get_stream(video_id: str):
37:     """Endpoint untuk mendapatkan direct stream URL dari video YouTube"""
40:     try:
41:         url = get_direct_stream_url(video_id)
42:         if not url:
43:             print(f"[API ERROR] Stream URL for '{video_id}' could not be extracted (Returned None).")
44:             return jsonify({"detail": "Not Found"}), 404
45:             
46:         return jsonify({
47:             "video_id": video_id,
48:             "stream_url": url
49:         })
50:     except Exception as e:
51:         if "RATE_LIMIT_EXCEEDED" in str(e):
52:             return jsonify({"detail": "Too Many Requests to YouTube API. Silakan tunggu beberapa menit."}), 429
53:         print(f"[API CRITICAL ERROR] Failed to process video '{video_id}': {str(e)}")
54:         return jsonify({"detail": "Internal Server Error"}), 500
```

### Cuplikan Kode Engine (`mobile_api/utils/stream_extractor.py`)
```python
8:  STREAM_CACHE = {}
10: def get_direct_stream_url(video_id: str) -> str:
14:     url = f"https://www.youtube.com/watch?v={video_id}"
16:     ydl_opts = {
17:         'format': 'best[height<=480][ext=mp4]/best[ext=mp4]',
18:         'quiet': True,
19:         'skip_download': True,
20:         'extract_flat': False
21:     }
24:     now = time.time()
25:     if video_id in STREAM_CACHE:
26:         cache_data = STREAM_CACHE[video_id]
27:         if now < cache_data["expires_at"]:
28:             print(f"[STREAM CACHE] Memakai URL dari cache untuk {video_id}. (Aman dari hitungan Gate 1!)")
29:             return cache_data["url"]
30:         else:
31:             del STREAM_CACHE[video_id] # Expired
34:     ydl_opts_ios = add_cookies(ydl_opts.copy(), client_type='ios')
35:     try:
36:         gate1_limiter.check_and_add()
37:         with yt_dlp.YoutubeDL(ydl_opts_ios) as ydl_ios:
38:             info_ios = ydl_ios.extract_info(url, download=False)
39:             result_url = info_ios.get('url')
42:             if result_url:
43:                 STREAM_CACHE[video_id] = {
44:                     "url": result_url,
45:                     "expires_at": time.time() + 7200
46:                 }
47:             return result_url
48:     except Exception as e_ios:
49:         if "RATE_LIMIT_EXCEEDED" in str(e_ios): raise
50:         print(f"[STREAM EXTRACTOR] Error mengekstrak URL iOS untuk {video_id}: {e_ios}")
51:         return None
```

### Penjelasan Per Baris:
* **`main.py` Baris 35–36**: Menangkap path variable `<video_id>` (contoh: `/api/stream/dQw4w9WgXcQ`).
* **`main.py` Baris 41**: Memanggil fungsi `get_direct_stream_url(video_id)` untuk menyelesaikan link HTTPS signed `.googlevideo.com`.
* **`main.py` Baris 42–44**: Jika fungsi mengembalikan `None`, mengembalikan HTTP 404 (Not Found).
* **`main.py` Baris 46–49**: Jika sukses, mengembalikan format JSON standar: `{"video_id": "...", "stream_url": "https://..."}`.
* **`main.py` Baris 50–54**: Menangkap error. Jika pesan error berisi `"RATE_LIMIT_EXCEEDED"`, mengembalikan status HTTP 429. Jika error lain, mengembalikan HTTP 500.
* **`stream_extractor.py` Baris 8**: Variabel memori `STREAM_CACHE` berbentuk Python dict `{ video_id: { url, expires_at } }`.
* **`stream_extractor.py` Baris 14**: Membentuk URL YouTube lengkap dari `video_id`.
* **`stream_extractor.py` Baris 16–21**: Opsi `yt-dlp`:
  - `'format'`: Membatasi resolusi maksimum 480p format MP4 (agar hemat kuota dan ringan diputar di HP).
  - `'skip_download': True`: Tidak mendownload video fisik, hanya mengambil link.
* **`stream_extractor.py` Baris 24–31**: Pengecekan cache Python: Jika `video_id` sudah pernah diminta dalam 2 jam terakhir, langsung kembalikan tanpa request ke YouTube.
* **`stream_extractor.py` Baris 34**: Memanggil `add_cookies(..., client_type='ios')` yang menginjeksi header iOS client (mencegah throttling BotGuard YouTube SABR).
* **`stream_extractor.py` Baris 36**: Memanggil rate limiter lokal `gate1_limiter` yang mencatat hit ke file `gate1_ratelimit.json` (maksimal 15 request per jam).
* **`stream_extractor.py` Baris 37–39**: Menginisialisasi `YoutubeDL` dan mengekstrak info video tanpa mendownload (`download=False`). Mengambil field direct URL `info_ios.get('url')`.
* **`stream_extractor.py` Baris 42–47**: Menyimpan URL ke cache lokal dengan masa berlaku 7200 detik (2 jam) lalu mengembalikan URL ke controller.

### Parameter:
* **Diambil 100% Dinamis dari Request**:
  - `video_id`: Nilai ID video yang diminta klien dari URL path.
  - Direct Stream URL yang dihasilkan YouTube: Link HTTPS dinamis bertanda tangan digital (signed token).
* **Masih Hardcoded**:
  - Format target video: `'best[height<=480][ext=mp4]/best[ext=mp4]'` (dipatok max 480p).
  - Klien YouTube extractor: `player_client: ['ios', 'android']`.
  - Masa kadaluwarsa cache backend: `7200` detik (2 jam).
  - Struktur respon JSON: Key `"video_id"` dan `"stream_url"`.
  - Limit rate limiter: `limit_per_hour = 15`.

### Evaluasi Minimalisme:
* **Kenapa Sudah Minimalis?**:
  - Tidak memakan ruang disk penyimpanan HP untuk mendownload video utuh.
  - Tidak memanggil binary `ffmpeg` (tidak ada transcoding atau merging audio-video).
* **Kenapa Masih BELUM Cukup Minimalis (Titik Boros)?**:
  1. **Redundansi Caching**: Frontend React Native di `mobile/src/services/api.ts` sudah mengimplementasikan caching mandiri via `LocalStorage` selama 2 jam (`stream_cache_${videoId}`). Adanya `STREAM_CACHE` di Python memori menjadi mubazir dan menambah beban RAM Python runtime.
  2. **File I/O Rate Limiter**: `gate1_limiter` membaca dan menulis file fisik `gate1_ratelimit.json` setiap request. Ini adalah sisa arsitektur backend bot server. Pada perangkat Android native, file I/O seperti ini rawan permission failure dan memperlambat waktu respon.
  3. **Dependensi Puppeteer di `youtube_auth.py`**: Fungsi `add_cookies` memanggil modul yang mengimpor script `generate_po.js` Node.js, padahal Node.js Puppeteer tidak ada di environment mobile.

---

## 3. Endpoint `/api/proxy_stream`

### Cuplikan Kode Controller (`mobile_api/main.py`)
```python
88:  @app.route("/api/proxy_stream", methods=["GET"])
89:  def proxy_stream():
94:      url = request.args.get("url")
95:      if not url:
96:          return jsonify({"detail": "Missing url"}), 400
98:      headers = {}
99:      range_header = request.headers.get("Range")
100:     if range_header:
101:         headers["Range"] = range_header
103:     try:
104:         if requests is not None:
106:             req = requests.get(url, headers=headers, stream=True, timeout=10)
108:             def iterfile():
109:                 for chunk in req.iter_content(chunk_size=1024 * 1024):  # 1MB chunks
110:                     if chunk:
111:                         yield chunk
113:             response_headers = {
114:                 k: v for k, v in req.headers.items() 
115:                 if k.lower() in ("content-type", "content-length", "content-range", "accept-ranges")
116:             }
118:             return Response(iterfile(), status=req.status_code, headers=response_headers)
123:         else:
124:             import urllib.request
125:             req = urllib.request.Request(url, headers=headers)
126:             res = urllib.request.urlopen(req, timeout=10)
                 ...
```

### Penjelasan Per Baris:
* **Baris 88–89**: Mendaftarkan route `/api/proxy_stream`.
* **Baris 94–96**: Mengambil parameter query `?url=...`. Jika kosong, kembalikan HTTP 400.
* **Baris 98–101**: Membaca header `Range` dari request klien (contoh: `bytes=0-1048575`). Header ini sangat penting agar pemutar video bisa melakukan seeking/scrubbing ke menit manapun tanpa mendownload dari menit 0.
* **Baris 104–106**: Mengirim request HTTP GET ke server Google Video dengan parameter `stream=True` dan timeout 10 detik.
* **Baris 108–111 (`iterfile`)**: Generator function yang membaca aliran video per bagian (chunk) 1 MB secara bertahap dan mem-forward-nya ke klien tanpa memuat seluruh video ke RAM.
* **Baris 113–116**: Menyaring header respon agar hanya header media yang diteruskan (`content-type`, `content-length`, `content-range`, `accept-ranges`).
* **Baris 118–122**: Mengembalikan objek `Response` Flask bertipe streaming generator.
* **Baris 123–144**: Jalur alternatif berbasis `urllib.request` bawaan Python murni (jika library `requests` tidak terinstall).

### Parameter:
* **Diambil 100% Dinamis dari Request**:
  - `url`: URL stream Google Video dari query string (`request.args.get("url")`).
  - `Range`: Header rentang byte dari video player HP (`request.headers.get("Range")`).
  - Seluruh byte stream video dan status code HTTP (200 atau 206 Partial Content).
* **Masih Hardcoded**:
  - Ukuran chunk generator: `1024 * 1024` byte (1 Megabyte).
  - Timeout koneksi: `10` detik.
  - Whitelist header respon: `("content-type", "content-length", "content-range", "accept-ranges")`.

### Evaluasi Minimalisme:
* **Kenapa Sudah Minimalis?**:
  - Menggunakan teknik streaming generator (`yield chunk`), sehingga konsumsi RAM Python sangat stabil (< 20 MB) meskipun video berukuran ratusan MB.
  - Zero disk writing.
* **Kenapa Masih BELUM Cukup Minimalis (Titik Boros)?**:
  - Pada arsitektur mobile native, player Android (`ExoPlayer` / `react-native-video`) **bisa langsung memutar URL HTTPS Google Video** tanpa terkena batasan CORS browser.
  - Endpoint ini awalnya dibuat hanya karena browser web (Chrome/Firefox) memblokir video cross-origin. Untuk native mobile, endpoint ini sebenarnya opsional dan membebani jalur jaringan ganda (HP -> Python HP -> YouTube -> Python HP -> Player HP).

---

## 4. Endpoint `/api/heatmap/<video_id>`

### Cuplikan Kode Controller (`mobile_api/main.py`)
```python
149: @app.route("/api/heatmap/<video_id>", methods=["GET"])
150: def get_heatmap(video_id: str):
154:     num_clips = request.args.get("num_clips", default=5, type=int)
155:     offset = request.args.get("offset", default=5, type=int)
156:     try:
157:         url = f"https://www.youtube.com/watch?v={video_id}"
158:         clips, title = get_top_clips(url, num_clips=num_clips, offset=offset)
160:         if not clips:
161:             return jsonify({"detail": "Gagal mengekstrak heatmap. Mungkin video tidak punya data 'Most Replayed'."}), 404
164:         formatted_clips = []
165:         for clip in clips:
166:             formatted_clips.append({
167:                 "id": f"clip_{clip['original_start']}",
168:                 "rank": clip["rank"],
169:                 "videoId": video_id,
170:                 "start": clip["start_time"],
171:                 "end": clip["end_time"]
172:             })
174:         return jsonify({
175:             "title": title,
176:             "clips": formatted_clips
177:         })
178:     except Exception as e:
179:         print(f"[API CRITICAL ERROR] Failed to fetch heatmap '{video_id}': {str(e)}")
180:         return jsonify({"detail": "Internal Server Error"}), 500
```

### Cuplikan Kode Engine (`mobile_api/utils/heatmap.py`)
```python
8:  ydl_opts = {
9:      'skip_download': True,
10:     'quiet': True,
11:     'no_warnings': True,
12: }
14: cookie_path = os.path.join(BASE_DIR, 'cookies.txt')
15: if os.path.exists(cookie_path):
16:     ydl_opts['cookiefile'] = cookie_path
18: ydl_opts['extractor_args'] = {'youtube': {'player_client': ['ios', 'android']}}
...
29: def get_top_clips(video_url, num_clips=10, offset=0):
34:     with yt_dlp.YoutubeDL(ydl_opts) as ydl:
35:         info = ydl.extract_info(video_url, download=False)
36:         heatmap = info.get('heatmap')
...
43:     top_moments = sorted(heatmap, key=lambda x: x.get('value', 0), reverse=True)[:num_clips]
...
50:     processed_clips = []
51:     for rank, moment in enumerate(top_moments, start=1):
52:         original_start = moment['start_time']
53:         original_end = moment['end_time']
54:         start_time = original_start - offset
55:         end_time = original_end + offset
...
71:         processed_clips.append({
72:             'rank': rank,
73:             'original_start': original_start,
74:             'start_time': start_time,
75:             'end_time': end_time,
76:             'duration': end_time - start_time,
77:             'value': moment['value']
78:         })
80:     return processed_clips, info.get('title')
```

### Penjelasan Per Baris:
* **`main.py` Baris 149–150**: Menangkap `video_id` dari URL path.
* **`main.py` Baris 154–155**: Mengambil query string `num_clips` (default: 5) dan `offset` (default: 5).
* **`main.py` Baris 158**: Memanggil fungsi `get_top_clips(...)`.
* **`main.py` Baris 164–173**: Melakukan perulangan (looping) untuk memformat ulang struktur dictionary dari `get_top_clips` ke bentuk yang diharapkan frontend: `{ id, rank, videoId, start, end }`.
* **`main.py` Baris 174–177**: Mengembalikan objek JSON `{ "title": title, "clips": formatted_clips }`.
* **`heatmap.py` Baris 14–18**: Menyiapkan opsi `yt-dlp` dengan cookies dan client iOS/Android.
* **`heatmap.py` Baris 34–36**: Menjalankan ekstraksi metadata YouTube untuk mengambil field array `heatmap` (berisi data intensitas per segmen).
* **`heatmap.py` Baris 43**: Mengurutkan (`sorted`) segmen berdasarkan `value` (skor intensitas replayed tertinggi) dan memotong sebanyak `num_clips`.
* **`heatmap.py` Baris 50–78**: Melakukan perulangan untuk menghitung offset waktu (`start_time = original_start - offset`, `end_time = original_end + offset`), memvalidasi jika durasi terbalik, mencetak log teks ke console, dan mengumpulkan hasilnya ke list `processed_clips`.

### Parameter:
* **Diambil 100% Dinamis dari Request**:
  - `video_id`: Dari URL path.
  - `num_clips` & `offset`: Dari URL query parameter.
  - Judul video (`title`) dan data heatmap asli dari server YouTube.
* **Masih Hardcoded**:
  - Nilai default parameter: `num_clips=5`, `offset=5` di `main.py` (sedangkan di `heatmap.py` `num_clips=10`, `offset=0`).
  - Baris 7 `heatmap.py`: `VIDEO_URL = "https://youtu.be/t6h8Uae2Q_E"` (sisa hardcoded URL uji coba).
  - Aturan durasi fallback jika offset minus: `start_time = max(0, int(mid - 1))`, `end_time = start_time + 2` (hardcoded 2 detik).
  - Format penamaan ID klip: `f"clip_{clip['original_start']}"`.
  - Fungsi CLI `if __name__ == "__main__":` yang meminta `input()` manual di terminal.

### Evaluasi Minimalisme:
* **Kenapa Sudah Minimalis?**:
  - Klip yang dihasilkan hanya berupa rentang waktu virtual (angka `start` dan `end`), bukan potongan file video `.mp4` fisik.
  - Ekstraksi hanya membaca metadata JSON dari YouTube, tanpa mendownload stream media.
* **Kenapa Masih BELUM Cukup Minimalis (Pelanggaran Rule 7)?**:
  1. **Logika Bisnis Berada di Python**: Perhitungan matematika offset (`start - offset`, `end + offset`), sorting ranking, pemberian ID `clip_...`, dan validasi durasi semuanya dilakukan di Python.
  2. **Double Looping / Redundant Data Mapping**: `heatmap.py` memproses loop pertama untuk menghasilkan `processed_clips`, lalu `main.py` melakukan loop kedua hanya untuk merubah key nama field (`start_time` -> `start`, `end_time` -> `end`).
  3. **Kode Mati CLI Terminal**: Adanya fungsi `format_time`, banyak baris `print("-" * 65)`, dan blok `if __name__ == "__main__":` yang tidak pernah dipanggil oleh API server.

---

## Ringkasan Matriks: Apa yang Diambil Dinamis vs Hardcoded

| Endpoint | Parameter Dinamis (100% Request) | Parameter Hardcoded | Bagian yang Masih Belum Minimalis |
| :--- | :--- | :--- | :--- |
| **`GET /ping`** | *Tidak ada* | Status string `"ok"` | *Sudah 100% minimalis*. |
| **`GET /api/stream/<video_id>`** | `video_id` path | Format `height<=480`, Client `ios`, Cache TTL `7200s`, Rate limit `15/jam` | Adanya in-memory `STREAM_CACHE` dan file I/O `gate1_ratelimit.json` (padahal frontend sudah punya `LocalStorage`). |
| **`GET /api/proxy_stream`** | `url` query, `Range` header | Chunk `1MB`, Timeout `10s`, Whitelist header media | Seharusnya tidak dibutuhkan untuk player mobile native (hanya peninggalan browser web). |
| **`GET /api/heatmap/<video_id>`** | `video_id` path, `num_clips`, `offset` query | Default `5`, Client `ios/android`, Fallback durasi `2s`, Format ID `clip_...` | Logika sorting, penambahan offset, dan mapping nama field masih dikerjakan di Python (seharusnya dikerjakan di TypeScript frontend). |

---

## Rekomendasi Refaktor Menuju "True Pass-Through Minimalist"

Sesuai dengan **Learned Rule 7**:
> *[ARCH] Always keep the embedded mobile Python backend as a minimal pass-through bridge (delegating formatting, caching, and persistence to the frontend) because native Python compilation is fragile and rebuilding native APKs must be minimized.*

Jika ingin backend Python benar-benar seringan dan seminimal mungkin:

1. **Endpoint Heatmap**:
   - Python hanya mengambil `heatmap = info.get('heatmap')` dan `title = info.get('title')`, lalu langsung mengembalikan `{ "title": title, "heatmap": heatmap }`.
   - Frontend TypeScript yang bertugas mengurutkan (`sort`), mengambil Top N (`slice`), menambahkan offset (`start - offset`), memberikan ID, dan menyimpan ke state.
2. **Endpoint Stream**:
   - Hapus `STREAM_CACHE` dan `gate1_limiter` di Python.
   - Serahkan 100% caching ke `LocalStorage` di frontend (sudah aktif saat ini di `mobile/src/services/api.ts`).
3. **Pembersihan Modul**:
   - Buang seluruh baris CLI `if __name__ == "__main__"`, `print` terminal, dan sisa import Puppeteer.
