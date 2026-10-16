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

## [8750031] - Inisialisasi changelog.md dan Penambahan Rule 13
- **Konteks Struktural**: Menambahkan sistem dokumentasi changelog formal per commit ID untuk mendokumentasikan konteks struktural arsitektur dan diff esensial yang tidak terwadahi hanya dari commit message.
- **Perubahan Kode Penting**:
  - [changelog.md](file:///d:/projects/clipping/changelog.md): Dibuat baru dengan format baku per commit ID (Konteks Struktural dan Detail Perubahan Kode).
  - [GEMINI.md](file:///d:/projects/clipping/GEMINI.md#L37): Menambahkan Rule 13 [PROCESS] yang mewajibkan pencatatan setiap commit ke `changelog.md` secara berkelanjutan.

