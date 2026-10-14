# 📌 Project Clipping - Flow & Architecture Roadmap

Dokumen ini mencatat konteks arsitektur saat ini (Web & Bot) serta rencana migrasi dan pengembangan ke aplikasi Mobile (**React Native + Expo**).

---

## 1. Arsitektur Saat Ini (Existing Architecture)

Saat ini project terdiri dari 3 pilar utama:

### A. Backend API (`api/main.py`)
- **Framework**: FastAPI (Port 3006).
- **Fungsi Utama**:
  - `GET /api/stream/{video_id}`: Mengekstrak URL direct stream MP4/M3U8 via `yt-dlp` (`utils/stream_extractor.py`).
  - `GET /api/heatmap/{video_id}`: Mengambil data segmen video paling banyak ditonton ("Most Replayed") via `utils/heatmap.py`.
  - `GET /api/proxy_stream`: Stream proxy dengan range header support untuk membypass pembatasan CORS / IP YouTube.
  - `POST /api/download-to-gdrive`: Download video utuh dan upload ke Google Drive.
  - Serve static frontend dari `frontend/dist`.

### B. WhatsApp Bot (`bot/main.py`)
- **Engine**: Python `neonize` (klien WhatsApp).
- **Fungsi Utama**:
  - Menerima format perintah: `!download <url> \n <start> - <end>`.
  - Menjalankan download dan pemotongan klip video menggunakan `yt-dlp` + `ffmpeg` secara otomatis (`bot/fast_download.py`).

### C. Frontend Web (`frontend/`)
- **Framework**: React + Vite + Tailwind CSS.
- **Halaman**:
  1. **Dashboard (`Dashboard.jsx`)**:
     - Input link YouTube / Video ID.
     - Menampilkan daftar workshop (riwayat video yang diedit).
     - Tombol ekspor daftar klip ke WhatsApp (`handleBulkWA`).
     - Import/Export workshop via format JSON.
  2. **Feed / Workshop (`Feed.jsx` & `FeedItemStream.jsx`)**:
     - Tampilan reel vertikal (`max-w-[420px] h-[100dvh]`).
     - Custom video player berbasis direct streaming (bukan iframe standar YouTube).
     - Kontrol potong klip: **Extend** (+1s, +5s) & **Crop** (-1s, -5s).
     - Status penanda klip: *Done* (hijau) / *Default*.
     - Seekbar interaktif dengan penunjuk waktu relatif.
     - Bottom slider daftar klip berdasarkan rank heatmap.
     - Penyimpanan draft di browser `localStorage`.

---

## 2. Visi & Konsep Mobile App (Expo React Native)

### 🎯 Karakteristik Aplikasi
- **Personal Tool**: Dirancang khusus untuk penggunaan pribadi (1-2 orang pengguna). Batasan ukuran bundle, permission akses penyimpanan, atau overhead runtime tidak menjadi kendala.
- **Offline / Localhost-First**: Aplikasi mobile tidak bergantung pada satu backend server terpusat di cloud. Mobile app menjalankan server Python lokalnya sendiri di `localhost` pada perangkat (atau via bridge/local server) untuk mengeksekusi `yt-dlp`.
- **Zero Database**: Tidak menggunakan database SQL/NoSQL. Seluruh persistensi berbasis file system murni (`.json` untuk metadata, folder lokal untuk video `.mp4`).

---

## 3. Alur Kerja (Workflow) Sistem Mobile

### 1. Inisialisasi & Startup
1. Pengguna membuka aplikasi mobile (Expo / React Native).
2. Aplikasi memastikan server Python lokal aktif di `localhost:<port>`.
3. Membaca konfigurasi path penyimpanan lokal (folder khusus output video dan file workshop JSON).
4. Menampilkan halaman **Dashboard**.

### 2. Dashboard Flow
1. Pengguna memasukkan URL YouTube atau Video ID.
2. Memilih jumlah klip yang ingin diekstrak (default 50 klip).
3. Data workshop tersimpan di memori dan dicatat ke file `.json` lokal di penyimpanan perangkat.
4. Menekan salah satu kartu workshop akan membuka halaman **Workshop / Feed**.

### 3. Workshop / Feed Flow (Fokus Tahap 1: Streaming & Heatmap)
1. **Fetch Stream URL & Heatmap**:
   - Meminta direct stream URL ke `http://localhost:<port>/api/stream/{video_id}`.
   - Meminta data heatmap ke `http://localhost:<port>/api/heatmap/{video_id}`.
2. **Playback Custom Player**:
   - Menggunakan native video player (misal: `expo-video` / `react-native-video`) dengan controls custom.
   - Memutar segmen video spesifik dari detik `start` hingga `end`.
3. **Fine-Tuning Klip**:
   - Tombol **Extend**: Memperpanjang start (-1s, -5s) atau end (+1s, +5s).
   - Tombol **Crop**: Memperpendek start (+1s, +5s) atau end (-1s, -5s).
   - Tombol **Mark as Done**: Menandai klip sebagai siap diunduh (highlight warna hijau).
4. **Strategi Memory & Storage**:
   - Selama proses editing klip di Feed, perubahan disimpan di **in-memory state** (agar performa lancar tanpa beban write disk berulang).
   - Saat keluar dari Feed / autosave berkala, data draft disimpan ke file JSON fisik di internal storage perangkat.

### 4. Download & Processing Flow (Tahap 2: Pengganti Bot WhatsApp)
1. Di halaman Workshop / Dashboard, tombol *"Kirim ke WhatsApp"* diganti dengan tombol **"Download Clips"**.
2. Aplikasi mengirimkan list klip yang ditandai *Done* ke endpoint Python lokal:
   - Endpoint: `POST /api/download-clips`
   - Payload: `{ video_id, clips: [{ start, end, rank, id }, ...] }`
3. Server Python lokal menjalankan `yt-dlp` dan `ffmpeg` untuk memotong dan menyimpan file `.mp4` ke folder output lokal perangkat.
4. **Progress Tracking**:
   - Status unduhan (% download, status pemotongan ffmpeg) dikirimkan kembali ke UI secara realtime menggunakan WebSocket atau Polling/SSE.
   - UI menampilkan progress bar unduhan.

---

## 4. Rencana Integrasi Lanjutan (Future Roadmap)

1. **Google Drive Direct Sync**:
   - Fitur Login with Google / OAuth langsung di mobile app.
   - Opsi auto-sync klip yang sudah diunduh ke folder Google Drive pribadi.
2. **Auto Upload Multi-Platform**:
   - Pengaturan input API Key / OAuth untuk:
     - **YouTube** (YouTube Data API v3 untuk Shorts/Videos)
     - **TikTok** (TikTok Content Posting API)
     - **Instagram** (Instagram Graph API untuk Reels)
   - Tombol satu klik: *"Upload to Social Media"* dengan konfigurasi judul, hashtag, dan deskripsi.

---

## 5. Rencana Tahapan Eksekusi (Implementation Steps)

| Tahap | Fokus | Target Output |
|---|---|---|
| **Fase 1** | **Persiapan & Arsitektur Mobile** | Konfigurasi struktur `mobile/`, setup navigasi Expo Router, dan pengujian API client ke backend streaming & heatmap. |
| **Fase 2** | **Porting UI Web ke Mobile** | Porting Dashboard & Feed Workshop ke React Native (Styling disesuaikan dengan tema gelap web, seekbar draggable, custom controls, grid klip). |
| **Fase 3** | **Player Custom & In-Memory Storage** | Implementasi Video Player native (`expo-video`), penanganan loop segmen klip, penyimpanan file JSON lokal via `expo-file-system`. |
| **Fase 4** | **Download Engine & Python Localhost** | Integrasi download lokal menggantikan WA Bot, real-time download progress tracking (WebSocket/polling). |
| **Fase 5** | **Cloud Integration & Auto-Upload** | Integrasi Google Drive dan Auto-upload API (YouTube, TikTok, IG). |
