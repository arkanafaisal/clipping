# Scheduler Uploader (Heroku Scheduler CLI)

Script CLI Node.js statis murni (bukan web server) yang didesain khusus untuk dijalankan secara berkala menggunakan **Heroku Scheduler**. Script ini mengotomatisasi pengambilan video terjadwal dari Google Drive berdasarkan jam tayang WIB, lalu mengunggahnya secara bersamaan (*parallel streaming*) ke **YouTube** dan **TikTok**.

---

## 🚀 Fitur Utama

1. **Konversi Zona Waktu Otomatis (WIB / UTC+7)**:
   - Heroku berjalan di zona waktu UTC. Script otomatis mengonversi jam server ke WIB (Asia/Jakarta).
   - Menghitung tanggal target: `YYYY-MM-DD` (contoh: `2026-10-23`).
   - Menghitung jam target dua digit: `<JAM>_00.mp4` (contoh: `12_00.mp4`, `15_00.mp4`, `17_00.mp4`).

2. **Eksekusi Linear & Asinkron (Tahap A s/d E)**:
   - **Tahap A & B (Pemilihan Konten)**:
     - *Mode Random (Default)*: Memilih folder game/stream acak di dalam `GDRIVE_UNUSED_FOLDER_ID`, lalu memilih file klip `.mp4` acak yang belum berlabel `[USED]`.
     - *Mode Schedule*: Mencari folder tanggal dan file jam (`<JAM>_00.mp4`).
   - **Tahap C (Download Streaming)**: Mengunduh video menggunakan `fs.createWriteStream` dan `stream/promises.pipeline` langsung ke disk lokal (`./temp_video.mp4`). **Nol buffer RAM** sehingga tidak melebihi kuota memori Heroku dyno (512MB).
   - **Tahap D (Upload Paralel)**: Mengunggah `./temp_video.mp4` secara bersamaan menggunakan `Promise.all()` ke YouTube Data API v3 dan TikTok Content Posting API v2.
   - **Tahap E (Move & Rename Instan di GDrive + Clean Up Lokal)**: Memindahkan file video dari folder game ke `GDRIVE_USED_FOLDER_ID` secara instan via update pointer Google Drive (`addParents`/`removeParents` - tanpa re-upload binary) serta me-rename menjadi `[USED_YYYY-MM-DD_HHh]_nama.mp4`. File sementara lokal dihapus dan script keluar dengan `process.exit(0)`.
   - **Error Handling**: Menangkap semua jenis kegagalan, memastikan file sementara selalu dihapus agar disk Heroku tidak penuh, dan keluar dengan `process.exit(1)`.

3. **Fleksibilitas Kredensial**:
   - Mendukung format JSON OAuth2 (seperti `token.json`), file path, atau string token API.

---

## 📋 Variabel Lingkungan (Environment Variables)

Buat file `.env` di dalam folder ini (atau atur via Heroku Config Vars):

```env
# Google Drive & YouTube (Unified Token)
GDRIVE_TOKEN={"client_id":"...","client_secret":"...","refresh_token":"..."}

# Folder Google Drive
GDRIVE_UNUSED_FOLDER_ID=1abcXYZ_ID_FOLDER_UNUSED
GDRIVE_USED_FOLDER_ID=1xyzABC_ID_FOLDER_USED
QUEUE_MODE=random

# (Opsional) YouTube Data API (Diisi jika channel YouTube memakai akun Google yang berbeda)
# Jika akun sama dengan Google Drive, biarkan KOSONG (otomatis memakai GDRIVE_TOKEN)
YOUTUBE_API_TOKEN=
YOUTUBE_PRIVACY_STATUS=public

# TikTok Content Posting API
TIKTOK_CLIENT_KEY=sbawnfyt3z5l93b3c5
TIKTOK_CLIENT_SECRET=UP8UWQ9VRKZQVtco2tM2cczfUBDe5u40
TIKTOK_API_TOKEN=act.your_tiktok_access_token_here
TIKTOK_PRIVACY_LEVEL=SELF_ONLY
```

---

## 🔑 Cara Mendapatkan Token Google OAuth Unlimited (Drive + YouTube)

Agar token Google OAuth tidak kedaluwarsa setelah 7 hari dan memiliki izin **Google Drive + YouTube Sekaligus**:

1. **Ubah Status App ke Production**:
   - Buka [Google Cloud Console](https://console.cloud.google.com/) -> **APIs & Services** -> **OAuth consent screen**.
   - Klik **Publish App** agar status berubah dari *Testing* menjadi *In Production*.
   - Tidak perlu mengajukan verifikasi resmi jika aplikasi hanya digunakan oleh akun pribadi Anda.

2. **Jalankan Generator Token di Komputer Lokal**:
   - Pastikan file `credentials.json` (OAuth Desktop App) sudah ada di folder ini atau root project.
   - Jalankan perintah:
     ```bash
     cd scheduler-uploader
     npm run auth
     ```
   - Browser akan terbuka otomatis. Jika muncul layar *"Google hasn't verified this app"*, klik **Advanced** -> **Go to [Nama App] (unsafe)**.
   - Izinkan akses Drive dan YouTube.

3. **Pasang ke Heroku**:
   - Script akan otomatis membuat file `token.json` yang berisi `refresh_token` unlimited.
   - Salin seluruh teks JSON di dalam `token.json` lalu tempelkan ke Config Var Heroku **`GDRIVE_TOKEN`**.
   - Anda **tidak perlu** membuat 2 token terpisah jika akun Google Drive dan YouTube Anda sama!


---

## ⏰ Konfigurasi Heroku Scheduler (WIB vs UTC)

Heroku Scheduler menggunakan waktu **UTC**. Jika Anda ingin video diunggah pada jam-jam WIB berikut, jadwalkan job pada jam UTC yang setara:

| Jadwal Target (WIB - UTC+7) | Jadwal di Heroku Scheduler (UTC) | Target File GDrive |
| :-------------------------- | :------------------------------- | :----------------- |
| **12:00 WIB**               | **05:00 UTC**                    | `12_00.mp4`        |
| **15:00 WIB**               | **08:00 UTC**                    | `15_00.mp4`        |
| **17:00 WIB**               | **10:00 UTC**                    | `17_00.mp4`        |
| **19:00 WIB**               | **12:00 UTC**                    | `19_00.mp4`        |
| **21:00 WIB**               | **14:00 UTC**                    | `21_00.mp4`        |
| **23:00 WIB**               | **16:00 UTC**                    | `23_00.mp4`        |

### Perintah Job di Heroku Scheduler:
- Jika seluruh repositori di-deploy ke Heroku:
  ```bash
  node scheduler-uploader/index.js
  ```
- Jika folder `scheduler-uploader` di-deploy sebagai root aplikasi:
  ```bash
  node index.js
  ```

---

## 🛠️ Pengujian Lokal (Manual Test & Mock)

1. **Instal dependensi**:
   ```bash
   cd scheduler-uploader
   npm install
   ```

2. **Uji coba dengan jam saat ini**:
   ```bash
   node index.js
   ```

3. **Uji coba jadwal jam / tanggal tertentu (Override)**:
   ```bash
   node index.js --date=2026-10-23 --hour=12
   ```

4. **Uji coba simulasi tanpa mengonsumsi kuota API (Mock Upload)**:
   ```bash
   MOCK_UPLOAD=true node index.js --hour=15
   ```

---

## ✍️ Kustomisasi Metadata Video

Buka file [index.js](file:///d:/projects/clipping/scheduler-uploader/index.js) untuk mengubah:
- **YouTube Metadata** (pada fungsi `uploadToYouTube`):
  - `title`: Judul video YouTube / Shorts
  - `description`: Deskripsi lengkap dan hashtag
  - `tags`: Array kata kunci
  - `categoryId`: Default `22` (People & Blogs) atau `24` (Entertainment)
  - `privacyStatus`: `public`, `unlisted`, atau `private`
- **TikTok Metadata** (pada fungsi `uploadToTikTok`):
  - `title`: Caption postingan TikTok
  - `privacy_level`: `PUBLIC_TO_EVERYONE`, `MUTUAL_FOLLOW_FRIENDS`, dll.
  - `disable_comment`, `disable_duet`, `disable_stitch`: Izin interaksi
