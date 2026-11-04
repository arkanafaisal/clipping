# Video Editor - Programmatic Video Studio

Workspace programmatic video editing berbasis **Vite + React 19 + Tailwind CSS v4 + Remotion** yang terintegrasi dengan aset Google Drive.

## Fitur Utama

- **Live Interactive Player (`@remotion/player`)**: Pratinjau animasi, transisi kartu, easing curve, dan font secara real-time tanpa perlu menunggu kompilasi FFmpeg.
- **Google Drive Asset Integration**:
  - Metadata tersimpan rapi di `src/data/metadata.json` (dan `public/metadata.json`).
  - Berkas video mentah (`full.mp4`) diunduh sesuai kebutuhan (*on-demand*) ke `public/temp/` via CLI interaktif.
  - Remotion `<Video />` memutar berkas lokal `public/temp/<momen>/full.mp4` secara mulus tanpa membebani repositori Git.
- **Tailwind CSS v4 (`@tailwindcss/vite`)**: Styling modern zero-runtime langsung di dalam komposisi video Remotion.
- **Parametric Controls**: Pengaturan teks, nama game, timestamp, jalur aktif roulette, dan spotlight dim opacity secara dinamis.

## Cara Menjalankan

### 1. Jalankan Studio Workbench (Browser)

```bash
cd video-editor
npm run dev
```

Buka URL lokal `http://localhost:5174` di peramban web.

### 2. Mengunduh Video Momen dari Google Drive (CLI)

Jika video di folder `temp` terhapus atau ingin mengambil momen lain dari Google Drive:

```bash
npm run download
```

Pilih nomor momen yang diinginkan (misalnya `1` untuk momen `grim reaper`). Skrip akan langsung mengunduh `full.mp4` ke `public/temp/grim reaper/full.mp4`.

### 3. Memperbarui / Sinkronisasi Metadata dari Drive

Jika ada folder momen baru yang ditambahkan di Google Drive:

```bash
npm run sync
```
