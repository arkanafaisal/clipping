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

## [Unreleased] - Bundle Python Scripts into Native Python-Runner for Standalone Production APK
- **Konteks Struktural**:
  1. Sinkronisasi Skrip Python ke Native Chaquopy Assets (`mobile/modules/python-runner/`):
     - Memenuhi kebutuhan build production maupun development APK mandiri (*standalone*) sesuai permintaan pengguna (Rule 22): seluruh modul skrip dari direktori sumber pengembangan (`mobile/scripts/utils/`) disinkronkan ke bundle internal Chaquopy di `mobile/modules/python-runner/android/src/main/python/utils/`.
     - Menyertakan skrip yang baru dikembangkan: `subtitle_burner.py` (pembakar subtitle FFmpeg dengan kalibrasi skala 0.073 dan multi-line justify center) dan `subtitle_fetcher.py` (ekstraktor transkrip subtitle YouTube).
     - Memperbarui `clip_downloader.py` di bundle internal dengan logika penyamaran klien iOS/Android untuk download full video resolusi rendah.
  2. Menjaga Fleksibilitas Hot-Reload Dev Mode:
     - Arsitektur `runner.py` tetap memprioritaskan pemuatan dari shared storage (`/storage/emulated/0/clipping/scripts/`) jika folder tersebut ada di perangkat (via `setup_paths`).
     - Dengan demikian, APK production dapat berjalan 100% mandiri tanpa dependensi shared storage, namun developer tetap dapat melakukan iterasi live-sync skrip Python secara instan tanpa perlu rebuild ulang APK saat mode dev.
- **Perubahan Kode Penting**:
  - `mobile/modules/python-runner/android/src/main/python/utils/`:
    - Menambahkan `subtitle_burner.py` dan `subtitle_fetcher.py`.
    - Menyinkronkan `clip_downloader.py` ke versi terbaru dari `mobile/scripts/utils/`.

## [866b3e7] - Calibrate Dynamic Scaling Multiplier to 0.073 for Subtitles and Context Banner
- **Konteks Struktural**:
  1. Penyesuaian Presisi Rasio Skala Subtitle & Banner Konteks (0.070 -> 0.073):
     - Kalibrasi visual lanjutan berdasarkan hasil pengujian ekspor video: rasio pengali `0.070` sebelumnya sudah mendekati sempurna, namun masih sedikit terlalu kecil (*kekecilan sedikit*).
     - Meningkatkan konstanta pengali menjadi `0.073` pada seluruh jalur rendering subtitle (`build_ass_content`, `build_drawtext_pipeline`, dan fallback `build_multi_layer_pipeline`) agar ukuran teks subtitle hasil ekspor 100% presisi dengan preview React Native.
  2. Sinkronisasi Skala Padding Vertikal Banner Konteks:
     - Mengonfirmasi dan memastikan `paddingY` pada banner konteks (`ctx_pad = max(4, int(round(base_unit * (ctx_pad_dp / 14.0))))`) terskala serasi menggunakan konstanta acuan `base_unit = ref_dim * 0.073`, sehingga ketebalan vertikal banner konteks dan ukuran fontnya beradaptasi secara proporsional dengan kanvas ekspor FFmpeg.
- **Perubahan Kode Penting**:
  - `mobile/scripts/utils/subtitle_burner.py`:
    - Mengganti konstanta rasio pengali acuan dari `0.070` menjadi `0.073` pada `build_ass_content` (`ass_base_fs`), `build_drawtext_pipeline` (`base_fs`), kalkulasi banner konteks (`base_unit`), dan drawtext fallback (`base_fs`).

## [52c5cc2] - Fix Scrubber Seeking Calculation on Local Full Video and Enable Touch Drag Scrubbing
- **Konteks Struktural**:
  1. Koreksi Perhitungan Target Waktu Seek pada Mode Full Video Lokal:
     - Mengatasi kendala di mana menahan (*hold*) atau mengetuk progress bar scrubber pada pemutaran video lokal gagal dan langsung otomatis mental/kembali ke detik 0 (awal rentang klip).
     - Akar Masalah: Pada `FeedScreen.tsx`, pengecekan mode lokal sebelumnya hanya memeriksa `currentSourceUriRef.current.startsWith('file://')`. Ketika memutar file video utuh lokal (`full_proxy.mp4` atau `full.mp4`), kondisi ini bernilai benar sehingga target seek salah dihitung secara relatif dari detik 0 (`(pct / 100) * duration`), padahal klip berada di tengah-tengah video penuh (misal detik 600 s/d 630). Nilai seek yang jauh di bawah `start` memicu loop detector di `useClipPlayer.ts` untuk langsung mengembalikan pemutar ke `currentActive.start`.
     - Solusi: Membedakan file klip hasil potong mandiri (`isIndividualCutClip`) dengan memeriksa akhiran file (`!endsWith('/full.mp4') && !endsWith('/full_video.mp4') && !endsWith('/full_proxy.mp4')`). Jika memutar full video lokal maupun stream online, target seek dihitung secara absolut (`curClip.start + (pct / 100) * duration`) sehingga seeking tetap berada di dalam rentang klip.
  2. Dukungan Geser / Dragging Halus pada Scrubber Progress Bar:
     - Mengganti pembungkus `Pressable` pada `FeedPlaybackControls.tsx` dengan responder `View` (`onStartShouldSetResponder`, `onMoveShouldSetResponder`, `onResponderGrant`, `onResponderMove`).
     - Pengguna kini dapat mengetuk langsung sekali maupun menahan dan menggeser (*drag/scrub*) progress bar secara kontinu tanpa terlepas, dengan update posisi visual instan dan debouncing 150ms pada pemutar lokal.
- **Perubahan Kode Penting**:
  - `mobile/src/components/FeedScreen.tsx`:
    - Mengoreksi `handleSeekRelative` dan `onScrubberPress` untuk menggunakan `isIndividualCutClip` alih-alih `isLocalMode` polos, mencegah salah hitung target waktu pada file full video lokal.
  - `mobile/src/components/feed/FeedPlaybackControls.tsx`:
    - Memperbarui `progressBarTrack` menggunakan responder gesture touch agar mendukung interaksi hold dan drag scrubbing.

## [2c5171d] - Comprehensive Full Workshop Export and Import with Done-Only Subtitles, Templates, and Global Configs
- **Konteks Struktural**:
  1. Penyatuan Ekspor & Impor Workshop Utuh (Device-Agnostic Migration):
     - Memperluas skema ekspor JSON pada `Dashboard.tsx` (`handleExportWorkshop` versi 2) agar tidak hanya membawa draf klip dasar, melainkan memaketkan seluruh status kamar/workshop secara utuh sehingga pengguna dapat memindahkan data ke perangkat baru tanpa kehilangan konfigurasi yang terisolasi di private internal storage.
     - Menyaring data subtitle dan template: hanya klip yang berstatus `done` (*mark as done*) yang diekspor subtitlenya (`subtitles`) dan templatenya (`templates`). Subtitle atau template milik klip non-done (pending/dismissed) secara otomatis diabaikan untuk menjaga payload tetap bersih dan efisien.
  2. Paket Konfigurasi Kamar Lengkap:
     - Mengikutsertakan konfigurasi global video/kamar (`globalConfig` dari `video_config.json`): geometri zoom/crop facecam, zoom/crop gameplay, posisi acuan subtitle kamar, dan gaya konteks banner.
     - Mengikutsertakan preferensi jumlah klip tampil (`clipping_visible_count_${videoId}`) dan status cache heatmap lengkap (`clipping_full_fetched_${videoId}`) agar perangkat baru tidak melakukan fetch ulang ke server YouTube yang berisiko terkena limit.
  3. Pemulihan Otomatis (*Reverse Writing*) ke File System & LocalStorage Saat Impor:
     - Memperbarui `handleImportJSON` agar mengenali skema versi 2 maupun backward-compatible dengan format lama.
     - Otomatis menulis ulang file-file subtitle (`saveClipSubtitle`) dan template (`saveClipTemplate`) ke dalam private storage (`INTERNAL_CLIPPING_OUTPUT_DIR`) di perangkat baru, menulis `saveVideoGlobalConfig`, serta menyinkronkan `clips_draft_${videoId}` dan `workshops_list`.
  4. Penyempurnaan UX Berbagi Data (Modal Ekspor):
     - Menambahkan tombol native `Share` ("Bagikan / Salin Data JSON") pada `ExportWorkshopModal.tsx` untuk memudahkan pengguna menyalin payload atau mengirimnya via Google Drive, Bluetooth, email, dsb.
     - Menambahkan proteksi limit URL WhatsApp: jika payload JSON melebihi 1500 karakter, tombol WhatsApp secara otomatis mengarahkan ke native Share sheet agar tidak terpotong oleh batasan panjang URI browser.
- **Perubahan Kode Penting**:
  - `mobile/src/components/Dashboard.tsx`:
    - Mengimpor `loadClipSubtitle`, `saveClipSubtitle`, `loadClipTemplate`, `saveClipTemplate`, `loadVideoGlobalConfig`, dan `saveVideoGlobalConfig`.
    - Memperbarui `handleExportWorkshop` untuk memaketkan data versi 2 (done-only subtitles, templates, globalConfig, visibleCount, fullFetched).
    - Memperbarui `handleImportJSON` untuk me-restore seluruh subtitle, template, dan konfigurasi global secara rekursif ke storage internal perangkat.
  - `mobile/src/components/ExportWorkshopModal.tsx`:
    - Menambahkan tombol `Share.share` native dan menangani payload panjang untuk pengiriman WhatsApp.

## [c3957b3] - Calibrate Subtitle Scaling to 0.070, Enforce Multiline Justify Center, and Remove Auto-Wrap in Preview
- **Konteks Struktural**:
  1. Kalibrasi Ulang Skala Font & Outline Subtitle (Penurunan Skala ~15%):
     - Menurunkan konstanta pengali dimensi acuan `ref_dim` ($\min(W, H)$) dari `0.0833` menjadi `0.070` pada modul ekspor video (`subtitle_burner.py`), baik untuk naskah ASS libass maupun pipeline drawtext dan context banner.
     - Menurunkan proporsi ketebalan outline/border subtitle dari `0.075 - 0.08` menjadi `0.065`, serta mengurangi margin padding ASS dari `20px` ke `10px` agar ukuran teks hasil ekspor tepat selaras (tidak sedikit kebesaran) dengan preview UI 14dp di perangkat mobile.
  2. Implementasi Multiline Justify Center pada Pipeline Ekspor FFmpeg:
     - Mengatasi kendala teks subtitle multiline (akibat penekanan tombol Enter `\n`) yang sebelumnya berformat rata kiri (*justify start*) pada filter drawtext FFmpeg.
     - Memecah setiap cue dengan teks multiline menjadi filter drawtext mandiri per baris dengan ekspresi `x=(w-text_w)/2` untuk masing-masing baris secara independen. Setiap baris kini memiliki titik tengah horisontal sendiri (*justify center*) dan ditumpuk secara vertikal dengan jarak antar-baris proporsional (`line_h = round(final_fs * 1.35)`).
     - Mengubah konfigurasi `WrapStyle: 2` pada naskah ASS libass agar tidak melakukan auto-wrap kata dan hanya memecah baris pada tag eksplisit `\N`.
  3. Penyelarasan Preview Frontend (Penghapusan Auto Break Line):
     - Menghapus pembatasan `maxWidth: containerWidth * 0.92` pada `SubtitleOverlay.tsx` agar preview frontend tidak memaksakan auto word wrap saat teks melebihi lebar layar.
     - Merender setiap baris teks dari pemisahan `\n` menggunakan `<Text numberOfLines={1} ellipsizeMode="clip">`, sehingga teks panjang dibiarkan meluber/terpotong tanpa auto-wrap, konsisten 100% dengan mekanisme rendering FFmpeg.
- **Perubahan Kode Penting**:
  - `mobile/scripts/utils/subtitle_burner.py`:
    - Mengalibrasi `ass_base_fs` dan `base_fs` dari `ref_dim * 0.0833` menjadi `ref_dim * 0.070`.
    - Mengalibrasi `ass_outline` dan `border_w` menjadi `base_fs * 0.065`.
    - Mengatur `WrapStyle: 2` dan padding margin `10` pada header ASS.
    - Memperbarui `build_drawtext_pipeline` dan `build_multi_layer_pipeline` untuk memproses setiap baris teks `\n` sebagai item drawtext terpisah dengan `x=(w-text_w)/2` dan offset vertikal `line_y_offset`.
  - `mobile/src/components/feed/SubtitleOverlay.tsx`:
    - Memisahkan `subtitleText` berdasarkan `\n` dan merender tiap baris dengan `numberOfLines={1}` serta `ellipsizeMode="clip"`.
    - Menghapus `maxWidth: containerWidth * 0.92` dan menambahkan `lineWrapper` dengan `flexWrap: 'nowrap'` agar preview tidak auto-break.

## [9fcab51] - Direct Workshop Launch, Dual-Resolution Full Video Verification, and Resumable Partial Download
- **Konteks Struktural**:
  1. Penyatuan Alur Card Press ke Offline-First Player (Tanpa Modal):
     - Mengubah interaksi klik card workshop pada Dashboard agar langsung meluncurkan ruang editing (`handleOpenExisting(..., 'local')`) tanpa memunculkan `PlayModeModal` jika video utuh lokal terdeteksi. Karena player kini memutar file proxy 480p yang bobotnya setara dengan YouTube direct stream, modal pemilihan mode stream/lokal dihilangkan untuk menyederhanakan alur kerja pengguna.
     - Menambahkan verifikasi integritas file lokal pada `handleOpenExisting`: jika file lokal rusak/korup (ukuran $\le 1024$ byte), sistem secara otomatis melakukan fallback transparan ke `stream` online tanpa crashing, atau memunculkan notifikasi Toast dan tetap di Dashboard jika stream juga gagal.
  2. Verifikasi Keberadaan KEDUA Resolusi Video Penuh (Master & Proxy):
     - Memperbarui `checkFullVideoExists` di `mobile/src/services/api.ts` agar wajib memverifikasi keberadaan dan validitas kedua file: master 1080p (`full.mp4` / `full_video.mp4` > 1024 byte) AND proxy 480p (`full_proxy.mp4` > 1024 byte).
     - Indikator download pada card workshop kini akurat: berstatus belum download jika salah satu file tidak ada di penyimpanan bersama.
  3. Mekanisme Unduhan Hemat Bandwidth & Lanjutan Otomatis (Skip Existing & Resume):
     - Memperbarui `download_full_youtube_video` di `clip_downloader.py`:
       - Cek keberadaan file master (`master_already_exists` > 1024 byte): jika sudah ada, proses lompat langsung (`STAGE_1_COPY / MASTER_ALREADY_EXISTS`) tanpa mengunduh ulang master.
       - Cek keberadaan file proxy (`proxy_already_exists` > 1024 byte): jika sudah ada, proses lompat langsung (`STAGE_PROXY / PROXY_ALREADY_EXISTS`) tanpa mengunduh ulang proxy.
       - Menambahkan konfigurasi `"continuedl": True` pada `run_opts` dan `p_opts` yt-dlp agar proses unduhan yang terputus di tengah jalan dapat dilanjutkan langsung dari byte terakhir file `.part` (HTTP 206 Partial Content) tanpa mengulang dari 0%.
- **Perubahan Kode Penting**:
  - `mobile/src/services/api.ts`:
    - Memperbarui `checkFullVideoExists` untuk memeriksa integritas kedua file (`full.mp4` dan `full_proxy.mp4` > 1024 byte).
    - Memperbarui `resolvePlayableFullVideoUri` untuk memvalidasi `size > 1024`.
  - `mobile/src/components/Dashboard.tsx`:
    - Memperbarui `handleCardPress` untuk memprioritaskan mode `local` jika `hasFull` true, atau `stream` jika false, tanpa menampilkan modal.
    - Menambahkan logika fallback otomatis ke mode `stream` di `handleOpenExisting` apabila file video lokal terdeteksi korup.
  - `mobile/scripts/utils/clip_downloader.py`:
    - Menambahkan pengecekan `master_already_exists` dan `proxy_already_exists` guna menghindari unduhan ganda.
    - Menambahkan parameter `"continuedl": True` pada opsi yt-dlp untuk mendukung kelanjutan unduhan parsial dari file `.part`.

## [432fdec] - Fix Editor Header Container Height to 88px Across Subtitle, Template, and Default Modes
- **Konteks Struktural**:
  1. Penstabilan Hierarki Layout & Pencegahan Canvas Jumping:
     - Mengatasi kendala perubahan ukuran dinamis (*DOM height shifting*) pada header mode Editor klip yang telah selesai (done). Sebelumnya, Mode Subtitle membutuhkan ruang vertikal lebih tinggi (~88px) untuk mini timeline track dan action row, sedangkan Mode Template hanya membutuhkan 1 baris (~36px), dan Mode Default (None) runtuh menjadi 0px.
     - Perubahan tinggi header yang dinamis ini menyebabkan area video player di bawahnya (`playerContainer` dengan `flex: 1` dan kanvas portrait 9:16 `height: 100%`) ikut memanjang/memendek dan melebar/menyempit secara mendadak setiap kali pengguna berpindah mode, memicu *re-measuring* pada Android `VideoView` / `SurfaceView`.
  2. Pembungkusan Ruang Konten Editor dalam Container Tetap (88px):
     - Membungkus seluruh area Row 3 kontrol editor di dalam `editorContentContainer` dengan tinggi tetap (`height: 88`), latar belakang seragam (`#121212`), dan `overflow: hidden`.
     - Kondisi 1 (Mode Subtitle): Menampilkan mini timeline track (34px) dan action row (36px) secara pas dalam batas 88px.
     - Kondisi 2 (Mode Template): Menata baris status rasio kanvas (baris atas) dan 3 tombol aksi kustomisasi (Facecam, Konteks, Gameplay) dengan label teks yang proporsional dalam batas 88px.
     - Kondisi 3 (Mode None / Default): Menyajikan placeholder informatif non-intrusif yang mengisi ruang vertikal 88px yang sama persis sehingga ruang vertikal player stabil 100% tanpa lonjakan piksel.
- **Perubahan Kode Penting**:
  - [mobile/src/components/feed/FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx):
    - Membungkus percabangan `currentMode` di dalam `<View style={styles.editorContentContainer}>`.
    - Menambahkan `styles.editorContentContainer` (`height: 88`, `overflow: 'hidden'`).
    - Menyesuaikan `styles.subtitleLayerSection` (`height: 88`, `justifyContent: 'space-between'`).
    - Menambahkan `styles.templateLayerSection`, `styles.templateHeaderRow`, `styles.templateHintText`, `styles.templateButtonsRow`, `styles.templateActionBtn`, dan `styles.templateActionBtnText` agar mengisi 88px secara seimbang.
    - Menambahkan `styles.editorEmptyPlaceholder` dan `styles.editorEmptyPlaceholderText` untuk menjaga stabilitas ruang vertikal saat editor ditutup.

## [ccf0891] - Implement Dual-Resolution Proxy Workflow for Full Video Download and Decoupled Lightweight Playback
- **Konteks Struktural**:
  1. Arsitektur Dual-Resolution Proxy Workflow:
     - Mengatasi kendala lag pemutaran video lokal di player UI (terutama pada mode portrait 9:16 dengan 2 player aktif: gameplay 4:3 + facecam 1:1) dengan memisahkan fungsi Playback UI dari Rendering Engine (Master 1080p).
     - Menambahkan alokasi penyimpanan file proxy `full_proxy.mp4` (resolusi 480p MP4 ringan) yang diunduh berdampingan dengan file master `full.mp4` (1080p 60fps) saat pengguna mengunduh full video YouTube.
  2. Penyamaran Client iOS & Android untuk Proxy Download:
     - Menggunakan konfigurasi `PROXY_FULL_VIDEO_YTDL_OPTS` dengan `player_client: ['ios', 'android']` untuk mengunduh stream progressive 480p langsung dari YouTube tanpa memicu BotGuard / SABR challenge dan lebih aman dari rate limit (429).
  3. Pemisahan Sumber Playback UI vs Engine Pemotongan & Ekspor:
     - Player UI (`useClipPlayer.ts`):
       - Prioritas 1: Memutar `full_proxy.mp4` lokal jika video penuh sudah diunduh (untuk semua mode: clipping, mark as done, editor non-facecam, dan editor facecam). Menjamin pemutaran 100% offline, seeking instan 0ms, dan 60 FPS mulus di HP entry-level.
       - Prioritas 2 (Mode Facecam tanpa full video): Mengabsolutkan pemutaran ke `streamUrl` (480p progressive online YouTube) agar decoder GPU tidak kelebihan beban 2x video 1080p.
       - Prioritas 3 (Mode non-facecam): Memutar file klip lokal terpotong jika ada, atau fallback ke `streamUrl`.
     - Engine Pemotongan & Ekspor (`clip_downloader.py` & `subtitle_burner.py`):
       - Tetap 100% memotong klip dan merender subtitle/template dari file master `full.mp4` (1080p 60fps prime), menjaga kejernihan visual tanpa penurunan bitrate.
- **Perubahan Kode Penting**:
  - [mobile/src/constants/ytdlp.ts](file:///d:/projects/clipping/mobile/src/constants/ytdlp.ts): Menambahkan konstanta `PROXY_FULL_VIDEO_YTDL_OPTS` (`best[height<=480][ext=mp4]`, client iOS & Android).
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts): Menambahkan fungsi `getFullVideoProxyFilePath`, memperbarui `resolvePlayableFullVideoUri` untuk mengutamakan `full_proxy.mp4`, serta meneruskan opsi proxy (`proxy_output_path`, `proxy_ydl_opts`) pada fungsi `downloadFullVideo`.
  - [mobile/scripts/utils/clip_downloader.py](file:///d:/projects/clipping/mobile/scripts/utils/clip_downloader.py): Memperbarui `download_full_video_direct` agar mengunduh file proxy preview 480p (client iOS/Android) setelah unduhan master selesai.
  - [mobile_api/main.py](file:///d:/projects/clipping/mobile_api/main.py): Memperbarui endpoint `/api/download-full-video` untuk meneruskan parameter `proxy_output_path` dan `proxy_ydl_opts`.
  - [mobile/src/hooks/useClipData.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipData.ts): Mengabaikan file `full_proxy.mp4` saat pemindaian klip fisik lokal di shared storage.
  - [mobile/src/hooks/useClipPlayer.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipPlayer.ts): Mengarahkan `syncPlayerSourceForClip` untuk memprioritaskan proxy full video pada seluruh mode, memaksa stream 480p pada mode facecam saat offline master belum ada, dan menambahkan pengecekan akhiran `/full_proxy.mp4`.

## [553d7df] - Restore Subtitle, Context Template, and Facecam Editor with Portrait Canvas & Export
- **Konteks Struktural**:
  1. Pemulihan Fitur Subtitle, Template Layout, dan Editor Video:
     - Mengembalikan seluruh modul, hooks, dan antarmuka subtitle dan template yang sebelumnya dihapus pada commit `a61ae99`:
       - [mobile/src/hooks/useClipSubtitle.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipSubtitle.ts): Hook manajemen subtitle (pengambilan dari YouTube, normalisasi single-line cue, penyesuaian posisi X/Y, penambahan/penghapusan/pergeseran cue, dan ekspor video burn-in).
       - [mobile/src/hooks/useClipTemplate.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipTemplate.ts): Hook manajemen konfigurasi template (banner konteks, box facecam 4:3, zoom/crop koordinat X & Y, rasio 9:16 portrait canvas).
       - [mobile/src/components/feed/SubtitleOverlay.tsx](file:///d:/projects/clipping/mobile/src/components/feed/SubtitleOverlay.tsx): Komponen rendering subtitle dinamis di atas canvas video dengan outline stroke, background pill transparan, dan font dinamis.
       - [mobile/scripts/utils/subtitle_fetcher.py](file:///d:/projects/clipping/mobile/scripts/utils/subtitle_fetcher.py) & [mobile/scripts/utils/subtitle_burner.py](file:///d:/projects/clipping/mobile/scripts/utils/subtitle_burner.py): Skrip backend untuk ekstraksi subtitle YouTube via yt-dlp dan burn-in hardcode subtitle + template ke video via FFmpeg filter_complex.
  2. Integrasi Editor Mode & Penghapusan Preview Facecam di Clipping Mode:
     - Menghapus komponen preview facecam lama di mode clipping ([FacecamHighlightSection.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FacecamHighlightSection.tsx)) dari [FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx) sesuai instruksi pengguna, karena konfigurasi facecam telah sepenuhnya kembali ke mode Editor klip yang telah selesai (done).
     - Mengintegrasikan antarmuka [FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx):
       - Saat `activeClip.status !== 'done'`: Mempertahankan antarmuka modern clipping mode (tombol tambah rentang custom `+`, tombol pengatur jumlah klip heatmap `SlidersHorizontal`, input edit milidetik MM:SS, tombol Trash dan Done, serta baris Extend dan Crop).
       - Saat `activeClip.status === 'done'`: Menampilkan tombol Ekspor klip (`Film`) di sisi kiri jika klip terunduh, serta baris pengalih mode Editor (Subtitle dan Template) yang lengkap dengan mini timeline track, tombol aksi, dan 8 modal pengaturan interaktif.
  3. Pemulihan Multi-Viewport Portrait Canvas & Sinkronisasi Realtime:
     - Pada [FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx), ketika mode portrait aktif (`templateConfig.context.enabled || templateConfig.facecam.enabled`):
       - Merender container 9:16 portrait yang menampung:
         1. Header Banner Konteks di bagian atas.
         2. Viewport Facecam (4:3) dengan `facecamPlayer` independen (audio termute).
         3. Viewport Gameplay Utama (4:3 jika facecam aktif, 16:9 jika hanya konteks banner).
         4. `SubtitleOverlay` presisi di atas kanvas.
     - Pada [useClipPlayer.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipPlayer.ts), menghubungkan kembali `subtitlesRef` dan `setActiveSubtitleText` pada event `timeUpdate` untuk sinkronisasi teks subtitle secara realtime dengan frame pemutar video.
- **Perubahan Kode Penting**:
  - [mobile/src/constants/ytdlp.ts](file:///d:/projects/clipping/mobile/src/constants/ytdlp.ts): Menambahkan kembali konfigurasi `SUBTITLE_YTDL_OPTS` untuk ekstraksi subtitle multi-bahasa YouTube tanpa unduh video.
  - [mobile_api/main.py](file:///d:/projects/clipping/mobile_api/main.py): Mengembalikan route pass-through `POST /api/subtitles` dan `POST /api/burn-subtitles` beserta import utilitasnya.
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts): Memulihkan seluruh interface dan fungsi pendukung subtitle & template (`SubtitleCue`, `SubtitleStyle`, `ClipSubtitleData`, `ClipTemplateConfig`, `VideoGlobalConfig`, `fetchSubtitlesForVideo`, `loadClipSubtitle`, `saveClipSubtitle`, `deleteClipSubtitle`, `loadClipTemplate`, `saveClipTemplate`, `loadVideoGlobalConfig`, `saveVideoGlobalConfig`, `burnClipSubtitles`, `getSubtitledClipFilename`, `getSubtitledClipOutputFilePath`).
  - [mobile/src/hooks/useClipPlayer.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipPlayer.ts): Menghubungkan parameter `subtitlesRef` dan `setActiveSubtitleText` ke playback time listener.
  - [mobile/src/components/feed/FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx): Menggabungkan antarmuka clipping mode dengan editor switcher, mini track timeline, dan modal pengaturan template/subtitle saat klip berstatus 'done'.
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx): Mengintegrasikan hook `useClipSubtitle` dan `useClipTemplate`, merender layout kanvas 9:16 portrait, dan menghapus komponen preview facecam clipping.

## [edcbfb7] - Support Zero-Heatmap Rooms with Pure In-Memory Visual Fallback and On-Demand Extraction
- **Konteks Struktural**:
  1. Penanganan Room Video Tanpa Heatmap / Ekstraksi Heatmap Gagal:
     - Mengubah alur pembuatan room di [Dashboard.tsx](file:///d:/projects/clipping/mobile/src/components/Dashboard.tsx):
       - Menghapus kewajiban ekstraksi heatmap saat pertama kali menekan "Buat".
       - Hanya mengambil direct stream URL (`fetchStreamUrl`) agar pengguna dapat langsung menonton video saat masuk kamar, dan menginisialisasi draft klip kosong (`[]`) di storage tanpa memblokir atau melempar error.
       - Pada pembukaan workshop lama (`handleOpenExisting`), tidak lagi melempar error bila draft kosong atau heatmap tidak ada.
  2. Visual Fallback 1 Klip Murni di Tampilan (In-Memory Carousel Fallback):
     - Pada [useClipData.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipData.ts), ketika panjang klip bernilai 0 (`clips.length === 0`):
       - Menyediakan 1 klip fallback virtual (`id: 'fallback_init'`, rank: 1, rentang 0:00 - 0:15) pada `visibleClips`, `clipColumns`, dan `activeClip` agar antarmuka carousel, pemutar video, dan kontrol tidak mengalami crash.
       - **Bebas Persistensi JSON**: Klip fallback ini 100% virtual di antarmuka dan TIDAK PERNAH disimpan ke dalam file JSON draft workspace (`clips_draft_${videoId}`).
       - Begitu pengguna menambahkan klip custom (`+`) atau mengekstrak heatmap, klip fallback ini otomatis lenyap.
       - Jika pengguna berinteraksi langsung dengan tombol crop/extend, milidetik, atau tombol selesai (done) saat klip fallback aktif, aksi tersebut otomatis mengonversi rentang menjadi klip custom resmi di memori dan storage.
  3. Ekstraksi Heatmap On-Demand via Modal Jumlah Klip Heatmap:
     - Ketika pengguna membuka modal jumlah klip heatmap ([VisibleCountModal.tsx](file:///d:/projects/clipping/mobile/src/components/feed/VisibleCountModal.tsx)) dan menekan tombol "Terapkan":
       - Jika klip heatmap belum ada di workspace (`existingHeatmapClips.length === 0`), sistem secara otomatis menjalankan ekstraksi `fetchHeatmap(videoId, 100, 0)`.
       - Jika berhasil, klip heatmap digabungkan dengan klip custom yang ada, disimpan ke storage, dan visual fallback otomatis hilang.
       - Jika heatmap tidak tersedia atau gagal diekstrak, sistem menampilkan notifikasi Toast tanpa mengeluarkan pengguna dari kamar, sehingga pemotongan klip manual tetap dapat dilakukan dengan normal.
- **Perubahan Kode Penting**:
  - [mobile/src/components/Dashboard.tsx](file:///d:/projects/clipping/mobile/src/components/Dashboard.tsx):
    - `handleCreateWorkshop`: Menghapus panggilan wajib `fetchHeatmap` dan menggantinya dengan inisialisasi draft kosong (`[]`) setelah `fetchStreamUrl` berhasil.
    - `handleOpenExisting`: Mengeliminasi pengecekan throw error pada klip heatmap yang kosong, memastikan pembukaan room selalu lancar.
    - Menghapus import `fetchHeatmap` yang tidak lagi digunakan di Dashboard.
  - [mobile/src/hooks/useClipData.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipData.ts):
    - `loadData`: Mengizinkan `loadedClips` kosong tanpa melempar exception atau memanggil `onBack()`.
    - `activeClip`, `visibleClips`, `clipColumns`: Menyediakan 1 klip fallback virtual murni ketika `clips.length === 0`.
    - `handleUpdateStart`, `handleUpdateEnd`, `handleMsTimeChange`, `handleToggleDone`: Mengonversi visual fallback menjadi klip custom saat diedit atau ditandai done.
    - `handleSetVisibleHeatmapCount`: Menambahkan pengecekan on-demand untuk mengekstrak heatmap saat user menekan 'Terapkan' jika klip heatmap belum tersedia.

## [2a524f8] - Synchronize Python Engine Scripts to Embedded Native Bundle for Production and Dev Builds
- **Konteks Struktural**:
  1. Sinkronisasi Skrip Python ke Native Chaquopy Bundle:
     - Menyalin seluruh skrip Python versi terbaru dari direktori pengembangan utama ([mobile/scripts/utils/](file:///d:/projects/clipping/mobile/scripts/utils)) ke dalam bundle modul native Chaquopy ([mobile/modules/python-runner/android/src/main/python/utils/](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/utils)) menjelang persiapan build APK production dan development.
     - Memastikan seluruh modul utilitas (termasuk pemotongan offline klip cepat, batas bitrate FFmpeg 1080p 60fps, dan sinkronisasi cookies Google Drive) tersedia secara mandiri di dalam paket bundle tanpa ketergantungan file luar saat aplikasi di-install di perangkat produksi baru.
  2. Jaminan Override Skrip Folder Luar untuk Kelanjutan Mode Development:
     - Memverifikasi arsitektur resolver `setup_paths` pada `runner.py`:
       - Direktori shared storage (`/storage/emulated/0/clipping/scripts` dan `utils/`) selalu disisipkan di posisi awal (`sys.path.insert(0, ...)`).
       - Modul native akan selalu mendahulukan pembacaan skrip dari folder luar tersebut saat berjalan di mode development, sehingga pembaruan skrip di HP dapat diuji coba seketika tanpa perlu proses build ulang APK.
- **Perubahan Kode Penting**:
  - [mobile/modules/python-runner/android/src/main/python/utils/](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/utils):
    - Menyinkronkan seluruh 14 file utilitas Python ke versi mutakhir yang identik dengan direktori sumber pengembangan (`mobile/scripts/utils/`).
  - [changelog.md](file:///d:/projects/clipping/changelog.md):
    - Mendokumentasikan persiapan bundle native APK dan verifikasi override skrip shared storage.

## [2dc8877] - Compact Facecam Controls Layout and Support Direct In-Place Numeric Inputs on Tap
- **Konteks Struktural**:
  1. Penataan Ulang Ukuran Panel Kontrol Facecam Menjadi Ultra-Kompak:
     - Mengidentifikasi kendala tombol plus (`+`) pada stepper pengaturan Facecam yang terdorong keluar batas layar (*overflow/clipped*) pada layar sempit karena padding, margin, dan lebar elemen stepper yang terlalu besar di samping viewport 4:3.
     - Merestrukturisasi dimensi komponen [FacecamHighlightSection.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FacecamHighlightSection.tsx):
       - Mengurangi padding kontainer dari 12px menjadi 8px/4px, gap dari 12px menjadi 8px, dan tinggi maksimum facecam menjadi 125px.
       - Mengatur `minWidth: 0` pada panel kontrol kanan dan memangkas ukuran tombol stepper dari 20x20 menjadi 17x17 dengan ikon size 9.
       - Memperkecil total lebar baris stepper sehingga menyisakan ruang margin yang lega (~80px) dan menjamin tombol plus (`+`) selalu tampil utuh di dalam layar.
  2. Dukungan Input Angka Manual Langsung di Tempat (In-Place Numeric Input):
     - Menambahkan mode pengetikan manual ketika angka nilai ZOOM, POS X, atau POS Y disentuh/diklik oleh pengguna.
     - Angka nilai seketika berubah menjadi `TextInput` mandiri berfokus otomatis (`autoFocus`, `selectTextOnFocus`) dengan tipe keyboard `number-pad`.
     - Ketika pengguna selesai mengetik dan menyentuh area lain (`onBlur`) atau menekan tombol selesai (`onSubmitEditing`), nilai baru otomatis divalidasi, di-clamp ke rentang aman (Zoom 100-400%, Pos X 0-100%, Pos Y 0-100%), dan disimpan ke konfigurasi secara persisten.
- **Perubahan Kode Penting**:
  - [mobile/src/components/feed/FacecamHighlightSection.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FacecamHighlightSection.tsx):
    - Mengintegrasikan state `activeEditField` dan `tempInputValue` untuk transisi dinamis antara tampilan nilai dan `TextInput` interaktif.
    - Menambahkan fungsi `handleStartEdit` dan `handleCommitEdit` dengan sanitasi serta batas validasi angka.
    - Menyesuaikan stylesheet untuk layout ultra-ramping (`fieldInput`, `valueBtn`, `stepBtn`, `settingRow`, `container`).
  - [GEMINI.md](file:///d:/projects/clipping/GEMINI.md):
    - Menambahkan aturan learned rule `24. [UX]` terkait keharusan memperhitungkan lebar sisa layar dan penerapan elemen kompak berskala aman.

## [286040a] - Revert Base Time Display During Millisecond Editing to Render Exclusive In-Place Input Field
- **Konteks Struktural**:
  1. Pengembalian Tampilan Murni Milidetik Saat Mode Sunting Aktif:
     - Mengeliminasi rendering teks waktu dasar dan tanda titik (`formatDisplayTime(time).`) yang sebelumnya disisipkan saat pengguna mengetuk angka waktu untuk mengubah milidetik pada [FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx).
     - Memastikan bahwa saat pengguna masuk ke mode edit milidetik (`start` atau `end`), elemen yang ditampilkan murni hanya kotak input milidetik (`TextInput`), menjaga antarmuka tetap minimal, bersih, dan fokus tanpa penambahan elemen spekulatif yang tidak diminta.
- **Perubahan Kode Penting**:
  - [mobile/src/components/feed/FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx):
    - Mengembalikan `TextInput` mandiri tanpa pembungkus `timeEditWrapper` atau teks waktu dasar pada kondisi `activeTimeEdit === 'start'` maupun `activeTimeEdit === 'end'`.
    - Menghapus style `timeEditWrapper` dan menetapkan `minWidth: 44` pada `timeInput` untuk kenyamanan pengetikan dua digit angka.
  - [changelog.md](file:///d:/projects/clipping/changelog.md):
    - Menghapus dokumentasi spekulatif terkait `timeEditWrapper` pada commit `6b32109` dan mencatat pemulihan antarmuka input milidetik murni.
  - [GEMINI.md](file:///d:/projects/clipping/GEMINI.md):
    - Menambahkan aturan baru `23. [UX]` yang melarang penambahan angka waktu dasar spekulatif saat menyunting input milidetik.

## [94582d1] - Restore 4:3 Facecam Highlight Preview with Real-Time Framing Controls Above Main Video Player
- **Konteks Struktural**:
  1. Restorasi Fitur Highlight Facecam (4:3 Landscape) Mengisi Gap Vertikal:
     - Setelah pemutar video utama 16:9 diturunkan posisinya hingga mepet di atas progress bar pencarian (seek bar), tercipta celah/gap hitam kosong antara kontrol pemotongan atas (FeedTopControls) dan pemutar video utama.
     - Mengembalikan komponen preview Facecam Highlight khusus sebagai sarana validasi visual klip tanpa menyertakan beban subtitle banner atau template flex-call.
     - Rasio viewport facecam diatur standar 4:3 landscape, diposisikan sejajar di sisi kiri atas, berdampingan dengan panel pengaturan framing interaktif di sisi kanan.
  2. Panel Kontrol Framing Interaktif Real-Time (Tanpa Modal):
     - Menyediakan kontrol langsung di tempat (*inline/on-site*) tanpa modal pop-up:
       - Tombol Toggle status ON/OFF.
       - Stepper ZOOM (100% s/d 400%, step 25%).
       - Stepper POS X (0% s/d 100%, step 5%).
       - Stepper POS Y (0% s/d 100%, step 5%).
     - Menggunakan rumus transformasi koordinat presisi dari arsitektur teruji commit `a61ae99` untuk cropping resolusi 16:9 murni ke viewport 4:3 tanpa distorsi aspek rasio.
     - Menyimpan konfigurasi framing secara persisten per video ID via `LocalStorage` (`clipping_facecam_<videoId>`).
  3. Proteksi Kinerja Hardware Decoder (Decoupled Performance Safeguard):
     - Menyediakan opsi mematikan facecam sepenuhnya (OFF) untuk HP berspesifikasi rendah agar tidak mengalami lag.
     - Saat facecam nonaktif (OFF), elemen `VideoView` untuk facecam tidak dirender sama sekali dan instance secondary player (`facecamPlayer`) dihentikan 100% (paused & idle), menjamin 0% beban decoding ganda pada native `MediaCodec`.
     - Hasil unduhan MP4 tetap berupa video 16:9 murni utuh tanpa watermark atau framing terbakar.
- **Perubahan Kode Penting**:
  - [mobile/src/components/feed/FacecamHighlightSection.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FacecamHighlightSection.tsx):
    - Komponen baru: Viewport 4:3 docked left dengan badge rasio, container nonaktif hemat baterai, dan panel kontrol bertingkat di sebelah kanan untuk toggle, Zoom, Pos X, dan Pos Y.
  - [mobile/src/hooks/useClipPlayer.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipPlayer.ts):
    - Mengintegrasikan secondary `facecamPlayer` (muted) dengan sinkronisasi instan terhadap playback stream, seek, dan loop, yang aktif bersyarat hanya saat `isFacecamActiveRef.current === true`.
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Mengintegrasikan `FacecamHighlightSection` di dalam `playerContainer` dengan distribusi `justifyContent: 'space-between'` untuk memposisikan facecam di atas dan main player 16:9 mepet di bawah.
    - Mengelola state `facecamConfig` dengan persistensi storage lokal per video ID.
  - [changelog.md](file:///d:/projects/clipping/changelog.md):
    - Memperbarui commit ID lampau line 339 dari `[7c2cd89]` menjadi `[a61ae99]`, memperbarui commit ID sebelumnya menjadi `[a86cef3]`, dan mendokumentasikan pembaruan facecam highlight preview.

## [a86cef3] - Auto-Scroll Carousel and Fallback to Nearest Clip on Visible Count Change
- **Konteks Struktural**:
  1. Resolusi Karosel Hilang / Void Akibat Perubahan Visible Heatmap Count:
     - Mengidentifikasi penyebab karosel tampak kosong (*blank void* / "hilang") ketika pengguna mengubah jumlah klip terlihat (*visible count*, misal dari 50 menjadi 10 klip).
     - Analisis akar masalah:
       - Ketika pengguna berada di klip dengan rank > 10 (misal kolom ke-8 atau x = 800px), ScrollView karosel berada pada posisi scroll offset horizontal yang jauh ke kanan.
       - Ketika jumlah klip dikurangi menjadi 10 klip (5 kolom), total lebar konten karosel mengecil menjadi ~470px.
       - Komponen `ScrollView` bawaan React Native tidak otomatis melakukan *clamp* atau mereset posisi scroll yang melebihi lebar konten baru, sehingga viewport pengguna tertinggal di area kosong (*empty void*) di luar batas kanan konten.
  2. Auto-Scroll Cerdas & Pemilihan Klip Terdekat (*Nearest Clip Fallback*):
     - Menambahkan referensi `scrollViewRef` dan efek `useEffect` pada [FeedClipCarousel.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedClipCarousel.tsx) yang secara otomatis melakukan scroll horizontal ke kolom kartu klip aktif (`Math.max(0, colIndex * 94 - 40)`), dan langsung mereset ke awal (`x: 0`) jika klip berada di luar jangkauan, sehingga karosel selalu tampil di depan mata pengguna tanpa pernah menghilang.
     - Memperbarui `handleSetVisibleHeatmapCount` pada [useClipData.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipData.ts) agar ketika klip aktif saat ini terpotong di luar batas jumlah heatmap yang baru, sistem secara otomatis mencari dan memilih klip terlihat yang memiliki selisih waktu (`start`) paling terdekat dengan posisi menonton pengguna sebelumnya, alih-alih memaksa melompat jauh ke detik 0:00.
     - Menyempurnakan pemilahan rank pada `sort` agar tahan terhadap tipe data `rank` angka maupun string numerik.
- **Perubahan Kode Penting**:
  - [mobile/src/components/feed/FeedClipCarousel.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedClipCarousel.tsx):
    - Mengintegrasikan `useRef<ScrollView>` dan auto-scroll ke kartu aktif atau reset offset saat `clipColumns` dan `activeClipId` berubah.
  - [mobile/src/hooks/useClipData.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipData.ts):
    - Mengimplementasikan pencarian klip terdekat (*closest clip by timestamp*) saat klip aktif terpotong oleh filter visible count.
    - Menghandle parsing `rank` angka dan string numerik secara robust.

## [4385e0c] - Fix Player Freeze Collision on Debounced Seek and Segment Boundary Loop
- **Konteks Struktural**:
  1. Resolusi Race Condition dan Freeze pada Pemutar Video:
     - Mengidentifikasi akar masalah pemutar video macet (*hang* / beku tidak bergerak) ketika user melakukan crop atau mengubah milidetik di bagian kanan klip saat video sedang diputar di sekitar 5 detik akhir.
     - Analisis akar masalah:
       1. Saat user mengubah rentang akhir klip (`end` berkurang atau disesuaikan), sistem melakukan preview seek ke posisi 3 detik sebelum batas akhir (`newEnd - 3`).
       2. Karena pemutar video sedang berjalan di detik-detik akhir tersebut, posisi playback (`currentTime`) berada sangat dekat dengan target seek (`Math.abs(current - targetSeek) < 1.0`).
       3. Handler event `timeUpdate` salah menduga bahwa native player sudah selesai melakukan perpindahan seek (karena selisih jarak < 1.0s), sehingga langsung mereset `pendingSeekTargetRef.current = null`.
       4. Ketika timer debounce (150ms/350ms) selesai menghitung mundur dan fungsi `executeSeek` berjalan, ia membaca `pendingSeekTargetRef.current` yang sudah bernilai `null`, menyebabkan perintah `player.currentTime = seekTime` dan `player.play()` terlewat sama sekali.
       5. Karena `player.pause()` sebelumnya dipanggil di awal debounce untuk membekukan frame lama, pemutar video ditinggalkan dalam kondisi ter-pause permanen tanpa adanya pemicu play lanjutan.
       6. Ditambah lagi, pemotongan batas akhir klip yang mendadak menyebabkan kondisi `current >= currentActive.end` terpenuhi di `timeUpdate`, memicu pemaksaan posisi ke `start` klip secara bersamaan dengan eksekusi debounce seek, menimbulkan tabrakan status pemutar (*state conflict*).
  2. Isolasi Penuh State Debounce dan Proteksi Waktu Nyata:
     - Memisahkan penyimpanan target seek debounce ke dalam ref khusus (`debouncedSeekTargetRef`) yang sepenuhnya kebal dan terisolasi dari mutasi event `timeUpdate`.
     - Menambahkan flag `isDebouncingSeekRef` untuk menonaktifkan evaluasi `timeUpdate` dan pengecekan batas klip (*boundary loop check*) selama interaksi penyesuaian durasi/seek berlangsung.
     - Mengunci aktivasi `pendingSeekTargetRef` hanya setelah perintah `player.currentTime` benar-benar dikirimkan ke modul native ExoPlayer/AVPlayer, mempersempit toleransi verifikasi kedatangan dari 1.0s menjadi 0.4s.
     - Menjamin panggilan `player.play()` selalu tereksekusi pada fungsi `executeSeek` ketika `isContinueStateRef.current` aktif, termasuk menyediakan fallback penyelamat agar pemutar tidak pernah terdampar dalam kondisi *paused/frozen*.
- **Perubahan Kode Penting**:
  - [mobile/src/hooks/useClipPlayer.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipPlayer.ts):
    - Menambahkan `debouncedSeekTargetRef`, `debouncedShouldPlayRef`, dan `isDebouncingSeekRef`.
    - Mengisolasi pembacaan target seek pada `executeSeek` dan menjamin pemutaran kembali.
    - Mengabaikan `timeUpdate` selama status debounce aktif agar frame transisi tidak menimpa UI atau memicu reset segmen.
    - Menambahkan fungsi `cancelPendingSeekDebounce` pada inisialisasi pergantian sumber klip di `syncPlayerSourceForClip`.

## [3bd2b3a] - Synchronize Lockfile Following expo-clipboard Removal
- **Konteks Struktural**:
  - Menyinkronkan [package-lock.json](file:///d:/projects/clipping/mobile/package-lock.json) setelah penghapusan pustaka `expo-clipboard` guna menjaga konsistensi integritas dependensi proyek.
- **Perubahan Kode Penting**:
  - [mobile/package-lock.json](file:///d:/projects/clipping/mobile/package-lock.json):
    - Menghapus entri paket `expo-clipboard`.

## [3ca3c89] - Remove Native expo-clipboard Dependency to Resolve Startup Crash Without Rebuilding APK
- **Konteks Struktural**:
  1. Resolusi Error Startup dan Black Screen:
     - Mengidentifikasi dan memperbaiki penyebab crash fatal saat inisialisasi aplikasi (`TypeError: Cannot read property 'ErrorBoundary' of undefined` pada `_layout.tsx`) yang berakar dari evaluasi modul `Dashboard.tsx:15` -> [ExportWorkshopModal.tsx](file:///d:/projects/clipping/mobile/src/components/ExportWorkshopModal.tsx).
     - Crash terjadi karena pustaka `expo-clipboard` membutuhkan modul biner native (Kotlin/Java) yang belum ter-bundle di dalam APK development yang sedang digunakan pengguna di perangkat fisik.
  2. Eliminasi Ketergantungan Native untuk Ekspor Workshop:
     - Menghapus pustaka `expo-clipboard` secara menyeluruh dari [package.json](file:///d:/projects/clipping/mobile/package.json) dan [ExportWorkshopModal.tsx](file:///d:/projects/clipping/mobile/src/components/ExportWorkshopModal.tsx).
     - Menjadikan teks JSON di kotak pratinjau dapat diseleksi langsung (`selectable={true}`) menggunakan mekanisme seleksi bawaan sistem operasi tanpa ketergantungan modul native apa pun.
     - Memfokuskan aksi ekspor pada tombol tunggal *"Kirim ke WhatsApp"* (`Linking.openURL`) yang sepenuhnya murni JavaScript/OS-intent, memungkinkan pengguna melanjutkan pengujian aplikasi secara instan tanpa perlu melakukan build ulang APK development.
- **Perubahan Kode Penting**:
  - [mobile/src/components/ExportWorkshopModal.tsx](file:///d:/projects/clipping/mobile/src/components/ExportWorkshopModal.tsx):
    - Menghapus impor `expo-clipboard` dan handler `handleCopyToClipboard`.
    - Menambahkan `selectable={true}` pada preview teks JSON dan menyederhanakan tombol aksi ke WhatsApp.
  - [mobile/package.json](file:///d:/projects/clipping/mobile/package.json):
    - Menghapus dependensi `expo-clipboard`.

## [7de28f0] - Fix 100 Heatmap Clip Limit Support and Resolve Real-Time Re-Indexing in Clip Carousel
- **Konteks Struktural**:
  1. Penyelamatan dan Auto-Upgrade Heatmap 100 Klip:
     - Mengubah pemanggilan `fetchHeatmap` pada [Dashboard.tsx](file:///d:/projects/clipping/mobile/src/components/Dashboard.tsx) agar selalu mengambil 100 klip penuh (bukan 50), sehingga draft yang disimpan di memori lokal memiliki seluruh data heatmap AI untuk difilter dinamis oleh pengguna hingga batas maksimum (100 klip).
     - Menambahkan mekanisme *auto-upgrade* pada [useClipData.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipData.ts) yang mendeteksi draf lama (yang hanya memiliki 50 klip heatmap), lalu mengambil 100 klip penuh dan menggabungkannya secara transparan (*merge*) tanpa menghilangkan status `done`/`trash` maupun klip custom yang sudah ada.
  2. Perbaikan Penomoran "KLIP X" dan Re-render Memoized Carousel Seketika:
     - Memperbaiki komparator `React.memo` pada [ClipCardItem.tsx](file:///d:/projects/clipping/mobile/src/components/feed/ClipCardItem.tsx) dengan menyertakan pengecekan `prev.clipNumber === next.clipNumber`. Sebelumnya ketiadaan pengecekan ini menyebabkan kartu klip tidak merender ulang saat nomor urutnya bergeser setelah klip custom disisipkan, menimbulkan fenomena penomoran kembar/lompat (misal `2 3 3 5 5 7 7`) sebelum pengguna keluar-masuk kamar.
     - Menyamakan judul teks kartu menjadi `KLIP ${clipNumber}` secara terpadu untuk semua klip (termasuk klip custom yang tetap mempertahankan aksen ungu dan badge `CUST` di pojok kanan atas), sehingga penomoran selalu berurutan kronologis 1, 2, 3, 4, 5... secara konsisten.
- **Perubahan Kode Penting**:
  - [mobile/src/components/feed/ClipCardItem.tsx](file:///d:/projects/clipping/mobile/src/components/feed/ClipCardItem.tsx):
    - Menyertakan `clipNumber` dalam komparator memo dan mengubah teks judul kartu menjadi `KLIP ${clipNumber}`.
  - [mobile/src/hooks/useClipData.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipData.ts):
    - Mengintegrasikan mekanisme auto-upgrade 100 klip saat mendeteksi draft memiliki kurang dari 100 klip heatmap.
  - [mobile/src/components/Dashboard.tsx](file:///d:/projects/clipping/mobile/src/components/Dashboard.tsx):
    - Memastikan ekstraksi awal selalu mengambil 100 klip penuh.

## [f1f531f] - Anchor Video Player Flush Against Scrubber Progress Bar and Support Dynamic Aspect Ratio
- **Konteks Struktural**:
  1. Penyesuaian Posisi Video Player Menempel Langsung di Atas Scrubber:
     - Mengubah perataan vertikal kontainer pemutar video pada [FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx) dari tengah (`justifyContent: 'center'`) menjadi menempel ke dasar (`justifyContent: 'flex-end'`), sehingga frame video (baik saat menonton online, full video, maupun klip lokal yang sudah dipotong/mark as done) selalu duduk tepat di atas bar progress scrubber tanpa jeda hitam (void).
     - Menghapus border pemisah atas pada [FeedPlaybackControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedPlaybackControls.tsx) agar track scrubber dan knob progress menempel (*flush*) secara presisi ke tepi bawah video persis seperti aplikasi pemutar video modern (YouTube / CapCut).
  2. Deteksi Rasio Aspek Video Dinamis:
     - Menambahkan pembacaan ukuran dan rasio aspek video asli secara dinamis (`videoTrackChange` & `sourceLoad`) pada [useClipPlayer.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipPlayer.ts).
     - Menghitung dimensi container video secara matematis di [FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx) agar membungkus aspek rasio video secara pas tanpa letterboxing buatan di sisi bawah.
- **Perubahan Kode Penting**:
  - [mobile/src/hooks/useClipPlayer.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipPlayer.ts):
    - Mengekspos state `videoAspectRatio` dan memasang listener pada event track video.
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Mengintegrasikan pengukuran layout (`playerLayout`) dan perhitungan memoized `videoContainerStyle`.
    - Memposisikan `playerContainer` dengan `justifyContent: 'flex-end'`.
  - [mobile/src/components/feed/FeedPlaybackControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedPlaybackControls.tsx):
    - Menghilangkan `borderTopWidth` dan `borderTopColor` pada `bottomPlayback`.

## [5dc256b] - Streamline Top Controls: Fix MM:SS Format, Hide Saved Badge and Irrelevant Left Controls on Done Clips
- **Konteks Struktural**:
  1. Penghapusan Total Badge Tersimpan dan Minimalisasi Tombol Status Done:
     - Menghapus badge centang dan teks "Tersimpan" saat klip telah berstatus terdownload pada [FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx), mengeliminasi masalah teks yang meluber dan bertumpuk dengan elemen navigasi lainnya.
     - Saat klip sudah terdownload, tombol download hilang sepenuhnya dan hanya menyisakan tombol centang hijau (*mark as done*).
  2. Format Waktu Terstandarisasi Menit & Detik (MM:SS) Tanpa Jam:
     - Mengubah fungsi [formatDisplayTime](file:///d:/projects/clipping/mobile/src/components/feed/timeUtils.ts) agar secara kaku hanya menghasilkan format `MM:SS` (modulo 3600 untuk menit dan modulo 60 untuk detik), mengeliminasi jam dan milidetik secara menyeluruh dari banner rentang atas. Hal ini menjaga lebar teks selalu ramping dan konstan (5 karakter), mencegah benturan visual dengan tombol kontrol samping pada layar ponsel dengan aspek rasio sempit.
     - Detail jam lengkap tetap dapat dipantau pengguna pada kartu klip di horizontal carousel bawah.
  3. Menyembunyikan Tombol Aksi Kiri Saat Mode Klip Done:
     - Menyembunyikan tombol penambahan klip custom (`Plus`) dan pengubah jumlah klip (`SlidersHorizontal`) di sisi kiri saat klip aktif berstatus `done`, karena opsi manipulasi rentang tidak lagi relevan untuk klip yang sudah diselesaikan.
- **Perubahan Kode Penting**:
  - [mobile/src/components/feed/timeUtils.ts](file:///d:/projects/clipping/mobile/src/components/feed/timeUtils.ts):
    - Memperbarui fungsi `formatDisplayTime` agar selalu mengembalikan string format `MM:SS` secara mutlak.
  - [mobile/src/components/feed/FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx):
    - Menggunakan `formatDisplayTime` untuk semua render waktu pada banner atas.
    - Menghapus badge "Tersimpan" dan menghapus style `downloadedBadge` / `downloadedBadgeText`.
    - Menyembunyikan grup tombol kiri saat `activeClip.status === 'done'`.

## [6b32109] - Refine In-Place Millisecond Input Presentation in Feed Top Banner
- **Konteks Struktural**:
  1. Presentasi Waktu Murni HH:MM:SS / MM:SS pada Banner Rentang Atas:
     - Memastikan banner rentang atas pada [FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx) selalu menampilkan waktu dasar bersih dalam format jam:menit:detik murni tanpa pecahan milidetik saat mode baca/diam.
- **Perubahan Kode Penting**:
  - [mobile/src/components/feed/FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx):
    - Membersihkan impor fungsi yang tidak terpakai (`formatTimeWithMs`).

## [dbb8f3c] - Consolidate Shared Storage and Cookies into Unified Settings Modal and Streamline Dashboard Header
- **Konteks Struktural**:
  1. Unifikasi Konfigurasi ke dalam Modal Pengaturan Tunggal:
     - Menggabungkan konfigurasi direktori penyimpanan bersama (Shared Storage Output) dan pengujian disk permission dengan sinkronisasi cookies YouTube (Google Drive) ke dalam satu modal terpadu [SettingsModal.tsx](file:///d:/projects/clipping/mobile/src/components/SettingsModal.tsx).
     - Menghapus komponen statis inline `StorageConfigSection` dari [Dashboard.tsx](file:///d:/projects/clipping/mobile/src/components/Dashboard.tsx) untuk menghemat ruang vertikal layar utama.
  2. Optimalisasi Tombol Pengaturan dan Header Ruang Proyek:
     - Menempatkan tombol ikon `Settings` tepat di sisi kanan judul "Clipping Workshop" pada header Dashboard untuk mengakses modal pengaturan kapan saja secara intuitif.
     - Menghilangkan tombol `COOKIES` dari bilah judul "Proyek Tersimpan" pada [Dashboard.tsx](file:///d:/projects/clipping/mobile/src/components/Dashboard.tsx), sehingga melegakan ruang horizontal bilah proyek dan mencegah tombol `IMPORT` tergeser ke kanan atau terpotong pada layar berukuran standar.
- **Perubahan Kode Penting**:
  - [mobile/src/components/SettingsModal.tsx](file:///d:/projects/clipping/mobile/src/components/SettingsModal.tsx):
    - Membuat modal pengaturan modular berisi dua seksi: Shared Storage (inspeksi & modifikasi direktori root, pengujian ulang izin baca/tulis) dan Cookies YouTube (input link publik Google Drive, validasi link, tombol sinkronisasi dengan indikator pemrosesan).
  - [mobile/src/components/Dashboard.tsx](file:///d:/projects/clipping/mobile/src/components/Dashboard.tsx):
    - Mengganti state `cookiesModalVisible` menjadi `settingsModalVisible`.
    - Menambahkan tombol `Settings` di sebelah kanan judul utama pada `headerTitleRow`.
    - Menghapus pemanggilan `<StorageConfigSection />` dari aliran tata letak utama.
    - Menghapus tombol `COOKIES` dari `sectionHeader`, memberikan ruang leluasa pada tombol `IMPORT`.
    - Mengganti `<CookiesModal />` dengan `<SettingsModal />`.

## [3921bbd] - Streamline Dashboard Creation, Remove Cluttered Badges, Add Offline Cloud Indicator, and Implement Full Workshop JSON Export/Import
- **Konteks Struktural**:
  1. Penyederhanaan Form Pembuatan Workshop di Dashboard:
     - Menghapus input jumlah klip pada [WorkshopInputForm.tsx](file:///d:/projects/clipping/mobile/src/components/WorkshopInputForm.tsx) dan memfokuskan antarmuka pada input tautan YouTube serta tombol buat yang lebih bersih dan ringkas. Nilai awal difiksasi default pada 50 klip, yang selanjutnya dapat diatur secara fleksibel di dalam kamar workshop.
  2. Pembersihan Badge dan Pengoptimalan Ruang Horizontal Kartu Workshop:
     - Menghapus badge statistik `KLIP` dan `DONE` dari kartu workshop [WorkshopCard.tsx](file:///d:/projects/clipping/mobile/src/components/WorkshopCard.tsx) untuk melegakan tata letak horizontal kartu.
     - Menghapus badge status pojok kanan atas thumbnail untuk mengeliminasi redundansi visual.
  3. Indikator dan Tombol Unduh Offline Berbasis Cloud Icon:
     - Mengubah tombol/badge "Full" menjadi tombol ikon awan silang ([CloudOff](file:///d:/projects/clipping/mobile/src/components/WorkshopCard.tsx)) yang ramping (32x32) dengan tiga status visual yang jelas:
       - Belum Terunduh: Warna abu-abu (`rgba(255, 255, 255, 0.45)`), dapat ditekan untuk memulai pengunduhan video utuh.
       - Sedang Mengunduh: Warna kuning hangat (`#fbbf24`) dengan indikator animasi tanpa persentase angka yang mengganggu.
       - Selesai / Offline Ready: Warna hijau (`#34d399`), menandakan video utuh siap diputar secara offline.
  4. Fitur Ekspor dan Impor Full JSON (100 Klip Heatmap + Klip Custom):
     - Menambahkan komponen [ExportWorkshopModal.tsx](file:///d:/projects/clipping/mobile/src/components/ExportWorkshopModal.tsx) dengan tombol aksi pada setiap kartu workshop.
     - Menyediakan opsi salin langsung ke clipboard menggunakan pustaka resmi `expo-clipboard` dan opsi kirim ke WhatsApp Bot (`6285742923730`).
     - Menyinkronkan fungsi `handleImportJSON` pada [Dashboard.tsx](file:///d:/projects/clipping/mobile/src/components/Dashboard.tsx) agar dapat mem-parse struktur JSON ekspor secara simetris dan tanpa kehilangan data (lossless), merekonstruksi seluruh klip draf serta memperbarui `doneCount` secara akurat saat diimpor ke perangkat lain.
- **Perubahan Kode Penting**:
  - [mobile/src/components/WorkshopInputForm.tsx](file:///d:/projects/clipping/mobile/src/components/WorkshopInputForm.tsx):
    - Menghapus state `countInput` dan input angka klip, menyatukan input tautan YouTube dan tombol BUAT ke dalam satu baris fleksibel.
  - [mobile/src/components/WorkshopCard.tsx](file:///d:/projects/clipping/mobile/src/components/WorkshopCard.tsx):
    - Menghapus `statsRow` (badge KLIP & DONE) dan `offlineCornerBadge` pada thumbnail.
    - Mengganti tombol "Full" dengan tombol ikon `CloudOff` dengan status dinamis (abu-abu, kuning loading, hijau ready).
    - Menambahkan tombol ekspor (`Share2`) pada baris aksi kartu.
  - [mobile/src/components/ExportWorkshopModal.tsx](file:///d:/projects/clipping/mobile/src/components/ExportWorkshopModal.tsx):
    - Membuat modal dialog ekspor dengan fitur salin JSON ke clipboard dan tautan langsung kirim ke WhatsApp.
  - [mobile/src/components/Dashboard.tsx](file:///d:/projects/clipping/mobile/src/components/Dashboard.tsx):
    - Mengintegrasikan state dan handler `handleExportWorkshop`.
    - Memperbarui fungsi `handleImportJSON` untuk membaca struktur JSON ekspor secara komprehensif.
  - [mobile/package.json](file:///d:/projects/clipping/mobile/package.json):
    - Menambahkan dependensi `expo-clipboard`.

## [9ee3b7f] - Add Custom Range, Configurable Heatmap Visible Count, Zero-Offset Extraction, and Balanced Top Bar Controls
- **Konteks Struktural**:
  1. Fitur Penambahan Rentang Klip Custom (User-Defined Range):
     - Menambahkan komponen [CustomRangeModal.tsx](file:///d:/projects/clipping/mobile/src/components/feed/CustomRangeModal.tsx) yang memungkinkan pengguna membuat rentang klip kustom secara fleksibel saat menemukan momen spesifik di luar klip bawaan heatmap YouTube.
     - Menyediakan opsi pengambilan waktu playback saat ini secara instan ("Ambil Posisi Playback Sekarang") serta tombol penambahan durasi cepat (+5s, +10s, +15s, +30s).
     - Menambahkan penanda ranking `"custom"` (`isCustom: true`) dengan aksen badge ungu (`CUST`) di [ClipCardItem.tsx](file:///d:/projects/clipping/mobile/src/components/feed/ClipCardItem.tsx). Klip custom memiliki aturan keterlihatan khusus: selalu ditampilkan di carousel tanpa terpengaruh limitasi jumlah filter heatmap.
     - Penyesuaian perilaku tombol Trash pada [useClipData.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipData.ts): klip heatmap ditandai sebagai status `trash`, sedangkan klip custom dihapus secara total dan permanen dari daftar klip.
  2. Fitur Pengaturan Jumlah Klip Heatmap yang Terlihat (Visible Heatmap Count Filter):
     - Menambahkan komponen [VisibleCountModal.tsx](file:///d:/projects/clipping/mobile/src/components/feed/VisibleCountModal.tsx) untuk mengatur jumlah klip heatmap teratas yang ingin ditampilkan (1–100, default 50) dengan tombol stepper dan preset cepat (10, 20, 30, 50, 75, 100). Nilai ini disimpan secara persisten di `LocalStorage` per video.
     - Menghitung daftar klip yang tampak secara dinamis di [useClipData.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipData.ts) dengan menggabungkan semua klip custom dan N klip heatmap teratas berdasarkan intensitas, lalu mengurutkannya secara kronologis berdasarkan waktu mulai (`start`).
  3. Pemurnian Heatmap AI (Zero Offset & Preservasi Nilai Pecahan Natural):
     - Menghapus penambahan dan pengurangan offset manual 5 detik pada [api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts) dan [useClipData.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipData.ts) (`offset = 0`), sehingga rentang klip dimulai tepat di awal puncak aksi tanpa jeda tunggu (pre-roll).
     - Menghapus pembulatan buatan `Math.round(start)` dan `Math.round(end)` agar nilai pecahan asli dari YouTube heatmap tetap dipertahankan secara presisi dan natural.
  4. Penyempurnaan Tata Letak Bilah Kontrol Atas (Balanced Symmetrical Controls):
     - Menyembunyikan milidetik dari tampilan rentang waktu atas pada [FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx) dan [timeUtils.ts](file:///d:/projects/clipping/mobile/src/components/feed/timeUtils.ts), sehingga banner selalu bersih menampilkan format jam, menit, dan detik murni (`HH:MM:SS` / `MM:SS`). Milidetik hanya muncul saat input ditekan untuk diedit.
     - Menyusun tata letak bilah atas secara simetris dan seimbang: sisi kiri memuat 2 tombol aksi (`Tambah Custom` dan `Jumlah Klip Heatmap`), sisi tengah menampilkan rentang waktu, dan sisi kanan memuat 2 tombol aksi (`Trash / Hapus` dan `Mark as Done / Download`).
- **Perubahan Kode Penting**:
  - [mobile/src/components/feed/CustomRangeModal.tsx](file:///d:/projects/clipping/mobile/src/components/feed/CustomRangeModal.tsx):
    - Membuat modal dialog pembuatan rentang waktu kustom dengan validasi waktu mulai dan selesai.
  - [mobile/src/components/feed/VisibleCountModal.tsx](file:///d:/projects/clipping/mobile/src/components/feed/VisibleCountModal.tsx):
    - Membuat modal dialog konfigurasi batas jumlah klip heatmap terlihat beserta chip preset cepat.
  - [mobile/src/components/feed/timeUtils.ts](file:///d:/projects/clipping/mobile/src/components/feed/timeUtils.ts):
    - Mengubah `formatDisplayTime` agar selalu mengembalikan `formatTime` murni (tanpa ekstensi milidetik desimal pada banner).
    - Menambahkan fungsi helper `parseTimeToSeconds` untuk mengonversi string waktu (`HH:MM:SS`, `MM:SS`, `SS`) menjadi detik desimal.
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - Memperbarui interface `ClipItem` dengan properti `rank: number | string` dan `isCustom?: boolean`.
    - Mengatur default `offset: number = 0` dan `numClips: number = 100` pada `fetchHeatmap`, serta menghapus pembulatan `Math.round()` pada `start` dan `end`.
    - Mengakomodasi tipe `rank?: number | string` pada fungsi `getClipOutputFilePath`, `getClipInternalOutputFilePath`, `resolvePlayableClipUri`, dan `downloadClip`.
  - [mobile/src/components/feed/ClipCardItem.tsx](file:///d:/projects/clipping/mobile/src/components/feed/ClipCardItem.tsx):
    - Mendukung properti `isCustom` dan `rank` bertipe string/custom dengan badge ungu khusus `#8b5cf6` (`CUST`).
  - [mobile/src/components/feed/FeedClipCarousel.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedClipCarousel.tsx):
    - Meneruskan properti `isCustom` ke `ClipCardItem`.
  - [mobile/src/hooks/useClipData.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipData.ts):
    - Mengintegrasikan state `visibleHeatmapCount`, handler `handleAddCustomClip`, dan handler `handleSetVisibleHeatmapCount`.
    - Menyesuaikan `handleToggleTrash` agar menghapus klip custom secara permanen dari state dan penyimpanan lokal.
    - Menghitung `visibleClips` dan `clipColumns` dengan menyertakan seluruh klip custom ditambah N klip heatmap teratas terurut kronologis.
  - [mobile/src/components/feed/FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx):
    - Menata ulang header kontrol atas: 2 tombol aksi di sisi kiri, rentang waktu murni tanpa milidetik di tengah, dan 2 tombol status di sisi kanan.
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Mengintegrasikan `CustomRangeModal` dan `VisibleCountModal` ke dalam alur kerja FeedScreen.

## [706095e] - Add Local vs Stream Playback Selection Modal, Fix Scrubber Seeking on Full Video, and Optimize Local Debouncing
- **Konteks Struktural**:
  1. Dialog Pemilihan Sumber Pemutar (Play Mode Selection):
     - Menambahkan komponen [PlayModeModal.tsx](file:///d:/projects/clipping/mobile/src/components/PlayModeModal.tsx) di [Dashboard.tsx](file:///d:/projects/clipping/mobile/src/components/Dashboard.tsx) yang secara interaktif menanyakan preferensi pemutaran ("Video Lokal Offline" vs "Streaming YouTube Online") saat pengguna menekan kartu workshop yang telah memiliki file full video.
     - Jika file full video belum tersedia di shared storage, aplikasi langsung membuka workshop dalam mode stream online tanpa memunculkan modal dialog.
     - Preferensi mode (`playMode: 'local' | 'stream'`) diteruskan secara transparan dari Dashboard melalui [app/index.tsx](file:///d:/projects/clipping/mobile/src/app/index.tsx) menuju [FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx) dan [useClipPlayer.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipPlayer.ts), memungkinkan pengguna tetap memilih mode stream YouTube secara sadar meskipun file lokal tersedia.
  2. Perbaikan Kegagalan Lompat / Hold Progress Bar Scrubber pada Video Lokal:
     - Memperbaiki bug pada `onScrubberPress` di [FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx) yang sebelumnya keliru memperlakukan semua URI `file://` sebagai file klip individual berdurasi 0–15 detik, sehingga memicu reset boundary loop seketika pada file full video (`full.mp4`).
     - Membedakan kalkulasi waktu lompat antara klip terpotong individual (`(pct / 100) * duration`) dan video utuh/stream (`currentActive.start + (pct / 100) * duration`).
     - Memperbaiki snap target pada handler `readyToPlay` di [useClipPlayer.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipPlayer.ts) agar tidak mereset target waktu `full.mp4` ke detik 0.
  3. Optimalisasi Debouncing Video Lokal untuk Mencegah Choking Decoder:
     - Mengubah debounce seek video lokal dari 0ms menjadi 150ms di [useClipPlayer.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipPlayer.ts). Debounce 150ms menyerap semburan micro-events saat user menggeser atau menahan scrubber, menjaga stabilitas hardware decoder video HP tanpa terasa lambat atau lagging, sementara transisi pindah klip tetap instan.
- **Perubahan Kode Penting**:
  - [mobile/src/components/PlayModeModal.tsx](file:///d:/projects/clipping/mobile/src/components/PlayModeModal.tsx):
    - Membuat modal pilihan sumber pemutar dengan opsi "Gunakan Video Lokal" (bebas kuota / offline) dan "Streaming YouTube" (online).
  - [mobile/src/components/Dashboard.tsx](file:///d:/projects/clipping/mobile/src/components/Dashboard.tsx):
    - Mengintegrasikan `PlayModeModal` dan fungsi `handleCardPress` yang mendeteksi ketersediaan full video sebelum membuka workshop.
    - Menyesuaikan `handleOpenExisting` untuk menerima parameter `playMode` dan hanya memanggil `fetchStreamUrl` jika mode stream dipilih.
  - [mobile/src/app/index.tsx](file:///d:/projects/clipping/mobile/src/app/index.tsx):
    - Menambahkan `playMode` pada interface `ActiveWorkshop` dan meneruskannya ke `FeedScreen`.
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Menerima props `playMode` dan meneruskannya ke hook `useClipPlayer`.
    - Memperbaiki `onScrubberPress` agar mendeteksi file klip terpotong vs video utuh `full.mp4`.
  - [mobile/src/hooks/useClipPlayer.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipPlayer.ts):
    - Menambahkan parameter `playMode` pada `useClipPlayer`.
    - Mengatur `debounceMs = isLocalMode ? 150 : 350` di `centralizedSeek`.
    - Memperbaiki target snap pada `statusChange` (`readyToPlay`) untuk membedakan klip terpotong dengan `full.mp4`.
    - Mengkondisikan pemutaran `fullVideoUri` di `syncPlayerSourceForClip` dan `initializeStreamAndPlayback` agar menghormati preferensi `playMode === 'stream'`.

## [f163785] - Streamline Notifications to Single-Context Titles, Eliminate False-Positive Cookie Handling, and Add Manual Cookie Renewal in Dashboard
- **Konteks Struktural**:
  1. Penyederhanaan Notifikasi Toast (Single-Context Title & Raw Error Modal):
     - Menghapus rendering deskripsi kalimat panjang (`message`) pada banner toast di [Toast.tsx](file:///d:/projects/clipping/mobile/src/components/Toast.tsx) sehingga tampilan notifikasi menjadi ringkas satu baris yang murni menjelaskan status fitur berhasil/gagal ("Fitur X Berhasil" / "Fitur X Gagal").
     - Memindahkan seluruh konteks teknis dan rincian error secara eksklusif ke modal debug error (`rawError`), yang dapat diakses pengguna melalui tombol bug/code (`Code2`) pada banner error tanpa membebani antarmuka pengguna dengan saran atau kalimat deskripsi yang berbelit.
  2. Eliminasi Asumsi Error Cookies & Bot Blocking Palsu:
     - Menghentikan kebiasaan aplikasi yang secara keliru mengklasifikasikan setiap kegagalan teknis (error jaringan, FFmpeg cut, format tidak tersedia, timeout) sebagai error rate limit / bot / cookies di [api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts).
     - Menghapus kemunculan modal input cookies secara otomatis (`setCookiesModalVisible(true)`) dari seluruh blok `catch` pada player ([useClipPlayer.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipPlayer.ts)), pengunduh klip ([useClipDownload.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipDownload.ts)), layar feed ([FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx)), dan dashboard ([Dashboard.tsx](file:///d:/projects/clipping/mobile/src/components/Dashboard.tsx)).
  3. Mekanisme Pembaruan Cookies Mandiri di Dashboard / Workspace:
     - Menambahkan tombol aksi "COOKIES" mandiri pada bilah proyek tersimpan di [Dashboard.tsx](file:///d:/projects/clipping/mobile/src/components/Dashboard.tsx). Pengguna dapat membuka [CookiesModal.tsx](file:///d:/projects/clipping/mobile/src/components/CookiesModal.tsx) kapan saja secara sadar untuk menimpa file cookies melalui Google Drive publik tanpa terganggu popup otomatis saat terjadi kegagalan teknis non-bot.
- **Perubahan Kode Penting**:
  - [mobile/src/components/Toast.tsx](file:///d:/projects/clipping/mobile/src/components/Toast.tsx):
    - `ToastContainer`: Menghapus komponen teks `toast.message` dari container pill dan hanya merender `toast.title` secara ringkas.
    - Menyesuaikan label informasi di debug modal menjadi "Fitur / Konteks" dan "Raw Error / Respon Server".
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - `isRateLimitOrRestrictedError`: Mengetatkan filter deteksi agar hanya merespons kata kunci verifikasi bot YouTube nyata (`sign in to confirm`, `bot verification`) dan tidak menganggap sembarang HTTP 403 atau error umum sebagai bot.
    - `downloadClip`: Menghapus fallback yang menganggap kegagalan tanpa `cookiePath` sebagai `RATE_LIMIT_EXCEEDED` atau `COOKIES_INVALID_OR_EXPIRED`.
  - [mobile/src/hooks/useClipPlayer.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipPlayer.ts):
    - Menghapus parameter `setCookiesModalVisible` dari `UseClipPlayerParams`.
    - Menghapus panggilan auto-popup cookies dan menyederhanakan seluruh toast menjadi single-context: "Gagal Memindahkan Pemutar", "Gagal Memperbarui Stream", "Memutar File Lokal", "Memutar Full Video Lokal", "Stream Video Siap", dan "Stream Video Gagal".
  - [mobile/src/hooks/useClipDownload.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipDownload.ts):
    - Menghapus state `cookiesModalVisible` dan logika auto-popup cookies pada blok penanganan error unduhan.
    - Menyederhanakan toast unduhan menjadi: "Klip Sudah Ada", "Sedang Mengunduh Klip", "Memulai Unduhan Klip", "Unduh Klip Berhasil", dan "Unduh Klip Gagal".
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Menghapus impor dan elemen `CookiesModal` serta ref `setCookiesModalVisibleRef`.
  - [mobile/src/components/Dashboard.tsx](file:///d:/projects/clipping/mobile/src/components/Dashboard.tsx):
    - Menambahkan tombol "COOKIES" di samping tombol "IMPORT" pada bilah proyek tersimpan.
    - Menghapus seluruh trigger `setCookiesModalVisible(true)` dari blok penanganan error pembuatan workshop, pembukaan workshop, dan pengunduhan full video.
    - Menyederhanakan seluruh toast menjadi ringkas: "Gagal Membuat Workshop", "Gagal Membuka Workshop", "Unduh Full Video Berhasil", "Unduh Full Video Gagal", "Draft Dihapus", "Draft Klip Kosong", "Belum Ada Klip Selesai", "Gagal Kirim WhatsApp", "Impor Workshop Berhasil", dan "Impor Workshop Gagal".
  - [mobile/src/components/CookiesModal.tsx](file:///d:/projects/clipping/mobile/src/components/CookiesModal.tsx):
    - Memperbarui judul dan deskripsi modal menjadi "Perbarui Cookies YouTube".
    - Menyederhanakan toast hasil pembaruan menjadi "Pembaruan Cookies Berhasil" dan "Pembaruan Cookies Gagal".
  - [mobile/src/hooks/useClipData.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipData.ts):
    - Menyederhanakan toast status menjadi "Gagal Membuka Workshop", "Memutar File Lokal", dan "Mode Stream YouTube".
  - [mobile/src/components/StorageConfigSection.tsx](file:///d:/projects/clipping/mobile/src/components/StorageConfigSection.tsx):
    - Menyederhanakan toast verifikasi storage menjadi "Verifikasi Storage Berhasil" dan "Verifikasi Storage Gagal".
  - [mobile/src/app/index.tsx](file:///d:/projects/clipping/mobile/src/app/index.tsx):
    - Menyederhanakan toast koneksi startup menjadi "Server Python Terhubung" dan "Server Python Offline".

## [41311ea] - Add Full Video Download in Dashboard, Prioritize Local Offline Playback, and Fast Local Clip Cutting
- **Konteks Struktural**:
  1. Pengunduhan Full Video di Dashboard / Shared Storage:
     - Menambahkan tombol unduh video utuh (full video) pada setiap kartu video di Dashboard ([WorkshopCard.tsx](file:///d:/projects/clipping/mobile/src/components/WorkshopCard.tsx) dan [Dashboard.tsx](file:///d:/projects/clipping/mobile/src/components/Dashboard.tsx)) dengan indikator status offline dan progress real-time.
     - Menyimpan file video utuh di shared storage perangkat (`/storage/emulated/0/clipping/output/<videoId>/full.mp4`) agar user dapat mengelola, melihat, dan menghapus video secara mandiri tanpa harus mereset data privat aplikasi.
  2. Prioritas Pemutaran Video Lokal (Offline-First Resilient):
     - Memprioritaskan pemutaran file lokal di [useClipPlayer.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipPlayer.ts): jika klip belum di-cut namun full video sudah ada di shared storage, player memutar langsung dari file fisik lokal (`file://.../full.mp4`) dari detik `clip.start` s/d `clip.end` dengan transisi seek instan 0ms tanpa buffering atau ketergantungan koneksi internet.
     - Memungkinkan workshop dibuka dan dimainkan secara offline 100% tanpa blocking request URL stream YouTube.
  3. Pemotongan Klip Cepat secara Lokal (Fast Local FFmpeg Cut):
     - Mengarahkan pipeline pemotongan klip di [clip_downloader.py](file:///d:/projects/clipping/mobile/scripts/utils/clip_downloader.py) dan [api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts) untuk mendeteksi keberadaan file full video di shared storage terlebih dahulu.
     - Jika full video lokal ada, FFmpeg langsung memotong klip secara offline menggunakan fast seek input `-ss` dan `filter_complex` tanpa melalui tahap pengunduhan YouTube (Stage 1), menghasilkan waktu potong 1-2 detik, hemat kuota internet 100%, serta bebas risiko blokir 403 / Error 429.
- **Perubahan Kode Penting**:
  - [mobile/scripts/utils/clip_downloader.py](file:///d:/projects/clipping/mobile/scripts/utils/clip_downloader.py):
    - `download_clip_direct`: Menambahkan parameter `source_video_path`. Jika file lokal tersedia, eksekusi pemotongan FFmpeg offline langsung dijalankan tanpa mengunduh stream YouTube.
    - Menambahkan fungsi `download_full_video_direct` untuk mengunduh video utuh kualitas 1080p/720p H.264 + AAC dengan realtime progress hook ke shared storage.
    - Menambahkan alias backward compatibility `download_youtube_clip_range`.
  - [mobile_api/main.py](file:///d:/projects/clipping/mobile_api/main.py):
    - Meneruskan `source_video_path` pada endpoint `/api/download-clip`.
    - Menambahkan endpoint pass-through `/api/download-full-video` untuk mendelegasikan pengunduhan video utuh ke `download_full_video_direct`.
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - Menambahkan `getFullVideoFilePath`, `checkFullVideoExists`, dan `resolvePlayableFullVideoUri`.
    - Menambahkan fungsi `downloadFullVideo` dengan progress polling ke background runner.
    - Mengintegrasikan pengecekan `source_video_path` pada `downloadClip`.
  - [mobile/src/hooks/useClipPlayer.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipPlayer.ts):
    - `syncPlayerSourceForClip`: Memprioritaskan pemutaran `fullVideoUri` jika klip belum di-cut, dengan loop rentang `clip.start` s/d `clip.end`.
    - `timeUpdate`: Menyesuaikan kalkulasi progress dan boundary enforcement untuk mode full video lokal.
    - `skipSeconds`: Menyesuaikan pergeseran waktu berbasis durasi klip relatif pada file full video.
    - `initializeStreamAndPlayback`: Memulai pemutaran langsung dari file full video lokal jika tersedia, mendukung mode offline penuh.
  - [mobile/src/components/WorkshopCard.tsx](file:///d:/projects/clipping/mobile/src/components/WorkshopCard.tsx):
    - Menambahkan tombol unduh "Full Video", indikator persentase loading saat mengunduh, dan badge "OFFLINE READY" / "Full" saat video utuh tersimpan di shared storage.
  - [mobile/src/components/Dashboard.tsx](file:///d:/projects/clipping/mobile/src/components/Dashboard.tsx):
    - Mengelola state `fullVideoStatus` per video ID.
    - Menambahkan `handleDownloadFullVideo` dan mengizinkan pembukaan workshop offline jika full video sudah ada.
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Mengizinkan pemutar video merender jika `currentSourceUriRef.current` memegang file lokal full video meskipun `streamUrl` belum tersedia.
  - [mobile/src/hooks/useClipData.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipData.ts):
    - Mengabaikan `full.mp4` dan `full_video.mp4` dari proses pencocokan klip individu yang sudah di-cut.

## [a61ae99] - Streamline App: Remove Subtitle, Template, and Export Modules to Focus Exclusively on Clip Selection, Trimming, and Downloading
- **Konteks Struktural**:
  1. Penghapusan Fitur Kompleks (Subtitle, Template Framing, dan Video Burn/Export):
     - Menghapus seluruh modul ekspor video, subtitle fetcher & burner, dan template layouting (facecam, banner konteks judul) sesuai keputusan fungsional aplikasi agar fokus 100% pada pemilihan klip (heatmap carousel), perentangan durasi (trimming/crop/extend), dan pengunduhan MP4 langsung.
     - Proses pasca-produksi (seperti pengeditan template framing, penambahan subtitle, dan ekspor) didelegasikan sepenuhnya ke aplikasi video editor eksternal (seperti CapCut) demi efisiensi proses dan performa maksimal.
  2. Optimalisasi Resource dan Hardware Decoder:
     - Mengeliminasi secondary video player (`facecamPlayer`) dan sinkronisasi cue subtitle per frame waktu, menyisakan tepat 1 hardware video decoder native (`player`) pada rasio murni 16:9 (`contentFit="contain"`).
     - Menghilangkan beban ganda memory, rendering canvas multi-viewport, dan decoding thread ExoPlayer pada HP spesifikasi rendah.
  3. Pembersihan Modular Backend dan Frontend:
     - Menghapus endpoint API `/api/subtitles` dan `/api/burn-subtitles` dari backend pass-through server [mobile_api/main.py](file:///d:/projects/clipping/mobile_api/main.py).
     - Menghapus file skrip utilitas `subtitle_burner.py` dan `subtitle_fetcher.py`.
     - Menyederhanakan [mobile/src/components/feed/FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx) dari 2.746 baris menjadi ~360 baris kontrol esensial (Trash, Done, Download status/progress, dan tombol fine-tune Start/End extend/crop).
     - Menghapus hooks `useClipSubtitle.ts`, `useClipTemplate.ts`, dan komponen `SubtitleOverlay.tsx`.
- **Perubahan Kode Penting**:
  - [mobile_api/main.py](file:///d:/projects/clipping/mobile_api/main.py):
    - Menghapus import `burn_subtitles_to_video` dan `extract_subtitles_data`.
    - Menghapus route `/api/subtitles` dan `/api/burn-subtitles`.
  - [mobile/scripts/utils/subtitle_burner.py](file:///d:/projects/clipping/mobile/scripts/utils/subtitle_burner.py) & [mobile/scripts/utils/subtitle_fetcher.py](file:///d:/projects/clipping/mobile/scripts/utils/subtitle_fetcher.py):
    - Dihapus permanen dari repositori.
  - [mobile/src/constants/ytdlp.ts](file:///d:/projects/clipping/mobile/src/constants/ytdlp.ts):
    - Menghapus `SUBTITLE_YTDL_OPTS`.
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - Menghapus interface `SubtitleCue`, `ClipTemplateConfig`, `VideoGlobalConfig`, fungsi path subtitle (`getSubtitledClipFilename`, `getSubtitledClipOutputFilePath`), dan seluruh API fungsi subtitle/template/burn.
  - [mobile/src/hooks/useClipPlayer.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipPlayer.ts):
    - Menghapus `facecamPlayer`, `isFacecamActiveRef`, `setIsFacecamActive`, dan sinkronisasi `SubtitleCue`.
    - Menjaga single player expo-video untuk pemutaran video streaming maupun file fisik lokal.
  - [mobile/src/components/feed/FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx):
    - Menghapus subtitle cue pills timeline, subtitle editor toolbar/modal, template editor modal, dan tombol ekspor.
    - Mempertahankan kontrol rentang waktu (Start/End), fine-tune Extend (+5, +1) dan Crop (-5, -1), tombol status Trash & Done, serta tombol Download interaktif.
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Menghapus penggunaan `useClipSubtitle`, `useClipTemplate`, `SubtitleOverlay`, serta container layout portrait multi-viewport (`contextBannerBox`, `facecamBox`, dsb.).
    - Menggunakan viewport pemutar video 16:9 bersih dengan `contentFit="contain"`.

## [3ef6f81] - Decouple Facecam Player and Enforce Mobile Hardware-Accelerated Bitrate Capping on Video Cut
- **Konteks Struktural**:
  1. Pengurangan Beban Decoder Native Hardware 50% (Decoupling Facecam Player):
     - Mengatasi kendala lag berat pada pemutaran video lokal di HP berspesifikasi prosesor rendah di mana sebelumnya dua instance `useVideoPlayer` (`player` dan `facecamPlayer`) sama-sama aktif mendekode stream 1080p 60fps secara bersamaan meskipun facecam sedang tidak ditampilkan (`!isFacecamActive`).
     - Menyinkronkan status aktif facecam dari [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx) ke hook [mobile/src/hooks/useClipPlayer.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipPlayer.ts) melalui callback `setIsFacecamActive`. Saat elemen facecam nonaktif, `facecamPlayer` dijaga dalam keadaan idle/pause 100%, sehingga hardware decoder mobile (`MediaCodec`) hanya memproses satu instance video tunggal.
  2. Optimalisasi Parameter Encoding FFmpeg untuk Kompatibilitas Hardware Decoder Mobile (1080p 60fps Prime Quality):
     - Mengalibrasi pipeline re-encode pemotongan klip di [mobile/scripts/utils/clip_downloader.py](file:///d:/projects/clipping/mobile/scripts/utils/clip_downloader.py) dan [mobile/src/constants/ytdlp.ts](file:///d:/projects/clipping/mobile/src/constants/ytdlp.ts) dengan menambahkan batas bitrate dan profil standar industri: `-crf 22`, `-maxrate 8M`, `-bufsize 12M`, `-pix_fmt yuv420p`, `-profile:v high`, `-level 4.2`, serta `-movflags +faststart`.
     - Mencegah ledakan bitrate tak terbatas dari preset `ultrafast` (yang sebelumnya membengkak hingga 30-50 Mbps) yang menyumbat buffer decoder hardware chipset kelas pemula (Helio G-series, Snapdragon 600-series, Unisoc).
     - Menjamin visual tetap 100% prime (1080p 60fps jernih tanpa artifak), ukuran file 3x-4x lebih hemat, serta penempatan atom header `moov` di awal file untuk transisi seek dan loop instan 0ms tanpa stutter.
- **Perubahan Kode Penting**:
  - [mobile/scripts/utils/clip_downloader.py](file:///d:/projects/clipping/mobile/scripts/utils/clip_downloader.py):
    - `download_clip_direct`: Menambahkan opsi `-crf 22`, `-maxrate 8M`, `-bufsize 12M`, `-pix_fmt yuv420p`, `-profile:v high`, `-level 4.2`, `-movflags +faststart`, dan `-b:a 128k` pada pemotongan FFmpeg (HLS maupun progressive).
  - [mobile/scripts/utils/subtitle_burner.py](file:///d:/projects/clipping/mobile/scripts/utils/subtitle_burner.py):
    - `burn_subtitles_to_video`: Menyelaraskan opsi encoder FFmpeg utama dan fallback agar menggunakan `-crf 22`, `-maxrate 8M`, `-bufsize 12M`, `-pix_fmt yuv420p`, `-profile:v high`, `-level 4.2`, dan `-movflags +faststart`.
  - [mobile/src/constants/ytdlp.ts](file:///d:/projects/clipping/mobile/src/constants/ytdlp.ts):
    - `PRIME_CLIP_DOWNLOAD_OPTS`: Menambahkan parameter `-crf 22`, `-maxrate 8M`, `-bufsize 12M`, `-pix_fmt yuv420p`, `-profile:v high`, `-level 4.2`, `-movflags +faststart`, dan `-b:a 128k` pada `external_downloader_args.ffmpeg`.
  - [mobile/src/hooks/useClipPlayer.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipPlayer.ts):
    - Menambahkan `isFacecamActiveRef` dan fungsi callback `setIsFacecamActive`.
    - Membatasi eksekusi `facecamPlayer.replace()`, `currentTime`, dan `play()` pada `syncPlayerSourceForClip`, `centralizedSeek`, `timeUpdate`, `statusChange`, `togglePlayPause`, dan `initializeStreamAndPlayback` hanya saat `isFacecamActiveRef.current === true`.
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Mendestruktur `setIsFacecamActive` dari `useClipPlayer` dan menghubungkannya dengan state `isFacecamActive = isPortrait && templateConfig.facecam.enabled` via `useEffect`.

## [72bce36] - Bundle Core Python Scripts into Native Chaquopy Module for Standalone Builds
- **Konteks Struktural**:
  1. Penyelarasan Bundling Python Native (Chaquopy Source of Truth Preparation):
     - Menyalin seluruh modul skrip Python dari `mobile/scripts/utils` ke folder sumber native Chaquopy di `mobile/modules/python-runner/android/src/main/python/utils/` sesuai permintaan persiapan APK build.
     - Memastikan seluruh modul inti (`subtitle_burner.py`, `stream_extractor.py`, `heatmap.py`, `clip_downloader.py`, `gdrive_downloader.py`, `youtube_auth.py`, dsb.) tertanam langsung di dalam bundle APK.
     - Memungkinkan aplikasi berjalan mandiri (*standalone*) pada mode development build maupun production build tanpa ketergantungan manual pada penyalinan skrip ke shared storage HP.
- **Perubahan Kode Penting**:
  - `mobile/modules/python-runner/android/src/main/python/utils/`:
    - Menambahkan 16 modul skrip dan file otentikasi YouTube/GDrive ke folder sumber Python modul Chaquopy untuk embedding APK otomatis saat Gradle build.

## [61dd4c8] - Remove Dashed Helper Borders from Player and Viewport Elements in Editor Mode
- **Konteks Struktural**:
  1. Penghapusan Border Pembantu Layout Player (Visual Parity dengan Output Ekspor):
     - Menghapus styling border putus-putus (`borderStyle: 'dashed'`, `borderWidth: 1.5`, `borderRadius: 1`) dan kelas helper border (`canvasHelperBorder`, `elementHelperBorder`) dari kontainer player (`canvasWrapper`, `facecamBox`, dan `mainVideoBox`).
     - Memastikan tampilan video player di editor 100% mulus (seamless edge-to-edge) tanpa garis batas visual buatan, mencerminkan tampilan framing video hasil ekspor asli secara presisi.
- **Perubahan Kode Penting**:
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Menghapus kondisional `activeEditorMode === 'template' && styles.canvasHelperBorder` pada `canvasWrapper`.
    - Menghapus kondisional `activeEditorMode === 'template' && styles.elementHelperBorder` pada `facecamBox` dan `mainVideoBox`.
    - Menghapus properti `borderWidth`, `borderStyle`, `borderColor`, dan `borderRadius` pada `styles.canvasWrapper`, `styles.facecamBox`, dan `styles.mainVideoBox`.
    - Menghapus kelas styling `canvasHelperBorder` dan `elementHelperBorder`.

## [26539ae] - Calibrate Template Context Banner Font Size and Vertical Padding to Dynamic Subtitle Base Ratio
- **Konteks Struktural**:
  1. Sinkronisasi Skala Tipografi dan Ruang Vertikal Banner Konteks:
     - Mengganti scaling hardcoded layar mobile (`out_w / 390.0`) dengan formula dimensi acuan terpendek $\min(W, H)$ yang selaras dengan kalibrasi visual subtitle (`base_unit = ref_dim * 0.0833`).
     - Mengalibrasi `fontSize` teks banner konteks secara proporsional terhadap basis tipografi preview (`ctx_fs = round(base_unit * (fontSize / 14))`), menjamin judul konteks tampil tegas, terbaca jelas, dan identik dengan preview.
  2. Kalibrasi Padding Vertikal dan Tinggi Banner FFmpeg Dinamis:
     - Mengalibrasi `paddingY` banner secara dinamis (`ctx_pad = round(base_unit * (paddingY / 14))`) dan menghitung tinggi banner `banner_h = ctx_fs * 1.35 + 2 * ctx_pad`.
     - Menghilangkan distorsi ukuran banner di resolusi berbeda (1080p, 720p, dsb.), menghasilkan proporsi visual ~14% tinggi video portrait yang 100% konsisten dengan layar preview editor.
- **Perubahan Kode Penting**:
  - [mobile/scripts/utils/subtitle_burner.py](file:///d:/projects/clipping/mobile/scripts/utils/subtitle_burner.py):
    - `build_multi_layer_pipeline`: Mengganti perhitungan `scale_factor = out_w / 390.0` dengan `ref_dim = min(out_w, out_h)` dan `base_unit = ref_dim * 0.0833` untuk `ctx_fs` serta `ctx_pad`.

## [2194731] - Calibrate Subtitle Font Scaling to 0.0833 for 100% Visual Parity Across All Aspect Ratios
- **Konteks Struktural**:
  1. Kalibrasi Ukuran Font Visual antara React Native Skia vs FFmpeg FreeType:
     - Mengubah rasio dasar font acuan dari `0.0638` menjadi `0.0833` (`round(min(w, h) * 0.0833)`).
     - Mengompensasi padding Em-box tipografi FreeType dan 8 lapisan stroke offset React Native sehingga bentang teks hasil ekspor FFmpeg mencapai ~70% lebar video, 100% identik dengan tampilan di Subtitle Editor.
  2. Resolusi Kanvas ASS 100% Dinamis Bebas Hardcode:
     - Mengganti hardcoded `PlayResX` dan `PlayResY` (yang sebelumnya 1920/1080) menjadi resolusi video riil (`play_res_x = vw`, `play_res_y = vh`).
     - Memastikan keamanan penuh dan proporsionalitas presisi untuk semua rasio aspek video (16:9 Landscape, 9:16 Portrait, 1:1 Square, 4:3) maupun resolusi (720p -> 60px, 1080p -> 90px, 4K -> 180px).
- **Perubahan Kode Penting**:
  - [mobile/scripts/utils/subtitle_burner.py](file:///d:/projects/clipping/mobile/scripts/utils/subtitle_burner.py):
    - `build_ass_content`: Mengganti `ass_base_fs = 69` dan kanvas fixed dengan `ass_base_fs = max(14, int(round(min(vw, vh) * 0.0833)))`, `ass_outline = max(2.0, round(ass_base_fs * 0.075, 1))`, serta `play_res_x = vw, play_res_y = vh`.
    - `build_drawtext_pipeline`: Mengalibrasi `base_fs` dari `ref_dim * 0.0638` menjadi `round(ref_dim * 0.0833)`.
    - `build_multi_layer_pipeline`: Mengalibrasi `base_fs` fallback drawtext dari `ref_dim * 0.0638` menjadi `round(ref_dim * 0.0833)`.

## [4e8cd78] - Restrict Template Layout and Portrait Mode to Downloaded Done Clips with Active Facecam
- **Konteks Struktural**:
  1. Isolasi Status Aktif Facecam Per-Klip (Mencegah Mode Portrait Otomatis pada Semua Klip):
     - Memastikan bahwa `facecam.enabled` berstatus per-klip murni dan TIDAK mewarisi flag `enabled: true` dari konfigurasi global video. Konfigurasi global hanya membagikan parameter framing (`zoom`, `cropX`, `cropY`).
     - Klip lain atau klip baru default dimulai dengan `facecam.enabled: false` sampai pengguna secara eksplisit menyalakan facecam pada klip tersebut.
  2. Pembatasan Mode Portrait 9:16 Berbasis Syarat Ketat (Mode Edit):
     - Menetapkan bahwa mode portrait 9:16 HANYA aktif bila memenuhi ketiga syarat:
       1. Klip berstatus `done` (`activeClip.status === 'done'`).
       2. Video klip sudah selesai diunduh secara lokal (`isDownloaded === true`).
       3. Facecam dinyalakan (`templateConfig.facecam.enabled === true`) atau banner konteks diaktifkan.
     - Klip yang belum selesai diunduh atau berstatus un-done (stream preview) dijamin 100% tetap berformat 16:9 landscape standar (`styles.fillVideo`), bebas dari pemotongan framing maupun kontainer portrait.
- **Perubahan Kode Penting**:
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - Menyempurnakan tipe `VideoGlobalConfig` agar `facecam` dan `mainVideo` hanya menyimpan `{ zoom, cropX, cropY }` tanpa menyertakan flag `enabled` maupun `portraitEnabled`.
  - [mobile/src/hooks/useClipTemplate.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipTemplate.ts):
    - Menerima `isDownloaded` pada `UseClipTemplateParams`.
    - Mengisolasi `facecam.enabled` agar selalu membaca `clipSaved?.facecam?.enabled ?? false`.
    - Memperketat kalkulasi `isPortrait` agar selalu `false` jika klip belum diunduh atau belum berstatus `done`.
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Mengoper `isDownloaded` ke `useClipTemplate`.
    - Mengembalikan `styles.fillVideo` pada `mainVideoStyle` saat `!isPortrait` agar pemutaran video stream murni 16:9 tanpa transformasi.
  - [mobile/src/hooks/useClipSubtitle.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipSubtitle.ts):
    - Menyelaraskan fallback pembacaan `globalConfig` agar sesuai dengan struktur framing murni `VideoGlobalConfig`.

## [70406b6] - Fix Android FFmpeg drawbox fill syntax error
- **Konteks Struktural**:
  - Memperbaiki kegagalan inisialisasi filter `drawbox` pada binary FFmpeg mobile Android di mana ekspresi string `t=fill` menimbulkan error `Undefined constant or missing '(' in 'fill'`.
  - Mengganti parameter ketebalan menjadi nilai integer absolut `t={banner_h}` yang kompatibel universal di seluruh versi FFmpeg untuk mengisi kanvas banner putih secara penuh dan solid.
- **Perubahan Kode Penting**:
  - [mobile/scripts/utils/subtitle_burner.py](file:///d:/projects/clipping/mobile/scripts/utils/subtitle_burner.py):
    - Mengganti opsi filter `drawbox` dari `t=fill` menjadi `t={banner_h}`.

## [c9128bd] - Implement 1-Pass Multi-Layer Template and Subtitle Video Export in FFmpeg
- **Konteks Struktural**:
  1. Arsitektur Ekspor Multi-Layer 1-Pass FFmpeg Murni:
     - Menggabungkan pemrosesan template orientasi (9:16 Portrait / 16:9 Landscape), viewport facecam 4:3, viewport gameplay 4:3 / 16:9, banner konteks judul, dan subtitle burn-in ke dalam **satu proses tunggal** FFmpeg via `-filter_complex_script`.
     - Menghilangkan rendering bertahap/intermediate files, mencegah kompresi ulang berulang yang menurunkan kualitas visual, serta menjaga sinkronisasi audio murni (`-c:a copy` dengan map `0:a?`).
  2. Kalkulasi Koordinat dan Penskalaan Relatif Kanvas Video (Non-DP):
     - Mem-parsing konfigurasi template frontend (`context`, `facecam`, `mainVideo`) menjadi parameter filter FFmpeg asli (`crop`, `scale`, `pad`, `overlay`, `drawbox`, `drawtext`).
     - Seluruh perhitungan crop (`zoom`, `cropX`, `cropY`) dihitung relatif terhadap resolusi asli video ($W_{in} \times H_{in}$, misal 1920x1080 atau 1280x720) dengan batas genap, menjamin kesesuaian 1:1 antara tampilan editor di perangkat mobile dan video hasil ekspor.
  3. Padding Kanvas Sinkron & Fallback Fleksibel:
     - Menggunakan teknik `pad` pada base stream gameplay untuk membentuk kanvas 1080x1920 hitam tanpa generator warna tak berhingga, menjamin PTS dan durasi tetap sinkron 100%.
     - Mendukung ekspor klip template tanpa subtitle, template dengan subtitle, maupun klip subtitle standar, dengan fallback otomatis ke native `drawtext` jika binary perangkat tidak mengompilasi `libass`.
- **Perubahan Kode Penting**:
  - [mobile/scripts/utils/subtitle_burner.py](file:///d:/projects/clipping/mobile/scripts/utils/subtitle_burner.py):
    - Membuat fungsi `build_multi_layer_pipeline` untuk menyusun complex filtergraph script (.ffcomplex) 5-layer terpadu.
    - Memperbarui `burn_subtitles_to_video` agar menerima parameter `template_data`, mendeteksi orientasi 9:16 portrait vs 16:9 landscape, dan menjalankan eksekusi complex script dengan pemantauan progress throttled.
  - [mobile_api/main.py](file:///d:/projects/clipping/mobile_api/main.py):
    - Memperbarui endpoint `/api/burn-subtitles` agar mengekstrak `template_data` dan meneruskannya ke fungsi `burn_subtitles_to_video`.
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - Menambahkan `templateData?: ClipTemplateConfig` pada antarmuka `BurnSubtitlesParams` dan mem-passing-nya ke runner Python native maupun web API.
  - [mobile/src/hooks/useClipSubtitle.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipSubtitle.ts):
    - Menerima `templateConfig` pada `UseClipSubtitleParams`, memuat fallback template dari disk jika belum aktif di memory, dan mem-passing `templateData` ke `burnClipSubtitles`.
    - Memperbarui validasi agar ekspor tetap berjalan jika template aktif meskipun cue subtitle kosong.
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Menata urutan inisialisasi hook agar `useClipTemplate` diinisialisasi sebelum `useClipSubtitle`, sehingga `templateConfig` aktif langsung diteruskan ke handler ekspor.

## [d0ae0fd] - Implement Video-Level Global Configuration Hierarchy for Template Framing and Subtitle Position
- **Konteks Struktural**:
  1. Arsitektur Konfigurasi Hierarkis (Global Video vs Spesifik Klip):
     - Memisahkan pengaturan editor menjadi dua tingkatan (*scopes*): Tingkat Video (Global/Shared) dan Tingkat Klip (Per-Klip).
     - Menjadikan pengaturan **Facecam** (`enabled`, `zoom`, `cropX`, `cropY`), **Gameplay / Main Video** (`zoom`, `cropX`, `cropY`), **Tipografi Konteks** (`fontSize`, `paddingY`), dan **Posisi Subtitle** (`positionX`, `positionY`) konstan di seluruh klip dari `videoId` yang sama.
     - Sekali pengguna mengatur *crop* kepala streamer atau posisi subtitle pada suatu klip, seluruh klip lain pada video tersebut otomatis mewarisi konfigurasi yang sama tanpa perlu diatur ulang.
  2. Isolasi Data Spesifik Klip:
     - Mempertahankan isi teks judul konteks (`context.text`), cue subtitle (`cues`), dan override ukuran font per cue (`cue.fontSize`) tetap terikat secara unik per klip masing-masing.
  3. Tiered Persistence (Tier 1 In-Memory + Tier 2 Private Storage):
     - Mengimplementasikan `VIDEO_GLOBAL_CONFIG_MEMORY_MAP` untuk perpindahan antar-klip instan tanpa jeda pembacaan disk (0ms latency).
     - Menyimpan konfigurasi global secara persisten ke `${INTERNAL_CLIPPING_OUTPUT_DIR}/${videoId}/video_config.json`.
- **Perubahan Kode Penting**:
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - Mendefinisikan antarmuka `VideoGlobalConfig` dan memory map `VIDEO_GLOBAL_CONFIG_MEMORY_MAP`.
    - Menambahkan helper `getVideoGlobalConfigFilePath`, `loadVideoGlobalConfig`, dan `saveVideoGlobalConfig`.
  - [mobile/src/hooks/useClipTemplate.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipTemplate.ts):
    - Memperbarui `checkSavedTemplate` untuk memuat data global video dan menggabungkannya dengan data spesifik klip.
    - Menyelaraskan `handleUpdateFacecam` dan `handleUpdateMainVideo` agar langsung memperbarui `video_config.json` di samping template klip lokal.
    - Menyelaraskan `handleUpdateContext` agar perubahan ukuran/padding banner langsung tersinkronisasi ke seluruh klip.
  - [mobile/src/hooks/useClipSubtitle.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipSubtitle.ts):
    - Menginisialisasi `subtitlePosition` dari `globalConf.subtitlePosition`.
    - Menyimpan pembaruan posisi subtitle di `handleUpdateSubtitlePosition` ke `saveVideoGlobalConfig` agar seluruh klip pada video otomatis sinkron.

## [34b57db] - Synchronize Subtitle Font Scaling Between Frontend Preview and FFmpeg Burner
- **Konteks Struktural**:
  1. Sinkronisasi Presisi Skala Font Subtitle (WYSIWYG 1:1 Parity):
     - Mengatasi kendala visual di mana ukuran teks subtitle pada hasil ekspor FFmpeg menciut (~37% lebih kecil) dibandingkan dengan tampilan preview mode edit di HP.
     - Mengubah konstanta skala font di backend Python dari rasio hardcoded yang terlalu kecil (`0.045` / 4.5%) menjadi rasio acuan yang sinkron dengan ukuran 14dp di layar mobile (`0.0638` / ~6.4%).
  2. Adaptasi Dimensi Acuan Multi-Orientasi (16:9 Landscape & 9:16 Portrait):
     - Memperbarui kalkulasi skala font di FFmpeg (`build_drawtext_pipeline` dan `build_ass_content`) agar mengonsumsi dimensi terpendek `min(video_width, video_height)` sebagai kanvas acuan.
     - Pada video landscape 16:9 (1920x1080 / 1280x720), acuan adalah tinggi video (1080p / 720p). Pada video portrait 9:16 (1080x1920 / 720x1280), acuan adalah lebar video (1080p / 720p), mencegah teks membengkak dan meluap keluar layar pada konten vertikal.
  3. Responsivitas Kontainer pada Komponen Frontend SubtitleOverlay:
     - Menggantikan penetapan `fontSize: 14` statis pada `<SubtitleOverlay />` dengan penskalaan proporsional berbasis `min(containerWidth, containerHeight)` terhadap tinggi standar viewport mobile (`(windowWidth * 9) / 16`).
     - Teks dan ketebalan outline stroke hitam di preview secara otomatis menyesuaikan ukuran kanvas video aktif secara dinamis.
- **Perubahan Kode Penting**:
  - [mobile/scripts/utils/subtitle_burner.py](file:///d:/projects/clipping/mobile/scripts/utils/subtitle_burner.py):
    - Meneruskan `video_width` dan `video_height` ke `build_ass_content` dan `build_drawtext_pipeline`.
    - Menghitung `ref_dim = min(vw, vh)` dan skala `base_fs = max(14, int(round(ref_dim * 0.0638)))`.
    - Memperbarui kanvas ASS `PlayResX`/`PlayResY` dan `ass_base_fs = 69` agar adaptif terhadap orientasi portrait maupun landscape.
  - [mobile/src/components/feed/SubtitleOverlay.tsx](file:///d:/projects/clipping/mobile/src/components/feed/SubtitleOverlay.tsx):
    - Menghitung `scaleFactor = currentRefDim / baseViewportRef` dan `scaledFontSize = Math.max(8, Math.round(fontSize * scaleFactor))`.
    - Menyesuaikan `strokeScale` pada bayangan outline teks hitam 8 arah.

## [Unreleased] - Enforce Android RenderNode Outline Clipping and TextureView Surface on Facecam and Gameplay Viewports
- **Konteks Struktural**:
  1. Pencegahan Kebocoran Transformasi Video (Android RenderNode Outline Clipping):
     - Mencegah transformasi hardware scaling dan pan zoom pada `VideoView` facecam menembus kontainer induk dan menutupi viewport gameplay di bawahnya saat di-zoom.
     - Mengaktifkan `borderRadius: 1` pada style `facecamBox` dan `mainVideoBox` untuk menginstruksikan sistem Android ViewOutlineProvider menerapkan `setClipToOutline(true)`.
  2. Migrasi Surface Rendering ke Hardware TextureView (`surfaceType="textureView"`):
     - Menetapkan properti `surfaceType="textureView"` secara eksplisit pada komponen `<VideoView>` untuk facecam maupun gameplay.
     - Berbeda dengan `SurfaceView` default yang merender overlay independen di luar pohon hierarki tampilan (sehingga mengabaikan properti `overflow: 'hidden'`), `TextureView` terintegrasi penuh ke dalam hierarki RenderNode Android sehingga seluruh proses pemotongan batas, penumpukan lapisan (Z-order), dan clipping outline dieksekusi dengan sempurna.
- **Perubahan Kode Penting**:
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Menambahkan `surfaceType="textureView"` pada kedua instance `<VideoView />` (facecamPlayer dan main player).
    - Menambahkan `borderRadius: 1` pada `styles.facecamBox` dan `styles.mainVideoBox`.

## [7648172] - Adapt Gameplay Viewport to 4:3 Ratio with Pure 16:9 Video Source Cropping when Facecam Active
- **Konteks Struktural**:
  1. Penyesuaian Viewport Gameplay 4:3 Otomatis saat Facecam Aktif:
     - Mengubah aspek rasio kontainer viewport gameplay (`mainVideoBox`) secara dinamis menjadi `4:3` khusus saat elemen facecam aktif (`isFacecamActive`).
     - Jika facecam dinonaktifkan (baik mode landscape murni maupun portrait dengan banner konteks saja), rasio viewport gameplay otomatis kembali ke `16:9`.
  2. Pemotongan Non-Destruktif Sumber Video 16:9 (*Pure 16:9 Source Cropping*):
     - Mempertahankan video asli 16:9 tanpa *stretch* maupun distorsi, dengan menghitung `baseVideoWidth = h * (16 / 9)` di mana `h` adalah tinggi viewport 4:3 (`w * 0.75`).
     - Sisi kiri dan kanan video dipotong rapi secara terpusat (`left = (w - scaledWidth) / 2`) via `overflow: 'hidden'`, dan tetap mendukung kontrol pan horizontal (`cropX`) serta zoom vertikal/horizontal (`cropY`, `zoom`).
  3. Struktur Tumpukan Vertikal Teratas (*Top-Aligned Vertical Stacking*):
     - Memanfaatkan perataan atas kanvas portrait (`justifyContent: 'flex-start'`) sehingga banner konteks, facecam (4:3), dan gameplay (4:3) tersusun rapi mengisi area atas kanvas.
     - Area bawah yang tersisa dibiarkan kosong secara alami (menampilkan latar belakang hitam kanvas) sebagai ruang aman (*safe margin*) navigasi dan deskripsi video platform tanpa memerlukan komponen overlay pemblokir tambahan.
- **Perubahan Kode Penting**:
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Mendefinisikan flag `isFacecamActive = isPortrait && templateConfig.facecam.enabled`.
    - Memperbarui hook memo `mainVideoStyle` untuk mengkalkulasi dimensi dasar 16:9 terhadap kontainer 4:3 saat facecam aktif.
    - Menambahkan gaya `mainVideoBox43` (`aspectRatio: 4 / 3`) dan `mainVideoBox169` (`aspectRatio: 16 / 9`) pada kontainer `mainVideoBox`.

## [79f7cfa] - Unify Video Player into Single Seamless Canvas Wrapper with Outer-Canvas Relative Subtitles
- **Konteks Struktural**:
  1. Penyatuan Kontainer Kanvas Tunggal (*Unified Canvas Wrapper*):
     - Menghapus percabangan pohon JSX ganda yang sebelumnya menduplikasi komponen video player dan subtitle overlay untuk mode 9:16 portrait dan 16:9 landscape.
     - Mengimplementasikan satu kontainer induk tunggal (`canvasWrapper`) tanpa padding yang membungkus video player, viewport facecam, banner konteks, dan subtitle.
     - Kontainer tunggal secara dinamis menyesuaikan aspek rasio (`16:9` saat kedua elemen nonaktif, dan `9:16` saat elemen teks konteks dan/atau facecam aktif) tanpa pernah me-*remount* instance `<VideoView>`, mencegah layar hitam sesaat dan lag buffer playback ExoPlayer native.
  2. Presisi Posisi Subtitle Relatif terhadap Kanvas Luar:
     - Menempatkan `SubtitleOverlay` langsung di bawah `canvasWrapper` induk.
     - Pada rasio 16:9, koordinat persentase subtitle presisi terhadap kanvas video horizontal.
     - Pada rasio 9:16, koordinat persentase subtitle bebas ditempatkan di seluruh bentang kanvas vertikal (di atas gameplay, di bawah banner, atau di area mana pun).
- **Perubahan Kode Penting**:
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Mengganti percabangan kondisional `isPortrait ? <canvas916Container> : <videoBox169>` dengan `canvasWrapper` tunggal yang mengonsumsi gaya `canvasPortrait` atau `canvasLandscape`.
    - Memisahkan gaya `mainVideoBox` menjadi `mainVideoBoxPortrait` (`flex: 1`) dan `mainVideoBoxLandscape` (`width: '100%', height: '100%'`).

## [15bb9f2] - Fix FFmpeg Drawtext Filter Fontsize Expression by Computing Absolute Integers
- **Konteks Struktural**:
  1. Resolusi Error Ekspor Subtitle FFmpeg (`Undefined constant h*0.045`):
     - Memperbaiki kegagalan ekspor subtitle video di perangkat Android di mana filter `drawtext` FFmpeg menolak opsi `fontsize=h*0.045` dengan pesan error `Undefined constant or missing '(' in 'h*0.045'`.
     - Mengidentifikasi bahwa pada implementasi FFmpeg `libavfilter/vf_drawtext.c`, konstanta dimensi video input `h` dan `w` hanya tersedia dalam konteks evaluasi koordinat `x` dan `y`, sedangkan `fontsize` harus berupa nilai numerik skalar.
     - Menambahkan helper fungsi `get_video_dimensions` untuk mendeteksi tinggi dan lebar video sumber secara cepat menggunakan `ffmpeg -hide_banner -i` tanpa memerlukan binary `ffprobe` terpisah.
     - Menghitung skala font secara absolut menjadi bilangan bulat murni (`fontsize=round(video_height * 0.045 * (cue_fs / 14))`, misal `fontsize=32` untuk 720p atau `fontsize=49` untuk 1080p) yang kompatibel 100% di semua versi build FFmpeg.
- **Perubahan Kode Penting**:
  - [mobile/scripts/utils/subtitle_burner.py](file:///d:/projects/clipping/mobile/scripts/utils/subtitle_burner.py):
    - Mengimpor modul `re` dan menambahkan helper `get_video_dimensions`.
    - Memperbarui fungsi `build_drawtext_pipeline` untuk menerima parameter `video_height` dan menghasilkan integer `fontsize` murni.
    - Memperbarui `burn_subtitles_to_video` agar mendeteksi resolusi video dan meneruskannya ke pipeline `drawtext` utama dan fallback.

## [7cc5bc0] - Eliminate Android RenderNode Outline Clipping Collapse on Canvas Viewports
- **Konteks Struktural**:
  1. Resolusi Layar Hitam & Hilangnya Teks Saat Keluar dari Mode Template:
     - Mengidentifikasi anomali grafis pada Android di mana saat pengguna keluar dari mode template (ke mode Subtitle atau menutup toolbar), kanvas 9:16 menjadi hitam pekat dan banner teks putih lenyap meskipun konfigurasi template masih aktif.
     - Menemukan akar penyebab pada bug Android RenderNode ketika properti `borderRadius: 1` dan `overflow: 'hidden'` dikombinasikan dengan pencopotan dinamis `borderWidth` (dari 1.5px garis putus-putus menjadi 0px), yang menyebabkan Outline hardware Android mengkliping seluruh isi kontainer ke ukuran nol.
     - Menghapus `borderRadius: 1` dari seluruh kontainer pemutar (`canvas916Container`, `facecamBox`, `mainVideoBox`, `videoBox169`) dan menerapkan `borderWidth` permanen dengan warna `transparent` saat garis bantu tidak aktif.
     - Mengubah perataan vertikal `playerContainer` menjadi `justifyContent: 'center'` agar kanvas 9:16 selalu terpusat stabil di antara kontrol atas dan bawah.
- **Perubahan Kode Penting**:
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Menghapus `borderRadius: 1` dari `videoBox169`, `canvas916Container`, `facecamBox`, dan `mainVideoBox`.
    - Menetapkan garis batas statis (`borderWidth: 1.5`, `borderStyle: 'dashed'`, `borderColor: 'transparent'`) dengan pergantian warna cyan hanya saat `activeEditorMode === 'template'`.
    - Menambahkan batas `maxHeight: '100%'` dan `maxWidth: '100%'` pada `canvas916Container`.

## [56eae0a] - Implement Native 16:9 Absolute Viewport Layout to Prevent Premature Video Truncation
- **Konteks Struktural**:
  1. Resolusi Pemotongan Dini Frame Video pada Viewport Facecam 4:3:
     - Mengatasi kendala visual di mana buffer native ExoPlayer membuang tepi video 16:9 (seperti pipi kanan streamer) saat `VideoView` diberi ukuran 4:3 (`width: 100%, height: 100%`).
     - Mengubah arsitektur layout komponen `<VideoView>` menjadi pemosisian absolut (`position: 'absolute'`) dengan dimensi fisik yang selalu mempertahankan rasio 16:9 murni:
       $$W_{\text{scaled}} = H_{\text{box}} \times \frac{16}{9} \times \text{zoom}, \quad H_{\text{scaled}} = H_{\text{box}} \times \text{zoom}$$
     - Menghitung koordinat posisi `left` dan `top` secara eksplisit sehingga seluruh frame video 16:9 tersimpan utuh di buffer grafis native tanpa ada bagian yang terpotong sebelum waktunya.
- **Perubahan Kode Penting**:
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Menggantikan array transformasi matriks GPU dengan memo style `facecamVideoStyle` dan `mainVideoStyle` berbasis posisi layout absolut (`width`, `height`, `left`, `top`).
    - Menetapkan kontainer luar (`facecamBox` dan `mainVideoBox`) murni sebagai jendela pandang (*viewport clipping window*).

## [2743ce9] - Implement Layout Boundary-Clamped Transforms to Eliminate Viewport Black Cutoff
- **Konteks Struktural**:
  1. Penghapusan Celah Hitam (*Black Cutoff*) pada Sudut Viewport Facecam & Gameplay:
     - Mengidentifikasi akar masalah visual di mana pergeseran crop ($X, Y$) ke area sudut (seperti pojok kanan bawah lokasi streamer) menarik tepi video melewati batas kontainer sehingga menampakkan latar hitam kosong.
     - Menggantikan konstanta offset statis dengan formula pergeseran matematis adaptif berbasis ukuran fisik kontainer aktual (`onLayout`):
       $$\text{maxShiftX} = \frac{W_{\text{scaled}} - W_{\text{box}}}{2}, \quad \text{maxShiftY} = \frac{H_{\text{scaled}} - H_{\text{box}}}{2}$$
     - Mengunci tepi luar video (*boundary clamping*) sehingga saat `cropX = 100%` atau `cropY = 100%`, batas tepi video berhimpit presisi dengan batas kontainer tanpa celah hitam sedikitpun.
  2. Koreksi Urutan Transformasi Matriks React Native:
     - Menempatkan `translateX` dan `translateY` sebelum `scale` di dalam array transformasi gaya untuk mencegah pergeseran teramplifikasi berkali-kali lipat oleh faktor perkalian skala zoom native.
- **Perubahan Kode Penting**:
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Menambahkan state dimensi kontainer `facecamLayout` dan `mainVideoLayout`.
    - Membuat memo helper `facecamTransform` dan `mainVideoTransform` dengan perhitungan batas aman (*safe boundary clamping*).
    - Memasang listener `onLayout` pada `facecamBox`, `mainVideoBox`, dan `videoBox169`.

## [9a517ab] - Support Main Gameplay Transform in 16:9 Landscape and Seamless Canvas Persistence
- **Konteks Struktural**:
  1. Penerapan Transform Zoom & Crop pada Mode Landscape 16:9:
     - Memastikan konfigurasi zoom dan crop pada `templateConfig.mainVideo` tetap berlaku secara visual pada pemutar video landscape 16:9 (`videoBox169`) ketika elemen Konteks dan Facecam tidak diaktifkan.
     - Menetapkan `collapsable={false}`, `borderRadius: 1`, dan `contentFit="cover"` pada `videoBox169` agar transformasi skala GPU terkunci rapi di dalam batas kontainer 16:9.
  2. Preservasi Kanvas 9:16 Tanpa Border Helper di Luar Mode Template:
     - Memastikan tata letak portrait 9:16 (Banner Konteks + Facecam 4:3 + Gameplay 16:9 + Bottom Safe Zone) tetap aktif dan berputar secara presisi ketika pengguna berada di mode Subtitle maupun saat keluar dari seluruh mode editor (`activeEditorMode === null`).
     - Menyembunyikan seluruh garis bantu putus-putus (`canvasHelperBorder` dan `elementHelperBorder`) secara otomatis saat berada di luar mode template, memberikan pengalaman menonton bersih (clean preview).
- **Perubahan Kode Penting**:
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Menerapkan transformasi `scale`, `translateX`, dan `translateY` dari `templateConfig.mainVideo` ke `VideoView` pada `videoBox169`.
    - Menetapkan `collapsable={false}` dan `borderRadius: 1` pada `canvas916Container` dan `videoBox169`.

## [a518179] - Implement Percentage Zoom, Unified X/Y Center Crop Inputs, and Android Outline Clipping
- **Konteks Struktural**:
  1. Input Numerik Persentase & Koordinat Pusat Crop Bersatu (Tanpa Preset Box):
     - Menggantikan tombol preset kotak (1.5x, 2.0x, Kiri, Tengah, Kanan, Atas, Bawah) pada modal Facecam dan Main Gameplay dengan input numerik murni berbasis persentase (%).
     - **Zoom (%)**: Pengguna memasukkan angka persentase langsung (misal 100% = normal, 200% = 2x lebih besar, 300% = 3x lebih besar) yang secara otomatis dikonversi ke faktor skala floating point saat disimpan.
     - **Titik Tengah Crop (X, Y)**: Menggabungkan koordinat X dan Y ke dalam satu baris input numerik berdampingan yang merepresentasikan titik pusat crop/zoom (0% = Kiri/Atas, 50% = Tengah, 100% = Kanan/Bawah).
  2. Resolusi Bocor/Menumpuknya Video Main ke Facecam (Android RenderNode Outline Clipping):
     - Mengatasi kendala visual di Android di mana transformasi hardware scaling pada `VideoView` menembus batas kontainer dan menimpa viewport Facecam.
     - Menetapkan `collapsable={false}` pada `mainVideoBox` dan `facecamBox` untuk mencegah React Native Android meratakan (flatten) ViewGroup kontainer native.
     - Menambahkan `borderRadius: 1` pada style kontainer untuk memicu `setClipToOutline(true)` pada Android `RenderNode`, serta menyetel `zIndex` bertingkat sehingga proses clipping transformasi skala GPU terkunci rapat di dalam batas frame 16:9.
- **Perubahan Kode Penting**:
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Menambahkan `collapsable={false}`, `borderRadius: 1`, dan `zIndex` pada `facecamBox` dan `mainVideoBox`.
  - [mobile/src/components/feed/FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx):
    - Menyesuaikan pembacaan dan penyimpanan zoom persentase (skala basis 100).
    - Memperbarui Modal 7 (Facecam) dan Modal 8 (Main Gameplay) menjadi input numerik persen dan baris koordinat X/Y bersatu.
    - Menambahkan gaya visual `percentageInputRow`, `percentageTextInput`, `cropCoordinatesRow`, dan `cropCoordinateBox`.

## [51ce56b] - Eliminate Mid-Playback Drift Correction to Prevent Decoder Stutter
- **Konteks Struktural**:
  1. Penghapusan Interupsi Decoder Paksa pada `timeUpdate`:
     - Menghapus pengecekan drift berkala `facecamPlayer.currentTime = current` di dalam event listener `timeUpdate` (100ms interval).
     - Menghilangkan micro-stuttering dan re-buffering berulang pada decoder hardware `MediaCodec` yang sebelumnya dipicu oleh perintah `seekTo` paksa saat video sedang berjalan.
  2. Sinkronisasi Titik Awal (Pre-Alignment) & Natural Clocks:
     - Memastikan penyelarasan waktu kedua player hanya dilakukan saat kondisi diskrit: inisialisasi media, perpindahan klip, manual seek/skip, play/pause, serta loop boundary.
     - Membiarkan kedua pemutar berjalan natural pada kecepatan 1.0x tanpa interupsi decoder saat status playback aktif.
- **Perubahan Kode Penting**:
  - [mobile/src/hooks/useClipPlayer.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipPlayer.ts):
    - Menghapus blok drift correction paksa pada listener `timeUpdate`.

## [a22c500] - Implement Synchronized Dual VideoPlayer and 16:9 Bottom Safe Zone
- **Konteks Struktural**:
  1. Resolusi Layar Hitam Viewport Facecam (Android Multi-Surface ExoPlayer Collision):
     - Mengatasi kendala layar hitam pada viewport Facecam yang disebabkan oleh batasan platform Android di mana satu instance native `VideoPlayer` (ExoPlayer) hanya dapat mengikat satu `PlayerView`/`SurfaceView` aktif dalam satu waktu.
     - Mengintroduksi instance sekunder terisolasi `facecamPlayer` pada [mobile/src/hooks/useClipPlayer.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipPlayer.ts) dengan audio dimatikan 100% (`muted = true`).
     - Menyinkronkan seluruh siklus hidup media (`replace`, `play`, `pause`, debounced `seek`, `timeUpdate` drift correction, dan boundary loop) antara `player` utama dan `facecamPlayer`.
  2. Rasio 4:3 Facecam & Proporsi Landscape 16:9 Main Gameplay:
     - Mempertahankan rasio horizontal balok melebar 4:3 (`aspectRatio: 4 / 3`) pada viewport Facecam.
     - Mengubah tata letak viewport gameplay utama (`mainVideoBox`) dari `flex: 1` menjadi rasio landscape 16:9 (`aspectRatio: 16 / 9`, `width: '100%'`).
  3. Ruang Kosong (Bottom Safe Zone) pada Kanvas 9:16 Portrait:
     - Memberikan sisa ruang kosong (~20-25% tinggi kanvas berlatar hitam pekat) di bawah video gameplay utama agar gameplay tidak tertutup atau terhalang oleh komponen UI media sosial (nama akun, teks deskripsi, audio ticker, dan tombol Like/Komentar pada YouTube Shorts, TikTok, dan Instagram Reels).
     - Menjadikan area bawah tersebut sebagai zona aman penempatan teks subtitle overlay.
- **Perubahan Kode Penting**:
  - [mobile/src/hooks/useClipPlayer.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipPlayer.ts):
    - Menginisialisasi `facecamPlayer` dengan `useVideoPlayer(null, (p) => { p.muted = true; ... })`.
    - Menyinkronkan penggantian sumber file lokal/stream, trigger seek, event play/pause, dan koreksi waktu di setiap frame.
    - Mengekspor `facecamPlayer` dalam antarmuka hook.
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Menghubungkan `facecamBox` dengan `player={facecamPlayer}`.
    - Menyesuaikan `styles.mainVideoBox` menjadi `aspectRatio: 16 / 9` untuk menghasilkan margin ruang kosong aman di bagian bawah kanvas 9:16.

## [e299dd2] - Implement Native drawtext Filter Pipeline for Devices Lacking libass
- **Konteks Struktural**:
  1. Penanganan Ketiadaan Filter `subtitles` di Binary FFmpeg Perangkat:
     - Mengatasi kendala `[AVFilterGraph] No such filter: 'subtitles'` yang terjadi ketika binary FFmpeg native perangkat (`libffmpeg.so`) dikompilasi tanpa flag `libass`.
     - Mengimplementasikan deteksi kapabilitas filter secara otomatis (`is_filter_supported`) sebelum eksekusi FFmpeg dimulai.
  2. Implementasi Pipeline Native `drawtext` dengan Penanganan `textfile`:
     - Membangun pipeline burning berbasis filter bawaan `drawtext` yang dijamin aktif pada binary FFmpeg perangkat.
     - Menggunakan opsi `textfile` per cue teks UTF-8 untuk menghilangkan risiko parsing error atau escaping karakter khusus (tanda kurung siku, kutip tunggal/ganda, tanda titik dua, karakter newline, dan simbol persen).
     - Menulis seluruh rantai filter ke berkas skrip `-filter_script:v <path>` untuk mencegah batas panjang karakter pada baris perintah sistem operasi.
  3. Skalabilitas Posisi, Font Sistem, dan Ukuran Resolusi:
     - Mengintegrasikan resolusi font sistem otomatis (`resolve_system_font`), mendeteksi font standar Android (`/system/fonts/Roboto-Bold.ttf`, `Roboto-Regular.ttf`, `DroidSans.ttf`) serta lingkungan pengujian dev.
     - Menghitung koordinat horizontal dan vertikal dinamis berbasis ekspresi FFmpeg `(w-text_w)` dan `(h-text_h)` yang secara otomatis presisi di setiap rasio video (16:9 landscape maupun 9:16 portrait).
     - Mengukur ukuran font adaptif `h*0.045*(cue_fs/14)` dengan garis tepi hitam berketebalan 3px (`borderw=3:bordercolor=black`) untuk menjaga keterbacaan tinggi terhadap latar belakang video.
- **Perubahan Kode Penting**:
  - [mobile/scripts/utils/subtitle_burner.py](file:///d:/projects/clipping/mobile/scripts/utils/subtitle_burner.py):
    - Menambahkan fungsi pembantu `resolve_system_font` dan `is_filter_supported`.
    - Menambahkan generator filterchain `build_drawtext_pipeline` yang memetakan cue subtitle ke berkas teks mandiri dan menyusun script `drawtext`.
    - Mengintegrasikan mekanisme fallback runtime: jika eksekusi filter `subtitles` gagal dengan pesan ketiadaan filter, proses secara otomatis mengulang pembakaran menggunakan pipeline `drawtext`.

## [b5fbe9f] - Fix Subtitle Cue Detection and Fallback Resolution on Export Button
- **Konteks Struktural**:
  1. Sinkronisasi Penuh Ref dan State Subtitle (`subtitlesRef` & `internalSubtitlesRef`):
     - Memperbaiki ketidaksinkronan di mana `internalSubtitlesRef.current` tidak pernah terisi saat `externalSubtitlesRef` dipasok oleh komponen induk, sehingga pengecekan cue saat ekspor selalu menganggap daftar cue kosong (`[]`).
     - Menyinkronkan mutasi `subtitlesRef.current` dan `internalSubtitlesRef.current` secara konsisten pada setiap pembaruan state subtitle.
  2. Resolusi Multi-Tier Cue Subtitle Sebelum Ekspor:
     - Mengimplementasikan deteksi bertingkat pada fungsi ekspor `handleExportSubtitledVideo`:
       1. Tier 1: Mengambil cue dari referensi aktif `subtitlesRef.current`.
       2. Tier 2: Fallback ke state aktif `subtitles`.
       3. Tier 3: Jika ref dan state kosong namun file fisik ada di storage (misalnya saat reload/restorasi), otomatis memuat berkas langsung dari disk via `loadClipSubtitle` dan memulihkan state.
  3. Resolusi Jalur File Video Klip Lokal:
     - Mengintegrasikan `resolvePlayableClipUri` untuk mendeteksi jalur berkas klip lokal (format baru dan legacy format), memastikan video input lokal selalu ditemukan secara akurat sebelum diproses oleh FFmpeg `burnClipSubtitles`.
- **Perubahan Kode Penting**:
  - [mobile/src/hooks/useClipSubtitle.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipSubtitle.ts):
    - Mengimpor `resolvePlayableClipUri` dari `../services/api`.
    - Memperbarui efek sinkronisasi agar memperbarui kedua ref `subtitlesRef` dan `internalSubtitlesRef`.
    - Memperbarui `handleUpdateSubtitlePosition` agar menggunakan `subtitlesRef.current || subtitles` guna mencegah penulisan cue kosong ke disk saat reposisi.
    - Menambahkan mekanisme fallback baca file dari storage pada `handleExportSubtitledVideo` sebelum membatalkan proses dengan notifikasi "Subtitle Kosong".

## [c10d29a] - Implement Dynamic 9:16 Portrait Canvas and Inline Template Toolbar
- **Konteks Struktural**:
  1. Kanvas Otomatis 9:16 Portrait Berdasarkan Status Elemen:
     - Menghilangkan modal pemilih rasio mandiri dan secara otomatis memposisikan kanvas video player ke rasio 9:16 portrait ketika elemen Konteks (banner judul) dan/atau elemen Facecam aktif (`context.enabled || facecam.enabled`).
     - Mengembalikan kanvas video player secara otomatis ke mode lanskap 16:9 saat kedua elemen template dinonaktifkan.
     - Mempertahankan rendering helper border putus-putus saat mode editor template aktif, dan menyembunyikannya saat keluar dari editor template tanpa mengorbankan komposisi aktif.
  2. Toolbar Aksi Template Sejajar (Inline Square Icon Buttons):
     - Menampilkan baris aksi template sejajar (`templateActionsRow`) yang langsung mengekspos 3 tombol icon murni 32x32:
       1. `[Camera]` -> Pengaturan Box Facecam (rasio 4:3, zoom, crop X/Y).
       2. `[Type]` -> Pengaturan Banner Konteks (judul video, font size, padding vertikal).
       3. `[Gamepad2]` -> Pengaturan Main Video Gameplay (zoom, crop X/Y).
     - Menampilkan indikator status rasio aktif di sisi kiri toolbar (`9:16 Portrait` dengan aksen cyan vs `16:9 Landscape` redup).
     - Menampilkan glow/border aktif cyan pada icon `Camera` dan `Type` saat elemen masing-masing diaktifkan.
  3. Arsitektur Dual-Viewport & State Template:
     - Menggunakan dual native viewport `expo-video` (`<VideoView player={player} />`) untuk merender facecam dan gameplay secara tersinkronisasi tanpa latensi atau duplikasi pemutaran audio.
     - Menyimpan konfigurasi per klip (`loadClipTemplate`, `saveClipTemplate`) secara lokal di direktori klip metadata.
- **Perubahan Kode Penting**:
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - Mendefinisikan interface `ClipTemplateConfig`, `DEFAULT_TEMPLATE_CONFIG`, dan fungsi I/O file template (`loadClipTemplate`, `saveClipTemplate`, `deleteClipTemplate`).
  - [mobile/src/hooks/useClipTemplate.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipTemplate.ts):
    - Membuat hook kustom `useClipTemplate` untuk mengelola state template per klip, auto-save persistensi, dan kalkulasi dinamis `isPortrait`.
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Mengintegrasikan hook `useClipTemplate` dan merender kanvas portrait 9:16 yang memuat banner judul, viewport facecam 4:3, main gameplay box, dan subtitle overlay.
  - [mobile/src/components/feed/FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx):
    - Mengimplementasikan `templateActionsRow` dengan indikator badge rasio dan 3 tombol icon sejajar (`Camera`, `Type`, `Gamepad2`).
    - Menyediakan modal pengaturan terfokus untuk masing-masing elemen Konteks, Facecam, dan Main Gameplay.

## [d1666a3] - Reorganize Header Download/Export Actions and Implement Multi-Mode Switcher Toolbar
- **Konteks Struktural**:
  1. Restrukturisasi Tombol Kiri Atas Header (Download & Universal Export):
     - Membatasi tombol kiri atas pada header hanya untuk tombol `Download` saat video klip lokal belum terunduh (`!isDownloaded`).
     - Mengubah tombol kiri atas secara dinamis menjadi tombol `Export` (`<Film size={18} />`) setelah video klip selesai diunduh (`isDownloaded`), mencegah tabrakan visual dengan rentang waktu di tengah.
     - Menghubungkan tombol Export dengan `burnClipSubtitles` (FFmpeg) untuk mengekspor klip dengan subtitle tertempel permanen secara dinamis berdasarkan konfigurasi yang aktif.
  2. Implementasi Baris Pemilih Mode Editor (Row 2 - Mode Switcher Toolbar):
     - Memindahkan toggle editor subtitle dari kiri atas header ke baris pemilih mode tersendiri tepat di bawah baris header kontrol.
     - Menyediakan tombol pemilih mode `Subtitle` dan `Template` (siap untuk penambahan mode lain seperti Audio).
     - Mengatur status default mode editor tertutup (`null`) sehingga antarmuka tetap bersih saat pertama kali membuka klip.
  3. Relokasi Tombol Generate Subtitle ke Toolbar Aksi Subtitle:
     - Memindahkan tombol `Globe` (Generate Subtitle YouTube) dari header ke sisi kiri baris aksi subtitle (`cueActionsRow`), tepat di sebelah kiri tombol `+` (tambah manual).
     - Pengguna dapat langsung menambah subtitle manual atau men-generate subtitle dari YouTube tanpa perlu tombol tambahan di header utama.
- **Perubahan Kode Penting**:
  - [mobile/src/components/feed/FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx):
    - Mengganti tombol header kiri menjadi `Download` saat `!isDownloaded` dan `Film` (Export) saat `isDownloaded`.
    - Menghapus tombol `Globe` dan toggle `<Subtitles />` dari header row.
    - Menambahkan `editorModeRow` dengan tombol toggle `Subtitle` dan `Template` di bawah header row saat `isDownloaded`.
    - Merelokasi tombol `Globe` ke `leftCueButtonsGroup` sebelum tombol `+`.
    - Menambahkan `styles.exportBtn`, `styles.editorModeRow`, `styles.modeToggleBtn`, dan `styles.templateModeContainer`.
  - [mobile/src/hooks/useClipSubtitle.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipSubtitle.ts):
    - Mengintegrasikan `isExportingSubtitle` dan `handleExportSubtitledVideo` yang memanggil `burnClipSubtitles` via FFmpeg.
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Mengelola state `activeEditorMode` dan menghubungkan `isExportingSubtitle` serta `handleExportSubtitledVideo` ke `FeedTopControls`.

## [dcc6a59] - Minimize Subtitle Editor UI Elements, Toolbar Action Buttons, and Modal Forms
- **Konteks Struktural**:
  1. Simplifikasi Toolbar Action Buttons (Mengurangi Kepadatan Visual & Tabrakan UI):
     - Mengubah tombol tambah cue manual `+ Subtitle` menjadi tombol icon murni berukuran 32x32 pixel (`<Plus size={16} />`), menghilangkan teks `+ Subtitle` dan redundansi simbol ganda.
     - Mengubah tombol indikator posisi global `X:... Y:...` di sebelahnya menjadi tombol icon murni 4-arah berukuran 32x32 pixel (`<Move size={15} />`), selaras secara simetris dengan tombol-tombol icon aksi di sisi kanan.
  2. Simplifikasi Form Modal Posisi Global (X, Y):
     - Memperpendek label seksi menjadi `KOORDINAT X` dan `KOORDINAT Y` (menghapus keterangan horizontal/vertikal dalam kurung).
     - Menghapus baris petunjuk redundant (`0 = Kiri, 50 = Tengah, 100 = Kanan` dan `15 = Atas, 50 = Tengah, 85 = Bawah`).
     - Menyederhanakan tombol quick preset menjadi nama murni (`Kiri`, `Tengah`, `Kanan` dan `Atas`, `Tengah`, `Bawah`) tanpa teks angka kurung.
     - Mengubah label tombol reset default menjadi `Reset`.
  3. Pembersihan Icon pada Seluruh Tombol Submit Modal:
     - Menghapus icon centang `<Check />` pada tombol submit di seluruh modal editor (Modal Edit Teks, Modal Ukuran Font, Modal Rentang Waktu, dan Modal Posisi Global), menyisakan teks `Simpan` yang bersih dan minimalis.
- **Perubahan Kode Penting**:
  - [mobile/src/components/feed/FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx):
    - Mengganti tombol `addCueBtn` dan `positionBtn` menjadi square icon button 32x32 pixel (`styles.addCueBtn`, `styles.positionBtn`).
    - Menghapus import dan pemanggilan icon `Check` pada tombol `Simpan` di Modal 2, 3, 4, dan 5.
    - Memperbarui label, teks preset, tombol reset, dan menghapus hint text pada modal posisi global.

## [7f14bbc] - Eliminate Subtitle Overlay Shift and Flickering with Synchronous Flexbox Centering
- **Konteks Struktural**:
  1. Akar Penyebab Pergeseran Posisi Subtitle (Shift/Glitch dari Kanan Bawah ke Tengah):
     - Sebelumnya, [SubtitleOverlay.tsx](file:///d:/projects/clipping/mobile/src/components/feed/SubtitleOverlay.tsx) menggunakan `onLayout` pada blok teks untuk mengukur dimensi lebar dan tinggi teks (`textLayout.width`, `textLayout.height`) demi menerapkan translasi `translateX: -width / 2` dan `translateY: -height / 2`.
     - Karena state dimensi teks diinisialisasi dengan `{ width: 0, height: 0 }` dan `onLayout` berjalan secara asinkron di native bridge, pada frame pertama setiap kemunculan cue subtitle, elemen ter-render di titik `(positionX%, positionY%)` dengan sudut kiri-atas (tanpa translasi offset).
     - Setelah layout teks terukur pada frame berikutnya, barulah elemen melompat/bergeser ke posisi tengah. Hal ini menimbulkan efek visual bergeser dari kanan bawah ke kiri atas serta kedipan (*keclap*).
  2. Solusi Flexbox Sinkron & Pemetaan Offset Persentase Container Murni:
     - Mengubah container overlay menjadi pembungkus penuh berukuran 16:9 (`position: 'absolute', top: 0, left: 0, right: 0, bottom: 0`) dengan `alignItems: 'center'` dan `justifyContent: 'center'`.
     - Dalam struktur ini, flexbox Yoga secara native dan sinkron langsung menempatkan teks tepat di titik tengah $(50\%, 50\%)$ video sejak frame pertama tanpa perlu mengukur dimensi teks sama sekali.
     - Posisi dinamis $(X\%, Y\%)$ dicapai dengan translasi murni terhadap dimensi container:
       `translateX = ((positionX - 50) / 100) * containerWidth`
       `translateY = ((positionY - 50) / 100) * containerHeight`
     - Menghapus ketergantungan `onLayout` dan state dimensi pada teks, sehingga kemunculan subtitle 100% instan, terkunci di posisi target sejak frame 0, dan bebas dari pergeseran maupun flicker.
- **Perubahan Kode Penting**:
  - [mobile/src/components/feed/SubtitleOverlay.tsx](file:///d:/projects/clipping/mobile/src/components/feed/SubtitleOverlay.tsx):
    - Menggunakan `useWindowDimensions` untuk inisialisasi dimensi container 16:9 fixed secara sinkron.
    - Menghapus state `textLayout` dan callback `onLayout` pada blok teks subtitle.
    - Menerapkan `top: 0, left: 0, right: 0, bottom: 0` dengan `alignItems: 'center'` dan `justifyContent: 'center'` pada `styles.subtitleOverlayContainer`.
    - Menerapkan translasi offset berbasis container `translateX = ((positionX - 50) / 100) * containerWidth` dan `translateY = ((positionY - 50) / 100) * containerHeight`.

## [bf5c4dc] - Implement Subtitle Burner Module and Video Export Endpoint via FFmpeg (ASS Format)
- **Konteks Struktural**:
  1. Konversi Format Konfigurasi Subtitle JSON ke ASS (Advanced SubStation Alpha):
     - Membangun modul mandiri [mobile/scripts/utils/subtitle_burner.py](file:///d:/projects/clipping/mobile/scripts/utils/subtitle_burner.py) yang mengubah array cues dan style JSON menjadi naskah ASS standar industri yang dikenali filter `subtitles` FFmpeg (`libass`).
     - Mengimplementasikan PlayRes 16:9 (1920x1080), titik jangkar tengah (`\an5`), pemetaan koordinat posisi global X dan Y (`\pos(ass_x, ass_y)`), outline tebal dengan warna kontras, serta skala font per-cue proporsional terhadap base 14px di mobile UI.
  2. Ekspor Video Baru Tanpa Merusak File Asli (Non-Destructive Export):
     - Proses pembakaran subtitle membaca file klip asli yang sudah di-download (`<start> - <end>.mp4`) dan membuat file video baru terpisah (`<start> - <end> (Subtitled).mp4`) di folder shared storage `/storage/emulated/0/clipping/output/<videoId>/`.
     - File klip video asli dipertahankan 100% utuh tanpa ditimpa atau dimodifikasi.
  3. Pemisahan Endpoint Pass-Through Murni & Layanan Frontend:
     - Menambahkan endpoint `POST /api/burn-subtitles` pada [mobile_api/main.py](file:///d:/projects/clipping/mobile_api/main.py) untuk pengujian lokal Termux / PC.
     - Menyediakan service function `burnClipSubtitles`, helper penamaan berkas `getSubtitledClipFilename` dan `getSubtitledClipOutputFilePath`, serta pemetaan kode error terstandarisasi (`INPUT_VIDEO_NOT_FOUND`, `NO_SUBTITLES_TO_BURN`, `FFMPEG_BURN_ERROR`, `OUTPUT_FILE_EMPTY`, `ASS_GENERATION_FAILED`) pada [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts).
- **Perubahan Kode Penting**:
  - [mobile/scripts/utils/subtitle_burner.py](file:///d:/projects/clipping/mobile/scripts/utils/subtitle_burner.py):
    - Membuat fungsi `format_ass_time`, `escape_ffmpeg_filter_path`, `build_ass_content`, dan `burn_subtitles_to_video` dengan pemantauan progress throttled 250ms serta pembersihan berkas temporary.
  - [mobile_api/main.py](file:///d:/projects/clipping/mobile_api/main.py):
    - Mendaftarkan path `mobile/scripts` ke `sys.path` dan mengekspos endpoint `POST /api/burn-subtitles` serta mengaktifkan `POST /api/subtitles`.
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - Menambahkan kode error ekspor subtitle ke `API_ERROR_MAP`.
    - Menambahkan helper fungsi alokasi path dan penamaan `getSubtitledClipFilename` dan `getSubtitledClipOutputFilePath`.
    - Menambahkan antarmuka `BurnSubtitlesParams`, `BurnSubtitlesResult`, dan fungsi pemanggilan `burnClipSubtitles`.

## [a9be56d] - Omit Redundant Base Properties from Subtitle Cue Array and Auto-Inject Defaults at Visual Layer
- **Konteks Struktural**:
  1. Penghapusan Properti Base yang Redundan dari Objek Subtitle Cue:
     - Menyimpan nilai konfigurasi default (seperti `fontSize: 14`) ke setiap elemen objek subtitle dalam array membebani ukuran berkas JSON dan menimbulkan redundansi struktural.
     - Memastikan properti `fontSize` tidak pernah ditulis ke objek `SubtitleCue` jika nilainya sama dengan nilai base default (14) atau tidak mengalami override.
     - Nilai posisi (X, Y) tetap tersimpan murni sebagai konfigurasi global pada tingkat `style` (`style.positionX`, `style.positionY`) dan tidak pernah disisipkan ke properti cue per-subtitle.
  2. Injeksi Dinamis Nilai Base pada Layer Visual & Modal Sementara:
     - Layer visual pemutar video ([SubtitleOverlay.tsx](file:///d:/projects/clipping/mobile/src/components/feed/SubtitleOverlay.tsx) & [FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx)) secara otomatis menginjeksikan fallback base `14` saat properti `fontSize` pada cue bernilai kosong (`undefined`).
     - Saat modal pengeditan ukuran font dibuka ([FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx)), nilai `14` diinjeksikan sementara ke dalam state input agar pengguna dapat melihat dan mengubahnya dengan mudah tanpa memutasi array data secara prematur.
     - Jika pengguna menyimpan kembali ukuran font ke nilai base (14), properti `fontSize` secara otomatis dihapus (`delete merged.fontSize`) dari cue bersangkutan.
- **Perubahan Kode Penting**:
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - Memperbarui [normalizeSingleTrackCues](file:///d:/projects/clipping/mobile/src/services/api.ts#L1340-L1356) dan [sliceCuesForClip](file:///d:/projects/clipping/mobile/src/services/api.ts#L1418-L1435) agar mengabaikan penambahan properti `fontSize` jika nilainya sama dengan 14 atau tidak ada override.
  - [mobile/src/hooks/useClipSubtitle.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipSubtitle.ts):
    - Menghapus properti default `fontSize: 14` saat pembuatan cue baru di `handleAddCue`.
    - Menghapus properti `fontSize` (`delete merged.fontSize`) pada `handleUpdateCue` saat nilai pembaruan adalah 14 atau `undefined`.
  - [mobile/src/components/feed/FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx):
    - Menghapus properti `fontSize` (`{ fontSize: undefined }`) saat modal font disimpan dengan nilai sama dengan base (14).

## [b62787a] - Implement Global Subtitle Position (X, Y) Control with Center-Anchored Percentage Coordinates
- **Konteks Struktural**:
  1. Pengaturan Posisi Subtitle Global Tanpa Per-Cue Complexity:
     - Memposisikan subtitle secara individual per-cue terlalu membebani pengguna dan mempersulit alur kerja editing. Seluruh subtitle kini diatur posisinya secara terpadu (global) terhadap frame 16:9 video player.
     - Menambahkan tombol indikator posisi `Posisi (X, Y)` di sebelah tombol `+ Subtitle` pada toolbar editor [FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx).
  2. Sistem Koordinat Relatif Berbasis Titik Pusat (Center Anchor) pada Skala 0 - 100:
     - Nilai koordinat X dan Y menggunakan skala perbandingan dimensi frame video (0 sampai 100, bukan pixel), di mana X=50 adalah horizontal center, dan Y=85 adalah area lower-third standar.
     - Titik pusat teks subtitle (`textContainer`) diukur secara presisi via `onLayout` dan di-offset dengan `translateX: -width/2` dan `translateY: -height/2`. Titik tengah blok teks selalu terkunci di `(X%, Y%)`.
     - Nilai input berupa raw numeric input yang fleksibel mendukung angka negatif (misal `-3` untuk posisi di luar frame) maupun lebih dari 100 (misal `101`).
  3. Modal Pengaturan Posisi dengan Quick Preset:
     - Modal menyediakan input raw untuk X dan Y, tombol preset instan (Kiri 25, Tengah 50, Kanan 75 untuk X; Atas 15, Tengah 50, Bawah 85 untuk Y), tombol reset default, serta tombol simpan.
     - Posisi tersimpan otomatis ke dalam struktur data file JSON klip (`style.positionX`, `style.positionY`) dan dimuat kembali secara otomatis saat membuka klip.
- **Perubahan Kode Penting**:
  - [mobile/src/components/feed/SubtitleOverlay.tsx](file:///d:/projects/clipping/mobile/src/components/feed/SubtitleOverlay.tsx):
    - Menerima `positionX` dan `positionY` (default 50 dan 85).
    - Menghitung pergeseran anchor titik tengah teks secara dinamis berdasarkan hasil ukur `onLayout`.
  - [mobile/src/hooks/useClipSubtitle.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipSubtitle.ts):
    - Menambahkan state `subtitlePosition` dan handler `handleUpdateSubtitlePosition`.
    - Menyimpan dan memulihkan nilai posisi pada file JSON klip.
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Menghubungkan state posisi dari `useClipSubtitle` ke `SubtitleOverlay` dan `FeedTopControls`.
  - [mobile/src/components/feed/FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx):
    - Menambahkan tombol `Posisi (X, Y)` dan Modal interaktif untuk pengaturan posisi global.
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - Menstandardisasi `DEFAULT_SUBTITLE_STYLE.positionX` (50) dan `positionY` (85).

## [63d72b7] - Dock Video Player Directly Above Bottom Controls in Fixed 16:9 Landscape Frame and Align Subtitle Position
- **Konteks Struktural**:
  1. Frame Video Player Fixed 16:9 Landscape (`videoBox169`):
     - Mengisolasi rasio aspek pemutar video menjadi fixed 16:9 landscape (`width: '100%'`, `aspectRatio: 16 / 9`, `overflow: 'hidden'`) di dalam [FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx).
     - Video internal (`<VideoView>`) disetel dengan `contentFit="contain"`. Jika sumber video YouTube berformat portrait (9:16) atau rasio non-standar lainnya, video otomatis menyesuaikan proporsi di dalam frame 16:9 dengan black pillarbox samping dan tidak pernah meluap (overflow) ataupun terpotong ke luar layar.
  2. Penempatan Rapat ke Atas Kontrol Playback Bawah (`justifyContent: 'flex-end'`):
     - Mengubah kontainer tengah `playerContainer` agar merapatkan frame video 16:9 persis di atas komponen scrubber dan tombol navigasi pemutar bawah ([FeedPlaybackControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedPlaybackControls.tsx)).
     - Area kosong di bagian atas antara kontrol atas dan video dibiarkan bersih (`#0a0a0a`), sehingga posisi video player tetap stabil dan tidak melonjak saat baris editor subtitle dibuka atau ditutup.
  3. Kalibrasi Posisi Subtitle Overlay Relatif terhadap Frame 16:9:
     - Memindahkan komponen [SubtitleOverlay.tsx](file:///d:/projects/clipping/mobile/src/components/feed/SubtitleOverlay.tsx) ke dalam pembungkus `videoBox169` sehingga sistem koordinat overlay subtitle 100% terkunci dan relatif terhadap frame video 16:9.
     - Menambahkan prop `bottomOffset` (default `12`) dan memperbarui padding horizontal (`left: 12`, `right: 12`) untuk memastikan teks subtitle berada tepat di area bawah yang presisi, mudah dibaca, dan proporsional terhadap layar video.
- **Perubahan Kode Penting**:
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Membungkus `<VideoView>` dan `<SubtitleOverlay>` di dalam `videoBox169` dengan rasio 16:9 fixed dan `overflow: 'hidden'`.
    - Mengubah `playerContainer` dengan `justifyContent: 'flex-end'` agar menempel rapat di atas kontrol bawah.
  - [mobile/src/components/feed/SubtitleOverlay.tsx](file:///d:/projects/clipping/mobile/src/components/feed/SubtitleOverlay.tsx):
    - Menambahkan prop `bottomOffset` dengan nilai default 12.
    - Menyesuaikan padding kiri-kanan menjadi 12 dan `maxWidth: '94%'`.

## [d70ef7f] - Add Subtitle Editor Toggle in Top-Left Controls and Suspend Playback Listening When Closed
- **Konteks Struktural**:
  1. Penambahan Tombol Toggle Mode Editor Subtitle di Kiri Atas:
     - Mengevaluasi posisi needle terhadap array subtitle pada setiap tick video playback secara terus-menerus terasa berat, membebani CPU, dan redundan jika pengguna hanya ingin menonton klip tanpa mengedit subtitle.
     - Menambahkan tombol toggle `<Subtitles>` di pojok kiri atas baris kontrol (`doneLeftGroup`) pada [FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx). Tombol ini memiliki status visual aktif (`#0284c7` dengan border `#38bdf8`) dan inaktif (`rgba(255, 255, 255, 0.08)`).
     - Tombol pengambil subtitle online dari YouTube (ketika track kosong) diganti ikonnya menjadi `<Globe>` agar tidak membingungkan dengan tombol toggle editor `<Subtitles>`.
  2. Penonaktifan Listener Playhead & Penyembunyian Layer Editor Saat Inaktif:
     - Saat mode editor subtitle tertutup (`isSubtitleEditorOpen === false`):
       - Seluruh kontainer `subtitleLayerSection` (horizontal mini track, playhead needle, pil subtitle, dan deretan tombol aksi cue) tidak dirender (`null`), memberikan ruang layar yang lebih bersih dan lapang.
       - Perhitungan `currentMatchingCue` dan listener `useEffect` disetop seketika (`if (!isSubtitleEditorOpen) return;`), menghilangkan beban komputasi re-evaluasi array subtitle selama playback.
       - Seleksi cue aktif di-reset (`onSelectCue(null)`).
  3. Pemisahan Total Rendering Subtitle Playback:
     - Lapisan teks subtitle pada pemutar video ([SubtitleOverlay.tsx](file:///d:/projects/clipping/mobile/src/components/feed/SubtitleOverlay.tsx)) tetap berjalan dan menampilkan subtitle normal secara realtime selama video diputar terlepas dari apakah mode editor subtitle sedang terbuka atau tertutup.
- **Perubahan Kode Penting**:
  - [mobile/src/components/feed/FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx):
    - Menambahkan state `isSubtitleEditorOpen` (default `false`).
    - Memperbarui `currentMatchingCue` dan `useEffect` sinkronisasi needle agar lekas keluar ketika `!isSubtitleEditorOpen`.
    - Mengganti ikon fetch YouTube menjadi `Globe` dan menambahkan tombol toggle `Subtitles` di `doneLeftGroup`.
    - Mengondisikan rendering `subtitleLayerSection` dengan `isSubtitleEditorOpen`.
    - Menambahkan style `subtitleEditorBtnInactive` dan `subtitleEditorBtnActive`.

## [de84dfb] - Standardize Base Subtitle Font Size to 14 and Rebalance Size Presets
- **Konteks Struktural**:
  1. Penyesuaian Base Font Size Subtitle Menjadi 14:
     - Mengubah nilai default ukuran font subtitle dari 20/22 menjadi 14 di seluruh pipeline pembuatan dan rendering ([DEFAULT_SUBTITLE_STYLE](file:///d:/projects/clipping/mobile/src/services/api.ts#L1169-L1178), [sliceCuesForClip](file:///d:/projects/clipping/mobile/src/services/api.ts), [normalizeSingleTrackCues](file:///d:/projects/clipping/mobile/src/services/api.ts), [handleAddCue](file:///d:/projects/clipping/mobile/src/hooks/useClipSubtitle.ts), dan [SubtitleOverlay.tsx](file:///d:/projects/clipping/mobile/src/components/feed/SubtitleOverlay.tsx)).
     - Ukuran 14 terbukti paling proporsional, rapi, dan estetis pada frame video vertikal tanpa memakan ruang visual klip secara berlebihan.
  2. Rekalibrasi Pilihan Preset Font Size di Modal:
     - Mengganti pilihan preset font yang sebelumnya condong ke ukuran besar (`14` hingga `28`) menjadi deretan ukuran yang relevan di sekitar base 14 dan ukuran mikro: `['8', '10', '11', '12', '13', '14', '15', '16', '18']`.
     - Memberikan fleksibilitas bagi pengguna untuk memilih font yang lebih kecil dari 14 atau sedikit lebih besar untuk penekanan tanpa risiko ukuran raksasa yang tidak realistis.
- **Perubahan Kode Penting**:
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - Mengubah base `fontSize` menjadi 14 pada `SubtitleStyle`, `DEFAULT_SUBTITLE_STYLE`, `sliceCuesForClip`, dan `normalizeSingleTrackCues`.
  - [mobile/src/hooks/useClipSubtitle.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipSubtitle.ts):
    - Mengubah default font size `newCue` pada `handleAddCue` menjadi 14.
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Menyesuaikan fallback `fontSize` `SubtitleOverlay` menjadi 14.
  - [mobile/src/components/feed/SubtitleOverlay.tsx](file:///d:/projects/clipping/mobile/src/components/feed/SubtitleOverlay.tsx):
    - Mengubah default prop `fontSize` menjadi 14.
  - [mobile/src/components/feed/FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx):
    - Mengubah inisialisasi state `tempEditSize` dan fallback menjadi 14.
    - Memperbarui daftar preset tombol ukuran font menjadi `['8', '10', '11', '12', '13', '14', '15', '16', '18']`.

## [4948ce4] - Use Raw Text Inputs in Time Range Modal and Slim Down Set to Playhead Button
- **Konteks Struktural**:
  1. Penggunaan Raw Input pada Modal Rentang Waktu Subtitle:
     - Menghapus manipulasi string agresif (`replace(/\D/g, '')` dan `slice`) pada event `onChangeText` di seluruh 6 kotak waktu ([FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx)), karena memicu lompatan kursor dan pemotongan angka saat pengguna sedang mengetik/menghapus.
     - Mengubah seluruh kotak input waktu menjadi raw text input (`onChangeText={setStart...}`) dan memindahkan seluruh parsing serta validasi rentang waktu secara eksklusif ke saat tombol simpan ditekan (`handleSaveTimeRange`).
  2. Perampingan Tombol "Set ke Playhead":
     - Menghilangkan label angka waktu playhead dalam tanda kurung pada tombol sinkronisasi playhead, menyederhanakannya menjadi label ringkas `"Set ke Playhead"`.
     - Perubahan ini membuat tombol lebih ramping, proporsional, dan tidak lagi meluap (overflow) keluar dari kartu modal.
- **Perubahan Kode Penting**:
  - [mobile/src/components/feed/FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx):
    - Mengganti `onChangeText` pada 6 kotak input waktu dengan setter langsung tanpa batasan `maxLength`.
    - Menambahkan parser robust `parseNumber` dan `parseMs` di dalam `handleSaveTimeRange`.
    - Mempersingkat teks tombol playhead menjadi `"Set ke Playhead"`.

## [27629d3] - Implement Track-Wide Scrubbing PanResponder with Dynamic Playhead-Based Cue Selection
- **Konteks Struktural**:
  1. Penggantian Tapping Kotak Individual dengan Full-Track Scrubbing (PanResponder):
     - Memilih subtitle melalui sentuhan jari langsung ke kotak-kotak kecil di timeline rentan meleset karena ukuran durasi pendek yang sempit pada layar ponsel.
     - Mengubah seluruh area horizontal mini track pada [FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx) menjadi bidang interaktif 100% menggunakan `PanResponder`. Pengguna dapat mengetuk (tap), menahan (hold), atau menggeser (drag/scrub) di posisi mana pun sepanjang track untuk menggerakkan pointer playhead needle secara mulus.
  2. Penyeleksian Cue Dinamis Berdasarkan Posisi Needle (Listening Playhead Time):
     - Menghapus event touch `onPress` dari elemen pill subtitle ([SubtitleCuePill](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx#L28-L58)) dengan menetapkan `pointerEvents="none"`.
     - Menyinkronkan subtitle aktif secara dinamis (`currentMatchingCue`): ketika pointer needle menyentuh atau berada di dalam rentang waktu suatu kotak subtitle (`cue.start <= currentClipTime <= cue.end`), subtitle tersebut otomatis terpilih (`selectedCueId = cue.id`). Jika needle berada di celah kosong antar-subtitle, status seleksi otomatis di-reset (`null`).
     - Listener ini juga aktif secara real-time selama video diputar, sehingga aksi edit cue berganti secara dinamis mengikuti adegan klip yang berjalan.
  3. Desain Indikator Playhead Needle Merah Kontras:
     - Mengubah warna jarum playhead needle menjadi merah menyala (`#ef4444`) ber-elevasi tinggi dengan topi penanda di bagian atas (`playheadCap`), serasi dengan scrubber utama di bagian bawah layar.
- **Perubahan Kode Penting**:
  - [mobile/src/components/feed/FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx):
    - Mengintegrasikan `PanResponder` pada `miniTrackWrapper` dengan handler `handleScrubAt` untuk pergeseran scrubbing instan.
    - Menghapus event click pada `SubtitleCuePill` dan mengatur `pointerEvents="none"`.
    - Menambahkan hook sinkronisasi dinamis `useEffect` yang menyeleksi cue saat tersentuh needle atau saat playback berlangsung.
    - Menambahkan penanda needle merah kontras (`playheadNeedle` & `playheadCap`).

## [1310042] - Make Subtitle Track Pills Borderless Text-Free Blocks with Alternating Contrast Colors and True Duration Width
- **Konteks Struktural**:
  1. Penghapusan Cuplikan Teks pada Pill Track Subtitle:
     - Menghapus label teks di dalam kotak subtitle ([SubtitleCuePill](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx#L28-L61)) pada mini track sehingga pill berfungsi sebagai blok warna timeline murni yang bersih.
  2. Pewarnaan Blok Selang-Seling Berkontras Tinggi:
     - Mengimplementasikan skema dua warna komplementer yang kontras tinggi berdasarkan indeks cue:
       - Genap (Even): Biru Langit / Sky Blue (`rgba(14, 165, 233, 0.75)` dengan border `#38bdf8`).
       - Ganjil (Odd): Jingga / Amber Orange (`rgba(245, 158, 11, 0.75)` dengan border `#fbbf24`).
       - Status Terpilih (Selected): Ditegaskan dengan border putih tebal 2px (`#ffffff`), `zIndex: 10`, serta warna solid yang lebih menyala (`#38bdf8` / `#fbbf24`).
  3. Lebar Blok Murni Proporsional (Eliminasi Batas Minimal Width):
     - Menghapus pembatasan artifisial `Math.max(22, ...)` yang sebelumnya disebabkan oleh kebutuhan ruang teks. Lebar blok sekarang dihitung murni `(end - start) / clipDuration * trackWidth` sehingga posisi dan panjang visual blok di timeline akurat 100% merepresentasikan durasi ucapan.
- **Perubahan Kode Penting**:
  - [mobile/src/components/feed/FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx):
    - Mengubah `SubtitleCuePill` menjadi blok warna murni tanpa elemen `Text`.
    - Menerapkan pewarnaan selang-seling `cuePillEven` vs `cuePillOdd` serta highlight `cuePillEvenSelected` / `cuePillOddSelected`.
    - Menghitung `pillWidth` murni proporsional tanpa minimal width `22px`.

## [95a337f] - Replace Subtitle Background Pill with High-Contrast Text Border Outline
- **Konteks Struktural**:
  1. Penghapusan Background Box / Pill Subtitle Berpadding:
     - Mengeliminasi background container semi-transparan (`rgba(0, 0, 0, 0.75)`) dan padding kotak pada overlay subtitle karena mengaburkan visual klip video di balik teks.
     - Mengubah [SubtitleOverlay.tsx](file:///d:/projects/clipping/mobile/src/components/feed/SubtitleOverlay.tsx) menjadi `textContainer` transparan murni tanpa background kotak.
  2. Implementasi Gaya Border / Text Outline (Teks Putih Bersih + Outline Hitam Pekat):
     - Membangun border stroke teks di React Native menggunakan 8-directional offset layer (`STROKE_OFFSETS`) berbobot font tebal (`fontWeight: '800'`) dan `textShadowRadius: 2` berwarna hitam `#000000`.
     - Meletakkan teks utama berwarna putih `#FFFFFF` di atas lapisan outline tersebut. Kombinasi ini memberikan keterbacaan kontras tinggi yang tajam di atas latar belakang video terang maupun gelap tanpa membutuhkan kotak latar belakang.
  3. Standarisasi Default Subtitle Style:
     - Memperbarui [DEFAULT_SUBTITLE_STYLE](file:///d:/projects/clipping/mobile/src/services/api.ts) dengan `backgroundColor: 'transparent'`, `strokeColor: '#000000'`, dan `strokeWidth: 2`.
- **Perubahan Kode Penting**:
  - [mobile/src/components/feed/SubtitleOverlay.tsx](file:///d:/projects/clipping/mobile/src/components/feed/SubtitleOverlay.tsx):
    - Mengganti `subtitlePill` dengan multi-layer text outline di 8 arah koordinat dan teks foreground putih.
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - Mengubah `backgroundColor` default dari `'rgba(0,0,0,0.65)'` menjadi `'transparent'` dan `strokeWidth` menjadi `2`.

## [e6c7856] - Replace Subtitle Cue Drag with 6-Box Start and End Time Range Modal
- **Konteks Struktural**:
  1. Penghapusan Interaksi Drag Horisontal pada Pill Subtitle:
     - Gestur drag sentuh pada elemen pill subtitle (`SubtitleCuePill`) di track mini horizontal berisiko memicu bug sentuhan, konflik seek, dan sulit dikontrol secara presisi di layar HP.
     - Menyederhanakan `SubtitleCuePill` pada [FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx) menjadi `Pressable` murni yang fokus hanya pada penyeleksian cue dan penyesuaian seek head tanpa gestur geser.
  2. Penyediaan Modal Pengaturan Rentang Waktu (6 Kotak Input Angka):
     - Menambahkan tombol icon jam (`Clock`) pada baris aksi cue di sebelah tombol ukuran font (`Aa`).
     - Mengklik tombol membuka modal khusus berisi 6 kotak input numerik presisi:
       - 3 kotak waktu mulai (START): Menit (`MM`), Detik (`SS`), dan Milidetik (`ms`).
       - 3 kotak waktu selesai (END): Menit (`MM`), Detik (`SS`), dan Milidetik (`ms`).
     - Dilengkapi tombol pembantu "Set ke Playhead" untuk masing-masing waktu mulai dan waktu selesai agar editor dapat menyelaraskan timing subtitle langsung dengan posisi frame video saat ini.
  3. Sinkronisasi Waktu Absolut dan Relatif di Hook:
     - Memperbarui [useClipSubtitle.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipSubtitle.ts) agar saat nilai `start` atau `end` dimodifikasi via `onUpdateCue`, nilai `rawStart` dan `rawEnd` ikut tersinkronisasi secara akurat ke video induk.
- **Perubahan Kode Penting**:
  - [mobile/src/components/feed/FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx):
    - Menghapus prop dan handler drag `onShiftTime` dari `SubtitleCuePill`.
    - Menambahkan tombol icon `Clock` di baris kontrol cue.
    - Menambahkan modal pengaturan waktu 6 kotak angka (`startMin`, `startSec`, `startMs`, `endMin`, `endSec`, `endMs`) dengan validasi `clipDuration`.
    - Menyediakan fungsi `setStartToPlayhead` dan `setEndToPlayhead`.
  - [mobile/src/hooks/useClipSubtitle.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipSubtitle.ts):
    - Menyinkronkan `rawStart` dan `rawEnd` saat `updates.start` atau `updates.end` diperbarui.

## [41119a9] - Persist Subtitle JSON in Private App Storage to Prevent Android Scoped Storage Write Errors
- **Konteks Struktural**:
  1. Pengalihan File Subtitle JSON ke Private Storage Aplikasi:
     - Format subtitle merupakan file dokumen JSON (bukan file media). Sesuai aturan Scoped Storage Android, penulisan non-media dari frontend ke shared storage (`/storage/emulated/0/...`) dibatasi oleh OS dan memicu error `ExponentFileSystem.writeAsStringAsync isn't writable`.
     - Mengalihkan path penyimpanan [getClipSubtitleFilePath](file:///d:/projects/clipping/mobile/src/services/api.ts) dan [getRawSubtitlesCacheFilePath](file:///d:/projects/clipping/mobile/src/services/api.ts) sepenuhnya ke internal sandbox aplikasi (`INTERNAL_CLIPPING_OUTPUT_DIR` di bawah `FileSystem.documentDirectory`).
     - Menyertakan fallback pembacaan ke shared storage lama pada [loadClipSubtitle](file:///d:/projects/clipping/mobile/src/services/api.ts) jika file riwayat sebelumnya pernah tersimpan di sana.
  2. Pengamanan Operasi Auto-Save Subtitle di Hook:
     - Mengubah pemanggilan `saveClipSubtitle` pada [useClipSubtitle.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipSubtitle.ts) agar non-blocking (menangani error via `.catch`) sehingga render UI track subtitle langsung aktif tanpa terhenti oleh I/O disk.
- **Perubahan Kode Penting**:
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - Mengalihkan `getClipSubtitleFilePath` dan `getRawSubtitlesCacheFilePath` ke `INTERNAL_CLIPPING_OUTPUT_DIR`.
    - Menyempurnakan `saveClipSubtitle`, `loadClipSubtitle`, `deleteClipSubtitle`, dan `checkClipSubtitleExists` untuk membaca/menulis ke private storage internal.
  - [mobile/src/hooks/useClipSubtitle.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipSubtitle.ts):
    - Mengamankan auto-save subtitle dengan `.catch(...)`.

## [e1f3783] - Standardize Web Player Client Fallback on Cookies Mode Across All Extraction Scripts
- **Konteks Struktural**:
  1. Standarisasi Universal Web Client saat Fallback Cookies:
     - Menstandarkan seluruh skrip ekstraksi backend ([subtitle_fetcher.py](file:///d:/projects/clipping/mobile/scripts/utils/subtitle_fetcher.py), [stream_extractor.py](file:///d:/projects/clipping/mobile/scripts/utils/stream_extractor.py), [heatmap.py](file:///d:/projects/clipping/mobile/scripts/utils/heatmap.py), dan [clip_downloader.py](file:///d:/projects/clipping/mobile/scripts/utils/clip_downloader.py)) agar saat memasuki mode fallback cookies (Pass 2), `player_client` otomatis beralih menjadi `['web', 'mweb']`.
     - Memastikan file kuki format Netscape browser dapat dibaca dan dikirimkan secara universal oleh yt-dlp ke server YouTube tanpa terblokir oleh mekanisme autentikasi bearer token mobile app.
  2. Klasifikasi Error Bot Detection di Frontend (Sesuai Rule 19):
     - Memetakan respons tantangan bot dan sign-in YouTube langsung di [api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts) ke kode error ramah pengguna (`COOKIES_INVALID_OR_EXPIRED` jika cookies terpasang, atau `RATE_LIMIT_EXCEEDED` jika anonim).
- **Perubahan Kode Penting**:
  - [mobile/scripts/utils/subtitle_fetcher.py](file:///d:/projects/clipping/mobile/scripts/utils/subtitle_fetcher.py):
    - Mengatur ulang `player_client` ke `['web', 'mweb']` saat membaca `cookie_path`.
  - [mobile/scripts/utils/stream_extractor.py](file:///d:/projects/clipping/mobile/scripts/utils/stream_extractor.py):
    - Mengatur ulang `player_client` ke `['web', 'mweb']` saat membaca `cookie_path`.
  - [mobile/scripts/utils/heatmap.py](file:///d:/projects/clipping/mobile/scripts/utils/heatmap.py):
    - Mengatur ulang `player_client` ke `['web', 'mweb']` saat membaca `cookie_path`.
  - [mobile/scripts/utils/clip_downloader.py](file:///d:/projects/clipping/mobile/scripts/utils/clip_downloader.py):
    - Mengatur ulang `player_client` ke `['web', 'mweb']` saat membaca `cookie_path`.
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - Mengklasifikasikan error bot/sign-in menjadi `COOKIES_INVALID_OR_EXPIRED` atau `RATE_LIMIT_EXCEEDED` sebelum melempar `ApiError`.

## [85c9829] - Implement Subtitle Language Selection Modal, Multiline Text Modal, and YouTube Android Client Configuration
- **Konteks Struktural**:
  1. Integrasi Modal Pemilihan Bahasa YouTube di Top Bar:
     - Menjadikan tombol Subtitle di kiri atas [FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx) aktif saat track subtitle kosong (`subtitles.length === 0`).
     - Mengklik tombol tersebut membuka modal pemilihan bahasa (`ID`, `EN`, `JA`), dan tombol otomatis di-hide ketika track subtitle telah memiliki data.
  2. Pemindahan Tombol Aksi Cue ke Sisi Kanan (Thumb Friendly):
     - Memindahkan tombol aksi cue (Edit Teks, Ukuran Font, Hapus) ke sisi kanan sejajar dengan tombol `+ Subtitle` (di sisi kiri) menggantikan tombol bahasa inline.
     - Dibuat dalam bentuk tombol icon bersih (`Type`, `Aa`, `Trash2`, `X`).
  3. Modal Input Multiline untuk Teks & Modal Desimal untuk Ukuran Font:
     - Mengklik icon teks membuka modal multiline sehingga pengguna bebas menekan Enter untuk 2 baris atau lebih.
     - Mengklik icon ukuran font membuka modal angka desimal dengan quick preset (14-28px).
     - Menghapus cue langsung bekerja instan tanpa modal konfirmasi.
  4. Penanganan Bot Detection & Fallback Bahasa YouTube:
     - Menambahkan konfigurasi `player_client: ['android', 'web']` dan bahasa `ja` pada `SUBTITLE_YTDL_OPTS` di [ytdlp.ts](file:///d:/projects/clipping/mobile/src/constants/ytdlp.ts) untuk melewati tantangan bot YouTube.
     - Menyempurnakan prefix matching pada [subtitle_fetcher.py](file:///d:/projects/clipping/mobile/scripts/utils/subtitle_fetcher.py) agar tetap fallback ke varian bahasa (seperti `id-ID` atau `ja-JP`).
     - Menghubungkan trigger `onRateLimit` ke `CookiesModal` di [FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx).
- **Perubahan Kode Penting**:
  - [mobile/src/components/feed/FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx):
    - Menambahkan modal bahasa, modal teks multiline, modal ukuran font, dan penyesuaian penempatan tombol icon.
  - [mobile/src/constants/ytdlp.ts](file:///d:/projects/clipping/mobile/src/constants/ytdlp.ts):
    - Menambahkan `player_client: ['android', 'web']` dan `'ja'` pada `SUBTITLE_YTDL_OPTS`.
  - [mobile/scripts/utils/subtitle_fetcher.py](file:///d:/projects/clipping/mobile/scripts/utils/subtitle_fetcher.py):
    - Menyempurnakan fallback pencocokan bahasa (`preferred_lang` prefix matching).
  - [mobile/src/hooks/useClipSubtitle.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipSubtitle.ts):
    - Mempertahankan karakter newline pada `handleUpdateCue` dan trigger `onRateLimit`.
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - Mempertahankan karakter newline pada `normalizeSingleTrackCues`.
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Menghubungkan callback `onRateLimit` dari `useClipSubtitle` ke `CookiesModal`.

## [6c16f22] - Implement CapCut-Style Mini Track Subtitle Layer and Remove SubtitleEditModal
- **Konteks Struktural**:
  1. Penghapusan Total SubtitleEditModal (Bottom Modal):
     - Menghapus komponen modal [SubtitleEditModal.tsx](file:///d:/projects/clipping/mobile/src/components/SubtitleEditModal.tsx) secara permanen sesuai spesifikasi hierarki layer antarmuka pengguna (menghilangkan popup terpisah).
  2. Implementasi CapCut-Style Horizontal Mini Track Subtitle Layer:
     - Menggantikan baris Extend dan Crop pada [FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx) saat klip berstatus `done` dengan mini track horizontal 100% lebar layar dan baris editor/action inline.
     - Setiap cue subtitle dirender sebagai pill interaktif yang dapat digeser (drag horizontal via `PanResponder`) untuk mengatur waktu `start`, serta diklik untuk memilih dan memposisikan seek pemutar video.
     - Indikator jarum playhead bergerak realtime mengikuti `currentClipTime` terhadap durasi klip.
  3. Strict Single-Line Non-Overlapping Subtitle Logic:
     - Implementasi algoritma normalisasi `normalizeSingleTrackCues` pada [api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts) untuk membersihkan newline menjadi 1 baris, mengurutkan kronologis waktu, menggabungkan start yang identik, dan memotong tumpang-tindih rentang cue secara otomatis.
  4. Dynamic Cue Customization & Instant Player Render:
     - Penyesuaian teks secara langsung via single-line TextInput, pengatur ukuran font (`fontSize`), penghapusan cue (`handleDeleteCue`), penambahan manual (`handleAddCue` pada `currentClipTime`), serta tombol cepat pengambil subtitle YouTube per bahasa (ID, EN, JA).
     - Subtitle aktif dirender langsung pada video player melalui [SubtitleOverlay.tsx](file:///d:/projects/clipping/mobile/src/components/feed/SubtitleOverlay.tsx) secara instan tanpa animasi transisi.
- **Perubahan Kode Penting**:
  - [mobile/src/components/SubtitleEditModal.tsx](file:///d:/projects/clipping/mobile/src/components/SubtitleEditModal.tsx):
    - Dihapus total dari repositori.
  - [mobile/src/components/FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx):
    - Menghapus import dan JSX `SubtitleEditModal`.
    - Menghubungkan handler mini track subtitle, helper seek relatif (`handleSeekRelative`), dan binding cue aktif ke `SubtitleOverlay`.
  - [mobile/src/components/feed/FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx):
    - Mengganti space crop/extend saat `status === 'done'` dengan `miniTrackWrapper`, subkomponen `SubtitleCuePill`, dan baris editor/action cue.
  - [mobile/src/components/feed/SubtitleOverlay.tsx](file:///d:/projects/clipping/mobile/src/components/feed/SubtitleOverlay.tsx):
    - Menambahkan dukungan prop `fontSize` dinamis.
  - [mobile/src/hooks/useClipSubtitle.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipSubtitle.ts):
    - Menyediakan state `selectedCueId`, `isFetchingSubtitles`, dan handler `handleAddCue`, `handleUpdateCue`, `handleShiftCueTime`, `handleDeleteCue`, `handleFetchSubtitles`.
  - [mobile/src/services/api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts):
    - Menambahkan properti `fontSize` pada interface `SubtitleCue`, serta fungsi `normalizeSingleTrackCues` dan integrasinya pada `sliceCuesForClip`.

## [dbdfbf3] - Neutralize Time Range Display and Millisecond Edit Colors in FeedTopControls
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

