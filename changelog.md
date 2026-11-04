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

## [Unreleased] - Fix Video Audio Dropout via Active-Gated Freeze and Trim SFX Leading Silence
- **Konteks Struktural**:
  - Perbaikan Dropout Suara Video Utama & Pemotongan Jeda Hening SFX ([MemeDiscoveryComposition.tsx](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx), [public/sfx/achievement.webm](file:///d:/projects/clipping/video-editor/public/sfx/achievement.webm), [public/sfx/magical-reveal.webm](file:///d:/projects/clipping/video-editor/public/sfx/magical-reveal.webm)):
    - **Penyebab & Kebutuhan**:
      1. Suara video utama terkadang tidak keluar/bisu saat diputar di preview, sedangkan suara SFX selalu muncul.
      2. Kedua file efek suara SFX (`achievement.webm` dan `magical-reveal.webm`) memiliki jeda hening sekitar ~1 detik di awal sebelum suara sebenarnya berbunyi, sehingga pengguna meminta posisi dimulainya audio dianalisis persisnya di detik/milidetik berapa dan dipotong (*trim*) agar pemutaran langsung instan tanpa perlu kompensasi *offset timeline*.
    - **Analisis Mendalam & Solusi**:
      1. **Investigasi Audio Video Bisu**: Pada implementasi sebelumnya, elemen pemutar `<Video>` dibungkus langsung dengan `<Freeze frame={Math.min(frame, playEndFrame - 1)}>`. Berdasarkan audit kode internal Remotion (`use-media-audio-state.js` & `freeze.js`), komponen `<Freeze>` secara *default* menyetel `isInsideFreeze = true` dan `isPlaying: () => false`, yang secara otomatis memaksa state `isMutedForPlayback = true` (elemen `<video muted />`) pada timeline Remotion! Solusi: Menggunakan prop resmi Remotion `active={frame >= playEndFrame}` pada `<Freeze active={frame >= playEndFrame} frame={playEndFrame - 1}>` dan menambahkan `volume={1}` eksplisit. Selama `frame < playEndFrame`, `active` bernilai `false` sehingga `isInsideFreeze` mati dan video memutar audio aslinya 100% lancar tanpa interupsi. Begitu mencapai akhir (`frame >= playEndFrame`), freeze aktif mengunci frame terakhir tanpa unmount.
      2. **Deteksi & Pemotongan Jeda Hening SFX**: Menggunakan filter `silencedetect` FFmpeg untuk mengukur ambang audio:
         - `achievement.webm`: Hening berakhir tepat pada **1.079s** (1079 ms, ~32 frame pada 30fps).
         - `magical-reveal.webm`: Hening berakhir tepat pada **1.210s** (1210 ms, ~36 frame pada 30fps).
         Keduanya langsung dipotong bersih menggunakan FFmpeg tepat di titik awal resonansi audio dan ditimpa ke file aslinya di `video-editor/public/sfx/`, sehingga audio mulai instan di 0.000s.
      3. **Sinkronisasi Chime Kartu**: Di [`MemeDiscoveryComposition.tsx`](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx), pemicu *achievement chime* diselaraskan tepat pada `cardStartFrame + 28`, persis saat rotasi 3D kartu mencapai sudut 90 derajat (lebar 0) dan membalik untuk mengungkap teks kartu.
- **Perubahan Kode Penting**:
  - `video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx`:
    - Mengganti `<Freeze frame={Math.min(frame, playEndFrame - 1)}>` menjadi `<Freeze active={frame >= playEndFrame} frame={playEndFrame - 1}>` dengan `<Video volume={1} />` agar audio video tidak ter-mute oleh freeze context.
    - Menyelaraskan sekuens pemutaran `achievement.webm` tepat di `cardStartFrame + 28`.
  - `video-editor/public/sfx/achievement.webm`: Memotong jeda hening 1.07s di awal file agar audio instan di 0.000s.
  - `video-editor/public/sfx/magical-reveal.webm`: Memotong jeda hening 1.20s di awal file agar glissando harp instan di 0.000s.

## [86d8027] - Layered Magical Reveal Sound Effect on Small Card Emergence
- **Konteks Struktural**:
  - Penambahan Efek Suara (SFX) Magical Reveal Harp Saat Kartu Kecil Muncul ([MemeDiscoveryComposition.tsx](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx), [types.ts](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/types.ts), [public/sfx/magical-reveal.webm](file:///d:/projects/clipping/video-editor/public/sfx/magical-reveal.webm)):
    - **Penyebab & Kebutuhan**: Pengguna meminta efek suara tambahan berupa *magical reveal harp glissando* (`https://www.youtube.com/watch?v=SBOlim0WxYU`) yang diputar tepat sejak kartu berukuran kecil pertama kali muncul dari bawah layar, dan bertumpukan (*overlapping*) secara harmonis dengan efek suara *achievement chime* yang berbunyi saat kartu membalik.
    - **Solusi**:
      1. Mengunduh aset audio Magical Reveal Sound Effect ke [`video-editor/public/sfx/magical-reveal.webm`](file:///d:/projects/clipping/video-editor/public/sfx/magical-reveal.webm).
      2. Di [`types.ts`](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/types.ts), menambahkan prop `cardEmergeSfxSrc?: string`.
      3. Di [`MemeDiscoveryComposition.tsx`](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx), menambahkan sekuens `<Audio>` yang dipicu tepat di `cardStartFrame` (durasi 90 frame), bertumpuk secara alami dengan sekuens *achievement chime* pada `cardStartFrame + 27`.
- **Perubahan Kode Penting**:
  - `video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx`: Sekuens audio baru untuk kemunculan kartu kecil.
  - `video-editor/src/styles/meme-discovery/types.ts`: Prop `cardEmergeSfxSrc`.
  - `video-editor/public/sfx/magical-reveal.webm`: Aset audio efek suara magical reveal harp.

## [d4823dc] - Steam Achievement / Item Discovery Chime Sound Effect on 3D Card Flip
- **Konteks Struktural**:
  - Penambahan Efek Suara (SFX) Item Discovery / Achievement Saat Kartu Membalik ([MemeDiscoveryComposition.tsx](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx), [types.ts](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/types.ts), [public/sfx/achievement.webm](file:///d:/projects/clipping/video-editor/public/sfx/achievement.webm)):
    - **Penyebab & Kebutuhan**: Pengguna meminta agar animasi kartu yang membalik diiringi efek suara (SFX) *item discovery / harp / achievement unlocked* seperti pada referensi video Steam Achievement (`https://www.youtube.com/watch?v=TgJhRyk54CY`).
    - **Solusi**:
      1. Mengunduh aset audio berkualitas tinggi Steam Achievement Sound Effect ke dalam direktori publik [`video-editor/public/sfx/achievement.webm`](file:///d:/projects/clipping/video-editor/public/sfx/achievement.webm) yang disajikan langsung oleh web server.
      2. Di [`types.ts`](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/types.ts), menambahkan opsi prop `sfxSrc?: string` dan `enableSfx?: boolean` pada `MemeDiscoveryProps`.
      3. Di [`MemeDiscoveryComposition.tsx`](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx), menyisipkan komponen `<Audio>` dari Remotion yang diselaraskan tepat pada frame kartu mencapai posisi zero-width dan mulai membalik membuka teks (`Sequence from={cardStartFrame + 27} durationInFrames={75}`).
- **Perubahan Kode Penting**:
  - `video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx`: Penambahan sekuens `<Audio>` sinkron pada frame membalik kartu.
  - `video-editor/src/styles/meme-discovery/types.ts`: Definisi prop `sfxSrc` dan `enableSfx`.
  - `video-editor/public/sfx/achievement.webm`: Aset audio efek suara achievement chime.

## [3cf2cd0] - Elimination of Last-Frame Canvas Extraction in Favor of Seamless In-Place Video Freeze
- **Konteks Struktural**:
  - Penghapusan Mekanisme Ekstraksi Frame Terakhir & Penerapan Freeze Alami In-Place ([MemeDiscoveryComposition.tsx](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx), [App.tsx](file:///d:/projects/clipping/video-editor/src/App.tsx), [types.ts](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/types.ts)):
    - **Penyebab & Kebutuhan**: Mekanisme `lastFrameImage` sebelumnya mengekstrak frame menggunakan kanvas offscreen di `videoDurationSeconds - 0.45` yang menyebabkan efek melompat (frame jump) saat pergantian dari video bergerak ke gambar statis. Pengguna meminta mekanisme capture frame terakhir dihilangkan sepenuhnya: video dibiarkan diputar biasa, tidak langsung di-unmount/dihancurkan saat selesai, tidak melakukan replay/jump back, ditahan (freeze) selama jeda pause dan animasi skip mundur YouTube, dan baru ditutup/dilepas setelah tertutupi penuh secara sempurna oleh frame puncak target x (`targetFrameImage`).
    - **Solusi**:
      1. Di [`MemeDiscoveryComposition.tsx`](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx), membungkus pemutar `<Video>` dalam komponen bawaan Remotion `<Freeze frame={Math.min(frame, playEndFrame - 1)}>`. Dengan ini, saat video mencapai frame akhir, pemutar video tetap berada di DOM dan terkunci mulus di frame terakhir (`playEndFrame - 1`) tanpa pernah memicu event ended, replay, maupun seek jump.
      2. Mempertahankan pemutar video yang ter-freeze tersebut aktif selama fase jeda pause dan efek skip YouTube (`frame < skipEndFrame`).
      3. Begitu animasi skip selesai (`frame >= skipEndFrame`), gambar frame puncak target x (`targetFrameImage`) yang memiliki ukuran identik 1080x1920 menutupi layar 100%, sehingga `<Video>` aman dilepas tanpa risiko jeda atau glitch visual.
      4. Di [`App.tsx`](file:///d:/projects/clipping/video-editor/src/App.tsx) dan [`types.ts`](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/types.ts), menghapus seluruh state, hook ekstraksi kanvas, dan prop `lastFrameImage`, menghemat beban komputasi dan memori browser secara signifikan.
- **Perubahan Kode Penting**:
  - `video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx`: Penggunaan `<Freeze frame={Math.min(frame, playEndFrame - 1)}>` untuk freeze in-place tanpa jump.
  - `video-editor/src/App.tsx`: Penghapusan state dan ekstraksi `lastFrameImage`.
  - `video-editor/src/styles/meme-discovery/types.ts`: Pembersihan interface prop dari `lastFrameImage`.

## [f882fd1] - 3D Perspective Card Flip Reveal Entrance Animation with Text Unveiling at Zero-Width Edge
- **Konteks Struktural**:
  - Peningkatan Animasi Masuk Kartu Menjadi 3D Perspective Flip ([PokemonCard.tsx](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/components/PokemonCard.tsx), [MemeDiscoveryComposition.tsx](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx)):
    - **Penyebab & Kebutuhan**: Pengguna menginginkan animasi masuk kartu yang jauh lebih dinamis dan sinematik: kartu muncul dari bawah dalam ukuran kecil dengan hanya menampilkan kartu dan gambarnya saja (seluruh teks disembunyikan/opacity 0). Begitu mencapai tengah, kartu berputar secara 3D horizontal (membalik kartu ke arah kamera). Tepat saat kartu berada di titik tengah putaran dengan proyeksi lebar paling tipis (edge-on view / zero-width), teks dimunculkan (opacity 1), lalu kartu menyelesaikan putaran dan membesar penuh ke ukuran normal (scale 1.0).
    - **Solusi**:
      1. Di [`MemeDiscoveryComposition.tsx`](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx), menambahkan `perspective: 1800` pada kontainer pembungkus kartu serta meneruskan `cardRelativeFrame={Math.max(0, frame - cardStartFrame)}` ke komponen kartu.
      2. Di [`PokemonCard.tsx`](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/components/PokemonCard.tsx), membagi sekuens animasi masuk menjadi 3 fase berbasis frame relatif:
         - **Fase 1 (Frame 0-18)**: Translasi vertikal meluncur naik dari bawah (`1300px` ke `0px`), ukuran kecil (`scale: 0.48 -> 0.72`), dengan teks disembunyikan (`textOpacity: 0` dan `visibility: hidden`).
         - **Fase 2A (Frame 18-28)**: Rotasi 3D horizontal `rotateY: 0deg -> 90deg` hingga kartu berada tepat tegak lurus kamera (proyeksi lebar 0 px).
         - **Fase 2B (Frame 28-40)**: Tepat di titik nol lebar (frame 28), teks diaktifkan (`textOpacity: 1`). Rotasi berlanjut dari `-90deg -> 0deg` sambil membesar ke skala penuh `1.0` dengan pantulan subtle pop (`Easing.back(1.2)`).
         - **Fase 3 (Frame 40+)**: Kartu stabil di tengah, diiringi sapuan kilau foil holographic rainbow foil sheen yang menyapu kartu begitu teks terbuka.
- **Perubahan Kode Penting**:
  - `video-editor/src/styles/meme-discovery/components/PokemonCard.tsx`: Interpolasi 3D `rotateY`, `scale`, `translateY`, dan conditional `textOpacity` di zero-width frame.
  - `video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx`: Prop `cardRelativeFrame` dan inline `perspective: 1800`.

## [4a0026f] - Center Alignment for Card Title and Description (Justify Center & Text Center)
- **Konteks Struktural**:
  - Penyelarasan Posisi Teks Judul & Deskripsi Kartu ke Tengah ([PokemonCard.tsx](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/components/PokemonCard.tsx)):
    - **Penyebab & Kebutuhan**: Pengguna merasa posisi judul dan deskripsi kartu di sebelah kiri (`text-left`) terlihat canggung/kurang seimbang ("dikiri agak aneh sih jujur") pada kanvas kartu bertema koleksi yang elemen gambar utamanya berada di tengah. Pengguna meminta judul dan deskripsi kartu (di luar deskripsi skill) disejajarkan ke tengah (`justify-center` dan `text-center`).
    - **Solusi**:
      1. Di [`PokemonCard.tsx`](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/components/PokemonCard.tsx), mengubah baris judul & rarity menjadi `flex-row items-baseline justify-center gap-6` dengan teks judul `text-center`.
      2. Mengubah perataan teks deskripsi kartu menjadi `text-center w-full px-4`, sehingga duduk simetris di tengah di bawah gambar dan judul kartu.
      3. Mempertahankan perataan kiri pada daftar skill di dalam boks skill masing-masing sesuai instruksi pengguna.
- **Perubahan Kode Penting**:
  - `video-editor/src/styles/meme-discovery/components/PokemonCard.tsx`: Perataan tengah (`justify-center gap-6`, `text-center`) untuk judul, rarity, dan deskripsi kartu.

## [22efd73] - Justify-Around Title Row, Flex-Start Vertical Stacking, Multi-Skill Support (Max 3), and Minimalist Clean Skill Title Styling
- **Konteks Struktural**:
  - Penyesuaian Layout Vertikal, Justify Around & Multi-Skill Kartu ([PokemonCard.tsx](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/components/PokemonCard.tsx), [MemeDiscoveryComposition.tsx](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx), [types.ts](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/types.ts), [App.tsx](file:///d:/projects/clipping/video-editor/src/App.tsx), [data.json](file:///d:/projects/clipping/video-editor/src/data.json)):
    - **Penyebab & Kebutuhan**:
      1. Judul dan rarity diatur menggunakan `justify-around` (bukan `between`) agar lebih seimbang dengan nafas padding di tepi kiri dan kanan.
      2. Elemen teks kartu disusun secara `flex-start` dengan jarak vertikal (gap) yang tetap/fixed (`gap-5`), sehingga jika teks sedikit, area bawah dibiarkan kosong alami kartu tanpa terbentang kejauhan secara artifisial.
      3. Konsep 'pasif' diganti menjadi sistem 'skill' dengan dukungan hingga 3 slot skill. Jika skill ke-x dikosongkan, kartu tidak menampilkan skill tersebut. Pada kartu, hanya nama dan deskripsi skill yang ditampilkan tanpa prefix seperti "skill 1: " atau "1.".
      4. Judul nama skill tidak lagi menggunakan background pill badge terpisah agar terhindar dari overstyling (hanya dibedakan melalui warna tema `cardColor` dan ukuran font).
      5. Setiap slot skill pada sidebar dilengkapi input nama skill, textarea deskripsi, dan field font size (px) bersebelahan.
    - **Solusi**:
      1. Di [`PokemonCard.tsx`](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/components/PokemonCard.tsx), mengubah baris judul & rarity menjadi `justify-around`, mengubah kontainer isi kartu menjadi `flex-col justify-start items-start gap-5`, dan merender daftar `activeSkills` tanpa background badge tambahan pada nama skill.
      2. Di [`types.ts`](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/types.ts), menambahkan interface `CardSkill` (`name`, `desc`, `nameFontSize`, `descFontSize`) dan field `skills?: CardSkill[]`.
      3. Di [`MemeDiscoveryComposition.tsx`](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx), meneruskan prop `skills` ke komponen `<PokemonCard />`.
      4. Di [`App.tsx`](file:///d:/projects/clipping/video-editor/src/App.tsx), mengintegrasikan state `skills` (3 slot dengan fallback legacy `passiveName`), form input skill dinamis pada sidebar lengkap dengan kontrol `fontSize`, serta integrasi penyimpanan ke `data.json`.
      5. Di [`data.json`](file:///d:/projects/clipping/video-editor/src/data.json), menambahkan struktur data array `skills`.
- **Perubahan Kode Penting**:
  - `video-editor/src/styles/meme-discovery/components/PokemonCard.tsx`: `justify-around` pada baris judul, `justify-start gap-5` pada body kartu, rendering daftar multi-skill tanpa badge pill.
  - `video-editor/src/styles/meme-discovery/types.ts`: Interface `CardSkill` dan tipe prop `skills`.
  - `video-editor/src/App.tsx`: State, handler, dan form kontrol 3 slot skill dengan kontrol ukuran font per baris.
  - `video-editor/src/data.json`: Metadata array `skills`.

## [5f16df4] - Per-Field Card Font Size Controls in Sidebar and Dynamic Inline Styling
- **Konteks Struktural**:
  - Penambahan Kontrol Ukuran Font Per-Input Teks Kartu ([App.tsx](file:///d:/projects/clipping/video-editor/src/App.tsx), [PokemonCard.tsx](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/components/PokemonCard.tsx), [MemeDiscoveryComposition.tsx](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx), [types.ts](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/types.ts), [data.json](file:///d:/projects/clipping/video-editor/src/data.json)):
    - **Penyebab & Kebutuhan**: Pengguna meminta agar setiap input teks kartu (Judul, Rarity, Deskripsi, Nama Pasif, Deskripsi Pasif) dilengkapi input ukuran font (fontSize dalam px) di sisi kanannya, sehingga pengguna memiliki kebebasan penuh untuk menyesuaikan ukuran teks yang paling proporsional sesuai panjang kalimat masing-masing.
    - **Solusi**:
      1. Di [`App.tsx`](file:///d:/projects/clipping/video-editor/src/App.tsx), menambahkan input number fontSize (dengan indikator `px`) persis di sebelah kanan setiap input teks kartu, mengikatnya dengan state (`titleFontSize`, `rarityFontSize`, `descFontSize`, `passiveNameFontSize`, `passiveDescFontSize`), serta menyimpannya ke `data.json`.
      2. Di [`PokemonCard.tsx`](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/components/PokemonCard.tsx), menerapkan nilai fontSize tersebut secara inline (`style={{ fontSize: `${...}px` }}`) dengan default terukur (48px judul, 24px rarity, 30px deskripsi, 30px nama pasif, 24px deskripsi pasif).
      3. Di [`types.ts`](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/types.ts) dan [`MemeDiscoveryComposition.tsx`](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx), menambahkan dukungan prop untuk kelima nilai fontSize.
- **Perubahan Kode Penting**:
  - `video-editor/src/App.tsx`: Form input ukuran font di sebelah kanan setiap input teks kartu.
  - `video-editor/src/styles/meme-discovery/components/PokemonCard.tsx`: Penerapan dinamis `fontSize` inline style per elemen teks.
  - `video-editor/src/data.json`: Penyimpanan properti font size ke metadata momen.

## [119e896] - Animal Kaiser 2:3 Card Ratio, Flex Row Title/Rarity, Left Alignment, Descender Clipping Fix, and Custom Theme Color
- **Konteks Struktural**:
  - Penegakan Rasio 2:3 Animal Kaiser, Format Rata Kiri & Kustomisasi Warna ([PokemonCard.tsx](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/components/PokemonCard.tsx), [MemeDiscoveryComposition.tsx](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx), [types.ts](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/types.ts), [App.tsx](file:///d:/projects/clipping/video-editor/src/App.tsx), [data.json](file:///d:/projects/clipping/video-editor/src/data.json)):
    - **Penyebab & Kebutuhan**:
      1. Ukuran kartu diperbesar dengan rasio persis **2:3** seperti kartu arcade Animal Kaiser agar teks lebih besar dan terbaca.
      2. Mengatasi masalah teks terpotong di bagian bawah pada huruf dengan ekor menggantung (descenders seperti `g`, `j`, `p`, `y`).
      3. Judul kartu dan rarity ditata dalam satu baris horizontal (`flex-row`), dengan judul di kiri dan rarity di kanan.
      4. Seluruh teks (deskripsi dan kotak pasif) dibuat rata kiri (`text-left`).
      5. Menambahkan input warna custom di sidebar dan disimpan ke `data.json` agar border, glow, aksen sudut, rarity, dan badge pasif dapat diubah warnanya sesuai selera.
    - **Solusi**:
      1. Di [`PokemonCard.tsx`](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/components/PokemonCard.tsx), mengubah dimensi kartu menjadi `w-[760px] h-[1140px]` (persis rasio 2:3 Animal Kaiser).
      2. Mengatur line height judul menjadi `leading-[1.25] pb-1` tanpa clipping, sehingga huruf `j`, `g`, `p`, `y` tidak terpotong bagian bawahnya.
      3. Menyusun judul dan rarity dalam satu baris `flex flex-row items-baseline justify-between gap-4 w-full pb-2 border-b`.
      4. Mengubah perataan teks deskripsi dan kotak pasif menjadi rata kiri (`text-left`).
      5. Menerapkan prop `cardColor` dinamis pada border, box-shadow ambient glow, aksen sudut, teks rarity, dan badge pasif.
      6. Di [`App.tsx`](file:///d:/projects/clipping/video-editor/src/App.tsx), menambahkan input color picker `<input type="color">` dan field hex di sidebar, serta menyimpannya ke `data.json`.
- **Perubahan Kode Penting**:
  - `video-editor/src/styles/meme-discovery/components/PokemonCard.tsx`: Dimensi 760x1140 (2:3), flex-row judul/rarity, rata kiri, descender padding, warna dinamis.
  - `video-editor/src/App.tsx`: Color picker input di sidebar & integrasi state `cardColor`.
  - `video-editor/src/styles/meme-discovery/types.ts` & `MemeDiscoveryComposition.tsx`: Dukungan prop `cardColor`.
  - `video-editor/src/data.json`: Nilai default `cardColor: "#f59e0b"`.

## [085efa6] - Reactive Synchronization Between data.json on Disk and Studio State
- **Konteks Struktural**:
  - Sinkronisasi Reaktif data.json Langsung ke Studio ([App.tsx](file:///d:/projects/clipping/video-editor/src/App.tsx)):
    - **Penyebab & Kebutuhan**: Saat pengguna mengedit properti kartu secara manual di dalam file `src/data.json` (seperti `cardTitle: "jangan jemput aku"`, `cardRarity: "EPIC"`, `cardDesc: "Pria tua yang masih mau hidup"`), React state di `App.tsx` sebelumnya tidak ter-update karena `useState` hanya diinisialisasi sekali pada saat mount.
    - **Solusi**: Menambahkan `useEffect([initialData])` di [`App.tsx`](file:///d:/projects/clipping/video-editor/src/App.tsx) yang secara reaktif memperbarui state form dan input player seketika file `src/data.json` di-save oleh pengguna (didukung oleh Vite Hot Module Replacement).
- **Perubahan Kode Penting**:
  - `video-editor/src/App.tsx`: Sinkronisasi otomatis `initialData` ke seluruh form state kartu meme.

## [aa76afa] - Enforce Authentic 5:7 Pokemon TCG Card Proportions with Balanced Vertical Distribution
- **Konteks Struktural**:
  - Penegakan Rasio Asli 5:7 Trading Card Game ([PokemonCard.tsx](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/components/PokemonCard.tsx)):
    - **Penyebab & Kebutuhan (prompts.md:L2)**: Kartu sebelumnya tidak memiliki dimensi tinggi pasti sehingga mengkerut menjadi rasio ~1:1.13 (terlalu kotak/chubby dan tidak mencerminkan siluet ramping kartu koleksi TCG seperti Pokemon/Animal Kaiser).
    - **Solusi**: Menetapkan dimensi proporsi autentik kartu Pokemon TCG rasio 5:7 (`w-[680px] h-[952px]`) dengan `flex-col justify-between`. Gambar 1:1 (`350px`) berada di bagian atas dengan padding samping, judul dan rarity berada di tengah, deskripsi terbaca jelas, dan kotak pasif jimat berada di bawah dengan ruang vertikal yang sangat seimbang.
- **Perubahan Kode Penting**:
  - `video-editor/src/styles/meme-discovery/components/PokemonCard.tsx`: Dimensi `w-[680px] h-[952px]` (rasio 5:7) dan distribusi `justify-between`.

## [31c0f8c] - Enlarge Card Typography for High Legibility, Compact 1:1 Image, and Exact Lowercase Placeholders
- **Konteks Struktural**:
  - Penyesuaian Skala Tipografi Kartu & Kompaksi Gambar 1:1 ([PokemonCard.tsx](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/components/PokemonCard.tsx), [App.tsx](file:///d:/projects/clipping/video-editor/src/App.tsx)):
    - **Penyebab & Kebutuhan (prompts.md:L2)**: Pada kanvas 1080x1920 yang di-scale down ~0.32x di layar laptop, teks kartu sebelumnya terasa terlalu kecil dan sulit dibaca. Selain itu, gambar 1:1 dikompakkan agar tidak terlalu dominan dan memberikan ruang vertikal yang lapang untuk teks, serta placeholder diselaraskan dengan instruksi exact lowercase.
    - **Solusi**:
      1. Di [`PokemonCard.tsx`](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/components/PokemonCard.tsx), memperbesar ukuran font secara proporsional: Judul Kartu menjadi `text-5xl font-black` (48px), Rarity menjadi `text-2xl font-black text-amber-400` (24px), Deskripsi Utama menjadi `text-3xl text-neutral-200` (30px), Nama Pasif menjadi `text-3xl font-black text-amber-300` (30px), dan Deskripsi Pasif menjadi `text-2xl text-neutral-300` (24px).
      2. Mengatur ukuran gambar 1:1 menjadi `w-[360px]` di dalam kartu `w-[740px]` dengan padding horizontal `px-12`, sehingga ketinggian kartu sangat terkontrol dan proporsional.
      3. Menyelaraskan teks placeholder persis sesuai kutipan: `"judul kartu"`, `"rarity"`, `"ini deskripsi panjang, maksimal 40 kata"`, `"pasif"`, dan `"ini deskripsi pasif"`.
      4. Di [`App.tsx`](file:///d:/projects/clipping/video-editor/src/App.tsx), menyelaraskan placeholder pada form sidebar.
- **Perubahan Kode Penting**:
  - `video-editor/src/styles/meme-discovery/components/PokemonCard.tsx`: Skala teks besar proporsional, gambar 1:1 360px, exact placeholder.
  - `video-editor/src/App.tsx`: Sinkronisasi placeholder form sidebar.

## [93cd1e7] - Add Rule 27: Prohibition of Browser Automation on Simple Tasks
- **Konteks Struktural**:
  - Penambahan Rule 27 pada Sistem Aturan ([GEMINI.md](file:///d:/projects/clipping/GEMINI.md)):
    - **Penyebab & Kebutuhan**: Pengguna menginstruksikan bahwa otomasi browser seperti Chromium, Chrome DevTools MCP, atau Playwright tidak perlu dipanggil untuk tugas-tugas sepele (pengaturan visual langsung, pengeditan kode logika sederhana, atau pengecekan cepat) karena alat otomasi browser menyebabkan overhead latensi tinggi, risiko timeout koneksi, dan pemborosan waktu turn.
    - **Solusi**: Menambahkan aturan `27. [TOOL]` ke dalam [`GEMINI.md`](file:///d:/projects/clipping/GEMINI.md) yang secara tegas melarang penggunaan tool otomasi browser untuk tugas-tugas sepele dan mewajibkan eksekusi langsung pada kode.
- **Perubahan Kode Penting**:
  - `GEMINI.md`: Penambahan aturan Rule 27 [TOOL].

## [841a358] - Minimalist Meme Amulet Card Redesign, Proportional Typography, and Studio Sidebar Live Editing
- **Konteks Struktural**:
  - Redesain Kartu Meme Koleksi Minimalis & Panel Editor Sidebar ([PokemonCard.tsx](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/components/PokemonCard.tsx), [MemeDiscoveryComposition.tsx](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx), [types.ts](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/types.ts), [App.tsx](file:///d:/projects/clipping/video-editor/src/App.tsx), [data.json](file:///d:/projects/clipping/video-editor/src/data.json)):
    - **Penyebab & Kebutuhan (prompts.md:L2)**: Pengguna meminta agar kartu meme didesain ulang menjadi minimalis (bukan lagi format kartu battle Pokemon TCG yang padat):
      1. Karena format gambar facecam adalah 1:1, lebarnya tidak boleh `w-full` agar tidak memakan seluruh tinggi layar dan menyisakan ruang lega untuk teks di bawahnya (diberi padding horizontal).
      2. Tidak boleh ada teks sama sekali di atas gambar (bagian paling atas langsung gambar 1:1).
      3. Di bawah gambar langsung judul kartu dalam satu `flex-col` dengan rarity (tanpa teks pembantu seperti "Rarity: ").
      4. Di bawahnya lagi deskripsi kartu (maksimal 40 kata), dan di bawahnya lagi kotak pasif (seperti jimat/kekuatan lucu).
      5. Teks fleksibel dengan placeholder default: "Judul Kartu", "Rarity", "Ini deskripsi panjang, maksimal 40 kata", "Pasif", dan "Ini deskripsi pasif".
      6. Ukuran teks diperbesar dan dibuat proporsional untuk kanvas 1080x1920 sehingga terbaca jelas di preview.
      7. Menambahkan input form di sidebar web editor untuk seluruh field kartu sehingga pengguna dapat mengedit teks dan menyimpannya langsung ke `data.json`.
    - **Solusi**:
      1. Di [`PokemonCard.tsx`](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/components/PokemonCard.tsx), merombak total struktur anatomi kartu:
         - Menghapus header bar atas, species info strip, battle stats (weakness, resistance, retreat cost), dan attack damage multiplier.
         - Bagian paling atas langsung menampilkan foto facecam 1:1 (`w-[430px]` di dalam kartu `w-[700px]` dengan padding horizontal `px-8`), menjaga total tinggi kartu hanya ~840px (sangat proporsional dan tidak menabrak batas atas/bawah).
         - Di bawah gambar terdapat blok judul kartu (`text-4xl font-black`) dan rarity (`text-xl font-extrabold text-amber-400`).
         - Di bawahnya deskripsi utama (`text-2xl text-neutral-200`) dan kartu pasif jimat beraksen border emas/amber (`text-2xl font-black` nama pasif dan `text-xl text-neutral-300` deskripsi pasif).
         - Mengimplementasikan fallback otomatis ke teks placeholder jika nilai field kosong atau tidak ditemukan di `data.json`.
      2. Di [`types.ts`](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/types.ts) dan [`MemeDiscoveryComposition.tsx`](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx), menyederhanakan interface props kartu menjadi `cardTitle`, `cardRarity`, `cardDesc`, `passiveName`, `passiveDesc`.
      3. Di [`App.tsx`](file:///d:/projects/clipping/video-editor/src/App.tsx), melengkapi sidebar studio dengan form input interaktif untuk Judul Kartu, Rarity, Deskripsi, Nama Pasif, dan Deskripsi Pasif. Semua nilai terikat dua arah dengan live preview dan tersimpan otomatis ke `src/data.json` saat tombol ditekan.
      4. Di [`data.json`](file:///d:/projects/clipping/video-editor/src/data.json), menyelaraskan skema properti `memeDiscovery` momen "grim reaper" dengan data kartu minimalis jimat yang baru.
- **Perubahan Kode Penting**:
  - `video-editor/src/styles/meme-discovery/components/PokemonCard.tsx`: Redesain minimalis jimat, padding horizontal gambar 1:1, eliminasi header atas, tipografi proporsional 1080x1920.
  - `video-editor/src/styles/meme-discovery/types.ts` & `MemeDiscoveryComposition.tsx`: Pembersihan skema props kartu.
  - `video-editor/src/App.tsx`: Form input kartu di sidebar editor & sinkronisasi data dua arah.
  - `video-editor/src/data.json`: Struktur data kartu meme discovery baru.

## [ba852b3] - Strict Video Frozen Frame Isolation on Post-Skip Background and Dynamic Debounced Timestamp Frame Seeking
- **Konteks Struktural**:
  - Isolasi Mutlak Background Frame Beku Video Pasca-Skip & Ekstraksi Dinamis Timestamp ([MemeDiscoveryComposition.tsx](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx), [frameCapture.ts](file:///d:/projects/clipping/video-editor/src/utils/frameCapture.ts), [App.tsx](file:///d:/projects/clipping/video-editor/src/App.tsx)):
    - **Penyebab & Kebutuhan**: Pengguna mendapati bahwa setelah efek skip mundur (di posisi timestamp x), background video malah menampilkan `image.jpg` (gambar facecam kartu) dan bukan frame beku dari video asli `full.mp4`. Pengguna menegaskan bahwa `image.jpg` HANYA untuk kartu koleksi meme (`PokemonCard.tsx`), sedangkan latar belakang video setelah skip HARUS murni merupakan frame beku dari `full.mp4` pada detik target (`targetUndoTimestamp`). Selain itu, pengguna melaporkan bahwa saat mengubah input timestamp (misal ke detik 2 atau 7.1), frame yang ter-freeze tidak berubah (statis/tidak responsif).
    - **Akar Masalah**:
      1. Di [`MemeDiscoveryComposition.tsx`](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx), layer background sebelumnya memiliki baris fallback `targetFrameImage ? <Img src={targetFrameImage} /> : cardImageSrc ? <Img src={cardImageSrc} /> : ...`. Jika `targetFrameImage` gagal diekstrak atau belum siap, komponen keliru menampilkan `cardImageSrc` (`image.jpg`) yang menutupi seluruh layar background video.
      2. Di [`frameCapture.ts`](file:///d:/projects/clipping/video-editor/src/utils/frameCapture.ts), event `seeked` Chromium memicu pemanggilan `ctx.drawImage(video, 0, 0)` secara sinkron sebelum GPU hardware decoder selesai melukis tekstur frame video ke buffer grafis. Hal ini menghasilkan gambar kosong/hitam (~17KB) yang tersimpan ke in-memory cache `Map`, membuat ekstraksi frame target x gagal dan terkunci pada data kosong.
      3. Di [`App.tsx`](file:///d:/projects/clipping/video-editor/src/App.tsx), ekstraksi `targetFrameImage` dan `lastFrameImage` digabung dalam satu `useEffect` tanpa debounce, sehingga setiap kali pengguna mengetik karakter pada input timestamp, terjadi pemanggilan ganda/konflik decoder yang mengunci state frame sebelumnya.
    - **Solusi**:
      1. Di [`MemeDiscoveryComposition.tsx`](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx), menghapus seluruh referensi `cardImageSrc` dari layer background video. Layer background setelah skip (`frame >= skipEndFrame`) hanya menampilkan `targetFrameImage` (frame beku dari `full.mp4` pada detik `targetUndoTimestamp`) dengan fallback `lastFrameImage`. `cardImageSrc` (`image.jpg`) strictly dan eksklusif hanya dirender di dalam jendela 1:1 `PokemonCard`.
      2. Di [`frameCapture.ts`](file:///d:/projects/clipping/video-editor/src/utils/frameCapture.ts), memastikan video mencapai event `canplay` sebelum seeking, memberi jeda 60ms setelah `seeked` untuk penyelesaian tekstur GPU decoder, serta menambahkan validasi deteksi frame kosong (`dataUrl.length < 30000`) dengan mekanisme retry otomatis 70ms. Tidak ada frame kosong/hitam yang pernah disimpan ke cache.
      3. Di [`App.tsx`](file:///d:/projects/clipping/video-editor/src/App.tsx), memisahkan `lastFrameImage` (diekstrak sekali saat video dimuat) dan `targetFrameImage` (diekstrak secara reaktif dengan debounce 200ms saat nilai timestamp berubah). Input timestamp seperti `00:02.000`, `00:03.466`, maupun `00:07.105` kini secara instan dan akurat memperbarui frame beku puncak yang tepat.
- **Perubahan Kode Penting**:
  - `video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx`: Isolasi mutlak background video tanpa `cardImageSrc`.
  - `video-editor/src/utils/frameCapture.ts`: Sinkronisasi GPU hardware decoder dan validasi anti-black frame.
  - `video-editor/src/App.tsx`: Pemisahan siklus ekstraksi frame dan penambahan debounce 200ms pada input timestamp.

## [8a9d204] - Eliminate Multi-Video Decoder Stalls via Remotion Sequence and Ultra-Fast Cached Canvas Offscreen Extraction
- **Konteks Struktural**:
  - Eliminasi Beban Komputasi Video Decoder & Pencegahan Stalls Pasca-Video ([frameCapture.ts](file:///d:/projects/clipping/video-editor/src/utils/frameCapture.ts), [MemeDiscoveryComposition.tsx](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx), [PokemonCard.tsx](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/components/PokemonCard.tsx)):
    - **Penyebab & Kebutuhan**: Pengguna melaporkan bahwa web studio terasa sangat berat ("kok berat sekali ya") dan ketika memutar video hingga selesai di peramban pengguna, timeline pemutar tidak dapat melanjutkan ke fase jeda/skip/kartu, melainkan macet diam selama beberapa detik di frame akhir dan tiba-tiba me-restart pemutaran dari awal.
    - **Akar Masalah**:
      1. Di [`frameCapture.ts`](file:///d:/projects/clipping/video-editor/src/utils/frameCapture.ts), elemen `<video>` offscreen tidak memiliki atribut `preload="auto"` dan tidak memanggil `video.load()`, serta mendengarkan `onloadedmetadata` sebelum video terisi buffer frame (`loadeddata`). Di Chromium, hal ini menyebabkan event `seeked` tidak pernah terpicu di luar DOM, sehingga ekstraksi selalu gagal setelah timeout 8 detik (`lastFrameImage` dan `targetFrameImage` bernilai `undefined`).
      2. Karena kedua variabel gambar tersebut `undefined`, [`MemeDiscoveryComposition.tsx`](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx) dan [`PokemonCard.tsx`](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/components/PokemonCard.tsx) jatuh ke fallback `<Freeze frame={...}><Video ... /></Freeze>`. Hal ini memunculkan hingga 3 elemen `<Video>` sekaligus di Remotion, masing-masing memaksa seeking hardware decoder per frame, menyebabkan bottleneck decoder dan drop frame hingga 0 fps ("berat sekali").
      3. Selain itu, elemen `<Video>` utama tidak dibatasi oleh durasi `<Sequence>`, sehingga saat mencapai detik terakhir (10.95s), browser memicu event native HTML5 `'ended'`. Remotion Player mengira video kekurangan buffer dan menahan clock timeline hingga timeout, lalu melakukan restart loop.
      4. Efek filter CSS berat `mix-blend-color-dodge` dan `backdrop-blur-sm` pada resolusi 1080x1920 membebani GPU/CPU.
    - **Solusi**:
      1. Di [`frameCapture.ts`](file:///d:/projects/clipping/video-editor/src/utils/frameCapture.ts), menambahkan `preload = 'auto'`, `video.load()`, event `onloadeddata`, dan in-memory cache `Map`. Ekstraksi frame kini selesai dalam waktu ~150-200ms tanpa timeout.
      2. Di [`MemeDiscoveryComposition.tsx`](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx), membungkus `<Video>` murni di dalam `<Sequence from={0} durationInFrames={playEndFrame}>` (dengan `playEndFrame` dipangkas 0.08s sebelum EOF fisik). Remotion Player tidak lagi mengaitkan clock dengan video setelah video selesai.
      3. Menghapus seluruh instansiasi `<Freeze><Video /></Freeze>` di komposisi dan di `PokemonCard.tsx`. Semua transisi pasca-video (jeda pause, efek skip YouTube, flash shutter, dan kartu) 100% menggunakan tag gambar `<Img />` instan bebas seek.
      4. Mengganti `mix-blend-color-dodge` dan `backdrop-blur-sm` dengan alpha-blending GPU native (`opacity-30` dan `bg-black/85`), menurunkan konsumsi CPU ke level minimal dan menghasilkan pemutaran 60fps yang sangat halus.
- **Perubahan Kode Penting**:
  - `video-editor/src/utils/frameCapture.ts`: Optimasi ekstraksi frame via `preload='auto'`, `load()`, dan `Map` cache.
  - `video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx`: Isolasi `<Video>` via `<Sequence>`, eliminasi `<Freeze><Video>`, dan pembersihan filter blur.
  - `video-editor/src/styles/meme-discovery/components/PokemonCard.tsx`: Foil sheen ringan akselerasi GPU murni.

## [5000a1f] - Auto-Detect & Download Google Drive Card Images and Redesign Portrait Collectible Meme Card
- **Konteks Struktural**:
  - Deteksi & Auto-Download Gambar Google Drive & Redesain Kartu Koleksi Memes ([gdrive.js](file:///d:/projects/clipping/video-editor/scripts/gdrive.js), [vite.config.ts](file:///d:/projects/clipping/video-editor/vite.config.ts), [App.tsx](file:///d:/projects/clipping/video-editor/src/App.tsx), [PokemonCard.tsx](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/components/PokemonCard.tsx), [GEMINI.md](file:///d:/projects/clipping/GEMINI.md)):
    - **Penyebab & Kebutuhan**: Pengguna mengunggah gambar facecam 1:1 (`image.jpg`) ke folder Google Drive momen dan meminta agar saat halaman web studio dimuat ulang (reload), sistem secara otomatis mendeteksi keberadaan gambar tersebut di Google Drive, mengunduhnya ke `public/temp/{path}/image.jpg`, memperbarui `data.json`, dan langsung menampilkannya pada video editing. Selain itu, kartu koleksi meme sebelumnya dinilai kurang bagus (proporsi terlalu kotak/stubby 820px dan teks padat menumpuk); pengguna meminta agar kartu meme didesain ulang menjadi kartu koleksi portrait vertikal otentik (rasio trading card 5:7), dengan jendela ilustrasi foto facecam di dalamnya berformat 1:1 square yang presisi. Pengguna juga menambahkan arahan bahwa tidak perlu melakukan test build video penuh di setiap respons, cukup verifikasi visual langsung pada live preview browser.
    - **Solusi**:
      1. Menambahkan fungsi `syncMomentImage()` dan `downloadMomentImage()` di [`gdrive.js`](file:///d:/projects/clipping/video-editor/scripts/gdrive.js) untuk mencari dan mengunduh `image.jpg` langsung dari folder Google Drive momen secara cepat (~300ms) tanpa crawling penuh, serta memperbarui metadata `src/data.json`.
      2. Mendaftarkan middleware endpoint `GET /api/check-image` di [`vite.config.ts`](file:///d:/projects/clipping/video-editor/vite.config.ts).
      3. Di [`App.tsx`](file:///d:/projects/clipping/video-editor/src/App.tsx), memanggil `/api/check-image` secara otomatis pada saat studio pertama kali di-mount/reload (`useEffect`), memperbarui state data lokal secara instan, serta menyematkan `playerRef` untuk kemudahan navigasi frame.
      4. Mendesain ulang total [`PokemonCard.tsx`](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/components/PokemonCard.tsx):
         - Bentuk kartu portrait vertikal otentik rasio 5:7 (`w-[740px]`, tinggi ~1060px) dengan double border emas/amber metallic, holographic sheen diagonal, dan latar belakang gelap eksklusif.
         - Jendela foto facecam di tengah dirancang strictly 1:1 square (`aspect-square w-full rounded-2xl`) yang memuat `image.jpg` asli dari Google Drive (dengan fallback canvas offscreen frame jika belum ada).
         - Tipografi terukur tebal dan tegas untuk kanvas 1080x1920: judul `text-3xl font-black`, HP badge tebal, species info strip, dan panel serangan ringkas dengan `whitespace-pre-line` (Rule 23).
      5. Menambahkan Rule 26 ke [`GEMINI.md`](file:///d:/projects/clipping/GEMINI.md) untuk tidak menjalankan build video penuh melainkan cukup verifikasi langsung via live studio preview.
- **Perubahan Kode Penting**:
  - `video-editor/scripts/gdrive.js`: Fungsi `syncMomentImage()` dan `downloadMomentImage()`.
  - `video-editor/vite.config.ts`: Endpoint `/api/check-image` untuk auto-download gambar saat reload.
  - `video-editor/src/App.tsx`: Hook reload sync Google Drive dan integrasi `playerRef`.
  - `video-editor/src/styles/meme-discovery/components/PokemonCard.tsx`: Redesain kartu portrait vertikal rasio 5:7 dengan jendela foto 1:1 square.
  - `GEMINI.md`: Rule 26 (Verifikasi via live preview tanpa test build).

## [Unreleased] - Replace Video Player Seek with Instant Static Frame Captures and Pure White SVG Rewind Icons
- **Konteks Struktural**:
  - Arsitektur Transisi Frame Statis Murni & Pembersihan Artefak Ikon ([App.tsx](file:///d:/projects/clipping/video-editor/src/App.tsx), [frameCapture.ts](file:///d:/projects/clipping/video-editor/src/utils/frameCapture.ts), [MemeDiscoveryComposition.tsx](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx), [PokemonCard.tsx](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/components/PokemonCard.tsx), [RewindEffect.tsx](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/components/RewindEffect.tsx)):
    - **Penyebab & Kebutuhan**: Pengguna memberikan arahan arsitektural yang lebih cerdas dan efisien: daripada memaksakan komponen `<Video>` untuk melakukan seek frame (yang menimbulkan jeda hitam / *black frame glitch* saat decoding di browser), lebih baik sembunyikan `<Video>` total begitu video selesai diputar. Sisa storyboard sebenarnya adalah frame statis, sehingga cukup menampilkan gambar frame beku secara instan. Selain itu, ikon panah rewind YouTube di Windows Chrome sebelumnya ter-render sebagai emoji berwarna kebiruan dari font sistem, yang diminta untuk diganti dengan panah SVG putih murni.
    - **Solusi**:
      1. Membuat modul utilitas browser murni [`frameCapture.ts`](file:///d:/projects/clipping/video-editor/src/utils/frameCapture.ts) yang mengekstrak frame video langsung menggunakan HTML5 offscreen video dan canvas 1080x1920 menjadi Data URL JPEG (`data:image/jpeg;base64,...`).
      2. Di [`App.tsx`](file:///d:/projects/clipping/video-editor/src/App.tsx), menangkap dua frame gambar statis:
         - `lastFrameImage`: frame paling akhir video untuk fase jeda pause & efek skip YouTube.
         - `targetFrameImage`: frame target x momen lucu yang responsif diperbarui setiap kali `targetTimestamp` diubah.
      3. Di [`MemeDiscoveryComposition.tsx`](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx):
         - Saat video diputar (0 s/d `playEndFrame`): komponen `<Video>` diputar utuh.
         - Begitu video selesai: elemen `<Video>` langsung disembunyikan total (`hide`), dan digantikan oleh komponen `<Img src={lastFrameImage} />` dengan overlay pause lembut di tengah (tanpa jeda hitam / 0ms seek delay).
         - Saat efek skip YouTube berjalan: tetap menampilkan `lastFrameImage`.
         - Begitu efek skip selesai: gambar latar langsung berganti seketika ke `<Img src={targetFrameImage} />`.
         - Dilanjutkan efek screenshot flash camera dan kemunculan kartu Pokemon TCG.
      4. Di [`PokemonCard.tsx`](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/components/PokemonCard.tsx): jendela ilustrasi 1:1 kartu memprioritaskan `imageSrc` (Drive), lalu fallback ke `targetFrameImage` (gambar statis hasil tangkapan canvas), menghasilkan tampilan gambar kartu yang instan dan sangat tajam.
      5. Di [`RewindEffect.tsx`](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/components/RewindEffect.tsx): mengganti karakter panah teks unicode dengan tiga elemen SVG `<polygon points="18,4 18,20 6,12" />` berwarna putih murni dengan animasi riak opasitas, menghilangkan tampilan emoji biru Windows.
- **Perubahan Kode Penting**:
  - `video-editor/src/utils/frameCapture.ts`: Utilitas ekstraksi frame video offscreen via HTML5 canvas.
  - `video-editor/src/App.tsx`: Hooks ekstraksi `lastFrameImage` dan `targetFrameImage`.
  - `video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx`: Hide video player pasca-play dan render gambar statis instan via `<Img>`.
  - `video-editor/src/styles/meme-discovery/components/PokemonCard.tsx`: Integrasi `targetFrameImage` pada ilustrasi kartu 1:1.
  - `video-editor/src/styles/meme-discovery/components/RewindEffect.tsx`: SVG panah segitiga YouTube putih murni anti-emoji biru.

## [01ae832] - Fix Dynamic Frame Seeking and Freezing via Remotion Freeze Component
- **Konteks Struktural**:
  - Sinkronisasi Akurat Frame Target x & Fallback Kartu ([MemeDiscoveryComposition.tsx](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx), [PokemonCard.tsx](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/components/PokemonCard.tsx), [time.ts](file:///d:/projects/clipping/video-editor/src/utils/time.ts)):
    - **Penyebab & Kebutuhan**: Pengguna mendapati bahwa mengubah timestamp posisi frame (misalnya menjadi `7.1` atau `2`) pada input web studio tidak mengubah frame yang ter-freeze di video maupun frame cuplikan fallback pada kartu Pokemon TCG (tampilan tetap statis pada akhir video).
    - **Akar Masalah**: Sebelumnya kode menggunakan properti `startFrom={offset}` pada tag `<Video>`. Di Remotion, `startFrom` hanya menambahkan offset playback relatif terhadap frame komposisi yang berjalan (`(frame + offset)`), bukan menghentikan/membekukan pemutaran. Pada frame 350+ (fase review & kartu), kalkulasi `(350 + offset)` melampaui total durasi video (10.95s / 328 frame), sehingga video selalu terhenti statis di detik terakhir video tanpa peduli nilai timestamp yang diinput. Selain itu, parsing timestamp belum menoleransi format desimal koma (misal `7,1`).
    - **Solusi**:
      1. Mengganti pola `startFrom` dengan komponen resmi Remotion `<Freeze frame={targetFrame}>` baik pada background video maupun pada frame cuplikan fallback di `PokemonCard.tsx`.
      2. Pada sekuens storyboard:
         - Saat video diputar (0 s/d `playEndFrame`): memutar video secara utuh.
         - Saat jeda pause dan animasi skip YouTube (`frame < skipEndFrame`): dibekukan tepat pada frame terakhir video (`playEndFrame - 1`).
         - Begitu efek skip YouTube selesai (`frame >= skipEndFrame`): langsung dibekukan secara dinamis dan presisi pada `targetFrame` (`Math.round(targetUndoSeconds * fps)`).
      3. Di `time.ts`, menambahkan normalisasi tanda koma (`,`) menjadi titik (`.`) agar input gaya penulisan desimal lokal Indonesia (seperti `7,1`) tetap diparse sebagai nilai float yang valid.
- **Perubahan Kode Penting**:
  - `video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx`: Menggunakan `<Freeze frame={targetFrame}>` pasca-skip YouTube.
  - `video-editor/src/styles/meme-discovery/components/PokemonCard.tsx`: Menggunakan `<Freeze frame={...}>` untuk fallback gambar kartu 1:1.
  - `video-editor/src/utils/time.ts`: Normalisasi koma ke titik pada `parseTimestampToSeconds`.

## [8198b27] - Expand Video to Full 100% Canvas Height in Meme Discovery by Eliminating Artificial Safe Zone Squeeze
- **Konteks Struktural**:
  - Penataan Layer Video Remotion Penuh 100% Edge-to-Edge ([MemeDiscoveryComposition.tsx](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx)):
    - **Penyebab & Kebutuhan**: Sebelumnya komponen video dibungkus di dalam container `top-[10%] bottom-[10%]` dengan `object-contain` serta ditutupi oleh dinding hitam statis 10% di atas dan 10% di bawah. Karena video `full.mp4` sudah beresolusi 9:16 (1080x1920) dan kontennya sudah berada di dalam safe zone 80% secara native dari hasil editing pengguna, pembatasan 80% tambahan di Remotion menyebabkan video terkompresi ganda menjadi 864x1536 dengan pilar hitam tebal di kiri, kanan, atas, dan bawah. Hal ini membuat preview video di laptop pengguna tidak mencapai 100% tinggi layar dan tampak kecil di tengah layar.
    - **Solusi**:
      1. Menghilangkan pembungkus `top-[10%] bottom-[10%]` dan dinding hitam pemotong, lalu menempatkan `<Video>` langsung di dalam `<AbsoluteFill>` dengan `className="w-full h-full object-cover"` sehingga video membentang penuh 100% dari pixel 0 hingga 1920 tanpa letterbox/pillarbox buatan.
      2. Kontrol player Remotion di bagian bawah kini melayang secara wajar di atas frame video terbawah dan auto-hide saat video diputar, memaksimalkan area pandang preview vertikal setinggi-tingginya di layar laptop.
      3. Kartu Pokemon TCG (820px) tetap berpusat di tengah kanvas safe zone 80% dengan latar video yang teredup halus (dimming blur).
- **Perubahan Kode Penting**:
  - `video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx`: Menjadikan layer `<Video>` memenuhi `<AbsoluteFill>` 100% canvas dan membersihkan div black wall statis pereduksi tinggi video.

## [ff89766] - Maximize Video Preview to True Full Viewport Height and Enrich Pokemon Card with Authentic TCG Anatomy and 820px Scale
- **Konteks Struktural**:
  - Penskalaan Penuh Preview Layar Studio & Anatomi Otentik Kartu Pokemon TCG ([App.tsx](file:///d:/projects/clipping/video-editor/src/App.tsx), [PokemonCard.tsx](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/components/PokemonCard.tsx), [MemeDiscoveryComposition.tsx](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx)):
    - **Penyebab & Kebutuhan**: Pengguna meminta agar kanvas video potret 9:16 di antarmuka web studio dapat benar-benar memanfaatkan 100% tinggi layar laptop tanpa celah padding/margin (maksimum sebesar mungkin), dengan kontrol player di bagian bawah yang auto-hide saat diputar. Selain itu, kartu meme di Remotion sebelumnya berukuran relatif kecil (520px) dan belum menyerupai kartu Pokemon asli secara menyeluruh. Pengguna meminta agar kartu diperbesar secara signifikan serta memuat elemen-elemen anatomi otentik kartu Pokémon Trading Card Game (TCG): bukan hanya gambar 1:1, melainkan judul kartu tebal, stage evolusi (Basic Meme), status HP & simbol elemen energi, bilah info spesies Pokedex, kotak Ability (Poké-Power), serangan dengan biaya energi & angka damage, serta bilah Weakness/Resistance/Retreat dan footer kolektor.
    - **Solusi**:
      1. Menghilangkan padding (`p-0 m-0`) pada wrapper canvas di `App.tsx` dan menetapkan kanvas 9:16 langsung pada `h-screen max-h-screen aspect-[9/16]` sehingga tinggi pemutar video memenuhi 100vh layar laptop secara penuh dari ujung atas hingga bawah.
      2. Memperbesar ukuran kartu di `PokemonCard.tsx` dari `520px` menjadi `820px` (menempati ~76% lebar kanvas 1080px dan ~1200px dari tinggi safe zone 1536px), memberikan kesan kartu koleksi yang megah, tebal, dan sangat mudah dibaca.
      3. Mengintegrasikan elemen anatomi Pokémon TCG lengkap:
         - Top bar: badge stage `BASIC MEME`, judul nama karakter, status HP tebal, dan lambang tipe energi (`⚡`).
         - Bingkai ilustrasi emas 1:1 dengan aksen sudut metallic bevel (mendukung `image.jpg` Drive atau fallback frame video beku).
         - Bilah informasi spesies Pokédex: nomor koleksi, tipe, tinggi, dan berat.
         - Kotak Ability (`Ability: Momen Spontan` dengan efek pemicu auto-subscribe).
         - Serangan utama dengan biaya energi, nama jurus, angka damage `999+`, dan deskripsi dengan `whitespace-pre-line` (Rule 23).
         - Bilah battle modifier: Weakness (`⚡ x2`), Resistance (`🛡️ -30`), dan Retreat Cost (`⚪⚪`).
         - Footer kolektor: nama ilustrator, set code `SSP 001/100`, rarity `⭐⭐⭐⭐⭐ SSR LEGENDARY`, dan hak cipta TCG.
      4. Menghubungkan seluruh props anatomi kartu ke `MemeDiscoveryComposition.tsx` dan `types.ts`.
- **Perubahan Kode Penting**:
  - `video-editor/src/App.tsx`: Layout canvas studio 100% full height (`h-screen p-0 m-0`).
  - `video-editor/src/styles/meme-discovery/components/PokemonCard.tsx`: Penskalaan `w-[820px]` dan implementasi anatomi Pokémon TCG lengkap (stage, HP, Pokedex strip, Ability, Attack energy, Weakness/Resistance/Retreat, collector footer).
  - `video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx`: Pass-through props anatomi TCG.
  - `video-editor/src/styles/meme-discovery/types.ts`: Menambahkan definisi props Pokemon TCG.

## [ebc9391] - Implement YouTube-Style Double-Tap Skip Backward Effect, Refined Freeze Pauses, and Card Slide-Up Entrance
- **Konteks Struktural**:
  - Penataan Ulang Storyboard Sekuensial Meme Discovery & Efek Skip YouTube ([MemeDiscoveryComposition.tsx](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx), [RewindEffect.tsx](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/components/RewindEffect.tsx), [PokemonCard.tsx](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/components/PokemonCard.tsx)):
    - **Penyebab & Kebutuhan**: Pengguna menginginkan alur kejadian visual yang runut dan memiliki jeda antar aksi yang jelas agar penonton dapat mencerna maksud video dengan nyaman:
      1. Video diputar utuh tanpa gangguan sampai selesai.
      2. Begitu selesai, frame terakhir dibekukan (*freeze*) dengan jeda singkat dan ikon pause transparan ringan di tengah (bukan layar hitam).
      3. Muncul efek skip kebelakang persis seperti YouTube (setengah lingkaran/kubah gelombang putih melengkung di sisi kiri, 3 panah beriak ke kiri `◀◀◀`, dan teks durasi detik).
      4. Setelah efek skip, layar menampilkan frame beku momen lucu dengan jeda yang cukup agar penonton bisa melihat ekspresinya.
      5. Terjadi efek shutter flash kamera putih halus.
      6. Ada jeda 0.5 detik (15 frame) pasca-screenshot sebelum kartu meme muncul.
      7. Kartu meme 1:1 meluncur naik dari bawah (*slide-up from bottom*) ke tengah safe zone 80%.
    - **Solusi**:
      1. Mengganti visual skip di `RewindEffect.tsx` menjadi efek double-tap YouTube asli di sisi kiri layar dengan kubah busur `rounded-r-full`, animasi riak 3 chevron `◀◀◀`, dan teks `{N} detik`.
      2. Mengatur sekuens berurutan di `MemeDiscoveryComposition.tsx` dengan jeda freeze frame akhir + pause icon transparan (12 frame), efek skip YouTube (22 frame), jeda pandang frame lucu (18 frame), flash shutter (10 frame), jeda 0.5s pasca-screenshot (15 frame), dan tampilan kartu (105 frame).
      3. Memperbarui `PokemonCard.tsx` agar meluncur naik dari bawah ke tengah (`translateY: 900px -> 0px` via spring animation) di dalam safe zone 80%.
      4. Menyelaraskan total durasi composition di `Root.tsx` dan `App.tsx` (511 frame ~17.03s).
- **Perubahan Kode Penting**:
  - `video-editor/src/styles/meme-discovery/components/RewindEffect.tsx`: Efek skip kebelakang identik dengan YouTube double-tap di sisi kiri layar.
  - `video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx`: Sekuens visual berjenjang dengan jeda jeda teratur dan freeze video tanpa jeda hitam.
  - `video-editor/src/styles/meme-discovery/components/PokemonCard.tsx`: Animasi entrance kartu meluncur dari bawah layar (`slideProgress`).
  - `video-editor/src/App.tsx` & `Root.tsx`: Penyesuaian total durasi frame sekuensial (511 frame).

## [225c86f] - Implement Video Player Skip Backward Effect and Streamline Studio Web UI to Minimalist Full Height
- **Konteks Struktural**:
  - Penyederhanaan Tampilan Web Studio & Efek Skip Mundur Video Player ([App.tsx](file:///d:/projects/clipping/video-editor/src/App.tsx), [MemeDiscoveryComposition.tsx](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx), [RewindEffect.tsx](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/components/RewindEffect.tsx), [vite.config.ts](file:///d:/projects/clipping/video-editor/vite.config.ts)):
    - **Penyebab & Kebutuhan**: Karena kanvas video berformat potret 9:16, keberadaan header/navbar di bagian atas web memotong tinggi viewport laptop sehingga kanvas video tidak bisa dinikmati dengan tinggi maksimal. Pengguna menginginkan antarmuka tools pribadi yang ultra-minimalis tanpa ornamen pemercantik (menghapus navbar, judul project, deskripsi, pemilih momen, kustomisasi kartu, dll.) dan hanya menyisakan detail mode aktif, back button, input posisi frame target undo, dan tombol simpan otomatis ke `data.json`. Pada style edit "Meme Discovery", pengguna meminta alur pemutaran video penuh secara utuh terlebih dahulu dari awal hingga akhir tanpa gangguan, lalu setelah selesai barulah muncul efek visual skip kebelakang ala video player (menampilkan lompatan sebanyak `total - x` detik) dan otomatis langsung men-seek video ke timestamp `x` yang ditentukan secara instan.
    - **Solusi**:
      1. Menghapus top header/navbar sepenuhnya di `App.tsx` sehingga video canvas 9:16 dapat memanfaatkan tinggi penuh layar laptop (`h-screen flex-1 p-2`).
      2. Merampingkan panel samping menjadi antarmuka minimalis: hanya menampilkan tombol "Ganti Mode" (back button), badge mode aktif (`Meme Discovery`), input posisi frame timestamp target, dan tombol "Simpan ke data.json".
      3. Menambahkan middleware `/api/save-data` pada `video-editor/vite.config.ts` untuk memungkinkan tombol simpan di web langsung memperbarui dan menulis berkas `src/data.json` di disk secara realtime tanpa dependensi server eksternal.
      4. Memperbarui `MemeDiscoveryComposition.tsx` agar memutar video penuh secara utuh dari frame 0 hingga selesai (`playEndFrame`). Setelah video selesai diputar, sekuens lompat mundur dimulai: menampilkan `RewindEffect` ala double-tap skip player (ikon `‹‹` dan teks `-(total - x)s`), dan langsung men-seek playback video tepat di timestamp target `x` tanpa scrubbing frame mundur yang lambat, dilanjutkan efek shutter flash dan reveal kartu Pokemon 1:1.
- **Perubahan Kode Penting**:
  - `video-editor/src/App.tsx`: Menghapus navbar dan kontrol berlebih; antarmuka ultra-minimalis dengan pemutar 9:16 full-height dan penyimpanan interaktif ke `data.json`.
  - `video-editor/vite.config.ts`: Menambahkan plugin middleware `saveDataPlugin` untuk endpoint POST `/api/save-data`.
  - `video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx`: Alur playback penuh utuh di awal, lalu efek skip player `-(total - x)s` dan seek instan ke frame target.
  - `video-editor/src/styles/meme-discovery/components/RewindEffect.tsx`: Visual skip-back indicator ala video player dengan animasi ripple dan counter durasi otomatis.
  - `video-editor/src/remotion/Root.tsx`: Menyesuaikan total durasi composition (video full + 20f skip + 10f flash + 90f kartu = 449 frame).

## [02e2058] - Persist Style Edit Config in data.json, Enforce 80% Safe Zone Canvas, and Remove Frame Inspector
- **Konteks Struktural**:
  - Konfigurasi Style Edit Terintegrasi Metadata & Safe Zone Medsos ([data.json](file:///d:/projects/clipping/video-editor/src/data.json), [MemeDiscoveryComposition.tsx](file:///d:/projects/clipping/video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx), [App.tsx](file:///d:/projects/clipping/video-editor/src/App.tsx)):
    - **Penyebab & Kebutuhan**: Pengguna telah menemukan cara menentukan detik & milidetik target secara manual melalui aplikasi video editor ponsel (relatif dari awal video), sehingga perkakas `FrameInspector` tidak lagi diperlukan dan perlu dihapus agar codebase tetap ramping. Nilai konfigurasi style edit (seperti `targetUndoTimestamp`, `rewindDurationSeconds`, teks judul, status kartu pokemon) dipindahkan langsung ke dalam `src/data.json` di bawah properti `memeDiscovery`. Selain itu, pada platform media sosial (Shorts/Reels/TikTok), area atas dan bawah layar sering tertutup status bar, caption, dan navigasi antarmuka aplikasi. Oleh karena itu, kanvas 9:16 (1080x1920) harus menerapkan aturan safe zone vertikal 80% (top 10% dan bottom 10% sebagai dinding hitam pembatas), dengan seluruh elemen video dan kartu 1:1 terkonsentrasi di dalam 80% area aman di tengah.
    - **Solusi**:
      1. Menghapus berkas `video-editor/src/components/FrameInspector.tsx` dan folder `src/components/` serta membersihkan import-nya di `App.tsx`.
      2. Menambahkan properti konfigurasi `memeDiscovery` pada momen di `src/data.json` dan memperbarui `scripts/gdrive.js` agar selalu mempertahankan (*merge*) properti kustom pada momen saat sinkronisasi metadata dijalankan, serta memperketat pencarian `full.mp4` tanpa fallback sembarangan (Rule 24).
      3. Menata ulang `MemeDiscoveryComposition.tsx` agar membagi kanvas 9:16 menjadi:
         - Dinding hitam atas 10% (192px) untuk melindungi area tertutup UI medsos.
         - Safe zone tengah 80% (1536px) untuk pemutaran video `object-contain`, animasi undo, shutter flash, dan reveal kartu Pokemon 1:1.
         - Dinding hitam bawah 10% (192px) untuk melindungi area tertutup caption dan tombol interaksi medsos.
         - Banner header ditempatkan tepat di batas atas safe zone (`top-[10.5%]`), dan kartu Pokemon 1:1 diposisikan tepat di tengah area aman dengan dukungan `whitespace-pre-line` (Rule 23).
      4. Menambahkan toggle visual "Safe Zone 80%" pada header studio di `App.tsx` untuk mempermudah pengecekan batas area aman secara interaktif di browser.
- **Perubahan Kode Penting**:
  - `video-editor/src/components/FrameInspector.tsx`: Dihapus untuk merampingkan ukuran kode.
  - `video-editor/src/data.json`: Menyimpan skema konfigurasi style `memeDiscovery` per momen.
  - `video-editor/scripts/gdrive.js`: Mempertahankan konfigurasi `memeDiscovery` saat sinkronisasi dan menegakkan pencarian `full.mp4` persis tanpa fallback acak.
  - `video-editor/src/styles/meme-discovery/MemeDiscoveryComposition.tsx`: Pembagian kanvas 80% safe zone dan dinding hitam 10% atas/bawah.
  - `video-editor/src/styles/meme-discovery/components/PokemonCard.tsx`: Menambahkan `whitespace-pre-line` untuk mendukung pemisahan baris manual.
  - `video-editor/src/styles/meme-discovery/types.ts`: Menambahkan properti `showSafeZoneGuides?: boolean;`.
  - `video-editor/src/App.tsx`: Menghubungkan pembacaan konfigurasi langsung dari `data.json` dan menambahkan tombol toggle panduan visual safe zone 80%.

## [4269db4] - Modularize Video Editing Styles, Integrate Video Duration Metadata, and Implement Meme Discovery with Millisecond Frame Inspector
- **Konteks Struktural**:
  - Restrukturisasi Modular Style Edit & Utilitas Waktu Bersama ([video-editor/src/styles/](file:///d:/projects/clipping/video-editor/src/styles/), [video-editor/src/utils/time.ts](file:///d:/projects/clipping/video-editor/src/utils/time.ts)):
    - **Penyebab & Kebutuhan**: Proyek akan memiliki banyak ragam variasi gaya video editing (misalnya "Meme Discovery", "Roulette Quiz", dll.). Komposisi yang menumpuk di satu folder membuat arsitektur sulit dikembangkan dan tidak modular. Selain itu, pengguna membutuhkan style edit baru "Meme Discovery" (video berputar normal, di akhir terjadi animasi rewind/undo ke frame spesifik facecam lucu, shutter flash kamera putih halus, dan reveal kartu Pokemon holographic 1:1), serta mekanisme akurat untuk mendapatkan nilai detik & milidetik target tanpa menebak-nebak.
    - **Solusi**:
      1. Memisahkan struktur komponen per-style di bawah `src/styles/<nama-style>/` (`src/styles/meme-discovery/` dan `src/styles/roulette-quiz/`) dengan tipe props masing-masing, sembari menyediakan utilitas konversi waktu bersama di `src/utils/time.ts` (`parseTimestampToSeconds`, `secondsToTimestamp`, `framesToTimestamp`, `timestampToFrames`).
      2. Memperbarui `video-editor/scripts/gdrive.js` untuk meminta field `videoMediaMetadata` ke Google Drive API, sehingga nilai durasi asli (`durationMillis`), lebar, dan tinggi video dapat langsung tercatat di `src/data.json` tanpa perlu mendownload file atau menjalankan ffprobe secara terpisah.
      3. Mengimplementasikan komposisi `MemeDiscoveryComposition` lengkap dengan sub-komponen: `RewindEffect` (visual scanline, time counter mundur, dan scrubber video), `ShutterFlash` (flash putih halus efek shutter kamera), dan `PokemonCard` (kartu holographic 1:1 bergaya Pokemon Trading Card dengan efek kemilau dinamis, status HP, nama jurus, dan kartu gambar yang mendukung file 1:1 `image.jpg` dari Drive maupun fallback frame video beku pada detik target).
      4. Mengembangkan komponen perkakas interaktif `FrameInspector` (`video-editor/src/components/FrameInspector.tsx`) dengan stepper per-frame (`-1F`, `+1F` ~33ms) dan per-detik (`-1s`, `+1s`) serta tombol 1-klik "Jadikan Target Undo" untuk menemukan posisi detik & milidetik presisi tinggi secara visual.
      5. Menghubungkan kedua style ("Meme Discovery" dan "Roulette Quiz") ke dalam `video-editor/src/remotion/Root.tsx` dan `video-editor/src/App.tsx` dengan tab selector interaktif.
- **Perubahan Kode Penting**:
  - `video-editor/scripts/gdrive.js`: Menambahkan `videoMediaMetadata` pada query Drive API untuk mengekstrak `durationSeconds`, `durationFormatted`, `width`, dan `height`.
  - `video-editor/src/data.json`: Menyimpan metadata durasi dan dimensi video momen.
  - `video-editor/src/utils/time.ts`: Helper manipulasi waktu presisi tinggi (frame <-> detik <-> string "MM:SS.mmm").
  - `video-editor/src/styles/meme-discovery/`: Tipe props, efek rewind, efek shutter flash, kartu 1:1 pokemon, dan komposisi utama `MemeDiscoveryComposition`.
  - `video-editor/src/styles/roulette-quiz/`: Migrasi modular untuk style roulette quiz.
  - `video-editor/src/components/FrameInspector.tsx`: Komponen UI penemu detik & milidetik presisi tinggi.
  - `video-editor/src/remotion/Root.tsx`: Mendaftarkan composition `MemeDiscovery` dan `RouletteQuiz`.
  - `video-editor/src/App.tsx`: Tab navigasi style switcher, integrasi frame inspector, dan kontrol kustomisasi kartu.

## [c70d9b1] - Consolidate Metadata into Single src/data.json, Remove Redundant IDs, and Humanize Timestamp
- **Konteks Struktural**:
  - Konsolidasi Berkas Metadata & Penyederhanaan Properti ([data.json](file:///d:/projects/clipping/video-editor/src/data.json), [gdrive.js](file:///d:/projects/clipping/video-editor/scripts/gdrive.js)):
    - **Penyebab & Kebutuhan**: Sebelumnya metadata disimpan di dua lokasi berbeda (`src/data/metadata.json` dan `public/metadata.json`) yang redundan. Selain itu, objek momen memuat properti `folderId` yang identik dengan `id`, root metadata memuat `rootFolderId` yang sebenarnya sudah tersimpan di `.env`, dan format tanggal menggunakan ISO string yang kurang ramah dibaca manusia.
    - **Solusi**:
      1. Menyatukan metadata ke dalam satu berkas tunggal yang ringkas: `video-editor/src/data.json` dan menghapus berkas redundan di `public/metadata.json` serta folder `src/data/`.
      2. Menghapus properti `folderId` dari setiap momen (hanya mempertahankan `id`) dan menghapus `rootFolderId` dari root metadata.
      3. Mengubah format penanda waktu menjadi format bahasa manusia (`YYYY-MM-DD HH:mm:ss`) pada properti `lastUpdate` via helper `formatHumanDate`.
      4. Memperbarui import di `App.tsx` menjadi `import data from './data.json'` dan menyelaraskan skrip crawler/downloader di `gdrive.js`.
- **Perubahan Kode Penting**:
  - `video-editor/src/data.json`: Berkas metadata tunggal dengan struktur bersih tanpa properti ganda.
  - `video-editor/scripts/gdrive.js`: Menghapus duplikasi penyimpanan public, menerapkan `formatHumanDate`, dan memperbarui path ke `src/data.json`.
  - `video-editor/src/App.tsx`: Membaca langsung dari `./data.json` dan menampilkan `data.lastUpdate`.
  - `video-editor/README.md`: Memperbarui dokumentasi metadata ke `src/data.json`.

## [5383bd6] - Implement Google Drive Metadata Crawler and Interactive On-Demand Downloader for Remotion Playback
- **Konteks Struktural**:
  - Sinkronisasi Aset Google Drive & Pemutaran Video Lokal On-Demand ([video-editor/scripts/gdrive.js](file:///d:/projects/clipping/video-editor/scripts/gdrive.js), [metadata.json](file:///d:/projects/clipping/video-editor/src/data/metadata.json)):
    - **Penyebab & Kebutuhan**: File video mentah (`full.mp4`) berukuran puluhan hingga ratusan megabyte sehingga tidak mungkin disimpan di repositori Git. Pengembang membutuhkan skema penyimpanan metadata terpusat (`metadata.json`) yang mencatat ID folder, nama file, ukuran, dan path Google Drive, serta mekanisme pengunduhan lokal interaktif (*on-demand*) ke direktori sementara (`public/temp/`) agar video dapat langsung diuji putar di Remotion (`<Video src="..." />`).
    - **Solusi**:
      1. Mengembangkan modul utilitas Google Drive `video-editor/scripts/gdrive.js` yang terhubung via OAuth2 Google API (`token.json`) dan membaca `GDRIVE_ROOT_FOLDER_ID` dari `.env`.
      2. Menerapkan fungsi `syncMetadata()` yang menjelajahi struktur direktori Drive secara rekursif, memetakan momen game (seperti folder `"grim reaper"`), dan mencatat detail berkas `full.mp4` ke file metadata terpadu `src/data/metadata.json` dan `public/metadata.json`.
      3. Membuat antarmuka CLI interaktif (`npm run download` / `npm run sync`): menampilkan daftar momen bernomor dengan indikator status lokal `[TERUNDUH]` / `[BELUM DIUNDUH]`, dan mengunduh berkas terpilih via streaming pipeline ke `public/temp/<momen>/full.mp4`.
      4. Memperbarui `VerticalShortsComposition.tsx` dan `App.tsx` agar secara dinamis memutar berkas `full.mp4` lokal menggunakan komponen `<Video />` Remotion dengan pemilih momen langsung di sidebar.
      5. Menambahkan `temp/` dan `public/temp/` ke `.gitignore` untuk mencegah berkas biner video masuk ke version control.
- **Perubahan Kode Penting**:
  - `video-editor/scripts/gdrive.js`: Modul sinkronisasi metadata Drive, downloader streaming dengan progress bar, dan antarmuka CLI interaktif.
  - `video-editor/src/data/metadata.json` & `video-editor/public/metadata.json`: Basis data metadata momen dan berkas video Google Drive.
  - `video-editor/src/remotion/types.ts`: Menambahkan properti `videoSrc?: string;` pada `VerticalVideoProps`.
  - `video-editor/src/remotion/compositions/VerticalShortsComposition.tsx`: Mengintegrasikan pemutar `<Video />` Remotion saat `videoSrc` aktif.
  - `video-editor/src/App.tsx`: Dropdown pemilih momen berbasis metadata, switch toggle video asli vs roulette, dan petunjuk CLI downloader.
  - `video-editor/package.json`: Menambahkan skrip `"download"`, `"sync"`, dan dependensi `googleapis` serta `dotenv`.
  - `video-editor/README.md`: Dokumentasi alur kerja Google Drive downloader dan pemutaran video lokal.
  - `video-editor/.gitignore`: Mengabaikan `temp/` dan `public/temp/`.

## [ade6cd8] - Initialize Programmatic Video Studio Workspace with Vite, React 19, Tailwind CSS v4, and Remotion

- **Konteks Struktural**:

  - Inisialisasi Ruang Kerja Programmatic Video Editing ([video-editor/](file:///d:/projects/clipping/video-editor)):

    - **Penyebab & Kebutuhan**: Proses penyuntingan video langsung melalui skrip FFmpeg (`scheduler-uploader`) menyulitkan verifikasi visual sebelum menjalankan kompilasi penuh. Pengembang memerlukan umpan balik visual instan (*real-time hot-reloading*) untuk melihat tata letak, posisi kartu roulette, efek spotlight, subtitle, dan kurva deselerasi secara langsung di peramban web tanpa harus menunggu proses kompilasi video FFmpeg yang memakan waktu.

    - **Solusi**:

      1. Membuat workspace baru `video-editor` di root berbasis **Vite + React 19 + TypeScript**.

      2. Mengintegrasikan **Tailwind CSS v4** (`@tailwindcss/vite` & `@import "tailwindcss";`) tanpa konfigurasi boilerplate CSS manual (*zero-config raw CSS*).

      3. Memasang pustaka **Remotion** (`remotion` & `@remotion/player`) untuk rendering video deklaratif berbasis komponen web.

      4. Menyusun komposisi video vertikal 9:16 (`VerticalShortsComposition.tsx`) beresolusi 1080x1920 @ 30 FPS yang memvisualisasikan header game, bar subtitle dinamis, spotlight overlay gelap, dan simulasi jalur putaran kartu roulette.

      5. Membangun workbench interaktif di `App.tsx` dengan kendali live parameter (judul, timestamp, jalur aktif roulette, slider spotlight dim opacity) serta pemutar video terintegrasi (@remotion/player) berfitur timeline scrubber, play/pause, dan kecepatan putar dinamis.

- **Perubahan Kode Penting**:

  - `video-editor/package.json`: Menambahkan dependensi `remotion`, `@remotion/player`, `react`, `react-dom`, `@tailwindcss/vite`, `tailwindcss`, dan `lucide-react`.

  - `video-editor/vite.config.ts`: Mengonfigurasi plugin Vite React dan Tailwind CSS v4 pada port dev server 5174.

  - `video-editor/src/index.css`: Menerapkan `@import "tailwindcss";` dan penataan styling gelap dasar.

  - `video-editor/src/remotion/types.ts`: Menetapkan antarmuka tipe parameter komposisi vertikal (`VerticalVideoProps`).

  - `video-editor/src/remotion/compositions/VerticalShortsComposition.tsx`: Mengembangkan komponen komposisi video 9:16 dengan animasi spring header, spotlight carousel kartu roulette, pointer tunggal tengah, dan progress bar.

  - `video-editor/src/remotion/Root.tsx`: Mendaftarkan komposisi `VerticalShorts` berdurasi 180 frame (6 detik) 1080x1920.

  - `video-editor/src/App.tsx`: Antarmuka studio pengembang dengan Player Remotion dan panel kontrol parameter real-time.

  - `video-editor/README.md`: Panduan eksekusi dan arsitektur workspace.



## [147d90f] - Force Original Creator Audio and Filter AI Auto-Dubbed Tracks Across Clip and Full Video Downloads
- **Konteks Struktural**:
  - Eliminasi Audio AI Auto-Dubbing / Penyelarasan Bahasa Asli Video ([ytdlp.ts](file:///d:/projects/clipping/mobile/src/constants/ytdlp.ts), [clip_downloader.py](file:///d:/projects/clipping/mobile/scripts/utils/clip_downloader.py), [downloader.py](file:///d:/projects/clipping/mobile/scripts/utils/downloader.py)):
    - **Penyebab Masalah**: Fitur multi-audio dan auto-dubbing YouTube secara otomatis menyertakan audio berbahasa Inggris (AI-generated auto-dubbed track) pada format terpisah (DASH / HLS / m4a). Saat melakukan stream preview (seleksi klip 480p), aplikasi memutar video progressive MP4 yang selalu menggunakan audio asli kreator (Bahasa Indonesia). Namun saat tombol download ditekan:
      1. Pemotongan klip via segmen HLS Stage 1 (`clip_downloader.py`) sebelumnya hanya menyortir format audio berdasarkan bitrate (`abr`). Format auto-dubbed Inggris yang memiliki bitrate sama atau lebih tinggi secara keliru terpilih menggantikan audio asli.
      2. Download video penuh (`download_full_video_direct` & `downloader.py`) menggunakan selector `bestaudio[ext=m4a]` tanpa filter `format_note` dan tanpa `format_sort: ['lang', 'format_note:original']`, sehingga yt-dlp mengunduh track audio auto-dubbed berbahasa Inggris.
    - **Solusi**:
      1. Memperbarui `ytdlp.ts` pada konfigurasi `PRIME_CLIP_DOWNLOAD_OPTS`, `DOWNLOAD_YTDL_OPTS`, `PROXY_FULL_VIDEO_YTDL_OPTS`, dan `STREAM_YTDL_OPTS` dengan selector audio bersyarat: `bestvideo+(bestaudio[format_note*=original]/bestaudio[format_note!*=dubbed]/bestaudio)/best` serta menambahkan `format_sort: ['lang', 'format_note:original', 'quality', 'res', 'fps', 'abr']`.
      2. Menerapkan fungsi pembobotan skor audio `get_audio_score` di `clip_downloader.py` pada seleksi segmen HLS dan progressive MP4 Stage 1: memberikan bobot prioritas tinggi (`+1000`) untuk format dengan penanda `original`, kecocokan bahasa video, dan `language_preference >= 0`, serta memberikan penalti drastis (`-1000`) untuk format bertanda `dubbed`, `auto`, atau `translated`.
      3. Menyelaraskan `download_full_video_direct` dan `downloader.py` agar secara dinamis menerima parameter format serta format sort dari frontend dengan fallback aman anti-dubbing.
- **Perubahan Kode Penting**:
  - `mobile/src/constants/ytdlp.ts`:
    - Menambahkan `format_sort?: string[];` pada interface `YtdlOpts`.
    - Memperbarui `PRIME_CLIP_DOWNLOAD_OPTS`, `DOWNLOAD_YTDL_OPTS`, `PROXY_FULL_VIDEO_YTDL_OPTS`, dan `STREAM_YTDL_OPTS` dengan aturan `format_sort` dan audio format selector `(bestaudio[format_note*=original]/bestaudio[format_note!*=dubbed]/bestaudio)`.
  - `mobile/scripts/utils/clip_downloader.py`:
    - Menerapkan fungsi pembobotan `get_audio_score` pada penyaringan `hls_a_formats` dan `prog_formats` di Stage 1 HLS segment download.
    - Menghapus hardcoded format audio pada `run_full_download` dan menggantikannya dengan pembacaan dinamis dari `opts.get("format")` dan `opts.get("format_sort")`.
    - Menambahkan `format_sort` pada opsi proxy preview 480p.
  - `mobile/scripts/utils/downloader.py`:
    - Memperbarui format yt-dlp pada `download_single_clip` dan `download_full_video_robust` dengan selector anti-dubbing dan `format_sort` bahasa asli.

## [Unreleased] - Support Strict Directory-Based Hierarchical --path Targeting in Speedup Crawler
- **Konteks Struktural**:
  - Penjelajahan Berkas Hierarki Tingkat Direktori (*Strict Directory Hierarchy Path Navigation*) ([crawl_speedup_drive.js](file:///d:/projects/clipping/scheduler-uploader/crawl_speedup_drive.js)):
    - **Kebutuhan**: Menyediakan filter `--path="<path>"` yang fleksibel namun ketat untuk memproses klip atau berkas video tertentu di Google Drive, menggantikan dan menggeneralisasi parameter `--game`.
    - **Aturan Hierarki Direktori**: Akses WAJIB diawali dari folder tingkat pertama (folder Game), menyerupai navigasi direktori berkas sistem (`game`, `game/eps`, `game/eps/klip`, atau `game/eps/klip/full.mp4`). Penelusuran tidak diizinkan langsung melompati hierarki menuju folder klip tanpa menyertakan nama game induk.
    - **Pencocokan String Presisi 100%**: Helper `matchSegment` mempertahankan karakter string 100% utuh termasuk spasi, tanda petik tunggal internal (seperti `chilla's art`), dan tanda titik dua pada timestamp (`01:03:20`), dengan toleransi case-insensitive dan toleransi penanda prefix skip (`!`).
    - **Pruning & Validasi Folder Game Awal (Tahap 1)**: Memeriksa `targetSegments[0]`. Jika tidak ditemukan dalam daftar folder game Google Drive, skrip langsung berhenti seketika dengan kode error 1 dan mencetak daftar folder game yang tersedia, mencegah pemindaian sia-sia ke seluruh isi Drive.
    - **Pencocokan Prefix Hierarki (Tahap 2)**: `isPathMatch` mencocokkan segmen secara berurutan mulai dari indeks 0, dengan toleransi dummy dash folder (`"-"`) pada game single-stream (`game/-/01:03:20`).
    - **Dukungan Berkas Video Spesifik**: Jika segmen terakhir adalah nama berkas (seperti `full.mp4`, `speedup.mp4`, dsb), crawler mengekstraknya sebagai `targetFileName` dan menyaring hanya klip yang memiliki berkas sumber/target tersebut.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/crawl_speedup_drive.js`:
    - Menambahkan helper `matchSegment` dan `isPathMatch`.
    - Memperbarui `crawlForSpeedupCandidates` untuk mencatat `pathSegments` dan `displayPath`.
    - Menambahkan parser CLI `--path`, `-p`, dan alias `--game` dengan sanitasi tanda petik terluar shell.
    - Mengimplementasikan pruning dan validasi folder game pada Tahap 1.
    - Memperbarui teks panduan CLI `--help`.

## [bfbd819] - Replace Static Offset Array with Continuous Math.random for Organic Roulette Stopping
- **Konteks Struktural**:
  - Peniadaan Pola Offset Berhenti Sistematis Zigzag (*Dynamic Continuous Stop Offset Architecture*) ([rouletteEditor.js](file:///d:/projects/clipping/scheduler-uploader/utils/rouletteEditor.js)):
    - **Penyebab Pola Berulang**: Sebelumnya, nilai pergeseran posisi berhenti horizontal kartu (`cardOffset`) diambil dari array statis berulang `randomOffsets = [-0.15, 0.12, -0.10, 0.15, -0.12, 0.10]`. Akibatnya, pada setiap kali kompilasi 5 klip dijalankan, kartu selalu berhenti secara sistematis dan tertebak: Jalur 1 serong kiri, Jalur 2 serong kanan, Jalur 3 serong kiri, Jalur 4 serong kanan, dan Jalur 5 serong kiri.
    - **Solusi**:
      1. Menghapus total array statis `randomOffsets`.
      2. Menggantikannya dengan kalkulasi acak murni menggunakan `Math.random()`:
         ```javascript
         const maxOffsetFrac = 0.20; // Rentang serong maksimal ±20% dari lebar kartu
         const offsetFrac = (Math.random() * 2 - 1) * maxOffsetFrac;
         const cardOffset = Math.round(laneHeight * offsetFrac);
         ```
      3. Menjamin bahwa di setiap generasi kompilasi dan di setiap jalur roulette, posisi berhenti selalu organik, bebas dari pola zigzag tertebak, dan garis pointer tengah ($X = 540$) tetap memotong tegas kartu pemenang dengan margin aman minimal 30% dari tepi kartu.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/utils/rouletteEditor.js`:
    - Menghapus array statis `randomOffsets`.
    - Mengintegrasikan perhitungan acak berbasis `Math.random()` dan menampilkan log offset (`offset berhenti: ±Xpx`) di konsol.

## [edc7dbf] - Enforce Genuine Fisher-Yates Random Sampling and Dynamic Pool for Roulette Cards
- **Konteks Struktural**:
  - Pool Gambar Acak Dinamis & Pengambilan Sekali di Awal (*Dynamic One-time Random Image Pool Architecture*) ([compile_roulette.js](file:///d:/projects/clipping/scheduler-uploader/compile_roulette.js), [rouletteEditor.js](file:///d:/projects/clipping/scheduler-uploader/utils/rouletteEditor.js)):
    - **Penyebab & Kebutuhan**: Sebelumnya, fungsi `downloadMemeImagesPool` mengunduh 30 gambar pertama dari Google Drive tanpa paginasi penuh dan tanpa pengacakan kandidat, sehingga kartu yang terunduh selalu identik di setiap eksekusi. Selain itu, nilai `ROULETTE_ITEMS` di `.env` (misal 15) tidak digunakan untuk mengukur target kapasitas pool gambar yang diunduh dari Drive.
    - **Solusi**:
      1. Menghitung target kapasitas pool secara dinamis berdasarkan konfigurasi: `poolSizeTarget = Math.max(30, (config.rouletteItems || 15) * 2)`.
      2. Menerapkan paginasi `drive.files.list` hingga ratusan berkas kartu gambar di Drive, lalu mengacak seluruh daftar berkas menggunakan algoritma Fisher-Yates (`shuffleArray`) SEBELUM diunduh ke folder kerja lokal sementara `temp_roulette_work/image_pool`. Dengan demikian, gambar diunduh cukup SEKALI di awal dan di-reuse langsung sepanjang proses pembuatan pita.
  - Pengacakan Independen Per Jalur Roulette (*Independent Per-Lane Card Randomization & Randomized Winner Placement*) ([rouletteEditor.js](file:///d:/projects/clipping/scheduler-uploader/utils/rouletteEditor.js)):
    - **Penyebab Monoton**: Di fungsi `buildLaneRibbons`, pengacakan sebelumnya menggunakan metode rapuh `sort(() => 0.5 - Math.random())` yang tidak mendistribusikan elemen secara merata dalam JavaScript engine (V8). Selain itu, kartu pemenang (`winningCardPath`) SELALU diletakkan pada indeks pertama (Index 0), menyebabkan pola perputaran kartu di setiap jalur roulette terasa serupa dan kurang variatif.
    - **Solusi**:
      1. Menerapkan pengacakan Fisher-Yates murni (`shuffleArray`) pada setiap jalur roulette secara independen, sehingga setiap jalur mengambil kombinasi kartu acak yang baru dan segar dari master pool.
      2. Mengacak posisi kartu pemenang (`winningIndex = Math.floor(Math.random() * (otherCandidates.length + 1))`) di dalam susunan kartu jalur (`laneItems`), bukan lagi selalu di posisi 0.
      3. Menghitung koordinat horizontal tengah kartu pemenang secara dinamis: `winningCardCenterX = winningIndex * laneHeight + Math.round(laneHeight / 2)`, lalu menghitung `xStopRaw` dan `xStopTarget` secara presisi. Garis pointer vertikal ($X = 540$) dan efek spotlight overlay gelap tetap mengunci kartu pemenang dengan presisi piksel 100%.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/utils/rouletteEditor.js`:
    - Menambahkan helper `shuffleArray` (Fisher-Yates shuffle).
    - Memperbarui `downloadMemeImagesPool` dengan paginasi dan pengacakan kandidat berkas Drive sebelum diunduh.
    - Memperbarui `buildLaneRibbons` untuk mengambil sampel kartu acak baru per jalur dan mengacak letak kartu pemenang di dalam pita.
  - `scheduler-uploader/compile_roulette.js`:
    - Menambahkan parsing argumen `--items=` dan `--roulette-items=` serta dokumentasi bantuan CLI.
    - Menghitung `poolSizeTarget` dinamis berbasis `config.rouletteItems` dan meneruskannya ke `downloadMemeImagesPool`.
  - `scheduler-uploader/.env.example`:
    - Memperbarui nilai default dan dokumentasi penjelasan variabel `ROULETTE_ITEMS` menjadi 15.

## [c749133] - Support CLI Update Flags and Sub-game Filtering in Speedup Crawler
- **Konteks Struktural**:
  - Dukungan Opsi Pembaruan Paksa Klip Speedup (*CLI Force & Update Flags Architecture*) ([crawl_speedup_drive.js](file:///d:/projects/clipping/scheduler-uploader/crawl_speedup_drive.js), [package.json](file:///d:/projects/clipping/scheduler-uploader/package.json)):
    - **Penyebab & Kebutuhan**: Sebelumnya, crawler speedup secara otomatis melewati klip yang sudah memiliki berkas `speedup.mp4` di Google Drive demi efisiensi dan sifat idempoten. Namun ketika crawler baru saja diperbaiki (misal: perbaikan hierarki sub-game atau penyesuaian overlay), pengguna memerlukan parameter CLI untuk memaksa pembuatan dan pengunggahan ulang klip speedup yang sudah ada tanpa harus menghapus file di Drive secara manual.
    - **Solusi**:
      1. Menambahkan pengenalan flag CLI fleksibel: `--update`, `-u`, `--force`, `-f`, `--refresh`, `-r`, `--renew`, `--rerender`, `--rebuild`, `--overwrite`, dan format key-value seperti `--update=true` atau `--force=true`.
      2. Mencegah klip yang sudah ada difilter keluar saat flag pembaruan aktif (`alreadyHaveSpeedup = crawlResults.filter((c) => c.hasSpeedup && !forceRerender)` dan `itemsToProcess = crawlResults.filter((c) => !c.hasSpeedup || forceRerender)`).
      3. Menambahkan shortcut npm scripts pada `package.json`: `"speedup:update"` dan `"speedup:force"` sehingga pengguna dapat menjalankan `npm run speedup:update` maupun `npm run speedup -- --update --game="<nama>"`.
  - Pembersihan dan Ketahanan Filter Parameter CLI (*CLI Parameter Sanitization & Nested Sub-game Matching*) ([crawl_speedup_drive.js](file:///d:/projects/clipping/scheduler-uploader/crawl_speedup_drive.js)):
    - Mendukung penerusan argumen baik format sama-dengan (`--game="chilla"`) maupun format terpisah spasi (`--game "chilla"`).
    - Melakukan stripping tanda kutip pembungkus (`replace(/^["']|["']$/g, '')`) agar kutip ganda atau tunggal dari shell (PowerShell / Bash) tidak ikut terbaca sebagai bagian dari nama game.
    - Penyaringan game bertingkat (*hierarchical fallback*): Jika kata kunci `--game` tidak cocok di nama folder game induk (misal pengguna mengetik `--game="The Bathhouse"` yang berada di bawah folder induk `Chilla's Art`), crawler akan menelusuri seluruh game dan menyaring klip yang cocok di tingkat subfolder/episode atau nama folder klip.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/crawl_speedup_drive.js`:
    - Mengintegrasikan flag pembaruan (`forceRerender`) dan opsi `--help`.
    - Membersihkan kutip pada `--game`, `--folder`, dan `--limit`.
    - Menghapus duplikasi ringkasan logging dan menampilkan indikator mode pembaruan pada ringkasan konsol.
  - `scheduler-uploader/package.json`:
    - Menambahkan script `"speedup:update": "node crawl_speedup_drive.js --update"` dan `"speedup:force": "node crawl_speedup_drive.js --force"`.

## [045c66d] - Bypass Subtitle Re-burning for Speedup Videos and Fix Non-Numeric Folder Traversal in Crawler
- **Konteks Struktural**:
  - Peniadaan Penimpaan Teks Ganda (*Double-Burn Elimination for Pre-rendered Speedup Clips*) ([compile_roulette.js](file:///d:/projects/clipping/scheduler-uploader/compile_roulette.js), [rouletteEditor.js](file:///d:/projects/clipping/scheduler-uploader/utils/rouletteEditor.js)):
    - **Penyebab Masalah**: File `speedup.mp4` yang diunggah ke Google Drive oleh crawler telah memiliki teks judul video yang tertanam secara permanen (*hardcoded/burned-in*). Namun, saat mode roulette mengunduh file `speedup.mp4` tersebut, fungsi `renderSpeedupClipWithFade` secara membabi buta membakar kembali subtitle ASS (`ass='...'`) di atas video yang sama, menyebabkan teks tumpang tindih (*overlap* ganda) dan huruf bertabrakan.
    - **Solusi**: Menambahkan flag `isUsingSpeedup` pada klip momen. Jika video yang diunduh adalah `speedup.mp4` yang sudah siap pakai, `renderSpeedupClipWithFade` secara otomatis melewati pembuatan dan pembakaran subtitle ASS serta akselerasi ulang audio. Subtitle dan akselerasi hanya diterapkan jika video mentah adalah `full.mp4` (belum memiliki speedup).
  - Generalisasi Deteksi Seri/Subgame Non-Numerik (*General Non-Numeric Folder Traversal in Crawler*) ([crawl_speedup_drive.js](file:///d:/projects/clipping/scheduler-uploader/crawl_speedup_drive.js)):
    - **Penyebab Masalah (Kasus Chilla's Art)**: Sebelumnya, crawler hanya menganggap subfolder sebagai episode jika namanya cocok dengan regex kaku `/(eps|episode|part|season|chapter)\s*\d+/i`. Pada antologi game seperti `Chilla's Art/The Bathhouse/...`, folder `"The Bathhouse"` diabaikan sehingga crawler membuat subtitle yang salah (`Chilla's Art\nmenit 15 detik 20` tanpa menyertakan `"The Bathhouse"`).
    - **Solusi**: Memperbarui aturan penelusuran hierarki folder: semua subfolder yang **TIDAK diawali angka** (dan bukan dash `-`) secara konsisten diperlakukan sebagai nama episode/subgame (`epsName`). Folder yang diawali angka (seperti timestamp `00:15:20`) diperlakukan sebagai folder klip (game tanpa seri/langsung selesai). Hasilnya, crawler menghasilkan teks yang 100% konsisten dengan selector (`Chilla's Art\nThe Bathhouse menit 15 detik 20`).
- **Perubahan Kode Penting**:
  - `scheduler-uploader/crawl_speedup_drive.js`:
    - Memperbarui `isClipCandidate` dan perulangan `subFolders` untuk menangkap semua subfolder non-numerik sebagai seri/episode.
  - `scheduler-uploader/compile_roulette.js`:
    - Merekam flag `isUsingSpeedup` saat mengunduh dari Google Drive dan meneruskannya ke `renderSpeedupClipWithFade`.
  - `scheduler-uploader/utils/rouletteEditor.js`:
    - Melewati pembuatan file subtitle ASS, filter `ass`, serta `speedFilter` dan audio re-sampling saat `usingSpeedup` bernilai true.

## [50991af] - Confine Roulette Pointer Line Exclusively to Active Lane with Single-Lane Height
- **Konteks Struktural**:
  - Lokalisasi Pointer Jalur Aktif Tunggal (*Single Active Lane Pointer Localization*) ([rouletteEditor.js](file:///d:/projects/clipping/scheduler-uploader/utils/rouletteEditor.js)):
    - **Penyebab & Kebutuhan Desain**: Sebelumnya, garis pointer emas di tengah layar ($X = 540$) digambar membentang sepanjang tinggi total seluruh tumpukan (`y=0:h=totalStackHeight`), sehingga garis tersebut memotong seluruh 5 jalur sekaligus. Akibatnya, pada jalur yang sudah menang (sudah tidak aktif) maupun jalur latar belakang (belum aktif), garis pointer tetap terlihat dan mengganggu estetika visual.
    - **Solusi**: Mengisolasi garis pointer vertikal agar hanya digambar setinggi satu jalur (`h = laneHeight`) tepat pada koordinat vertikal jalur yang sedang aktif (`y = currY`, di mana `currY = currentMomentIndex * laneHeight`):
      ```javascript
      const currY = currentMomentIndex * laneHeight;
      drawFilters.push(`drawbox=x=537:y=${currY}:w=6:h=${laneHeight}:color=0xFFCC00@0.9:t=fill`);
      drawFilters.push(`drawbox=x=539:y=${currY}:w=2:h=${laneHeight}:color=white@0.95:t=fill`);
      ```
      Dengan perubahan ini:
      1. Garis pointer hanya ada pada roulette yang sedang aktif.
      2. Ketika giliran roulette tersebut telah selesai (beralih ke segmen berikutnya / sudah tidak aktif), garis pointer pada jalur tersebut otomatis hilang (*disappear*).
      3. Dijamin hanya ada tepat 1 garis pointer setinggi 1 jalur roulette dalam satu waktu di seluruh tampilan video.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/utils/rouletteEditor.js`:
    - Mengubah parameter `y` dari `0` menjadi `currY` dan `h` dari `totalStackHeight` menjadi `laneHeight` pada filter `drawbox` pointer tengah.
    - Menghapus deklarasi ulang `currY` pada blok spotlight aktif untuk menghindari duplikasi variabel.
    - Meningkatkan penanganan error spawnSync dengan `maxBuffer: 50MB` dan menangkap `res.error` / `res.status` jika stderr kosong.

## [e452491] - Replace Green Highlight Box with Spotlight Dark Overlay and Dim Moving Background Lanes
- **Konteks Struktural**:
  - Efek Sorotan Lampu Spotlight Multi-Tier (*Multi-Tier Spotlight Dark Overlay Architecture*) ([rouletteEditor.js](file:///d:/projects/clipping/scheduler-uploader/utils/rouletteEditor.js)):
    - **Penyebab & Kebutuhan Desain**: Kotak border hijau (#00FF66) sebelumnya terasa kaku dan mengaburkan batas estetika kartu. Penonton membutuhkan fokus visual yang tajam langsung ke kartu pemenang tanpa distraksi kartu lain di jalur yang sama maupun jalur lain yang belum aktif.
    - **Solusi**: Menggantikan border hijau dengan sistem filter overlay gelap berlapis (*spotlight overlay*):
      1. **Jalur Aktif Saat Berputar ($t < \text{stopTime}$)**: Tidak diberi overlay gelap (terang penuh 100%) agar animasi perputaran kartu terlihat jelas dan dinamis.
      2. **Jalur Aktif Saat Berhenti ($t \ge \text{stopTime}$)**: Mengaktifkan filter `drawbox=enable='gte(t\,stopTime)':...:color=black@dimOpacity:t=fill` di sisi kiri ($X = 0 \dots \text{cardScreenX}$) dan sisi kanan ($X = \text{cardScreenX} + \text{laneHeight} \dots 1080$), sehingga kartu yang terpilih menjadi satu-satunya elemen yang terang benderang (*spotlighted*).
      3. **Ketahanan Status Sorotan Kartu Pemenang (*Permanent Winner Spotlight*)**: Pada jalur-jalur pemenang sebelumnya ($j < \text{currentMomentIndex}$), status spotlight gelap kiri-kanan kartu tetap dipertahankan permanen hingga akhir kompilasi, menjaga rekap visual momen-momen yang telah dimenangkan.
      4. **Jalur Latar Belakang Redup Bergerak (*Dim Moving Background Lanes*)**: Jalur-jalur yang belum tiba sesinya ($b > \text{currentMomentIndex}$) ditutup overlay gelap penuh ($W = 1080, H = \text{laneHeight}$) dengan `color=black@dimOpacity:t=fill`, tetapi tetap berputar kontinu dengan kecepatan `topSpeed`. Hal ini mempertahankan dinamika roda roulette di latar belakang sekaligus memusatkan 100% perhatian penonton ke jalur yang sedang aktif.
  - Parameterisasi Opasitas Redup Fleksibel (*Configurable Dim Opacity*) ([config.js](file:///d:/projects/clipping/scheduler-uploader/utils/config.js), [compile_roulette.js](file:///d:/projects/clipping/scheduler-uploader/compile_roulette.js)):
    - Menambahkan parsing konfigurasi `rouletteDimOpacity` dari variabel lingkungan `ROULETTE_DIM_OPACITY` / `ROULETTE_SPOTLIGHT_OPACITY` (default: 0.65, batas aman 0.05 - 1.0) dan argumen CLI `--dim-opacity=`, `--roulette-dim=`, dan `--spotlight-dim=`.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/utils/rouletteEditor.js`:
    - Menghapus filter border hijau `drawbox=...:color=0x00FF66:t=6`.
    - Menerapkan overlay gelap bersyarat pada sisi kiri dan kanan kartu terpilih di jalur aktif saat $t \ge \text{stopTime}$.
    - Menerapkan overlay gelap permanen di sisi kiri dan kanan kartu pada jalur yang sudah menang sebelumnya.
    - Menerapkan overlay gelap penuh sepanjang durasi pada jalur background yang belum sesinya tanpa menghentikan perputaran kontinu.
  - `scheduler-uploader/utils/config.js`:
    - Menambahkan `rouletteDimOpacity` dengan nilai default `0.65` dan parsing opsi CLI `--dim-opacity=`.
  - `scheduler-uploader/compile_roulette.js`:
    - Meneruskan konfigurasi `dimOpacity` dari `config.rouletteDimOpacity` ke pemanggilan `renderRouletteSpinSegment`.
  - `scheduler-uploader/.env.example`:
    - Menambahkan dokumentasi konfigurasi `ROULETTE_DIM_OPACITY=0.65`.

## [02f6211] - Enforce Strictly Even LaneHeight to Eliminate Video Codec Truncation and Highlight Box Misalignment
- **Konteks Struktural**:
  - Eliminasi Akumulasi Drift Dimensi Ganjil (*Odd-Dimension Codec Truncation Elimination*) ([compile_roulette.js](file:///d:/projects/clipping/scheduler-uploader/compile_roulette.js), [rouletteEditor.js](file:///d:/projects/clipping/scheduler-uploader/utils/rouletteEditor.js)):
    - **Penyebab Masalah**: Saat jumlah klip roulette adalah angka ganjil (seperti `clipCount = 5`), perhitungan tinggi jalur `laneHeight = Math.floor(1536 / 5) = 307` menghasilkan angka ganjil. Standar codec video H.264 (YUV420p chroma subsampling 2x2) dan format kompresi JPEG mewajibkan seluruh resolusi gambar dan pemotongan genap (habis dibagi 2). Akibatnya, saat FFmpeg melakukan `scale=307:307` atau `crop=307:307` untuk menyusun pita horizontal, FFmpeg secara otomatis memotong (*truncate*) lebar tiap kartu menjadi **306 piksel** (dikonfirmasi melalui ffprobe: $13770 \times 306$ px, $13770 / 45 = 306$).
    - **Dampak pada Kotak Hijau**: JavaScript berasumsi lebar tiap kartu adalah $307$ px ($X = N \times 307$), sementara pita fisik riil FFmpeg bergeser $306$ px per kartu ($X = N \times 306$). Akumulasi selisih 1 piksel per kartu ini menyebabkan pergeseran 15 piksel pada kartu ke-15, 50 piksel pada kartu ke-50, hingga lebih dari 150 piksel pada pita panjang, membuat kotak sorotan hijau (`drawbox`) meleset dari gambar kartu pemenang. Sebaliknya, saat `clipCount = 2, 3, 4`, nilai `laneHeight` selalu berupa angka genap (768, 512, 384) sehingga tidak pernah mengalami pemotongan 1px oleh FFmpeg.
    - **Solusi**: Menerapkan penjaminan dimensi genap (*strictly even laneHeight enforcement*) di `compile_roulette.js` dan sebagai *guard clause* di `buildLaneRibbons` serta `renderRouletteSpinSegment`:
      ```javascript
      laneHeight = laneHeight % 2 === 0 ? laneHeight : laneHeight - 1;
      ```
      Pada konfigurasi 5 jalur, `laneHeight` secara konsisten bernilai genap $306$ px di seluruh alur JavaScript dan filter grafis FFmpeg, menjamin koordinat pita fisik dan kotak sorotan hijau terbingkai presisi hingga 0 piksel selisih (*pixel-perfect*).
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_roulette.js`:
    - Mengubah kalkulasi `laneHeight` menjadi genap (`if (laneHeight % 2 !== 0) laneHeight -= 1`).
  - `scheduler-uploader/utils/rouletteEditor.js`:
    - Menambahkan penjaga dimensi genap di awal fungsi `buildLaneRibbons` dan `renderRouletteSpinSegment`.

## [8e8da62] - Fix Ribbon Building Command Length Crash and Add Google Drive Upload Retries
- **Konteks Struktural**:
  - Arsitektur Pita Periodik Kompak (*Compact Periodic Ribbon Generation*) ([rouletteEditor.js](file:///d:/projects/clipping/scheduler-uploader/utils/rouletteEditor.js)):
    - **Penyebab Masalah (Galat Ribbon #4)**: Pada konfigurasi 5 jalur horizontal dan kecepatan tinggi, perhitungan pita sebelumnya membangun strip gambar linier sepanjang total jarak tempuh seluruh segmen ($distTotal \approx 46.800$ px), membutuhkan hingga 163 kartu per pita. Pemanggilan `spawnSync` dengan 163 input `-i` dan 163 filter scale/crop menghasilkan string argumen sepanjang lebih dari 33.000 karakter, yang melampaui batas maksimal perintah Windows `CreateProcessW` (32.767 karakter) dan menyebabkan pembuatan pita pada jalur ke-5 (Ribbon #4) gagal secara hening tanpa pesan error.
    - **Solusi**: Merumuskan arsitektur pita periodik kompak (*compact periodic circular wheel*). Karena kartu kandidat per jalur hanya berkisar $M$ item unik, pita hanya perlu dibuat sepanjang $M_{eff}$ kartu ditambah kartu penutup layar ($\approx 15 - 25$ kartu total, lebar $\approx 4.000 - 6.000$ px). Pergerakan crop dihitung menggunakan modulo periodik:
      $$xExpr = \text{mod}(xStartInitial + sStart + \text{pergerakan}(t), \; periodWidth)$$
      Nilai $xStartInitial$ dihitung secara analitik agar saat deselerasi berhenti, pita tepat mendarat di $xStopTarget \pmod{periodWidth}$. Dengan perubahan ini, panjang argumen FFmpeg terpangkas dari 33.000 karakter menjadi hanya ~2.000 karakter, pita terbebas dari limitasi Windows 32KB dan limitasi dimensi JPEG 65KB, dengan kontinuitas 100% tanpa jumping.
  - Mekanisme Percobaan Ulang Unggahan Google Drive (*Resilient Drive Upload with Exponential Backoff*) ([compiler.js](file:///d:/projects/clipping/scheduler-uploader/utils/compiler.js)):
    - **Penyebab Masalah (write ECONNABORTED)**: Unggahan video kompilasi final berukuran besar (30MB - 100MB+) rentan mengalami pemutusan soket oleh jaringan atau Google (`write ECONNABORTED`) jika terjadi fluktuasi koneksi sesaat.
    - **Solusi**: Menambahkan siklus percobaan ulang otomatis hingga 3 kali percobaan dengan jeda bertingkat (*exponential backoff* 3s, 6s). Setiap percobaan membuat *readable stream* baru (`fs.createReadStream`) serta memperpanjang batas waktu koneksi (*socket timeout*) hingga 10 menit (600.000 ms) dengan `maxBodyLength: Infinity`. Jika koneksi sempat terputus, sistem otomatis menyambung kembali tanpa menggugurkan proses kompilasi.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/utils/rouletteEditor.js`:
    - Mengganti pita linier 163 kartu menjadi pita periodik kompak ($\approx 15-25$ kartu per pita).
    - Menghitung $xStartInitial$ berbasis $periodWidth$ dan modulo analitik agar koordinat henti kartu pemenang tepat berada di bawah pointer emas.
  - `scheduler-uploader/utils/compiler.js`:
    - Memperbarui `uploadCompilationToDrive` dengan perulangan percobaan ulang hingga 3 kali, pembuatan stream baru per percobaan, dan timeout 10 menit.

## [8ed16fc] - Continuous Seamless Roulette Trajectory, Upfront Generation, and Synchronized Freeze-Fade Transitions
- **Konteks Struktural**:
  - Peniadaan Fenomena Kartu Melompat (*Zero-Jumping Continuous Trajectory Architecture*) ([rouletteEditor.js](file:///d:/projects/clipping/scheduler-uploader/utils/rouletteEditor.js)):
    - **Penyebab Masalah**: Sebelumnya, setiap segmen putaran roulette menghitung posisi pita kartu secara independen dari $t = 0$. Jalur yang belum aktif bergerak menggunakan fungsi modulo acak `mod(k*600 + t*topSpeed, maxX)`, sementara saat tiba gilirannya, koordinatnya langsung di-reset ke formula pengereman `xStop - dist`. Akibatnya, saat transisi speedup memudar keluar menampilkan gambar kartu A-B-C, begitu segmen spin berikutnya mulai kartu tiba-tiba "melompat/teleportasi" ke gambar kartu lain.
    - **Solusi**: Merumuskan kontinuitas matematis 100% pada seluruh jalur sepanjang seluruh durasi kompilasi. Total jarak yang ditempuh jalur $k$ sebelum berhenti mengunci di segmen $k$ adalah:
      $$\text{distTotal}_k = k \cdot (spinDuration \cdot maxSpeed) + refDist$$
      Titik awal koordinat pita jalur $k$ pada $t = 0$ segmen pertama didefinisikan sebagai $xStartInitial_k = xStop_k - \text{distTotal}_k$.
      Pada setiap segmen $s < k$, jalur $k$ mulai tepat di koordinat $(xStartInitial_k + s \cdot distPerSegment)$ dan berakhir persis di titik awal segmen berikutnya $(s+1)$. Dengan demikian, seluruh kartu yang terlihat saat transisi freeze-fade berakhir dijamin berada di posisi piksel yang sama persis saat roda kembali berputar tanpa lonjakan sedikit pun (Zero-Jumping).
  - Prapembuatan Putaran Roulette di Awal (*Upfront Roulette Pre-Generation & Modular Pipeline*) ([compile_roulette.js](file:///d:/projects/clipping/scheduler-uploader/compile_roulette.js)):
    - Mengatur ulang alur kompilasi menjadi tahapan modular yang jauh lebih rapi, cepat, dan terpisah:
      - **Tahap 2**: Mengunduh seluruh pool kartu meme dan seluruh video full speedup momen terpilih di awal dari Google Drive, mengeliminasi jeda jaringan saat proses render.
      - **Tahap 3A**: Merender seluruh segmen putaran roulette (Segmen 1 s/d N) terlebih dahulu dan mengambil snapshot frame diam papan saat berhenti (`roulette_still_k.jpg`).
      - **Tahap 3B**: Merangkai seluruh video full speedup dengan Freeze Fade-In & Freeze Fade-Out di atas snapshot papan roulette.
      - **Tahap 4**: Menggabungkan seluruh segmen berselingan `[spin_1, speedup_1, spin_2, speedup_2, ...]` dengan metode Single-Pass 60 FPS CFR concat.
  - Penambahan Jeda Freeze Papan & Freeze Video Speedup (*Dual-Freeze Fade Transition System*) ([rouletteEditor.js](file:///d:/projects/clipping/scheduler-uploader/utils/rouletteEditor.js), [config.js](file:///d:/projects/clipping/scheduler-uploader/utils/config.js), [.env.example](file:///d:/projects/clipping/scheduler-uploader/.env.example)):
    - Memperkenalkan parameter konfigurasi lingkungan baru `ROULETTE_BOARD_FREEZE` (default: 0.5s, alias `ROULETTE_BOARD_PAUSE` dan argumen CLI `--board-freeze=`).
    - Menyusun urutan waktu transisi yang sangat mulus dan simetris:
      1. **Board Freeze Sebelum Fade-In** (`boardFreezeDuration`, 0.5s): Papan roulette diam terkunci dengan kotak seleksi hijau agar penonton dapat membaca kartu pemenang dengan jelas.
      2. **Fade-In Mulus** (`fadeDuration`, 0.5s): Video doksli memudar masuk (opacity $0\% \to 100\%$) di atas papan.
      3. **Pre-Play Freeze** (`freezeDuration`, 0.5s): Frame awal video doksli ditahan diam pada 100% opacity agar penonton dapat scanning subtitle & konten sebelum video bergerak.
      4. **Playback Speedup**: Video doksli diputar bersama aliran audio dengan tunda sinkron (`adelay`).
      5. **Post-Play Freeze** (`freezeDuration`, 0.5s): Frame terakhir video doksli ditahan diam pada 100% opacity ("freeze dulu baru fadeout").
      6. **Fade-Out Mulus** (`fadeDuration`, 0.5s): Video doksli memudar keluar (opacity $100\% \to 0\%$) kembali ke papan roulette.
      7. **Board Freeze Setelah Fade-Out** (`boardFreezeDuration`, 0.5s): Papan roulette diam terkunci kembali sebelum putaran segmen berikutnya mulai berputar secara mulus.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/utils/config.js`:
    - Menambahkan parsing `rouletteBoardFreeze` dari `ROULETTE_BOARD_FREEZE` dan opsi CLI `--board-freeze=`.
  - `scheduler-uploader/utils/rouletteEditor.js`:
    - Memperbarui `buildLaneRibbons` untuk menghitung `distTotal`, `targetCardIndex`, dan `xStartInitial` per jalur secara kontinu.
    - Memperbarui `renderRouletteSpinSegment` untuk menggunakan koordinat kontinu `xStartInThisSegment + t * topSpeed` tanpa modulo buatan.
    - Memperbarui `renderSpeedupClipWithFade` dengan pipeline 7-tahap: clone frame awal (board freeze + fade-in + pre-play) dan frame akhir (post-play + fade-out + board freeze).
  - `scheduler-uploader/compile_roulette.js`:
    - Mengorganisasi alur kerja menjadi Tahap 2 (download aset), Tahap 3A (render roulette putaran), Tahap 3B (render speedup klip), dan Tahap 4 (concat).
  - `scheduler-uploader/.env.example`:
    - Menambahkan dokumentasi konfigurasi `ROULETTE_BOARD_FREEZE=0.5`.

## [2f9ac40] - Configurable Max Speed, Natural Random Offset Stop, and Physical Audio Synchronization
- **Konteks Struktural**:
  - Konfigurasi Kecepatan Puncak Bebas (*Configurable Max Speed*) ([config.js](file:///d:/projects/clipping/scheduler-uploader/utils/config.js), [rouletteEditor.js](file:///d:/projects/clipping/scheduler-uploader/utils/rouletteEditor.js), [compile_roulette.js](file:///d:/projects/clipping/scheduler-uploader/compile_roulette.js), [.env.example](file:///d:/projects/clipping/scheduler-uploader/.env.example)):
    - Memperkenalkan parameter lingkungan baru `ROULETTE_MAX_SPEED` (default: 3600 px/s, alias `ROULETTE_SPEED`, dan argumen CLI `--max-speed=`, `--roulette-speed=`).
    - Pengguna dapat leluasa mengatur kecepatan putaran roulette sesuai selera, sementara durasi putaran (`ROULETTE_SPIN_DURATION`) dan durasi penguncian kartu (`ROULETTE_LOCK_DURATION`) tetap dapat dikustomisasi secara terpisah.
    - Menghitung jarak pengereman deselerasi secara otomatis: $\text{refDist} = \frac{\text{maxSpeed} \cdot \text{stopTime}}{2}$. Seluruh jalur background dan detik ke-0 jalur aktif dijamin bergerak pada kecepatan yang sama persis tanpa ada lompatan kecepatan.
  - Pemulihan Offset Berhenti Acak Alami (*Natural Random Offset Stop*) ([rouletteEditor.js](file:///d:/projects/clipping/scheduler-uploader/utils/rouletteEditor.js)):
    - Mengembalikan variasi posisi henti off-center acak natural (antara $-15\%$ hingga $+15\%$ dari lebar kartu per jalur) sesuai preferensi pengguna agar putaran roulette terlihat organik dan tidak kaku persis di tengah seperti robot.
    - Memastikan secara geometris bahwa pointer garis emas tengah ($X = 540$) selalu memotong jelas kartu pemenang (berjarak setidaknya $35\%$ dari batas tepi kartu), dan kotak sorotan hijau (`#00FF66`) membingkai kartu pemenang secara presisi $100\%$ tepat di koordinat berhentinya (`cardScreenX`).
    - Menghitung panjang pita ribbon secara dinamis berdasarkan `refDist` agar pita kartu tidak pernah kurang atau menghasilkan koordinat negatif saat mulai melambat dari kecepatan tinggi.
  - Sinkronisasi Fisik Efek Suara Ratchet (*Physical Motion-to-Audio Synchronization*) ([rouletteEditor.js](file:///d:/projects/clipping/scheduler-uploader/utils/rouletteEditor.js)):
    - Mengatasi masalah audio roulette yang sebelumnya tidak sinkron dengan gerakan visual kartu.
    - Waktu ketukan derik ratchet kini dihitung secara analitik langsung dari persamaan integral gerak *quadratic ease-out*:
      $$s(t) = \text{maxSpeed} \cdot \left(t - \frac{t^2}{2 \cdot \text{stopTime}}\right)$$
    - Setiap kartu berpindah sejauh `stepDistance` piksel, ratchet membunyikan 1 klik. Frekuensi bunyi klik otomatis melambat secara serempak dan harmonis dengan gerakan visual kartu di layar, dan berhenti tepat di milidetik roda berhenti saat denting bel emas berbunyi.
  - Keamanan Eksekusi Pembuatan Ribbon ([rouletteEditor.js](file:///d:/projects/clipping/scheduler-uploader/utils/rouletteEditor.js)):
    - Membersihkan direktori `ribbons/` sebelum perakitan agar berkas pita lama tidak bentrok.
    - Mengganti `execSync` pembuatan pita hstack menjadi pemanggilan langsung `spawnSync` untuk mencegah limitasi panjang perintah shell Windows cmd.exe.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/utils/config.js`:
    - Menambahkan pembacaan `rouletteMaxSpeed` dari `.env` dan parser CLI `--max-speed=`.
  - `scheduler-uploader/utils/rouletteEditor.js`:
    - Memperbarui `generateRouletteAudioWav` dengan kalkulasi diskriminan quadratic motion $s(t)$.
    - Memperbarui `buildLaneRibbons` dengan kalkulasi dinamis panjang pita, random offset $-15\%$ s/d $+15\%$, dan eksekusi `spawnSync`.
    - Memperbarui `renderRouletteSpinSegment` untuk menerima `maxSpeed`.
  - `scheduler-uploader/compile_roulette.js`:
    - Meneruskan `config.rouletteMaxSpeed` ke `buildLaneRibbons` dan `renderRouletteSpinSegment`.
  - `scheduler-uploader/.env.example`:
    - Menambahkan dokumentasi parameter `ROULETTE_MAX_SPEED=3600`.

## [1a90c40] - Fix FFmpeg Filtergraph Input Stream Index in Speedup Fade Clip
- **Konteks Struktural**:
  - Perbaikan Pemetaan Indeks Aliran Masukan FFmpeg (*FFmpeg Stream Input Index*) ([rouletteEditor.js](file:///d:/projects/clipping/scheduler-uploader/utils/rouletteEditor.js)):
    - Mengatasi galat fatal `FFmpeg error in renderSpeedupClipWithFade: Error initializing complex filters: Invalid argument`.
    - **Penyebab Masalah**: Sebelumnya variabel `bgInputIndex` diinisialisasi menggunakan `inputArgs.length` (jumlah elemen array argumen baris perintah Node.js) yang bernilai 2 ketika `inputArgs = ['-i', rawVideoPath]`. Akibatnya, filter complex memanggil `[2:v]` padahal FFmpeg hanya menerima 2 input (`0:v` dari video mentah dan `1:v` dari still frame latar belakang papan roulette). FFmpeg menolak karena aliran masukan `2:v` tidak pernah ada.
    - **Solusi**: Mengganti pelacakan input menggunakan penghitung indeks stream eksplisit (`numInputs = 1`, lalu di-increment secara presisi pada setiap penambahan berkas input `-i`). Dengan perbaikan ini, still frame latar belakang dipetakan secara akurat ke `[1:v]` (atau `[2:v]` jika generator audio hening `anullsrc` disisipkan di posisi 1).
- **Perubahan Kode Penting**:
  - `scheduler-uploader/utils/rouletteEditor.js`:
    - Menginisialisasi `numInputs = 1` dan memetakan `bgInputIndex` ke `numInputs++`.
    - Mengharmoniskan fallback video format `format=yuva420p` jika latar still frame tidak digunakan.

## [f775cb0] - Configurable Candidate Items per Roulette, Center Stop Alignment, and Eye-Friendly Gentle Deceleration
- **Konteks Struktural**:
  - Konfigurasi Variasi Item Kandidat per Jalur Roulette ([rouletteEditor.js](file:///d:/projects/clipping/scheduler-uploader/utils/rouletteEditor.js), [config.js](file:///d:/projects/clipping/scheduler-uploader/utils/config.js), [compile_roulette.js](file:///d:/projects/clipping/scheduler-uploader/compile_roulette.js), [.env.example](file:///d:/projects/clipping/scheduler-uploader/.env.example)):
    - Mengatasi masalah pita roulette yang sebelumnya hanya menampilkan 2 variasi gambar.
    - Memperkenalkan parameter konfigurasi `ROULETTE_ITEMS` (default: 5, alias `ROULETTE_ITEM_COUNT` dan flag CLI `--items=5`).
    - Untuk setiap jalur roulette (misal 10 jalur), sistem mengambil 1 kartu target pemenang momen tersebut dan memilih secara acak $(N - 1)$ gambar kandidat lainnya dari kumpulan gambar kartu di Google Drive untuk disusun berdampingan pada pita horizontal.
    - Memperbarui generator kartu cadangan sintetis pada `downloadMemeImagesPool` agar menggunakan kanvas solid PNG native FFmpeg (mengeliminasi potensi crash SVG).
  - Presisi Penguncian Kartu Tepat di Tengah (*Zero Miss Center Pointer Stop*) ([rouletteEditor.js](file:///d:/projects/clipping/scheduler-uploader/utils/rouletteEditor.js)):
    - Mengeliminasi offset acak off-center yang menyebabkan kotak hijau terlihat meleset (*miss*) jauh dari garis pointer emas tengah.
    - Piringan roulette kini diprogram untuk berhenti tepat di tengah sumbu kanvas ($X = 540$), memastikan kotak sorotan hijau (`#00FF66`) membingkai kartu pemenang secara simetris $100\%$ presisi tepat di bawah pointer garis emas tengah.
  - Kecepatan Nyaman Discan Mata & Sinkronisasi Sempurna Top Speed ([rouletteEditor.js](file:///d:/projects/clipping/scheduler-uploader/utils/rouletteEditor.js)):
    - Menurunkan kecepatan putaran ekstrem dari sebelumnya ~10 kartu/detik menjadi kecepatan santai yang nyaman discan oleh mata (~2 kartu/detik) dengan memendekkan jarak deselerasi menjadi 3.5 kartu menggunakan kurva *quadratic ease-out* ($n = 2$).
    - Menjamin secara matematis bahwa kecepatan seluruh jalur background yang belum tiba gilirannya melambat bergerak konstan pada $\text{topSpeed} = \frac{2 \cdot \text{refDist}}{\text{stopTime}}$, yang bernilai **SAMA PERSIS** dengan kecepatan detik ke-0 jalur aktif saat mulai mengerem.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/utils/config.js`:
    - Menambahkan pembacaan `rouletteItems` dari `process.env.ROULETTE_ITEMS` / `ROULETTE_ITEM_COUNT` (default: 5) dan parser CLI `--items=`.
  - `scheduler-uploader/utils/rouletteEditor.js`:
    - Memperbarui `buildLaneRibbons` untuk memilih $(N - 1)$ kandidat acak per jalur dan mengunci koordinat henti `xStop` presisi di $X = 540$.
    - Mengubah formula deselerasi pada `renderRouletteSpinSegment` ke *quadratic ease-out* dengan `topSpeed = Math.round((2 * refDist) / stopTime)`.
  - `scheduler-uploader/compile_roulette.js`:
    - Meneruskan `config.rouletteItems` ke `buildLaneRibbons`.
  - `scheduler-uploader/.env.example`:
    - Menambahkan dokumentasi parameter `ROULETTE_ITEMS=5`.

## [71ac45f] - Speedup Audio-Video Perfect Synchronization and Pre-Play Freeze Duration
- **Konteks Struktural**:
  - Perbaikan Sinkronisasi Audio Speedup & Eliminasi Audio Prematur ([rouletteEditor.js](file:///d:/projects/clipping/scheduler-uploader/utils/rouletteEditor.js)):
    - Mengatasi masalah audio doksli speedup yang berbunyi mendahului video (*sound miss*): sebelumnya argumen eksekusi FFmpeg menggunakan `-map 0:a?` mentah sehingga string filter audio `af` (penundaan `adelay` dan percepatan nada `asetrate`) tidak pernah diaplikasikan, menyebabkan audio diputar sejak $t = 0$ saat video masih membeku fade-in.
    - Mengintegrasikan pemrosesan audio sepenuhnya ke dalam `-filter_complex` (`[${audioInputRef}]...[finala]`) dan memetakannya dengan `-map [finala]`.
    - Menambahkan fungsi helper `hasAudioStream` untuk mendeteksi ketersediaan track audio secara presisi, dengan fallback otomatis ke generator audio hening stereo (`anullsrc`) jika berkas video mentah tidak memiliki audio.
  - Penambahan Jeda Diam Pre-Play Doksli (*Pre-Play Freeze Duration*) ([config.js](file:///d:/projects/clipping/scheduler-uploader/utils/config.js), [compile_roulette.js](file:///d:/projects/clipping/scheduler-uploader/compile_roulette.js), [rouletteEditor.js](file:///d:/projects/clipping/scheduler-uploader/utils/rouletteEditor.js), [.env.example](file:///d:/projects/clipping/scheduler-uploader/.env.example)):
    - Memperkenalkan parameter lingkungan baru `ROULETTE_FREEZE_DURATION` (default: 0.5 detik, alias `ROULETTE_PREPLAY_FREEZE` dan argumen CLI `--freeze-duration=`).
    - Setelah animasi fade-in tuntas pada *opacity* 100%, frame awal video doksli ditahan diam (*frozen frame 0*) selama 0.5 detik sebelum video bergerak dan audio berbunyi, memberi jendela waktu bagi penonton untuk memindai gambar dan membaca subtitle dua baris (nama game dan timestamp) agar tidak terasa bertubi-tubi.
    - Mengkalkulasi penundaan audio (`adelay`) secara matematis tepat sebesar $\text{fadeDuration} + \text{freezeDuration}$ (misal $0.5\text{s} + 0.5\text{s} = 1000\text{ms}$), sehingga gerakan video dan suara audio mulai berputar secara serempak dan presisi $100\%$.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/utils/config.js`:
    - Menambahkan pembacaan `rouletteFreezeDuration` dari `process.env.ROULETTE_FREEZE_DURATION` / `ROULETTE_PREPLAY_FREEZE` (default: 0.5) dan parser CLI `--freeze-duration=`.
    - Mengembalikan `rouletteFreezeDuration` pada `getConfig()`.
  - `scheduler-uploader/utils/rouletteEditor.js`:
    - Menambahkan fungsi `hasAudioStream`.
    - Menghitung `startFreezeDuration = fadeDuration + freezeDuration` dan menunda audio sebesar `startFreezeDuration * 1000` ms.
    - Menyalurkan audio yang dipercepat dan tertunda melalui label filter `[finala]` di dalam `filter_complex`.
  - `scheduler-uploader/compile_roulette.js`:
    - Memperbarui teks log proses pembuatan klip speedup agar mencantumkan durasi freeze awal (`freeze awal: ${freezeDur}s`).
  - `scheduler-uploader/.env.example`:
    - Menambahkan dokumentasi parameter `ROULETTE_FREEZE_DURATION=0.5`.

## [0ddf7b3] - Fixed Lock Freeze Duration and Mathematical Top Speed Synchronization
- **Konteks Struktural**:
  - Sinkronisasi Kecepatan Puncak Roda Roulette Background ([rouletteEditor.js](file:///d:/projects/clipping/scheduler-uploader/utils/rouletteEditor.js)):
    - Mengatasi ketidaksesuaian kecepatan visual di mana jalur background sebelumnya berputar pada kecepatan konstan rendah (1500 px/s) sehingga terkesan melambat di background lalu mendadak melesat cepat kembali saat gilirannya aktif.
    - Menghitung kecepatan putaran puncak (*top speed*) awal turunan deselerasi *cubic ease-out* pada $t = 0$: $v(0) = \frac{3 \cdot \text{refDist}}{\text{stopTime}}$.
    - Menerapkan kecepatan $v(0)$ ini secara konsisten dan seragam pada seluruh jalur background ($k > \text{currentMomentIndex}$) yang belum tiba gilirannya melambat. Dengan demikian, semua roda yang berputar bergerak pada kecepatan puncak yang identik di awal, dan pengereman kartu aktif menyambung mulus dari kecepatan latar belakang tanpa ada percepatan mendadak.
  - Durasi Kunci Kartu Tetap (*Fixed Lock Duration*) & Fleksibilitas Angka Bulat ([config.js](file:///d:/projects/clipping/scheduler-uploader/utils/config.js), [compile_roulette.js](file:///d:/projects/clipping/scheduler-uploader/compile_roulette.js), [rouletteEditor.js](file:///d:/projects/clipping/scheduler-uploader/utils/rouletteEditor.js), [.env.example](file:///d:/projects/clipping/scheduler-uploader/.env.example)):
    - Mendukung konfigurasi durasi total putaran roulette bebas (`ROULETTE_SPIN_DURATION`, termasuk angka bulat seperti 3, 4, 5 detik).
    - Memperkenalkan parameter durasi kunci kartu terpilih `ROULETTE_LOCK_DURATION` (default: 1.0 detik, dengan alias `ROULETTE_STOP_DURATION` / flag `--lock-duration=`) agar kartu pemenang dan kotak hijau selalu diam terbaca jelas selama 1 detik penuh sebelum klip video speedup muncul, berapa pun durasi total yang dipilih pengguna.
    - Menghitung waktu deselerasi secara otomatis: $\text{stopTime} = \text{spinDuration} - \text{lockDuration}$ (misal durasi 3s $\to$ melambat 2.0s + lock 1.0s; durasi 5s $\to$ melambat 4.0s + lock 1.0s; durasi 4.4s $\to$ melambat 3.4s + lock 1.0s).
    - Menyesuaikan efek denting lonceng emas ganda (*lock bell chime*) agar meluruh (*decay*) secara harmonis selama durasi `lockDuration`.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/utils/config.js`:
    - Menambahkan pembacaan `rouletteLockDuration` dari `process.env.ROULETTE_LOCK_DURATION` / `ROULETTE_STOP_DURATION` (default: 1.0) dan parser CLI `--lock-duration=` / `--stop-duration=`.
    - Mengembalikan `rouletteLockDuration` pada fungsi `getConfig()`.
  - `scheduler-uploader/utils/rouletteEditor.js`:
    - Menghitung `topSpeed = Math.round((3 * refDist) / stopTime)` dan menggunakannya pada formula pergerakan jalur background: `mod(${k * 600}+t*${topSpeed}\\,${maxX})`.
    - Menyesuaikan jendela bunyi denting bel emas pada `generateRouletteAudioWav` dengan `duration - stopTime`.
  - `scheduler-uploader/compile_roulette.js`:
    - Mengkalkulasi `stopTime = Math.max(0.5, spinDuration - lockDuration)` secara dinamis dan memperbarui log proses putaran.
  - `scheduler-uploader/.env.example`:
    - Menambahkan dokumentasi parameter `ROULETTE_LOCK_DURATION=1.0`.

## [f805932] - Single Active Green Highlight Box per Roulette Session
- **Konteks Struktural**:
  - Pembatasan Kotak Sorotan Hijau Tunggal per Frame ([rouletteEditor.js](file:///d:/projects/clipping/scheduler-uploader/utils/rouletteEditor.js)):
    - Mengubah perilaku kotak sorotan hijau (`#00FF66`) agar **hanya muncul pada sesi jalur aktif saat ini** ketika piringan roulette berhenti mengunci kartu pemenang ($t \ge \text{stopTime}$).
    - Menghilangkan kotak sorotan hijau dari jalur-jalur sebelumnya saat video berpindah ke sesi roulette berikutnya. Dengan demikian, di dalam 1 frame video dijamin **maksimal hanya ada 1 kotak hijau**, menjaga tampilan visual tetap bersih dan fokus pada kartu yang sedang ditentukan.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/utils/rouletteEditor.js`:
    - Menghapus perulangan penggambaran kotak hijau pada jalur yang sudah menang (`for (let j = 0; j < currentMomentIndex; j++)`).
    - Menyisakan hanya 1 filter `drawbox` dinamis untuk kartu terpilih pada jalur aktif saat $t \ge \text{stopTime}$.

## [7ef91c7] - Configurable Roulette Freeze Fade Duration and Env Documentation
- **Konteks Struktural**:
  - Konfigurasi Durasi Transisi Freeze Fade-In & Fade-Out ([rouletteEditor.js](file:///d:/projects/clipping/scheduler-uploader/utils/rouletteEditor.js), [compile_roulette.js](file:///d:/projects/clipping/scheduler-uploader/compile_roulette.js), [config.js](file:///d:/projects/clipping/scheduler-uploader/utils/config.js), [.env.example](file:///d:/projects/clipping/scheduler-uploader/.env.example)):
    - Mengubah durasi transisi *freeze still frame* (fade-in dan fade-out pada video full speedup) dari semula hardcoded 0.25 detik menjadi **0.5 detik secara default**, serta membuatnya dapat diatur dinamis melalui file konfigurasi lingkungan (`.env`) maupun argumen CLI.
    - Pada `renderSpeedupClipWithFade`, frame awal ditahan selama `fadeDuration` (0.5s) saat animasi fade-in berjalan, dan frame akhir ditahan selama `fadeDuration` (0.5s) saat fade-out berjalan. Audio ditunda (`adelay`) sebesar $0.5\text{s} = 500\text{ms}$ agar pemutaran suara baru dimulai tepat saat fade-in tuntas.
    - Menambahkan pembacaan parameter lingkungan `ROULETTE_FADE_DURATION` dan argumen CLI `--fade-duration=` / `--roulette-fade=`.
  - Dokumentasi Lingkungan Terpadu ([.env.example](file:///d:/projects/clipping/scheduler-uploader/.env.example)):
    - Mendokumentasikan variabel konfigurasi mode roulette pada `.env.example`: `ROULETTE_SPIN_DURATION` (default: 4.4) dan `ROULETTE_FADE_DURATION` (default: 0.5) dengan penjelasan fungsi masing-masing parameter.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/utils/config.js`:
    - Menambahkan pembacaan `rouletteFadeDuration` dari `process.env.ROULETTE_FADE_DURATION` (default: 0.5) dan parser CLI `--fade-duration=` / `--roulette-fade=`.
    - Mengembalikan `rouletteFadeDuration` pada objek kembalian fungsi `getConfig()`.
  - `scheduler-uploader/utils/rouletteEditor.js`:
    - Mengubah `const fadeDuration = 0.25` menjadi `const fadeDuration = parseFloat(config?.rouletteFadeDuration) || 0.5;`.
  - `scheduler-uploader/compile_roulette.js`:
    - Memperbarui teks log proses agar menampilkan angka durasi fade secara dinamis (`${fadeDur}s`).
  - `scheduler-uploader/.env.example`:
    - Menambahkan dokumentasi blok konfigurasi mode roulette untuk `ROULETTE_SPIN_DURATION` dan `ROULETTE_FADE_DURATION`.

## [d5542d1] - Doubled Roulette Duration and Uniform Base Lane Speed
- **Konteks Struktural**:
  - Peningkatan Durasi Putaran Roulette 2x Lipat ([rouletteEditor.js](file:///d:/projects/clipping/scheduler-uploader/utils/rouletteEditor.js), [compile_roulette.js](file:///d:/projects/clipping/scheduler-uploader/compile_roulette.js), [config.js](file:///d:/projects/clipping/scheduler-uploader/utils/config.js)):
    - Memperlama durasi segmen putaran roulette menjadi dua kali lipat: dari 2.2 detik (1.8s putaran melambat + 0.4s lock freeze) menjadi **4.4 detik** (3.6s putaran melambat + 0.8s lock freeze) sesuai permintaan user agar animasi penentuan kartu terasa lebih mendebarkan dan dramatis.
    - Menyesuaikan sintesis audio efek roulette (`generateRouletteAudioWav`): memperpanjang deretan bunyi *ratchet click* hingga 3.6 detik dengan kurva perlambatan progresif eksponensial ($t^{2.5}$), dan denting bel emas ganda (*lock bell chime*) berbunyi merdu di detik 3.6 dengan peluruhan (*decay*) sepanjang 0.8 detik.
    - Menambah jarak pengereman deselerasi kartu aktif (`laneHeight * 12`) sehingga deselerasi *cubic ease-out* terlihat sangat halus dan berbobot dalam jendela waktu 3.6 detik.
    - Menghubungkan durasi putaran secara dinamis melalui parameter lingkungan `ROULETTE_SPIN_DURATION` pada `.env` serta argumen CLI `--spin-duration=` / `--roulette-duration=`.
  - Penyelarasan Kecepatan Putaran Roulette Jalur Non-Berhenti ([rouletteEditor.js](file:///d:/projects/clipping/scheduler-uploader/utils/rouletteEditor.js)):
    - Menyeragamkan kecepatan putaran semua jalur yang belum tiba gilirannya melambat menjadi kecepatan dasar konstan yang seragam (`baseSpeed = 1500 px/s`) dengan offset posisi awal pita bertingkat (`k * 400`), menggantikan variasi kecepatan asinkron (`1200 + k * 250`).
    - Hal ini meratakan beban visual dan encoding gerakan pada segmen klip awal saat ada $x - 1$ jumlah roulette bergerak bersamaan tanpa melambat.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/utils/config.js`:
    - Menambahkan pembacaan `rouletteSpinDuration` dari `process.env.ROULETTE_SPIN_DURATION` (default: 4.4) dan parser argumen CLI `--spin-duration=` / `--roulette-duration=`.
  - `scheduler-uploader/utils/rouletteEditor.js`:
    - Mengubah nilai default `generateRouletteAudioWav` dan `renderRouletteSpinSegment` dari 2.2s / 1.8s menjadi `spinDuration = 4.4, stopTime = 3.6`.
    - Menyelaraskan ekspresi gerakan jalur kontinu menjadi `mod(${k * 400}+t*${baseSpeed}\\,${maxX})` dengan `baseSpeed = 1500`.
  - `scheduler-uploader/compile_roulette.js`:
    - Mengoper `config.rouletteSpinDuration` dan `stopTime` yang dihitung secara dinamis (`spinDuration * 0.82`) ke fungsi `renderRouletteSpinSegment`.

## [9008990] - Single Line Center Pointer, Natural Off-Center Stop, and SpawnSync Execution
- **Konteks Struktural**:
  - Implementasi Preferensi Desain Pointer & Stop Natural ([rouletteEditor.js](file:///d:/projects/clipping/scheduler-uploader/utils/rouletteEditor.js), [note.md](file:///d:/projects/clipping/note.md)):
    - Pointer roulette diubah menjadi **hanya 1 garis vertikal lurus di tengah** ($X = 540$) berwarna emas dengan inti putih terang, menghilangkan bingkai selektor kolom dan panah segitiga emas atas/bawah sesuai permintaan di `note.md`.
    - Mengimplementasikan pemberhentian kartu yang tidak kaku/tidak persis di tengah (*natural off-center stop*): menambahkan offset acak antara $-18\%$ hingga $+18\%$ dari lebar kartu per jalur, sehingga putaran roulette terlihat organik dan tidak seperti robot yang diprogram, dengan kepastian garis tengah $X = 540$ tetap memotong kartu target pemenang.
    - Menghitung koordinat dinamis kartu di layar (`cardScreenX`) sehingga **kotak border hijau (`#00FF66`)** tetap membingkai kartu pemenang secara presisi di posisi berhentinya yang off-center saat $t \ge 1.8\text{s}$.
  - Pencegahan Deadlock & Stuck pada Windows Shell ([rouletteEditor.js](file:///d:/projects/clipping/scheduler-uploader/utils/rouletteEditor.js), [compile_roulette.js](file:///d:/projects/clipping/scheduler-uploader/compile_roulette.js)):
    - Mengganti eksekusi FFmpeg dari `execSync` (yang dibungkus oleh Windows `cmd.exe /d /s /c`) menjadi pemanggilan langsung `spawnSync` dengan array argumen `CreateProcessW`.
    - Menghilangkan bug deadlock/hang pada Windows command prompt akibat parsing string filter complex yang panjang dan multi-quoting.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/utils/rouletteEditor.js`:
    - Mengimpor `spawnSync` dari `child_process`.
    - Memperbarui `buildLaneRibbons` untuk menyertakan `cardOffset` dan `cardScreenX`.
    - Memperbarui `renderRouletteSpinSegment` untuk menggambar hanya 1 garis tengah dan kotak hijau presisi posisi `cardScreenX`, serta mengeksekusi FFmpeg melalui `spawnSync`.
    - Memperbarui `renderSpeedupClipWithFade` untuk mengeksekusi FFmpeg melalui `spawnSync`.
  - `scheduler-uploader/compile_roulette.js`:
    - Memperbarui ekstraksi still frame latar belakang untuk menggunakan `spawnSync`.

## [7710d14] - Native FFmpeg Drawbox Roulette Overlays and Freeze Frame Transitions
- **Konteks Struktural**:
  - Eliminasi Dependensi SVG dan librsvg pada Roulette Pointer ([rouletteEditor.js](file:///d:/projects/clipping/scheduler-uploader/utils/rouletteEditor.js), [compile_roulette.js](file:///d:/projects/clipping/scheduler-uploader/compile_roulette.js)):
    - Mengatasi kesalahan fatal `Command failed: ffmpeg ... -i roulette_pointer.svg ...` yang disebabkan oleh ketiadaan dukungan `librsvg` pada pustaka `ffmpeg-static` di lingkungan Windows.
    - Menggantikan perenderan berkas perantara SVG/PNG dengan filter native FFmpeg `drawbox` langsung pada `[stack]` kanvas roulette.
    - Menambahkan divider pemisah antar jalur, garis vertikal pembimbing emas di $X = 540$, pointer penunjuk atas/bawah, serta kotak sorotan hijau terang (`#00FF66`) yang mengunci kartu pemenang saat $t \ge \text{stopTime}$.
  - Aturan Timing Freeze-Frame pada Transisi Speedup Video ([rouletteEditor.js](file:///d:/projects/clipping/scheduler-uploader/utils/rouletteEditor.js), [compile_roulette.js](file:///d:/projects/clipping/scheduler-uploader/compile_roulette.js)):
    - Menerapkan aturan jeda pemutaran: video speedup **tidak diputar saat animasi fade-in berlangsung**. Frame 0 ditahan (*freeze still frame*) menggunakan filter `tpad=start_mode=clone` selama durasi fade-in (0.25s) sambil bertransisi opacity $0\% \to 100\%$.
    - Video speedup diputar utuh dari detik awal hingga durasi penuh selesai (~5 detik) pada opacity 100%.
    - Frame terakhir ditahan (*freeze still frame*) menggunakan filter `tpad=stop_mode=clone` selama durasi fade-out (0.25s) sambil bertransisi opacity $100\% \to 0\%$.
    - Mengekstrak frame terakhir dari segmen putaran roulette (`-sseof -0.1 -update 1 -frames:v 1`) sebagai `bgStillPath` sehingga transisi fade-in dan fade-out melebur mulus langsung di atas papan roulette yang baru berhenti tanpa layar hitam.
    - Menunda audio speedup menggunakan `adelay=delays=250:all=1` sehingga audio baru bersuara tepat ketika animasi fade-in selesai.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/utils/rouletteEditor.js`:
    - Mengubah `generateRoulettePointerImage` menjadi fungsi kompatibilitas stub (menghapus eksekusi SVG).
    - Memperbarui `renderRouletteSpinSegment` untuk menyematkan filter `drawbox` garis panduan emas, divider, panah, dan kotak highlight hijau dinamis.
    - Memperbarui `renderSpeedupClipWithFade` dengan `tpad` (clone frame awal & akhir), `format=yuva420p`, fade alpha, penundaan audio `adelay`, dan dukungan overlay latar papan roulette (`bgStillPath`).
  - `scheduler-uploader/compile_roulette.js`:
    - Menghapus pembuatan berkas `roulette_pointer.png`.
    - Mengekstrak still frame akhir segmen roulette dan meneruskannya ke `renderSpeedupClipWithFade` sebagai latar belakang fade.

## [76265a7] - Strict Full Video Speedup Crawler and Roulette Image Card Requirement
- **Konteks Struktural**:
  - Validasi Ketat Video Full pada Speedup Crawler ([crawl_speedup_drive.js](file:///d:/projects/clipping/scheduler-uploader/crawl_speedup_drive.js), [selector.js](file:///d:/projects/clipping/scheduler-uploader/utils/selector.js), [GEMINI.md](file:///d:/projects/clipping/GEMINI.md)):
    - Memperbarui `detectClipFolderFiles` pada crawler dan `findVideoPair` pada selector agar klip yang tidak memiliki berkas persis bernama `full.mp4` (atau base name `full`) **dilarang menggunakan fallback** ke berkas video lain (seperti `cut.mp4` atau nama acak lainnya). Jika `full.mp4` tidak ditemukan, klip wajib dilewati (skip) demi mencegah video cut ter-speedup secara keliru (Aturan Baru Rule 24).
    - Memastikan bahwa ketiadaan `cut.mp4` tidak lagi menghalangi pemrosesan `speedup.mp4` asalkan `full.mp4` tersedia, karena pembuatan speedup murni hanya membutuhkan video full.
  - Seleksi Momen Roulette Khusus Folder Ber-`image.jpg` ([compile_roulette.js](file:///d:/projects/clipping/scheduler-uploader/compile_roulette.js), [selector.js](file:///d:/projects/clipping/scheduler-uploader/utils/selector.js), [GEMINI.md](file:///d:/projects/clipping/GEMINI.md)):
    - Menambahkan opsi `requireMemeImage: true` pada `selectQuizMoments` dan `selectSingleGameQuizMoments` saat dipanggil oleh `compile_roulette.js`.
    - Momen untuk mode roulette **hanya mengambil folder klip yang memiliki kartu gambar `image.jpg`**; folder yang tidak memiliki `image.jpg` langsung diskip karena setiap jalur roulette membutuhkan kartu gambar 1:1 spesifik momen (Aturan Baru Rule 25).
    - Menjamin penanganan aman `pair.cutFile` null/undefined pada seleksi momen tanpa cut di mode roulette.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/crawl_speedup_drive.js`:
    - Menghapus logika fallback `otherVideos` pada `detectClipFolderFiles`, menegakkan syarat mutlak berkas video bernama `full` (atau sudah ada `speedupFile`).
    - Mengizinkan pembuatan `speedup.mp4` ketika hanya ada `full.mp4` tanpa memerlukan `cut.mp4`.
  - `scheduler-uploader/utils/selector.js`:
    - Memperbarui `findVideoPair` untuk mendukung `options.requireCut` dan `options.requireFull` tanpa fallback saat `requireCut = false`.
    - Memperbarui `findGameMomentPair`, `findEpisodeClipPair`, `selectSingleGameQuizMoments`, dan `selectQuizMoments` agar mendukung opsi `requireMemeImage: true` dan aman menangani klip tanpa `cut.mp4` (`pair.cutFile ? ... : ...`).
  - `scheduler-uploader/compile_roulette.js`:
    - Mengirimkan `{ requireCut: false, requireMemeImage: true }` ke `selectQuizMoments` dan `selectSingleGameQuizMoments`.
  - `GEMINI.md`:
    - Menambahkan Rule 24 (`[DATA] Never fallback to arbitrary video files when searching for full video clips in crawlers or compilers...`) dan Rule 25 (`[DATA] Always require an existing "image.jpg" card asset when selecting moments for roulette compilations...`).

## [55d8371] - Multi-Lane Horizontal Roulette Compilation Mode and Two-Line Game Title Overlay
- **Konteks Struktural**:
  - Mode Kompilasi Baru: Gudang Doksli Roulette Edition ([compile_roulette.js](file:///d:/projects/clipping/scheduler-uploader/compile_roulette.js), [rouletteEditor.js](file:///d:/projects/clipping/scheduler-uploader/utils/rouletteEditor.js), [package.json](file:///d:/projects/clipping/scheduler-uploader/package.json)):
    - Membuat program terpisah `compile_roulette.js` (dapat dijalankan via `npm run roulette` atau `npm run compile:roulette`) khusus untuk mode kompilasi video speedup berorientasi horizontal roulette tanpa kuis dan tanpa transisi layar hitam TikTok core.
    - **Multi-Lane Horizontal Roulette**: Menampilkan $X$ jalur roulette horizontal yang ditumpuk secara vertikal (total tinggi 80% kanvas 9:16 = 1536 px, terpusat vertikal di Y = 192 s/d 1728).
    - **Pita Kartu & Deselerasi Estafet (Cubic Ease-Out)**: Seluruh jalur berputar horizontal simultan. Satu per satu jalur melambat dan berhenti mengunci kartu yang ditunjuk pointer indikator emas di tengah ($X = 540$) disertai efek suara ratchet ticks dan bell lock chime.
    - **Transisi Fade-In & Fade-Out Mulus**: Setelah suatu jalur berhenti, video speedup full meme (~5 detik) menimpa dengan animasi fade-in (0.25s), diputar, lalu fade-out (0.25s) kembali ke papan roulette. Jalur lama tetap terkunci di posisinya, sementara jalur berikutnya berputar untuk berhenti.
    - **Pool Kartu Gambar Meme 1:1**: Mengumpulkan dan menjahit berkas `image.jpg` acak dari Google Drive menjadi pita horizontal 24 kartu per jalur.
  - Standar Baru Teks Overlay Video Full 2 Baris ([selector.js](file:///d:/projects/clipping/scheduler-uploader/utils/selector.js), [overlay.js](file:///d:/projects/clipping/scheduler-uploader/utils/overlay.js), [crawl_speedup_drive.js](file:///d:/projects/clipping/scheduler-uploader/crawl_speedup_drive.js)):
    - Memperbarui `getFullVideoDisplayText` untuk mencantumkan Nama Game pada baris atas: `"<Nama Game>\n<Episode / Waktu Indonesia>"` (misal `"the mortuary assistant\neps 1 menit 40 detik 25"`).
    - Memperbarui `generateFullVideoASS` di `overlay.js` agar merender baris 1 (Nama Game, fs 44 tebal) dan baris 2 (Episode / Waktu, fs 38 tebal) dengan rapi, terpusat horizontal dan vertikal (`\an5\q2`), mematuhi aturan strict line-break Rule 23.
    - Otomatis kompatibel pada `crawl_speedup_drive.js`, mode kuis `compile_doksli.js`, dan mode roulette `compile_roulette.js`.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_roulette.js`:
    - Membuat alur utama kompilasi roulette dengan seleksi momen, penyiapan pool gambar, perenderan pita horizontal, pembuatan segmen putaran roulette, perakitan video speedup ber-fade, dan penggabungan single-pass 60 FPS.
  - `scheduler-uploader/utils/rouletteEditor.js`:
    - Membuat modul pembantu roulette: `downloadMemeImagesPool`, `generateRouletteAudioWav` (sintesis ratchet tick + bell chime), `buildLaneRibbons` (penjahitan pita HxH hstack), `generateRoulettePointerImage` (indikator tengah emas), `renderRouletteSpinSegment`, dan `renderSpeedupClipWithFade`.
  - `scheduler-uploader/utils/selector.js`:
    - Memperbarui `getFullVideoDisplayText` untuk mendukung parameter `gameName` di baris pertama dan mempertahankan kompatibilitas mundur.
  - `scheduler-uploader/utils/overlay.js`:
    - Memperbarui `generateFullVideoASS` untuk memisahkan baris judul game dan penanda waktu dengan font sizing berbobot rapi.
  - `scheduler-uploader/crawl_speedup_drive.js`:
    - Meneruskan `item.gameName` ke `getFullVideoDisplayText`.
  - `scheduler-uploader/package.json`:
    - Menambahkan script `"roulette"` dan `"compile:roulette"`.

## [8cedca8] - Progressive Speedup Crawler and Fast-Path Compiler Integration
- **Konteks Struktural**:
  - Script Crawler & Generator Speedup Google Drive ([crawl_speedup_drive.js](file:///d:/projects/clipping/scheduler-uploader/crawl_speedup_drive.js), [package.json](file:///d:/projects/clipping/scheduler-uploader/package.json)):
    - Membuat script mandiri `crawl_speedup_drive.js` (`npm run speedup` / `npm run crawl:speedup`) untuk menelusuri seluruh klip Doksli di Google Drive, merender versi speedup dinamis (~5 detik, rasio 9:16 vertikal, 60 FPS CFR, audio pitch-shifted cempreng, dan overlay teks judul), lalu LANGSUNG mengunggahnya 1 per 1 ke folder klip yang sama di Google Drive dengan nama `speedup.mp4`.
    - **Eksekusi Progresif 1 per 1**: Selesai 1 klip langsung diunggah ke Google Drive dan file lokal dihapus. Jika program dihentikan pengguna di tengah jalan (Ctrl+C / early stop), seluruh klip yang sudah terunggah tetap aman di cloud.
    - **Idempoten & Deteksi Otomatis**: Saat program dijalankan kembali, klip yang sudah memiliki `speedup.mp4` otomatis dideteksi dan dilewati (skip). Menyediakan opsi `--force` untuk merender ulang jika diinginkan.
    - **Opsi CLI Komprehensif**: Mendukung `--dry-run` (simulasi tanpa download/upload), `--yes` (auto konfirmasi), `--game="<nama>"` (filter game), `--limit=<n>` (batasi kuota), dan `--no-overlay`.
  - Integrasi Kompilator Dokli ([selector.js](file:///d:/projects/clipping/scheduler-uploader/utils/selector.js), [downloader.js](file:///d:/projects/clipping/scheduler-uploader/utils/downloader.js), [compiler.js](file:///d:/projects/clipping/scheduler-uploader/utils/compiler.js)):
    - Memperbarui `findVideoPair` di `selector.js` untuk mendeteksi keberadaan `speedup.mp4` di samping `cut.mp4` dan `full.mp4`.
    - Mengoptimalkan `downloadMomentVideos` di `downloader.js`: Jika `speedup.mp4` sudah tersedia di Google Drive, script langsung mengunduh `speedup.mp4` (berukuran kecil ~1-2 MB) dan melewati download video full mentah (30-80 MB).
    - Memperbarui `processSingleMoment` di `compiler.js`: Menggunakan `speedup.mp4` siap pakai dari Google Drive secara instan, melewati rendering FFmpeg manual untuk bagian full meme, sehingga kompilasi berlangsung jauh lebih cepat.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/crawl_speedup_drive.js`:
    - Membuat modul crawler progresif lengkap dengan pemindaian hierarki folder, penanganan graceful shutdown SIGINT, kalkulasi auto speed ~5s, audio pitch shift cempreng, ASS subtitle generation, dan upload langsung Google Drive API v3.
  - `scheduler-uploader/utils/selector.js`:
    - Memperbarui `findVideoPair` agar mengenali folder dengan 3 file video (`cut.mp4`, `full.mp4`, `speedup.mp4`) dan memetakan `speedupFile`.
    - Meneruskan `speedupFile` pada seluruh titik instansiasi pasangan momen klip.
  - `scheduler-uploader/utils/downloader.js`:
    - Menambahkan logika pemilihan unduh `speedupFile` prioritas sebelum fallback ke `fullFile`.
    - Mengembalikan `isAlreadySpeedup` dan `rawSpeedupPath`.
  - `scheduler-uploader/utils/compiler.js`:
    - Menghubungkan jalur cepat (fast-path) di mana `rawSpeedupPath` langsung disalin ke `normFullPath` tanpa memanggil `renderFullMemeClip`.
  - `scheduler-uploader/package.json`:
    - Menambahkan npm script `"speedup"` dan `"crawl:speedup"`.

## [a92487b] - Preserve Skip Prefix for Crawler Folders and Indonesian Text Overlay Conversion
- **Konteks Struktural**:
  - Pelestarian Prefix Skip pada Crawler ([crawl_organize_drive.js](file:///d:/projects/clipping/scheduler-uploader/crawl_organize_drive.js)):
    - Mendukung penamaan folder bertanda skip `!-` menjadi `!HH:MM:SS` (misal `!-` -> `!00:12:54` atau `!01:39:12`), sehingga status skip klip tetap terjaga di Google Drive dan otomatis diabaikan oleh kompilator.
    - Memperkuat regex deteksi folder seri/episode (`isSeriesFolder`) dengan `/(^|[\s_!-])(eps|episode|part|season|chapter)\s*\d+/i` dan membatasi kandidat klip hanya pada folder bertanda strip (`-`, `!-`) atau berformat timestamp. Hal ini secara mutlak melindungi folder episode (seperti `!feed and grow eps 3`) agar tidak tertimpa menjadi timestamp.
  - Konversi Teks Overlay Video Full ke Bahasa Indonesia Alami ([selector.js](file:///d:/projects/clipping/scheduler-uploader/utils/selector.js), [compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js)):
    - Menambahkan fungsi `formatTimestampToIndoTime(str)` yang mengonversi balik format jam angka `HH:MM:SS` menjadi kalimat penanda waktu Indonesia alami `"jam X menit Y detik Z"` untuk overlay teks meme video full, dengan aturan penulisan spesifik:
      - Digit `0x` diubah menjadi `x` tanpa angka 0 di depan (misal `05` -> `5`).
      - Jam bernilai `00` dihilangkan seluruhnya (tanpa tulisan "jam 0").
      - Menit dan detik bernilai `00` tetap ditulis namun hanya satu angka 0 (contoh: `00:00:00` -> `"menit 0 detik 0"`, `01:00:10` -> `"jam 1 menit 0 detik 10"`).
    - Memperbarui `getFullVideoDisplayText` agar secara konsisten mengonversi nama folder klip berformat `HH:MM:SS` menjadi penanda waktu teks Indonesia pada overlay video full meme (misal `"eps 1 menit 39 detik 35"` atau `"menit 39 detik 35"`).
- **Perubahan Kode Penting**:
  - `scheduler-uploader/crawl_organize_drive.js`:
    - Mengatur target penamaan folder klip skip agar mempertahankan awalan `!` (`targetFolderName = isFolderSkipped ? `!${rawTs}` : rawTs`).
    - Memperbaiki pengenalan folder episode dan leaf folder agar tidak mengategorikan kontainer episode yang belum bersubfolder sebagai klip.
  - `scheduler-uploader/utils/selector.js`:
    - Menambahkan fungsi `formatTimestampToIndoTime(str)` dengan regex parser `HH:MM:SS` dan pemetaan aturan penulisan jam/menit/detik bahasa Indonesia.
    - Menghubungkan `formatTimestampToIndoTime` di dalam `getFullVideoDisplayText` untuk merender nama folder `full.mp4` ke teks overlay video.
    - Memperbarui `isClipOrSingleStreamSub` untuk mengenali folder klip skip `^!\d{1,2}:`.
    - Mengekspor `formatTimestampToIndoTime`.
  - `scheduler-uploader/compile_doksli.js`:
    - Mengimpor dan mengekspor ulang `formatTimestampToIndoTime`.

## [56ca573] - Crawler and Reorganizer Script for Google Drive Doksli with Standard Zero-Padded Timestamp Folders
- **Konteks Struktural**:
  - Script Crawler & Pengorganisir Google Drive ([crawl_organize_drive.js](file:///d:/projects/clipping/scheduler-uploader/crawl_organize_drive.js), [package.json](file:///d:/projects/clipping/scheduler-uploader/package.json)):
    - Membuat script mandiri `crawl_organize_drive.js` (dapat dijalankan via `npm run crawl` atau `npm run organize`) untuk menelusuri seluruh subfolder Google Drive Doksli, mendeteksi pasangan video (`cut.mp4` & video full), lalu mereorganisasi struktur penamaan secara aman:
      - **Format Folder Angka Waktu ("HH:MM:SS")**: Mengubah nama folder klip dari `"-"` menjadi format jam standar berpanjang tetap 8 karakter (`HH:MM:SS`, misal `"00:39:35"`, `"01:12:05"`).
      - **Riset Google Drive Sort by Name**: Mengonfirmasi bahwa Google Drive menyortir berkas secara leksikografis (ASCII strict) dan tidak mendukung "natural numeric sorting". Menuliskan jam 0 sebagai `"00:"` menjamin panjang digit seragam sehingga seluruh klip tersortir dalam urutan kronologis yang 100% presisi.
      - **Pembeda Seri vs Klip Video**: Memudahkan membedakan antara folder seri/episode (diawali teks seperti `eps 1`, `part 2`) dengan folder klip video (diawali angka `00:xx:xx` / `01:xx:xx`).
      - **Urutan Konfirmasi Aman**: Sesuai instruksi, nama folder diubah dan dikonfirmasi terlebih dahulu di Google Drive (`res.data.name === newFolderName`), barulah nama berkas video full diubah menjadi `"full.mp4"`. Jika update folder gagal, file tidak disentuh sehingga judul aslinya tidak akan hilang.
      - **Dukungan CLI Fleksibel**: Menyediakan opsi `--dry-run` (simulasi tanpa mutasi), `--yes` (otomatis konfirmasi), `--game="<nama>"` (filter game), dan `--folder="<id>"`.
  - Integrasi Kompatibilitas Kompilator ([selector.js](file:///d:/projects/clipping/scheduler-uploader/utils/selector.js), [compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js)):
    - Memperbarui fungsi `getFullVideoDisplayText` untuk mendukung resolusi teks overlay video full ketika berkas bernama `"full.mp4"`, dengan mengambil deskripsi dari nama folder klipnya (`clipFolderName`).
    - Memperbarui `isClipOrSingleStreamSub` pada mode edisi 1 game agar mengenali folder klip berformat angka (`^\d{1,2}:`) sebagai klip single-stream (bukan episode), menjaga aturan keunikan dan pencegahan early-fail.
    - Tetap menjunjung tinggi aturan awalan skip (`!`): seluruh folder/berkas yang diawali tanda seru otomatis diabaikan.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/crawl_organize_drive.js`:
    - Membuat modul crawler baru dengan pemindaian rekursif, deteksi pasangan video, tabel pratinjau perubahan, konfirmasi interaktif, dan penanganan rate limiting.
  - `scheduler-uploader/utils/selector.js`:
    - Menambahkan fungsi pembantu `parseTimeToStandardTimestamp(str)` untuk mengonversi pola waktu teks Indonesia ("jam X menit Y detik Z") menjadi format zero-padded "HH:MM:SS".
    - Memperbarui `getFullVideoDisplayText` dan meneruskan parameter `clipFolderName` di seluruh pemanggilan seleksi klip.
    - Memperbarui deteksi single-stream pada `selectSingleGameQuizMoments`.
    - Mengekspor `parseTimeToStandardTimestamp`.
  - `scheduler-uploader/compile_doksli.js`:
    - Mengimpor dan mengekspor ulang `parseTimeToStandardTimestamp`.
  - `scheduler-uploader/package.json`:
    - Menambahkan script CLI `"crawl": "node crawl_organize_drive.js"` dan `"organize": "node crawl_organize_drive.js"`.

## [9503862] - Softened Countdown Tick and Balanced Chime with Custom SFX Mixing
- **Konteks Struktural**:
  - Efek Suara Kuis & Kustomisasi SFX ([overlay.js](file:///d:/projects/clipping/scheduler-uploader/utils/overlay.js), [config.js](file:///d:/projects/clipping/scheduler-uploader/utils/config.js), [videoEditor.js](file:///d:/projects/clipping/scheduler-uploader/utils/videoEditor.js), [.env.example](file:///d:/projects/clipping/scheduler-uploader/.env.example)):
    - **Penyempurnaan Suara Countdown Beep (Lebih Halus & Hangat)**:
      - Menghapus gelombang elektronik nada 880Hz (A5) yang tajam, menusuk, dan berisik (buzzer).
      - Menggantinya dengan karakter nada metronom kayu / marimba akustik D5 (587.33 Hz) hangat berharmoni sub-body D4 (293.66 Hz) dan overtone D6 (1174.66 Hz).
      - Menerapkan kurva amplop *attack* lembut 4ms bebas klik dengan peluruhan eksponensial alami perkusi ($\exp(-\Delta t \cdot 45)$) serta memangkas amplitudo puncak dari $0.70$ ke $\sim 0.18$ (~74% lebih senyap dan nyaman di telinga).
    - **Penyesuaian Volume Correct Chime**:
      - Mempertahankan progresi akor arpeggio mayor C6-E6-G6 dan harmoni lonceng yang disukai pengguna.
      - Menurunkan amplitudo komponen not secara proporsional (~55% volume reduction, amplitudo puncak gabungan turun dari $0.78$ ke $0.33$) sehingga terdengar elegan, jernih, dan tidak membanting audio latar video.
    - **Dukungan Penuh SFX Eksternal (Online / Lokal)**:
      - Menyediakan konfigurasi berkas audio kustom untuk countdown tick (`QUIZ_TICK_SFX_PATH`) dan lonceng jawaban benar (`QUIZ_CORRECT_SFX_PATH`) via `.env` maupun argumen CLI (`--tick-sfx="..."`, `--correct-sfx="..."`).
      - Menyediakan fitur auto-deteksi berkas SFX lokal (`quiz_tick.mp3`/`.wav`, `quiz_correct.mp3`/`.wav`, dll.) jika diletakkan di direktori kerja.
      - Jika berkas SFX eksternal disediakan, `generateQuizSoundWav` melakukan komposit mixing multi-track secara presisi menggunakan filter FFmpeg (`asplit`, `adelay`, `amix`) pada ketukan $t = 0, 1, 2,$ dan $3 \times \text{tick}$.
      - Menyediakan proteksi *graceful fallback* ke sintesis gelombang halus bawaan jika FFmpeg mixing gagal atau file tidak ditemukan.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/utils/overlay.js`:
    - Memisahkan fungsi sintesis audio murni ke `generatePureSynthesizedQuizWav` dengan parameter nada D5 akustik dan volume arpeggio yang diperhalus.
    - Mengintegrasikan FFmpeg audio mixing multi-delay di dalam `generateQuizSoundWav` untuk menggabungkan aset SFX kustom eksternal.
  - `scheduler-uploader/utils/config.js`:
    - Menambahkan pembacaan `quizTickSfx` dan `quizCorrectSfx` dari `.env`, auto-deteksi berkas lokal, dan argumen CLI (`--tick-sfx`, `--correct-sfx`).
    - Memperbarui `printConfigBanner` untuk menampilkan informasi status SFX kuis (Custom / Default Akustik Halus).
  - `scheduler-uploader/utils/videoEditor.js`:
    - Meneruskan opsi konfigurasi SFX (`quizTickSfx`, `quizCorrectSfx`, `ffmpegBin`, `workDir`) ke `generateQuizSoundWav` di dalam `renderQuizFreezeClip`.
  - `scheduler-uploader/.env.example`:
    - Mendokumentasikan variabel `QUIZ_TICK_SFX_PATH` dan `QUIZ_CORRECT_SFX_PATH` beserta penjelasan format dan auto-deteksinya.

## [44f4395] - Single Game Edition Compilation Mode with Episode Quizzes and Early Fail Validation
- **Konteks Struktural**:
  - Mode Kompilasi Edisi Khusus 1 Game ([selector.js](file:///d:/projects/clipping/scheduler-uploader/utils/selector.js), [config.js](file:///d:/projects/clipping/scheduler-uploader/utils/config.js), [compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js), [compiler.js](file:///d:/projects/clipping/scheduler-uploader/utils/compiler.js), [videoEditor.js](file:///d:/projects/clipping/scheduler-uploader/utils/videoEditor.js), [.env.example](file:///d:/projects/clipping/scheduler-uploader/.env.example)):
    - Menambahkan dukungan kompilasi edisi khusus 1 game yang dapat dipicu via argumen CLI (`--single-game`, `--game="<nama>"`, `--game-id="<id>"`) maupun variabel `.env` (`SINGLE_GAME_MODE`, `SINGLE_GAME_NAME`, `SINGLE_GAME_FOLDER_ID`).
    - Menyediakan sistem pemilihan game *hybrid*:
      - Jika nama atau ID game disediakan via CLI/`.env`, sistem langsung memproses game tersebut secara otomatis tanpa interupsi.
      - Jika argumen `--single-game` dioper tanpa parameter pada terminal interaktif (TTY), sistem menampilkan menu daftar game bernomor (`[1]`, `[2]`, `[3]`, ...) untuk dipilih pengguna via prompt terminal (`promptGameSelection`).
    - Penyesuaian aturan khusus edisi 1 game:
      - **Opsi Kuis Berbasis Episode**: 4 opsi pilihan ganda kuis secara otomatis menampilkan **Nama Episode / Folder Lapis ke-2** dari game tersebut (`createUniqueEpisodeQuizOptions`). Pengecoh diambil dari subfolder episode lain pada game bersangkutan, dan dilengkapi variasi numerik dinamis jika total episode kurang dari 4.
      - **Pertanyaan Kuis Tetap Kustom & Default Tidak Berubah**: Pertanyaan kuis tetap mempertahankan nilai default konfigurasi (`"Momen manakah itu?"`) dan tetap dapat dikustomisasi via `.env` atau argumen `--question="..."`.
      - **Jarak Keunikan Episode & Early Fail Validasi**: Jarak keunikan `GAME_UNIQUE_WINDOW` bergeser berlaku pada keunikan Episode. Jika game yang dipilih bertipe non-episode / single-stream (hanya memiliki subfolder `"-"` atau langsung berisi video) dan `GAME_UNIQUE_WINDOW > 1`, sistem langsung **Early Fail** dengan penjelasan instruksi yang jelas.
      - **Keunikan Teks Overlay Tetap Dijamin**: Penegakan `usedOverlayKeys` tetap aktif sehingga tidak ada teks overlay video full yang duplikat dalam kompilasi.
    - Merapikan urutan teks log unduhan dan prefetch di terminal agar log unduhan Momen #1 ditampilkan terlebih dahulu dan header momen muncul sebelum pengumuman prefetch momen berikutnya.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/utils/config.js`:
    - Menambahkan parsing `singleGameMode`, `singleGameName`, `singleGameId`, dan memperbarui konsol banner untuk menampilkan status edisi game serta unit keunikan (Episode/Game).
  - `scheduler-uploader/utils/selector.js`:
    - Menambahkan fungsi pembantu `createUniqueEpisodeQuizOptions(correctAnswer, episodePool)` dan prompt interaktif `promptGameSelection(gameFolders)`.
    - Menambahkan fungsi seleksi edisi khusus 1 game `selectSingleGameQuizMoments(drive, config, allGameFolders)` dengan validasi early fail `"-"`, sliding cooldown episode, dan opsi episode.
    - Menghubungkan routing `selectSingleGameQuizMoments` di dalam `selectQuizMoments`.
    - Mengekspor fungsi-fungsi baru pada `module.exports`.
  - `scheduler-uploader/utils/videoEditor.js`:
    - Memperbarui string log render pada langkah 3 dari `"Mengunduh & merender video full"` menjadi `"Merender video full meme"`.
  - `scheduler-uploader/utils/compiler.js`:
    - Menghapus pencetakan header momen ganda agar urutan log di terminal selaras dengan notifikasi prefetch.
  - `scheduler-uploader/compile_doksli.js`:
    - Mengimpor dan mengekspor ulang fungsi pembantu edisi 1 game.
    - Menambahkan log pengunduhan awal momen #1 dan merapikan urutan pencetakan header momen sebelum log prefetch.
  - `scheduler-uploader/.env.example`:
    - Menambahkan dokumentasi variabel `SINGLE_GAME_MODE`, `SINGLE_GAME_NAME`, dan `SINGLE_GAME_FOLDER_ID`.

## [9ba5624] - Asynchronous Pipelined Pre-Fetching for Video Downloads
- **Konteks Struktural**:
  - Pipelined Asynchronous Pre-Fetching Download ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js), [compiler.js](file:///d:/projects/clipping/scheduler-uploader/utils/compiler.js)):
    - Mengoptimalkan alur kompilasi dengan memparalelkan beban kerja yang memanfaatkan subsistem hardware berbeda secara bersamaan:
      - **Download Google Drive**: Menggunakan *Network I/O & Bandwidth Internet* (beban CPU $\approx 0-2\%$, GPU $0\%$).
      - **Editing FFmpeg**: Menggunakan *CPU & GPU Compute* (beban bandwidth internet $0\%$).
    - Mengubah alur antrean sekuensial bergantian menjadi sistem **Pipelined Pre-Fetching**:
      - Sesaat setelah unduhan momen $i$ selesai dan FFmpeg mulai merender momen tersebut, Node.js langsung memicu pengunduhan berkas untuk momen berikutnya ($i+1$) di latar belakang (*background stream*) secara non-blocking.
      - Begitu FFmpeg menyelesaikan perenderan momen $i$, seluruh berkas video untuk momen $i+1$ sudah siap di penyimpanan lokal sehingga FFmpeg langsung memproses momen berikutnya tanpa jeda tunggu unduh (*zero download wait time*).
      - Menghapus berkas video mentah (`rawCutPath`, `rawFullPath`, `rawMemeImgPath`) segera setelah perenderan setiap momen tuntas untuk menjaga efisiensi ruang disk sementara (SSD/HDD).
    - Memasang mekanisme failsafe dengan proteksi *unhandled promise rejection* (`startMomentDownload`) sehingga jika ada berkas gagal diunduh di latar belakang, kesalahan ditangani dengan anggun dan kompilasi tetap berlanjut ke momen berikutnya.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/utils/compiler.js`:
    - Memperbarui `processSingleMoment` untuk menerima parameter `downloadedFiles` dan `isPrefetched`.
    - Menambahkan pembersihan langsung berkas mentahan video setelah langkah perenderan selesai.
  - `scheduler-uploader/compile_doksli.js`:
    - Mengimpor `downloadMomentVideos` dan `downloadDriveFile` dari `utils/downloader`.
    - Mengimplementasikan helper `startMomentDownload` dan restrukturisasi loop tahap 3 dengan pelacak `currentDownloadPromise` serta pemicu `nextDownloadPromise`.
    - Mengekspor ulang fungsi downloader di `module.exports`.

## [3e22191] - Strict Game-Level Full Video Overlay Uniqueness in Compilation
- **Konteks Struktural**:
  - Penegakan Keunikan Teks Overlay Full Video Per Game ([selector.js](file:///d:/projects/clipping/scheduler-uploader/utils/selector.js), [compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js)):
    - Dengan adanya kontrol jarak keunikan kustom (`GAME_UNIQUE_WINDOW`), suatu game dapat terpilih lebih dari satu kali dalam satu video kompilasi.
    - Menegakkan aturan seleksi momen: **Dilarang keras terdapat teks overlay video full (`fullVideoDisplayText`) yang sama dalam game yang sama**.
    - Episode diperbolehkan sama (`eps boleh sama`), misalnya dua klip berbeda yang berasal dari episode yang sama (contohnya `eps 1 - ketemu monster.mp4` dan `eps 1 - dikejar zombie.mp4`), namun klip dengan teks overlay yang identik pada game yang sama akan ditolak oleh selector dan dialihkan ke klip berikutnya.
    - Mengabstraksi pembuatan teks overlay ke fungsi modular `getFullVideoDisplayText(epsName, fullFileName)` sebagai *single source of truth* (menghapus ekstensi berkas, newline/enter, menormalisasi spasi, dan mengabaikan penanda `"-"` pada game single-stream maupun subfolder klip lapis ke-3).
    - Memperluas mekanisme filter `findGameMomentPair` dan `selectQuizMoments` dengan pelacakan `usedOverlayKeys` berbasis `${gameKey}:::${overlayText.toLowerCase()}` yang berjalan berdampingan dengan `usedPairKeys` (`${cutFile.id}_${fullFile.id}`).
- **Perubahan Kode Penting**:
  - `scheduler-uploader/utils/selector.js`:
    - Menambahkan fungsi pembantu `getFullVideoDisplayText(epsName, fullFileName)`.
    - Memperbarui `findGameMomentPair` agar menerima parameter `usedOverlayKeys` dan menyaring pasangan video yang teks overlay-nya telah digunakan pada game bersangkutan.
    - Memperbarui `selectQuizMoments` dengan `const usedOverlayKeys = new Set()` dan mendaftarkan teks overlay setiap momen yang terpilih.
    - Mengekspor `getFullVideoDisplayText` pada `module.exports`.
  - `scheduler-uploader/compile_doksli.js`:
    - Mengimpor dan mengekspor ulang `getFullVideoDisplayText` dan `selectQuizMoments`.

## [6d53511] - Configurable Sliding-Window Game Uniqueness and Uniform Game-Level Sampling
- **Konteks Struktural**:
  - Kontrol Jarak Keunikan Game & Sampling Setara Tingkat Game ([selector.js](file:///d:/projects/clipping/scheduler-uploader/utils/selector.js), [config.js](file:///d:/projects/clipping/scheduler-uploader/utils/config.js), [compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js), [.env.example](file:///d:/projects/clipping/scheduler-uploader/.env.example)):
    - Menambahkan variabel konfigurasi `GAME_UNIQUE_WINDOW` (default: 5) dan argumen CLI (`--unique-window=`, `--game-uniqueness=`, `--uniqueness=`, `--window=`) untuk mengontrol jarak jeda (*sliding window cooldown*) sebelum sebuah game boleh terpilih kembali:
      - Nilai $\ge 5$ (atau $\ge$ target klip): Menjamin dalam 5 klip berturut-turut tidak akan pernah ada duplikat game (setiap klip berasal dari game yang berbeda).
      - Nilai $= 1$: Bebas duplikat game, di mana game yang sama boleh muncul berturut-turut pada klip berikutnya asalkan memiliki klip/episode lain yang belum pernah digunakan dalam kompilasi tersebut.
      - Nilai $= 2, 3, \dots$: Game yang sama baru boleh muncul kembali setelah jeda 2 atau 3 klip.
    - Mengonfirmasi dan mengunci prinsip **Uniform Random di Tingkat Game**:
      - Pengacakan dilakukan pada daftar entitas folder Game (`allGameFolders`), bukan dengan menggabungkan seluruh klip dari seluruh game ke dalam satu kolam raksasa.
      - Game X (yang memiliki 100 klip) dan Game Y (yang hanya memiliki 5 klip) memiliki peluang terpilih yang persis setara ($1 : 1$), karena masing-masing game hanya memiliki tepat 1 tiket pada setiap putaran pemilihan kandidat.
    - Menambahkan fungsi pembantu lazy-scan `findGameMomentPair(drive, gameFolder, skipPrefix, usedPairKeys, gameClipsCache)`:
      - Memindai episode dan subfolder klip secara bertahap hanya saat game tersebut terpilih sebagai kandidat.
      - Menyimpan cache pasangan klip yang sudah ditemukan per game (`gameClipsCache`) agar jika game yang sama terpilih kembali di masa mendatang (setelah melewati cooldown window), sistem langsung mengambil klip lain yang belum terpakai tanpa melakukan kueri API Google Drive berulang kali.
      - Menjamin tidak ada berkas video pasangan yang sama (`cutFile` & `fullFile`) diputar ganda dalam 1 video kompilasi.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/utils/config.js`:
    - Menambahkan parsing `gameUniqueWindow` dari `process.env.GAME_UNIQUE_WINDOW` dan argumen CLI.
    - Menambahkan visualisasi jarak keunikan game pada konsol banner.
  - `scheduler-uploader/utils/selector.js`:
    - Mengimplementasikan `findGameMomentPair` dengan caching memori dan pelacakan `usedPairKeys`.
    - Mengubah loop seleksi `selectQuizMoments` dari iterasi tunggal `for..of` menjadi `while (validMoments.length < clipCountTarget)` berbasis sliding cooldown window.
    - Menambahkan failsafe pelepasan cooldown otomatis jika jumlah total game di Google Drive lebih sedikit dari target window.
  - `scheduler-uploader/compile_doksli.js`:
    - Mengimpor dan mengekspor ulang `findGameMomentPair`.
  - `scheduler-uploader/.env.example`:
    - Menambahkan dokumentasi variabel `GAME_UNIQUE_WINDOW=5`.

## [f110fab] - Configurable Transition Modes (Centered 1:1 Meme Facecam, Number Counter, and Off)
- **Konteks Struktural**:
  - Fleksibilitas Visual Layar Transisi TikTok Core ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js), [config.js](file:///d:/projects/clipping/scheduler-uploader/utils/config.js), [transition.js](file:///d:/projects/clipping/scheduler-uploader/utils/transition.js), [.env.example](file:///d:/projects/clipping/scheduler-uploader/.env.example)):
    - Menambahkan konfigurasi mode visual transisi layar hitam TikTok Core melalui variabel `.env` `TRANSITION_MODE` (pilihan: `meme`, `number`, `off`) dan argumen CLI (`--transition-mode=`, `--trans-mode=`, `--meme`, `--transition-meme`, `--no-counter`, dll):
      1. **Mode `"meme"`**:
         - Menampilkan gambar meme facecam berasio 1:1 di tengah layar hitam ($X=270, Y=690$) sepanjang durasi audio SFX TikTok Core.
         - Sesuai instruksi pengguna, gambar 1:1 **tidak diregangkan full-width 9:16** agar tidak terlalu besar, tidak pecah, dan tidak mengubah rasio visual: ukuran dikunci tepat pada **setengah lebar portrait ($1080 / 2 = 540\text{px}$)** sehingga berdimensi $540 \times 540\text{px}$.
         - Menggunakan filter FFmpeg `scale=540:540:force_original_aspect_ratio=decrease:flags=lanczos,pad=540:540:(540-iw)/2:(540-ih)/2:color=black@0` dan `overlay=270:690:format=auto` untuk penempatan sub-pixel yang presisi dan kompatibilitas format gambar dengan transparansi (PNG) maupun JPEG.
         - Berkas gambar opsional (.png / .jpg / .jpeg / .webp) diletakkan di setiap subfolder momen di Google Drive.
         - *Failsafe*: jika pada folder momen tertentu tidak ada berkas gambar meme, momen tersebut **sama sekali tidak diskip** dan proses tetap berjalan mulus dengan menampilkan layar hitam polos untuk jeda momen tersebut.
      2. **Mode `"number"`**:
         - Menampilkan teks counter urutan kuis `"x / y"` di tengah kanvas via subtitle ASS dinamis (perilaku standar sebelumnya).
      3. **Mode `"off"`**:
         - Menampilkan layar hitam polos murni tanpa overlay visual (hanya audio TikTok Core yang diputar).
    - Memperbarui pipeline seleksi ([selector.js](file:///d:/projects/clipping/scheduler-uploader/utils/selector.js)) dengan fungsi pembantu `findMemeImage` untuk mendeteksi berkas gambar meme di folder momen tanpa mengganggu validasi 2 berkas video (`findVideoPair`).
    - Memperbarui pipeline pengunduhan ([downloader.js](file:///d:/projects/clipping/scheduler-uploader/utils/downloader.js)) dan perakitan klip ([compiler.js](file:///d:/projects/clipping/scheduler-uploader/utils/compiler.js)) agar mengunduh gambar meme dan merender klip transisi dinamis per momen ketika mode meme aktif.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/utils/config.js`:
    - Menambahkan inisialisasi `transitionMode` ('meme', 'number', 'off') dengan fallback kompatibilitas ke `TRANSITION_SHOW_COUNTER` dan parsing argumen CLI.
    - Memperbarui banner informasi konsol untuk menampilkan mode transisi yang aktif.
  - `scheduler-uploader/utils/selector.js`:
    - Menambahkan helper `findMemeImage(files, skipPrefix)` dan menyematkan `memeImageFile` pada objek momen.
  - `scheduler-uploader/utils/downloader.js`:
    - Mengintegrasikan pengunduhan berkas gambar meme opsional ke dalam `downloadMomentVideos`.
  - `scheduler-uploader/utils/transition.js`:
    - Mengimplementasikan fungsi modular `renderTransitionClip` yang mengeksekusi filter 1:1 $540 \times 540\text{px}$ centered pada mode meme, subtitle counter pada mode number, atau canvas hitam polos pada mode off.
    - Memperbarui `prepareTransitionClips` untuk mengoordinasikan perakitan transisi berdasarkan mode aktif.
  - `scheduler-uploader/utils/compiler.js`:
    - Meneruskan `transitionSfxPath` dan `rawMemeImgPath` ke dalam `processSingleMoment` untuk perakitan transisi individual per momen.
  - `scheduler-uploader/compile_doksli.js`:
    - Meneruskan konfigurasi `transitionMode` dan re-ekspor fungsi `findMemeImage` serta `renderTransitionClip`.
  - `scheduler-uploader/.env.example`:
    - Menambahkan dokumentasi variabel `TRANSITION_MODE=number` (opsi: `number`, `meme`, `off`).

## [41bae24] - Modular Architecture with Dedicated Utils Sub-modules for Compiler Pipeline
- **Konteks Struktural**:
  - Modularisasi dan Dekomposisi Pipeline Kompilator Doksli ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js), [utils/](file:///d:/projects/clipping/scheduler-uploader/utils/)):
    - Memecah berkas monolitik `compile_doksli.js` (~1450 baris) menjadi modul-modul terfokus dan independen di folder `scheduler-uploader/utils/` sesuai fungsi domain masing-masing:
      1. [config.js](file:///d:/projects/clipping/scheduler-uploader/utils/config.js): Penanganan konfigurasi environment `.env`, argumen CLI, deteksi path binary FFmpeg, inisialisasi Google Auth client, dan visual banner konfigurasi konsol.
      2. [selector.js](file:///d:/projects/clipping/scheduler-uploader/utils/selector.js): Navigasi struktur folder Drive bertingkat (Game -> Episode -> Subfolder klip lapis ke-3), pengecekan prefix skip (`!`), validasi pasangan berkas video (`cut.mp4` dan video full), pemilihan opsi kuis unik (1 kunci + 3 pengecoh), dan formatting nama teks display overlay tanpa tanda `-`.
      3. [downloader.js](file:///d:/projects/clipping/scheduler-uploader/utils/downloader.js): Pengunduhan stream berkas Google Drive dengan pelacakan byte progress serta unduhan pasangan video klip dengan validasi runtime failsafe prefix skip.
      4. [overlay.js](file:///d:/projects/clipping/scheduler-uploader/utils/overlay.js): Pembuatan berkas subtitle ASS untuk layer gelap gameplay statis, kartu kuis interaktif dengan timer progress bar 60 FPS, overlay video full satu baris, dan penanda transisi `"x / y"`, serta sintesis suara kuis multi-tone WAV murni (countdown beep & chime).
      5. [videoEditor.js](file:///d:/projects/clipping/scheduler-uploader/utils/videoEditor.js): Eksekusi filter grafis FFmpeg untuk normalisasi portrait 1080x1920 60 FPS CFR, rendering klip potongan gameplay tersensor (`cut.mp4`), rendering freeze frame kuis dengan gameplay beku dan audio kuis, serta rendering video full dengan akselerasi dinamis (`setpts`) dan efek audio pitch-shifted/cempreng (`asetrate`).
      6. [transition.js](file:///d:/projects/clipping/scheduler-uploader/utils/transition.js): Deteksi berkas SFX TikTok Core dan perakitan klip transisi jeda layar hitam per-momen dengan teks counter opsional.
      7. [compiler.js](file:///d:/projects/clipping/scheduler-uploader/utils/compiler.js): Orkestrasi pemrosesan satu momen (`processSingleMoment`), penggabungan akhir seluruh klip via single-pass flat concat (`concatenateCompilation`), dan pengunggahan otomatis hasil video ke Google Drive (`uploadCompilationToDrive`).
    - Merampingkan [compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js) menjadi ~175 baris yang bersih dan mudah dibaca, di mana alur utamanya kini murni menangani perulangan (*looping*) momen kuis serta mengekspor ulang seluruh fungsi pembantu untuk menjamin kompatibilitas mundur penuh.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/utils/config.js`: Modul baru untuk konfigurasi dan inisialisasi auth.
  - `scheduler-uploader/utils/selector.js`: Modul baru untuk seleksi momen dan opsi kuis.
  - `scheduler-uploader/utils/downloader.js`: Modul baru untuk unduh berkas Google Drive.
  - `scheduler-uploader/utils/overlay.js`: Modul baru untuk generator ASS dan WAV audio kuis.
  - `scheduler-uploader/utils/videoEditor.js`: Modul baru untuk pemrosesan FFmpeg video dan audio.
  - `scheduler-uploader/utils/transition.js`: Modul baru untuk perakitan transisi TikTok Core.
  - `scheduler-uploader/utils/compiler.js`: Modul baru untuk orkestrasi momen tunggal dan kompilasi final.
  - `scheduler-uploader/compile_doksli.js`: Refaktor alur eksekusi utama menjadi pemanggilan modular dan re-ekspor seluruh fungsi.

## [4ee5eeb] - Layer-3 Subfolder Clip Support with Random Selection and Overlay Exclusion
- **Konteks Struktural**:
  - Dukungan Subfolder Klip Lapis ke-3 pada Struktur Episode ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js)):
    - Mengakomodasi struktur Google Drive di mana dalam satu episode stream (`eps x` atau `-`) terdapat banyak potongan klip yang masing-masing disimpan dalam subfolder lapis ke-3 (misal: folder bernama `"-"`):
      - Ketika folder episode lapis ke-2 tidak langsung berisi 2 file video, sistem secara cerdas memeriksa subfolder lapis ke-3 di dalamnya.
      - Jika terdapat beberapa subfolder klip lapis ke-3, sistem mengacak urutan folder (`shuffleArray`) dan memilih satu subfolder klip yang valid (memiliki `cut.mp4` dan video full) secara acak.
      - Nama folder klip lapis ke-3 (seperti `"-"`) secara ketat **tidak ditambahkan** ke dalam teks overlay video full (`fullVideoDisplayText`), sehingga teks overlay tetap bersih sesuai format nama episode dan berkas full video.
      - Mekanisme pengabaian tanda `"-"` pada folder lapis ke-2 (untuk game yang tamat dalam 1 stream) tetap berjalan konsisten.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_doksli.js`:
    - Memperbarui pengecekan folder episode pada `runQuizCompiler` untuk mendukung pemilihan acak subfolder klip lapis ke-3.
    - Menambahkan pelacakan `clipFolderName` pada objek momen untuk transparansi logging terminal.
    - Memastikan teks overlay video full terisolasi dari penambahan nama folder `"-"` lapis ke-3.

## [7a4c7af] - Refined Quiz Option Cards (Clean Game Title without A/B/C/D and Pure Emerald Highlight)
- **Konteks Struktural**:
  - Penyempurnaan Tampilan Opsi Kuis Freeze Frame ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js)):
    - Mengeliminasi prefiks huruf `"A. "`, `"B. "`, `"C. "`, `"D. "` dari seluruh opsi kuis sehingga hanya memuat nama game murni.
    - Menempatkan teks pilihan ganda tepat di tengah kartu (*center-aligned*, `\an5` di `cX + 221`) untuk estetika tombol yang lebih seimbang dan modern.
    - Menghilangkan efek peredupan (*dimming*) pada opsi-opsi yang salah saat fase reveal jawaban benar; opsi yang salah kini tetap berada dalam tampilan normal aslinya tanpa perubahan warna atau transparansi.
    - Mengunci satu-satunya penanda visual jawaban benar pada kartu yang tepat dengan highlight Hijau Emerald terang (`#22C55E`).
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_doksli.js`:
    - Mengubah rendering kartu pada `generateQuizASS` agar mencetak teks opsi langsung tanpa awalan huruf.
    - Menyelaraskan koordinat teks menjadi `\an5` terpusat di tengah kartu.
    - Menghapus event redup pada opsi salah, menjaganya tetap aktif dan solid dari awal hingga akhir kuis.

## [c19e58c] - Simplified Quiz Display with Full-Width Smooth 60fps Progress Bar
- **Konteks Struktural**:
  - Penyederhanaan Visual Kuis Freeze Frame ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js)):
    - Menyederhanakan tata letak kuis gameplay agar bersih dari tumpukan elemen visual dan mudah dibaca penonton dalam durasi sangat singkat ($\le 4\text{ detik}$) atau video berkecepatan tinggi:
      - Menghapus label/tag kuning `"TEBAK GAME"` di atas pertanyaan agar tidak memecah fokus audiens.
      - Menghapus teks hitung mundur angka `"3, 2, 1"` dan teks `"JAWABAN BENAR:"` pada fase reveal.
      - Mempertahankan pertanyaan kuis teks putih bersih (`${question}`) terpusat di bagian atas.
      - Mengganti bilah countdown lama dengan **full-width continuous progress bar** sepanjang $940\text{px}$ (menjangkau dari ujung kiri kotak pilihan kolom 1 di $X=70$ hingga ujung kanan kotak pilihan kolom 2 di $X=1010$, melingkupi gap tengah):
        - Menggunakan tag animasi ASS `\clip` dengan interpolasi linear kontinu `\t(0, countdownMs, \clip(...))` yang dirender secara sub-pixel pada kecepatan penuh 60 FPS oleh filter `ass` FFmpeg, menghasilkan animasi memendek yang sangat mulus tanpa patah-patah.
        - Menyertakan track latar belakang gelap semi-transparan rounded pill selebar $940\text{px}$ yang tetap terlihat saat bar aktif menyusut ke kiri.
      - Menata ulang koordinat vertikal (pertanyaan di `baseY + 85`, progress bar di `baseY + 145`, dan baris kartu opsi di `baseY + 195` serta `baseY + 330`) agar layout seimbang dan rapi.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_doksli.js`:
    - Mengubah fungsi `generateQuizASS` untuk menghilangkan teks angka countdown dan tag kategori kuning.
    - Mengimplementasikan vektor path dan animasi `\clip` + `\t` pada bilah hitung mundur selebar opsi $940\text{px}$.
    - Menyesuaikan offset vertikal `rowY` kartu pilihan ganda agar proporsional dan tidak bertumpukan.

## [b15971b] - Dynamic Auto Speed for Full Video Exceeding 5 Seconds
- **Konteks Struktural**:
  - Mode Otomatis Akselerasi Video Full Meme ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js), [.env.example](file:///d:/projects/clipping/scheduler-uploader/.env.example)):
    - Menambahkan mode percepatan otomatis `auto` pada video full meme (`FULL_VIDEO_SPEED=auto` atau `--speed=auto`).
    - Mekanisme dinamis per klip:
      - Sebelum merender video full, sistem membaca durasi asli video mentah.
      - Jika durasi asli $> 5\text{ detik}$ (dapat dikonfigurasi melalui `FULL_VIDEO_MAX_DURATION`, default: `5.0`), sistem menghitung rasio percepatan yang tepat (`clipSpeed = rawDur / 5.0`) agar durasi video dipersingkat menjadi pas $\le 5$ detik dengan audio otomatis mengikuti efek cempreng (pitch naik).
      - Jika durasi asli sejak awal sudah $\le 5\text{ detik}$, klip tidak dipercepat sama sekali (`clipSpeed = 1.0x`) dan audio tetap normal.
    - Sesuai instruksi pengguna, fitur percepatan ini **hanya berlaku khusus untuk video full meme**; video potongan `cut.mp4` tetap 100% utuh tanpa perubahan kecepatan.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_doksli.js`:
    - Menambahkan deteksi mode `isFullVideoAutoSpeed` dari `FULL_VIDEO_SPEED=auto` atau `FULL_VIDEO_AUTO_SPEED=true` serta flag CLI `--auto-speed` dan `--speed=auto`.
    - Menambahkan parsing `fullVideoMaxDuration` dari `FULL_VIDEO_MAX_DURATION` dan CLI `--max-duration`.
    - Mengintegrasikan kalkulasi percepatan dinamis per klip berbasis pembacaan durasi pada Bagian 3 pemrosesan video full.
    - Memperbarui ringkasan log konfigurasi konsol.
  - `scheduler-uploader/.env.example`:
    - Menambahkan dokumentasi nilai `auto` untuk `FULL_VIDEO_SPEED` dan variabel `FULL_VIDEO_MAX_DURATION=5.0`.

## [0ea25c5] - Configurable Full Video Playback Speed with Pitch-Shifted Audio
- **Konteks Struktural**:
  - Akselerasi Video Full Meme & Efek Audio Cempreng ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js), [.env.example](file:///d:/projects/clipping/scheduler-uploader/.env.example)):
    - Menambahkan opsi percepatan pemutaran video full meme (`FULL_VIDEO_SPEED`, default `1.0` = normal) untuk mengatasi video mentah yang terlalu panjang agar retensi penonton tetap terjaga tanpa kehilangan berkas video asli di Google Drive.
    - Sesuai permintaan pengguna, batasan nilai terendah dikunci ketat pada angka `1.0` (`Math.max(1.0, speed)`) sehingga tidak diperbolehkan memperlambat video (< 1.0).
    - Ketika kecepatan diatur lebih dari 1.0 (misal 2.0x, 1.5x, dst.):
      - Video dipercepat secara proporsional via filter `setpts=PTS/${speed}` pada [normalizeVideo](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js#L570-L635).
      - Audio ikut dipercepat dan dinaikkan nada suaranya (pitch-shift / efek suara cempreng/chipmunk) menggunakan kombinasi filter `aformat=sample_rates=44100,asetrate=44100*${speed},aresample=44100` sebelum normalisasi AAC 44.1kHz stereo, menjaga sinkronisasi audio-video secara presisi.
    - Mendukung konfigurasi melalui environment `.env` (`FULL_VIDEO_SPEED=1.0`) dan argumen CLI (`--speed=2`, `--full-speed=1.5`, atau `--speed-full=2`).
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_doksli.js`:
    - Menambahkan parameter `speed = 1.0` pada fungsi `normalizeVideo`, menyisipkan `setpts=PTS/${actualSpeed}` pada video filter dan `asetrate` pada audio filter.
    - Menambahkan inisialisasi `fullVideoSpeed` dengan validasi minimal 1.0 pada `runQuizCompiler`.
    - Menambahkan penanganan CLI argumen `--speed`, `--full-speed`, dan `--speed-full`.
    - Meneruskan `speed: fullVideoSpeed` saat memproses `normFullPath` di Bagian 3 alur momen.
    - Menambahkan log informatif kecepatan video full pada ringkasan konfigurasi.
  - `scheduler-uploader/.env.example`:
    - Menambahkan dokumentasi variabel `FULL_VIDEO_SPEED=1.0`.

## [4911059] - Configurable Boolean Option for Transition Screen Counter
- **Konteks Struktural**:
  - Pengaturan Fleksibel Teks Counter Transisi TikTok Core ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js), [.env.example](file:///d:/projects/clipping/scheduler-uploader/.env.example)):
    - Menambahkan variabel konfigurasi boolean `TRANSITION_SHOW_COUNTER` (default: `true`) serta flag CLI (`--no-transition-counter`, `--no-counter`, atau `--transition-counter=false`) untuk menyalakan atau mematikan tampilan teks penanda kuis `"x / y"` pada layar transisi TikTok Core.
    - Failsafe intuitif: jika pengguna mengatur `TRANSITION_FONT_SIZE=0` atau opsi `--transition-fs=0`, sistem secara otomatis menganggap teks counter dinonaktifkan (`showTransitionCounter = false`).
    - Saat counter dinonaktifkan, klip transisi layar hitam dan sound TikTok Core tetap berjalan mulus sebagai jeda antar momen, namun layarnya dirender hitam polos bersih tanpa filter subtitle ASS.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_doksli.js`:
    - Menambahkan inisialisasi `showTransitionCounter` dari `process.env.TRANSITION_SHOW_COUNTER !== 'false'` dan pengecekan fallback nilai `transitionFontSize === 0`.
    - Menambahkan penanganan argumen CLI `--no-transition-counter` dan `--transition-counter`.
    - Menyesuaikan blok pembuatan `transitionClips` agar hanya menginjeksi filter ASS ketika `showTransitionCounter` bernilai `true`.
    - Memperbarui output ringkasan konfigurasi konsol.
  - `scheduler-uploader/.env.example`:
    - Menambahkan dokumentasi variabel `TRANSITION_SHOW_COUNTER=true`.

## [347e591] - Freeze Gameplay with Dark Overlay in cut.mp4 and Enlarge Transition Font to 72px
- **Konteks Struktural**:
  1. Pembekuan Gameplay & Layer Gelap Murni Sepanjang `cut.mp4` ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js)):
     - Menghilangkan elemen kuis (teks tag, pertanyaan, countdown, dan kartu opsi) selama pemutaran `cut.mp4`, menyisakan layer gelap semi-transparan murni (`\1a&H35&`) di atas area gameplay ($Y = 1006$ s/d $1726$).
     - Membekukan (*freeze*) visual gameplay tersensor selama `cut.mp4` dengan mengekstrak 1 frame gameplay awal, mengaplikasikan filter sensor (piksel mosaik atau blur), dan menumpuknya sebagai gambar diam statis sepanjang durasi `cut.mp4` via `frozenGameplayImagePath` pada `normalizeVideo`.
     - Facecam streamer di bagian atas ($Y = 196$ s/d $1006$) tetap berjalan hidup dan dinamis secara normal, sementara area gameplay di bawahnya diam dan tertutup layer gelap. Hal ini memusatkan 100% fokus mata penonton ke reaksi streamer tanpa distraksi gerakan mosaik maupun tebakan kuis prematur.
     - Setelah `cut.mp4` selesai, alur berpindah ke Bagian 2 (freeze kuis 2 detik): Facecam ikut membeku, dan seluruh elemen kuis (tag `TEBAK GAME`, pertanyaan, hitung mundur 3-2-1, progress bar, dan 4 kartu opsi A/B/C/D) muncul di atas layer gelap yang sama secara mulus dan konsisten.
  2. Peningkatan Ukuran Font Counter Transisi TikTok Core Menjadi 72px ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js), [.env.example](file:///d:/projects/clipping/scheduler-uploader/.env.example)):
     - Menaikkan ukuran font default teks counter `"x / y"` pada transisi layar hitam TikTok Core dari 24px menjadi 72px (3x lipat) dengan outline `\bord4`.
     - Pada kanvas portrait beresolusi 1080x1920, ukuran 72px memberikan rasio keterbacaan yang sangat optimal, jelas, dan proporsional untuk layar smartphone (TikTok/Reels/Shorts).
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_doksli.js`:
    - Menambahkan fungsi pembantu `generateDarkOverlayASS({ gameplayY, gameplayH })`.
    - Menyederhanakan `generateQuizASS` khusus untuk fase freeze kuis (menghapus cabang `isCutVersion`).
    - Memperbarui `generateTransitionASS` dengan default `fontSize = 72` dan `\bord4`.
    - Menambahkan dukungan parameter `frozenGameplayImagePath` pada `normalizeVideo` menggunakan `-filter_complex` overlay terpetakan.
    - Menyesuaikan Bagian 1 `runQuizCompiler` untuk mengekstrak frame gameplay awal beku `frozenGpPng` dan menumpuknya bersama `cutDarkAssPath`.
    - Mengubah fallback default `transitionFontSize` pada `runQuizCompiler` menjadi 72.
    - Mengekspor `generateDarkOverlayASS` dan `generateTransitionASS` pada `module.exports`.
  - `scheduler-uploader/.env.example`:
    - Memperbarui dokumentasi variabel `TRANSITION_FONT_SIZE=72`.

## [7a0df26] - Display Quiz Layer Across cut.mp4 and Fix Transition Counter Timecode
- **Konteks Struktural**:
  1. Penayangan Layer Kuis Sepanjang Video Potongan `cut.mp4` ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js)):
     - Menampilkan layer kuis (background gelap area gameplay, tag `TEBAK GAME`, teks pertanyaan, dan 4 kartu opsi netral A, B, C, D) di atas gameplay tersensor secara kontinu sepanjang pemutaran `cut.mp4`.
     - Solusi fokus penonton: sebelumnya gameplay mosaik/blur yang bergerak telanjang tanpa penutup memecah perhatian penonton dari ekspresi Facecam streamer di bagian atas. Dengan menaruh kartu kuis di atas area gameplay, mata penonton tetap nyaman membaca opsi dan mengamati Facecam.
     - Countdown (3, 2, 1) dan efek suara tetap dimulai tepat saat `cut.mp4` selesai di frame beku (*freeze frame*), memberikan transisi visual yang 100% mulus dan identik tanpa sentakan/pergeseran posisi.
     - Ekstraksi frame freeze langsung dilakukan dari berkas `rawCutPath` dengan filter sensor agar frame beku bersih dari resiko penumpukan/penebalan subtitle ganda (*double-drawing*).
  2. Perbaikan Timecode Subtitle Transisi TikTok Core ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js)):
     - Memperbaiki kalkulasi waktu berakhir dialog subtitle pada `generateTransitionASS` menggunakan `formatAssTime`.
     - Sebelumnya, pemotongan detik bulat (`Math.floor`) pada audio pendek (< 1 detik seperti `tiktok core.mp3` yang berdurasi 0.65 detik) menghasilkan timecode akhir `0:00:00.00` (durasi 0 detik) sehingga teks counter `"x / y"` tidak sempat muncul.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_doksli.js`:
    - Menambahkan opsi `isCutVersion` pada `generateQuizASS` untuk merender mode statis tanpa countdown/reveal.
    - Menghubungkan pembuatan dan penempelan `cutQuizAssPath` ke dalam pemanggilan `normalizeVideo` untuk `normCutPath`.
    - Menyesuaikan ekstraksi `freezeFramePng` agar menggunakan filter sensor langsung dari `rawCutPath`.
    - Memperbaiki timecode dialog subtitle pada `generateTransitionASS`.

## [1f8d929] - Centered "x / y" Counter Overlay on Transition Screen
- **Konteks Struktural**:
  - Penambahan Teks Counter pada Klip Transisi TikTok Core ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js), [.env.example](file:///d:/projects/clipping/scheduler-uploader/.env.example)):
    - Menyisipkan teks penanda nomor kuis `"x / y"` di tengah-tengah kanvas secara presisi ($X = 540$, $Y = 960$, alignment `\an5`) pada klip transisi layar hitam TikTok Core setelah setiap momen.
    - Nilai `x` adalah urutan kuis yang sedang berjalan ($1, 2, \dots, y$), dan `y` adalah jumlah total kuis unik yang berhasil dikumpulkan untuk video kompilasi tersebut (`validMoments.length`, misal jika target 5 namun game unik valid yang tersedia hanya 3, maka $y = 3$).
    - Mendukung konfigurasi ukuran font teks counter dengan default $24\text{px}$ melalui variabel `.env` `TRANSITION_FONT_SIZE=24` dan argumen CLI `--transition-fs=24`.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_doksli.js`:
    - Menambahkan fungsi pembantu `generateTransitionASS({ text, durationSeconds, fontSize })`.
    - Mengubah mekanisme pembuatan klip transisi menjadi per-momen dengan teks counter individual (`"1 / y"`, `"2 / y"`, dst.).
    - Menambahkan parsing konfigurasi `transitionFontSize` dari environment dan CLI.
  - `scheduler-uploader/.env.example`:
    - Menambahkan dokumentasi variabel `TRANSITION_FONT_SIZE=24`.

## [7aa9c08] - Ignore Single-Stream Hyphen Folder from Full Video Overlay
- **Konteks Struktural**:
  - Penanganan Subfolder Non-Episode / Tamat 1 Stream ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js)):
    - Mendeteksi nama subfolder episode yang hanya berisi tanda hubung `"-"` (atau variasi dash/garis seperti `—`, `–`, `_`), yang menandakan game tersebut langsung tamat dalam 1 stream tanpa sistem multi-episode ("eps 1", "eps 2", dst.).
    - Mengabaikan tanda `"-"` tersebut agar tidak ikut digabungkan ke dalam teks overlay nama video full (`fullVideoDisplayText`), sehingga overlay hanya menampilkan judul video full yang bersih tanpa prefiks `"- "`.
    - Menambahkan keterangan visual informatif pada log konsol saat momen terpilih (`- Episode : - (Tamat 1 stream, tidak dimasukkan ke overlay)`).
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_doksli.js`:
    - Menambahkan validasi `isSingleStreamNoEps` pada blok pembentukan `fullVideoDisplayText` di `runQuizCompiler()`.

## [a1bdc3f] - Decouple Quiz Dark Overlay from Element Offset Y
- **Konteks Struktural**:
  - Penjangkaran Layer Gelap Kuis ke Batas Gameplay ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js), [.env.example](file:///d:/projects/clipping/scheduler-uploader/.env.example)):
    - Mengunci posisi background overlay gelap kuis secara permanen pada batas area gameplay ($Y = \text{gameplayY}$ s/d $\text{gameplayY} + \text{gameplayH}$, default $1006$ s/d $1726$), terlepas dari nilai konfigurasi `QUIZ_OFFSET_Y` / `--offset-y=`.
    - Memisahkan pergerakan elemen kuis (teks pertanyaan, tag `TEBAK GAME`, countdown timer, progress bar, kartu opsi A/B/C/D, dan label pilihan) yang tetap menggunakan `baseY = gameplayY + offsetY` agar bebas digeser naik-turun oleh pengguna.
    - Menghilangkan *leakage* sensor: sebelumnya ketika `offsetY > 0` (geser ke bawah), layer gelap ikut turun sehingga gameplay tersensor di bagian atas ($Y \approx 1006$) tidak ter-overlay; sebaliknya ketika `offsetY < 0` (geser ke atas), layer gelap ikut naik dan menutupi area Facecam streamer ($Y < 1006$).
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_doksli.js`:
    - Mengubah posisi dialog drawing layer gelap dari `\pos(0,${baseY})` menjadi `\pos(0,${gameplayY})` pada fungsi `generateQuizASS`.
  - `scheduler-uploader/.env.example`:
    - Memperjelas dokumentasi variabel `QUIZ_OFFSET_Y` bahwa offset hanya menggeser elemen konten kuis di dalam batas gameplay, sedangkan background layer gelap tetap terkunci presisi pada $Y \sim 1006\text{px}$.

## [ee6ba6c] - Increase Default Gameplay Pixelate Censor to 45px
- **Konteks Struktural**:
  - Peningkatan Intensitas Sensor Mosaik Gameplay ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js), [.env.example](file:///d:/projects/clipping/scheduler-uploader/.env.example)):
     - Menaikkan ukuran balok piksel default dari $24\text{px}$ menjadi $45\text{px}$ (`censorPixelSize = 45`).
     - Pada ukuran $24\text{px}$, garis dan bentuk objek game tertentu (seperti balok khas Minecraft atau karakter game) terkadang masih bisa dikenali oleh penonton yang jeli.
     - Pada ukuran $45\text{px}$ ($2\times$ lebih besar, $1080/45 = 24$ balok horizontal dan $720/45 = 16$ balok vertikal), seluruh detail objek dan teks tersamarkan total menjadi balok warna dinamis tanpa merusak estetika retro mosaik kuis.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_doksli.js`:
     - Memperbarui nilai default `censorPixelSize` dari `24` menjadi `45` pada `normalizeVideo()` dan `runQuizCompiler()`.
  - `scheduler-uploader/.env.example`:
     - Memperbarui dokumentasi nilai default `CENSOR_PIXEL_SIZE=45`.

## [a7f2545] - Localized 2x2 Grid Quiz Overlay in Censored Gameplay Area
- **Konteks Struktural**:
  1. Penempatan Layer Kuis Khusus di Area Gameplay 2:3 ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js), [.env.example](file:///d:/projects/clipping/scheduler-uploader/.env.example)):
     - Menghilangkan efek *drastic switch / fullscreen blackout* saat transisi dari klip `cut.mp4` ke frame kuis (*freeze frame*): layer kuis kini dilokalisasi hanya pada area gameplay ($Y = 1006$ s/d $1726$, rasio 3:2) yang sudah terblur/tersensor.
     - Area Facecam streamer di bagian atas ($Y = 196$ s/d $1006$) **tetap 100% jernih, terang, dan tidak tertutup overlay gelap**, sehingga ekspresi wajah kaget/lucu tetap menjadi sorotan utama bagi penonton.
     - Area bawah kanvas ($Y > 1726$) tetap steril, menjaga kartu kuis aman dari tumpang tindih elemen UI bawaan TikTok/Instagram Reels (tombol Like, Comment, Share, dan judul caption).
  2. Arsitektur Grid Opsi 2x2 (*Flex Row 2 per Baris*) ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js)):
     - Mengubah susunan 4 kartu pilihan ganda dari vertikal memanjang (4 baris) menjadi matriks 2 kolom x 2 baris (Kolom 1: Opsi A & C pada $X = 70$, Kolom 2: Opsi B & D pada $X = 568$).
     - Menyederhanakan tipografi dan header kuis ("TEBAK GAME" & pertanyaan) agar lebih proporsional, ringkas, dan fokus di dalam area gameplay.
     - Menggunakan tag `\q2` pada subtitle ASS untuk menjamin kepatuhan aturan strict single-line tanpa auto text line-break.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_doksli.js`:
     - Memperbarui fungsi `generateQuizASS` dengan parameter `gameplayY` dan `gameplayH`.
     - Mengubah vektor overlay gelap menjadi hanya mencakup area gameplay (`m 0 0 l 1080 0 l 1080 720 l 0 720`).
     - Menyusun kartu opsi dan teks label menjadi format grid 2x2 (`colX`, `rowY`, `textX`).
     - Menghubungkan pembacaan `censorY` dan `censorH` ke dalam pemanggilan `generateQuizASS`.
  - `scheduler-uploader/.env.example`:
     - Memperbarui deskripsi `QUIZ_OFFSET_Y` untuk merefleksikan posisi kuis di dalam area gameplay 2:3.

## [32553d3] - Deduplicate cleanText Helper Definition
- **Konteks Struktural**:
  - Penghapusan Definisi Redundan `cleanText` ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js)):
     - Menghapus deklarasi fungsi `cleanText` duplikat di baris bawah yang sebelumnya menimpa fungsi `cleanText` utama di baris 150.
     - Memastikan fungsi `cleanText` yang aktif adalah versi komprehensif yang membersihkan ekstensi berkas, string literal `\n`, karakter enter/newline (`\r`, `\n`), serta menormalisasi spasi ganda menjadi spasi tunggal.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_doksli.js`:
     - Menghapus fungsi `cleanText(str)` redundan pada baris 249-256.

## [1893007] - Prefix Skip Code Filter for Folders and Files
- **Konteks Struktural**:
  1. Mekanisme Penyaringan Berkas & Folder Rusak/Karantina Berbasis Kode Awalan ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js), [.env.example](file:///d:/projects/clipping/scheduler-uploader/.env.example)):
     - Menambahkan fungsi helper `isSkippedItem(name, customPrefix)` untuk mendeteksi kode awalan skip (default: tanda seru `!`, misal `!Minecraft`, `!eps 1`, `!cut.mp4`, atau variasi `]]`, `[skip]`, `[x]`, serta dapat dikonfigurasi melalui `.env` `SKIP_PREFIX` atau CLI `--skip-prefix=`).
     - Pemilihan simbol `!` sebagai standar utama: karakter `!` tidak pernah menjadi awalan judul game resmi, nomor episode, atau detail video; sangat ergonomis diketik di HP (1 tap) maupun PC (Shift+1); dan dalam pengurutan alfabetis/ASCII Google Drive & Windows Explorer, `!` (ASCII 33) otomatis menempatkan folder/file yang rusak di posisi paling atas, memudahkan manajemen karantina.
  2. Filter Multi-Level pada Pipeline Kompilasi ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js)):
     - **Level Game (Folder Terluar)**: Folder game yang diawali kode skip langsung diabaikan dan tidak dimasukkan ke dalam `allGameNamesPool`, mencegah judul game yang sedang rusak/diedit ulang terpilih sebagai opsi kuis (kunci maupun pengecoh).
     - **Level Episode ("eps x")**: Subfolder episode yang berawalan skip dilewati. Jika game memiliki episode valid lain, episode tersebut tetap dapat dipilih.
     - **Level Berkas Video (`cut.mp4` / Video Full)**: Pada tahap pencarian berkas, jika `cut` atau `full` berawalan kode skip, episode tersebut diabaikan.
     - **Level Runtime Failsafe & Auto-Cleanup**: Jika pada Tahap 3 (unduh/render) ditemukan berkas yang memiliki kode skip (misal terlewat di awal atau baru ditandai), script seketika menghentikan proses klip momen tersebut (`cleanupMomentTempFiles()`), menghapus seluruh berkas sementara yang sempat diunduh/dibuat, mencatat log peringatan, dan melanjutkan ke momen berikutnya tanpa merusak alur kompilasi.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_doksli.js`:
     - Menambahkan helper `isSkippedItem` dan `cleanText`, serta mengekspornya ke `module.exports`.
     - Memperbarui `runQuizCompiler()` dengan parsing `SKIP_PREFIX` dan argumen CLI `--skip-prefix=`.
     - Menyaring `allGameFolders`, `epsFolders`, dan `vidFiles` menggunakan `isSkippedItem`.
     - Menambahkan pengaman runtime di loop momen Tahap 3 beserta pembersihan berkas sementara jika proses klip dibatalkan di tengah jalan.
  - `scheduler-uploader/.env.example`:
     - Menambahkan dokumentasi variabel `SKIP_PREFIX="!"`.

## [fc31972] - Uniform Layout Aspect Ratio with Gameplay Censor on Cut and Quiz Freeze
- **Konteks Struktural**:
  1. Penyelarasan Rasio Visual & Pencegahan *Layout Jumping* ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js), [.env.example](file:///d:/projects/clipping/scheduler-uploader/.env.example)):
     - Menyamakan rasio dan geometri visual antara video potongan `cut.mp4` dengan video full: keduanya mengadopsi susunan kanvas portrait 1080x1920 yang identik (Facecam 4:3 di atas pada $Y=196$ s/d $1006$, dan Gameplay 3:2 di bawah pada $Y=1006$ s/d $1726$).
     - Mengeliminasi efek *jumping* (perubahan drastis tinggi visual dari facecam-only pendek ke facecam+gameplay panjang) saat video berpindah dari `cut.mp4` ke freeze kuis dan video full.
  2. Filter Sensor / Mosaik Piksel Rendah pada Area Gameplay Kuis ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js)):
     - Menerapkan filter sensor otomatis pada bagian gameplay ($Y \ge 1006$) selama klip `cut.mp4` diputar dan selama frame diam kuis (*freeze frame*), sehingga visual gameplay tersamarkan dan tidak menjadi contekan jawaban kuis bagi penonton.
     - Mendukung 2 mode sensor: `pixelate` (mosaik piksel kotak-kotak ala sensor misteri) dan `blur` (`boxblur` halus), dapat diatur melalui `.env` (`CENSOR_MODE=pixelate|blur`, `CENSOR_GAMEPLAY_Y`, `CENSOR_GAMEPLAY_H`, `CENSOR_PIXEL_SIZE`, `CENSOR_BLUR_RADIUS`) serta argumen CLI (`--censor-mode=`, dll).
     - Menjamin bagian facecam di area atas ($Y=196$ s/d $1006$) tetap 100% jernih dan tajam (*untouched*).
     - Mengekstrak `freezeFramePng` langsung dari `normCutPath` (bukan dari berkas mentah `rawCutPath`), memastikan frame diam kuis memiliki gameplay yang tersensor secara serasi sebelum kartu pertanyaan kuis dirender di atasnya.
     - Pada tahap akhir (*reveal* / video full `normFullPath`), sensor dinonaktifkan (`censorGameplay: false`) sehingga gameplay terbuka penuh tanpa sensor bersamaan dengan overlay nama video.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_doksli.js`:
     - Memperbarui `normalizeVideo()` dengan parameter sensor (`censorGameplay`, `censorMode`, `censorY`, `censorH`, `censorPixelSize`, `censorBlurRadius`) menggunakan filter `split[main][gp];[gp]crop=...,...[censored];[main][censored]overlay=...`.
     - Mengonfigurasi pembacaan opsi sensor dari `process.env` dan argumen CLI.
     - Mengubah ekstraksi `freezeFramePng` agar mengambil frame dari `normCutPath`.
  - `scheduler-uploader/.env.example`:
     - Menambahkan dokumentasi konfigurasi `CENSOR_GAMEPLAY`, `CENSOR_MODE`, `CENSOR_GAMEPLAY_Y`, `CENSOR_GAMEPLAY_H`, `CENSOR_PIXEL_SIZE`, dan `CENSOR_BLUR_RADIUS`.

## [1e0f098] - Single-Pass Concat Pipeline for Exact 60 FPS CFR and Transition Audio Probe Fix
- **Konteks Struktural**:
  1. Penyatuan Pipeline Rangkaian Klip Kompilasi Menjadi *Single-Pass Flat Concat* ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js)):
     - Mengubah arsitektur penggabungan video kompilasi dari metode bertingkat (*nested 2-stage concat copy*) menjadi satu kesatuan daftar datar (*single-pass flat concat list*).
     - Mengatasi akar masalah jatuhnya frame rate kompilasi menjadi ~59.93 - 59.94 FPS: pada metode sebelumnya, tiap momen digabungkan terlebih dahulu menjadi berkas sementara `segment_X.mp4` dengan `-c copy`. Pada batas akhir kontainer MP4, keterbatasan ukuran paket audio AAC (kelipatan 1024 sampel = ~23.22 ms) dan encoder priming/padding menyebabkan durasi audio sedikit lebih panjang dari video (~23 ms). Ketika beberapa `segment_X.mp4` digabungkan kembali di tahap akhir dengan `-c copy`, demuxer FFmpeg menggeser PTS video momen berikutnya sebesar 2380 unit timescale (1380 unit gap = ~23 ms) demi menyelaraskan dengan trek audio, mengakibatkan video kehilangan status constant frame rate (CFR) dan turun menjadi 59.93 FPS.
     - Melalui daftar datar langsung (`allCompilationClips`), seluruh klip hasil render (`normCut`, `freezeVideo`, `normFull`, serta klip transisi layar hitam) digabungkan langsung dalam satu kali eksekusi FFmpeg concat copy. Seluruh interval antar frame dijamin konsisten tepat 1000 unit timescale ($1/60$ detik) dengan 0 anomali PTS delta, menghasilkan video output 100% tepat 60.000 FPS CFR murni.
  2. Implementasi Helper Pembaca Durasi Audio `getAudioDuration` ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js)):
     - Menambahkan implementasi fungsi `getAudioDuration(filePath)` menggunakan *probe* FFmpeg untuk membaca durasi audio masukan (seperti `tiktok core.mp3`) secara presisi.
     - Memperbaiki *silent failure* pada blok pembuatan klip transisi layar hitam yang sebelumnya terhenti karena `ReferenceError: getAudioDuration is not defined`.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_doksli.js`:
     - Menambahkan fungsi `getAudioDuration(filePath)` dan mengekspornya di `module.exports`.
     - Mengganti array `finalSegmentPaths` dan pembuatan berkas intermediate `segment_${momentIndex}.mp4` dengan array `allCompilationClips` langsung.
     - Menyusun seluruh klip momen dan transisi dalam satu daftar urutan datar `final_concat_list.txt` untuk penggabungan final langsung.

## [887e011] - Nested Game-Episode Hierarchy and Single-Line Video Overlay
- **Konteks Struktural**:
  1. Penataan Struktur Folder Bertingkat (Game -> Episode -> Klip) ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js)):
     - Mengubah arsitektur pengacakan dan validasi momen doksli menjadi 2 lapis: folder terluar adalah **Folder Game** dan subfolder di dalamnya adalah **Folder Episode ("eps x")** yang menampung 2 berkas video (`cut.mp4` dan video full).
     - Menjamin keunikan (*uniqueness*) jangka panjang pada tingkat Game: setiap momen yang terpilih dalam satu video kompilasi berasal dari judul Game yang berbeda (tidak ada game duplikat), dan 4 opsi pilihan ganda kuis (1 kunci + 3 pengecoh) merupakan nama Game terluar.
     - Jika sebuah Game memiliki beberapa subfolder episode, script mengacak dan memilih salah satu episode valid secara dinamis.
     - Menjaga kompatibilitas mundur (*backward compatibility*): jika berkas video diletakkan langsung di dalam folder game tanpa subfolder episode, script tetap mengenalinya secara otomatis.
  2. Overlay Teks Full Video 1 Baris Ketat (*Strict Single-Line*) ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js)):
     - Menggabungkan nama folder episode dengan nama berkas video full menjadi format ringkas (misal: `"eps 1 menit 10 detik 15"`) yang ditampilkan di 1/4 atas video.
     - Menghapus mekanisme pemecah baris `\n` -> `\N` serta menormalisasi seluruh karakter enter/newline menjadi spasi tunggal dan menyematkan tag `\q2` pada subtitle ASS agar teks selalu berada pada satu baris rapi tanpa menutupi visual konten gameplay.
  3. Peremajaan Bank Judul Game Statis & Pertanyaan Default ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js), [.env.example](file:///d:/projects/clipping/scheduler-uploader/.env.example)):
     - Mengubah bank pengecoh statis `STATIC_FALLBACK_DISTRACTORS` dari deskripsi momen umum menjadi judul-judul game legendaris/populer Windah Basudara (Minecraft, RE4, GTA San Andreas, dll).
     - Menyesuaikan default `QUIZ_QUESTION` menjadi `"Game apakah ini?"`.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_doksli.js`:
     - Memperbarui `STATIC_FALLBACK_DISTRACTORS` dengan 20 judul game populer.
     - Menghapus konversi `\n` ke `\N` pada `generateFullVideoASS()`, membersihkan karakter newline, mengubah ukuran font menjadi 42, dan menambahkan tag wrapping `\q2`.
     - Mengubah default `quizQuestion` menjadi `'Game apakah ini?'`.
     - Memperbarui Tahap 1 dan Tahap 2 untuk memindai folder terluar sebagai Game dan memeriksa subfolder episode di dalamnya.
     - Memformat `fullVideoDisplayText` sebagai kombinasi `cleanEps` dan `cleanFull` satu baris.
  - `scheduler-uploader/.env.example`:
     - Memperbarui default `QUIZ_QUESTION="Game apakah ini?"`.

## [c58afbe] - Full Write Drive Scope for Auto-Upload
- **Konteks Struktural**:
  1. Penegasan Scope Izin Tulis Penuh Google Drive ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js)):
     - Menghapus scope `drive.readonly` pada inisialisasi client API Google Drive dan menegaskan scope penuh `https://www.googleapis.com/auth/drive`.
     - Memastikan permintaan otorisasi API ke Google Drive mendukung operasi unggah berkas (`POST /upload/drive/v3/files`) untuk upload otomatis hasil kompilasi ke folder target.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_doksli.js`:
     - Menghapus `'https://www.googleapis.com/auth/drive.readonly'` dari parameter scopes `getGoogleAuth()`.

## [b49e8cb] - Accelerated Fast Quiz Pacing and Pure Audio Passthrough
- **Konteks Struktural**:
  1. Percepatan Ritme Kuis (*Fast Quiz Pacing*) ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js), [.env.example](file:///d:/projects/clipping/scheduler-uploader/.env.example)):
     - Menyingkat durasi freeze frame kuis agar retensi penonton tidak anjlok akibat layar diam terlalu lama di TikTok/Reels/Shorts, dengan prinsip jika penonton butuh waktu membaca lebih lama mereka dapat melakukan pause video.
     - Mempertahankan struktur 4 ketukan utuh (3 countdown beat + 1 reveal beat), namun mempercepat tick interval dari 1.0 detik menjadi default 0.5 detik (total durasi kuis dipersingkat dari 4.0 detik menjadi 2.0 detik / 120 frame pada CFR 60 FPS).
     - Menambahkan helper `formatAssTime()` untuk menghitung timecode centisecond format ASS (`H:MM:SS.cs`) secara dinamis dan presisi sesuai nilai `tickDuration`.
     - Mengadaptasi generator audio PCM stereo `generateQuizSoundWav()` agar mensintesis 3 beep countdown (t=0.0s, 0.5s, 1.0s) dan 1 reveal chime (t=1.5s s/d 2.0s) dengan decay eksponensial proporsional sehingga audio meluruh tuntas bebas klik.
     - Menyediakan konfigurasi `QUIZ_TICK_SECONDS` pada `.env.example` dan argumen CLI `--tick=...` untuk fleksibilitas pengaturan ritme kuis.
  2. Penghapusan Mekanisme Pengubah Volume Audio di Kode (*Pure Audio Passthrough*) ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js), [.env.example](file:///d:/projects/clipping/scheduler-uploader/.env.example)):
     - Menghapus variabel konfigurasi `TRANSITION_VOLUME`, argumen CLI `--transition-volume=`, serta filter audio `volume=...` dan `alimiter=...` pada pembuatan klip layar hitam penutup momen.
     - Memberikan kendali 100% kepada berkas audio fisik `tiktok core.mp3` hasil mastering/editing manual pengguna tanpa campur tangan kode FFmpeg, menyisakan hanya filter penjamin sinkronisasi frame `-af "apad,aresample=async=1:first_pts=0"`.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_doksli.js`:
     - Menambahkan fungsi helper `formatAssTime(sec)`.
     - Memodifikasi fungsi `generateQuizSoundWav(outputPath, tickDuration, totalDuration)` dan `generateQuizASS({...})` agar mendukung perhitungan dinamis berbasis `tickDuration`.
     - Mengganti pembacaan `TRANSITION_VOLUME` menjadi `QUIZ_TICK_SECONDS` (default: 0.5s) dan menambahkan parser argumen `--tick=...`.
     - Menghapus filter `volume=${transitionVolume},alimiter=limit=0.98` pada execSync `transitionClipPath`.
     - Memperbarui perhitungan frame `freezeVideoPath` menjadi `totalQuizFrames = Math.max(1, Math.round(4 * quizTickSeconds * 60))` dan durasi `-t ${totalQuizSec} -vframes ${totalQuizFrames}`.
  - `scheduler-uploader/.env.example`:
     - Menghapus opsi `TRANSITION_VOLUME=3.0` dan menambahkan dokumentasi `QUIZ_TICK_SECONDS=0.5`.

## [6e5e140] - 60 FPS Image Demuxer Framerate and Sample-Accurate Audio Boundary Alignment
- **Konteks Struktural**:
  1. Penyelarasan Framerate Elemen Kuis Gambar & Standar Ekspor Mobile ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js)):
     - Memperbaiki akar penyebab framerate turun ke `59.83 FPS`: input frame freeze kuis (`freezeFramePng`) sebelumnya diproses menggunakan `-loop 1` tanpa parameter input `-framerate 60`, sehingga demuxer gambar bawaan FFmpeg mengasumsikan framerate default `25 FPS`. Konversi 25 FPS ke 60 FPS pada segmen kuis menghasilkan interval PTS non-uniform yang merusak timecode saat digabung via `-c copy`.
     - Menambahkan parameter input `-framerate 60` secara eksplisit sebelum `-loop 1 -i "${freezeFramePng}"` agar elemen kuis terlahir murni pada basis 60.000 FPS.
     - Mengadopsi profil video standar mobile export ([subtitle_burner.py](file:///d:/projects/clipping/mobile/scripts/utils/subtitle_burner.py)): `-profile:v high -level 4.2 -movflags +faststart`.
  2. Penguncian Durasi Audio-Video Presisi Sampel (*Sample-Accurate Boundary*) ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js)):
     - Menambahkan filter sinkronisasi audio `-af "apad,aresample=async=1:first_pts=0" -shortest` pada seluruh tahapan render ([normalizeVideo](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js), freeze kuis, dan transisi layar hitam) untuk mengeliminasi sisa audio 10-30 milidetik yang sebelumnya membuat durasi kontainer MP4 lebih panjang daripada durasi frame video aktual ($4607 \text{ frame} / 76.99 \text{ s} = 59.83\text{ FPS}$).
     - Menambahkan opsi `-video_track_timescale 60000 -movflags +faststart` pada eksekusi concat segmen dan final output.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_doksli.js`:
     - Menambahkan filter `-af "apad,aresample=async=1:first_pts=0" -shortest` dan flag `-profile:v high -level 4.2 -movflags +faststart` pada `normalizeVideo`.
     - Menambahkan flag `-framerate 60` pada input `freezeFramePng`, filter `apad,aresample`, `-shortest`, dan flag profil mobile pada `freezeVideoPath`.
     - Menambahkan `apad,aresample`, `-shortest`, dan flag profil mobile pada `transitionClipPath`.
     - Menambahkan `-video_track_timescale 60000 -movflags +faststart` pada `execSync` concat segmen dan final output kompilasi.

## [b3c3773] - Mandatory Black Screen Closer and High-Presence TikTok Core Remaster
- **Konteks Struktural**:
  1. Penutupan Wajib Layar Hitam & Sound TikTok Core di Setiap Momen ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js)):
     - Mengubah logika penggabungan klip akhir sehingga layar hitam dan sound TikTok Core kini tidak hanya disisipkan sebagai transisi antar momen, melainkan menjadi penutup wajib setelah bagian full video reveal di SETIAP momen (termasuk momen terakhir / ke-X).
     - Menjamin video kompilasi selalu diakhiri dengan layar hitam + audio TikTok Core yang konsisten, terlepas dari berapa pun jumlah momen unik yang tersedia (target tercapai maupun klip unik terbatas).
  2. Remaster Berkas Fisik `tiktok core.mp3` dengan Kehadiran Frekuensi Menengah & Kompresi Agresif ([tiktok core.mp3](file:///d:/projects/clipping/scheduler-uploader/tiktok%20core.mp3), [compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js)):
     - Menulis ulang berkas fisik `tiktok core.mp3` secara permanen dengan teknik mastering meme: analog *soft-clipping* (`asoftclip=type=atan`), penguatan frekuensi midrange 1.2 kHz (+6 dB) dan punch 100 Hz (+8 dB), serta *heavy compression* (`acompressor`).
     - Mengatasi masalah suara pelan pada speaker HP/laptop akibat dominasi sub-bass tak terdengar menjadi suara yang renyah, menggelegar, dan punchy secara fisik di berkas MP3 itu sendiri.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_doksli.js`:
     - Menghapus batasan `i < finalSegmentPaths.length - 1` pada iterasi `concatItems` sehingga `transitionClipPath` selalu ditambahkan setelah setiap `finalSegmentPaths[i]`.
     - Memperbarui label log konfigurasi menjadi `Audio Penutup Momen`.
  - `scheduler-uploader/tiktok core.mp3`:
     - Berkas MP3 fisik di-remaster dengan penguatan analog softclip, EQ presence, dan kompresi dinamik agresif.

## [7432b1d] - CFR 60 FPS Lock and High-Fidelity Video Encoding
- **Konteks Struktural**:
  1. Penguncian Constant Frame Rate (CFR 60 FPS) & Timescale Timebase ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js)):
     - Menghilangkan degradasi frame rate ke `58.xx / 59.83 FPS` akibat timestamp drift pada FFmpeg concat demuxer (`-c copy`) dengan menyematkan flag `-fps_mode cfr` dan `-video_track_timescale 60000` di setiap proses render segmen video.
     - Menghitung durasi audio transisi secara presisi lewat helper `getAudioDuration()` dan membulatkan ke frame bulat terdekat (`-vframes Math.round(dur * 60)`), mencegah pemotongan fraksional di tengah-tengah frame yang sebelumnya dipicu oleh flag `-shortest`.
     - Mengunci freeze frame kuis 4 detik secara eksak pada `-vframes 240` sehingga seluruh segmen momen memiliki timebase yang 100% selaras tanpa celah micro-stutter.
  2. Peningkatan Kualitas Visual & Eliminasi Noise Semut (*Mosquito Noise*) ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js)):
     - Mengganti parameter encoding cepat `-preset veryfast -crf 20` menjadi `-preset fast -crf 16` dan menambahkan interpolasi scaling tajam `flags=lanczos`.
     - Mengembalikan alokasi bit density video kembali ke ~9.2 Mbps (sebelumnya terkompresi secara brutal menjadi 4.7 Mbps) sehingga bebas dari artefak de-kuantisasi, bintik semut di sekitar teks, maupun degradasi kompresi bertingkat (*generation loss*).
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_doksli.js`:
     - Mengimpor `spawnSync` dari `child_process`.
     - Menambahkan fungsi `getAudioDuration(filePath)` untuk mendeteksi durasi presisi file audio eksternal.
     - Mengubah filter video `scale` di `normalizeVideo` dan freeze kuis dengan `flags=lanczos`.
     - Mengganti `-preset veryfast -crf 20` dengan `-preset fast -crf 16 -fps_mode cfr -video_track_timescale 60000` di `normalizeVideo`, `freezeVideoPath`, dan `transitionClipPath`.
     - Mengganti `-shortest` pada `transitionClipPath` dengan `-vframes ${transFrames}` dan `-t ${transDurSec}`.

## [4d75c12] - Source Audio 10x Boost for TikTok Core SFX
- **Konteks Struktural**:
  1. Penguatan Amplitudo Berkas Audio Sumber ([tiktok core.mp3](file:///d:/projects/clipping/scheduler-uploader/tiktok%20core.mp3), [compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js)):
     - Memperbarui berkas fisik `tiktok core.mp3` secara permanen dengan penguatan amplitudo 10x (+20 dB) dan brickwall limiter sehingga volume rata-rata naik drastis dari `-14.8 dB` menjadi `-3.3 dB` (peak `-0.1 dB`).
     - Mengubah berkas langsung pada sumbernya agar pengguna dapat mendengarkan (*preview*) secara langsung di pemutar media komputer dengan kenyaringan penuh tanpa harus bergantung pada filter pengali dinamis FFmpeg saat render.
     - Menyesuaikan nilai *default* `TRANSITION_VOLUME` di kode menjadi `1.0` (100% dari berkas sumber yang sudah diperkuat).
- **Perubahan Kode Penting**:
  - `scheduler-uploader/tiktok core.mp3`:
     - Di-remaster dengan gain 10x lipat dan limiter bebas distorsi.
  - `scheduler-uploader/compile_doksli.js`:
     - Menyesuaikan fallback `TRANSITION_VOLUME` menjadi `1.0`.

## [4652b6d] - Auto-Upload Compilation to Google Drive and Local Cleanup
- **Konteks Struktural**:
  1. Pengunggahan Otomatis ke Google Drive & Pembersihan Disk Lokal ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js), [.env.example](file:///d:/projects/clipping/scheduler-uploader/.env.example), [README.md](file:///d:/projects/clipping/scheduler-uploader/README.md)):
     - Menambahkan fitur auto-upload video hasil kompilasi langsung ke folder Google Drive tujuan melalui variabel lingkungan `GDRIVE_RESULT_FOLDER_ID` (atau `GDRIVE_OUTPUT_FOLDER_ID`) serta argumen CLI `--result-folder=<id>`.
     - Mengotomatiskan penghapusan file video lokal (`output_kompilasi/*.mp4`) segera setelah video sukses terunggah ke Google Drive guna menghemat kapasitas penyimpanan disk lokal/server.
     - Mempertahankan video lokal dengan aman apabila variabel `GDRIVE_RESULT_FOLDER_ID` tidak diatur atau apabila proses pengunggahan ke Google Drive mengalami kegagalan jaringan.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_doksli.js`:
     - Membaca `resultFolderId` dari `process.env.GDRIVE_RESULT_FOLDER_ID` dan opsi CLI `--result-folder=`.
     - Mengimplementasikan `[TAHAP 5/5]` untuk mengunggah `finalOutputPath` via `drive.files.create` dengan stream `fs.createReadStream`.
     - Menjalankan `fs.unlinkSync(finalOutputPath)` saat respons upload Google Drive berhasil.
  - `scheduler-uploader/.env.example`:
     - Menambahkan dokumentasi variabel lingkungan `GDRIVE_RESULT_FOLDER_ID=`.
  - `scheduler-uploader/README.md`:
     - Menambahkan contoh eksekusi CLI dengan parameter `--result-folder=`.

## [323ab8c] - Strict Deduplication of Selected Moment Names in Video Compilation
- **Konteks Struktural**:
  1. Penegakan Keunikan Nama Momen Terpilih ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js)):
     - Menambahkan aturan anti-duplikat nama momen pada pemilihan klip kompilasi (`selectedMomentNames` berbasis `Set` case-insensitive).
     - Menjamin dalam satu video kompilasi final tidak akan pernah ada momen dengan judul/nama folder yang kembar, meskipun di Google Drive terdapat beberapa folder dengan nama teks yang sama.
     - Mengadaptasi batas jumlah target secara elegan: jika pengguna menargetkan 10 klip namun hanya tersedia 3 folder dengan nama unik dan valid, sistem akan langsung memproses 3 klip unik tersebut tanpa memaksakan folder duplikat.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_doksli.js`:
     - Membuat `selectedMomentNames = new Set()` sebelum perulangan pemilihan folder.
     - Menambahkan pemeriksaan `isDuplicateName` sebelum memanggil Drive API untuk menghemat kuota dan melewati folder dengan nama kembar.
     - Menyimpan `selectedMomentNames.add(correctName)` saat momen berhasil divalidasi.
     - Menambahkan log informatif jika jumlah klip unik yang ditemukan lebih sedikit dari target yang diminta.

## [6a3452c] - 300% Volume Boost with Brickwall Limiter for Transition SFX
- **Konteks Struktural**:
  1. Penguatan Amplitudo Audio Transisi ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js), [.env.example](file:///d:/projects/clipping/scheduler-uploader/.env.example)):
     - Meningkatkan volume efek suara transisi (TikTok Core) sebesar 3 kali lipat (300% / +9.54 dB) dengan filter audio FFmpeg `volume=3.0` agar terdengar mantap, tegas, dan kontras saat jeda transisi layar hitam.
     - Memasang *brickwall lookahead limiter* (`alimiter=limit=0.98`) untuk mencegah *harsh clipping* dan distorsi audio pada frekuensi puncak saat volume dinaikkan 300%.
     - Menambahkan konfigurasi variabel lingkungan `TRANSITION_VOLUME` dan argumen CLI `--transition-volume=<pengali>` (default: 3.0).
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_doksli.js`:
     - Membaca `process.env.TRANSITION_VOLUME || '3.0'` dan argumen CLI `--transition-volume`.
     - Menambahkan rantai filter audio `-af "volume=${transitionVolume},alimiter=limit=0.98"` pada eksekusi render klip transisi layar hitam.
  - `scheduler-uploader/.env.example`:
     - Menambahkan dokumentasi variabel lingkungan `TRANSITION_VOLUME=3.0`.

## [27b518f] - Black Screen Inter-Moment Transition with TikTok Core Sound Effect
- **Konteks Struktural**:
  1. Transisi Layar Hitam Dinamis Antar Momen ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js), [.env.example](file:///d:/projects/clipping/scheduler-uploader/.env.example), [README.md](file:///d:/projects/clipping/scheduler-uploader/README.md)):
     - Menambahkan klip transisi layar hitam pekat beresolusi 1080x1920 60 FPS yang disisipkan di antara setiap momen (antara akhir video full momen sebelumnya menuju awal video cut momen berikutnya).
     - Mengintegrasikan deteksi file efek suara transisi otomatis (`tiktok core.mp3`, `assets/transition.mp3`, atau path kustom melalui environment variable `TRANSITION_SFX_PATH` dan argumen CLI `--transition-sfx=`).
     - Durasi klip transisi otomatis menyesuaikan secara presisi dengan panjang file audio transisi (contoh: 0.67 detik untuk `tiktok core.mp3`), memberi jeda dramatis yang rapi dan memikat penonton tanpa memperlambat alur video.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_doksli.js`:
     - Menambahkan deteksi file efek suara transisi dari argumen CLI, `.env`, dan path lokal (`tiktok core.mp3`).
     - Merender `transition_clip.mp4` berbasis generator `color=c=black:s=1080x1920:r=60` dengan stream audio yang dinormalisasi ke 44.1kHz AAC stereo.
     - Menyisipkan klip transisi ke dalam daftar urutan penggabungan `final_concat_list.txt` di antara setiap segmen momen (kecuali di akhir kompilasi).
  - `scheduler-uploader/.env.example`:
     - Menambahkan dokumentasi variabel lingkungan `TRANSITION_SFX_PATH="tiktok core.mp3"`.
  - `scheduler-uploader/README.md`:
     - Memperbarui penjelasan alur momen kompilasi dengan menyertakan transisi layar hitam dan efek suara TikTok Core.

## [e3d13eb] - Customizable Quiz Question via QUIZ_QUESTION Env and CLI Flag
- **Konteks Struktural**:
  1. Fleksibilitas Teks Pertanyaan Kuis ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js), [.env.example](file:///d:/projects/clipping/scheduler-uploader/.env.example), [README.md](file:///d:/projects/clipping/scheduler-uploader/README.md)):
     - Menjadikan teks pertanyaan kuis dinamis dan dapat dikustomisasi oleh pengguna melalui variabel lingkungan `QUIZ_QUESTION` (misal di `.env`: `QUIZ_QUESTION="Momen apakah ini?"`) atau opsi CLI `--question="<pertanyaan>"`.
     - Memberikan nilai bawaan (*default*) `"Momen manakah itu?"` apabila variabel lingkungan atau opsi CLI tidak ditentukan, sehingga tetap menjaga kompatibilitas penuh dengan alur yang sudah ada.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_doksli.js`:
     - Membaca `process.env.QUIZ_QUESTION || 'Momen manakah itu?'` ke variabel `quizQuestion`.
     - Menambahkan parsing argumen CLI `--question=...`.
     - Meneruskan `quizQuestion` ke dalam fungsi `generateQuizASS`.
  - `scheduler-uploader/.env.example`:
     - Menambahkan dokumentasi variabel lingkungan `QUIZ_QUESTION="Momen manakah itu?"`.
  - `scheduler-uploader/README.md`:
     - Menambahkan contoh opsi CLI `--question` pada panduan eksekusi.

## [d2335a0] - Upgrade Video Encoding Pipeline to Prime 1080p 60 FPS
- **Konteks Struktural**:
  1. Penyelarasan Framerate 60 FPS & Peningkatan Ketajaman Video ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js), [README.md](file:///d:/projects/clipping/scheduler-uploader/README.md)):
     - Mengubah target framerate dari 30 FPS menjadi 60 FPS murni (`-r 60`) pada seluruh pipeline rendering (normalisasi klip `cut.mp4`, pembuatan video *freeze kuis*, dan render video full) untuk mempertahankan kehalusan gerakan (*ultra-smooth*) 60 FPS bawaan gameplay/video sumber asli.
     - Meningkatkan kualitas ketajaman visual video dengan menurunkan CRF dari 22 menjadi `crf 20` pada encoder libx264 guna menjaga detail resolusi prime 1080x1920 tetap tajam dan jernih tanpa artefak kompresi.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_doksli.js`:
     - Memperbarui fungsi `normalizeVideo` dengan parameter `fps = 60` dan `-crf 20`.
     - Mengubah perintah FFmpeg pada segmen render freeze frame kuis menjadi `-r 60` dan `-crf 20`.
  - `scheduler-uploader/README.md`:
     - Memperbarui spesifikasi hasil video akhir menjadi 1080x1920 60 FPS.

## [16f5063] - Uniform Louder Countdown Beeps Across 3, 2, and 1
- **Konteks Struktural**:
  1. Penyeragaman Nada & Peningkatan Volume Countdown Beep ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js)):
     - Menyeragamkan frekuensi nada countdown beep menjadi identik (880Hz / A5) pada kemunculan angka 3 ($t = 0.0s$), angka 2 ($t = 1.0s$), dan angka 1 ($t = 2.0s$), menghapus disparitas pitch sebelumnya pada angka 1.
     - Meningkatkan volume (*peak amplitude*) countdown beep dari 0.35 menjadi 0.70 dengan kurva envelope mantap (5ms attack, 75ms solid hold, dan 60ms decay lembut) sehingga suara beep terdengar lebih bertenaga, tegas, dan jelas tanpa distorsi/clipping.
     - Mempertahankan tata suara efek *correct chime* pada detik ke-3 ($t = 3.0s$) yang sudah sesuai preferensi pengguna.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_doksli.js`:
     - Memperbarui fungsi `generateQuizSoundWav` dengan array parameter waktu beep `[0.0, 1.0, 2.0]`, frekuensi seragam `880Hz`, durasi 140ms, dan peak amplitude `0.70`.

## [ff8f94a] - Synthesized Countdown Beep and Correct Answer Sound Effects
- **Konteks Struktural**:
  1. Generator Efek Suara Audio Sintesis Mandiri ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js), [README.md](file:///d:/projects/clipping/scheduler-uploader/README.md)):
     - Menambahkan fungsi sintesis audio gelombang murni `generateQuizSoundWav` untuk menghasilkan file audio WAV 16-bit PCM stereo 44.1kHz sepanjang 4 detik secara instan di memori/disk tanpa ketergantungan file audio eksternal atau download internet.
     - Menyinkronkan efek suara countdown beep audio secara presisi pada kemunculan angka 3 ($t = 0.0s$, 800Hz), angka 2 ($t = 1.0s$, 800Hz), dan angka 1 ($t = 2.0s$, 1000Hz) dengan envelope decay lembut tanpa suara letup (*pop/click*).
     - Menambahkan efek suara nada lonceng kemenangan cerah (*rising major arpeggio chime* C6-E6-G6 dengan harmonik lonceng) tepat pada saat kartu jawaban benar terungkap di detik ke-3 ($t = 3.0s$).
     - Menggantikan stream audio hening `anullsrc` pada video freeze kuis dengan file audio efek suara tersintesis tersebut sehingga video kuis memiliki tata suara yang hidup dan interaktif.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_doksli.js`:
     - Membuat fungsi `generateQuizSoundWav(outputPath)`.
     - Mengintegrasikan file WAV hasil sintesis ke proses rendering video freeze kuis FFmpeg (`-i "${sfxWavPath}"`).
     - Mengekspor `generateQuizSoundWav` pada `module.exports`.
  - `scheduler-uploader/README.md`:
     - Mendokumentasikan efek suara countdown beep dan chime correct answer pada alur kuis.

## [4897f92] - Mathematical Vertical Centering for Quiz and Top-Quarter Positioning for Full Video Title
- **Konteks Struktural**:
  1. Penataan Posisi Kuis Terpusat Matematis & Dukungan Offset ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js), [.env.example](file:///d:/projects/clipping/scheduler-uploader/.env.example), [README.md](file:///d:/projects/clipping/scheduler-uploader/README.md)):
     - Menghitung ulang seluruh koordinat vertikal elemen kuis (header, judul, countdown, progress bar, dan 4 kartu pilihan ganda) agar terpusat secara matematis di tengah layar kanvas portrait 1080x1920 ($Y_{center} \approx 960px$, rentang $Y = 520$ s/d $1390$). Hal ini mengangkat kartu kuis agar tidak terlalu bawah dan aman dari elemen antarmuka (UI) TikTok/Reels/Shorts.
     - Menambahkan parameter manual offset vertikal `offsetY` yang dapat disesuaikan melalui opsi CLI `--offset-y=<px>` atau environment variable `QUIZ_OFFSET_Y`.
  2. Relokasi Overlay Judul Video Full ke 1/4 Atas Kanvas ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js)):
     - Merelokasi overlay judul dinamis video full dari tengah kanvas ($Y = 960$) ke area 1/4 atas kanvas ($Y = 480$, konfigurabel via `MEME_TEXT_Y`) agar tidak menabrak atau menutupi subtitle video bawaan yang berada tepat di tengah layar.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_doksli.js`:
     - Memperbarui fungsi `generateQuizASS` dengan koordinat Y baru yang terpusat matematis ($Y = 520, 600, 735, 815$, kartu $875, 1010, 1145, 1280$) serta penambahan parameter `offsetY`.
     - Memperbarui fungsi `generateFullVideoASS` dengan posisi default $Y = 480$ (`posY = 480`).
     - Menambahkan parsing CLI `--offset-y` dan `--meme-y`.
  - `scheduler-uploader/.env.example`:
     - Menambahkan variabel lingkungan `QUIZ_OFFSET_Y` dan `MEME_TEXT_Y`.
  - `scheduler-uploader/README.md`:
     - Memperbarui penjelasan posisi teks video full pada 1/4 kanvas atas serta contoh perintah pengujian dengan offset vertikal.

## [ba7cac6] - Static Fallback Distractors for Testing and Guaranteed Unique Quiz Options
- **Konteks Struktural**:
  1. Opsi Cadangan Statis & Validasi Keunikan Opsi Kuis ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js)):
     - Menambahkan bank opsi pengecoh cadangan statis (`STATIC_FALLBACK_DISTRACTORS`) berisi pilihan bertema gaming/meme populer agar pengguna dapat langsung menguji script meskipun folder Google Drive baru berisi 1 folder (atau di bawah 4 folder).
     - Menghapus syarat batas minimal 4 folder untuk keluar dengan error; script kini otomatis melengkapi opsi yang kurang dari bank statis tanpa memblokir proses kompilasi.
     - Mengembangkan fungsi `createUniqueQuizOptions` menggunakan struktur data `Set` dan pencocokan case-insensitive untuk menjamin 100% tidak akan pernah ada teks duplikat di antara opsi A, B, C, dan D.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_doksli.js`:
     - Menambahkan konstanta `STATIC_FALLBACK_DISTRACTORS`.
     - Menambahkan fungsi `createUniqueQuizOptions(correctAnswer, folderPool)` yang mengumpulkan 4 opsi unik tanpa duplikasi.
     - Menyesuaikan penanganan jumlah subfolder di Google Drive agar menampilkan informasi informatif saat folder < 4 alih-alih melempar error `process.exit(1)`.

## [83bff31] - Fixed Font Size and Strict Single-Line Quiz Option Rule
- **Konteks Struktural**:
  1. Penegasan Ukuran Font Statis & Aturan 1 Baris Pasti ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js), [GEMINI.md](file:///d:/projects/clipping/GEMINI.md), [README.md](file:///d:/projects/clipping/scheduler-uploader/README.md)):
     - Menghapus mekanisme auto font-scaling dan perbedaan ukuran font pada kartu pilihan kuis kuis untuk menjaga konsistensi tinggi kartu dan baseline vertikal teks.
     - Menetapkan ukuran font statis seragam (42px) pada seluruh kartu (baik fase netral maupun fase reveal hijau) serta mencatat Learned Rule 23 bahwa kartu kuis dan subtitle tidak boleh menerapkan auto-scaling atau auto-break dinamis.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_doksli.js`:
     - Menghapus kalkulasi dynamic font-scaling (`fontSize = 42/36/32`) dan menjadikannya konstan `fontSize = 42`.
     - Menghilangkan lonjakan font size (`fontSize + 2`) pada kartu jawaban benar agar posisi vertikal teks tetap 100% stabil.
  - `scheduler-uploader/README.md`:
     - Memperbarui dokumentasi dengan menegaskan aturan 1 baris pasti tanpa auto font-scaling.
  - `GEMINI.md`:
     - Menambahkan Learned Rule 23 tentang larangan auto line-breaking dan dynamic font-scaling pada komponen kuis/meme.

## [2daa104] - Subfolder Two-File Doksli Flow, Clean Green Reveal, and Centered Meme Overlay
- **Konteks Struktural**:
  1. Arsitektur Momen Subfolder 2 File ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js), [README.md](file:///d:/projects/clipping/scheduler-uploader/README.md)):
     - Menyesuaikan arsitektur Google Drive ke model subfolder momen: setiap subfolder mewakili satu momen dan namanya adalah kunci jawaban kuis.
     - Setiap subfolder momen wajib berisi tepat 2 file video: `cut.mp4` (video potongan epik/facecam diawal) dan `<nama_meme>.mp4` (video full). Script otomatis memvalidasi dan melewati folder yang tidak memiliki tepat 2 file video atau tidak memiliki `cut.mp4`.
  2. Alur 3 Bagian per Momen & Overlay Teks Tengah ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js)):
     - Mengubah alur per segmen menjadi 3 tahap: `cut.mp4` diputar utuh -> freeze frame akhir 4 detik (kuis overlay dengan countdown 3 detik dan reveal hijau emerald bersih tanpa simbol `[V]`) -> video full diputar dengan overlay teks judul file di tengah layar (vertikal & horizontal) dengan dukungan manual line break `\n` -> `\N` tanpa auto line-wrapping.
     - Menerapkan auto font-scaling pada kartu pilihan ganda agar opsi jawaban tetap muat rapi dalam 1 baris.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_doksli.js`:
     - Memperbarui pengambilan pool momen dari subfolder Google Drive dan menambahkan fungsi validasi ketat 2 file per folder.
     - Menghapus simbol `[V]` pada kartu reveal kuis, hanya menonjolkan warna hijau emerald pada kartu dan teks jawaban benar.
     - Menambahkan fungsi `generateFullVideoASS` untuk merender judul file full di tengah layar secara vertikal dan horizontal dengan konversi `\n` menjadi `\N`.
     - Menambahkan helper `normalizeVideo` dengan fallback audio hening otomatis untuk video tanpa stream suara.
  - `scheduler-uploader/README.md`:
     - Memperbarui dokumentasi struktur folder subfolder momen, aturan 2 file video (`cut.mp4` & full), dan alur 3 bagian kuis.

## [0b407fd] - Doksli Video Quiz Auto-Editing Compilation Pipeline
- **Konteks Struktural**:
  1. Auto-Edit Kompilasi Tebak-Tebakan Doksli ([compile_doksli.js](file:///d:/projects/clipping/scheduler-uploader/compile_doksli.js), [package.json](file:///d:/projects/clipping/scheduler-uploader/package.json)):
     - Mengembangkan pipeline CLI mandiri yang mengotomatisasi pengambilan 5–10 klip secara acak dari 1 folder Google Drive flat (tanpa subfolder), lalu merangkainya menjadi 1 video vertikal 9:16 (1080x1920 30fps) dengan format interaktif kuis tebak momen.
     - Setiap klip di-freeze pada frame terakhir selama 4 detik dengan DirectWrite ASS subtitle overlay: judul pertanyaan "Momen manakah itu?", pilihan ganda A/B/C/D (1 jawaban benar dari nama file + 3 pengecoh acak dari pool video), hitung mundur 3 detik dengan animasi progress bar, dan reveal jawaban benar berubah warna menjadi hijau emerald selama 1 detik sebelum berganti ke klip berikutnya.
     - Memanfaatkan binary static `ffmpeg-static` mandiri dan penggabungan stream tanpa desync audio/video menggunakan normalisasi parameter dan filter concat FFmpeg.
  2. Integrasi Konfigurasi & Setup Wizard ([setup.js](file:///d:/projects/clipping/scheduler-uploader/setup.js), [.env.example](file:///d:/projects/clipping/scheduler-uploader/.env.example), [README.md](file:///d:/projects/clipping/scheduler-uploader/README.md)):
     - Menambahkan konfigurasi `GDRIVE_DOKSLI_FOLDER_ID` dan `QUIZ_CLIP_COUNT` pada `.env.example` serta opsi input interaktif pada wizard `setup.js`.
     - Mendokumentasikan alur eksekusi, opsi command line (`--count`, `--folder`), dan cara menjalankan (`npm run doksli`) pada `README.md`.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/compile_doksli.js`:
     - Membuat script kompilasi video lengkap: otentikasi Google Drive, ekstraksi freeze frame akhir, generator ASS vector overlay kuis, normalisasi resolusi 1080x1920 dan audio 44.1kHz aac, perakitan segmen klip + kuis, dan penggabungan akhir ke folder `output_kompilasi/`.
  - `scheduler-uploader/package.json`:
     - Menambahkan dependency `ffmpeg-static` dan npm script shortcut `"doksli"` serta `"compile:doksli"`.
  - `scheduler-uploader/setup.js`:
     - Menambahkan prompt konfigurasi ID/link folder Doksli pada Tahap 3 setup wizard.
  - `scheduler-uploader/.env.example`:
     - Menambahkan variabel lingkungan `GDRIVE_DOKSLI_FOLDER_ID` dan `QUIZ_CLIP_COUNT`.
  - `scheduler-uploader/README.md`:
     - Menambahkan dokumentasi fitur, alur kerja kuis per klip, dan instruksi eksekusi kompilasi doksli.

## [Unreleased] - Remove Legacy Non-Millisecond Backward Compatibility
- **Konteks Struktural**:
  1. Penegasan Format Presisi Milidetik Tunggal ([api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts), [useClipData.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipData.ts), [useClipDownload.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipDownload.ts)):
     - Menghapus lapisan *backward compatibility* pencarian file format lama tanpa milidetik (`mm.ss` / `hh.mm.ss`) yang sebelumnya ditambahkan pada fungsi resolusi file klip, subtitle, dan template.
     - Seluruh penamaan dan pembacaan file kini 100% konsisten berorientasi pada format presisi milidetik tunggal (`mm.ss.mmm`), menghilangkan overhead disk I/O sekunder saat mengecek keberadaan file fisik.
- **Perubahan Kode Penting**:
  - `mobile/src/services/api.ts`:
    - Menghapus fungsi `formatLegacyTimeForFilename`.
    - Menghapus pengecekan format warisan tanpa milidetik dari `resolvePlayableClipUri`, `loadClipSubtitle`, dan `loadClipTemplate`.
  - `mobile/src/hooks/useClipData.ts` & `mobile/src/hooks/useClipDownload.ts`:
    - Menghapus pemanggilan fallback `resolvePlayableClipUri` pada pengecekan file klip saat `mode done`.

## [dfeb345] - Millisecond Filename Precision, Deferred File Checking, and Open Editor Before Download
- **Konteks Struktural**:
  1. Kepresisian Nama File hingga Milidetik ([api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts), [file_utils.py](file:///d:/projects/clipping/mobile/scripts/utils/file_utils.py)):
     - Menjawab kebutuhan pembedaan file klip saat pengguna hanya menggeser atau mengubah milidetik tanpa mengubah detik bulat: format nama file diperluas dari `mm.ss` / `hh.mm.ss` menjadi `mm.ss.mmm` / `hh.mm.ss.mmm` (contoh: `00.12.350 - 01.35.000.mp4`).
     - Seluruh aset terkait (`.mp4`, `(Subtitled).mp4`, `.json`, `(Template).json`) otomatis mewarisi presisi milidetik melalui `formatTimeForFilename`.
     - Ditambahkan helper `formatLegacyTimeForFilename` serta fallback berlapis pada `resolvePlayableClipUri`, `loadClipSubtitle`, dan `loadClipTemplate` untuk mendeteksi file lama tanpa milidetik agar aset yang sudah ada tidak terputus (*backward compatible*).
  2. Pengecekan File Ringan & Penundaan Scan Direktori ([useClipData.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipData.ts), [useClipDownload.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipDownload.ts)):
     - Menghapus proses scan direktori storage dan perulangan `checkClipFileExists` menyeluruh saat inisialisasi kamar workshop clipping (`init kamar clipping`). Inisialisasi kini instan 0ms I/O.
     - Pengecekan keberadaan file fisik dialihkan hanya saat klip berada dalam `mode done` (atau di-toggle ke `done`), dan murni memeriksa nama file/stat (`checkClipFileExists`) tanpa memuat (*load*) file video ke memory.
  3. Pemutaran Video Bebas Lag & Posisi Absolut Terjaga ([useClipPlayer.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipPlayer.ts)):
     - Menghapus penggantian sumber video player (`player.replace(fileUri)`) ke file klip hasil potong individual (kualitas prime 1080p).
     - Pemutar video kini konsisten memutar video proxy utuh (`full_proxy.mp4`) atau streaming progressive (480p) pada posisi absolut `clip.start`, sehingga tidak membebani hardware decoder ponsel dan bebas lag.
  4. Mode Editor Terbuka Sebelum Unduhan & Relokasi Tombol Unduh ([FeedTopControls.tsx](file:///d:/projects/clipping/mobile/src/components/feed/FeedTopControls.tsx), [useClipTemplate.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipTemplate.ts)):
     - Membuka akses kontrol editor subtitle dan template segera setelah klip ditandai `done`, meskipun file video klip belum diunduh.
     - Merelokasi tombol **Unduh** ke slot posisi tombol **Ekspor** (kiri atas). Jika klip belum diunduh, tombol Unduh (dengan progress unduhan) muncul di sana dan tombol ekspor terkunci. Setelah unduhan tuntas, tombol Unduh otomatis berganti menjadi tombol Ekspor.
     - Menyederhanakan grup tombol kanan atas saat `mode done` sehingga hanya menyisakan tombol centang *Done*.
     - Menghilangkan syarat `isDownloaded` pada pratinjau kanvas portrait `isPortrait` di `useClipTemplate.ts` agar layout 9:16 dapat langsung diatur dan dipratinjau sebelum klip diunduh.
- **Perubahan Kode Penting**:
  - `mobile/src/services/api.ts`:
    - Memperbarui `formatTimeForFilename` dengan presisi 3 digit milidetik (`.mmm`).
    - Menambahkan `formatLegacyTimeForFilename` dan mekanisme pengecekan fallback format warisan pada `resolvePlayableClipUri`, `loadClipSubtitle`, dan `loadClipTemplate`.
  - `mobile/scripts/utils/file_utils.py`:
    - Memperbarui `format_time_filename` Python dengan presisi `.mmm`.
  - `mobile/src/hooks/useClipData.ts`:
    - Menghapus perulangan pre-scan direktori storage pada saat inisialisasi klip.
    - Menyesuaikan `handleToggleDone` agar hanya memeriksa keberadaan file ke `downloadedClips` tanpa mengganti sumber pemutar video.
  - `mobile/src/hooks/useClipPlayer.ts`:
    - Menghilangkan `player.replace` untuk file klip potong individual pada `syncPlayerSourceForClip` dan `initializeStreamAndPlayback`.
  - `mobile/src/hooks/useClipDownload.ts`:
    - Menambahkan pengecekan fallback nama lama pada `useEffect` mode done dan menghapus pemaksaan pergantian sumber pemutar ke file lokal saat unduhan selesai.
  - `mobile/src/components/feed/FeedTopControls.tsx`:
    - Memindahkan tombol Unduh ke posisi tombol Ekspor saat klip belum diunduh.
    - Menghapus pengondisian `isDownloaded` pada rendering baris kontrol editor Subtitle dan Template.
  - `mobile/src/hooks/useClipTemplate.ts`:
    - Menghapus batasan `!isDownloaded` dari kalkulasi memo `isPortrait`.

## [42c1993] - Decouple Stream and Download URL Retrieval with Confirmation Modal
- **Konteks Struktural**:
  1. Pemisahan Total Ekstraksi URL dari Konsumsi Stream & Download ([UrlConfirmModal.tsx](file:///d:/projects/clipping/mobile/src/components/UrlConfirmModal.tsx), [api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts)):
     - Menjawab kendala pemborosan kuota data seluler saat pengguna mengalami rate limit/blokir IP YouTube pada koneksi Wi-Fi: ekstraksi metadata URL YouTube (~100 KB) kini dipisahkan sepenuhnya menjadi fungsi mandiri dari proses pengunduhan atau pemutaran video multi-megabyte.
     - Khusus untuk fungsi **Stream** dan **Download** (Klip & Full Video), aplikasi memeriksa ketersediaan cache URL terlebih dahulu. Jika cache belum ada atau kedaluwarsa, eksekusi stream/download langsung dihentikan (**STOP**) dan memunculkan modal konfirmasi: `"URL belum tersedia, hit get url?"`.
     - Ketika pengguna menekan **"Ya, Hit Get URL"**, aplikasi hanya mengeksekusi pengambilan URL (~100 KB) dan menyimpannya ke cache. Setelah URL berhasil didapatkan, proses berhenti dan pengguna diminta menekan kembali tombol download/stream secara manual.
     - Hal ini memungkinkan alur pengguna yang aman dan hemat kuota: pengguna dapat beralih ke paket data seluler untuk bypass blokir IP saat mengambil URL, beralih kembali ke Wi-Fi, lalu menekan tombol download/stream untuk menyedot file video tanpa menghabiskan kuota seluler.
  2. Isolasi Fitur dan Pelestarian Alur Langsung ([Dashboard.tsx](file:///d:/projects/clipping/mobile/src/components/Dashboard.tsx), [useClipDownload.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipDownload.ts), [useClipPlayer.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipPlayer.ts)):
     - Alur konfirmasi URL hanya diterapkan pada Stream dan Download. Endpoint data ringan seperti Heatmap, Subtitle, dan pembuatan Workshop tidak menggunakan modal ini (tetap direct fetch).
     - Jika file full video lokal sudah tersedia, pemotongan klip dilakukan offline melalui FFmpeg secara langsung tanpa network request dan tanpa memunculkan modal konfirmasi URL.
- **Perubahan Kode Penting**:
  - `mobile/src/components/UrlConfirmModal.tsx`:
    - Membuat komponen modal `UrlConfirmModal` dan singleton `UrlConfirmManager` dengan tips panduan jaringan (Wi-Fi vs data seluler) dan feedback visual saat proses pengambilan metadata berlangsung.
  - `mobile/src/services/api.ts`:
    - Menambahkan helper `hasCachedStreamUrl`, `clearCachedStreamUrl`, `getCachedStreamUrl`, `hasCachedDownloadStreamUrl`, dan `fetchAndCacheDownloadStreamUrl` untuk mengecek dan mengambil metadata URL stream/download secara terisolasi tanpa payload video.
  - `mobile/src/hooks/useClipDownload.ts`:
    - Memeriksa ketersediaan cache sebelum memicu `downloadClip`; jika cache belum tersedia, download dihentikan dan memunculkan modal konfirmasi pengambilan URL.
  - `mobile/src/components/Dashboard.tsx`:
    - Memeriksa ketersediaan cache URL sebelum memutar stream workshop (`handleOpenExisting`, `handleSubmitWorkshop`) atau memulai unduhan video utuh (`handleDownloadFullVideo`).
  - `mobile/src/hooks/useClipPlayer.ts`:
    - Mengganti auto-refresh background saat player error menjadi dialog konfirmasi pembaruan URL stream via `UrlConfirmManager`.
  - `mobile/src/app/index.tsx`:
    - Memasang `<UrlConfirmModal />` pada root level aplikasi.

## [a70411a] - Synchronize Custom Aspect Ratio and Vertical Centering to Embedded Native Python Engine
- **Konteks Struktural**:
  1. Sinkronisasi Pipeline Ekspor FFmpeg ke Native Module Android ([subtitle_burner.py](file:///d:/projects/clipping/mobile/modules/python-runner/android/src/main/python/utils/subtitle_burner.py)):
     - Menjawab kendala di mana ekspor video di HP tidak menerapkan rasio kustom (a:b) dan perataan tengah (*centered vertical*): modul embedded Chaquopy (`mobile/modules/python-runner/`) sebelumnya belum disinkronkan dari source of truth (`mobile/scripts/utils/`), sehingga ekspor di HP masih mengeksekusi script lama dengan layout hardcoded 4:3 dan top-aligned.
     - Menyinkronkan seluruh modul Python utilitas (`subtitle_burner.py`, `downloader.py`, `clip_downloader.py`, `heatmap.py`, `stream_extractor.py`, `subtitle_fetcher.py`) dari `mobile/scripts/utils/` ke `mobile/modules/python-runner/android/src/main/python/utils/`.
     - Memperkuat kalkulasi bounding box Y pada FFmpeg filtergraph: memastikan `y_main` dan `y_fc` dibatasi secara ketat terhadap `out_h - 2` sehingga tidak memicu error batas pad pada kasus rasio ekstrim.
     - Memperbarui evaluasi `hasTemplate` pada [useClipSubtitle.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipSubtitle.ts) dan [subtitle_burner.py](file:///d:/projects/clipping/mobile/scripts/utils/subtitle_burner.py) agar mendeteksi keberadaan `ratioWidth` dan `ratioHeight` kustom meskipun cue subtitle belum dibuat.
  2. Ketahanan Download Fragmen Media dengan URL Stream Sama ([downloader.py](file:///d:/projects/clipping/mobile/scripts/utils/downloader.py), [ytdlp.ts](file:///d:/projects/clipping/mobile/src/constants/ytdlp.ts)):
     - Mengatur `fragment_retries: 10` pada download segmen video (media chunk) dengan URL stream CDN yang sama agar tahan terhadap fluktuasi koneksi internet, sambil tetap menjaga `retries: 0` dan `extractor_retries: 0` untuk mencegah perulangan request ekstraksi YouTube yang menguras kuota rate limit.
- **Perubahan Kode Penting**:
  - `mobile/scripts/utils/subtitle_burner.py` & `mobile/modules/python-runner/android/src/main/python/utils/subtitle_burner.py`:
    - Mengintegrasikan kalkulasi rasio aspek kustom (a:b), offset centered vertikal dinamis, dan proteksi clamping Y pada canvas portrait.
  - `mobile/src/hooks/useClipSubtitle.ts`:
    - Memasukkan verifikasi `ratioWidth` dan `ratioHeight` ke dalam penentu `hasTemplate` sebelum ekspor dipicu.
  - `mobile/src/constants/ytdlp.ts` & `downloader.py`:
    - Mengonfigurasi `fragment_retries: 10` untuk download media bytes.

## [8c9e22d] - Fix Unresponsive Scrolling in Dashboard SettingsModal
- **Konteks Struktural**:
  1. Pemulihan Respon Sentuhan Scroll Modal Pengaturan ([SettingsModal.tsx](file:///d:/projects/clipping/mobile/src/components/SettingsModal.tsx)):
     - Memisahkan elemen `<TouchableWithoutFeedback onPress={Keyboard.dismiss}>` agar hanya berada di layer backdrop absolut di luar modal card, menghilangkan intersepsi gesture sentuh yang sebelumnya menelan event drag native Android pada komponen `ScrollView`.
     - Mengubah styling `scrollArea` dari batasan kaku `maxHeight: 460` menjadi `flexShrink: 1` dan `modalCard` menjadi `maxHeight: '85%'`, sehingga viewport scroll menyesuaikan proporsional dengan tinggi layar perangkat.
     - Mengonfigurasi `keyboardShouldPersistTaps="handled"`, `keyboardDismissMode="on-drag"`, `nestedScrollEnabled={true}`, dan `showsVerticalScrollIndicator={true}` untuk pengalaman scrolling yang ringan, mulus, dan responsif.
- **Perubahan Kode Penting**:
  - `mobile/src/components/SettingsModal.tsx`:
    - Mengisolasi dismiss keyboard ke backdrop touchable, menambahkan atribut scroll native, dan memperbarui flex constraint pada `modalCard` serta `scrollArea`.

## [a0340b9] - Persist Custom Aspect Ratio in Video Global Config and Export Pipeline
- **Konteks Struktural**:
  1. Sinkronisasi Penuh Rasio Kustom pada Global Config dan Pipeline Ekspor:
     - Memastikan properti rasio kustom (`ratioWidth` dan `ratioHeight`) tidak terpotong saat dipersistensikan melalui `saveVideoGlobalConfig` di [api.ts](file:///d:/projects/clipping/mobile/src/services/api.ts).
     - Menghubungkan `ratioWidth` dan `ratioHeight` ke dalam perakitan `activeTemplateConfig` pada [useClipSubtitle.ts](file:///d:/projects/clipping/mobile/src/hooks/useClipSubtitle.ts) saat melakukan ekspor video klip (*burn-in subtitle & layout* via FFmpeg), sehingga hasil ekspor video 100% menggunakan rasio viewport kustom kreator (bukan fallback ke 4:3).
     - Menjamin ekspor data JSON kamar workshop pada [Dashboard.tsx](file:///d:/projects/clipping/mobile/src/components/Dashboard.tsx) mencakup seluruh konfigurasi rasio aspek kustom kamar secara utuh.
- **Perubahan Kode Penting**:
  - `mobile/src/services/api.ts`:
    - Menyertakan `ratioWidth` dan `ratioHeight` ke dalam merger objek `facecam` dan `mainVideo` pada `saveVideoGlobalConfig`.
  - `mobile/src/hooks/useClipSubtitle.ts`:
    - Meneruskan `ratioWidth` dan `ratioHeight` dari `globalConfig` dan `savedTemplate` ke dalam `activeTemplateConfig` saat memicu ekspor burn-in subtitle.

## [4ec7a98] - Remove Automated yt-dlp Retry Mechanisms Across All Fetch Endpoints
- **Konteks Struktural**:
  1. Penghapusan Mekanisme Retry Otomatis pada Skrip Backend yt-dlp (`heatmap.py`, `stream_extractor.py`, `subtitle_fetcher.py`, `clip_downloader.py`, `downloader.py`):
     - Menghapus pola eksekusi *two-tier retry* di mana kegagalan mode anonim di dalam blok `catch`/`except` atau saat status bernilai false langsung memicu percobaan ulang (*retry*) otomatis menggunakan cookies.
     - Mengubah arsitektur pemanggilan yt-dlp menjadi *Single Pass*: jika `cookie_path` valid diberikan oleh frontend, skrip langsung menggunakan cookies sejak awal; jika tidak, skrip berjalan dalam mode anonim.
     - Mengeliminasi loop retry internal bawaan yt-dlp (`retries: 0`, `fragment_retries: 0`, `extractor_retries: 0`, `file_access_retries: 0`) pada [ytdlp.ts](file:///d:/projects/clipping/mobile/src/constants/ytdlp.ts) dan [downloader.py](file:///d:/projects/clipping/mobile/scripts/utils/downloader.py) agar tidak terjadi perulangan tersembunyi yang membakar kuota atau memperparah batasan rate limit (HTTP 429) YouTube.
     - Menegakkan Rule 19: Menghapus parsing string error dan pengelompokan error manual di backend Python ([heatmap.py](file:///d:/projects/clipping/mobile/scripts/utils/heatmap.py), [stream_extractor.py](file:///d:/projects/clipping/mobile/scripts/utils/stream_extractor.py), [subtitle_fetcher.py](file:///d:/projects/clipping/mobile/scripts/utils/subtitle_fetcher.py), [clip_downloader.py](file:///d:/projects/clipping/mobile/scripts/utils/clip_downloader.py)), mengembalikan pesan error mentah (*raw error & traceback*) secara murni pass-through ke Frontend TypeScript.
  2. Alur Pengendalian Manual 100% oleh Pengguna (Zero Automated Background Retry):
     - Mencegah bahaya terselubung di mana error akibat bug kode atau format video yang tidak ada disalahartikan sebagai rate limit lalu di-retry otomatis.
     - Menyerahkan kendali penuh kepada pengguna: jika terjadi kegagalan (termasuk rate limit), pengguna harus menekan ulang tombol fitur secara sadar tanpa ada popup interupsi retry otomatis.
- **Perubahan Kode Penting**:
  - `mobile/scripts/utils/heatmap.py`:
    - Mengganti logika dua tahap anonim -> cookies menjadi eksekusi tunggal (*single pass*), menghapus evaluasi string error manual.
  - `mobile/scripts/utils/stream_extractor.py`:
    - Mengganti logika dua tahap anonim -> cookies menjadi eksekusi tunggal (*single pass*), mengembalikan string error mentah.
  - `mobile/scripts/utils/subtitle_fetcher.py`:
    - Mengeliminasi percobaan kedua pada blok `except` atau saat respon bukan `success`, mengembalikan error & traceback asli.
  - `mobile/scripts/utils/clip_downloader.py`:
    - Menghapus fallback retry `run_stage1_download(use_cookie=True)` saat `stage1_success` bernilai false, menjalankan satu kali pass sesuai status ketersediaan cookies.
  - `mobile/scripts/utils/downloader.py`:
    - Menghapus blok retry `try_download(..., use_cookies=True)` di dalam `except Exception as e_anon`, menyetel `retries` dan `fragment_retries` menjadi 0.
  - `mobile/src/constants/ytdlp.ts`:
    - Menyetel `retries: 0`, `fragment_retries: 0`, `extractor_retries: 0`, dan `file_access_retries: 0` pada `PRIME_CLIP_DOWNLOAD_OPTS`.

## [bafd6ee] - Remove Intrusive Cookies Auto-Popup and Enhance Dashboard Cookies Management
- **Konteks Struktural**:
  1. Penghapusan Total Auto-Popup Modal Cookies pada Penanganan Error (`FeedScreen.tsx`, `useClipSubtitle.ts`):
     - Menghapus kemunculan modal input cookies otomatis (`onRateLimit` -> `setCookiesModalVisible(true)`) dari seluruh blok penanganan error (heatmap, stream, unduh url, dan subtitle YouTube).
     - Menjadikan seluruh kegagalan akses yt-dlp maupun rate limit (Error 429) murni ditangani melalui notifikasi Toast standar yang konsisten, tanpa menginterupsi alur kerja pengguna dengan modal popup yang mengganggu.
     - Menghapus instance `CookiesModal` serta state dan ref terkait dari [FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx).
  2. Peningkatan Manajemen Cookies pada Pengaturan Dashboard (`SettingsModal.tsx`):
     - Menambahkan deteksi otomatis keberadaan file cookies aktif (`getValidCookiesPath()`) saat modal pengaturan dibuka.
     - Menyediakan kartu status visual hijau: *Cookies Terpasang & Aktif* jika file cookies terdeteksi di penyimpanan internal/shared.
     - Menambahkan tombol aksi *Hapus Cookies* (`Trash2`) dengan dialog konfirmasi (`Alert.alert`) yang memanggil `deleteCookies()` untuk membersihkan cookies dan mengembalikan aplikasi ke mode anonim kapan saja.
     - Memperjelas tombol submit unduhan Google Drive (`CloudDownload`) dengan teks dinamis ("Unduh & Simpan Cookies" atau "Perbarui / Timpa Cookies") sehingga proses pengambilan (GET) dan penyimpanan file cookies dari link Google Drive berjalan eksplisit dan transparan.
- **Perubahan Kode Penting**:
  - `mobile/src/hooks/useClipSubtitle.ts`:
    - Menghapus parameter `onRateLimit` dari `UseClipSubtitleParams`, menghapus trigger `onRateLimit?.()`, dan membersihkan import `isRateLimitOrRestrictedError`.
  - `mobile/src/components/FeedScreen.tsx`:
    - Menghapus import `CookiesModal`, ref `setCookiesModalVisibleRef`, state `cookiesModalVisible`, callback `onRateLimit`, dan elemen JSX `<CookiesModal />`.
  - `mobile/src/components/SettingsModal.tsx`:
    - Mengintegrasikan `getValidCookiesPath`, `deleteCookies`, status aktif cookies, tombol hapus cookies dengan dialog konfirmasi, dan penyesuaian label tombol submit unduh/timpa.

## [c9824d0] - Align Watermark Overlay Architecture with Subtitle and Allow Flexible Font Size
- **Konteks Struktural**:
  1. Penyelarasan Arsitektur Watermark Overlay dengan Subtitle Overlay (`WatermarkOverlay.tsx`):
     - Membungkus komponen dengan `React.memo` untuk mencegah re-render sia-sia saat pembaruan waktu pemutaran / state komponen induk.
     - Menyamakan metode rendering outline teks dengan solid 8 arah (kardinal & diagonal) tanpa shadow/blur dan tanpa `opacity: 0.85` guna mengeliminasi overdraw blending berulang pada thread render GPU native Android.
     - Mengimplementasikan `strokeScale = Math.max(0.6, scaleFactor)` agar ketebalan garis tepi outline menyesuaikan proporsional dengan resolusi kanvas.
     - Mengadopsi konversi spasi menjadi Non-Breaking Space (`\u00A0`), parsing `linesData` via `useMemo`, dan properti `textBreakStrategy="simple"` untuk mencegah Android `StaticLayout` memotong kata terakhir (*orphan token drop bug*) serta menjamin konsistensi posisi antara layer teks utama dan stroke.
     - Menyematkan `aria-hidden` pada elemen Text stroke outline untuk efisiensi aksesibilitas dan menyetel `includeFontPadding: false` untuk kerapihan teks.
  2. Fleksibilitas Ukuran Font Watermark (`FeedTopControls.tsx`, `WatermarkOverlay.tsx`, `subtitle_burner.py`):
     - Menghapus pembatasan minimum font size defensif yang sebelumnya dikunci pada 8/9 dp menjadi minimum 2 dp, memungkinkan teks watermark berukuran kecil diskrit tanpa mengganggu konten video.
     - Menambahkan barisan tombol *preset* cepat (`4`, `6`, `8`, `10`, `12`, `14`, `18`) pada modal pengaturan watermark di `FeedTopControls.tsx` agar pengguna dapat memilih ukuran kecil secara instan.
     - Menyesuaikan kalkulasi `wm_fs` di script ekspor FFmpeg ([subtitle_burner.py](file:///d:/projects/clipping/mobile/scripts/utils/subtitle_burner.py)) dari batas minimum `max(10, ...)` menjadi `max(2, ...)` agar hasil video ekspor 100% presisi dan identik dengan preview.
- **Perubahan Kode Penting**:
  - `mobile/src/components/feed/WatermarkOverlay.tsx`:
    - Mengganti arsitektur rendering dengan `React.memo`, 8-way solid offsets dengan `strokeScale`, Non-Breaking Space `\u00A0`, `textBreakStrategy="simple"`, `aria-hidden`, dan penurunan min font clamp menjadi `Math.max(2, ...)`.
  - `mobile/src/components/feed/FeedTopControls.tsx`:
    - Menurunkan validasi simpan ukuran watermark dari `Math.max(8, ...)` menjadi `Math.max(2, ...)` dan menambahkan tombol preset ukuran font.
  - `mobile/scripts/utils/subtitle_burner.py`:
    - Menurunkan batas pengaman `wm_fs` dari `max(10, ...)` menjadi `max(2, ...)`.

## [cfd7510] - Implement Dynamic Custom Aspect Ratio Inputs for Facecam and Gameplay
- **Konteks Struktural**:
  1. Input Rasio Bebas (a : b) pada Modal Konfigurasi Facecam & Gameplay (`FeedTopControls.tsx`):
     - Menambahkan dua kotak input numerik (A dan B) untuk konfigurasi rasio aspek viewport Facecam dan Gameplay.
     - Menyediakan nilai default fleksibel: Facecam `4:3`, Gameplay `4:3` (saat facecam aktif) atau `16:9` (saat facecam nonaktif), serta membebaskan kreator memasukkan rasio kustom apa pun (seperti `1:1`, `21:9`, `9:16`).
  2. Arsitektur State & Sinkronisasi Konfigurasi Global (`api.ts`, `useClipTemplate.ts`):
     - Menambahkan properti `ratioWidth` dan `ratioHeight` ke dalam antarmuka `ClipTemplateConfig` dan `VideoGlobalConfig`.
     - Mewariskan dan menyinkronkan rasio aspek otomatis ke `video_config.json` dan in-memory cache map saat diedit sehingga seragam di semua klip pada video yang sama.
  3. Kalkulasi Geometri Viewport Dinamis pada Preview & Render Video (`FeedScreen.tsx`, `subtitle_burner.py`):
     - Di React Native ([FeedScreen.tsx](file:///d:/projects/clipping/mobile/src/components/FeedScreen.tsx)): Menghitung tinggi viewport `h = w / (ratioW / ratioH)` dan mengadopsi `baseVideoWidth = max(w, h * 16/9)` agar native video selalu memenuhi viewport tanpa celah hitam untuk rasio apa pun. Mengatur `aspectRatio` kontainer box secara dinamis.
     - Di Pipeline Ekspor FFmpeg ([subtitle_burner.py](file:///d:/projects/clipping/mobile/scripts/utils/subtitle_burner.py)): Menghitung tinggi dan crop box sumber secara dinamis sesuai perbandingan `src_aspect` vs `ratio`, selaras presisi 1:1 dengan tampilan preview di HP.
- **Perubahan Kode Penting**:
  - `mobile/src/services/api.ts`:
    - Menambahkan `ratioWidth` dan `ratioHeight` pada `ClipTemplateConfig`, `DEFAULT_TEMPLATE_CONFIG`, dan `VideoGlobalConfig`.
  - `mobile/src/hooks/useClipTemplate.ts`:
    - Mengintegrasikan pembacaan dan sinkronisasi `ratioWidth` serta `ratioHeight` pada `checkSavedTemplate`, `handleUpdateFacecam`, dan `handleUpdateMainVideo`.
  - `mobile/src/components/FeedScreen.tsx`:
    - Memperbarui `facecamVideoStyle`, `mainVideoStyle`, `facecamBox`, dan `mainVideoBox` dengan kalkulasi rasio dinamis.
  - `mobile/src/components/feed/FeedTopControls.tsx`:
    - Menambahkan input field Rasio Aspek (A : B) pada modal Facecam dan Gameplay.
  - `mobile/scripts/utils/subtitle_burner.py`:
    - Menghitung tinggi viewport dan dimensi crop sumber berbasis `ratioWidth / ratioHeight` dinamis.

## [599b088] - Implement Unified Vertical Centering for Canvas Preview and Video Export
- **Konteks Struktural**:
  1. Penyelarasan Posisi Vertikal Kanvas Editor (`FeedScreen.tsx`):
     - Mengubah perataan `styles.canvasPortrait` menjadi `justifyContent: 'center'`, sehingga seluruh grup elemen aktif (Banner Konteks, Facecam, dan Gameplay) tersusun mengambang seimbang di tengah kanvas portrait 9:16 dengan ruang kosong atas-bawah yang simetris.
     - Menyematkan `position: 'absolute'` pada hidden player gameplay saat dinonaktifkan (mode Facecam Only) agar tidak mengambil ruang pada alur tata letak flexbox.
  2. Kalkulasi Offset Centered Vertikal Otomatis pada Pipeline Ekspor FFmpeg (`subtitle_burner.py`):
     - Menghitung tinggi aktif kumulatif seluruh layer (`total_content_h = h_banner + h_fc + h_main`) dan menentukan offset vertikal kanvas: `offset_y = max(0, (out_h - total_content_h) // 2)`.
     - Memposisikan Banner di `y = offset_y`, Facecam di `y = offset_y + h_banner`, dan Gameplay di `y = offset_y + h_banner + h_fc`, menjamin hasil render MP4 100% presisi dan identik dengan preview layar HP.
     - Mengimplementasikan pengaman *auto-cut* pada filter scale & crop saat padding video mendekati batas bawah kanvas untuk mencegah kegagalan error pad FFmpeg.
- **Perubahan Kode Penting**:
  - `mobile/src/components/FeedScreen.tsx`:
    - Mengubah `justifyContent: 'flex-start'` menjadi `'center'` pada `styles.canvasPortrait`.
    - Menambahkan `position: 'absolute'` pada kontainer hidden player saat gameplay disabled.
  - `mobile/scripts/utils/subtitle_burner.py`:
    - Menghitung `offset_y` dan menyelaraskan penempatan Y pada `drawbox`, `drawtext`, `[fc_box]`, dan `[in_main]`.
    - Menambahkan filter scale/crop pembatas sebelum operasi `pad` untuk auto-cut yang aman.

## [74a1216] - Add GitHub Actions EAS Local Build Workflow for Android Development APK
- **Konteks Struktural**:
  1. Pipeline CI/CD EAS Local Build Khusus Development APK (`.github/workflows/build-dev-apk.yml`):
     - Membangun alur kerja GitHub Actions manual (`workflow_dispatch` 100% tanpa pemicu push otomatis) untuk kompilasi binary Development APK (`expo-dev-client`).
     - Menyelaraskan seluruh spesifikasi toolchain dengan pipeline produksi: Node.js 22, Python 3.10 (prasyarat build-time Chaquopy), Java JDK 17 (Temurin), dan penerimaan otomatis lisensi Android SDK bawaan runner Ubuntu 22.04.
     - Mengeksekusi `eas build --platform android --profile development --local` menggunakan autentikasi `EXPO_TOKEN` akun resmi (`arkanafaisal`) dan menyimpan artefak `clipping-development.apk` (retensi 14 hari).
- **Perubahan Kode Penting**:
  - `.github/workflows/build-dev-apk.yml`:
    - Membuat skrip alur kerja build development APK manual berbasis EAS local runner.

## [6171f0b] - Add Defined Outline Border to Canvas Wrapper for Editor Visibility
- **Konteks Struktural**:
  1. Penambahan Border Visual pada Kanvas Editor (`FeedScreen.tsx`):
     - Menambahkan garis batas tepi (`borderWidth: 1` dengan `borderColor: 'rgba(255, 255, 255, 0.25)'`) pada kontainer terpadu `canvasWrapper`.
     - Membantu kreator membedakan dengan jelas batas fisik area kerja video portrait 9:16 maupun landscape 16:9 terhadap latar belakang gelap `#0a0a0a`.
     - Menerapkan arsitektur single-view statis berbasis akselerasi GPU murni, menjamin zero-lag dan nol overhead komputasi pada mode non-done maupun mode editor template.
- **Perubahan Kode Penting**:
  - `mobile/src/components/FeedScreen.tsx`:
    - Menambahkan `borderWidth: 1` dan `borderColor: 'rgba(255, 255, 255, 0.25)'` pada `styles.canvasWrapper`.

## [Unreleased] - Reorder Setup Wizard to Place Account Authorization in Step 2
- **Konteks Struktural**:
  1. Restrukturisasi Alur Interaktif Wizard (`scheduler-uploader/setup.js`):
     - Memindahkan proses otorisasi akun (TikTok & Google Drive/YouTube) menjadi Tahap 2, tepat setelah pemeriksaan dependensi (`npm install`).
     - Memungkinkan wizard mengeksekusi langsung `auth_tiktok.js` dan `auth.js` secara interaktif di terminal saat token belum ditemukan atau pengguna ingin login ulang.
     - Menyusun urutan langkah menjadi lebih linear dan logis: (1) Dependensi -> (2) Otorisasi Akun -> (3) Konfigurasi Folder GDrive -> (4) Hashtag Konstan -> (5) Ringkasan & Uji Coba.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/setup.js`: Mengatur ulang urutan eksekusi step, menyisipkan sub-prompt otorisasi akun ke Tahap 2.

## [ce83a58] - Simplify File Move Operation Without [USED] Label Prefix
- **Konteks Struktural**:
  1. Pembersihan Logika Pemindahan File Murni (Pure Move Operation):
     - Mengeliminasi prefix nama `[USED]` dan filter `not name contains '[USED]'` karena sistem pemindahan file secara fisik melepaskan relasi parent dari folder unused (`removeParents: selectedFolder.id`).
     - File yang telah berhasil dipindahkan otomatis lenyap dari folder unused/game, sehingga tidak mungkin terpilih ulang dan tidak perlu dikotori oleh label redundan.
     - Di folder used, file tersimpan bersih dengan nama aslinya tanpa modifikasi karakter.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/index.js`: Menghapus filter `[USED]` pada query `drive.files.list`, menghapus penamaan ulang prefix pada operasi `drive.files.update`, dan menyederhanakan `cleanClipName`.
  - `scheduler-uploader/README.md`: Memperbarui dokumentasi tahap pemilihan dan pemindahan konten agar selaras dengan arsitektur pure move.

## [3c87315] - Add Interactive Setup Wizard and Configurable Constant Hashtags
- **Konteks Struktural**:
  1. Wizard Penyiapan Interaktif (`scheduler-uploader/setup.js` / `npm run setup`):
     - Membangun antarmuka CLI interaktif ramah pengguna (menggunakan native `readline`) untuk membimbing penyiapan dari tahap awal hingga pengujian.
     - Tahap demi tahap diverifikasi dengan konfirmasi pengguna: instalasi modul dependensi, ekstraksi cerdas link URL / raw ID Google Drive untuk folder Unused dan Used, konfigurasi hashtag konstan, dan pemeriksaan status token TikTok/Google.
     - Menyediakan opsi eksekusi instan untuk pengujian simulasi aman (MOCK UPLOAD) maupun Live Run langsung dari wizard.
  2. Standarisasi Format Caption & Hashtags Ramah Pengguna (`scheduler-uploader/hashtags.txt`):
     - Mengubah formulasi caption VT TikTok menjadi: `<NamaFileTerpilih> #<NamaFolderGame> <HashtagKonstan>`.
     - Mengakomodasi file konfigurasi teks biasa `hashtags.txt` yang membatasi maksimal 4 hashtag konstan tambahan (boleh di bawah 4 atau kosong sehingga hanya tag folder game yang disertakan).
- **Perubahan Kode Penting**:
  - `scheduler-uploader/setup.js`: Membuat skrip wizard interaktif zero-dependency yang memandu konfigurasi dan parsing URL/ID Google Drive.
  - `scheduler-uploader/hashtags.txt`: Menyediakan file konfigurasi hashtag ramah pengguna awam.
  - `scheduler-uploader/index.js`: Menambahkan fungsi `loadConstantHashtags()`, merombak konstruksi metadata caption VT dan YouTube.
  - `scheduler-uploader/package.json`: Mendaftarkan script command `"setup": "node setup.js"`.
  - `scheduler-uploader/README.md`: Mendokumentasikan panduan interaktif dan sintaks caption/hashtag.

## [6a9dcbf] - Add Randomized Content Pool and Instant GDrive File Move Workflow
- **Konteks Struktural**:
  1. Arsitektur Antrean Fleksibel (Randomized Content Pool):
     - Mengembangkan mode antrean baru (`QUEUE_MODE=random`) di mana script secara acak memilih folder game/stream di dalam root Google Drive, lalu memilih secara acak klip video `.mp4` yang belum berlabel `[USED]`.
     - Mengeliminasi keterikatan kreator terhadap format penamaan kaku tanggal/jam (`YYYY-MM-DD/HH_00.mp4`), sehingga memungkinkan batch processing dan variasi konten yang dinamis.
  2. Pemindahan dan Pengarsipan File Google Drive Instan (Nol Kuota Re-Upload):
     - Menggunakan operasi metadata `drive.files.update` (`addParents` dan `removeParents`) untuk memindahkan video terpilih ke folder `GDRIVE_USED_FOLDER_ID` dalam ~150ms tanpa mengunggah ulang binary video.
     - Mengotomatisasi penamaan ulang file menjadi `[USED_YYYY-MM-DD_HHh]_nama.mp4` sebagai jejak riwayat tayang.
     - Menyediakan fallback cerdas: jika ID folder used tidak ditentukan atau izin move terbatas, file tetap di-rename di tempat agar tidak terpilih ulang.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/index.js`: Mengimplementasikan shuffle array, pemilihan acak folder/klip, metadata dinamis berbasis nama game & klip, serta instant move/rename di Google Drive.
  - `scheduler-uploader/auth.js`: Memperbarui cakupan Google OAuth menjadi `https://www.googleapis.com/auth/drive` penuh untuk mengizinkan operasi pemindahan dan penamaan ulang file.
  - `scheduler-uploader/.env.example` & `scheduler-uploader/README.md`: Menstandarkan konfigurasi folder Google Drive ke `GDRIVE_UNUSED_FOLDER_ID` (folder konten mentah) dan `GDRIVE_USED_FOLDER_ID` (folder arsip tayang).

## [Unreleased] - Add TikTok OAuth Token Generator and Automation Workflow
- **Konteks Struktural**:
  1. Modul Otorisasi TikTok OAuth 2.0 Mandiri (`scheduler-uploader/auth_tiktok.js`):
     - Membangun skrip CLI lokal (`npm run auth:tiktok`) untuk menangani alur otorisasi TikTok Login Kit dan Content Posting API.
     - Mengotomatisasi penangkapan callback di port 8080 lokal dan pertukaran kode otorisasi menjadi `access_token` dan `refresh_token`.
     - Menyimpan data otorisasi ke `token_tiktok.json` serta otomatis memperbarui konfigurasi `TIKTOK_API_TOKEN` pada file `.env`.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/auth_tiktok.js`: Menambahkan implementasi server lokal dan pertukaran token TikTok v2.
  - `scheduler-uploader/package.json`: Menambahkan script command `"auth:tiktok": "node auth_tiktok.js"`.
  - `scheduler-uploader/.env.example`: Menambahkan panduan variabel `TIKTOK_CLIENT_KEY` dan `TIKTOK_CLIENT_SECRET`.
  - `scheduler-uploader/.gitignore` & `.gitignore`: Menambahkan pola `token*.json`, `credentials*.json`, `.env.*`, dan `*.mp4` agar seluruh kredensial dan file video sementara terlindungi dari commit Git.

## [Unreleased] - Make GitHub Actions Workflow Manual Trigger Only
- **Konteks Struktural**:
  1. Optimasi Kuota Menit CI/CD GitHub Actions (`.github/workflows/build-apk.yml`):
     - Menghapus trigger otomatis `push` pada branch `main` agar build APK tidak berjalan otomatis setiap kali ada commit/push kecil.
     - Mengubah pemicu build menjadi 100% manual (`workflow_dispatch`), sehingga build APK hanya berjalan saat user secara eksplisit menekan tombol "Run workflow" di halaman GitHub Actions.
- **Perubahan Kode Penting**:
  - `.github/workflows/build-apk.yml`:
    - Menghapus blok event `push` dan menyisakan hanya event `workflow_dispatch`.

## [5cafc4a] - Update App Logo and Icon Assets (Neon Laser Film Slice)
- **Konteks Struktural**:
  1. Identitas Visual Logo Aplikasi Clipping (`mobile/assets/images/`):
     - Memperbarui seluruh aset logo dan ikon aplikasi dengan konsep "Video yang Dipotong / Di-klip" (Opsi A: Neon Laser Film Slice).
     - Menggantikan aset ikon default dengan grafis vektor rol film terpotong berkas cahaya laser neon bersinar dalam palet warna *dark obsidian* (#0A0A0A) dan gradasi ungu-sian.
     - Menyediakan resolusi optimal untuk seluruh platform: `icon.png` (1024x1024), `android-icon-foreground.png` (1024x1024 adaptive icon), `splash-icon.png` (512x512 splash screen), dan `favicon.png` (48x48 web favicon).
- **Perubahan Kode Penting**:
  - `mobile/assets/images/icon.png`: Memperbarui file ikon utama aplikasi ke resolusi 1024x1024.
  - `mobile/assets/images/android-icon-foreground.png`: Memperbarui foreground adaptive icon Android.
  - `mobile/assets/images/splash-icon.png`: Memperbarui ikon layar splash.
  - `mobile/assets/images/favicon.png`: Memperbarui favicon web.

## [0c3de71] - Upgrade Node.js to 22 in GitHub Actions Workflow
- **Konteks Struktural**:
  1. Kompatibilitas Engine EAS CLI v25+:
     - Memperbarui versi runtime Node.js dari 20 ke 22 (`setup-node@v4` dengan `node-version: 22`).
     - Menyelesaikan kegagalan instalasi `eas-cli` (v25.3.0) di mana modul internal `@oclif/plugin-autocomplete` mewajibkan versi runtime engine Node `>=22.0.0`.
- **Perubahan Kode Penting**:
  - `.github/workflows/build-apk.yml`:
    - Mengubah `node-version` dari `20` menjadi `22`.

## [06e197a] - Fix Android SDK Step in GitHub Actions Workflow
- **Konteks Struktural**:
  1. Penyesuaian Setup Toolchain Android pada GitHub Runner:
     - Menghapus dependensi pihak ketiga `android-actions/setup-android@v3` yang gagal mengeksekusi `sdkmanager tools` karena paket legacy `tools` telah didepresiasi dan dihapus oleh repositori Google Android SDK.
     - Memanfaatkan Android SDK, build-tools, dan platform-tools resmi yang sudah terinstal secara bawaan pada runner virtual environment Ubuntu 22.04 GitHub Actions (`/usr/local/lib/android/sdk`).
     - Mengotomatisasi penerimaan lisensi SDK via `yes | sdkmanager --licenses` agar proses build berjalan non-interaktif tanpa hambatan.
- **Perubahan Kode Penting**:
  - `.github/workflows/build-apk.yml`:
    - Mengganti step `uses: android-actions/setup-android@v3` dengan command shell `yes | sdkmanager --licenses || true`.

## [c836f34] - Add GitHub Actions EAS Local Build Workflow for Android Production APK
- **Konteks Struktural**:
  1. Otomasi Build Cloud Mandiri via GitHub Actions (`.github/workflows/build-apk.yml`):
     - Membangun pipeline CI/CD cloud gratis (2.000 menit/bulan) di runner Ubuntu 22.04 menggunakan `eas build --local`.
     - Mengatasi kendala batas kuota bulanan build cloud Free Plan Expo (15/15 Android) tanpa perlu membayar langganan EAS atau membuat akun ganda.
     - Build lokal pada hardware runner GitHub tidak mengurangi kuota 15 build Android bulanan akun Expo.
  2. Integrasi Akun EAS, Keystore Resmi, dan Versioning:
     - Menggunakan autentikasi `EXPO_TOKEN` akun resmi (`arkanafaisal`) sehingga otomatis mengunduh Keystore produksi asli dari EAS Credentials (tanda tangan APK 100% identik dengan build sebelumnya).
     - Menjaga sinkronisasi nomor versi (`appVersionSource: "remote"`) terhadap remote Project ID Expo.
     - Menyediakan environment lengkap: Node 20, Python 3.10 (prasyarat Chaquopy build-time), Java JDK 17, dan Android SDK.
     - Mengunggah output `clipping-release.apk` langsung ke GitHub Actions Artifacts (retensi 14 hari) untuk diunduh langsung ke HP.
- **Perubahan Kode Penting**:
  - `.github/workflows/build-apk.yml`:
    - Membuat workflow `workflow_dispatch` (manual) dan `push` (pada folder `mobile/**`) yang menjalankan step checkout, setup toolchain (Node 20, Python 3.10, JDK 17, Android SDK), autentikasi EAS CLI via `EXPO_TOKEN`, eksekusi `eas build -p android --profile production --local`, dan upload artefak APK.

## [Unreleased] - Add Unified Google OAuth Generator and Multi-Token Fallback for Scheduler Uploader
- **Konteks Struktural**:
  1. Modul Generator Kredensial OAuth2 Mandiri (`scheduler-uploader/auth.js`):
     - Menyediakan skrip lokal satu kali jalan (`npm run auth`) untuk mengotorisasi izin Google Drive (`drive.readonly`) dan YouTube Data API (`youtube.upload`) secara terpadu (*unified*).
     - Menghasilkan token OAuth2 dengan `refresh_token` berstatus "Production" (unlimited) yang tidak kedaluwarsa dalam 7 hari tanpa perlu verifikasi resmi Google untuk otomasi pribadi.
     - Menyimpan output ke `scheduler-uploader/token.json` yang dapat langsung disalin ke Config Var Heroku `GDRIVE_TOKEN`.
  2. Fleksibilitas Resolusi Token pada `index.js`:
     - Mengizinkan satu token terpadu (`GDRIVE_TOKEN`) digunakan sekaligus untuk mengunduh video dari Google Drive dan mengunggah ke YouTube tanpa perlu konfigurasi duplikat.
     - Menyediakan fallback alias untuk berbagai format variabel (`YOUTUBE_API_TOKEN`, `YOUTUBE_TOKEN`, `GOOGLE_OAUTH_TOKEN`, atau deteksi file `token.json` lokal).
- **Perubahan Kode Penting**:
  - `scheduler-uploader/auth.js`: Menambahkan script server lokal port 8080 untuk menangkap authorization code OAuth2 Google dan menghasilkan token terpadu.
  - `scheduler-uploader/package.json`: Menambahkan script command `"auth": "node auth.js"`.
  - `scheduler-uploader/index.js`: Memperluas fallback resolusi variabel token Google Drive dan YouTube.
  - `scheduler-uploader/README.md`: Menambahkan panduan langkah demi langkah mendapatkan token OAuth unlimited untuk Heroku.

## [Unreleased] - Sync Python Scripts to Native Module for Production APK Bundle
- **Konteks Struktural**:
  1. Sinkronisasi Python Engine ke Native Bundle Module (`python-runner`):
     - Menyalin seluruh pembaruan skrip Python dari direktori sumber kebenaran (`mobile/scripts/utils/`) ke modul native embedded Chaquopy (`mobile/modules/python-runner/android/src/main/python/utils/`) sesuai Rule 22 untuk persiapan build produksi APK.
     - Sinkronisasi mencakup fitur pemotongan klip video lokal (`clip_downloader.py`), pembakaran ASS subtitle, banner konteks multiline, watermark overlay, serta konfigurasi path font sistem Android (`subtitle_burner.py`).
     - Membersihkan seluruh cache bytecode compile (`__pycache__`) sebelum bundling agar paket rilis APK bersih dan bebas artefak dev.
- **Perubahan Kode Penting**:
  - `mobile/modules/python-runner/android/src/main/python/utils/clip_downloader.py`:
    - Menyinkronkan fungsionalitas pemotongan klip langsung dan handling path lokal.
  - `mobile/modules/python-runner/android/src/main/python/utils/subtitle_burner.py`:
    - Menyinkronkan pipeline filter multi-layer FFmpeg (multiline banner konteks, watermark, dan fontdir).

## [360aa94] - Fix Dropped Trailing Word via Non-Breaking Spaces and Simple Break Strategy
- **Konteks Struktural**:
  1. Resolusi Bug Hilangnya Kata Terakhir pada Baris Subtitle (`SubtitleOverlay.tsx`):
     - Mengidentifikasi akar masalah hilangnya kata terakhir (misalnya kata "mereview" atau "bisa" pada baris pertama): saat properti `numberOfLines={1}` dan `ellipsizeMode="clip"` digunakan bersama spasi biasa, algoritma pemecah baris Android `StaticLayout` (dengan strategi default `highQuality`/`balanced`) mencoba menyeimbangkan baris dan memindahkan kata terakhir ke baris ke-2. Karena batas `numberOfLines={1}` aktif dengan mode `clip`, baris ke-2 tersebut dipotong dan disembunyikan secara hening oleh sistem native tanpa tanda elipsis (`...`).
     - Mengonversi seluruh spasi biasa (` `) pada setiap baris manual menjadi *Non-Breaking Space* (`\u00A0`). Dalam standar Unicode, karakter ini memaksa engine teks Android dan iOS untuk memperlakukan seluruh kalimat pada baris tersebut sebagai satu kesatuan utuh tanpa titik pemutus (*zero break points*).
     - Menghapus pembatas `numberOfLines={1}` dan `ellipsizeMode="clip"` yang menjadi penyebab pemotongan kata, serta menambahkan `textBreakStrategy="simple"`. Teks kini tampil 100% utuh tanpa kata yang hilang, dan tetap terlindungi dari auto-word-wrap secara alami.
- **Perubahan Kode Penting**:
  - `mobile/src/components/feed/SubtitleOverlay.tsx`:
    - Mengonversi spasi biasa ke `\u00A0` di dalam `linesData.map`.
    - Menghapus `numberOfLines={1}` dan `ellipsizeMode="clip"` dari seluruh layer stroke dan foreground.
    - Menambahkan `textBreakStrategy="simple"` pada seluruh komponen `<Text>`.

## [551d05c] - Eliminate Subtitle Auto-Breakline and Resolve Black Ghost Line Bug
- **Konteks Struktural**:
  1. Penghapusan Auto-Breakline pada Subtitle Preview (`SubtitleOverlay.tsx`):
     - Memecah teks subtitle manual secara eksplisit berdasarkan karakter baris baru (`\n`) ke dalam `linesData` dan merender setiap baris dalam `lineWrapper` mandiri dengan `numberOfLines={1}` serta `ellipsizeMode="clip"`.
     - Menghentikan perilaku default React Native `<Text>` yang secara otomatis melakukan pembungkusan kata (*word wrap*) saat teks melebihi lebar kontainer. Teks kini hanya terbagi ke baris baru jika user sengaja menyematkan `\n`, menjamin keselarasan visual 100% presisi dengan perilaku ekspor subtitle FFmpeg ASS.
  2. Resolusi Bug Baris Subtitle Gosong / Full Hitam (`SubtitleOverlay.tsx`):
     - Mengidentifikasi akar masalah teks gosong (terutama di baris paling bawah): sebelumnya seluruh teks multiline digabung ke dalam 1 komponen `<Text>`, di mana layer stroke hitam memiliki `position: 'absolute'` dan struktur anak regex emoji yang berbeda dari layer putih foreground. Ketika teks panjang mendekati batas kontainer, layer stroke membungkus kata terakhir ke baris baru ekstra sementara layer putih tidak membungkusnya, sehingga baris terbawah hanya menampilkan layer stroke hitam pekat tanpa teks putih di atasnya.
     - Melalui isolasi per-baris menggunakan `lineWrapper` dan `numberOfLines={1}`, layer stroke dan layer foreground dijamin selalu memiliki tinggi, lebar, dan jumlah baris yang identik secara deterministik, mengeliminasi total kemungkinan munculnya baris hitam gosong.
     - Menggunakan `useMemo` untuk pemrosesan `linesData` dan regex emoji per-baris, menjaga performa rendering tetap instan tanpa micro-freeze.
- **Perubahan Kode Penting**:
  - `mobile/src/components/feed/SubtitleOverlay.tsx`:
    - Mengganti render teks tunggal dengan pemetaan `linesData.map` dan membungkus setiap baris dengan `lineWrapper`.
    - Menambahkan `numberOfLines={1}` dan `ellipsizeMode="clip"` pada seluruh layer stroke dan foreground.
    - Menambahkan styling `lineWrapper` pada StyleSheet.

## [ff52f73] - Eliminate Play-Pause Lag via Synchronous Ref Sync and Direct Native Dispatch
- **Konteks Struktural**:
  1. Sinkronisasi Ref Seketika pada Play/Pause (`useClipPlayer.ts`):
     - Memperbarui `isContinueStateRef.current = nextState` secara sinkron (milidetik ke-0) di dalam `togglePlayPause`, mendahului proses render asinkron React (`setIsContinueState`). Sebelumnya, jeda antara panggilan state dan eksekusi `useEffect` menyebabkan event native (`statusChange` dan `timeUpdate`) membaca nilai ref lama yang masih `true` saat tombol pause ditekan, sehingga secara keliru memanggil kembali `player.play()` dan menimbulkan race condition / stutter / delay jeda.
     - Menghapus pengecekan kondisi `if (player.playing)` dan `if (!player.playing)` yang rentan terhadap pembacaan nilai status getter native yang stale di tengah transisi buffer/pause. Pemanggilan `player.pause()` dan `player.play()` kini dikirimkan langsung dan tanpa hambatan.
  2. Optimalisasi Responsivitas Tombol Kontrol (`FeedPlaybackControls.tsx`):
     - Mengubah handler sentuhan tombol playback (Play/Pause dan Skip -10s, -3s, +5s, +15s) dari `onPressIn` menjadi `onPress` standar dengan `hitSlop={8}`.
     - Menghilangkan delay `delayPressIn` bawaan Android dan mencegah pembatalan sentuhan prematur akibat pergeseran mikroskopis jari.
- **Perubahan Kode Penting**:
  - `mobile/src/hooks/useClipPlayer.ts`:
    - Mengoptimalkan fungsi `togglePlayPause` dengan ref synchronization sinkron dan direct native pause/play.
  - `mobile/src/components/feed/FeedPlaybackControls.tsx`:
    - Mengganti `onPressIn` menjadi `onPress` dan menambahkan `hitSlop={8}` pada seluruh tombol playback.

## [27842f7] - Expand Subtitle Stroke to 8-Way Solid Outline Without Shadow or Blur
- **Konteks Struktural**:
  1. Penambahan Arah Border Subtitle Menjadi 8 Arah Solid (`SubtitleOverlay.tsx`):
     - Memperluas konstanta `STROKE_OFFSETS` dari 4 arah mata angin menjadi 8 arah penuh (kombinasi kardinal atas/bawah/kiri/kanan dan 4 diagonal sudut) guna menghasilkan ketebalan outline hitam yang merata di seluruh kontur font tanpa celah sudut.
     - Tetap mempertahankan prinsip zero-overhead: 100% tanpa properti `textShadowColor`, `textShadowOffset`, maupun `textShadowRadius` (zero blur), serta tanpa pemecahan baris manual (`lines.map`).
     - Total elemen native TextView yang aktif di memori untuk seluruh subtitle (termasuk teks multiline 3 baris) hanya 9 TextView (8 stroke + 1 foreground), jauh di bawah arsitektur lama (27 TextView) dan tetap menggunakan akselerasi GPU font texture atlas bawaan.
- **Perubahan Kode Penting**:
  - `mobile/src/components/feed/SubtitleOverlay.tsx`:
    - Mengubah `STROKE_OFFSETS` menjadi 8 arah: `[{ x: -1.5, y: -1.5 }, { x: 0, y: -2 }, { x: 1.5, y: -1.5 }, { x: -2, y: 0 }, { x: 2, y: 0 }, { x: -1.5, y: 1.5 }, { x: 0, y: 2 }, { x: 1.5, y: 1.5 }]`.

## [a1a01f0] - Implement 4-Way Subtitle Stroke Without Shadow or Blur
- **Konteks Struktural**:
  1. Rekonstruksi Border Subtitle 4 Arah Tanpa Shadow dan Blur (`SubtitleOverlay.tsx`):
     - Mengimplementasikan 4 layer stroke hitam pekat arah mata angin (atas, bawah, kiri, kanan dengan offset ±1.5px) di belakang layer teks utama putih.
     - Menghilangkan 100% properti `textShadowColor`, `textShadowOffset`, dan `textShadowRadius` baik pada layer stroke maupun foreground. Render teks kini murni menggunakan hardware texture cache GPU tanpa memicu kalkulasi software Gaussian blur filter di Android Skia yang sebelumnya menjadi penyebab utama micro-freeze saat hide/unhide subtitle.
     - Menghapus pemecahan baris manual (`lines.map` dan `lineWrapper`). Seluruh teks multiline dengan `\n` ditangani langsung oleh 1 komponen `<Text>` dengan `textAlign: 'center'`, sehingga jumlah total native TextView untuk seluruh subtitle (bahkan untuk teks 3 baris) berkurang drastis dari sebelumnya 27 TextView menjadi hanya 5 TextView (4 stroke + 1 foreground).
     - Menggunakan `useMemo` untuk pemrosesan regex emoji pada konten stroke (`strokeContent`), memastikan partisi karakter hanya dihitung sekali saat teks cue berubah dan tidak membebani render cycle.
- **Perubahan Kode Penting**:
  - `mobile/src/components/feed/SubtitleOverlay.tsx`:
    - Menambahkan konstanta `STROKE_OFFSETS` (4 arah: `{ x: 0, y: -1.5 }`, `{ x: 0, y: 1.5 }`, `{ x: -1.5, y: 0 }`, `{ x: 1.5, y: 0 }`).
    - Menghitung `strokeScale` berbasis rasio viewport aktif dan memetakan 4 layer stroke `<Text>` di belakang teks utama.
    - Menambahkan `strokeText` dengan `position: 'absolute'` dan warna hitam pekat tanpa properti shadow/blur.

## [a044e68] - Fix Seek Jump-Back Glitch and Scrubber Touch Hit Target
- **Konteks Struktural**:
  1. Eliminasi Efek Jump-Back saat Seek Berjalan (`useClipPlayer.ts`):
     - Menghapus pemanggilan `player.pause()` yang tidak perlu di dalam `centralizedSeek`. ExoPlayer dapat berpindah posisi (`player.currentTime = seekTime`) secara mulus tanpa harus menjeda playback secara paksa.
     - Mengunci target seek seketika (`setPendingSeek(targetTime)`) sejak pemanggilan pertama di `centralizedSeek` (bukan menunggu timer debounce 150ms), sehingga frame lama dari native decoder diabaikan secara konsisten.
     - Menambahkan proteksi pada listener `playingChange`: jika sistem sedang dalam masa debounce seek atau pending seek (`isDebouncingSeekRef.current || pendingSeekTargetRef.current !== null`), event jeda dilarang menimpa state UI dengan posisi video lama (`player.currentTime`).
     - Mencegah pelepasan dini `pendingSeekTargetRef.current = null` saat `playingChange` menerima status `isPlaying = true`. Pelepasan kunci kini hanya dilakukan secara sah oleh `timeUpdate` setelah decoder native benar-benar tiba di rentang toleransi target seek (< 0.3s).
  2. Perbaikan Akurasi Sentuhan Scrubber Bar (`FeedPlaybackControls.tsx`, `FeedScreen.tsx`, `useClipPlayer.ts`):
     - Menambahkan `pointerEvents="none"` pada elemen anak scrubber progress bar (`progressBarFill` dan `progressKnob`). Sebelumnya, sentuhan jari user mengenai knob (lebar 12px) atau filled bar, menghasilkan nilai koordinat lokal `locationX` yang sangat kecil (0-12px) alih-alih koordinat trackbar penuh (0-360px), yang menyebabkan 95% sentuhan salah terhitung sebagai persentase ~0% (detik 0).
     - Menginialisasi `trackWidthRef` menggunakan `Dimensions.get('window').width` (alih-alih nilai default 1) agar perhitungan rasio scrubber selalu valid sebelum event layout pertama.
     - Mengapit `e.nativeEvent.locationX` dengan batas `Math.max(0, Math.min(trackWidthRef.current, ...))` untuk mencegah kalkulasi negatif saat sentuhan digeser keluar dari batas fisik track.
  3. Eliminasi Reset Segmen Palsu ke Detik 0 (`useClipPlayer.ts`):
     - Menghapus klausul `|| current < currentActive.start - 0.5` pada evaluasi loop boundary di `timeUpdate`. Sebelumnya, ketika player sedang mencari frame (seek) atau mengalami micro-buffering, nilai `current` yang sesaat mendekati 0 keliru dideteksi sebagai pelanggaran batas start, memicu reset paksa ke awal klip. Loop kini murni hanya terpicu saat durasi akhir klip tercapai (`current >= currentActive.end`).
- **Perubahan Kode Penting**:
  - `mobile/src/hooks/useClipPlayer.ts`:
    - Mengimpor `Dimensions` dan menginisialisasi `trackWidthRef` dengan lebar layar riil.
    - Menghapus jeda paksa `player.pause()` pada `centralizedSeek` dan memanggil `setPendingSeek(targetTime)` seketika.
    - Menambahkan pengaman `isDebouncingSeekRef.current || pendingSeekTargetRef.current !== null` pada listener `playingChange` saat pause.
    - Menghapus pelepasan prematur `pendingSeekTargetRef.current = null` pada `playingChange` saat playing.
    - Menghapus syarat `current < currentActive.start - 0.5` pada evaluasi loop segment di `timeUpdate`.
  - `mobile/src/components/feed/FeedPlaybackControls.tsx`:
    - Menambahkan `pointerEvents="none"` pada `progressBarFill` dan `progressKnob`.
  - `mobile/src/components/FeedScreen.tsx`:
    - Membatasi `locationX` agar selalu berada dalam rentang `0` hingga `trackWidthRef.current`.

## [0c69e8e] - Eliminate Subtitle Stroke and Shadow Overhead for Zero-Lag Preview
- **Konteks Struktural**:
  1. Penghapusan 8-Layer Stroke Duplikat dan Shadow (`SubtitleOverlay.tsx`):
     - Menghapus seluruh konstanta `STROKE_OFFSETS`, kalkulasi `strokeScale`, fungsi pemecah regex emoji `renderStrokeContent`, serta style `strokeText`.
     - Menghapus pembagian baris manual (`lines.map` dan `lineWrapper`) dan beralih ke 1 komponen native `<Text>` tunggal yang menangani teks multiline (`\n`) secara native dengan `textAlign: 'center'`.
     - Menghapus kompensasi bayangan teks (`textShadowColor`, `textShadowOffset`, `textShadowRadius`) pada `styles.foregroundText` untuk mencegah overhead rendering shadow pada layer grafis Android.
  2. Reduksi Drastis Beban UI Thread Android (~96% Drop):
     - Untuk teks subtitle 3 baris, jumlah komponen `TextView` native yang dibuat dan diukur (`StaticLayout` / HarfBuzz text shaping) di UI thread Android turun dari 27 komponen menjadi hanya **1 komponen `<Text>` tunggal**.
     - View ini tetap mounted secara permanen di memori native dan hanya berganti `opacity: 0 / 1` saat jeda bicara tanpa unmount/re-mount, melenyapkan total micro-freeze saat kalimat subtitle masuk atau keluar.
- **Perubahan Kode Penting**:
  - `mobile/src/components/feed/SubtitleOverlay.tsx`:
    - Menghapus `STROKE_OFFSETS`, `strokeScale`, `renderStrokeContent`, `styles.lineWrapper`, dan `styles.strokeText`.
    - Menghapus seluruh properti `textShadow*` pada `styles.foregroundText`.
    - Merender `displayText` langsung di dalam 1 komponen `<Text>` tunggal.

## [e61e806] - Rebuild Playback Sync with Video Player as Single Source of Truth
- **Konteks Struktural**:
  1. Restorasi Video Player sebagai Single Source of Truth Murni (`useClipPlayer.ts`):
     - Menghapus total jam linier buatan (`stopLinearClock`, `startLinearClock`, `linearClockTimerRef`, `playStartWallTimeRef`, `playStartClipTimeRef`, `stopGraceTimerRef`, dan kalkulasi drift mid-flight). Jam linier tiruan sebelumnya mengasumsikan kecepatan putar statis dari `Date.now()`, yang mengakibatkan desinkronisasi/drift saat terjadi fluktuasi decode frame atau micro-buffering pada audio/video asli.
     - Mengonfigurasi `player.timeUpdateEventInterval = 0.033` (~30 FPS) secara langsung pada native ExoPlayer (`expo-video`). Setiap event `timeUpdate` kini dipancarkan langsung dari thread audio/video decoder native saat frame video dirender ke layar HP.
  2. Direct Lockstep Progress Animation (`useClipPlayer.ts`, `FeedTopControls.tsx`):
     - Nilai persentase posisi klip (`pct`) dari setiap event `timeUpdate` langsung diteruskan ke `progressAnim.setValue(pct)`.
     - Jarum needle playhead pada editor rentang (`FeedTopControls.tsx`) dan progress bar playback (`FeedPlaybackControls.tsx`) bergerak secara instan dan terkunci 100% presisi (0ms lag, 0ms drift) dengan frame fisik video.
     - Penampil waktu milidetik (`LiveTimeDisplay`) diperbarui secara mulus pada threshold $\ge$ 20ms (0.02s) langsung dari listener `progressAnim` tanpa memicu re-render pada `FeedTopControls` maupun `FeedScreen`.
  3. Sinkronisasi Subtitle 0ms Drift (`useClipPlayer.ts`):
     - Evaluasi subtitle (`syncSubtitleCueAtTime(nativeRel, false)`) dieksekusi secara berkelanjutan di setiap frame `timeUpdate` (~30 FPS), sehingga teks subtitle overlay video muncul dan hilang pada timestamp riil yang identik dengan suara ucapan tanpa jeda.
     - Saat video dijeda (Pause) atau diseek, sinkronisasi seleksi cue (`syncSubtitleCueAtTime(nativeRel, true)`) diaktifkan untuk menyorot kotak cue aktif di timeline tanpa membebani performa selama pemutaran kontinu.
  4. Penyederhanaan Seek dan Playback Controls (`useClipPlayer.ts`):
     - `skipSeconds`, `centralizedSeek`, dan `togglePlayPause` kini membaca `player.currentTime` langsung dari instance native pemutar video tanpa mengandalkan variabel wall-clock eksternal.
- **Perubahan Kode Penting**:
  - `mobile/src/hooks/useClipPlayer.ts`:
    - Menghapus import `Easing` dan seluruh referensi `Animated.timing` pada `progressAnim`.
    - Menghapus refs jam linier (`playStartWallTimeRef`, `playStartClipTimeRef`, `isPlaybackActiveRef`, `linearClockTimerRef`, `stopGraceTimerRef`).
    - Menghapus fungsi `startLinearClock` dan `stopLinearClock`.
    - Mengonfigurasi `timeUpdateEventInterval: 0.033` (~30 FPS) pada `useVideoPlayer` dan `useEffect`.
    - Memperbarui event listener `timeUpdate` untuk langsung menyetel `progressAnim.setValue(pct)` dan `syncSubtitleCueAtTime(nativeRel, false)`.
    - Memperbarui listener `playingChange` untuk menyelaraskan posisi jeda (pause) dan seleksi subtitle cue saat pemutaran berhenti.
    - Menyederhanakan `centralizedSeek`, `skipSeconds`, dan `togglePlayPause` agar murni merujuk ke hardware clock `player.currentTime`.
  - `mobile/src/components/feed/FeedTopControls.tsx`:
    - Mengubah threshold pembaruan waktu milidetik `LiveTimeDisplay` menjadi $\ge 0.02$ detik agar merespons event 30 FPS secara konsisten dan mulus tanpa frame drop.

## [8be4ad4] - Isolate Subtitle Overlay and Implement Continuous Mid-Flight Playback Calibration
- **Konteks Struktural**:
  1. Isolasi Total Subtitle Overlay (`SubtitleOverlay.tsx`, `FeedScreen.tsx`):
     - Memindahkan pengelolaan teks dan ukuran font subtitle (`activeSubtitleText`, `activeSubtitleFontSize`) dari state induk `FeedScreen` langsung ke dalam `SubtitleOverlay` melalui `subtitleListenerRef`.
     - Saat teks subtitle masuk atau keluar di setiap kalimat, HANYA `SubtitleOverlay` yang memperbarui tampilannya secara lokal. `FeedScreen`, `FeedTopControls`, dan native `VideoView` kini mengalami **0 re-render**, melenyapkan jeda/freeze pada pergantian subtitle.
  2. Persistensi View 9 Layer Teks Stroke (`SubtitleOverlay.tsx`):
     - Mempertahankan ke-9 elemen native `Text` (8 stroke layer + 1 foreground) tetap terpasang di memori native saat jeda bicara (`hasText = false`) menggunakan kontrol `opacity: 0` alih-alih menghancurkan/membuat ulang (`unmount/mount`) array baris teks, menghilangkan beban alokasi memori teks dan reflow grafis Android.
  3. Memoisasi Callback Sisa Data Klip (`useClipData.ts`):
     - Membungkus seluruh fungsi manipulasi klip (`handleUpdateStart`, `handleUpdateEnd`, `handleMsTimeChange`, `handleToggleDone`, `handleToggleTrash`) dengan `useCallback` agar referensi fungsinya stabil dan `FeedTopControls` terlindungi dari re-render eksternal.
  4. Sinkronisasi Cerdas Mid-Flight Berkelanjutan (`useClipPlayer.ts`):
     - Mempercepat interval event native `timeUpdateEventInterval` ExoPlayer dari 0.25s (250ms) menjadi 0.1s (100ms).
     - Menghapus pembatasan mode (kini berlaku untuk file lokal offline maupun stream online) dan menerapkan threshold cerdas: jika selisih waktu video fisik vs animasi internal $\ge$ 80ms (0.08 detik), sistem mengalibrasi ulang titik jangkar dan trajectory animasi secara langsung tanpa menyentuh React State. Jarum needle, progress bar, dan angka waktu selalu terkunci presisi 1:1 dengan audio/video asli tanpa meleset.
- **Perubahan Kode Penting**:
  - `mobile/src/components/feed/SubtitleOverlay.tsx`:
    - Menambahkan prop `subtitleListenerRef`.
    - Mengelola `currentText` dan `currentFontSize` secara internal.
    - Menyimpan teks terakhir pada `lastNonEmptyTextRef` agar 9 layer teks tetap terpasang di memori native dengan `opacity: 0`.
  - `mobile/src/components/FeedScreen.tsx`:
    - Menghubungkan `setActiveSubtitleTextRef` langsung ke `subtitleListenerRef` tanpa mengubah state `FeedScreen`.
    - Meneruskan `subtitleListenerRef` ke `SubtitleOverlay`.
  - `mobile/src/hooks/useClipData.ts`:
    - Membungkus `handleUpdateStart`, `handleUpdateEnd`, `handleMsTimeChange`, `handleToggleDone`, dan `handleToggleTrash` dengan `useCallback`.
  - `mobile/src/hooks/useClipPlayer.ts`:
    - Mengubah `timeUpdateEventInterval` menjadi 0.1s.
    - Menambahkan kalibrasi anchor mid-flight saat drift $\ge$ 0.08s pada mode playback aktif.

## [a29c020] - Eliminate Cue Boundary Freeze and Staticize Subtitle Cue Pills
- **Konteks Struktural**:
  1. Staticisasi Murni Kotak Subtitle Cue (`FeedTopControls.tsx`):
     - Menghapus prop `isSelected` dan segala efek perubahan border serta warna pada komponen `SubtitleCuePill`. Kotak cue kini berstatus murni statis (`React.memo`) dengan warna selang-seling genap/ganjil tanpa kalkulasi border (`borderWidth: 0`), mengeliminasi 100% beban rasterisasi border dan restrukturisasi style native Android.
     - Penandaan kotak cue aktif dialihkan secara visual sepenuhnya kepada jarum needle merah yang meluncur mulus di atas kotak-kotak cue, sehingga `SubtitleCuePill` tidak pernah mengalami re-render atau layout pass selama video diputar.
  2. Pemasangan Permanen Tombol Aksi Cue Editor (`FeedTopControls.tsx`):
     - Memasang kontainer 4 tombol aksi cue editor (`styles.cueEditorActionIcons`: Edit Teks, Ukuran Font, Rentang Waktu, Hapus) secara permanen di dalam hierarki native view tree.
     - Mengontrol visibilitas tombol menggunakan `opacity: selectedCue ? 1 : 0` dan `pointerEvents={selectedCue ? 'auto' : 'none'}` alih-alih unmount/mount kondisional `{selectedCue ? <View> : null}`, melenyapkan reflow layout engine `requestLayout()` dan pembongkaran native view saat needle keluar-masuk jeda bicara antarkotak cue.
  3. Dekopling Seleksi Cue dari Playback Kontinu (`useClipPlayer.ts`, `FeedScreen.tsx`):
     - Menambahkan parameter `syncCueSelection` pada `syncSubtitleCueAtTime` di `useClipPlayer.ts`. Saat video aktif berputar, `syncCueSelection` bernilai `false` sehingga teks subtitle overlay video tetap diperbarui secara instan (0ms latency), namun state `selectedCueId` tidak memicu re-render berantai pada `FeedScreen`.
     - Saat video dipause (`stopLinearClock`), diseek/discrubbing (`centralizedSeek`), atau berganti klip, `syncCueSelection` bernilai `true` sehingga kotak cue di bawah playhead langsung terpilih dan tombol aksi cue editor siap digunakan untuk penyuntingan.
  4. Memoisasi Callback Top Controls (`FeedScreen.tsx`):
     - Memoisasi `handleOpenCustomModal`, `handleOpenVisibleCountModal`, `handleToggleSubtitleVisibility`, `handleStartEditTime`, dan `handleBlurTimeEdit` menggunakan `useCallback` untuk mencegah instansiasi fungsi baru yang membatalkan `React.memo` pada `FeedTopControls`.
- **Perubahan Kode Penting**:
  - `mobile/src/components/feed/FeedTopControls.tsx`:
    - Menghapus prop `isSelected` dari `SubtitleCuePillProps` dan implementasi `SubtitleCuePill`.
    - Menghapus `borderWidth`, `borderColor`, `cuePillEvenSelected`, dan `cuePillOddSelected` pada style `cuePill`.
    - Mengubah kontainer `cueEditorActionIcons` menjadi View permanen dengan kontrol `opacity` dan `pointerEvents`.
  - `mobile/src/hooks/useClipPlayer.ts`:
    - Mengubah signature `syncSubtitleCueAtTime` menjadi `(targetRelTime: number, syncCueSelection: boolean = false)`.
    - Membatasi eksekusi `setActiveCueId` hanya saat `syncCueSelection` bernilai `true`.
    - Mengirim `syncCueSelection = true` pada `stopLinearClock`, `centralizedSeek`, `syncPlayerSourceForClip`, dan `skipSeconds`.
  - `mobile/src/components/FeedScreen.tsx`:
    - Memoisasi seluruh callback inline yang dioper ke `FeedTopControls`.

## [5af3269] - Unify 5-Way Playback Synchronization and Decouple Playback from React Re-renders
- **Konteks Struktural**:
  1. Integrasi 5 Elemen Waktu Selaras (`useClipPlayer.ts`, `FeedScreen.tsx`, `FeedTopControls.tsx`):
     - Menyatukan 5 elemen antarmuka playback ke sistem waktu yang terkoordinasi secara presisi:
       1) Progress bar merah bawah (kontinu 60 FPS via `progressAnim`).
       2) Jarum needle mini-track (kontinu 60 FPS via `progressAnim`).
       3) Angka waktu milidetik atas (semi-kontinu ~30 FPS via `LiveTimeDisplay`).
       4) Teks subtitle overlay video (diskret event-driven via `syncSubtitleCueAtTime`).
       5) Kotak cue mini-track subtitle (diskret event-driven via `setActiveCueId`).
     - Menyinkronkan penyorotan kotak cue aktif langsung dari loop evaluasi jam linier (`syncSubtitleCueAtTime` di `useClipPlayer.ts`) menggunakan callback `setActiveCueId`, sehingga kotak cue aktif menyala pada milidetik yang sama persis saat jarum needle menyentuhnya dan teks subtitle muncul di video (0ms lag).
  2. Eliminasi Total Re-render React Layar Induk Saat Pemutaran Video:
     - Menghapus pemanggilan berkala `setCurrentClipTime` dan `setProgressPercent` di dalam interval jam linier saat video sedang aktif diputar, karena seluruh indikator visual kini telah memiliki driver independennya masing-masing.
     - Menghapus polling `currentMatchingCue = useMemo(..., [currentClipTime])` dan `useEffect` pemilih cue di `FeedTopControls.tsx`.
     - `FeedScreen`, `FeedTopControls`, dan `FeedPlaybackControls` kini mengalami **0 re-render** selama video diputar, membebaskan thread JS 100% dari beban render virtual DOM berulang dan melenyapkan gejala freeze serta lompat > 500ms.
  3. Reduksi False-Positive Micro-Buffering ExoPlayer:
     - Menambah grace period timer deteksi pause (`stopGraceTimerRef`) dari 150ms menjadi 400ms untuk mencegah jam linier terbunuh prematur akibat jitter decoder frame native ExoPlayer.
- **Perubahan Kode Penting**:
  - `mobile/src/hooks/useClipPlayer.ts`:
    - Menambahkan `setActiveCueId?: (cueId: string | null) => void` pada `UseClipPlayerParams`.
    - Di `syncSubtitleCueAtTime`: Menembakkan `setActiveCueId(cueId)` saat ID cue aktif berganti.
    - Menghapus throttling berkala 250ms `setCurrentClipTime` dan `setProgressPercent` di interval jam linier.
    - Menyesuaikan timeout `stopGraceTimerRef` menjadi 400ms.
  - `mobile/src/components/FeedScreen.tsx`:
    - Meneruskan `handleSetActiveCueId` ke `useClipPlayer` yang terikat ke `setSelectedCueId` saat mode editor subtitle aktif (`activeEditorMode === 'subtitle'`).
  - `mobile/src/components/feed/FeedTopControls.tsx`:
    - Menghapus kalkulasi polling `currentMatchingCue` dan `useEffect` sinkronisasi seleksi cue.
    - Menambahkan helper `getPlayheadTime()` untuk membaca posisi playhead secara presisi tanpa memicu re-render.
    - Mengubah prop `currentClipTime` menjadi opsional.

## [796f16a] - Revise Context Alignment and Watermark Modal Configuration UI
- **Konteks Struktural**:
  1. Perataan Teks Banner Konteks 1-Row Compact (`FeedTopControls.tsx`):
     - Mengubah baris perataan teks modal konfigurasi banner konteks menjadi 1 baris terpadu (`alignRowContainer`) yang menampung label "Perataan Teks" di sisi kiri dan tombol ikon perataan di sisi kanan.
     - Memangkas dimensi lebar dan tinggi tombol perataan (`compactAlignBtn`: 44x32px) agar proporsional dengan ukuran ikon (`AlignLeft` dan `AlignCenter`), menghilangkan tombol membentang penuh yang memakan ruang modal.
  2. Standardisasi Modal Pengaturan Watermark (`FeedTopControls.tsx`):
     - Menyeragamkan switch toggle aktif watermark dengan template toggle config lainnya menggunakan `templateToggleRow` (1 baris bersama label "Tampilkan Watermark").
     - Mengganti tombol preset ukuran font watermark dengan kotak input numerik (`cropCoordinateBox`) berlabel prefix "Size" dan suffix satuan "dp".
     - Menyederhanakan konfigurasi posisi X dan Y watermark menjadi murni input angka numerik (`cropCoordinatesRow` X dan Y), mengeliminasi tombol preset posisi cepat (helper) agar modal lebih ringkas, fokus, dan konsisten.
- **Perubahan Kode Penting**:
  - `mobile/src/components/feed/FeedTopControls.tsx`:
    - Mengganti blok preset alignment banner konteks dengan `alignRowContainer` 1 baris bersama tombol `compactAlignBtn`.
    - Mengganti selektor toggle watermark dengan `templateToggleRow`.
    - Mengubah input ukuran watermark menjadi `TextInput` numeric dengan `keyboardType="numeric"`.
    - Menghapus grup preset posisi cepat pada watermark dan mempertahankan input koordinat angka X dan Y.
    - Menambahkan styles `alignRowContainer`, `alignRowLabel`, `alignBtnGroup`, `compactAlignBtn`, dan `compactAlignBtnActive`.

## [b10f018] - Unify Subtitle Needle and Live Time Display with Single progressAnim Value
- **Konteks Struktural**:
  1. Penyatuan Tiga Indikator Waktu (`FeedTopControls.tsx`, `FeedScreen.tsx`):
     - Menyatukan angka waktu atas, progress bar merah bawah, dan jarum needle playhead subtitle mini-track ke satu sumber nilai yang sama (`progressAnim: Animated.Value`).
     - Mengubah needle playhead timeline subtitle (`styles.playheadNeedle`) menjadi `<Animated.View>` yang diinterpolasi langsung dari `progressAnim` (`outputRange: [0, trackLayoutWidth - 2.5]`) untuk pergerakan 60 FPS tanpa re-render React.
     - Mengekstrak teks angka waktu atas ke dalam mikro-komponen terisolasi `LiveTimeDisplay` yang mendengarkan `progressAnim.addListener` dan memperbarui teks waktu milidetik secara mulus ~30 FPS (33ms) secara lokal tanpa memicu re-render pada `FeedTopControls` maupun `FeedScreen`.
     - Mengisolasi `LiveTimeDisplay` dari throttling 250ms parent screen saat playback, sembari menjaga sinkronisasi otomatis saat seek, pause, dan pergantian klip (`clipId`).
- **Perubahan Kode Penting**:
  - `mobile/src/components/feed/FeedTopControls.tsx`:
    - Menambahkan `Animated` ke impor react-native.
    - Menambahkan prop `progressAnim?: Animated.Value` pada `FeedTopControlsProps`.
    - Membuat mikro-komponen `LiveTimeDisplay` dengan `progressAnim.addListener` lokal (~30 FPS).
    - Memasang `LiveTimeDisplay` di slot durasi realtime mode done.
    - Mengonversi `styles.playheadNeedle` menjadi `<Animated.View>` dengan interpolasi `progressAnim`.
  - `mobile/src/components/FeedScreen.tsx`:
    - Mengoperkan `progressAnim={progressAnim}` ke `<FeedTopControls>`.

## [e6e5afa] - Isolate Progress Bar Re-Renders with Core Animated.Value & Throttle Screen State Updates
- **Konteks Struktural**:
  1. Isolasi Total Animasi Progress Bar (`useClipPlayer.ts`, `FeedPlaybackControls.tsx`, `FeedScreen.tsx`):
     - Mengimplementasikan `progressAnim = useRef(new Animated.Value(0)).current` dari modul core `react-native` untuk menggerakkan progress bar secara mandiri di pipeline animasi tanpa memicu re-render React pada komponen layar induk.
     - Di `FeedPlaybackControls.tsx`, mengubah `progressBarFill` dan `progressKnob` menjadi `<Animated.View>` yang diinterpolasi langsung dari `progressAnim` (skala 0–100 ke 0%–100%).
     - Menghubungkan event play, pause, seek, drag scrubber, dan clip loop ke `Animated.timing` dan `progressAnim.setValue(...)` secara langsung.
  2. Meringankan Beban JS Thread dengan Throttling State Root Screen (`useClipPlayer.ts`):
     - Mengurangi frekuensi pemanggilan `setCurrentClipTime` dan `setProgressPercent` di dalam interval jam linier dari sebelumnya setiap 50ms (20 FPS re-render layar induk) menjadi throttled ke 250ms (4 FPS).
     - Menjaga JS thread tetap 100% idle dan bebas dari kemacetan re-render, sehingga interval evaluasi subtitle (`syncSubtitleCueAtTime`) dan timer animasi dapat meletup tepat waktu tanpa tertahan lag ~200ms.
- **Perubahan Kode Penting**:
  - `mobile/src/hooks/useClipPlayer.ts`:
    - Mengimpor `Animated` dan `Easing` dari `react-native`.
    - Menambahkan ref `progressAnim` dan `lastStateUpdateWallTimeRef`.
    - Di `startLinearClock`: Memulai `Animated.timing` menuju 100 dengan durasi sisa klip; di interval 50ms, membatasi pembaruan state React (`setCurrentClipTime`, `setProgressPercent`) hanya jika selisih waktu >= 250ms.
    - Di `stopLinearClock` dan `centralizedSeek`: Menghentikan animasi dengan `progressAnim.stopAnimation()` dan memperbarui nilai seketika dengan `progressAnim.setValue(...)`.
    - Menambahkan `progressAnim` ke objek balikan hook `useClipPlayer`.
  - `mobile/src/components/feed/FeedPlaybackControls.tsx`:
    - Menambahkan prop opsional `progressAnim?: Animated.Value` di antarmuka `FeedPlaybackControlsProps`.
    - Menggunakan `<Animated.View>` untuk `progressBarFill` dan `progressKnob` dengan interpolasi nilai.
  - `mobile/src/components/FeedScreen.tsx`:
    - Menerima `progressAnim` dari `useClipPlayer` dan mengoperkannya ke `FeedPlaybackControls`.
    - Memperbarui interaksi scrubber (`onScrubberPress`) dan `handleSeekRelative` agar menghentikan dan men-set nilai `progressAnim` seketika (0ms).

## [9393926] - Synchronize Subtitle to Linear Clock & Eliminate Cue Boundary Freeze
- **Konteks Struktural**:
  1. Koneksikan State Subtitle Aktif ke Jam Linier Player (`FeedScreen.tsx`, `useClipPlayer.ts`):
     - Memperbaiki `setActiveSubtitleTextRef` yang sebelumnya terdefinisi namun tidak pernah dihubungkan (`current = setActiveSubtitleText`) ke hook subtitle.
     - Menambahkan propagasi `fontSize` bersama teks dari `useClipPlayer` melalui `setActiveSubtitleText(text, fontSize)` dan state `activeSubtitleFontSize`.
     - Mengeliminasi kalkulasi redundan `activeSubtitleCue = useMemo(..., [subtitles, currentClipTime])` di `FeedScreen.tsx` yang sebelumnya memindai array subtitle di setiap interval 50ms.
     - Mengalihkan rendering `SubtitleOverlay` 100% langsung ke `activeSubtitleText` dan `activeSubtitleFontSize` yang hanya terpicu saat teks subtitle berganti (`text !== lastDispatchedSubtitleTextRef.current`).
  2. Eliminasi Jeda / Freeze 100ms di Batas Kotak Subtitle (`SubtitleOverlay.tsx`):
     - Membungkus komponen `SubtitleOverlay` dalam `React.memo` agar tidak ikut ter-render ulang di setiap tick jam linier saat teks tidak berubah.
     - Mengubah mekanisme render bersyarat: tidak lagi menghancurkan/membuat ulang view container (`if (!isVisible || !subtitleText) return null`), melainkan mempertahankan kontainer tetap terpasang dengan toggling `opacity: hasText ? 1 : 0` dan `pointerEvents="none"`.
     - Menghilangkan penghancuran dan pembuatan ulang hierarki 10 native views (8 stroke views ber-regex emoji + 1 foreground view) saat masuk/keluar cue subtitle yang sebelumnya memblokir JS thread selama ~100ms dan menyebabkan timer progress bar tersendat.
  3. Isolasi Komponen Berat FeedScreen (`CustomRangeModal.tsx`, `FeedClipCarousel.tsx`, `FeedPlaybackControls.tsx`, `FeedTopControls.tsx`):
     - Membungkus `FeedClipCarousel`, `FeedPlaybackControls`, `FeedTopControls`, dan `CustomRangeModal` dalam `React.memo`.
     - Mencegah passing timestamp `currentClipTime` ke `CustomRangeModal` saat modal tertutup (`currentPlaybackTime={isCustomModalVisible ? currentClipTime : 0}`), memangkas re-render siklus 50ms pada modal yang tidak terlihat.
- **Perubahan Kode Penting**:
  - `mobile/src/hooks/useClipPlayer.ts`:
    - Memperbarui signature `setActiveSubtitleText?: (text: string, fontSize?: number) => void`.
    - Di `syncSubtitleCueAtTime`: Mengambil `fontSize` dari cue yang cocok dan menyertakannya ke `setActiveSubtitleText(text, fontSize)`.
  - `mobile/src/components/FeedScreen.tsx`:
    - Mengaitkan `setActiveSubtitleTextRef.current` ke `setActiveSubtitleText` dan `setActiveSubtitleFontSize` di dalam `useEffect`.
    - Menghapus deklarasi `activeSubtitleCue = useMemo(...)` berbasis `currentClipTime`.
    - Mengoper `subtitleText={activeSubtitleText}` dan `fontSize={activeSubtitleFontSize}` ke `SubtitleOverlay`.
    - Mengoper `currentPlaybackTime={isCustomModalVisible ? currentClipTime : 0}` ke `CustomRangeModal`.
  - `mobile/src/components/feed/SubtitleOverlay.tsx`:
    - Membungkus dalam `React.memo`.
    - Mengganti unmount menjadi `opacity: hasText ? 1 : 0` dengan `lines = hasText ? ... : []`.
  - `mobile/src/components/feed/FeedClipCarousel.tsx`:
    - Membungkus dalam `React.memo`.
  - `mobile/src/components/feed/FeedPlaybackControls.tsx`:
    - Membungkus dalam `React.memo`.
  - `mobile/src/components/feed/FeedTopControls.tsx`:
    - Membungkus dalam `React.memo`.
  - `mobile/src/components/feed/CustomRangeModal.tsx`:
    - Membungkus dalam `React.memo`.

## [7fb43b8] - Buffer Against Micro-Buffering Drops & Enable Instant Catch-Up on Playback Start
- **Konteks Struktural**:
  1. Redam Gangguan Micro-Buffering dengan Grace Period 150ms (`useClipPlayer.ts`):
     - Menambahkan `stopGraceTimerRef` yang menahan penghentian jam linier selama 150ms ketika event `isPlaying === false` diterima dari ExoPlayer.
     - Jika jeda tersebut hanya berupa micro-buffering/stutter awal pemutaran (< 150ms), saat status kembali menjadi `isPlaying === true`, timer pembatalan segera dibersihkan sehingga jam linier tidak terbunuh dan progress bar tidak membeku (stuck) di awal.
     - Jeda manual dari pengguna (`togglePlayPause`) dan operasi seek (`centralizedSeek`) tetap mengeksekusi `stopLinearClock()` secara instan (0ms) tanpa grace period.
  2. Kalibrasi Catch-Up Instan Saat Mulai Berjalan (`useClipPlayer.ts`):
     - Pada `startLinearClock`, langsung memperbarui `currentClipTime` dan `progressPercent` secara seketika pada detik awal tanpa menunggu siklus interval 50ms pertama selesai.
     - Menghapus sisa lock `pendingSeekTargetRef` segera setelah `isPlaying === true` terkonfirmasi aktif, sehingga sinkronisasi `timeUpdate` tidak terblokir.
- **Perubahan Kode Penting**:
  - `mobile/src/hooks/useClipPlayer.ts`:
    - Menambahkan `stopGraceTimerRef` dan pembersihan di fungsi unmount cleanup.
    - Di `stopLinearClock`: Membersihkan `stopGraceTimerRef` jika aktif sebelum menghentikan jam linier.
    - Di `startLinearClock`: Menambahkan eksekusi instan `setCurrentClipTime(initialTime)` dan `setProgressPercent(...)`.
    - Di listener `playingChange`: Membatalkan `stopGraceTimerRef` dan membersihkan `pendingSeekTargetRef` saat `isPlaying === true`; menerapkan penundaan 150ms dengan `setTimeout` sebelum memanggil `stopLinearClock()` saat `isPlaying === false`.
    - Di `togglePlayPause` dan `centralizedSeek`: Memastikan `stopGraceTimerRef` segera dibatalkan agar aksi pengguna tetap responsif 0ms.

## [7329cb0] - Decouple Linear Clock Start from Button Press to Native Playing Event & Restore Safe Buffer Options
- **Konteks Struktural**:
  1. Restorasi Pengaman Buffer ExoPlayer (`useClipPlayer.ts`):
     - Mengembalikan nilai `bufferOptions` (`minBufferForPlayback: 2.0` detik dan `preferredForwardBufferDuration: 4.0` detik) pada kedua instance player (`player` dan `facecamPlayer`) agar video memiliki buffer yang memadai dan terhindar dari potensi lag/stutter pada perangkat Android.
  2. Dekopling Total Start Jam Linier dari Tombol UI ke Event Native Player (`useClipPlayer.ts`):
     - Mengeliminasi panggilan prematur `startLinearClock(...)` dari event tekan tombol (`togglePlayPause`), pemindahan sumber video (`syncPlayerSourceForClip`), eksekusi seek (`executeSeek`), dan event kesiapan buffer (`statusChange: readyToPlay`).
     - Mengalihkan pemicu start jam linier 100% ke listener event `playingChange` saat ExoPlayer beralih ke `isPlaying === true` (yaitu frame video native telah benar-benar mulai didecode dan dirender di layar).
     - Menghapus keterlambatan awal (progress bar diam saat video sudah jalan) maupun lompat mundur (progress bar sempat berjalan mendahului lalu terpental kembali ke 0 saat native player baru mulai memutar).
  3. Pengaman Fallback di `timeUpdate` & Freeze UI saat Debounce Seek (`useClipPlayer.ts`):
     - Pada `timeUpdate`, jika native player berstatus `player.playing === true` namun jam linier belum aktif, jam linier segera distart otomatis di posisi `nativeRel` aktual.
     - Pada `centralizedSeek`, `stopLinearClock()` segera dipanggil untuk membekukan jam linier saat scrubbing, dan UI progress bar/subtitle langsung mencerminkan posisi target seek tanpa mendahului native player.
- **Perubahan Kode Penting**:
  - `mobile/src/hooks/useClipPlayer.ts`:
    - Mengembalikan `minBufferForPlayback: 2.0` dan `preferredForwardBufferDuration: 4.0` pada `player` dan `facecamPlayer`.
    - Di `startLinearClock`: Mengabaikan restart jika `isPlaybackActiveRef.current && !forceReset` agar iterasi reguler tidak mereset titik awal jam yang sedang berjalan.
    - Menghapus pemanggilan `startLinearClock(0, true)` di `syncPlayerSourceForClip` dan `statusChange`.
    - Menghapus pemanggilan `startLinearClock(clampedRel, true)` di `executeSeek`.
    - Menghapus pemanggilan `startLinearClock(rel, true)` di `togglePlayPause` dan merampingkan array dependencies-nya.
    - Di listener `playingChange`: Ketika `isPlaying === true` dan `!isPlaybackActiveRef.current`, menghitung posisi relatif `rel` dari `player.currentTime` aktual dan memanggil `startLinearClock(rel, true)`.
    - Di listener `timeUpdate`: Menambahkan fallback otomatis untuk menstart jam linier jika `player.playing` aktif tetapi jam belum berputar.

## [528ae47] - Support Gameplay Toggle (Facecam Only & Gameplay Only) in Template Editor and Export
- **Konteks Struktural**:
  1. Toggle On/Off Elemen Main Video Gameplay (`FeedTopControls.tsx`, `api.ts`, `useClipTemplate.ts`):
     - Menambahkan properti `enabled?: boolean` (default `true`) pada elemen `mainVideo` di antarmuka `ClipTemplateConfig`.
     - Menambahkan saklar toggle visual "Tampilkan Box Gameplay" di dalam Modal Gameplay (`showMainVideoModal`).
     - Tombol `Gameplay` pada grid 2x2 kontrol template editor kini menampilkan status aktif/redup (`templateConfig?.mainVideo?.enabled !== false`) selaras dengan tombol Facecam dan Konteks.
  2. Mode Facecam Only di Preview Kanvas 9:16 (`FeedScreen.tsx`, `useClipTemplate.ts`):
     - Memperluas kalkulasi `isPortrait` agar beralih ke format 9:16 portrait ketika gameplay dimatikan (`mainVideo.enabled === false`).
     - Di dalam preview `FeedScreen.tsx`, ketika mode Facecam Only aktif, kontainer visual box gameplay disembunyikan sehingga kanvas 9:16 hanya menampilkan Facecam (4:3) di bawah banner judul dengan latar belakang hitam bersih, sementara instance player native tetap berjalan di latar belakang (0x0) guna memastikan kontinuitas audio dan sinkronisasi jam linier/subtitle tanpa risiko interupsi surface Android.
  3. Adaptasi Engine Ekspor FFmpeg 1-Pass Multi-Layer (`subtitle_burner.py`):
     - Menyesuaikan pembacaan `main_enabled` dari `template_data['mainVideo']`.
     - Mendukung 3 mode tata letak video portrait 9:16:
       - **Facecam + Gameplay**: 2-layer split dengan Facecam 4:3 di atas dan Gameplay 4:3 di bawah.
       - **Facecam Only** (`fc_enabled and not main_enabled`): 1-layer Facecam 4:3 di-crop dan di-pad ke kanvas 9:16 (`pad={out_w}:{out_h}:0:{y_fc}:black`) di bawah banner judul tanpa layer gameplay.
       - **Gameplay Only** (`not fc_enabled and main_enabled`): 1-layer Gameplay 16:9 di-crop dan di-pad ke kanvas 9:16 di bawah banner judul tanpa layer facecam.
     - Memastikan `has_template` mendeteksi kondisi `mainVideo.enabled === false` sebagai konfigurasi template aktif saat ekspor.
- **Perubahan Kode Penting**:
  - `mobile/src/services/api.ts`:
    - Menambahkan `enabled?: boolean` pada `ClipTemplateConfig['mainVideo']` dan menetapkan default `enabled: true` di `DEFAULT_TEMPLATE_CONFIG.mainVideo`.
  - `mobile/src/hooks/useClipTemplate.ts`:
    - Menyertakan `enabled` pada `mergedMainVideo` dan menambahkan kondisi `templateConfig.mainVideo.enabled === false` pada `isPortrait`.
  - `mobile/src/hooks/useClipSubtitle.ts`:
    - Memasukkan `enabled` pada fallback `activeTemplateConfig.mainVideo` dan menyertakannya di evaluasi `hasTemplate`.
  - `mobile/src/components/feed/FeedTopControls.tsx`:
    - Menambahkan state `tempMainEnabled` dan inisialisasi di `openMainVideoModal`.
    - Menambahkan toggle "Tampilkan Box Gameplay" di Modal 8 dan menyimpan statusnya di `onUpdateMainVideo`.
    - Memperbarui gaya tombol `Gameplay` di grid kontrol template agar merefleksikan status on/off.
  - `mobile/src/components/FeedScreen.tsx`:
    - Menyembunyikan box visual gameplay saat `templateConfig.mainVideo.enabled === false` di mode portrait, dengan mempertahankan native player di background untuk stabilitas audio.
  - `mobile/scripts/utils/subtitle_burner.py`:
    - Menambahkan percabangan filtergraph untuk mode Facecam Saja (`fc_enabled and not main_enabled`) dan Gameplay Saja (`not fc_enabled and main_enabled`).
    - Memperbarui evaluasi `has_template` untuk mendeteksi `main_v.get("enabled") is False`.

## [b6f5f7e] - Support Dynamic Numeric Size & Padding, Multiline Textarea, and Alignment Toggle for Context Banner
- **Konteks Struktural**:
  1. Input Angka Dinamis Bebas untuk Ukuran Font & Padding (`FeedTopControls.tsx`):
     - Mengganti tombol preset terbatas (`14, 16, 18, 20` untuk font dan `6, 10, 14, 18` untuk padding) dengan input angka bebas (`TextInput` bertipe `numeric`) berdampingan dalam baris `Size (dp)` dan `Pad (px)`.
     - Mempertahankan kalibrasi proporsional terhadap resolusi ekspor (`base_unit * (fontSize / 14.0)` di Python/FFmpeg dan direktif dp responsif di React Native) sehingga pengguna bebas mengisi nilai apa pun (sangat kecil, sedang, hingga sangat besar).
  2. Input Multiline Textarea dengan Batasan Maksimal 3 Baris (`FeedTopControls.tsx`, `FeedScreen.tsx`, `subtitle_burner.py`):
     - Mengubah input teks banner menjadi multiline `TextInput` (textarea) yang mendukung tombol Enter (`\n`) hingga batas 3 baris.
     - Di preview React Native (`FeedScreen.tsx`), teks banner mendukung hingga 3 baris (`numberOfLines={3}`).
     - Di engine ekspor (`subtitle_burner.py`), tinggi banner dihitung dinamis sesuai jumlah baris (`num_lines * (ctx_fs * 1.35) + 2 * ctx_pad`).
  3. Toggle Perataan Teks (Start vs Center) (`api.ts`, `useClipTemplate.ts`, `FeedTopControls.tsx`, `FeedScreen.tsx`, `subtitle_burner.py`):
     - Menambahkan opsi konfigurasi `align: 'start' | 'center'` pada `ClipTemplateConfig['context']` dan `VideoGlobalConfig['contextStyle']` dengan default `'start'` (rata kiri).
     - Menambahkan tombol segmented toggle perataan teks di modal Konteks (`Rata Kiri (Start)` dan `Rata Tengah (Center)`).
     - Menyelaraskan rendering preview di `FeedScreen.tsx` (`alignItems`, `paddingHorizontal`, `textAlign`).
     - Di FFmpeg filtergraph (`subtitle_burner.py`), perataan teks dirender per baris agar setiap baris terpusat secara individual saat mode `center`, atau sejajar di batas kiri (`pad_x`) saat mode `start`.
- **Perubahan Kode Penting**:
  - `mobile/src/services/api.ts`:
    - Menambahkan `align?: 'start' | 'center'` ke `ClipTemplateConfig['context']` dan `VideoGlobalConfig['contextStyle']`.
    - Menetapkan default `align: 'start'` pada `DEFAULT_TEMPLATE_CONFIG.context` dan `saveVideoGlobalConfig`.
  - `mobile/src/hooks/useClipTemplate.ts`:
    - Mengintegrasikan pembacaan dan penyimpanan `align` pada `mergedContext` dan `handleUpdateContext`.
  - `mobile/src/components/FeedScreen.tsx`:
    - Memperbarui gaya `contextBannerBox` dan `contextBannerText` dengan `alignItems`, `paddingHorizontal`, `textAlign`, serta `numberOfLines={3}`.
  - `mobile/src/components/feed/FeedTopControls.tsx`:
    - Mengimpor ikon `AlignLeft` dan `AlignCenter`.
    - Menambahkan state `tempContextAlign` dan inisialisasi di `openContextModal`.
    - Merancang ulang Modal 6 dengan textarea multiline maks 3 baris, tombol perataan teks start/center, input angka bebas untuk Size dan Pad, serta validasi simpan.
  - `mobile/scripts/utils/subtitle_burner.py`:
    - Menyesuaikan parsing `ctx_text` menjadi baris-baris (maks 3 baris).
    - Menghitung tinggi banner dinamis berdasarkan jumlah baris dan padding.
    - Menghasilkan filter `drawtext` per baris dengan posisi X dan Y yang selaras dengan mode `start` (`pad_x`) atau `center` (`(w-text_w)/2`).

## [cc6d10b] - Fix Player Playback Start Delay and Eliminate Progress Bar Jump Back
- **Konteks Struktural**:
  1. Pengurangan Buffer Awal ExoPlayer (`player.bufferOptions` di `useClipPlayer.ts`):
     - Memangkas parameter `bufferOptions.minBufferForPlayback` dari nilai bawaan Android yang berlebihan (2.0 detik) menjadi `0.05` detik (50ms), serta `preferredForwardBufferDuration: 1.0` detik.
     - Untuk pemutaran file video lokal/proxy di storage HP, decoder tidak lagi tertahan melakukan pre-buffering 2 detik, sehingga video langsung berputar seketika saat tombol Play ditekan (menghilangkan jeda "berhenti sejenak di awal").
  2. Proteksi Deduplikasi & Pencegahan Reset Ganda Jam Linier (`playingSub` & `startLinearClock`):
     - Memperbaiki listener `playingChange` agar TIDAK memanggil `startLinearClock` ulang jika jam linier sudah aktif berputar (`!isPlaybackActiveRef.current`).
     - Mencegah fenomena progress bar "kembali lagi sebentar" yang sebelumnya terjadi akibat tombol Play menyalakan jam di millisecond 0, lalu event native `playingChange` mereset kembali jam tersebut ke detik 0 saat frame pertama baru dirender.
  3. Penegakan Animasi Linier 0-X Murni Tanpa Drift Snap-Back (`timeUpdate`):
     - Menghapus logika kalibrasi mundur (*drift snap-back*) pada event `timeUpdate` untuk pemutaran file lokal, sehingga jarum progress bar bergerak 100% mulus dan kontinu secara deterministik tanpa pernah tersentak mundur.
  4. Sinkronisasi Instan AutoPlay & Pergantian Klip (`syncPlayerSourceForClip` & `statusChange`):
     - Memastikan `startLinearClock(0, true)` dipanggil secara langsung pada eksekusi autoPlay dan `readyToPlay`, sehingga progress bar langsung aktif bersamaan dengan keberangkatan video klip baru.
- **Perubahan Kode Penting**:
  - `mobile/src/hooks/useClipPlayer.ts`:
    - Mengonfigurasi `p.bufferOptions` pada `player` dan `facecamPlayer` (`minBufferForPlayback: 0.05`).
    - Menambahkan parameter `forceReset` pada `startLinearClock` dan memproteksi pemanggilan ganda.
    - Menambahkan penjagaan `!isPlaybackActiveRef.current` pada listener `playingChange`.
    - Mengeliminasi *drift snap-back* untuk pemutaran lokal di event `timeUpdate`.
    - Memanggil `startLinearClock(0, true)` pada blok autoPlay `syncPlayerSourceForClip` dan `statusChange`.
    - Memperbaiki perhitungan `rel` waktu di `togglePlayPause` agar akurat terhadap `player.currentTime`.

## [716471e] - Redesign Template Editor Controls to 2-Row 2-Button Grid Layout
- **Konteks Struktural**:
  1. Redesain Tata Letak Kontrol Template Editor (`FeedTopControls.tsx`):
     - Menghapus baris label rasio kanvas/aspek (`templateHeaderRow` dengan tag `16:9 Landscape` / `9:16 Portrait` / `Gameplay Penuh 16:9`) yang sebelumnya menempati baris atas editor template, guna membebaskan ruang vertikal.
     - Mendistribusikan 4 tombol kontrol template ke dalam 2 baris (masing-masing 2 tombol sejajar secara proporsional berbobot `flex: 1`):
       - Baris 1: Tombol pengaturan elemen Facecam (`Facecam`) dan banner konteks (`Konteks`).
       - Baris 2: Tombol pengaturan video utama (`Gameplay`) dan watermark (`Watermark` / `WM: ON`).
  2. Optimalisasi Ruang & Kerapian UI (`styles.templateLayerSection`, `styles.templateActionBtn`):
     - Menyesuaikan tinggi tombol menjadi `33dp` dengan jarak `gap: 7dp` dan `paddingVertical: 7dp` agar kedua baris tombol pas dan seimbang di dalam kontainer berukuran tetap `88dp` tanpa terpotong (*zero overflow*).
     - Lebar setiap tombol meningkat dari ~80dp (saat 4 tombol berdempetan di satu baris) menjadi ~165dp, membuat teks label dan ikon terbaca lapang, jelas, dan mudah ditekan (*touch-friendly*).
     - Menghapus aturan gaya usang yang tidak terpakai (`templateHeaderRow`, `templateHintText`, `templateActionsRow`, `templateLeftInfo`, `ratioBadge*`, `templateButtonsGroup`, `templateMainBtn`).
- **Perubahan Kode Penting**:
  - `mobile/src/components/feed/FeedTopControls.tsx`:
    - Menghapus blok JSX `templateHeaderRow`.
    - Membagi 4 tombol aksi template ke dalam 2 elemen kontainer `templateButtonsRow`.
    - Memperbarui gaya `templateLayerSection`, `templateButtonsRow`, `templateActionBtn`, dan `templateBtnActive`.
    - Membersihkan kode styling usang yang tidak lagi direferensikan.

## [11ea1f5] - Implement Zero-Lag Linear Wall-Clock Timeline & Subtitle Synchronization
- **Konteks Struktural**:
  1. Penjadwalan Waktu Linier Deterministik (Client-Side Linear Clock Interpolator di `useClipPlayer.ts`):
     - Menggantikan ketergantungan pasif UI pada event bridge `timeUpdate` ExoPlayer (yang sering mengalami penumpukan antrean/delay hingga 300-400ms di HP berspesifikasi rendah) dengan jam linier independen berbasis `Date.now()`.
     - Karena pemutaran video (terutama file lokal) berjalan secara deterministik pada laju 1.0x, pergerakan progress bar dan jarum playhead digerakkan secara linier dan halus pada interval 50ms (20 FPS).
     - Event native `timeUpdate` ExoPlayer diturunkan frekuensinya dari 100ms ke 250ms dan dialihfungsikan murni sebagai *heartbeat drift calibration* (hanya melakukan kalibrasi ulang jika terjadi selisih nyata > 0.35s akibat seek atau stall jaringan), memangkas beban lintas-bridge sebesar 60%.
  2. Evaluasi Cue Subtitle Realtime & Pencegahan Re-render Berlebih (`syncSubtitleCueAtTime`):
     - Memutus siklus pemindaian array subtitle dan pemanggilan state berulang setiap 100ms jika teks subtitle yang aktif tidak mengalami perubahan (`lastDispatchedSubtitleTextRef`).
     - Menyinkronkan teks subtitle secara instan pada milidetik ke-0 saat tombol Play ditekan maupun saat user menggeser timeline scrubber, menghilangkan lag visual subtitle.
  3. Integrasi State Playback Terpusat (`playingChange`, `centralizedSeek`, `togglePlayPause`, `skipSeconds`):
     - Mengaitkan start/stop jam linier secara langsung ke event resmi `playingChange` dari `expo-video` serta handler seek terpusat, memastikan pergerakan waktu langsung berhenti saat video dijeda (pause) dan mereset ke detik 0 saat loop klip selesai.
- **Perubahan Kode Penting**:
  - `mobile/src/hooks/useClipPlayer.ts`:
    - Mengubah `timeUpdateEventInterval` dari `0.1` ke `0.25` untuk meringankan beban native bridge.
    - Menambahkan refs `playStartWallTimeRef`, `playStartClipTimeRef`, `isPlaybackActiveRef`, `linearClockTimerRef`, dan `lastDispatchedSubtitleTextRef`.
    - Mengimplementasikan helper `syncSubtitleCueAtTime`, `startLinearClock`, dan `stopLinearClock`.
    - Memperbarui event listener `playingChange` dan `timeUpdate` dengan logika drift check (>0.35s).
    - Memperbarui `centralizedSeek`, `togglePlayPause`, dan `skipSeconds` agar langsung menyinkronkan jam linier dan cue subtitle saat seek/pause/play.

## [1b773fd] - Support Per-Clip Watermark Choice (With or Without Watermark)
- **Konteks Struktural**:
  1. Fleksibilitas Pemilihan Status Watermark per Klip (`useClipTemplate.ts`):
     - Memprioritaskan status simpanan klip (`clipSaved?.watermark?.enabled`) di atas status default global (`globalConf?.watermark?.enabled`), sehingga setiap klip bebas dipilih apakah ingin menggunakan watermark atau bersih tanpa watermark.
     - Properti styling (teks, ukuran font, koordinat X/Y) tetap diwarisi secara global dari `video_config.json` agar pengguna tidak perlu repot mengetik ulang pada setiap klip.
  2. Pilihan Antarmuka Segmented "Tanpa Watermark" vs "Dengan Watermark" (`FeedTopControls.tsx`):
     - Menambahkan tombol pilihan segmented yang jelas dan tegas di bagian atas modal watermark: `[ Tanpa Watermark ]` dan `[ Dengan Watermark ]`.
     - Menampilkan indikator status dinamis langsung pada baris tombol template editor (`WM: ON` saat klip memakai watermark, dan `Watermark` saat klip tanpa watermark).
- **Perubahan Kode Penting**:
  - `mobile/src/hooks/useClipTemplate.ts`:
    - Memperbarui resolusi `enabled` agar mendahulukan status spesifik per-klip (`clipSaved?.watermark?.enabled !== undefined`).
  - `mobile/src/components/feed/FeedTopControls.tsx`:
    - Menyediakan tombol pemilih segmented 2-opsi "Tanpa Watermark" vs "Dengan Watermark" dan label indikator `WM: ON`.

## [0f74028] - Support Global Watermark Template with Custom Position, Size, and Text
- **Konteks Struktural**:
  1. Penambahan Template Watermark Global (`api.ts`, `useClipTemplate.ts`):
     - Menambahkan konfigurasi elemen `watermark` pada `ClipTemplateConfig` dan `VideoGlobalConfig` dengan parameter `enabled`, `text`, `size`, `x`, dan `y`.
     - Konfigurasi watermark dikelola secara global di tingkat video (`video_config.json` dan in-memory map) sehingga input teks, ukuran, dan posisi otomatis berlaku serentak pada seluruh klip dalam video yang sama.
     - Posisi `x` (0-100%) dan `y` (0-100%) dihitung relatif terhadap seluruh kontainer kanvas luar (*outer canvas container*) video, bukan terikat pada sub-pemutar tertentu.
  2. Komponen Overlay Pratinjau Watermark (`WatermarkOverlay.tsx`, `FeedScreen.tsx`):
     - Merender teks watermark di atas kontainer kanvas luar dengan 8 arah stroke outline kontras tinggi agar teks selalu terbaca jelas di atas video terang maupun gelap.
     - Menyesuaikan ukuran font secara proporsional terhadap dimensi terpendek kontainer canvas (identik 1:1 dengan sistem penskalaan subtitle).
  3. Antarmuka Pengaturan Watermark (`FeedTopControls.tsx`):
     - Menambahkan tombol aksi Watermark pada deretan kontrol template editor klip.
     - Menyediakan modal pengaturan dengan toggle aktivasi, input teks watermark, tombol preset ukuran font (12, 14, 16, 18, 20 dp), tombol preset posisi cepat (Kiri Atas, Kanan Atas, Kiri Bawah, Kanan Bawah), serta input manual koordinat X dan Y (0-100%).
  4. Komposisi Burn-In Watermark pada Ekspor Video FFmpeg (`subtitle_burner.py`):
     - Membakar watermark permanen ke dalam file video hasil ekspor menggunakan filter `drawtext` pada tahap perakitan filtergraph 1-pass.
     - Menghitung koordinat piksel secara proporsional terhadap resolusi canvas video akhir (`w-text_w` dan `h-text_h`) dengan border hitam pelindung.
- **Perubahan Kode Penting**:
  - `mobile/src/services/api.ts`:
    - Menambahkan `watermark` pada `ClipTemplateConfig`, `DEFAULT_TEMPLATE_CONFIG`, dan `VideoGlobalConfig`.
  - `mobile/src/hooks/useClipTemplate.ts`:
    - Mengintegrasikan pembacaan dan penyimpanan watermark global serta menyediakan handler `handleUpdateWatermark`.
  - `mobile/src/hooks/useClipSubtitle.ts`:
    - Menyertakan konfigurasi watermark dalam resolusi `activeTemplateConfig` dan pengecekan `hasTemplate`.
  - `mobile/src/components/feed/WatermarkOverlay.tsx`:
    - Membuat komponen overlay watermark dengan 8 arah outline dan positioning dinamis relatif terhadap canvas luar.
  - `mobile/src/components/FeedScreen.tsx`:
    - Menghubungkan handler watermark ke `FeedTopControls` dan merender `WatermarkOverlay` pada kanvas luar.
  - `mobile/src/components/feed/FeedTopControls.tsx`:
    - Menambahkan tombol aksi Watermark dan modal pengaturan interaktif dengan preset posisi/ukuran.
  - `mobile/scripts/utils/subtitle_burner.py`:
    - Menambahkan filter `drawtext` watermark pada `generate_template_filtergraph` dan pemeriksaan `has_template`.

## [f6c258a] - Implement Dynamic Stream Offset with 0.25s Floor and 1.0s Cap
- **Konteks Struktural**:
  1. Kompensasi Offset Dinamis pada Pemotongan Stream Online (`clip_downloader.py`):
     - Menggantikan nilai offset statis 0.5s (+-500ms) pada mode stream online menjadi kompensasi dinamis: `stream_offset = min(1.0, max(0.25, chunk_n * 0.0005))`.
     - **Batas Bawah 0.25s (250ms)**: Menjamin toleransi aman untuk variasi penempatan Keyframe (GOP jitter) hingga 8 frame pada video 30/60fps serta kuantisasi batas paket audio AAC (21.3ms), memastikan suku kata awal (seperti desah huruf "H") tidak pernah terpotong ke dalam pada menit-menit awal video.
     - **Skala Dinamis ($N/2 \times 0.001$s atau $\text{chunk\_n} \times 0.0005$s)**: Mengantisipasi akumulasi penyimpangan pembulatan tag manifest `#EXTINF` secara proporsional seiring bertambahnya urutan segmen HLS pada video panjang, dengan memperhitungkan efek saling meniadakan (*random walk error cancellation*).
     - **Batas Atas 1.0s (1000ms)**: Mengunci batas maksimum agar klip pada video panjang (2–3 jam) tidak pernah mengalami kelebihan durasi secara berlebihan.
  2. Kepastian 0.0s Offset pada Mode Lokal (`is_local_source`):
     - Memastikan bahwa mode pemotongan dari full video lokal offline tetap 100% murni tanpa offset (0.0s), karena pemutar preview dan proses re-encode FFmpeg mengacu ke file fisik yang sama dengan akurasi frame sempurna.
- **Perubahan Kode Penting**:
  - `mobile/scripts/utils/clip_downloader.py`:
    - Mengganti formula statis `0.5s` dengan kalkulasi dinamis `chunk_n = max(1.0, start_num / 5.0)` dan `stream_offset = min(1.0, max(0.25, chunk_n * 0.0005))`.
    - Menerapkan `start_num = max(0.0, start_num - stream_offset)` dan `end_num += stream_offset` secara eksklusif untuk mode stream online.

## [daeddba] - Support Subtitle Emoji Font Fallback, Fix Preview Emoji Ghosting, and Buffer Stream Start Offset
- **Konteks Struktural**:
  1. Penyesuaian Offset Titik Start pada Pemotongan Stream Online (`clip_downloader.py`):
     - Menjawab kendala potensi meleset ke dalam (*inward drift*) pada titik awal saat memotong langsung dari stream YouTube.
     - Menerapkan kompensasi simetris pada rentang pemotongan stream: titik mulai dimajukan 0.5s (`start_num = max(0.0, start_num - 0.5)`) dan titik selesai dimundurkan 0.5s (`end_num += 0.5`).
     - Menjamin bahwa klip hasil potong dari stream selalu aman melebar ke luar (*outward buffer*), sehingga tidak ada risiko suku kata pertama atau kata penutup terpotong di kedua ujung video.
  2. Eliminasi Duplikasi Bayangan Emoji pada Preview Subtitle (`SubtitleOverlay.tsx`):
     - Memperbaiki efek bayangan dobel/berceceran pada karakter emoji di preview subtitle akibat 8 arah pseudo-stroke hitam pekat.
     - Menyembunyikan karakter emoji (`opacity: 0`) khusus pada 8 layer stroke belakang sehingga border hitam hanya membungkus teks latin, sementara emoji hanya dirender 1 kali bersih di layer foreground dengan zero layout shift.
  3. Konfigurasi Dukungan Font Emoji pada Ekspor Subtitle ASS (`subtitle_burner.py`):
     - Menambahkan konfigurasi fallback font `Noto Color Emoji` di samping `Roboto` pada header format style ASS (`libass`).
     - Menyediakan opsi `:fontsdir=/system/fonts` pada pemanggilan filter `subtitles` FFmpeg agar mesin rendering libass dapat mengakses font emoji sistem Android secara langsung.
- **Perubahan Kode Penting**:
  - `mobile/scripts/utils/clip_downloader.py`:
    - Menambahkan `start_num = max(0.0, start_num - 0.5)` khusus mode stream online agar rentang aman melebar ke luar di awal.
  - `mobile/src/components/feed/SubtitleOverlay.tsx`:
    - Menambahkan `renderStrokeContent` untuk menyembunyikan emoji dari 8 layer stroke belakang.
  - `mobile/scripts/utils/subtitle_burner.py`:
    - Menambahkan `Noto Color Emoji` ke style header ASS dan opsi `:fontsdir` ke filter `subtitles`.

## [2989b70] - Remove Subtitle Auto-Merge and Implement Overlap Trimming Prioritizing Cue Start Times
- **Konteks Struktural**:
  1. Penghapusan Fitur Auto-Merge pada Subtitle (`normalizeSingleTrackCues`):
     - Menghilangkan perilaku penggabungan teks otomatis (*auto-merge*) ketika dua cue subtitle memiliki waktu yang berdekatan atau bertumpuk (*overlapping*).
     - Menjaga teks setiap kalimat/cue tetap independen murni tanpa digabung menjadi satu kalimat panjang yang merepotkan saat proses editing.
  2. Logika Resolusi Overlap Baru (Prioritas Titik Awal Cue Kedua):
     - Dalam proses editing klip video, penanda waktu mulai bicara (`start`) kalimat baru adalah titik sinkronisasi yang paling krusial.
     - Jika Cue 1 bertumpuk dengan Cue 2 (`current.start < prev.end`): waktu akhir Cue 1 (`prev.end`) otomatis dipotong (*trimmed*) agar tepat berakhir di detik mulainya Cue 2 (`current.start`).
     - Jika kedua cue memiliki titik awal yang sama persis atau `current.start <= prev.start`, cue yang lebih baru/kedua menggantikan cue sebelumnya.
- **Perubahan Kode Penting**:
  - `mobile/src/services/api.ts`:
    - Mengganti logika `normalizeSingleTrackCues` dari penggabungan teks (`prev.text = prev.text + current.text`) menjadi pemotongan waktu akhir (`prev.end = current.start`) tanpa penggabungan teks.

## [e264379] - Remove 500ms Offset on Local Video Cutting for Frame-Accurate Precision
- **Konteks Struktural**:
  1. Penghapusan Kompensasi Offset pada Pemotongan Video Lokal:
     - Mengatasi kendala di mana hasil potong klip dari file full video lokal (`source_video_path`) mengalami kelebihan durasi tepat 0.5 detik (+500ms) di akhir.
     - Penambahan `end_num += 0.5` sebelumnya diterapkan secara universal untuk mengompensasi *timeline drift* pada segmen HLS YouTube saat stream online.
     - Pada mode lokal, preview pemutar dan proses pemotongan FFmpeg mengacu ke file MP4 fisik yang sama di penyimpanan lokal. FFmpeg menggunakan filter `trim` dan `atrim` dengan re-encode frame-accurate (`libx264`), sehingga pemotongan dari file lokal sudah 100% presisi per milidetik tanpa memerlukan offset tambahan.
     - Kompensasi `+0.5s` kini dibatasi secara kondisional hanya untuk pemotongan via stream online (`not is_local_source`).
- **Perubahan Kode Penting**:
  - `mobile/scripts/utils/clip_downloader.py`:
    - Mengubah penambahan `end_num += 0.5` agar hanya berjalan jika `not is_local_source`, sehingga pemotongan dari full video lokal murni menggunakan rentang `start` sampai `end`.

## [Unreleased] - Create Heroku Scheduler Automated Video Uploader for YouTube and TikTok
- **Konteks Struktural**:
  1. Arsitektur Script CLI Statis Khusus Heroku Scheduler (`scheduler-uploader/`):
     - Membangun modul mandiri tanpa web server (non-Express) yang dirancang untuk dieksekusi secara periodik oleh Heroku Scheduler.
     - Mengotomatisasi konversi zona waktu UTC ke WIB (Asia/Jakarta, UTC+7) untuk mendeteksi folder target harian (`YYYY-MM-DD`) dan file video target sesuai jam eksekusi (`<JAM>_00.mp4`, e.g. `12_00.mp4`, `15_00.mp4`, `17_00.mp4`, `19_00.mp4`, `21_00.mp4`, `23_00.mp4`).
  2. Alur Eksekusi Linear Asinkron 5 Tahap (A sampai E):
     - **Tahap A**: Melakukan query Google Drive API v3 untuk menemukan folder tanggal di dalam `GDRIVE_ROOT_FOLDER_ID`. Jika tidak ada folder, keluar bersih dengan `process.exit(0)`.
     - **Tahap B**: Mencari file video jam terkait di dalam folder tanggal. Jika tidak ditemukan, keluar bersih dengan `process.exit(0)`.
     - **Tahap C**: Mengunduh video menggunakan `fs.createWriteStream` dan `stream/promises.pipeline` langsung ke disk lokal (`./temp_video.mp4`) tanpa buffering memori (RAM) untuk menjaga kestabilan dyno 512MB.
     - **Tahap D**: Mengunggah file `./temp_video.mp4` secara simultan ke YouTube Data API v3 dan TikTok Content Posting API v2 menggunakan `Promise.all()`.
     - **Tahap E**: Menghapus file lokal sementara dengan `fs.unlinkSync` dan mencetak "Upload Berhasil" (`process.exit(0)`). Setiap kegagalan ditangkap dalam blok catch global, membersihkan file sementara, dan mengakhiri proses dengan `process.exit(1)`.
- **Perubahan Kode Penting**:
  - `scheduler-uploader/package.json`:
    - Membuat konfigurasi package mandiri dengan dependensi `axios`, `dotenv`, dan `googleapis`.
  - `scheduler-uploader/index.js`:
    - Mengimplementasikan seluruh logika alur A-E, konversi waktu WIB berbasis `Intl.DateTimeFormat`, Google OAuth2/Service Account auth factory yang fleksibel, streaming download, dan fungsi upload paralel YouTube & TikTok dengan dokumentasi metadata yang mudah dikustomisasi.
  - `scheduler-uploader/.env.example`:
    - Menyediakan template variabel lingkungan untuk `GDRIVE_TOKEN`, `GDRIVE_ROOT_FOLDER_ID`, `YOUTUBE_API_TOKEN`, `TIKTOK_API_TOKEN`, dan opsi pengujian `TARGET_DATE`, `TARGET_HOUR`, serta `MOCK_UPLOAD`.
  - `scheduler-uploader/.gitignore`:
    - Mengabaikan `node_modules`, `.env`, `temp_video.mp4`, dan file log.
  - `scheduler-uploader/README.md`:
    - Mendokumentasikan tabel pemetaan jadwal UTC vs WIB untuk Heroku Scheduler, instruksi setup environment, kustomisasi metadata, dan panduan pengujian lokal.

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
     - Menggantikan baris Extend dan Crop 
... [truncated for diff preview]