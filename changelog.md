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

## [Unreleased] - Neutralize Time Range Display and Millisecond Edit Colors in FeedTopControls
- **Konteks Struktural**:
  1. Harmonisasi Warna Elemen Rentang Waktu:
     - Menghilangkan diferensiasi warna hijau (`#34d399`) pada start dan merah (`#fb7185`) pada end di [FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx).
     - Menjadikan warna teks, border input, dan placeholder keduanya seragam netral (`rgba(255, 255, 255, 0.95)` dan border `rgba(255, 255, 255, 0.35)`) agar tidak tumpang-tindih makna dengan warna fungsional status Done (hijau), Trash (merah), Extend (hijau), dan Crop (merah).
- **Perubahan Kode Penting**:
  - [mobile/src/components/feed/FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx):
    - Mengganti styling `timeStartText` dan `timeEndText` menjadi `timeNumberText` standar netral.
    - Menyatukan style input `timeInputStart` dan `timeInputEnd` ke dalam `timeInput` netral dengan border `rgba(255, 255, 255, 0.35)`.

## [b4ff2c8] - Extract useClipSubtitle Hook for Subtitle Preview and Cue Management
- **Konteks Struktural**:
  1. Ekstraksi Logika Subtitle ke Hook Terpisah:
     - Memindahkan state subtitle, overlay visibility, modal edit visibility, dan lifecycle auto-load file subtitle dari [FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx) ke dalam custom hook [useClipSubtitle.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipSubtitle.ts).
     - Menjaga 100% keselarasan alur logika asli: pemuatan otomatis file subtitle tersimpan (`loadClipSubtitle`) saat klip aktif berganti, manajemen `subtitlesRef` untuk sinkronisasi cue realtime 100ms dengan time update video player, serta toggle visibilitas dan edit modal.
     - Menyediakan method dan state terisolasi: `subtitles`, `setSubtitles`, `activeSubtitleText`, `setActiveSubtitleText`, `isSubtitleVisible`, `setIsSubtitleVisible`, `subtitleModalVisible`, dan `setSubtitleModalVisible`.
- **Perubahan Kode Penting**:
  - [mobile/src/hooks/useClipSubtitle.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipSubtitle.ts):
    - Dibuat baru dengan fungsi hook `useClipSubtitle` dan interface `UseClipSubtitleParams`.
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Mengimpor dan mengonsumsi `useClipSubtitle`.
    - Menghapus deklarasi state subtitle lokal dan effect auto-load subtitle.

## [c023ed5] - Extract useClipDownload Hook for Background Download Management
- **Konteks Struktural**:
  1. Ekstraksi Logika Unduhan Klip ke Hook Terpisah:
     - Memindahkan seluruh state dan lifecycle proses unduhan klip dari [FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx) ke dalam custom hook [useClipDownload.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipDownload.ts).
     - Menjaga 100% keselarasan alur logika asli: polling realtime file progress 300ms dari background Python engine (`clip_progress_{clipId}.json`), deteksi otomatis keberadaan file fisik di storage saat klip aktif berstatus 'done', cleanup interval saat unmount, pembaruan status klip ke LocalStorage draft, dan auto-switch playback ke file lokal setelah unduhan selesai.
     - Menyediakan method dan state terisolasi: `downloadingClips`, `downloadedClips`, `downloadProgress`, `cookiesModalVisible`, `getDownloadProgressLabel`, dan `handleDownloadClip`.
- **Perubahan Kode Penting**:
  - [mobile/src/hooks/useClipDownload.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipDownload.ts):
    - Dibuat baru dengan fungsi hook `useClipDownload` dan interface `UseClipDownloadParams`.
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Mengimpor dan mengonsumsi `useClipDownload`.
    - Menghapus deklarasi state unduhan lokal, poller interval, dan handler `handleDownloadClip`.

## [2687d0f] - Extract useClipPlayer Hook for Video Playback and Controls
- **Konteks Struktural**:
  1. Ekstraksi Logika Pemutar Video & Navigasi Playback:
     - Memindahkan seluruh state, lifecycle listener video player (`expo-video`), dan debounced seek handler dari [FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx) ke dalam custom hook [useClipPlayer.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipPlayer.ts).
     - Menjaga 100% keselarasan alur logika asli: loop playback segmen (file fisik lokal vs stream YouTube online), sinkronisasi realtime cue subtitle dengan time update player, auto-recovery saat stream URL expired (`forceRefresh = true`), listener hardware back press Android, serta central debounced seek (0ms untuk file lokal, 500ms trailing-edge untuk stream YouTube).
     - Menyediakan kontrol pemutar terisolasi: `syncPlayerSourceForClip`, `centralizedSeek`, `togglePlayPause`, `skipSeconds`, dan `initializeStreamAndPlayback`.
- **Perubahan Kode Penting**:
  - [mobile/src/hooks/useClipPlayer.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipPlayer.ts):
    - Dibuat baru dengan fungsi hook `useClipPlayer` dan interface `UseClipPlayerParams`.
  - [mobile/src/hooks/useClipData.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipData.ts):
    - Menambahkan parameter opsional `clipsRef` dan `activeClipIdRef` agar referensi data klip dapat dibagikan secara sinkron dengan `useClipPlayer`.
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Mengimpor dan mengonsumsi `useClipPlayer`.
    - Menghapus listener `timeUpdate`, `statusChange`, deklarasi player state lokal, dan handler kontrol pemutar manual.

## [8e44eec] - Extract useClipData Hook for Feed Data and State Management
- **Konteks Struktural**:
  1. Ekstraksi Logika Pengelolaan Data Klip ke Hook Terpisah:
     - Memindahkan logika pengelolaan data klip dari [FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx) ke dalam custom hook [useClipData.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipData.ts).
     - Menjaga 100% keselarasan alur logika asli: inisialisasi draf LocalStorage, ekstraksi fallback Heatmap AI, pre-scanning keberadaan file MP4 fisik di direktori shared/internal sandbox, debounce auto-save 400ms ke LocalStorage, kalkulasi `activeClip` & memoized `clipColumns`.
     - Menyediakan handler manipulasi klip atomik: `handleUpdateStart`, `handleUpdateEnd`, `handleMsTimeChange`, `handleSelectClip`, `handleToggleDone`, dan `handleToggleTrash`.
- **Perubahan Kode Penting**:
  - [mobile/src/hooks/useClipData.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipData.ts):
    - Dibuat baru dengan fungsi hook `useClipData` dan interface `UseClipDataParams`.
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Mengimpor dan mengonsumsi `useClipData`.
    - Menghapus deklarasi state lokal, effect pemuatan data, dan handler manipulasi klip yang kini didelegasikan sepenuhnya ke hook.

## [d8d90e9] - Modularize FeedScreen UI Components (TopControls, PlaybackControls, Carousel, SubtitleOverlay)
- **Konteks Struktural**:
  1. Pemisahan Modular UI [FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
     - Memecah file berukuran monolith (>2,000 baris) menjadi modul-modul komponen UI terpisah di direktori [mobile/src/components/feed/](file:///d:/projects/clipping/mobile/src/components/feed/).
     - Seluruh logika, state, callbacks, layout, dan styling dipindahkan 100% tanpa mengubah tampilan (*pixel-perfect / parity visual*).
  2. Sub-Komponen yang Dibentuk:
     - [timeUtils.ts](file:///d:/projects/clipping/mobile/src/components/feed/timeUtils.ts): Ekstraksi utility helper format waktu (`formatTime`, `formatTimeWithMs`, `formatDisplayTime`).
     - [ClipCardItem.tsx](file:///d:/projects/clipping/mobile/src/components/feed/ClipCardItem.tsx): Komponen kartu klip independen yang di-memoize dengan styling badge rank, status card (active, done, trash), dan format waktu.
     - [FeedClipCarousel.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedClipCarousel.tsx): Container grid horizontal 2 baris untuk kartu-kartu klip.
     - [SubtitleOverlay.tsx](file:///d:/projects/clipping/mobile/src/components/feed/SubtitleOverlay.tsx): Realtime preview layer pill overlay subtitle di atas video player.
     - [FeedPlaybackControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedPlaybackControls.tsx): Bagian kontrol playback bawah (scrubber track, progress fill, scrubber knob, dan tombol seek -15s, -3s, play/pause, +5s, +15s).
     - [FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx): Bagian kontrol klip atas (baris time range, status/download/subtitle buttons, edit milidetik inline, baris fine-tune Extend +5/+1s dan Crop -5/-1s) lengkap beserta styles lokalnya.
- **Perubahan Kode Penting**:
  - [mobile/src/components/feed/timeUtils.ts](file:///d:/projects/clipping/mobile/src/components/feed/timeUtils.ts):
    - Dibuat baru dengan fungsi pembantu pemformatan waktu.
  - [mobile/src/components/feed/ClipCardItem.tsx](file:///d:/projects/clipping/mobile/src/components/feed/ClipCardItem.tsx):
    - Dibuat baru dengan komponen kartu item klip dan styling terisolasi.
  - [mobile/src/components/feed/FeedClipCarousel.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedClipCarousel.tsx):
    - Dibuat baru sebagai pembungkus scroll carousel horizontal 2 baris.
  - [mobile/src/components/feed/SubtitleOverlay.tsx](file:///d:/projects/clipping/mobile/src/components/feed/SubtitleOverlay.tsx):
    - Dibuat baru untuk merender overlay subtitle realtime.
  - [mobile/src/components/feed/FeedPlaybackControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedPlaybackControls.tsx):
    - Dibuat baru untuk merender progress scrubber dan tombol pemutar.
  - [mobile/src/components/feed/FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx):
    - Dibuat baru untuk merender baris atas rentang waktu, download progress, fine-tuning, dan edit milidetik.
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Mengimpor komponen-komponen baru dari `./feed/`.
    - Menghapus komponen lokal, inline JSX lama, dan gaya-gaya spesifik yang telah dipindahkan ke masing-masing komponen.

## [3a0bed5] - Compensate Timeline Drift with Universal 500ms Tail Offset in Clip Downloader Cut
- **Konteks Struktural**:
  1. Mengatasi masalah pemotongan klip yang selesai prematur / adegan penutup terpotong pada [clip_downloader.py](file:///d:/projects/clipping/mobile/scripts/utils/clip_downloader.py):
     - Ditemukan adanya *timeline drift* sistematis (~500ms) antara stream online preview progressive MP4 30fps dan segmen HLS 1080p 60fps dengan durasi paket pecahan acak dari YouTube.
     - Menambahkan kompensasi offset universal sebesar +500ms (+0.5 detik) langsung pada rentang `end_num`.
  2. Dampak Pemotongan FFmpeg:
     - Segmen unduhan sementara di tahap 1 (HLS copy) dan durasi pemotongan offline presisi di tahap 2 (FFmpeg filter `trim`/`atrim`) secara otomatis mencakup durasi tambahan +500ms.
     - Hal ini menjamin bahwa seluruh adegan, dialog, dan kalimat terakhir yang didengar pengguna saat mode klip di feed tidak terpotong prematur saat file fisik diputar.
- **Perubahan Kode Penting**:
  - [mobile/scripts/utils/clip_downloader.py](file:///d:/projects/clipping/mobile/scripts/utils/clip_downloader.py):
    - Menambahkan `end_num += 0.5` tepat setelah validasi rentang waktu `start` dan `end`.

## [ce906c0] - Implement Millisecond Precision Time Range Editing in Clip Mode
- **Konteks Struktural**:
  1. Menghadirkan fitur penyuntingan presisi milidetik pada rentang klip di [FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx) untuk menyamakan mekanisme dengan antarmuka web:
     - Angka waktu mulai (`start`) dan selesai (`end`) pada mode klip kini dapat ditekan (*pressable*) secara independen untuk mengaktifkan mode input numerik.
     - Mode input hanya dapat aktif untuk salah satu sisi pada satu waktu (`start` atau `end`).
     - Terdapat overlay latar belakang transparan (`dismissOverlay` pada zIndex 15) dan event `onBlur` pada TextInput sehingga saat user menekan sembarang area di luar baris rentang, mode input otomatis tertutup secara instan.
  2. Logika Parsing dan Pembulatan Milidetik:
     - Input dibatasi maksimal 2 digit numerik.
     - Jika pengguna memasukkan 1 digit (misal `6`), nilai otomatis dievaluasi sebagai ratusan milidetik (`60` centiseconds = 600ms).
     - Jika pengguna memasukkan 2 digit (misal `65` centiseconds = 650ms), digit ketiga otomatis bernilai 0.
     - Format tampilan non-edit (`formatDisplayTime`) menampilkan milidetik dua digit (`mm:ss.cc`) hanya bila nilai klip memiliki pecahan desimal, dan tetap ringkas (`mm:ss`) bila detik bulat.
  3. Integrasi Auto-Seek Terpusat:
     - Mengikuti `centralizedSeek` yang sudah ter-debounce secara trailing (500ms untuk stream online, 0ms untuk file lokal) sehingga seeking pemutar video tetap sinkron tanpa membebani kuota atau terkena rate limit.
- **Perubahan Kode Penting**:
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Mengimpor `TextInput` dan `Keyboard` dari `react-native`.
    - Menambahkan fungsi helper `formatDisplayTime(seconds: number): string`.
    - Menambahkan state `activeTimeEdit` (`'start' | 'end' | null`) dan `tempTimeValue`.
    - Mengimplementasikan handler `handleMsTimeChange(type, valStr)` dengan kalkulasi centiseconds dan integrasi `centralizedSeek`.
    - Menambahkan `dismissOverlay` pada root JSX dan styling `timePressable`, `timeInput`, `timeInputStart`, `timeInputEnd`.
    - Menambahkan reset `setActiveTimeEdit(null)` saat berpindah klip di carousel.

## [dedcbc4] - Fix Premature Clip End and Enable Instant Zero-Latency Local File Seek
- **Konteks Struktural**:
  1. Mengoptimalkan responsivitas pemutar video pada [FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
     - Menghilangkan *debounce* 500ms (menjadi 0ms instan) pada fungsi `centralizedSeek` ketika klip yang sedang diputar adalah file lokal fisik (`file://...`).
     - Mempertahankan debounce 500ms hanya untuk mode online stream YouTube guna mencegah limit request (HTTP 429).
- **Perubahan Kode Penting**:
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Menyesuaikan `debounceMs = isLocalMode ? 0 : 500` pada `centralizedSeek` agar seeking pada file lokal berjalan secara instan 0ms tanpa jeda waktu.

## [eeead41] - Implement Throttled Two-Stage Realtime Download Progress Tracking (Python Copy & FFmpeg Cut)
- **Konteks Struktural**:
  1. Mengimplementasikan mekanisme pelacakan progress unduhan klip secara bertahap dan realtime tanpa memerlukan rebuild binary APK native Android (zero Kotlin changes).
  2. Alur terbagi menjadi dua tahap terisolasi:
     - **Tahap 1 (Python Copy / HLS Segments)**: Python mengunduh segmen video dan audio asli secara asinkron, menghitung rasio segmen yang telah terunduh (`percent` 0–100%), dan menulis status secara atomik dengan throttling interval 250ms untuk menjaga performa flash storage.
     - **Tahap 2 (Offline FFmpeg Precision Cut)**: FFmpeg dijalankan dengan parameter `-progress` ke file sementara, lalu thread Python mem-parsing `out_time_us` berbanding durasi klip target (`cut_dur`) untuk melaporkan persentase pemotongan presisi secara realtime.
  3. Mengikuti Rule 12 dan Rule 16: Backend Python hanya mengembalikan status kode standar (`STAGE_INIT`, `STAGE_1_COPY`, `STAGE_2_CUT`, `STAGE_COMPLETE`) beserta angka persentase mentah (`percent`). Frontend React Native yang bertanggung jawab menerjemahkan kode ke label teks ramah pengguna yang rapi ("Menyiapkan...", "Unduh 45%", "Potong 80%").
  4. Komponen tombol unduh pada [FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx) otomatis bertransformasi menjadi pill interaktif dengan spinner dan teks persentase dinamis saat proses berlangsung, serta dibersihkan secara aman (leak-proof) saat unduhan selesai.
- **Perubahan Kode Penting**:
  - [mobile/scripts/utils/clip_downloader.py](file:///d:/projects/clipping/mobile/scripts/utils/clip_downloader.py):
    - Menambahkan parameter `progress_path`, fungsi bantuan `write_progress` dengan throttling 250ms, kalkulasi persentase pada `download_file_segments`, serta pembacaan progress FFmpeg `out_time_us`.
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - Menambahkan parameter `progressPath` opsional pada `downloadClip` dan meneruskannya ke pemanggilan skrip `download_clip_direct`.
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Mengintegrasikan state `downloadProgress`, timer polling file 300ms, fungsi formatting `getDownloadProgressLabel()`, unmount cleanup, serta styling pill aktif `downloadBtnActive` dan `downloadProgressText`.

## [7353f13] - Implement SubtitleEditModal, Realtime CC Overlay, and Download-to-Subtitle Button Transition
- **Konteks Struktural**:
  1. Menghubungkan alur pasca-download pada [FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
     - Ketika klip berstatus `done` dan belum diunduh: menampilkan tombol download (`Download` icon atau spinner loading).
     - Ketika klip sudah selesai diunduh: tombol download disembunyikan sepenuhnya (bukan tombol centang mati) dan digantikan oleh tombol Subtitle (`Subtitles` icon) serta tombol toggle Closed Caption (`CC`).
  2. Membuat komponen modal baru [SubtitleEditModal.tsx](file:///d:/projects/clipping/mobile/src/components/SubtitleEditModal.tsx) untuk me-review, menyunting, menambah/menghapus baris cue subtitle, mengatur waktu per-baris (-0.2s / +0.2s), me-reset ke teks asli YouTube, dan menyimpan ke file shared storage (`<start> - <end>.json`).
  3. Mengaktifkan Subtitle Layer 1 (Realtime Non-Destructive Preview) di atas pemutar video: teks subtitle aktif disinkronkan secara instan (0ms latency) dengan posisi putar video (`timeUpdate`), dengan pill overlay hitam transparan yang elegan.
  4. Memperbaiki pemfilteran track subtitle di [subtitle_fetcher.py](file:///d:/projects/clipping/mobile/scripts/utils/subtitle_fetcher.py) agar mengabaikan track `live_chat` (chat replay) dan memprioritaskan subtitle ucapan aktual (`id`, `en`, atau automatic captions terstruktur `json3`).
- **Perubahan Kode Penting**:
  - [mobile/scripts/utils/subtitle_fetcher.py](file:///d:/projects/clipping/mobile/scripts/utils/subtitle_fetcher.py):
    - Mengabaikan `live_chat` dari dictionary `subtitles` dan `automatic_captions`.
  - [mobile/src/components/SubtitleEditModal.tsx](file:///d:/projects/clipping/mobile/src/components/SubtitleEditModal.tsx):
    - Komponen modal editor subtitle lengkap dengan cue list, text input, time adjuster, reset, dan auto-save.
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Mengganti tombol download menjadi tombol Subtitle & CC setelah klip terunduh.
    - Menghubungkan pembacaan subtitle otomatis saat perpindahan klip dan sinkronisasi overlay teks di atas `<VideoView />`.

## [29399ea] - Fix A/V Desync and Initial Video Freeze Using FFmpeg filter_complex trim and setpts
- **Konteks Struktural**:
  1. Mengatasi masalah video klip yang nge-freeze pada bagian awal serta audio yang selesai lebih awal (desync) pada [clip_downloader.py](file:///d:/projects/clipping/mobile/scripts/utils/clip_downloader.py).
  2. Penyebab: Penggunaan input seeking (`-ss <offset> -i ...`) pada container stream MPEG-TS (`.ts`) menyebabkan FFmpeg mencari keyframe I-frame terdekat sebelum titik offset sehingga timestamp PTS video tidak ter-reset ke 0. Sebaliknya, audio stream AAC (ADTS) mulai dari PTS 0. Akibatnya terjadi celah timestamp (gap PTS ~3 detik) antara video dan audio; pemutar video mem-freeze video di awal menunggu audio, dan saat audio selesai, video masih terus berjalan melebihi batas semestinya.
  3. Solusi: Mengganti input seeking dengan filter chain `filter_complex`:
     - Video filter: `[0:v]trim=start={v_offset}:duration={cut_dur},setpts=PTS-STARTPTS[v]`
     - Audio filter: `[1:a]atrim=start={a_offset}:duration={cut_dur},asetpts=PTS-STARTPTS[a]`
     - Filter ini mendekode dari segmen lokal dan secara mutlak mengunci PTS awal video dan audio tepat di `0.000000s`, menjamin sinkronisasi frame-accurate tanpa freeze di awal maupun drift di akhir.
  4. Menambahkan import eksplisit modul Python bawaan `urllib.request` dan `http.cookiejar`.
- **Perubahan Kode Penting**:
  - [mobile/scripts/utils/clip_downloader.py](file:///d:/projects/clipping/mobile/scripts/utils/clip_downloader.py):
    - Mengimpor `urllib.request` dan `http.cookiejar`.
    - Menerapkan `-filter_complex` dengan `trim`/`atrim` dan `setpts`/`asetpts` pada eksekusi FFmpeg tahap 2 baik untuk format HLS maupun progressive MP4.

## [dc2c0b8] - Implement Native Python HLS Segment Downloader to Bypass FFmpeg Android Network Limitation
- **Konteks Struktural**:
  1. Mengatasi error fatal `ffmpeg exited with code 1` (Protocol not found: https) saat melakukan download rentang waktu video klip di Android.
  2. Penyebab: Biner native `libffmpeg.so` pada Android dikompilasi tanpa protokol jaringan (`ff_https_protocol`, `ff_tls_protocol`, dan `ff_tcp_protocol` tidak tersedia), hanya mendukung protokol `file:` dan `pipe:`. Ketika yt-dlp mendelegasikan pemotongan rentang waktu via `external_downloader = ffmpeg`, FFmpeg berusaha membuka URL HTTPS secara langsung dari internet sehingga langsung crash.
  3. Solusi: Mengubah arsitektur [clip_downloader.py](file:///d:/projects/clipping/mobile/scripts/utils/clip_downloader.py) menjadi arsitektur 2-tahap:
     - **Tahap 1 (Python Native Network Worker)**: Menggunakan `urllib.request` bawaan Python untuk mem-parse playlist m3u8 YouTube (format video AVC 1080p 60fps / 720p 60fps dan audio AAC), memilih segmen-segmen waktu yang relevan dengan padding, lalu mengunduh dan menyatukannya ke file MPEG-TS sementara (`temp_v.ts` dan `temp_a.ts`) di disk lokal. Jika HLS tidak tersedia, terdapat fallback stream progressive MP4 via Python.
     - **Tahap 2 (Offline FFmpeg Precision Trim & Mux)**: Biner `libffmpeg.so` mengeksekusi pemotongan dan muxing offline murni dari disk lokal (`-i temp_v.ts -i temp_a.ts -c:v libx264 -preset ultrafast -c:a aac output.mp4`) tanpa pernah menyentuh koneksi internet sama sekali.
- **Perubahan Kode Penting**:
  - [mobile/scripts/utils/clip_downloader.py](file:///d:/projects/clipping/mobile/scripts/utils/clip_downloader.py):
    - Menambahkan fungsi parser playlist HLS `parse_m3u8_playlist()` dan downloader segmen `download_file_segments()` berbasis `urllib.request`.
    - Mengatur delegasi ekstraksi format HLS dan progressive murni ke Python, lalu memanggil FFmpeg untuk pemotongan presisi secara offline dari file lokal.
    - Menjamin pembersihan otomatis file-file sementara (`temp_v`, `temp_a`, `temp_path`).

## [3f530fd] - Remove Forced iOS/Android Client in Clip Downloader to Enable 1080p60 Prime Video
- **Konteks Struktural**:
  1. Mengatasi masalah penurunan resolusi video klip ke 360p 30fps pada [clip_downloader.py](file:///d:/projects/clipping/mobile/scripts/utils/clip_downloader.py).
  2. Penyebab: Adanya fallback paksa `if "extractor_args" not in opts: opts["extractor_args"] = {"youtube": {"player_client": ["ios", "android"]}}`. Pada klien `ios` dan `android`, YouTube mengaktifkan eksperimen SABR yang menghilangkan direct HTTPS stream URL untuk format video terpisah (DASH 1080p, 1080p60, 720p). Akibatnya, pemilih format `bestvideo+bestaudio` gagal dan yt-dlp secara diam-diam jatuh ke fallback Format 18 (progressive 360p 30fps).
  3. Solusi: Menghapus pembatasan `player_client: ["ios", "android"]` dari [clip_downloader.py](file:///d:/projects/clipping/mobile/scripts/utils/clip_downloader.py) agar yt-dlp secara murni menjalankan cascade multi-klien default-nya (VisionOS/Web/Android) sesuai konfigurasi dinamis `PRIME_CLIP_DOWNLOAD_OPTS` dari frontend, sehingga mengunduh format video 1080p 60fps (Format 399) dan audio jernih (Format 251).
- **Perubahan Kode Penting**:
  - [mobile/scripts/utils/clip_downloader.py](file:///d:/projects/clipping/mobile/scripts/utils/clip_downloader.py):
    - Menghapus blok penyamaran paksa `opts["extractor_args"] = {"youtube": {"player_client": ["ios", "android"]}}`.

## [85f8eae] - Remove Delete Cookies Button and Combine Anon and Cookies Error Messages
- **Konteks Struktural**:
  1. Membersihkan UI dan DOM pada [CookiesModal.tsx](file:///d:/projects/clipping/mobile/src/components/CookiesModal.tsx):
     - Menghapus tombol "Hapus Cookies" berserta seluruh logika dan import terkait (`deleteCookies`, `Trash2`).
     - Alur pembaruan cookies kini sepenuhnya mengandalkan sistem penimpaan (overwrite) otomatis saat pengguna memasukkan link Google Drive baru.
  2. Menggabungkan pesan error mentah (raw error) antara mode Anonim dan mode Cookies pada seluruh skrip backend yang memiliki mekanisme fallback otomatis ([heatmap.py](file:///d:/projects/clipping/mobile/scripts/utils/heatmap.py), [stream_extractor.py](file:///d:/projects/clipping/mobile/scripts/utils/stream_extractor.py), [subtitle_fetcher.py](file:///d:/projects/clipping/mobile/scripts/utils/subtitle_fetcher.py), dan [clip_downloader.py](file:///d:/projects/clipping/mobile/scripts/utils/clip_downloader.py)):
     - Jika mode anonim gagal DAN mode cookies juga gagal: respon error menggabungkan raw error message dari kedua percobaan (`[Anonim]: ...` dan `[Cookies]: ...`), sementara penentuan kode status terstandarisasi (`code`) tetap diprioritaskan dari hasil percobaan kedua (cookies).
     - Jika mode anonim gagal namun fallback cookies berhasil: respon sukses murni dikembalikan tanpa memperlihatkan error mode anonim (silent success).
- **Perubahan Kode Penting**:
  - [mobile/src/components/CookiesModal.tsx](file:///d:/projects/clipping/mobile/src/components/CookiesModal.tsx):
    - Menghapus tombol delete cookies, import `deleteCookies`, dan `handleDeleteCookies`.
  - [mobile/scripts/utils/heatmap.py](file:///d:/projects/clipping/mobile/scripts/utils/heatmap.py):
    - Menggabungkan raw error anonim dan cookies jika keduanya gagal, serta menentukan `code` berdasarkan percobaan cookies.
  - [mobile/scripts/utils/stream_extractor.py](file:///d:/projects/clipping/mobile/scripts/utils/stream_extractor.py):
    - Menggabungkan raw error anonim dan cookies jika keduanya gagal, serta menentukan `code` berdasarkan percobaan cookies.
  - [mobile/scripts/utils/subtitle_fetcher.py](file:///d:/projects/clipping/mobile/scripts/utils/subtitle_fetcher.py):
    - Menggabungkan raw error dan raw traceback anonim dan cookies jika keduanya gagal, serta menentukan `code` berdasarkan percobaan cookies.
  - [mobile/scripts/utils/clip_downloader.py](file:///d:/projects/clipping/mobile/scripts/utils/clip_downloader.py):
    - Menentukan `code` error tahap 1 berdasarkan percobaan terakhir (`captured_errors[-1]`) dengan tetap menggabungkan seluruh raw log pada `full_err_text`.

## [e06fe46] - Patch yt-dlp FFmpegFD and PostProcessor to Support Android libffmpeg.so Binary
- **Konteks Struktural**:
  1. Mengatasi error `ERROR: You have requested downloading the video partially, but ffmpeg is not installed. Aborting` pada tahap 1 [clip_downloader.py](file:///d:/projects/clipping/mobile/scripts/utils/clip_downloader.py).
  2. Penyebab: Pada Android APK native, binary statis FFmpeg dinamai `libffmpeg.so` dan ditempatkan di `nativeLibraryDir` aplikasi agar lolos aturan keamanan Android W^X. Namun modul bawaan yt-dlp (`FFmpegFD` dan `FFmpegPostProcessor`) hanya mencari string biner mentah bernama `'ffmpeg'` di variable sistem `PATH`, sehingga mengabaikan binary kustom berakhiran `.so`.
  3. Solusi: Menerapkan monkey-patch runtime pada `FFmpegFD.available`, `FFmpegFD.EXE_NAME = ffmpeg_bin`, dan `FFmpegPostProcessor._determine_executables` agar secara native mengenali file biner Android `libffmpeg.so` sebagai executable FFmpeg yang valid saat melakukan download parsial/rentang waktu.
- **Perubahan Kode Penting**:
  - [mobile/scripts/utils/clip_downloader.py](file:///d:/projects/clipping/mobile/scripts/utils/clip_downloader.py):
    - Mendaftarkan `ffmpeg_bin` ke `FFmpegFD` dan `FFmpegPostProcessor` yt-dlp agar proses unduh time range copy berjalan lancar.

## [9fa844d] - Implement Dynamic Google Drive Public Downloader Script and Wire Frontend Caller
- **Konteks Struktural**:
  1. Membuat modul skrip Python baru [gdrive_downloader.py](file:///d:/projects/clipping/mobile/scripts/utils/gdrive_downloader.py) secara murni pass-through dan 100% dinamis (Rule 12, Rule 16, Rule 22):
     - Menangkap parameter `file_id`, `output_path`, dan `config` (URL templates, headers, timeout).
     - Mengunduh file publik Google Drive secara streaming menggunakan session requests dan menangani token konfirmasi virus scan Google Drive secara dinamis.
     - Melakukan validasi non-HTML agar file cookies.txt yang tersimpan bukan halaman web error/folder Google Drive.
     - Menerapkan standardized error codes (`INVALID_PARAMS`, `GDRIVE_DOWNLOAD_FAILED`, `GDRIVE_FILE_EMPTY`, `GDRIVE_HTML_CONTENT`, `STORAGE_PERMISSION_DENIED`).
  2. Memperbarui fungsi `syncCookiesFromGoogleDrive()` di [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
     - Menggantikan pemanggilan endpoint HTTP usang (`/api/download-gdrive-file` di port 8080) dengan eksekusi langsung via `executePythonScript('utils.gdrive_downloader', 'download_gdrive_public_file', ...)`.
     - Menyimpan file cookies langsung ke internal sandbox aplikasi (`INTERNAL_COOKIES_FILE_PATH`), sekaligus menduplikasi salinan ke shared storage (`/storage/emulated/0/clipping/cookies.txt`) untuk kompatibilitas lintas hari/sesi.
- **Perubahan Kode Penting**:
  - [mobile/scripts/utils/gdrive_downloader.py](file:///d:/projects/clipping/mobile/scripts/utils/gdrive_downloader.py):
    - Modul baru fungsi `download_gdrive_public_file(file_id, output_path, config)` pass-through murni.
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - Menghubungkan `syncCookiesFromGoogleDrive()` ke `utils.gdrive_downloader` via `executePythonScript` dengan fallback server dev port 3006.

## [a75a2d8] - Fix temp_path Scope NameError in Clip Downloader and Implement Backend Subtitle Fetcher
- **Konteks Struktural**:
  1. Memperbaiki bug scope `NameError: name 'temp_path' is not defined` pada [clip_downloader.py](file:///d:/projects/clipping/mobile/scripts/utils/clip_downloader.py) dengan mendefinisikan variabel `temp_path = f"{output_path}.temp.mp4"` sebelum pemanggilan fungsi pembersih `cleanup_temp_files()`.
  2. Mengimplementasikan modul skrip backend baru [subtitle_fetcher.py](file:///d:/projects/clipping/mobile/scripts/utils/subtitle_fetcher.py) secara murni pass-through dan dynamic (Rule 12, Rule 16, Rule 22):
     - Menangkap parameter `video_id`, `ydl_opts`, `cookie_path`, dan `preferred_lang`.
     - Mendukung mode anonim terlebih dahulu dan fallback cookies jika dibatasi.
     - Mengekstrak track subtitle/caption (manual maupun auto ASR) dan mengunduh format `json3` / `vtt` menggunakan `ydl.urlopen`.
     - Mengembalikan data mentah utuh tanpa proses pemotongan atau pemformatan di server.
  3. Memperbarui [api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts) dan [ytdlp.ts](file:///d:/projects/clipping/mobile/src/constants/ytdlp.ts) untuk konfigurasi `SUBTITLE_YTDL_OPTS`, standardized error codes (`SUBTITLE_NOT_FOUND`, dll.), parser `json3` / `vtt`, penataan path file subtitle per-klip (`<start> - <end>.json`), serta 2-tier caching di frontend.
- **Perubahan Kode Penting**:
  - [mobile/scripts/utils/clip_downloader.py](file:///d:/projects/clipping/mobile/scripts/utils/clip_downloader.py):
    - Mendefinisikan `temp_path = f"{output_path}.temp.mp4"` sebelum inisialisasi dan pemanggilan `cleanup_temp_files()`.
  - [mobile/scripts/utils/subtitle_fetcher.py](file:///d:/projects/clipping/mobile/scripts/utils/subtitle_fetcher.py):
    - Modul baru untuk ekstraksi raw subtitle data dari YouTube dengan error code terstandarisasi.
  - [mobile/src/constants/ytdlp.ts](file:///d:/projects/clipping/mobile/src/constants/ytdlp.ts):
    - Mengaktifkan ekspor `SUBTITLE_YTDL_OPTS`.
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - Menambahkan tipe `SubtitleCue`, `SubtitleStyle`, `ClipSubtitleData`, error handling, helper path, dan fungsi operasional subtitle.

## [0b2ca7f] - Standardize Formatted Clip Filenames and Enforce Immediate Temp File Cleanup
- **Konteks Struktural**:
  1. Menghilangkan prefix/wrapper nama file klip (`clip_<rank>_` atau `clip_<videoId>_`) yang tidak objektif, menggantikannya dengan format rentang waktu murni yang konsisten dengan tampilan waktu pada card klip di UI: `<start_terformat> - <end_terformat>.mp4` (misal: `00.12 - 01.35.mp4` atau `01.15.30 - 01.16.00.mp4`).
  2. Menggunakan karakter titik (`.`) sebagai pengganti titik dua (`:`) pada komponen waktu agar aman dan kompatibel 100% dengan seluruh sistem file (FAT32/exFAT di Android Shared Storage, Windows NTFS, dan Linux).
  3. Memperbarui [FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx) dan [api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts) untuk mendeteksi file klip berformat baru saat memuat mode klip, dengan tetap menjaga fallback backward-compatible ke format lama.
  4. Menambahkan fungsi pembersih `cleanup_temp_files()` di [clip_downloader.py](file:///d:/projects/clipping/mobile/scripts/utils/clip_downloader.py) untuk memastikan file temporary (`.temp.mp4` dan `.part`) 100% langsung dihapus secara otomatis baik saat selesai maupun jika terjadi kegagalan.
- **Perubahan Kode Penting**:
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - Menambahkan fungsi `formatTimeForFilename(seconds)` dan `getClipFilename(start, end)`.
    - Memperbarui `getClipOutputFilePath` dan `getClipInternalOutputFilePath` menggunakan `getClipFilename`.
    - Memperbarui `resolvePlayableClipUri` untuk mendeteksi format baru terlebih dahulu sebelum fallback format lama.
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Mengimpor `getClipFilename` dan `formatTimeForFilename`.
    - Memperbarui pemindaian file lokal pada `loadData()` agar mencocokkan nama file format baru `<start> - <end>.mp4`.
  - [mobile/scripts/utils/clip_downloader.py](file:///d:/projects/clipping/mobile/scripts/utils/clip_downloader.py):
    - Menambahkan `cleanup_temp_files()` dan memanggilnya di inisialisasi, saat kegagalan tahap 1, dan blok `finally` tahap 2.

## [fe8f32c] - Implement 2-Stage Keyframe Expanded Copy and Offline FFmpeg Cut for Clip Downloader
- **Konteks Struktural**:
  1. Merombak total [clip_downloader.py](file:///d:/projects/clipping/mobile/scripts/utils/clip_downloader.py) dari awal menjadi pipeline 2-tahap yang mandiri dan bebas dari ketergantungan server proxy HTTP lokal:
     - **Tahap 1**: Mengunduh segmen video sementara (*temporary file*) dengan metode copy cepat (`-c copy` pada keyframe terdekat) menggunakan rentang waktu yang diperluas (dimundurkan 5 detik dan dimajukan 5 detik) agar keyframe utuh tidak terpotong.
     - **Tahap 2**: Melakukan pemotongan presisi berbasis frame (*frame-accurate*) dan ultrafast re-encode menggunakan FFmpeg secara offline dari file sementara lokal ke lokasi penyimpanan akhir yang ditentukan oleh frontend (`output_path`).
     - **Tahap 3**: Membersihkan file sementara secara otomatis dan mengembalikan URL stream (Google Video link yang aktif/diperbarui) ke frontend untuk di-cache.
  2. Meneruskan raw error dan traceback 100% utuh tanpa pengurangan format beserta standardized error code (`VIDEO_ID_REQUIRED`, `OUTPUT_PATH_REQUIRED`, `INVALID_RANGE`, `FFMPEG_CUT_ERROR`, `RATE_LIMIT_EXCEEDED`, dll.).
  3. Memperbarui [api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts) untuk memprioritaskan ekstraksi error code dari `payload` Python runner dan menambahkan deskripsi error baru pada kamus `API_ERROR_MAP`.
  4. Sepenuhnya mematuhi Rule 22: Pengeditan skrip Python difokuskan 100% pada direktori sumber tunggal di [mobile/scripts/utils/](file:///d:/projects/clipping/mobile/scripts/utils/).
- **Perubahan Kode Penting**:
  - [mobile/scripts/utils/clip_downloader.py](file:///d:/projects/clipping/mobile/scripts/utils/clip_downloader.py):
    - Mengganti seluruh implementasi lama dengan fungsi modular `download_clip_direct` berbasis 2-tahap (yt-dlp range copy + offline FFmpeg re-encode).
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - Menambahkan kode error `OUTPUT_PATH_REQUIRED` dan `FFMPEG_CUT_ERROR` pada `API_ERROR_MAP`.
    - Memprioritaskan `payload?.code` saat menangkap kegagalan download klip.

## [846f8e6] - Enforce Single Source of Truth for Python Scripts and Add Rule 22
- **Konteks Struktural**:
  1. Menetapkan alur kerja terpusat (*single source of truth*) untuk pengembangan skrip Python (di `mobile/scripts/utils/`), sehingga tidak lagi melakukan duplikasi atau modifikasi paralel ke folder modul internal (`modules/python-runner/android/src/main/python/`) maupun `mobile_api/` selama iterasi aktif.
  2. Sinkronisasi penuh ke folder modul *native* untuk kebutuhan bundling APK hanya akan dilakukan saat ada konfirmasi eksplisit kesiapan build dari pengguna.
  3. Menambahkan Rule 22 ke [GEMINI.md](file:///d:/projects/clipping/GEMINI.md).
- **Perubahan Kode Penting**:
  - [GEMINI.md](file:///d:/projects/clipping/GEMINI.md):
    - Menambahkan Rule 22 terkait larangan duplikasi multi-direktori pada skrip Python dan kewajiban menjaga satu direktori sumber utama terpusat.

## [178ee1a] - Eliminate Redundant Error Alert Dialogs in Favor of Soft Debug Toasts
- **Konteks Struktural**:
  1. Mengeliminasi penggunaan dialog modal `Alert.alert` bawaan pada skenario error di [Dashboard.tsx](file:///d:/projects/clipping/mobile/src/components/Dashboard.tsx) dan [FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx) untuk mencegah notifikasi ganda (*double alert*) dan tampilan antarmuka yang mengganggu.
  2. Memusatkan seluruh notifikasi error, peringatan, dan kegagalan ekstraksi heatmap secara eksklusif melalui [ToastManager](file:///d:/projects/clipping/mobile/src/components/Toast.tsx), di mana pengguna tetap dapat mengakses log debug lengkap 100% mentah melalui tombol ikon kode `<Code2>`.
  3. Mempertahankan dialog konfirmasi `Alert.alert` hanya untuk aksi destruktif yang memerlukan konfirmasi pengguna (`handleDeleteWorkshop`).
- **Perubahan Kode Penting**:
  - [mobile/src/components/Dashboard.tsx](file:///d:/projects/clipping/mobile/src/components/Dashboard.tsx):
    - Menghapus panggilan `Alert.alert('Gagal Membuka Workshop', ...)` pada blok catch `handleExtractHeatmap`.
    - Menghapus panggilan `Alert.alert('Tidak Dapat Masuk ke Kamar', ...)` pada blok catch `handleOpenExisting`.
    - Mengganti peringatan `Alert.alert` pada `handleBulkWA` dan `handleImportJSON` menjadi `ToastManager.show`.
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Mengganti `Alert.alert('Gagal Membuka Workshop', err.message)` pada blok catch `loadData` menjadi `ToastManager.show` dan menghapus impor `Alert`.

## [70cbc6e] - Unwrap Nested Python Runner Payload and Bypass Expo Sandbox via Python Storage Verifier
- **Konteks Struktural**:
  1. Memperbaiki *false error* pada ekstraksi YouTube heatmap di mana respons sukses dari Python (`extract_heatmap_data`) terbungkus ganda oleh generic runner `{ status: "success", data: { ... } }`, menyebabkan `fetchHeatmap` gagal membaca array `heatmap` di level root objek.
  2. Mengimplementasikan mekanisme *automatic unwrapping* di [index.ts](file:///d:/projects/clipping/mobile/modules/python-runner/index.ts) (`executePythonScript`) dan secara defensif di [api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts) (`fetchHeatmap`, `fetchStreamUrl`, `downloadClip`).
  3. Memecahkan error `ExponentFileSystem.makeDirectoryAsync isn't writable` pada pengujian shared storage dengan mengalihkan pembuatan direktori fisik dan uji tulis/baca `hello.txt` ke fungsi Python native [verify_storage](file:///d:/projects/clipping/mobile/scripts/utils/file_utils.py) di [storageConfig.ts](file:///d:/projects/clipping/mobile/src/services/storageConfig.ts), sehingga 100% membypass restriksi sandbox Expo FileSystem.
  4. Menambahkan Rule 21 ke [GEMINI.md](file:///d:/projects/clipping/GEMINI.md).
- **Perubahan Kode Penting**:
  - [mobile/modules/python-runner/index.ts](file:///d:/projects/clipping/mobile/modules/python-runner/index.ts):
    - Otomatis melakukan unwrapping jika respons terbungkus dalam `parsed.status === 'success' && parsed.data`.
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - Mengurai `payload` dari `data?.data || data` pada `fetchHeatmap`, `fetchStreamUrl`, dan `downloadClip`.
  - [mobile/scripts/utils/file_utils.py](file:///d:/projects/clipping/mobile/scripts/utils/file_utils.py) & [mobile_api/utils/file_utils.py](file:///d:/projects/clipping/mobile_api/utils/file_utils.py):
    - Menambahkan fungsi `verify_storage` berbasis kernel syscall OS (melewati `os.makedirs`, `open(..., 'w')`, dan `open(..., 'r')`).
  - [mobile/src/services/storageConfig.ts](file:///d:/projects/clipping/mobile/src/services/storageConfig.ts):
    - Memanggil `utils.file_utils.verify_storage` saat berjalan di platform Android dengan engine Python aktif.

## [26a84b3] - Penangkapan Error 100% Mentah ke Modal Debug Toast dan Perbaikan Tampilan Verifikasi Storage
- **Konteks Struktural**:
  1. Memastikan seluruh fungsi pemanggil skrip Python di [api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts) (`fetchHeatmap`, `fetchStreamUrl`, `downloadClip`) dan [index.ts](file:///d:/projects/clipping/mobile/modules/python-runner/index.ts) (`executePythonScript`) mempertahankan dan meneruskan pesan error mentah serta full traceback 100% tanpa filtering ke objek `ApiError` dan `ToastManager`.
  2. Memperbarui [Toast.tsx](file:///d:/projects/clipping/mobile/src/components/Toast.tsx) agar ikon kode debug `<Code2>` selalu tampil pada setiap notifikasi error, dengan modal debug yang menampilkan traceback mentah secara utuh dan mudah disalin.
  3. Memperbaiki tampilan notifikasi kegagalan verifikasi storage di [StorageConfigSection.tsx](file:///d:/projects/clipping/mobile/src/components/StorageConfigSection.tsx) agar ringkas dan rapi (tidak memanjang ke bawah), serta mengalirkan seluruh pesan Java IOException ke Modal Debug Error.
  4. Menyematkan cuplikan detail error pada alert di [Dashboard.tsx](file:///d:/projects/clipping/mobile/src/components/Dashboard.tsx) agar pengguna dapat langsung membaca dan menyalin penyebab error secara transparan.
- **Perubahan Kode Penting**:
  - [mobile/src/components/Toast.tsx](file:///d:/projects/clipping/mobile/src/components/Toast.tsx):
    - Mengaktifkan tombol debug modal untuk setiap toast bertipe `error`.
    - Menyediakan fallback `rawError` otomatis ke `toast.message`.
  - [mobile/src/components/StorageConfigSection.tsx](file:///d:/projects/clipping/mobile/src/components/StorageConfigSection.tsx):
    - Meringkas pesan toast dan menyalurkan `result.traceback || result.error` ke `rawError`.
  - [mobile/src/services/storageConfig.ts](file:///d:/projects/clipping/mobile/src/services/storageConfig.ts):
    - Mengisi field `error` dan `traceback` pada interface `StorageVerificationResult`.
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - Memastikan `data.traceback || data.error` selalu diteruskan ke `ApiError` pada `fetchHeatmap` dan `fetchStreamUrl`.
  - [mobile/modules/python-runner/index.ts](file:///d:/projects/clipping/mobile/modules/python-runner/index.ts):
    - Membungkus pemanggilan native `executeScript` dengan try-catch terstruktur yang mengembalikan stack trace.
  - [mobile/src/components/Dashboard.tsx](file:///d:/projects/clipping/mobile/src/components/Dashboard.tsx):
    - Menambahkan cuplikan detail error pada `Alert.alert` dan meningkatkan durasi toast.

## [f214ba8] - Migrasi Impor FileSystem ke expo-file-system/legacy di storageConfig.ts
- **Konteks Struktural**:
  1. Memperbarui impor `FileSystem` di [mobile/src/services/storageConfig.ts](file:///d:/projects/clipping/mobile/src/services/storageConfig.ts) menjadi `expo-file-system/legacy` agar selaras dengan file lainnya ([storage.ts](file:///d:/projects/clipping/mobile/src/services/storage.ts), [api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts), dan [FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx)).
  2. Mengeliminasi deprecation warning Expo SDK 54 (`Method getInfoAsync imported from "expo-file-system" is deprecated`).
- **Perubahan Kode Penting**:
  - [mobile/src/services/storageConfig.ts](file:///d:/projects/clipping/mobile/src/services/storageConfig.ts):
    - Mengganti `import * as FileSystem from 'expo-file-system'` menjadi `import * as FileSystem from 'expo-file-system/legacy'`.

## [f1d8cfb] - Penyesuaian pingServer untuk Runtime Native Chaquopy Tanpa HTTP Server
- **Konteks Struktural**:
  1. Menyelaraskan fungsi `pingServer()` di [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts) agar memprioritaskan deteksi runtime native `isPythonInitialized()` dan status binary FFmpeg native (`getNativeRunnerInfo()`) tanpa memaksakan panggilan HTTP ke port 8080 yang sudah dieliminasi.
  2. Mencegah munculnya false alarm "Server Python Offline" pada startup aplikasi di build APK native, sekaligus tetap mempertahankan fallback ke port 3006 untuk pengujian lokal di Termux/PC.
- **Perubahan Kode Penting**:
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - Memeriksa `Platform.OS === 'android' && isPythonInitialized()`. Jika true, memicu `setupPythonPaths` dan mengembalikan status OK (port 0) beserta info ketersediaan `libffmpeg.so`.

## [75cc477] - Pemindahan Skrip Utilitas Python ke Folder mobile/scripts Demi Arsitektur Zero-Bundle
- **Konteks Struktural**:
  1. Memindahkan seluruh skrip utilitas bisnis (`utils/` dan `cookies.txt`) dari folder Android native bundle [mobile/modules/python-runner/android/src/main/python/](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/) ke [mobile/scripts/utils/](file:///d:/projects/clipping/mobile/scripts/utils/).
  2. Memastikan APK hasil build 100% bebas dari skrip logika bisnis (zero-bundle) dan hanya menyisakan interpreter CPython (Chaquopy), `libffmpeg.so`, serta satu file jembatan generik [runner.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/runner.py).
  3. Memungkinkan pembaruan skrip Python secara instan di perangkat fisik melalui `git pull` tanpa perlu melakukan rebuild atau re-bundle APK. File skrip di `mobile/scripts` dapat langsung disinkronkan ke shared storage menggunakan helper script [mobile/scripts/sync.sh](file:///d:/projects/clipping/mobile/scripts/sync.sh).
  4. Menyempurnakan [runner.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/runner.py) dengan fitur fallback modul dinamis (`utils.<modul>` <-> `<modul>`) dan pendaftaran otomatis subfolder `scripts/utils` ke `sys.path`.
- **Perubahan Kode Penting**:
  - [mobile/modules/python-runner/android/src/main/python/runner.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/runner.py):
    - Mendaftarkan subfolder `utils` di dalam `scripts_dir` ke `sys.path`.
    - Menambahkan mekanisme fallback resolusi modul antara format `utils.<modul>` dan `<modul>`.
  - [mobile/modules/python-runner/android/src/main/python/utils/](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/utils/):
    - Dihapus total dari bundle Android untuk menjamin 0% business logic di dalam APK.
  - [mobile/scripts/utils/](file:///d:/projects/clipping/mobile/scripts/utils/):
    - Dibuat sebagai direktori penampung skrip utilitas Python di level repository (tidak terkena bundle APK oleh Gradle/Chaquopy).
  - [mobile/scripts/sync.sh](file:///d:/projects/clipping/mobile/scripts/sync.sh):
    - Dibuat sebagai helper script untuk menyalin file skrip ke shared storage perangkat saat `git pull`.
  - [mobile_api/utils/rate_limiter.py](file:///d:/projects/clipping/mobile_api/utils/rate_limiter.py):
    - Menyelaraskan error handling penyimpanan timestamp rate limit.

## [5a40a9c] - Migrasi Pemanggilan Ekstraksi Stream, Heatmap, dan Unduhan Klip ke Skrip Python Langsung
- **Konteks Struktural**:
  1. Mengalihkan seluruh alur pemanggilan fitur utama (`fetchStreamUrl`, `fetchHeatmap`, dan `downloadClip`) di [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts) dari yang sebelumnya menggunakan HTTP `fetch()` ke port lokal 8080 menjadi eksekusi langsung ke engine Python melalui `executePythonScript` (JSI/Chaquopy bridge).
  2. Mengeliminasi seluruh kerentanan *Connection Aborted / Network Timeout* akibat pembatasan waktu HTTP perantara, sekaligus mempertahankan format respons terstruktur (`status`, `stream_url`, `heatmap`, `title`), kode error terstandarisasi, dan pesan error mentah lengkap (sesuai Rule 12 & Rule 19).
  3. Memperbarui modul [stream_extractor.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/utils/stream_extractor.py), [heatmap.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/utils/heatmap.py), dan [clip_downloader.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/utils/clip_downloader.py) (beserta versi `mobile_api/utils/` agar 100% selaras sesuai Rule 6) dengan wrapper fungsi skrip murni (`extract_stream_url`, `extract_heatmap_data`, dan `download_clip_direct`) yang mengembalikan dictionary terstruktur.
  4. Menambahkan sinkronisasi otomatis via `FileSystem.copyAsync` di [api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts) setelah pengunduhan klip selesai, menjamin file klip selalu hadir di shared storage luar (`/storage/emulated/0/clipping/output/<videoId>/`).
- **Perubahan Kode Penting**:
  - [mobile/modules/python-runner/android/src/main/python/utils/stream_extractor.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/utils/stream_extractor.py) & [mobile_api/utils/stream_extractor.py](file:///d:/projects/clipping/mobile_api/utils/stream_extractor.py):
    - Menambahkan fungsi `extract_stream_url`.
  - [mobile/modules/python-runner/android/src/main/python/utils/heatmap.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/utils/heatmap.py) & [mobile_api/utils/heatmap.py](file:///d:/projects/clipping/mobile_api/utils/heatmap.py):
    - Menambahkan fungsi `extract_heatmap_data`.
  - [mobile/modules/python-runner/android/src/main/python/utils/clip_downloader.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/utils/clip_downloader.py) & [mobile_api/utils/clip_downloader.py](file:///d:/projects/clipping/mobile_api/utils/clip_downloader.py):
    - Menambahkan fungsi `download_clip_direct`.
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - Mengalihkan `fetchStreamUrl`, `fetchHeatmap`, dan `downloadClip` ke `executePythonScript` dengan fallback dev Termux.
    - Menambahkan auto-copy ke shared storage saat download klip berhasil.

## [45eff1b] - Konfigurasi Dinamis Root Shared Storage dan Verifikasi Fisik Read/Write (hello.txt)
- **Konteks Struktural**:
  1. Mengimplementasikan konfigurasi dinamis untuk lokasi direktori root shared storage (default: `/storage/emulated/0/clipping`) yang tersimpan di `LocalStorage` dan dapat disesuaikan secara bebas untuk berbagai perangkat Android yang berbeda.
  2. Menyediakan modul [storageConfig.ts](file:///d:/projects/clipping/mobile/src/services/storageConfig.ts) yang mengelola struktur direktori standar (`/output`, `/scripts`, `/libs`, `/cookies.txt`) serta mengintegrasikan fungsi verifikasi disk fisik `verifyAndInitializeStorage`.
  3. Memastikan verifikasi hak akses penyimpanan dilakukan secara nyata ke disk: menulis file `hello.txt` ke shared storage, membaca ulang fisik langsung dari filesystem tanpa cache RAM, serta membandingkan konten untuk memastikan izin baca & tulis 100% aktif.
  4. Menambahkan komponen UI [StorageConfigSection.tsx](file:///d:/projects/clipping/mobile/src/components/StorageConfigSection.tsx) di [Dashboard.tsx](file:///d:/projects/clipping/mobile/src/components/Dashboard.tsx) yang menampilkan status verifikasi disk, jalur penyimpanan aktif, dan tombol uji/ubah jalur.
- **Perubahan Kode Penting**:
  - [mobile/src/services/storageConfig.ts](file:///d:/projects/clipping/mobile/src/services/storageConfig.ts):
    - Dibuat baru dengan fungsi `getStorageRootPath`, `setStorageRootPath`, `getStorageStructure`, dan `verifyAndInitializeStorage`.
  - [mobile/src/components/StorageConfigSection.tsx](file:///d:/projects/clipping/mobile/src/components/StorageConfigSection.tsx):
    - Komponen UI untuk konfigurasi jalur root dan indikator status verifikasi fisik `hello.txt`.
  - [mobile/src/components/Dashboard.tsx](file:///d:/projects/clipping/mobile/src/components/Dashboard.tsx):
    - Memasang `<StorageConfigSection />` di bawah header Dashboard.
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - Menyelaraskan `SHARED_CLIPPING_ROOT` dan `SHARED_CLIPPING_OUTPUT_DIR` agar dinamis mengikuti konfigurasi storage.

## [c4bd9fb] - Penegasan Izin Akses Penyimpanan File Penuh (MANAGE_EXTERNAL_STORAGE) dan Modal Interaktif
- **Konteks Struktural**:
  1. Menegaskan verifikasi dan permintaan izin `MANAGE_EXTERNAL_STORAGE` (All Files Access) langsung dari sistem native Android (Kotlin) menggunakan `Environment.isExternalStorageManager()`.
  2. Menyediakan built-in native function `checkStoragePermission` dan `requestStoragePermission` di [PythonRunnerModule.kt](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/java/expo/modules/pythonrunner/PythonRunnerModule.kt) yang secara otomatis membuka layar pengaturan sistem Android "Special App Access -> All Files Access" dengan filter package aplikasi saat izin belum aktif.
  3. Mengimplementasikan [StoragePermissionModal.tsx](file:///d:/projects/clipping/mobile/src/components/StoragePermissionModal.tsx) yang memantau siklus hidup aplikasi (`AppState`), mendeteksi status izin saat pertama kali dibuka, dan otomatis tertutup ketika izin telah berhasil diberikan oleh pengguna.
- **Perubahan Kode Penting**:
  - [mobile/modules/python-runner/android/src/main/java/expo/modules/pythonrunner/PythonRunnerModule.kt](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/java/expo/modules/pythonrunner/PythonRunnerModule.kt):
    - Menambahkan `Function("checkStoragePermission")` dan `Function("requestStoragePermission")`.
  - [mobile/modules/python-runner/index.ts](file:///d:/projects/clipping/mobile/modules/python-runner/index.ts):
    - Mengekspor `checkStoragePermission()` dan `requestStoragePermission()`.
  - [mobile/src/components/StoragePermissionModal.tsx](file:///d:/projects/clipping/mobile/src/components/StoragePermissionModal.tsx):
    - Komponen modal reaktif untuk meminta izin penyimpanan saat aplikasi startup.
  - [mobile/src/app/index.tsx](file:///d:/projects/clipping/mobile/src/app/index.tsx):
    - Memasang `<StoragePermissionModal />` di root view aplikasi.

## [b2d7d94] - Clean Up Total Server Flask Menjadi Runner Skrip Python Mandiri
- **Konteks Struktural**:
  1. Membersihkan total arsitektur server Flask lokal (`server.py`) dan dependensi `flask` dari [mobile/modules/python-runner/android/build.gradle](file:///d:/projects/clipping/mobile/modules/python-runner/android/build.gradle). Mengeliminasi seluruh endpoint HTTP lokal, overhead port 8080, serta masalah connection timeout/aborted.
  2. Menyisakan hanya bundle binary statis ARM64 FFmpeg (`libffmpeg.so` 17.7 MB dengan 154 encoder lengkap) dan interpreter CPython Chaquopy di dalam APK.
  3. Mengimplementasikan [runner.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/runner.py) sebagai eksekutor skrip dinamis non-server yang mengarahkan `sys.path` ke shared storage luar (`/storage/emulated/0/clipping/scripts` dan `/libs`), sehingga logika skrip dan library Python dapat di-update kapan saja tanpa perlu me-rebuild APK.
  4. Memperbarui [PythonRunnerModule.kt](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/java/expo/modules/pythonrunner/PythonRunnerModule.kt) dan [index.ts](file:///d:/projects/clipping/mobile/modules/python-runner/index.ts) dengan native methods `setupPaths` dan `executeScript` (asynchronous background execution) menggantikan `startServerInternal`.
- **Perubahan Kode Penting**:
  - [mobile/modules/python-runner/android/build.gradle](file:///d:/projects/clipping/mobile/modules/python-runner/android/build.gradle): Menghapus instalasi paket pip `flask`.
  - `mobile/modules/python-runner/android/src/main/python/server.py`: Dihapus secara permanen.
  - `mobile/modules/python-runner/android/src/main/python/api/`: Dihapus secara permanen.
  - [mobile/modules/python-runner/android/src/main/python/runner.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/runner.py): Dibuat baru dengan fungsi `setup_paths` dan `execute_function`.
  - [mobile/modules/python-runner/android/src/main/java/expo/modules/pythonrunner/PythonRunnerModule.kt](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/java/expo/modules/pythonrunner/PythonRunnerModule.kt): Mengganti lifecycle server Flask dengan `AsyncFunction("executeScript")` dan `Function("setupPaths")`.
  - [mobile/modules/python-runner/index.ts](file:///d:/projects/clipping/mobile/modules/python-runner/index.ts): Menghapus `startPythonServer` dan mengekspor `setupPythonPaths` serta `executePythonScript`.
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts): Menyelaraskan impor modul `python-runner`.
- **Konteks Struktural**:
  1. Mengatasi error `HTTP error 403 FORBIDDEN` saat internal FFmpeg mengakses endpoint `/api/proxy_stream`. Error ini terjadi karena Google Video CDN memeriksa konsistensi antara User-Agent request dengan player client YouTube (misal `c=VISIONOS`). Sebelumnya, [server.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/server.py) menggunakan hardcoded User-Agent Chrome 128 yang tidak cocok dengan format streaming VisionOS/iOS.
  2. Memperbarui [clip_downloader.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/utils/clip_downloader.py) agar mengekstrak User-Agent asli dari `format.get('http_headers')` dan meneruskannya sebagai parameter query `&ua=...` ke proxy stream.
  3. Memperbarui [server.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/server.py) dan [mobile_api/main.py](file:///d:/projects/clipping/mobile_api/main.py) untuk menyuntikkan User-Agent dinamis tersebut beserta header peramban (`Accept`, `Accept-Language`, `Sec-Fetch-Mode`) ke session request Google Video CDN.
- **Perubahan Kode Penting**:
  - [mobile/modules/python-runner/android/src/main/python/server.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/server.py) & [mobile_api/main.py](file:///d:/projects/clipping/mobile_api/main.py):
    - `proxy_stream`: Mengambil parameter `ua` dinamis dan menambahkan header browser modern.
  - [mobile/modules/python-runner/android/src/main/python/utils/clip_downloader.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/utils/clip_downloader.py) & [mobile_api/utils/clip_downloader.py](file:///d:/projects/clipping/mobile_api/utils/clip_downloader.py):
    - Menyuntikkan parameter `&ua=...` dari masing-masing format ke `v_in`, `a_in`, dan `prog_in`.

## [57bec01] - Resolusi EPERM Scoped Storage (Exit Code 1) via Fallback Internal Sandbox dan Registrasi MediaStore
- **Konteks Struktural**:
  1. Mengatasi error `Operation not permitted` (EPERM / Exit code 1) pada Android 11+ saat FFmpeg mencoba membuka file tujuan di root shared storage (`/storage/emulated/0/clipping/output/...`). Kebijakan Scoped Storage Android melarang penulisan langsung via POSIX API (`open()`) ke folder arbitrary di luar folder aplikasi tanpa izin `MANAGE_EXTERNAL_STORAGE`.
  2. Memperluas deteksi izin penyimpanan di [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts) agar mengenali pesan `operation not permitted`, `not permitted`, dan `errno 1`, sehingga pipeline pengunduhan otomatis dan mulus beralih ke Candidate 2 (`INTERNAL_CLIPPING_OUTPUT_DIR`) di `/data/user/0/com.clipping.app/files/clipping/output/...`.
  3. Mengintegrasikan `expo-media-library` pada siklus sukses pengunduhan klip untuk mendaftarkan video ke MediaStore sistem Android (`MediaLibrary.createAssetAsync`), sehingga klip tetap tersimpan di galeri publik perangkat (sesuai Rule 20).
  4. Menambahkan izin `android.permission.MANAGE_EXTERNAL_STORAGE` pada [mobile/app.json](file:///d:/projects/clipping/mobile/app.json) untuk mendukung akses penuh shared storage pada build masa depan.
- **Perubahan Kode Penting**:
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - `isRateLimitOrRestrictedError`: Mengecualikan error `operation not permitted` dan `errno 1` agar tidak salah diklasifikasikan sebagai limit YouTube.
    - `downloadClip`: Mengaktifkan fallback otomatis ke sandbox internal saat shared path mengembalikan `operation not permitted`, dan menyinkronkan aset video yang selesai ke MediaLibrary.
  - [mobile/src/components/Toast.tsx](file:///d:/projects/clipping/mobile/src/components/Toast.tsx):
    - Memperluas tombol "Buka Pengaturan HP" agar muncul saat terjadi error `operation not permitted`.
  - [mobile/app.json](file:///d:/projects/clipping/mobile/app.json):
    - Menambahkan `android.permission.MANAGE_EXTERNAL_STORAGE` ke daftar permissions Android.

## [1fc4d44] - Bundle Binary Statis FFmpeg Lengkap (GPL libx264 & AAC Encoders) untuk Re-encode Presisi
- **Konteks Struktural**:
  1. Mengatasi akar penyebab fatal error `Unrecognized option 'preset'` (Exit code 8 / `AVERROR_OPTION_NOT_FOUND`) pada Android. Binary FFmpeg sebelumnya (`hzw1199/Android-FFmpeg-Prebuilt`) dikompilasi dengan konfigurasi minimal decoder-only (`--disable-encoders`), sehingga tidak memiliki satu pun video/audio encoder aktif (`libx264_encoder: False`, `aac_encoder: False`). Ketika pipeline klip mengeksekusi re-encode dengan opsi encoder x264 (`-preset ultrafast`), parser FFmpeg gagal mengenali flag tersebut dan langsung menghentikan proses.
  2. Mengganti binary `mobile/modules/python-runner/android/src/main/jniLibs/arm64-v8a/libffmpeg.so` dengan build statis ARM64 penuh (`Khang-NT/ffmpeg-binary-android`) yang dilengkapi 154 encoder bawaan, termasuk encoder `libx264`, `aac`, `opus`, dan `flac` serta dukungan penuh untuk argumen preset encoding (`ultrafast`, `fast`, `medium`, dll.).
  3. Memastikan konfigurasi fallback encoder di [clip_downloader.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/utils/clip_downloader.py) selaras dengan konfigurasi re-encode frontend dan `mobile_api`, yaitu menggunakan `-c:v libx264 -preset ultrafast -c:a aac -avoid_negative_ts make_zero`.
- **Perubahan Kode Penting**:
  - `mobile/modules/python-runner/android/src/main/jniLibs/arm64-v8a/libffmpeg.so`:
    - Mengganti binary decoder-only lama (15.5 MB) dengan binary statis GPL penuh berukuran 17.7 MB yang memuat 154 encoder lengkap termasuk `ff_libx264_encoder` dan `ff_aac_encoder`.
  - [mobile/modules/python-runner/android/src/main/python/utils/clip_downloader.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/utils/clip_downloader.py):
    - `encoder_args`: Menyelaraskan fallback default dari `-c:v h264_mediacodec` menjadi `-c:v libx264 -preset ultrafast` agar konsisten dengan `mobile_api` dan frontend options.

## [a135a50] - Eliminasi Total Konstanta Mati FFMPEG_FIXED_CONFIG (Pembersihan Artefak Copy)
- **Konteks Struktural**:
  1. Menghapus total konstanta mati `FFMPEG_FIXED_CONFIG` dari [mobile/src/constants/ytdlp.ts](file:///d:/projects/clipping/mobile/src/constants/ytdlp.ts). Konstanta ini merupakan artefak sisa lama dari commit awal (`13fa2a0`) yang berisi `videoCodec: 'copy'` dan tidak pernah diimpor maupun digunakan di bagian mana pun dalam aplikasi.
  2. Memastikan seluruh konfigurasi dan pipeline klip 100% steril dari referensi stream copy (`-c copy`), menegaskan bahwa satu-satunya konfigurasi aktif adalah `PRIME_CLIP_DOWNLOAD_OPTS` dengan re-encode penuh `libx264` + `aac`.
- **Perubahan Kode Penting**:
  - [mobile/src/constants/ytdlp.ts](file:///d:/projects/clipping/mobile/src/constants/ytdlp.ts):
    - Menghapus deklarasi konstanta `FFMPEG_FIXED_CONFIG`.

## [30d157b] - Penegakan Re-encode Presisi Frame-by-Frame, Konversi Otomatis AAC dan Sinkronisasi PTS
- **Konteks Struktural**:
  1. Menjamin metode pemotongan klip 100% menggunakan re-encode penuh (`libx264`/`h264_mediacodec` + `aac`) dan bukan stream copy (`-c copy`). Stream copy pada video YouTube DASH hanya memotong pada Keyframe (I-frame) yang berjarak tiap 2-5 detik sehingga tidak presisi. Dengan re-encode, pemotongan dilakukan pada tingkat frame/milidetik yang akurat sesuai target crop pengguna.
  2. Menambahkan jaminan otomatis pada [clip_downloader.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/utils/clip_downloader.py) dan [mobile_api/utils/clip_downloader.py](file:///d:/projects/clipping/mobile_api/utils/clip_downloader.py) agar selalu menyertakan `-c:a aac` (mengonversi stream audio Opus/WebM menjadi AAC yang kompatibel dengan kontainer MP4) dan `-avoid_negative_ts make_zero` (menghindari PTS negatif sehingga video dan audio mulai tepat pada timestamp 00:00:00.000 tanpa jeda atau desinkronisasi).
  3. Memperbarui `PRIME_CLIP_DOWNLOAD_OPTS` di [mobile/src/constants/ytdlp.ts](file:///d:/projects/clipping/mobile/src/constants/ytdlp.ts) untuk secara eksplisit mengirimkan argumen `-c:a aac` dan `-avoid_negative_ts make_zero` dari frontend ke backend.
- **Perubahan Kode Penting**:
  - [mobile/modules/python-runner/android/src/main/python/utils/clip_downloader.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/utils/clip_downloader.py) & [mobile_api/utils/clip_downloader.py](file:///d:/projects/clipping/mobile_api/utils/clip_downloader.py):
    - Menyuntikkan fallback guard `-c:a aac` dan `-avoid_negative_ts make_zero` pada `encoder_args` jika belum disertakan frontend.
  - [mobile/src/constants/ytdlp.ts](file:///d:/projects/clipping/mobile/src/constants/ytdlp.ts):
    - `PRIME_CLIP_DOWNLOAD_OPTS`: Menambahkan `-c:a aac` dan `-avoid_negative_ts make_zero` pada `ffmpeg` options.

## [09ac5be] - Arsitektur Localhost Range Proxy FFmpeg untuk Eliminasi Exit Code 8 dan Kualitas Prime 1080p 60fps
- **Konteks Struktural**:
  1. Mengatasi fatal error `FFmpeg exited with code 8` pada platform Android. Masalah ini berakar pada YouTube CDN (Google Video) yang memblokir koneksi HTTPS langsung dari HTTP demuxer bawaan FFmpeg (`Lavf`) karena penolakan User-Agent, kegagalan negosiasi TLS/SSL cert bundle pada binary statis, serta terbuangnya header autentikasi saat YouTube melakukan HTTP 302 redirects.
  2. Menerapkan Arsitektur Opsi 2 (Localhost Range Proxy Downloader):
     - Membuka endpoint internal `/api/proxy_stream` pada [server.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/server.py) dan [main.py](file:///d:/projects/clipping/mobile_api/main.py).
     - Mengubah alur input FFmpeg di [clip_downloader.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/utils/clip_downloader.py) agar membaca stream melalui URL loopback lokal internal perangkat (`http://127.0.0.1:8080/api/proxy_stream?url=...`).
     - Komunikasi HTTP demuxer FFmpeg dialihkan 100% ke server Python lokal (bebas dari penolakan TLS, bot challenges, dan blokir header). Server Python menangkap request `Range: bytes=X-Y` dari FFmpeg, menyedot chunk byte spesifik dari YouTube CDN menggunakan stack `requests`/`certifi` dengan User-Agent browser lengkap serta meneruskan sesi cookies (jika tersedia), lalu mengalirkannya langsung kembali ke FFmpeg secara streaming.
     - Mode threaded (`threaded=True`) pada server Flask menjamin dua stream terpisah (DASH video 1080p dan DASH audio) dapat dibaca secara bersamaan (konkuren) tanpa deadlock.
  3. Memprioritaskan format Prime YouTube (1080p 60fps):
     - Menghitung scoring format video (`v_score`) berdasarkan tinggi (hingga 1080p), frame rate (60fps > 30fps), kontainer MP4/AVC (dekoding hardware cepat pada CPU ARM), dan bitrate (`tbr`).
     - Menghitung scoring format audio (`a_score`) untuk mendapatkan kualitas audio terbaik (`abr`, AAC/m4a).
     - Menggunakan pemotongan durasi `-t (end - start)` yang universal dan akurat frame-by-frame.
  4. Rich Logging dan Diagnosis Error Menyeluruh:
     - Mengimplementasikan `YtLogger` kustom di [clip_downloader.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/utils/clip_downloader.py) untuk menangkap seluruh baris pesan `stderr` dari proses FFmpeg dan yt-dlp.
     - Menyertakan log detail tersebut pada payload respons error sehingga pengguna dapat langsung melihat diagnosis mendalam melalui modal debug log pada frontend Toast.
- **Perubahan Kode Penting**:
  - [mobile/modules/python-runner/android/src/main/python/server.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/server.py) & [mobile_api/main.py](file:///d:/projects/clipping/mobile_api/main.py):
    - Menambahkan endpoint `/api/proxy_stream` yang menerima parameter query `url` dan `cookie_path` opsional, membaca header `Range`, dan mengalirkan chunk byte dari Google Video CDN dengan browser User-Agent.
  - [mobile/modules/python-runner/android/src/main/python/utils/clip_downloader.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/utils/clip_downloader.py) & [mobile_api/utils/clip_downloader.py](file:///d:/projects/clipping/mobile_api/utils/clip_downloader.py):
    - Menambahkan kelas `YtLogger` untuk menangkap tail log stderr yt-dlp dan FFmpeg.
    - Mengimplementasikan fungsi `try_proxy_clipping` dengan pemilihan format Prime (1080p 60fps), proxy streaming loopback, dan penangkapan detail stderr FFmpeg secara transparan.

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

