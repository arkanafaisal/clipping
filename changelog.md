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

