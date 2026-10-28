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
     - *Mode Random (Default)*: Memilih folder game/stream acak di dalam `GDRIVE_UNUSED_FOLDER_ID`, lalu memilih file klip `.mp4` acak yang ada di dalamnya.
     - *Mode Schedule*: Mencari folder tanggal dan file jam (`<JAM>_00.mp4`).
   - **Tahap C (Download Streaming)**: Mengunduh video menggunakan `fs.createWriteStream` dan `stream/promises.pipeline` langsung ke disk lokal (`./temp_video.mp4`). **Nol buffer RAM** sehingga tidak melebihi kuota memori Heroku dyno (512MB).
   - **Tahap D (Upload Paralel)**: Mengunggah `./temp_video.mp4` secara bersamaan menggunakan `Promise.all()` ke YouTube Data API v3 dan TikTok Content Posting API v2.
   - **Tahap E (Move Instan ke Folder Used di GDrive + Clean Up Lokal)**: Memindahkan file video dari folder game ke `GDRIVE_USED_FOLDER_ID` secara instan via update pointer Google Drive (`addParents`/`removeParents` - tanpa re-upload binary). File otomatis hilang dari folder game/unused dan tersimpan rapi dengan nama aslinya di folder used. File sementara lokal dihapus dan script keluar dengan `process.exit(0)`.
   - **Error Handling**: Menangkap semua jenis kegagalan, memastikan file sementara selalu dihapus agar disk Heroku tidak penuh, dan keluar dengan `process.exit(1)`.

3. **Fleksibilitas Kredensial**:
   - Mendukung format JSON OAuth2 (seperti `token.json`), file path, atau string token API.

---

## 🎮 Auto Edit Kompilasi Tebak-Tebakan Doksli (Quiz Compilation)

Fitur mandiri untuk mengotomatisasi pengeditan video kompilasi kuis interaktif tanpa perlu aplikasi video editor manual:

### 🧩 Konsep & Alur Kerja:
1. **Struktur Folder Google Drive**:
   - Di dalam folder `GDRIVE_DOKSLI_FOLDER_ID`, terdapat subfolder-subfolder momen (contoh: `Momen Savage Alucard di Lord`, `Kena Prank Creeper`, dll).
   - **Nama Subfolder = Kunci Jawaban Kuis** (disarankan 1 baris, maksimal ~40 karakter).
   - Di dalam masing-masing subfolder, **wajib berisi tepat 2 file video**:
     - `cut.mp4` : Video potongan epik (misal rekaman facecam saja).
     - `<judul_meme>.mp4` : Video full meme yang lebih panjang (nama dinamis).
   - *Validasi Otomatis*: Jika jumlah file video tidak tepat 2 atau tidak ada `cut.mp4`, folder tersebut otomatis dilewati dan memilih folder acak lainnya.

2. **Alur Tiap Momen**:
   - **Bagian 1 (Cut Video)**: Video `cut.mp4` diputar normal.
   - **Bagian 2 (Freeze Kuis 4 Detik)**:
     - Frame terakhir `cut.mp4` di-*freeze*.
     - **Overlay Gelap Semi-Transparan**: Teks header `"Momen manakah itu?"`.
     - **Pilihan Ganda A, B, C, D**:
       - 1 jawaban benar = nama subfolder momen saat ini.
       - 3 jawaban pengecoh = nama subfolder acak dari pool momen lainnya.
       - Urutan A/B/C/D diacak dinamis di setiap klip.
       - *Aturan 1 Baris Pasti*: Nama subfolder folder wajib 1 baris tanpa line break, menggunakan ukuran font tetap (42px) yang seragam di semua opsi untuk menjaga konsistensi tinggi kartu.
     - **Countdown Timer & Sound Effect Beep**:
       - Hitung mundur 3 detik (angka `3`, `2`, `1` dan progress bar mengecil).
       - Efek suara audio beep sinkron saat angka 3 muncul (0.0s), angka 2 (1.0s), dan angka 1 (2.0s).
     - **Reveal Jawaban & Sound Effect Correct**:
       - Pada detik ke-3 s/d 4, kartu jawaban yang benar berubah menjadi **HIJAU EMERALD** (`B. <Nama Momen>`), sementara opsi salah meredup.
       - Efek suara nada lonceng kemenangan (*cheerful rising arpeggio chime*) terdengar sinkron saat jawaban benar terungkap.
   - **Bagian 3 (Full Video + Overlay Judul 1/4 Atas)**:
     - Video full diputar dengan overlay teks judul file di area **1/4 atas kanvas** (`Y = 480`), sehingga tidak menabrak atau menutupi subtitle bawaan video yang ada di tengah layar.
     - *Dukungan Line Break Manual*: Jika judul file mengandung `\n` (contoh: `Ketika Lu Lagi Khusyuk Main\nTiba-tiba Mati Lampu.mp4`), teks otomatis dipisah baris sesuai letak `\n` tanpa auto-wrapping sembarangan.
3. **Hasil Akhir**: Seluruh momen digabungkan secara *seamless* menjadi 1 video vertikal 9:16 (**1080x1920, 60 FPS**) siap posting di folder `output_kompilasi/`.

### 🚀 Cara Menjalankan Kompilasi:
```bash
cd scheduler-uploader

# Menjalankan dengan target default (5 klip dari folder .env)
npm run doksli

# Menjalankan untuk uji coba 1 momen / folder saja:
node compile_doksli.js --count=1

# Menjalankan dengan override folder, jumlah klip, offset kuis, dan kustom teks pertanyaan:
node compile_doksli.js --folder=1xyz_ID_FOLDER_DOKSLI --count=1 --offset-y=-50 --question="Momen apakah ini?"
```

---

## ⚡ Panduan Setup Interaktif (Sangat Direkomendasikan)

Jika Anda ingin dibimbing langkah demi langkah (instalasi modul, link Google Drive, hashtag, hingga cek akun), cukup jalankan:

```bash
cd scheduler-uploader
npm run setup
```
> **Fitur Wizard:**
> - Mendukung input link Google Drive lengkap (URL browser) atau Raw ID secara otomatis.
> - Mengonfigurasi file `hashtags.txt` secara interaktif.
> - Memeriksa status token TikTok dan Google Drive / YouTube secara instan.
> - Menyediakan opsi uji coba langsung (Simulasi Mock atau Live).

---

## 🏷️ Format Caption & Hashtag (`hashtags.txt`)

Setiap video yang terupload otomatis memiliki format caption:
```text
<Nama File Terpilih> #<NamaFolderGame> <Hashtag Konstan>
```
Contoh:
- Nama file: `Momen Savage Alucard.mp4`
- Folder game: `Mobile Legends`
- `hashtags.txt`: `#shorts #fyp #viral #trending`
- **Hasil Caption VT**: `Momen Savage Alucard #MobileLegends #shorts #fyp #viral #trending`

> File `hashtags.txt` menggunakan format teks biasa yang sangat awam. Anda bebas mengosongkannya (hanya tag folder game yang dipakai) atau mengisinya maksimal 4 hashtag.

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
