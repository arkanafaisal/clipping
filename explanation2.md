# Penjelasan Arsitektur Baru: True Pass-Through Minimalist (explanation2.md)

Dokumen ini membedah arsitektur backend Python yang telah direfaktor ke tingkat **True Pass-Through Minimalist** sesuai dengan prinsip:
> *"Backend Python hanya bertindak sebagai jembatan ekstraktor mentah (raw pass-through). Seluruh konfigurasi, kalkulasi bisnis, caching, dan penanganan error dikelola secara independen oleh Frontend."*

---

## Daftar Isi
1. [Misteri & Fakta Endpoint `/api/proxy_stream`](#1-misteri--fakta-endpoint-apiproxy_stream)
2. [Pembersihan Total: Caching & Rate Limiting Backend Dihapus](#2-pembersihan-total-caching--rate-limiting-backend-dihapus)
3. [Bedah Kode Per Baris: Endpoint Streaming](#3-bedah-kode-per-baris-endpoint-streaming)
4. [Bedah Kode Per Baris: Endpoint Heatmap](#4-bedah-kode-per-baris-endpoint-heatmap)
5. [Tabel Komparasi: Sebelum vs Sesudah Refaktor](#5-tabel-komparasi-sebelum-vs-sesudah-refaktor)

---

## 1. Misteri & Fakta Endpoint `/api/proxy_stream`

Banyak pertanyaan muncul mengenai endpoint ini: *Apakah terpakai di mobile? Kenapa dulu dibuat? Kenapa lambat saat pakai Tailscale?*

### A. Kenapa Dulu Dibuat di Versi Web?
* Pada versi web browser (React + Vite di Chrome/Firefox), browser menerapkan keamanan ketat bernama **CORS (Cross-Origin Resource Sharing)** dan **SOP (Same-Origin Policy)**.
* Saat elemen `<video src="https://rr...googlevideo.com/...">` dimuat, server Google Video sering menolak request jika tidak ada header origin yang cocok, atau menolak streaming jika IP berbeda dengan yang meminta metadata.
* Oleh karena itu, dibuatlah `/api/proxy_stream` di backend untuk membypass batasan browser web: Browser meminta ke server lokal (`/api/proxy_stream?url=...`), server mendownload chunk dari YouTube, lalu mengalirkannya ke browser.

### B. Apakah Terpakai di Aplikasi Mobile Saat Ini?
**TIDAK TERPAKAI SAMA SEKALI (0%)**.
* Di aplikasi mobile ([FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx#L139-L142)):
  ```typescript
  const directUrl = await fetchStreamUrl(videoId);
  if (isMounted && directUrl) {
    setStreamUrl(directUrl);
    player.replace(directUrl); // Memutar langsung direct HTTPS Google Video
  }
  ```
* Player mobile menggunakan `expo-video` (`ExoPlayer` di Android). Mesin ExoPlayer berjalan langsung di level sistem operasi native Android (networking via socket Java/OkHttp), **bukan di dalam browser DOM**.
* Mesin native Android **tidak tunduk pada CORS browser web**. Player native dapat memutar langsung URL HTTPS YouTube secara instan tanpa perantara proxy!

### C. Kenapa Dulu Sangat Lambat Saat Pakai Tailscale?
* Saat menggunakan Tailscale (atau reverse proxy tunnel), `/api/proxy_stream` membagi bandwidth menjadi dua kali lipat (**double bottleneck**):
  1. Server Python harus mendownload video dari YouTube (Download #1).
  2. Server Python harus mengupload video tersebut ke HP melalui tunnel Tailscale (Upload #2).
* Jika koneksi upload server atau kuota tunnel terbatas, video akan buffering parah dan macet-macet.
* **Dengan memutar direct URL langsung dari HP**, HP langsung streaming dari Content Delivery Network (CDN) Google terdekat dari lokasi HP, dengan kecepatan penuh tanpa membebani server!

### D. Keputusan
Endpoint `/api/proxy_stream` telah **dimatikan (di-comment out)** di [main.py](file:///d:/projects/clipping/mobile_api/main.py). Backend Python menjadi bebas dari beban proxying data bergiga-giga byte.

---

## 2. Pembersihan Total: Caching & Rate Limiting Backend Dihapus

Sesuai arahan, dua komponen yang sebelumnya membebani backend telah **dihapus 100%**:

1. **`STREAM_CACHE = {}` di Python Dihapus**:
   - Backend tidak lagi menyimpan riwayat URL di memori RAM Python.
   - Caching telah ditangani 100% oleh frontend di [api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts#L52-L65) menggunakan `LocalStorage` dengan durasi 2 jam (`7200` detik).
2. **`gate1_limiter` & File `gate1_ratelimit.json` Dihapus**:
   - Backend tidak lagi melakukan file I/O menulis dan membaca disk setiap kali ada request stream.
   - Risiko crash permission pada Android sandbox hilang sepenuhnya.

---

## 3. Bedah Kode Per Baris: Endpoint Streaming

### A. Controller di `mobile_api/main.py`
```python
@app.route("/api/stream", methods=["GET", "POST"])
@app.route("/api/stream/<video_id>", methods=["GET", "POST"])
def get_stream(video_id=None):
    body = request.get_json(silent=True) or {}
    vid = body.get("video_id") or video_id or request.args.get("video_id")
    
    if not vid:
        return jsonify({
            "status": "error",
            "error": "Parameter 'video_id' wajib disertakan dalam path, query, atau body."
        }), 400

    custom_opts = body.get("ydl_opts") or body.get("options")
    
    url, err = get_direct_stream_url(vid, custom_opts=custom_opts)
    if err or not url:
        return jsonify({
            "status": "error",
            "video_id": vid,
            "error": err or "Gagal mendapatkan stream URL dari YouTube."
        }), 400
        
    return jsonify({
        "status": "ok",
        "video_id": vid,
        "stream_url": url
    })
```

#### Penjelasan Per Baris:
* **`methods=["GET", "POST"]`**: Mendukung request GET standar maupun POST ber-body JSON.
* **`body = request.get_json(...)`**: Membaca request body yang dikirim oleh frontend.
* **`vid = ...`**: 100% fleksibel membaca ID video dari body JSON, dari URL path, atau dari query parameter.
* **`custom_opts = body.get("ydl_opts")`**: Mengambil opsi konfigurasi `yt-dlp` langsung dari frontend! Backend tidak lagi mendikte format video.
* **`url, err = get_direct_stream_url(...)`**: Memanggil fungsi extractor mentah.
* **`if err or not url:`**: Meneruskan pesan error asli YouTube langsung ke frontend (Raw Error Pass-Through), tidak lagi disembunyikan di balik status 500 generik.

---

### B. Extractor di `mobile_api/utils/stream_extractor.py`
```python
def get_direct_stream_url(video_id: str, custom_opts: dict = None) -> tuple:
    url = f"https://www.youtube.com/watch?v={video_id}"
    
    # Konfigurasi default aman jika frontend tidak mengirimkan custom ydl_opts
    ydl_opts = {
        'format': 'best[height<=480][ext=mp4]/best[ext=mp4]',
        'quiet': True,
        'skip_download': True,
        'extract_flat': False
    }
    
    # 100% Dinamis: Timpa dengan konfigurasi dari frontend
    if custom_opts and isinstance(custom_opts, dict):
        ydl_opts.update(custom_opts)
            
    ydl_opts_ios = add_cookies(ydl_opts.copy(), client_type='ios')
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts_ios) as ydl_ios:
            info_ios = ydl_ios.extract_info(url, download=False)
            result_url = info_ios.get('url')
            if not result_url:
                return None, "Direct stream URL tidak ditemukan dalam metadata YouTube."
            return result_url, None
    except Exception as e_ios:
        error_msg = str(e_ios)
        print(f"[STREAM EXTRACTOR ERROR] Gagal mengekstrak video '{video_id}': {error_msg}")
        return None, error_msg
```

#### Penjelasan:
* Tidak ada `STREAM_CACHE`, tidak ada `gate1_limiter.check_and_add()`.
* Menerima dictionary `custom_opts` dari request body frontend. Jika frontend ingin merubah kualitas video (misal ingin 720p atau 360p), frontend cukup mengirimkannya di request body tanpa perlu mengubah satu baris pun kode Python backend.

---

## 4. Bedah Kode Per Baris: Endpoint Heatmap

### A. Controller di `mobile_api/main.py`
```python
@app.route("/api/heatmap", methods=["GET", "POST"])
@app.route("/api/heatmap/<video_id>", methods=["GET", "POST"])
def get_heatmap(video_id=None):
    body = request.get_json(silent=True) or {}
    vid = body.get("video_id") or video_id or request.args.get("video_id")
    
    if not vid:
        return jsonify({
            "status": "error",
            "error": "Parameter 'video_id' wajib disertakan dalam path, query, atau body."
        }), 400

    custom_opts = body.get("ydl_opts") or body.get("options")
    
    raw_heatmap, title, err = get_raw_heatmap(vid, custom_opts=custom_opts)
    if err and not raw_heatmap:
        return jsonify({
            "status": "error",
            "video_id": vid,
            "error": err
        }), 404

    # Backend TIDAK melakukan filtering ketat; raw heatmap langsung dikembalikan
    return jsonify({
        "status": "ok",
        "video_id": vid,
        "title": title,
        "heatmap": raw_heatmap
    })
```

#### Penjelasan:
* Backend **tidak menghitung offset** (`start_time - offset`).
* Backend **tidak menentukan durasi** atau batas 2 detik.
* Backend **tidak membuat ID** `f"clip_{...}"`.
* Backend **tidak membatasi jumlah klip**.
* Seluruh data mentah `heatmap` (array berisi segmen asli YouTube `[{'start_time': ..., 'end_time': ..., 'value': ...}]`) diserahkan apa adanya ke frontend.

---

### B. Extractor di `mobile_api/utils/heatmap.py`
```python
def get_raw_heatmap(video_id_or_url: str, custom_opts: dict = None) -> tuple:
    if "youtube.com" in video_id_or_url or "youtu.be" in video_id_or_url:
        video_url = video_id_or_url
    else:
        video_url = f"https://www.youtube.com/watch?v={video_id_or_url}"

    ydl_opts = {
        'skip_download': True,
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False
    }

    cookie_path = os.path.join(BASE_DIR, 'cookies.txt')
    if os.path.exists(cookie_path):
        ydl_opts['cookiefile'] = cookie_path
        
    ydl_opts['extractor_args'] = {'youtube': {'player_client': ['ios', 'android']}}

    if custom_opts and isinstance(custom_opts, dict):
        ydl_opts.update(custom_opts)

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)
            heatmap = info.get('heatmap') or []
            title = info.get('title') or ""
            
            if not heatmap:
                return [], title, "Heatmap tidak ditemukan. Video ini mungkin belum memiliki data 'Most Replayed'."
                
            return heatmap, title, None

    except Exception as e:
        error_msg = str(e)
        return [], "", error_msg
```

#### Kode yang Dihapus dari `heatmap.py`:
1. `VIDEO_URL = "https://youtu.be/t6h8Uae2Q_E"` (Dihapus).
2. Fungsi `format_time(seconds)` untuk format jam terminal (Dihapus).
3. Perulangan `print(f"Peringkat {rank}: ...")` (Dihapus).
4. Blok interaktif terminal `if __name__ == "__main__": input(...)` (Dihapus).

---

### C. Pengolahan Data di Frontend (`mobile/src/services/api.ts`)
Karena backend mengembalikan array mentah `heatmap`, pengolahan klip sekarang dilakukan secara instan di TypeScript:
```typescript
// Di mobile/src/services/api.ts
if (Array.isArray(data.heatmap) && data.heatmap.length > 0) {
  // 1. Urutkan berdasarkan intensitas tertinggi
  const topMoments = [...data.heatmap]
    .sort((a: any, b: any) => (b.value || 0) - (a.value || 0))
    .slice(0, numClips);

  // 2. Hitung offset dan format objek klip
  const formattedClips: ClipItem[] = topMoments.map((moment: any, index: number) => {
    const origStart = Number(moment.start_time || 0);
    const origEnd = Number(moment.end_time || 0);
    let start = Math.max(0, origStart - offset);
    let end = origEnd + offset;

    return {
      id: `clip_${origStart}`,
      rank: index + 1,
      videoId: videoId,
      start: Math.round(start),
      end: Math.round(end),
      value: moment.value,
      status: 'none'
    };
  });

  return { title: data.title || '', clips: formattedClips };
}
```
**Keuntungan Besar**:
Jika user ingin mengubah rentang offset (misal dari 5 detik menjadi 10 detik) atau mengubah jumlah klip dari 10 menjadi 25, **cukup diubah di layar UI aplikasi mobile**. Tidak perlu menyentuh atau me-rebuild backend Python sama sekali!

---

## 5. Tabel Komparasi: Sebelum vs Sesudah Refaktor

| Fitur / Karakteristik | Versi Lama (explanation.md) | Versi Baru (explanation2.md) |
| :--- | :--- | :--- |
| **Konfigurasi `ydl_opts`** | Hardcoded di Python (`height<=480`, dll.) | **100% Dinamis** dari `request.body` (POST) |
| **In-Memory Cache Python** | Ada `STREAM_CACHE = {}` di RAM Python | **Dihapus 100%** (Dikelola mandiri oleh `LocalStorage` frontend) |
| **Rate Limiter Disk I/O** | Ada `gate1_ratelimit.json` (tulis disk tiap hit) | **Dihapus 100%** (Tidak ada penulisan file ke disk) |
| **Error Handling** | Ditutupi menjadi status 500 umum | **Raw Error Pass-Through** (Pesan asli YouTube diteruskan ke client) |
| **Kalkulasi Offset Waktu** | Dihitung di Python (`start - offset`) | **Dihitung 100% di Frontend (TypeScript)** |
| **Sorting Ranking Klip** | Diurutkan di Python | **Diurutkan 100% di Frontend (TypeScript)** |
| **Penomoran ID Klip** | Diformat di Python (`clip_...`) | **Diformat 100% di Frontend (TypeScript)** |
| **Endpoint `/api/proxy_stream`** | Aktif membebani relay data | **Di-comment out** (Player native Android streaming langsung) |
| **Kesesuaian Rule 7** | Kurang (masih banyak logika bisnis di backend) | **100% Patuh** (Pure pass-through bridge) |
