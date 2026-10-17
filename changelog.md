# Changelog

Dokumentasi riwayat perubahan kode per commit ID. Setiap entri mencatat konteks struktural (pemisahan modul, penyesuaian arsitektur) dan ringkasan perubahan kode esensial (apa yang dihapus, diganti, atau ditambahkan beserta alasannya).

Format Entri:
```markdown
## [Commit ID] - <Ringkasan Singkat>
- **Konteks Struktural**: Penjelasan perubahan struktur arsitektur, fungsi, atau modul.
- **Perubahan Kode Penting**:
  - `NamaFile / Fungsi`: Menghapus/mengganti/menambah `<kode>` menjadi `<kode>` agar `<alasan>`.
```

---

<!-- Entri commit mendatang akan dicatat di bawah ini (urutan terbaru di atas) -->

## [2e30cfb] - Konfigurasi Build Production APK Mandiri dan Optimalisasi Arsitektur Tunggal ARM64 (arm64-v8a)
- **Konteks Struktural**: Mengonfigurasi EAS Build dan NDK build properties untuk menghasilkan installer **APK standalone** secara langsung (`buildType: "apk"` pada profile `production` dan `preview`) menggantikan format default Google Play Store (`.aab`). Mengunci arsitektur CPU native hanya ke engine **`arm64-v8a`** (64-bit ARM) di [mobile/app.json](file:///d:/projects/clipping/mobile/app.json) (`buildArchs`) dan [mobile/modules/python-runner/android/build.gradle](file:///d:/projects/clipping/mobile/modules/python-runner/android/build.gradle) (`abiFilters`). Penguncian ini memangkas ukuran APK secara drastis karena Chaquopy hanya mengompilasi dan mengemas runtime Python 3.10 untuk satu arsitektur modern paling umum tanpa menduplikasi binary untuk arsitektur lawas/emulator (`armeabi-v7a`, `x86`, `x86_64`).
- **Perubahan Kode Penting**:
  - [mobile/app.json](file:///d:/projects/clipping/mobile/app.json): Menambahkan `"buildArchs": ["arm64-v8a"]` pada konfigurasi plugin `expo-build-properties` android.
  - [mobile/modules/python-runner/android/build.gradle](file:///d:/projects/clipping/mobile/modules/python-runner/android/build.gradle): Membatasi `ndk.abiFilters` hanya ke `"arm64-v8a"`.
  - [mobile/eas.json](file:///d:/projects/clipping/mobile/eas.json): Menambahkan `"android": { "buildType": "apk" }` pada profil `production` dan `preview` untuk menghasilkan file `.apk` mandiri.

## [3d02903] - Eliminasi Tag Local Mode pada UI dan Penonaktifan Tombol Download Terunduh
- **Konteks Struktural**: Menyeragamkan antarmuka pemutaran klip di [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx) agar tidak menampilkan perbedaan visual berlebih (menghapus badge `LOCAL MP4`). Satu-satunya indikator visual klip yang telah selesai diunduh adalah perubahan ikon tombol unduh menjadi centang hijau (`CheckCircle2`) dalam keadaan disabled (tidak dapat diklik lagi), menjaga UI tetap bersih, konsisten, dan minimalis.
- **Perubahan Kode Penting**:
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx): Menghapus rendering elemen `<View style={styles.localBadge}>LOCAL MP4</View>` pada baris durasi tengah, menambahkan `disabled={Boolean(downloadedClips[activeClip.id] || downloadingClips[activeClip.id])}` dan `onPress={downloadedClips[activeClip.id] ? undefined : handleDownloadClip}`, serta menghapus deklarasi style `localBadge` dan `localBadgeText`.

## [46eed57] - Sinkronisasi Modul Python ke Bundle Chaquopy Native dan Pengalihan Endpoint Utama ke Port 8080
- **Konteks Struktural**: Menyiapkan aplikasi mobile untuk build native (baik development build maupun production APK) dengan menyinkronkan seluruh modul backend Python (`server.py`, `utils/stream_extractor.py`, `utils/heatmap.py`, `utils/clip_downloader.py`, dan `api/main.py`) ke folder bundle Chaquopy native di [mobile/modules/python-runner/android/src/main/python/](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/). Memastikan `stream_extractor.py` dan `heatmap.py` di dalam bundle mendukung parameter `cookie_path` dengan ekstraksi dua tahap (*Anonymous-First*), membersihkan cache `.pyc` host, serta mengalihkan seluruh pemanggilan endpoint unduhan klip (`/api/download-clip`) dan unduhan Google Drive (`/api/download-gdrive-file`) di [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts) ke server embedded internal port 8080 (`EMBEDDED_API_BASE_URL`) dengan fallback transparan ke port 3006 (`DEV_API_BASE_URL`).
- **Perubahan Kode Penting**:
  - [mobile/modules/python-runner/android/src/main/python/utils/stream_extractor.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/utils/stream_extractor.py): Menyelaraskan signature fungsi dengan `cookie_path` opsional dan alur ekstraksi stream dua tahap (*Anonymous-First*).
  - [mobile/modules/python-runner/android/src/main/python/utils/heatmap.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/utils/heatmap.py): Menyelaraskan signature fungsi dengan `cookie_path` opsional dan alur ekstraksi heatmap dua tahap (*Anonymous-First*).
  - [mobile/modules/python-runner/android/src/main/python/api/main.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/api/main.py): Membersihkan impor fungsi usang dan menyelaraskan ekspor ke endpoint aktif di `server.py`.
  - [mobile_api/utils/clip_downloader.py](file:///d:/projects/clipping/mobile_api/utils/clip_downloader.py): Menyempurnakan early validation return tuple agar konsisten mengembalikan 5 elemen `(None, None, code, msg, {})`.
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts): Memperbarui dokumentasi base URL, mengalihkan endpoint `/api/download-clip` dan `/api/download-gdrive-file` agar memprioritaskan `EMBEDDED_API_BASE_URL` (port 8080) dengan fallback ke `DEV_API_BASE_URL` (port 3006).
  - [mobile/.gitignore](file:///d:/projects/clipping/mobile/.gitignore): Menambahkan `__pycache__/` dan `*.pyc` agar artefak bytecode lokal tidak ikut ter-bundle atau ter-commit.

## [dad1f83] - Penghapusan Penguncian Player Client Web Ekstraktor yt-dlp dan Pemisahan Error Format
- **Konteks Struktural**: Menghapus pembatasan `extractor_args: { youtube: { player_client: ['web'] } }` pada konstanta unduhan [mobile/src/constants/ytdlp.ts](file:///d:/projects/clipping/mobile/src/constants/ytdlp.ts). Penguncian klien ke 'web' sebelumnya menyebabkan YouTube menolak memberikan format video stream (hanya mengembalikan storyboard gambar) dan menghasilkan exception `Requested format is not available`, yang kemudian secara keliru diklasifikasikan sebagai kegagalan cookies (`COOKIES_INVALID_OR_EXPIRED`). Dengan membiarkan yt-dlp menggunakan cascade client default-nya, yt-dlp dapat mengekstrak seluruh 47 format video hingga resolusi 1080p Prime secara normal. Memisahkan error `FORMAT_NOT_AVAILABLE` pada [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts) agar tidak lagi disalahartikan sebagai error autentikasi cookies.
- **Perubahan Kode Penting**:
  - [mobile/src/constants/ytdlp.ts](file:///d:/projects/clipping/mobile/src/constants/ytdlp.ts): Menghapus `extractor_args.youtube.player_client: ['web']` dari `PRIME_CLIP_DOWNLOAD_OPTS` dan `DOWNLOAD_YTDL_OPTS`.
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts): Menambahkan kode error `FORMAT_NOT_AVAILABLE` pada `API_ERROR_MAP`, menghapus kata kunci 'requested format is not available' dari `isRateLimitOrRestrictedError`, dan memetakan pesan error format secara akurat.

## [d4c3906] - Transparansi Eksekusi Cookies yt-dlp, Diferensiasi Kode Error Anon vs Cookies, dan Penjaminan Persistensi Path
- **Konteks Struktural**: Memperjelas status eksekusi autentikasi download klip YouTube secara transparan antara Backend Python dan Frontend TypeScript. Backend kini mengembalikan metadata eksekusi riil (`cookies_attempted`, `cookies_file_exists`, `cookies_path`, dan `file_size` hasil unduh Google Drive) tanpa memalsukan atau menyembunyikan status. Frontend membedakan kode error dan pesan toast secara spesifik antara kegagalan mode anonim (`RATE_LIMIT_EXCEEDED`) dan kegagalan mode cookies (`COOKIES_INVALID_OR_EXPIRED` / `COOKIES_FILE_NOT_FOUND`). Memperbaiki `getValidCookiesPath()` agar tidak lagi menghapus path LocalStorage secara keliru saat sandbox Expo tidak dapat memindai direktori storage eksternal Android secara langsung.
- **Perubahan Kode Penting**:
  - [mobile_api/utils/clip_downloader.py](file:///d:/projects/clipping/mobile_api/utils/clip_downloader.py) & [mobile/modules/python-runner/android/src/main/python/utils/clip_downloader.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/utils/clip_downloader.py): Menyinkronkan pelacakan `cookies_attempted` dan `cookies_file_exists`, mengembalikan metadata eksekusi riil dan membedakan kode `COOKIES_INVALID_OR_EXPIRED` jika mode cookies gagal dieksekusi.
  - [mobile_api/main.py](file:///d:/projects/clipping/mobile_api/main.py) & [mobile/modules/python-runner/android/src/main/python/server.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/server.py): Meneruskan metadata cookies ke payload respons JSON dan menyertakan `file_size` riil pada `/api/download-gdrive-file`.
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts): Memperbaiki `getValidCookiesPath` agar tidak menghapus LocalStorage; menambahkan pemetaan error `COOKIES_INVALID_OR_EXPIRED` dan `COOKIES_FILE_NOT_FOUND` pada `API_ERROR_MAP`; serta menyimpan metadata ukuran file cookies.
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx): Memberikan judul toast yang spesifik ('Cookies Tidak Valid / Kedaluwarsa' vs 'Batas Permintaan YouTube (Mode Anonim)') sehingga pengguna mengetahui status penggunaan cookies secara pasti.

## [1909c00] - Pemindahan Konfigurasi Google Drive Downloader ke Frontend dan Eliminasi Hardcode Server
- **Konteks Struktural**: Memindahkan seluruh konfigurasi pengunduhan Google Drive (headers browser, template endpoint URL download, timeout) ke konstanta frontend baru di [mobile/src/constants/gdrive.ts](file:///d:/projects/clipping/mobile/src/constants/gdrive.ts). Menegakkan kembali kepatuhan pada Rule 16 (True Pass-Through Architecture) di mana server Python backend (`main.py` dan `server.py`) dibuat 100% dinamis menerima seluruh konfigurasi dari payload request body frontend (`body.get("config")`) tanpa ada nilai yang di-hardcode di server. Dengan pemisahan ini, setiap penyesuaian header atau endpoint Google Drive di masa depan dapat diperbarui secara instan di level frontend/TypeScript tanpa perlu rebuild native APK / Chaquopy dev mode.
- **Perubahan Kode Penting**:
  - [mobile/src/constants/gdrive.ts](file:///d:/projects/clipping/mobile/src/constants/gdrive.ts): Dibuat baru dengan interface `GDriveDownloadConfig` dan nilai default `DEFAULT_GDRIVE_DOWNLOAD_CONFIG` berisi headers Chrome 124, timeout 30 detik, dan daftar template URL fallback Google Drive.
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts): Mengimpor `DEFAULT_GDRIVE_DOWNLOAD_CONFIG` dan mengirimkannya pada parameter `config` saat memanggil endpoint `/api/download-gdrive-file` di `syncCookiesFromGoogleDrive`.
  - [mobile_api/main.py](file:///d:/projects/clipping/mobile_api/main.py) & [mobile/modules/python-runner/android/src/main/python/server.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/server.py): Menghapus seluruh hardcode User-Agent, headers, timeout, dan template URL; mengekstrak secara dinamis dari `body.get("config")`.

## [8f71431] - Penguatan Downloader Google Drive Publik, Deteksi Link Folder, dan Dukungan Session Browser
- **Konteks Struktural**: Memperkuat fungsi pengunduhan file publik dari Google Drive (`/api/download-gdrive-file`) dengan menyuntikkan header browser Chrome asli dan `requests.Session()` untuk mempertahankan cookie redirect, serta auto-recovery token konfirmasi virus scan Google Drive (`confirm=...`). Menambahkan validasi integritas file untuk mendeteksi apakah respons yang diterima berupa halaman HTML (bukan file `cookies.txt`), serta menambahkan deteksi dini `isGoogleDriveFolderLink` di frontend (`CookiesModal.tsx` & `api.ts`) untuk mencegah input link folder yang tidak valid.
- **Perubahan Kode Penting**:
  - [mobile_api/main.py](file:///d:/projects/clipping/mobile_api/main.py) & [mobile/modules/python-runner/android/src/main/python/server.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/server.py): Menggunakan `requests.Session()`, header User-Agent Chrome 124, multi-URL fallback Google Drive (`drive.usercontent.google.com` & `drive.google.com/uc`), ekstraksi confirm token, dan pengecekan header file bukan `text/html`.
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts): Menambahkan helper `isGoogleDriveFolderLink`, menyempurnakan `extractGoogleDriveFileId`, memperjelas pesan `GDRIVE_DOWNLOAD_FAILED` di `API_ERROR_MAP`, dan memprioritaskan pemanggilan `DEV_API_BASE_URL` (port 3006).
  - [mobile/src/components/CookiesModal.tsx](file:///d:/projects/clipping/mobile/src/components/CookiesModal.tsx): Menambahkan validasi link folder langsung pada submit form untuk memberikan pesan panduan langsung ke pengguna.

## [efa7587] - Eliminasi Pemilahan Error di Backend, Retur Error Mentah, dan Penanganan Otomatis Cookies di Frontend
- **Konteks Struktural**: Menghapus seluruh logika pemilahan / klasifikasi error (`_is_rate_limit_or_restricted` dan pengecekan kata kunci error) dari sisi server backend Python (`server.py` dan `clip_downloader.py`), memastikan server murni mengembalikan error mentah tanpa manipulasi teks (Rule 12 & Rule 19). Menggeser seluruh keputusan penanganan error 100% ke frontend: jika download gagal saat mode anonim dan frontend belum memiliki/mengirim cookies, frontend secara mandiri mengklasifikasikan kegagalan tersebut sebagai kebutuhan autentikasi (`RATE_LIMIT_EXCEEDED`) dan langsung memicu tampilan `CookiesModal` (Google Drive import).
- **Perubahan Kode Penting**:
  - [GEMINI.md](file:///d:/projects/clipping/GEMINI.md): Menambahkan Rule 19 [ARCH] yang melarang keras pemilahan atau inspeksi string exception di backend server.
  - [mobile_api/utils/clip_downloader.py](file:///d:/projects/clipping/mobile_api/utils/clip_downloader.py) & [mobile/modules/python-runner/android/src/main/python/server.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/server.py): Menghapus fungsi `_is_rate_limit_or_restricted` dan pengecekan `is_limit = any(...)`, mengembalikan error string mentah dengan kode standar `DOWNLOAD_FAILED` dan HTTP 500.
  - [mobile_api/main.py](file:///d:/projects/clipping/mobile_api/main.py): Menyederhanakan penentuan HTTP status code tanpa branching `RATE_LIMIT_EXCEEDED`.
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts): Memperluas `isRateLimitOrRestrictedError` untuk mendeteksi `requested format is not available`, serta pada `downloadClip`, jika terjadi kegagalan dan `!cookiePath`, otomatis melempar `RATE_LIMIT_EXCEEDED` agar antarmuka UI langsung memunculkan `CookiesModal`.

## [5d0bcc1] - Penguncian 100% Client Web Desktop pada Download Klip dan Pencegahan Fallback Ekstraktor
- **Konteks Struktural**: Mengunci secara eksplisit opsi `player_client` pada `PRIME_CLIP_DOWNLOAD_OPTS` dan `DOWNLOAD_YTDL_OPTS` hanya ke `['web']` (Desktop Web). Mencegah perilaku yt-dlp yang mencoba klien iOS/VisionOS/Android saat ekstraksi, serta menjamin hasil download klip tetap berada pada kualitas Prime asli (1080p 60fps terpisah video+audio yang digabung via FFmpeg) tanpa penurunan ke format SABR 360p.
- **Perubahan Kode Penting**:
  - [mobile/src/constants/ytdlp.ts](file:///d:/projects/clipping/mobile/src/constants/ytdlp.ts): Menambahkan `extractor_args: { youtube: { player_client: ['web'] } }` pada `PRIME_CLIP_DOWNLOAD_OPTS` dan menghapus opsi 'tv' pada `DOWNLOAD_YTDL_OPTS`, menegaskan bahwa satu-satunya fallback yang diperbolehkan hanyalah fallback autentikasi (Anonim -> Cookies).

## [2635f18] - Eliminasi Pemindaian di Server, Arsitektur 2-Tier Cache URL Download di Frontend, dan Fallback Dinamis
- **Konteks Struktural**: Menghapus seluruh logika pemindaian direktori dan pencarian file `.info.json` dari server Python backend (menegaskan kembali Rule 16 dan Rule 18 bahwa server murni pass-through). Memusatkan logika 2-Tier Caching (In-Memory Map dan file fisik `/storage/emulated/0/clipping/output/<videoId>/stream_url.txt` serta LocalStorage) 100% di frontend sebelum melakukan request. Backend mencoba mengeksekusi unduhan dengan `stream_url` yang dikirim frontend, dan jika gagal atau kedaluwarsa, otomatis melakukan fallback mengambil stream URL baru langsung dari YouTube dan mengembalikannya ke frontend untuk disimpan.
- **Perubahan Kode Penting**:
  - [GEMINI.md](file:///d:/projects/clipping/GEMINI.md): Menambahkan Rule 18 [ARCH] yang melarang keras pencarian file/direktori atau penemuan cache di sisi backend Python.
  - [mobile_api/utils/clip_downloader.py](file:///d:/projects/clipping/mobile_api/utils/clip_downloader.py) & [mobile/modules/python-runner/android/src/main/python/server.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/server.py):
    - Menghapus total `os.listdir` pemindaian info JSON pada backend.
    - Menjalankan percobaan download dengan `stream_url` terlebih dahulu, jika gagal/expired otomatis fallback ke URL YouTube (`https://www.youtube.com/watch?v={video_id}`) dan mengekstrak URL baru untuk dikirim balik ke frontend.
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - Mengimplementasikan `getCachedDownloadStreamUrl`, `saveCachedDownloadStreamUrl`, dan `clearCachedDownloadStreamUrl` yang mengelola Tier 1 (In-Memory Map) dan Tier 2 (file fisik `stream_url.txt` di direktori video).
    - Membandingkan URL balikan server di `downloadClip`, otomatis memperbarui cache jika dideteksi URL baru/berbeda, dan membersihkan cache jika terjadi error 403/expired.

## Deteksi Otomatis & Penggunaan Kembali Metadata Info JSON Lintas-Klip
- **Konteks Struktural**: Menambahkan deteksi otomatis file `.info.json` yang sudah ada di direktori output video (`output_dir`) pada backend downloader, sehingga ketika mendownload klip ke-2, ke-3, dst., yt-dlp langsung memuat cache metadata dan stream URL dari file info JSON yang sudah ada di disk. Menghilangkan seluruh panggilan ekstraksi ke halaman web YouTube (`[youtube] Downloading webpage`, `[youtube] Downloading visionos player API JSON`), mempercepat download klip berikutnya secara instan dan 100% bebas dari rate limit YouTube.
- **Perubahan Kode Penting**:
  - [mobile_api/utils/clip_downloader.py](file:///d:/projects/clipping/mobile_api/utils/clip_downloader.py) & [mobile/modules/python-runner/android/src/main/python/server.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/server.py):
    - Memindai `output_dir` untuk file `*.info.json` jika `load_info_filename` spesifik belum ditemukan, lalu menyuntikkannya ke `opts['load_info_filename']` sebelum eksekusi yt-dlp.

## Pemindaian Universal Klip Terunduh di File System, Persistensi Status, dan Deteksi Restriksi 403 YouTube
- **Konteks Struktural**: Memperbaiki pemindaian file sistem agar memeriksa seluruh klip tanpa terbatas pada status 'done', mencocokkan nama file di direktori `/storage/emulated/0/clipping/output/<videoId>` berdasarkan timestamp waktu start dan end secara universal (tahan terhadap restart aplikasi maupun beda hari), otomatis menyinkronkan status klip menjadi 'done' dan menyimpan ke LocalStorage saat unduhan selesai. Serta memperluas klasifikasi pembatasan YouTube (menangkap HTTP 403 Forbidden, access denied, bot verification, dan ffmpeg exit code 8) sebagai `RATE_LIMIT_EXCEEDED` agar memicu `CookiesModal` secara presisi, serta membersihkan opsi User-Agent yang tidak cocok pada `ffmpeg_i` di `PRIME_CLIP_DOWNLOAD_OPTS`.
- **Perubahan Kode Penting**:
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Mengganti filter pemindaian mount dari `if (clip.status === 'done')` menjadi pemindaian universal direktori storage untuk semua klip, memulihkan status unduhan yang sudah ada di disk secara instan ke memory & LocalStorage.
    - Pada `handleDownloadClip`, langsung memperbarui status klip menjadi `'done'`, meng-update `clipsRef`, menyimpannya ke `LocalStorage.setItem(DRAFT_KEY, ...)`, dan memberitahukan ke Dashboard via `onUpdateWorkshopDone`.
    - Menggunakan helper `isRateLimitOrRestrictedError` pada seluruh blok penanganan error klip, stream mount, dan video player error agar memicu `CookiesModal` saat YouTube memberlakukan restriksi 403/429.
  - [mobile/src/components/Dashboard.tsx](file:///d:/projects/clipping/mobile/src/components/Dashboard.tsx):
    - Mengintegrasikan `isRateLimitOrRestrictedError` pada pembuatan dan pembukaan workshop agar memunculkan `CookiesModal` saat terjadi error 403/429.
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - Mengekspor fungsi `isRateLimitOrRestrictedError` yang mendeteksi kode maupun teks error `429`, `403`, `forbidden`, `access denied`, `rate limit`, `bot`, `sign in`, dan `code 8`.
  - [mobile/src/constants/ytdlp.ts](file:///d:/projects/clipping/mobile/src/constants/ytdlp.ts):
    - Menghapus override `-user_agent` dan `-headers` pada `ffmpeg_i` agar yt-dlp secara native meneruskan header dan cookies yang cocok dengan client stream ke ffmpeg, mencegah error 403 Forbidden dari googlevideo.
  - [mobile_api/utils/clip_downloader.py](file:///d:/projects/clipping/mobile_api/utils/clip_downloader.py), [mobile_api/utils/stream_extractor.py](file:///d:/projects/clipping/mobile_api/utils/stream_extractor.py), [mobile_api/utils/heatmap.py](file:///d:/projects/clipping/mobile_api/utils/heatmap.py), [mobile/modules/python-runner/android/src/main/python/server.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/server.py):
    - Menambahkan deteksi restriksi akses (403, forbidden, access denied, bot, code 8) pada error yt-dlp/ffmpeg dan menstandarisasi balikan sebagai kode `RATE_LIMIT_EXCEEDED` dengan status HTTP 429.

## Sinkronisasi Cookies Google Drive Otomatis & Arsitektur YouTube Anonim-Pertama
- **Konteks Struktural**: Mengimplementasikan arsitektur *Anonymous-First* pada seluruh operasi YouTube backend (`stream`, `heatmap`, `download-clip`) di mana request pertama selalu dijalankan 100% tanpa cookies (mode anonim). Hanya jika percobaan anonim gagal dan frontend mengirimkan path cookies yang valid di disk, backend melakukan percobaan kedua (retry otomatis) menggunakan cookies. Jika batas permintaan terlampaui (Error 429), frontend mendeteksi kode `RATE_LIMIT_EXCEEDED` dan menampilkan `CookiesModal` bagi pengguna untuk menempelkan link Google Drive publik file `cookies.txt` (<100MB), yang kemudian diunduh langsung tanpa login melalui endpoint baru `/api/download-gdrive-file` dan disimpan ke shared folder `/storage/emulated/0/clipping/cookies.txt`.
- **Perubahan Kode Penting**:
  - [mobile_api/main.py](file:///d:/projects/clipping/mobile_api/main.py) & [mobile/modules/python-runner/android/src/main/python/server.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/server.py):
    - Menambahkan endpoint pass-through `POST /api/download-gdrive-file` yang menerima `{ file_id, output_path }` dari frontend dan mengunduh file publik Google Drive secara streaming langsung tanpa login.
    - Menangkap parameter `cookie_path` dari body request pada `/api/stream`, `/api/heatmap`, dan `/api/download-clip`.
  - [mobile_api/utils/stream_extractor.py](file:///d:/projects/clipping/mobile_api/utils/stream_extractor.py), [mobile_api/utils/heatmap.py](file:///d:/projects/clipping/mobile_api/utils/heatmap.py), [mobile_api/utils/clip_downloader.py](file:///d:/projects/clipping/mobile_api/utils/clip_downloader.py):
    - Menerapkan alur dua tahap: Percobaan 1 mode anonim (hapus `cookiefile`), Percobaan 2 dengan `cookie_path` jika anonim gagal dan cookies tersedia di disk.
    - Mengembalikan kode error terstandarisasi (`RATE_LIMIT_EXCEEDED`, `STREAM_NOT_FOUND`, `HEATMAP_NOT_FOUND`, `DOWNLOAD_FAILED`) beserta detail raw error utuh.
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - Menambahkan fungsi `extractGoogleDriveFileId` untuk mengekstrak File ID dari berbagai format link Google Drive publik.
    - Menambahkan `getValidCookiesPath` yang mengecek In-Memory cache, LocalStorage (`configured_cookies_path`), dan memeriksa eksistensi file fisik via `FileSystem.getInfoAsync`.
    - Menambahkan `syncCookiesFromGoogleDrive` yang memanggil `/api/download-gdrive-file` dan meng-cache path cookies.
    - Menyisipkan `cookie_path: await getValidCookiesPath()` secara otomatis pada `fetchStreamUrl`, `fetchHeatmap`, dan `downloadClip`.
  - [mobile/src/components/CookiesModal.tsx](file:///d:/projects/clipping/mobile/src/components/CookiesModal.tsx):
    - Membuat komponen modal input gelap (dark-themed) sederhana untuk memasukkan link Google Drive cookies saat error 429 terdeteksi, dengan feedback visual loading dan validasi input.
  - [mobile/src/components/Dashboard.tsx](file:///d:/projects/clipping/mobile/src/components/Dashboard.tsx) & [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Menangkap kode error `RATE_LIMIT_EXCEEDED` dan menampilkan `CookiesModal` secara otomatis.

## 2-Tier Caching URL Stream Download & Eliminasi Penghapusan File di Server
- **Konteks Struktural**: Mengimplementasikan 2-Tier Caching (In-Memory Map & Persistent LocalStorage) pada frontend untuk URL stream download, sehingga unduhan klip berikutnya dari video yang sama menggunakan URL stream yang sudah ada tanpa melakukan ekstraksi baru ke YouTube (mencegah rate limit 429). Sekaligus membersihkan backend dari logic penghapusan file (`os.remove`) dan auto-recovery, mengembalikan tanggung jawab penanganan error dan pembersihan cache 100% ke frontend.
- **Perubahan Kode Penting**:
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts): Menambahkan `DOWNLOAD_STREAM_MEMORY_MAP`, mengecek in-memory dan localstorage sebelum request `/api/download-clip`, mengirimkan `stream_url` ke backend, menyimpan URL balikan dari server, serta menghapus cache dan file JSON jika terjadi error 403/expired.
  - [mobile_api/utils/clip_downloader.py](file:///d:/projects/clipping/mobile_api/utils/clip_downloader.py): Menghapus total pemanggilan `os.remove(info_json_path)` agar server tetap murni pass-through, menerima parameter `stream_url`, mengekstrak URL dari info JSON dan mengembalikannya dalam tuple response.
  - [mobile_api/main.py](file:///d:/projects/clipping/mobile_api/main.py): Menerima parameter `stream_url` dan mengembalikan `stream_url` dalam JSON response sukses maupun gagal.
  - [mobile/modules/python-runner/android/src/main/python/server.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/server.py): Menyelaraskan implementasi `download_clip` agar menerima `stream_url` dan mengembalikan `stream_url` ke frontend.

## Pemutaran Video Lokal Dinamis Klip Terunduh (Offline & 0ms Buffer)
- **Konteks Struktural**: Mengimplementasikan pemutaran video lokal otomatis pada pemutar video (`expo-video`) saat klip berstatus 'done' dan telah terunduh di penyimpanan fisik HP, dengan transisi dua arah (stream online YouTube vs file lokal offline), segment looping presisi lokal (0.0s s/d durasi), penyesuaian scrubber/skip-seconds, dan fallback error pemutar otomatis.
- **Perubahan Kode Penting**:
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Mengintegrasikan fungsi pembantu `syncPlayerSourceForClip` untuk beralih instan antara `fileUri` (`file://...`) dan `streamUrl` via `player.replace()`.
    - Memperbarui `handleSelectClip` agar memeriksa status unduhan dan berpindah sumber playback seketika saat user memilih klip di carousel.
    - Memperbarui `handleToggleDone` agar langsung memverifikasi file fisik dan mengalihkan pemutar ke file lokal saat ditandai 'done', atau mengembalikan ke stream YouTube saat ditandai 'none'.
    - Memperbarui `handleDownloadClip` agar setelah unduhan selesai, klip aktif langsung beralih ke pemutaran video lokal.
    - Menyesuaikan `timeUpdate` listener, `skipSeconds`, dan scrubber `onPressIn` untuk timeline relatif `0.0s s/d duration` pada mode lokal vs `clip.start s/d clip.end` pada mode stream.
    - Menambahkan listener `statusChange` fallback agar otomatis kembali ke stream YouTube jika file lokal terhapus atau rusak di luar aplikasi.
    - Menambahkan indikator visual badge `LOCAL MP4` pada durasi tengah dan memperbolehkan render `<VideoView>` saat klip lokal aktif meski stream YouTube belum termuat.

## Penyelarasan Konfigurasi Download Prime Quality, Caching Metadata, dan Auto-Retry Native
- **Konteks Struktural**: Menyelaraskan konfigurasi download klip di frontend dengan versi tangguh asli (`bestvideo+bestaudio/best` merged mp4), mengaktifkan caching metadata info JSON lintas-klip untuk mencegah rate limit 429, serta memusatkan opsi auto-retry & reconnect yt-dlp/ffmpeg sebagai konfigurasi dinamis dari frontend.
- **Perubahan Kode Penting**:
  - [mobile/src/constants/ytdlp.ts](file:///d:/projects/clipping/mobile/src/constants/ytdlp.ts#L78-L101): Mengubah format selector `PRIME_CLIP_DOWNLOAD_OPTS` ke `bestvideo+bestaudio/best` (resolusi penuh 1080p 60fps), menambahkan properti `skip_unavailable_fragments: false`, `extractor_retries: 5`, dan `file_access_retries: 5`.
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts#L374-L390): Mengirimkan `load_info_filename` dan `writeinfojson: true` pada `downloadClip` agar metadata video YouTube disimpan dalam cache disk lokal per video ID untuk klip berikutnya.
  - [mobile_api/utils/clip_downloader.py](file:///d:/projects/clipping/mobile_api/utils/clip_downloader.py#L51-L68): Menambahkan penanganan `load_info_filename` dengan auto-recovery penghapusan cache jika data info kedaluwarsa.

## Penegasan Filosofi Minimal Server dan Penambahan Rule 16
- **Konteks Struktural**: Menegaskan batas lingkup `Learned Rules` pada coding style dan filosofi arsitektur fundamental (bukan detail mikro implementasi), dengan fokus menjaga server backend Python tetap minimal, modular, dan 100% dinamis.
- **Perubahan Kode Penting**:
  - [GEMINI.md](file:///d:/projects/clipping/GEMINI.md#L40): Menambahkan Rule 16 [ARCH] (menggantikan fokus mikro Rule 14) yang mewajibkan seluruh konfigurasi, path, dan nilai dikirim dinamis oleh frontend untuk meminimalkan kebutuhan rebuild APK / dev mode.

## Penyatuan Commit Changelog dan Penambahan Rule 15
- **Konteks Struktural**: Menyatukan alur commit antara perubahan kode fitur dan dokumentasi changelog.md ke dalam satu commit atomik tunggal per fitur (tidak lagi dipisah menjadi commit ganda).
- **Perubahan Kode Penting**:
  - [GEMINI.md](file:///d:/projects/clipping/GEMINI.md#L39): Menambahkan Rule 15 [PROCESS] yang mewajibkan penyatuan staging changelog.md bersamaan dengan perubahan fitur terkait dalam satu commit atomik yang sama.

## [e8d0064] - Modularisasi Downloader ke Utils dan Eliminasi Endpoint Cek File di Backend
- **Konteks Struktural**: Mengembalikan arsitektur backend Python menjadi pure minimal pass-through bridge dengan memindahkan logika eksekusi download rentang klip ke helper modular `utils/clip_downloader.py`, menghapus endpoint redundan `/api/check-file` dan `/api/storage/sync`, serta memusatkan deteksi file fisik sepenuhnya di frontend via `FileSystem.getInfoAsync`.
- **Perubahan Kode Penting**:
  - [mobile_api/utils/clip_downloader.py](file:///d:/projects/clipping/mobile_api/utils/clip_downloader.py): Mengabstraksi fungsi `download_youtube_clip_range` dengan yt-dlp secara terpisah dan modular, mengembalikan tuple standardized `(output_path, code, error)`.
  - [mobile_api/main.py](file:///d:/projects/clipping/mobile_api/main.py): Menyederhanakan handler `/api/download-clip` menjadi pass-through delegator ke `utils/clip_downloader.py`, serta menghapus total endpoint `/api/check-file` dan `/api/storage/sync` (memangkas file dari 290 baris menjadi 125 baris).
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts#L344-L364): Menyederhanakan fungsi `checkClipFileExists` menjadi 100% inspeksi lokal via `FileSystem.getInfoAsync` tanpa panggilan HTTP tambahan ke server.
  - [mobile/src/services/storage.ts](file:///d:/projects/clipping/mobile/src/services/storage.ts): Menghapus fungsi sinkronisasi jaringan Termux `syncToSharedStorage` agar data internal aplikasi (draft, heatmap) tetap disimpan secara terisolasi, aman, dan instan di internal sandbox.
  - [GEMINI.md](file:///d:/projects/clipping/GEMINI.md#L38): Menambahkan Rule 14 [ARCH] yang melarang pembuatan endpoint inspeksi file di server dan mewajibkan modularisasi helper logic ke dalam `utils/`.

## [ccc6af7] - Integrasi End-to-End Download Klip dan Deteksi Dual-Check File Termux
- **Konteks Struktural**: Mengintegrasikan pipeline download klip video secara tuntas antara Frontend React Native dan Backend Termux (port 3006), melengkapi deteksi status file fisik dengan fallback Linux native.
- **Perubahan Kode Penting**:
  - [mobile_api/main.py](file:///d:/projects/clipping/mobile_api/main.py#L269-L281): Menambahkan endpoint `POST /api/check-file` untuk memverifikasi keberadaan file fisik video secara native via `os.path.exists()`.
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts#L344-L382): Memperbarui `checkClipFileExists` dengan strategi dual-check (cek lokal Expo FileSystem terlebih dahulu, dan fallback ke Termux `/api/check-file` jika di luar sandbox).
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx#L716): Mengubah trigger tombol download dari `onPressIn` menjadi `onPress` untuk konsistensi interaksi release tombol.


## [8750031] - Inisialisasi changelog.md dan Penambahan Rule 13
- **Konteks Struktural**: Menambahkan sistem dokumentasi changelog formal per commit ID untuk mendokumentasikan konteks struktural arsitektur dan diff esensial yang tidak terwadahi hanya dari commit message.
- **Perubahan Kode Penting**:
  - [changelog.md](file:///d:/projects/clipping/changelog.md): Dibuat baru dengan format baku per commit ID (Konteks Struktural dan Detail Perubahan Kode).
  - [GEMINI.md](file:///d:/projects/clipping/GEMINI.md#L37): Menambahkan Rule 13 [PROCESS] yang mewajibkan pencatatan setiap commit ke `changelog.md` secara berkelanjutan.

