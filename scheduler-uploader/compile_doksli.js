/**
 * ============================================================================
 * AUTO EDIT KOMPILASI TEBAK-TEBAKAN DOKSLI (VIDEO QUIZ COMPILER)
 * ============================================================================
 * Script mandiri yang mengambil 5-10 momen secara acak dari folder induk
 * Google Drive. Folder induk berisi subfolder-subfolder momen/game.
 *
 * Di dalam masing-masing subfolder episode, terdapat tepat 2 video file:
 * 1. cut.mp4           : Klip potongan epik (misal facecam saja).
 * 2. <nama_momen>.mp4  : Video full meme yang lebih panjang (nama dinamis).
 * Atau terdapat subfolder klip lapis ke-3 (misal: folder "-").
 *
 * Alur Tiap Momen:
 * 1. Video 'cut.mp4' diputar normal dengan gameplay beku & layer gelap.
 * 2. Frame terakhir di-freeze:
 *    - Pertanyaan kuis bersih tanpa tumpukan teks.
 *    - Full-width smooth progress bar (940px, 60 FPS) memendek dari kanan ke kiri.
 *    - Pilihan ganda 4 opsi (nama game murni terpusat, tanpa awalan A/B/C/D).
 *    - Reveal: hanya jawaban benar menyala Hijau Emerald (#22C55E), opsi salah tetap normal.
 * 3. Video full diputar dengan overlay teks judul file full di 1/4 atas kanvas
 *    dengan dukungan penyesuaian kecepatan (speed/auto-speed) & audio cempreng.
 * 4. Klip transisi layar hitam TikTok Core (dengan counter "x / y") disisipkan antar momen.
 * 5. Seluruh momen digabungkan secara single-pass seamless menjadi 1 video kompilasi 60 FPS.
 *
 * Jalankan dengan:
 *   node compile_doksli.js
 * atau
 *   npm run doksli
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// Import modul utilitas modular
const {
  FFMPEG_BIN,
  getGoogleAuth,
  getConfig,
  printConfigBanner,
} = require('./utils/config');

const {
  shuffleArray,
  cleanText,
  parseTimeToStandardTimestamp,
  formatTimestampToIndoTime,
  isSkippedItem,
  STATIC_FALLBACK_DISTRACTORS,
  createUniqueQuizOptions,
  createUniqueEpisodeQuizOptions,
  findVideoPair,
  findMemeImage,
  getFullVideoDisplayText,
  findGameMomentPair,
  promptGameSelection,
  selectSingleGameQuizMoments,
  selectQuizMoments,
} = require('./utils/selector');

const {
  formatAssTime,
  generateDarkOverlayASS,
  generateQuizASS,
  generateFullVideoASS,
  generateTransitionASS,
  generateQuizSoundWav,
} = require('./utils/overlay');

const {
  getAudioDuration,
  normalizeVideo,
} = require('./utils/videoEditor');

const {
  detectTransitionSfx,
  renderTransitionClip,
  prepareTransitionClips,
} = require('./utils/transition');

const {
  downloadDriveFile,
  downloadMomentVideos,
} = require('./utils/downloader');

const {
  processSingleMoment,
  concatenateCompilation,
  uploadCompilationToDrive,
} = require('./utils/compiler');

/**
 * Eksekusi Utama Kompilator Kuis Doksli
 * Mengorkestrasi konfigurasi, seleksi momen, dan looping pemrosesan per momen
 */
async function runQuizCompiler() {
  console.clear();
  console.log('================================================================');
  console.log('       🎬 AUTO EDIT KOMPILASI TEBAK-TEBAKAN DOKSLI              ');
  console.log('================================================================');

  // 1. Ambil dan validasi konfigurasi
  const config = getConfig();
  const transitionSfxPath = detectTransitionSfx(config.customTransitionSfx);
  printConfigBanner(config, transitionSfxPath);

  if (!config.doksliFolderId) {
    console.error('❌ [ERROR] ID Folder Google Drive (GDRIVE_DOKSLI_FOLDER_ID) belum diatur di .env!');
    console.error('   Silakan isi GDRIVE_DOKSLI_FOLDER_ID=<id_folder_gdrive_anda> pada .env');
    process.exit(1);
  }

  if (!config.gdriveToken) {
    console.error('❌ [ERROR] Kredensial Google (token.json) tidak ditemukan! Jalankan "npm run auth" terlebih dahulu.');
    process.exit(1);
  }

  // 2. Hubungkan ke Google Drive API
  const driveAuth = getGoogleAuth(config.gdriveToken, [
    'https://www.googleapis.com/auth/drive',
  ]);
  const drive = google.drive({ version: 'v3', auth: driveAuth });

  // 3. Seleksi momen unik dari Google Drive (Tahap 1 & 2)
  const validMoments = await selectQuizMoments(drive, config);

  // 4. Siapkan direktori kerja sementara & klip transisi penutup
  console.log('\n[TAHAP 3/4] Mengunduh dan merangkai alur klip (Cut -> Freeze Kuis -> Full Meme)...');
  const workDir = path.resolve(__dirname, 'temp_doksli_work');
  if (fs.existsSync(workDir)) {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
  fs.mkdirSync(workDir, { recursive: true });

  const transitionClips = prepareTransitionClips({
    transitionSfxPath,
    totalMoments: validMoments.length,
    transitionMode: config.transitionMode,
    showTransitionCounter: config.showTransitionCounter,
    transitionFontSize: config.transitionFontSize,
    workDir,
    ffmpegBin: config.ffmpegBin,
  });

  // 5. Looping pemrosesan per momen dengan Pipelined Pre-fetching
  // (Sambil FFmpeg merender Momen saat ini di CPU/GPU, Node.js mengunduh Momen berikutnya di background via Network I/O)
  const allCompilationClips = [];

  const startMomentDownload = (momentObj, idx) => {
    return downloadMomentVideos(drive, momentObj, workDir, idx, config.skipPrefix)
      .then((res) => ({ files: res, error: null }))
      .catch((err) => ({ files: null, error: err }));
  };

  // Mulai unduh Momen #1 sebelum iterasi pertama
  if (validMoments.length > 0) {
    console.log(`\n📥 [DOWNLOAD 1/${validMoments.length}] Mengunduh bahan klip pertama: "${validMoments[0].momentName}"...`);
  }
  let currentDownloadPromise = validMoments.length > 0 ? startMomentDownload(validMoments[0], 1) : null;

  for (let i = 0; i < validMoments.length; i++) {
    const moment = validMoments[i];
    const momentIndex = i + 1;
    const isLast = i === validMoments.length - 1;

    // Tunggu berkas momen saat ini selesai di-download
    const dlResult = currentDownloadPromise ? await currentDownloadPromise : null;

    if (!dlResult || dlResult.error) {
      const errMsg = dlResult?.error?.message || 'Download tidak menghasilkan berkas valid.';
      console.warn(`\n   ⚠️ [ERROR DOWNLOAD MOMEN #${momentIndex}] Gagal mengunduh berkas momen "${moment.momentName}": ${errMsg}`);
      continue;
    }

    console.log(`\n🎬 [MEMPROSES MOMEN ${momentIndex}/${validMoments.length}]: "${moment.momentName}"...`);

    // Sesaat setelah download momen saat ini siap dan pemrosesan dimulai,
    // SEGERA picu background download untuk momen berikutnya (i + 1) selagi FFmpeg merender momen saat ini!
    let nextDownloadPromise = null;
    if (!isLast) {
      const nextMoment = validMoments[i + 1];
      const nextIndex = i + 2;
      console.log(`   ⚡ [PREFETCH] Memulai download di background untuk Momen #${nextIndex}: "${nextMoment.momentName}"...`);
      nextDownloadPromise = startMomentDownload(nextMoment, nextIndex);
    }

    const momentClips = await processSingleMoment({
      drive,
      moment,
      momentIndex,
      totalMoments: validMoments.length,
      config,
      workDir,
      transitionClipPath: transitionClips[momentIndex] || null,
      transitionSfxPath,
      downloadedFiles: dlResult.files,
      isPrefetched: i > 0,
    });

    if (momentClips && momentClips.length > 0) {
      allCompilationClips.push(...momentClips);
    }

    // Sambungkan antrean download momen berikutnya untuk iterasi selanjutnya
    currentDownloadPromise = nextDownloadPromise;
  }

  if (allCompilationClips.length === 0) {
    console.error('❌ Tidak ada klip video yang berhasil diproses untuk kompilasi (seluruh momen di-skip atau gagal).');
    process.exit(1);
  }

  // 6. Penggabungan kompilasi final (Single-Pass 60 FPS)
  const outputDir = path.resolve(__dirname, 'output_kompilasi');
  const finalOutputPath = concatenateCompilation(
    allCompilationClips,
    workDir,
    outputDir,
    config.ffmpegBin
  );

  // 7. Auto-Upload ke Google Drive (jika diaktifkan)
  if (config.resultFolderId) {
    await uploadCompilationToDrive(drive, finalOutputPath, config.resultFolderId);
  }
}

// Jalankan script jika dipanggil langsung
if (require.main === module) {
  runQuizCompiler().catch((err) => {
    console.error('\n❌ Terjadi kesalahan saat memproses kompilasi kuis doksli:');
    console.error(err.message || err);
    process.exit(1);
  });
}

// Ekspor utilitas untuk kompatibilitas skrip/testing eksternal
module.exports = {
  createUniqueQuizOptions,
  generateDarkOverlayASS,
  generateQuizASS,
  generateTransitionASS,
  generateFullVideoASS,
  generateQuizSoundWav,
  getAudioDuration,
  cleanText,
  parseTimeToStandardTimestamp,
  formatTimestampToIndoTime,
  isSkippedItem,
  STATIC_FALLBACK_DISTRACTORS,
  findVideoPair,
  findMemeImage,
  getFullVideoDisplayText,
  findGameMomentPair,
  createUniqueEpisodeQuizOptions,
  promptGameSelection,
  selectSingleGameQuizMoments,
  selectQuizMoments,
  detectTransitionSfx,
  renderTransitionClip,
  prepareTransitionClips,
  downloadDriveFile,
  downloadMomentVideos,
  processSingleMoment,
  concatenateCompilation,
  uploadCompilationToDrive,
  runQuizCompiler,
  normalizeVideo,
};
