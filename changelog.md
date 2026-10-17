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

## [6b37458] - Bundling Binary Statis FFmpeg ARM64 ke dalam APK dan Integrasi Ekstraksi Native Library (W^X Compliant)
- **Konteks Struktural**:
  1. Mem-bundle binary executable statis FFmpeg ARM64 (`arm64-v8a`) langsung ke dalam proyek modul native Android di `mobile/modules/python-runner/android/src/main/jniLibs/arm64-v8a/libffmpeg.so`.
  2. Mengatasi kebijakan keamanan Android 10+ W^X (Write XOR Execute): Android melarang eksekusi biner dari folder privat writable (`filesDir`/`cacheDir`). Dengan menempatkannya sebagai shared library `libffmpeg.so` di `jniLibs` serta mengaktifkan `android:extractNativeLibs="true"` pada [withChaquopy.js](file:///d:/projects/clipping/mobile/plugins/withChaquopy.js), sistem Android otomatis mengekstrak binary tersebut ke `nativeLibraryDir` aplikasi dengan izin eksekusi (`r-x`).
  3. Memperbarui [PythonRunnerModule.kt](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/java/expo/modules/pythonrunner/PythonRunnerModule.kt) untuk mendeteksi `libffmpeg.so` di `nativeLibraryDir`, mencatat log kesiapan executable, dan meneruskannya saat memanggil `serverModule.callAttr("start_server", 8080, nativeLibDir)`.
  4. Menyediakan method `getNativeInfo()` di [PythonRunnerModule.kt](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/java/expo/modules/pythonrunner/PythonRunnerModule.kt) dan `getNativeRunnerInfo()` di [mobile/modules/python-runner/index.ts](file:///d:/projects/clipping/mobile/modules/python-runner/index.ts) sehingga frontend TypeScript dapat memverifikasi keberadaan path FFmpeg native secara runtime.
  5. Memperbarui `start_server` di [server.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/server.py) untuk menyetel `FFMPEG_BINARY`, menambahkan direktori native library ke `PATH`, serta membuat symlink `bin/ffmpeg` di ruang internal agar kompatibel dengan seluruh pustaka CLI.
  6. Menyinkronkan [clip_downloader.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/utils/clip_downloader.py) dan [mobile_api/utils/clip_downloader.py](file:///d:/projects/clipping/mobile_api/utils/clip_downloader.py) agar otomatis memanfaatkan `FFMPEG_BINARY` saat opsi `ffmpeg_location` tidak dikirim frontend.
  7. Menambahkan konfigurasi `ffmpeg_location` dinamis pada `downloadClip` di [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts) jika binary native terdeteksi.
  8. Menambahkan deklarasi `*.so binary` pada [.gitattributes](file:///d:/projects/clipping/.gitattributes) untuk mencegah korupsi konversi baris teks pada berkas biner ELF.
- **Perubahan Kode Penting**:
  - [.gitattributes](file:///d:/projects/clipping/.gitattributes):
    - Menambahkan `*.so binary`.
  - [mobile/plugins/withChaquopy.js](file:///d:/projects/clipping/mobile/plugins/withChaquopy.js):
    - Mengimpor `withAndroidManifest` dan menetapkan `android:extractNativeLibs="true"` pada tag application.
  - [mobile/modules/python-runner/android/src/main/java/expo/modules/pythonrunner/PythonRunnerModule.kt](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/java/expo/modules/pythonrunner/PythonRunnerModule.kt):
    - `definition`: Menambahkan fungsi `getNativeInfo`.
    - `startServerInternal`: Meneruskan `nativeLibDir` ke `start_server(8080, nativeLibDir)`.
  - [mobile/modules/python-runner/index.ts](file:///d:/projects/clipping/mobile/modules/python-runner/index.ts):
    - Menambahkan antarmuka `NativeRunnerInfo` dan mengekspor `getNativeRunnerInfo()`.
  - [mobile/modules/python-runner/android/src/main/python/server.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/server.py):
    - `start_server`: Menerima `native_lib_dir`, mengonfigurasi `FFMPEG_BINARY`, memperbarui `PATH`, dan membuat symlink `ffmpeg`.
  - [mobile/modules/python-runner/android/src/main/python/utils/clip_downloader.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/utils/clip_downloader.py) & [mobile_api/utils/clip_downloader.py](file:///d:/projects/clipping/mobile_api/utils/clip_downloader.py):
    - `download_youtube_clip_range`: Menambahkan fallback `ffmpeg_location` dari `os.getenv("FFMPEG_BINARY")`.
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - `downloadClip`: Mengambil info `nativeFfmpeg` via `getNativeRunnerInfo()` dan menyertakan `ffmpeg_location` secara dinamis ke `clipYdlOpts`.

## [3fe78ac] - Penyesuaian Tombol Hapus Cookies Menjadi Ikon Tong Sampah Kompak pada CookiesModal
- **Konteks Struktural**:
  1. Menyederhanakan tombol aksi "Hapus Cookies" di [mobile/src/components/CookiesModal.tsx](file:///d:/projects/clipping/mobile/src/components/CookiesModal.tsx) menjadi tombol berbasis ikon persegi (`40x40`) dengan `<Trash2 color="#ef4444" />` murni tanpa label teks panjang.
  2. Mengoptimalkan alokasi ruang horizontal pada baris aksi modal (`buttonRow`) di layar ponsel agar tombol utama "Unduh & Terapkan" (`submitBtn`) dan tombol "Batal" (`cancelBtn`) memiliki ruang yang lega dan tidak terdesak atau terpotong.
- **Perubahan Kode Penting**:
  - [mobile/src/components/CookiesModal.tsx](file:///d:/projects/clipping/mobile/src/components/CookiesModal.tsx):
    - `CookiesModal`: Mengubah `deleteBtn` menjadi ikon tong sampah murni tanpa elemen `<Text>`, serta menyesuaikan style `deleteBtn` menjadi kotak 40x40 dengan pemusatan ikon.

## [6957b7e] - Isolasi Cache Metadata video_info.json ke Sandbox Internal dan Deaktivasi writeinfojson di Shared Storage
- **Konteks Struktural**:
  1. Mengatasi error fatal Mode Anonim: `ERROR: cannot write video metadata to json file /storage/emulated/0/clipping/output/.../clip...info.json`. Pada Android 11+ tanpa izin `MANAGE_EXTERNAL_STORAGE`, izin media (`READ_MEDIA_VIDEO`) mengizinkan pembuatan berkas video (`.mp4`), tetapi menolak pembuatan berkas non-media (`.json`) di direktori shared storage. Sebelumnya, `downloadClip` di [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts) menyalakan flag `writeinfojson: true` yang memaksa yt-dlp menulis file `.info.json` ke folder output bersama.
  2. Mematikan `writeinfojson` (`writeinfojson: false`): yt-dlp kini hanya menulis file video `.mp4` murni ke shared storage tanpa pernah mencoba membuat file `.info.json`. Direktori bersama tetap bersih tanpa polusi file metadata, dan penolakan izin Scoped Storage tereliminasi sepenuhnya.
  3. Mengalihkan `infoJsonPath` (`load_info_filename`) 100% ke direktori sandbox privat aplikasi (`/data/user/0/com.clipping.app/files/clipping/output/[ID]/video_info.json`), sehingga pembacaan dan penyimpanan cache metadata video berjalan di ruang yang bebas izin tanpa menyentuh storage publik.
- **Perubahan Kode Penting**:
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - `downloadClip`: Mengalihkan `infoJsonPath` ke `INTERNAL_CLIPPING_OUTPUT_DIR` dan mengatur `writeinfojson: false`.

## [3156e87] - Revert Pengalihan Storage Klip dan Penegakan Izin Media Shared Storage
- **Konteks Struktural**:
  1. Memulihkan (revert) alur penempatan file unduhan klip di [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts) ke kondisi commit [3bc5d0d](file:///d:/projects/clipping/changelog.md#3bc5d0d). Kandidat 1 tetap memprioritaskan shared storage (`/storage/emulated/0/clipping/output`), karena sistem Android mengizinkan penulisan berkas media (video mp4) ke shared storage media tanpa terhalang batasan Scoped Storage dokumen teks.
  2. Menambahkan Learned Rule 20 ke [GEMINI.md](file:///d:/projects/clipping/GEMINI.md) untuk memastikan media output tidak dialihkan ke sandbox privat hanya berdasarkan kendala izin dokumen teks.
- **Perubahan Kode Penting**:
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - `downloadClip`: Mengembalikan susunan kandidat storage dengan shared storage sebagai prioritas utama.
  - [GEMINI.md](file:///d:/projects/clipping/GEMINI.md):
    - Menambahkan Learned Rule 20.

## [3bc5d0d] - Siklus Hapus-Sebelum-Tulis pada Sinkronisasi Cookies dan Tombol Hapus Cookies untuk Reset Mode Anonim
- **Konteks Struktural**:
  1. Memperbaiki alur pembaruan cookies Google Drive di [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts): Memvalidasi link Google Drive dan mendeteksi validitas file ID terlebih dahulu. Jika link valid, sistem mengeksekusi penghapusan fisik file cookies lama terlebih dahulu (`FileSystem.deleteAsync`) sebelum mengunduh file baru ke internal sandbox privat (memenuhi alur: minta -> validasi -> hapus -> tulis baru, tanpa menghapus prematur sebelum divalidasi).
  2. Menyediakan fungsi `deleteCookies()` pada [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts) dan tombol "Hapus Cookies" dengan ikon tempat sampah di [mobile/src/components/CookiesModal.tsx](file:///d:/projects/clipping/mobile/src/components/CookiesModal.tsx). Fitur ini memungkinkan pengguna membersihkan cookies yang rusak / kedaluwarsa dari ruang privat aplikasi kapan saja, sehingga aplikasi dapat seketika beralih kembali ke Mode Anonim murni tanpa kendala Scoped Storage Android.
  3. Mengidentifikasi akar masalah error yt-dlp `The page needs to be reloaded`: pengujian empiris membuktikan bahwa penyertaan file `cookies.txt` desktop menonaktifkan fallback client mobile (`android`/`ios`) pada yt-dlp dan memicu SABR / Bot Challenge PO Token YouTube. Sebaliknya, Mode Anonim (tanpa cookies) berhasil 100% mengekstrak 47 format video melalui client `visionos`.
- **Perubahan Kode Penting**:
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - `syncCookiesFromGoogleDrive`: Menambahkan penghapusan berkas lama via `FileSystem.deleteAsync` setelah validasi file ID berhasil dan tepat sebelum proses pengunduhan berkas baru.
    - `deleteCookies`: Menambahkan fungsi untuk mereset in-memory cache `cachedCookiesPath`, membersihkan AsyncStorage `yt_cookies_path`, serta menghapus file fisik cookies baik di sandbox privat maupun shared storage.
  - [mobile/src/components/CookiesModal.tsx](file:///d:/projects/clipping/mobile/src/components/CookiesModal.tsx):
    - Mengimpor `Trash2` dan `deleteCookies`.
    - Menambahkan `handleDeleteCookies` serta tombol "Hapus Cookies" berwarna aksen merah di baris aksi modal.
    - Menambahkan styling responsif untuk `deleteBtn`, `deleteBtnText`, dan penataan `rightActions`.

- **Konteks Struktural**:
  1. Menegakkan penyimpanan file `cookies.txt` 100% murni di dalam ruang internal sandbox privat aplikasi (`/data/user/0/com.clipping.app/files/clipping/cookies.txt` via `FileSystem.documentDirectory`). Direktori ini memiliki hak akses native Read & Write penuh baik untuk React Native maupun Python Chaquopy tanpa memerlukan izin sistem Android apa pun (Zero Permission).
  2. Menghapus konfigurasi `requestLegacyExternalStorage` dan izin `android.permission.MANAGE_EXTERNAL_STORAGE` dari [mobile/app.json](file:///d:/projects/clipping/mobile/app.json) karena aplikasi tidak lagi memerlukan akses ke shared storage luar untuk cookies, menjaga konfigurasi tetap bersih dan aman dari penolakan policy Google Play.
  3. Memastikan alur penimpaan (overwrite) cookies: saat cookies terdeteksi kedaluwarsa (`COOKIES_INVALID_OR_EXPIRED`) atau terkena rate limit (`RATE_LIMIT_EXCEEDED`), aplikasi TIDAK menghapus file lama terlebih dahulu melainkan langsung memunculkan [CookiesModal](file:///d:/projects/clipping/mobile/src/components/CookiesModal.tsx). Ketika pengguna mengirimkan link Google Drive yang baru, endpoint pass-through secara atomik menimpa (overwrite in-place via mode `'wb'`) file cookies lama di ruang privat.
  4. Seluruh penyesuaian dilakukan 100% di sisi frontend TypeScript tanpa menyentuh modul server Python backend (mematuhi Rule 16).
- **Perubahan Kode Penting**:
  - [mobile/app.json](file:///d:/projects/clipping/mobile/app.json):
    - Menghapus flag usang `requestLegacyExternalStorage` dan izin `MANAGE_EXTERNAL_STORAGE`.
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - Menyederhanakan `syncCookiesFromGoogleDrive()` untuk menulis langsung ke `INTERNAL_COOKIES_FILE_PATH` tanpa mencoba shared storage.
    - Menyelaraskan `getValidCookiesPath()` untuk memprioritaskan deteksi fisik di internal sandbox (Tier 3), dengan auto-migrasi jika file lama di shared folder masih terbaca (Tier 4).
    - Memasukkan `COOKIES_INVALID_OR_EXPIRED` ke dalam pengecekan `isRateLimitOrRestrictedError` agar selalu memicu pembukaan `CookiesModal`.
  - [mobile/src/components/CookiesModal.tsx](file:///d:/projects/clipping/mobile/src/components/CookiesModal.tsx):
    - Menyelaraskan teks judul dan deskripsi modal agar memperjelas bahwa link Google Drive baru akan langsung menimpa file cookies lama di penyimpanan privat.
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Menambahkan guard eksplisit `|| err.code === 'COOKIES_INVALID_OR_EXPIRED'` pada penanganan error unduhan klip untuk memastikan modal pembaruan cookies otomatis terbuka saat cookies kedaluwarsa.

## [d6e3ab8] - Strategi Dual-Storage Sandbox Fallback dan Izin MANAGE_EXTERNAL_STORAGE untuk Akses Cookies dan Klip
- **Konteks Struktural**:
  1. Mengatasi error `[Errno 13] Permission denied: '/storage/emulated/0/clipping/cookies.txt'` pada build standalone APK Chaquopy. Pada fase awal development, backend Python berjalan di Termux (`termux-setup-storage`) yang memiliki hak akses penuh ke shared storage `/storage/emulated/0/clipping/`. Saat dibundel ke dalam APK native Android (`com.clipping.app`), Android 11+ menerapkan Scoped Storage yang memblokir akses ke root storage publik tanpa izin khusus. Akibatnya, pembacaan cookies oleh yt-dlp, penulisan cookies hasil unduhan Google Drive, serta pengunduhan klip ke shared storage mengalami `Permission denied`.
  2. Menerapkan arsitektur Dual-Storage dengan auto-fallback ke internal sandbox storage (`/data/user/0/com.clipping.app/files/clipping/` via `FileSystem.documentDirectory`). Ruang penyimpanan internal ini 100% bebas izin (zero permission required) dan dapat diakses penuh oleh React Native maupun Python Chaquopy. Jika shared storage terblokir izin, seluruh alur kerja (sinkronisasi cookies Google Drive, auto-detect cookies, dan pengunduhan klip) otomatis dialihkan ke sandbox internal tanpa interupsi.
  3. Menambahkan deklarasi izin `android.permission.MANAGE_EXTERNAL_STORAGE` dan `requestLegacyExternalStorage: true` di [mobile/app.json](file:///d:/projects/clipping/mobile/app.json), serta menyertakan tombol aksi "Buka Pengaturan HP" (`Linking.openSettings()`) pada modal detail error log [mobile/src/components/Toast.tsx](file:///d:/projects/clipping/mobile/src/components/Toast.tsx) jika terdeteksi penolakan izin penyimpanan.
- **Perubahan Kode Penting**:
  - [mobile/app.json](file:///d:/projects/clipping/mobile/app.json):
    - Menambahkan `android.permission.MANAGE_EXTERNAL_STORAGE` pada daftar izin Android dan mengaktifkan `requestLegacyExternalStorage: true`.
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - Mendefinisikan konstanta path sandbox internal: `getInternalAppStoragePath()`, `INTERNAL_CLIPPING_ROOT`, `INTERNAL_CLIPPING_OUTPUT_DIR`, dan `INTERNAL_COOKIES_FILE_PATH`.
    - Menambahkan kode error `STORAGE_PERMISSION_DENIED` pada `API_ERROR_MAP` dan mengecualikannya dari `isRateLimitOrRestrictedError`.
    - Memperbarui `getValidCookiesPath()` dengan verifikasi keterbacaan aktif (`isPathReadable`) dan Tier 4 fallback internal sandbox, sehingga path shared yang terblokir izin tidak akan dioper ke Python.
    - Memperbarui `syncCookiesFromGoogleDrive()` untuk mencoba penulisan ke shared path terlebih dahulu, dan jika terjadi `permission denied` / `errno 13`, otomatis beralih menyimpan ke sandbox internal.
    - Menambahkan fungsi helper `getClipInternalOutputFilePath()` dan `resolvePlayableClipUri()` untuk menyelesaikan lokasi fisik klip lokal di kedua direktori storage.
    - Memperbarui `checkClipFileExists()` dan `downloadClip()` dengan strategi kandidat dual-storage (shared storage dan internal sandbox storage fallback).
  - [mobile/src/components/Toast.tsx](file:///d:/projects/clipping/mobile/src/components/Toast.tsx):
    - Menambahkan tombol aksi "Buka Pengaturan HP" di footer modal debug error jika terjadi `STORAGE_PERMISSION_DENIED` atau `rawError` mengandung `permission denied`.
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Memperbarui pre-scan keberadaan klip untuk memindai kedua direktori output (shared dan internal sandbox).
    - Memperbarui `syncPlayerSourceForClip` untuk menggunakan `resolvePlayableClipUri` guna memutar klip lokal dari direktori yang valid.
    - Menambahkan pemetaan judul toast untuk kode error `STORAGE_PERMISSION_DENIED`.

## [c782fa1] - Auto-Deteksi File Cookies Fisik Shared Storage dan Pemisahan Siklus Hidup Modal Debug Error Toast
- **Konteks Struktural**:
  1. Mengatasi kegagalan unduhan klip YouTube yang keliru didiagnosis sebagai pembatasan mode anonim ("Batas Permintaan YouTube (Mode Anonim) tercapai") pada build APK baru padahal file fisik `cookies.txt` telah berada di `/storage/emulated/0/clipping/cookies.txt`. Masalah ini berakar pada implementasi `getValidCookiesPath()` di [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts) yang sebelumnya hanya memeriksa in-memory cache dan `LocalStorage` internal tanpa memverifikasi keberadaan fisik file pada disk storage perangkat. Pada instalasi APK baru atau saat pengguna menempatkan file secara manual di storage bersama, `LocalStorage` bernilai kosong sehingga sistem mengirimkan `cookie_path: undefined` ke backend server.
  2. Mengatasi tertutupnya modal detail log error secara prematur di [mobile/src/components/Toast.tsx](file:///d:/projects/clipping/mobile/src/components/Toast.tsx). Sebelumnya, saat pengguna menekan tombol debug log (`<Code2>`) untuk membaca traceback/pesan error, modal `<Modal>` ikut ter-unmount seketika timer auto-dismiss notifikasi toast (3500ms - 5000ms) berakhir karena pengecekan `if (!toast) return null;` di level root container.
- **Perubahan Kode Penting**:
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - Memperbarui `getValidCookiesPath()` menjadi verifikasi 3-Tier yang memvalidasi integritas fisik file via `FileSystem.getInfoAsync`: (1) In-memory cache valid, (2) Path tersimpan di `LocalStorage`, dan (3) Auto-detect file default `/storage/emulated/0/clipping/cookies.txt` (`COOKIES_FILE_PATH`). Jika file default ditemukan, sistem otomatis meng-cache path ke in-memory dan menyimpannya ke `LocalStorage` agar request berikutnya langsung menggunakannya.
  - [mobile/src/components/Toast.tsx](file:///d:/projects/clipping/mobile/src/components/Toast.tsx):
    - Mengisolasi state data debug (`debugData: DebugErrorData | null`) dan visibilitas modal (`debugModalVisible`) dari siklus hidup `toast`.
    - Memperbarui guard rendering menjadi `if (!toast && !debugModalVisible) return null;` serta membungkus banner toast dengan `{toast ? ... : null}`, sehingga saat notifikasi toast telah pudar atau menghilang karena batas waktu durasi, modal error log tetap terbuka secara independen sampai pengguna secara eksplisit menekan tombol "Tutup" atau ikon silang `X`.

## [67b241c] - Isolasi Penanganan ReadyToPlay pada Pergantian Sumber Media dan Perbaikan Snap Back Seek Debounce
- **Konteks Struktural**: Mengatasi bug di mana tombol-tombol kumpulan seek ber-debounce (crop `-1s`/`-5s`, extend `+1s`/`+5s`, skip `-10s`/`-3s`/`+5s`/`+15s`, dan scrubber) sempat melompat ke posisi target namun seketika ter-reset kembali ke detik awal klip aktif (`currentActive.start`). Masalah ini terjadi karena operasi seek di Android ExoPlayer menyebabkan status pemutar bertransisi sejenak dari `readyToPlay` -> `loading` (buffering) -> `readyToPlay`. Event listener `statusChange` sebelumnya mengecek `readyToPlay` tanpa membedakan apakah itu pergantian sumber media baru atau sekadar seek internal, sehingga saat `readyToPlay` terpicu pasca-seek, sistem keliru menganggapnya sebagai pemuatan media baru dan memaksa `player.currentTime = currentActive.start`.
- **Perubahan Kode Penting**:
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Menambahkan `isSourceSwitchingRef` yang hanya diaktifkan (`true`) ketika `player.replace()` dipanggil (initial load, transisi stream ke lokal, transisi lokal ke stream, dan fallback refresh stream).
    - Mengisolasi logika auto-snap posisi pada `statusChange` `readyToPlay` dengan guard `if (isSourceSwitchingRef.current) { isSourceSwitchingRef.current = false; ... }`, sehingga seek internal (crop, extend, skip, scrubber) dalam satu media tidak akan pernah ter-reset ke awal klip.
    - Menyelaraskan batas akhir pada `skipSeconds` (`Math.max(start, end - 0.2)` dan `Math.max(0, duration - 0.2)`) agar lompatan maju tidak mendarat persis di batas akhir durasi yang dapat memicu loop ke awal klip secara instan.

## [0b9cd4a] - Perbaikan Bug Seek Instan Transisi Klip Carousel dan Eliminasi Siklus Putar Detik Nol
- **Konteks Struktural**: Mengatasi kegagalan seek saat berpindah klip di carousel bawah ("pindah kamar") dan mengeliminasi bug di mana video terus memutar detik 0.0s (klip pertama) meskipun klip lain dipilih. Masalah ini berakar pada tiga faktor:
  1. `useVideoPlayer(streamUrl || '')` di [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx) sebelumnya me-recreate instans native player baru setiap kali `streamUrl` terisi (menghancurkan player awal dan membuang posisi seek `firstClipStart` sehingga player baru ter-reset dan mulai memutar dari 0.0s). Diubah menjadi `useVideoPlayer(null)` sehingga instans player tunggal tetap stabil dan tidak pernah di-recreate.
  2. Saat `player.replace()` dipanggil (ketika awal memuat stream, saat transisi antar stream dan file fisik lokal, atau sebaliknya), ExoPlayer memerlukan waktu asinkron untuk mempersiapkan media dan secara default mereset posisi ke 0.0s. Seek yang dipanggil segera setelah `player.replace()` tertimpa oleh persiapan media ExoPlayer. Ditambahkan penanganan status `readyToPlay` pada listener `statusChange` agar seketika media selesai dimuat, posisi player langsung di-snap secara presisi ke `targetTime` klip aktif (bukan 0.0s jika start > 0s).
  3. Pada listener `timeUpdate`, ditambahkan pengecekan batas bawah segmen (`current < currentActive.start - 0.5`). Sebelumnya loop hanya memeriksa batas akhir (`current >= currentActive.end`), sehingga jika player sempat meleset atau tertahan di detik nol awal video, loop tidak pernah terpicu dan UI terjebak di 00:00.000 sementara video memutar klip pertama. Batas bawah ini menjamin jika video berada di luar rentang klip aktif, pemutar seketika dikembalikan ke `currentActive.start`.
  4. Pada saat perpindahan klip di carousel (`handleSelectClip`), `pendingSeekTargetRef.current` dikunci ke target waktu klip seketika (0ms tanpa debounce) dan listener `timeUpdate` memblokir penimpaan UI dari frame lama sampai posisi fisik ExoPlayer tiba dalam toleransi `< 1.0s` dari target seek, dilengkapi dengan auto-release safety timeout (1500ms).
- **Perubahan Kode Penting**:
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Mengubah `useVideoPlayer(streamUrl || '')` menjadi `useVideoPlayer(null)` untuk menjaga stabilitas siklus hidup player native.
    - Menambahkan `setPendingSeek` helper dengan auto-release safety timeout 1500ms.
    - Menambahkan referensi sinkron `isContinueStateRef`, `streamUrlRef`, dan `seekSafetyTimeoutRef` agar listener player tidak perlu di-mount/unmount ulang setiap kali klip aktif berganti.
    - Memperbarui `syncPlayerSourceForClip` untuk mengunci `setPendingSeek(targetTime)` dan melakukan direct seek seketika tanpa antrean debounce saat sumber sama.
    - Memperbarui `statusChange` listener dengan penanganan event `readyToPlay` untuk menyelaraskan `player.currentTime = targetTime` seketika media baru siap diputar.
    - Memperbarui `timeUpdate` listener dengan pengecekan kedatangan seek (`diff < 1.0`) dan boundary enforcement (`current >= end || current < start - 0.5`).

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

