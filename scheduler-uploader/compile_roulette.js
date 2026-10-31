/**
 * ============================================================================
 * KOMPILASI GUDANG DOKSLI: MULTI-LANE HORIZONTAL ROULETTE EDITION
 * ============================================================================
 * Alur Kompilasi Roulette:
 * 1. Menampilkan X jalur roulette horizontal yang ditumpuk secara vertikal
 *    (tinggi total 80% dari kanvas 9:16 vertikal, terpusat vertikal di Y = 192 s/d 1728).
 * 2. Seluruh jalur roulette langsung berputar horizontal secara simultan sejak detik 0.
 * 3. Satu per satu jalur berhenti bergantian secara estafet:
 *    - Jalur #1 melambat (cubic ease-out) dan berhenti mengunci kartu yang ditunjuk pointer tengah.
 *    - Jalur lainnya tetap aktif bergerak berputar.
 * 4. Setelah jalur berhenti, layar menampilkan video full speedup (~5 detik)
 *    dari momen terpilih dengan transisi fade-in dan fade-out mulus.
 * 5. Setelah fade-out selesai, layar kembali ke roulette:
 *    - Jalur yang sudah berhenti tetap diam di posisinya.
 *    - Jalur berikutnya melambat dan berhenti mengunci kartu momen kedua.
 * 6. Diulangi sampai seluruh X momen selesai, lalu digabungkan menjadi 1 video
 *    kompilasi utuh 60 FPS CFR tanpa lag atau jeda.
 *
 * Penggunaan:
 *   node compile_roulette.js             # Jalankan kompilasi roulette interaktif
 *   node compile_roulette.js --dry-run   # Mode simulasi (seleksi momen tanpa render)
 *   node compile_roulette.js --count=5   # Tentukan jumlah momen roulette (default dari .env)
 *   node compile_roulette.js --game="X"  # Mode roulette edisi 1 game khusus
 *   node compile_roulette.js --yes       # Langsung proses tanpa prompt terminal
 * ============================================================================
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const { google } = require('googleapis');

const {
  getConfig,
  getGoogleAuth,
} = require('./utils/config');

const {
  selectQuizMoments,
  selectSingleGameQuizMoments,
  getFullVideoDisplayText,
  cleanText,
  isSkippedItem,
} = require('./utils/selector');

const {
  downloadDriveFile,
  downloadMomentVideos,
} = require('./utils/downloader');

const {
  concatenateCompilation,
  uploadCompilationToDrive,
} = require('./utils/compiler');

const {
  downloadMemeImagesPool,
  buildLaneRibbons,
  renderRouletteSpinSegment,
  renderSpeedupClipWithFade,
} = require('./utils/rouletteEditor');

/**
 * Program Utama Kompilasi Roulette
 */
async function main() {
  console.log('========================================================================================');
  console.log('       🎰 KOMPILASI DOKSLI: MULTI-LANE HORIZONTAL ROULETTE                             ');
  console.log('       Format: 1080x1920 (9:16 Vertikal, 60 FPS CFR) | Durasi Speedup: ~5 Detik        ');
  console.log('========================================================================================\n');

  // 1. Konfigurasi & Opsi CLI
  const config = getConfig();
  let clipCountTarget = parseInt(config.quizClipCount, 10) || 5;
  let targetGameName = null;
  let isDryRun = false;
  let autoConfirm = false;

  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run' || arg === '--dry') isDryRun = true;
    if (arg === '--yes' || arg === '-y') autoConfirm = true;
    if (arg.startsWith('--count=')) clipCountTarget = parseInt(arg.slice(arg.indexOf('=') + 1).trim(), 10) || clipCountTarget;
    if (arg.startsWith('--game=')) targetGameName = arg.slice(arg.indexOf('=') + 1).trim();
    if (arg === '--help' || arg === '-h') {
      console.log('Opsi Argumen:');
      console.log('  --count=<n>     : Jumlah momen / jalur roulette (contoh: --count=5)');
      console.log('  --game="<nama>" : Mode roulette khusus untuk 1 game tertentu');
      console.log('  --dry-run       : Mode simulasi (seleksi momen tanpa mengunduh/merender)');
      console.log('  --yes, -y       : Langsung eksekusi tanpa konfirmasi');
      process.exit(0);
    }
  }

  config.quizClipCount = clipCountTarget;

  if (!config.gdriveToken) {
    console.error('❌ [ERROR] Kredensial Google (token.json) tidak ditemukan! Jalankan "npm run auth" terlebih dahulu.');
    process.exit(1);
  }

  const driveAuth = getGoogleAuth(config.gdriveToken, ['https://www.googleapis.com/auth/drive']);
  const drive = google.drive({ version: 'v3', auth: driveAuth });

  // 2. Seleksi Momen Doksli dari Google Drive
  console.log(`🔍 [TAHAP 1/4] Menyeleksi ${clipCountTarget} momen Doksli dari Google Drive...`);
  let validMoments = [];
  if (targetGameName) {
    validMoments = await selectSingleGameQuizMoments(drive, config, targetGameName, {
      requireCut: false,
      requireMemeImage: true,
    });
  } else {
    validMoments = await selectQuizMoments(drive, config, {
      requireCut: false,
      requireMemeImage: true,
    });
  }

  if (!validMoments || validMoments.length === 0) {
    console.error('❌ Tidak ada momen Doksli yang memenuhi syarat untuk dijadikan kompilasi roulette.');
    process.exit(1);
  }

  const laneCount = validMoments.length;
  console.log(`\n📋 Terpilih ${laneCount} momen untuk dijadikan ${laneCount} jalur roulette horizontal:`);
  validMoments.forEach((m, idx) => {
    const disp = m.fullVideoDisplayText.replace(/\n/g, ' - ');
    console.log(`   ${idx + 1}. [Jalur #${idx + 1}] "${m.gameName}" (${disp})`);
  });

  if (isDryRun) {
    console.log('\nℹ️ [DRY RUN] Mode simulasi selesai. Momen berhasil diseleksi.');
    console.log('   Untuk merender video roulette secara utuh, jalankan kembali tanpa --dry-run.');
    process.exit(0);
  }

  // 3. Direktori Kerja Lokal Sementara
  const workDir = path.resolve(__dirname, 'temp_roulette_work');
  if (fs.existsSync(workDir)) {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
  fs.mkdirSync(workDir, { recursive: true });

  const cleanupWorkDir = () => {
    try {
      if (fs.existsSync(workDir)) {
        fs.rmSync(workDir, { recursive: true, force: true });
      }
    } catch (_) {}
  };

  process.on('SIGINT', () => {
    console.log('\n\n⚠️ Proses dihentikan oleh pengguna (Ctrl+C). Membersihkan file kerja sementara...');
    cleanupWorkDir();
    process.exit(0);
  });

  // 4. Unduh Pool Gambar Meme 1:1 untuk Kartu-Kartu Roulette
  console.log(`\n📦 [TAHAP 2/4] Menyiapkan pool kartu gambar dan mengunduh video full speedup...`);
  const imagePool = await downloadMemeImagesPool(drive, config.doksliFolderId, workDir, 30);

  // Unduh gambar meme spesifik untuk masing-masing momen jika ada di foldernya
  for (let i = 0; i < laneCount; i++) {
    const m = validMoments[i];
    if (m.memeImageFile && m.memeImageFile.id) {
      const ext = path.extname(m.memeImageFile.name) || '.jpg';
      const localMemePath = path.join(workDir, `moment_meme_${i}${ext}`);
      try {
        await downloadDriveFile(drive, m.memeImageFile.id, localMemePath);
        m.localMemeImagePath = localMemePath;
      } catch (e) {
        m.localMemeImagePath = null;
      }
    }
  }

  // 5. Bangun Pita Horizontal (Ribbon) & Pointer Indikator Tengah
  // Total tinggi roulette = 80% dari 1920 = 1536 px (terpusat vertikal di Y = 192)
  const totalRouletteHeight = 1536;
  const laneHeight = Math.floor(totalRouletteHeight / laneCount);
  console.log(`   📐 Dimensi: ${laneCount} jalur horizontal, tinggi per jalur: ${laneHeight} px, terpusat vertikal (Y: 192 - 1728).`);

  const ribbons = buildLaneRibbons({
    imagePool,
    moments: validMoments,
    laneCount,
    laneHeight,
    workDir,
    ffmpegBin: config.ffmpegBin,
  });

  // 6. Merender Rangkaian Segmen: [Roulette Spin #k] -> [Speedup Video #k dengan Freeze Fade]
  console.log(`\n🎬 [TAHAP 3/4] Merender animasi roulette dan merangkai klip speedup dengan freeze fade...`);
  const allCompilationClips = [];

  for (let k = 0; k < laneCount; k++) {
    const moment = validMoments[k];
    const momentIndex = k + 1;
    console.log(`\n----------------------------------------------------------------------------------------`);
    console.log(`🎰 [MOMEN ${momentIndex}/${laneCount}]: "${moment.gameName}"`);

    // Bagian A: Render Animasi Putaran Roulette untuk Momen k
    // Jalur 0 .. k-1 tetap diam terkunci, Jalur k melambat dan mengunci, Jalur k+1 .. end tetap berputar
    const spinDuration = parseFloat(config.rouletteSpinDuration) || 4.4;
    const lockDuration = parseFloat(config.rouletteLockDuration) || 1.0;
    const stopTime = Math.max(0.5, Math.round((spinDuration - lockDuration) * 10) / 10);

    console.log(`   1. 🎡 Merender putaran roulette (durasi: ${spinDuration}s, deselerasi: ${stopTime}s, lock kartu: ${lockDuration}s)...`);
    const spinOutputPath = path.join(workDir, `roulette_segment_${momentIndex}.mp4`);
    renderRouletteSpinSegment({
      segmentIndex: momentIndex,
      currentMomentIndex: k,
      laneCount,
      laneHeight,
      ribbons,
      outputPath: spinOutputPath,
      workDir,
      ffmpegBin: config.ffmpegBin,
      spinDuration,
      stopTime,
    });
    allCompilationClips.push(spinOutputPath);
    console.log(`      ✅ Segmen putaran roulette #${momentIndex} siap.`);

    // Ekstrak frame terakhir papan roulette yang berhenti untuk latar belakang fade klip speedup
    const bgStillPath = path.join(workDir, `roulette_still_${momentIndex}.jpg`);
    try {
      spawnSync(
        config.ffmpegBin,
        ['-y', '-sseof', '-0.1', '-i', spinOutputPath, '-update', '1', '-frames:v', '1', '-q:v', '2', bgStillPath],
        { stdio: 'ignore' }
      );
    } catch (_) {}

    // Bagian B: Unduh dan Siapkan Video Full Speedup dengan Freeze Fade-In & Freeze Fade-Out
    console.log(`   2. 📥 Mengunduh video full speedup untuk Momen #${momentIndex}...`);
    let rawVideoPath = path.join(workDir, `raw_full_${momentIndex}.mp4`);

    // Prioritaskan speedup.mp4 siap pakai jika ada di Drive
    if (moment.speedupFile && !isSkippedItem(moment.speedupFile.name, config.skipPrefix)) {
      console.log(`      ⚡ Mengunduh "speedup.mp4" langsung dari Google Drive...`);
      await downloadDriveFile(drive, moment.speedupFile.id, rawVideoPath);
    } else {
      console.log(`      📥 Mengunduh "${moment.fullFile.name}" dari Google Drive...`);
      await downloadDriveFile(drive, moment.fullFile.id, rawVideoPath);
    }

    const fadeDur = config.rouletteFadeDuration || 0.5;
    const freezeDur = config.rouletteFreezeDuration !== undefined ? config.rouletteFreezeDuration : 0.5;
    console.log(`   3. ✂️ Menyiapkan video speedup (fade-in: ${fadeDur}s, freeze awal: ${freezeDur}s, fade-out: ${fadeDur}s)...`);
    const fadedSpeedupPath = path.join(workDir, `faded_speedup_${momentIndex}.mp4`);
    renderSpeedupClipWithFade({
      rawVideoPath,
      outputPath: fadedSpeedupPath,
      moment,
      workDir,
      config,
      bgStillPath,
      ffmpegBin: config.ffmpegBin,
    });
    allCompilationClips.push(fadedSpeedupPath);
    console.log(`      ✅ Video full speedup #${momentIndex} siap.`);

    // Bersihkan file video mentah lokal momen ini
    try {
      if (fs.existsSync(rawVideoPath)) fs.unlinkSync(rawVideoPath);
      if (fs.existsSync(bgStillPath)) fs.unlinkSync(bgStillPath);
    } catch (_) {}
  }

  // 7. Penggabungan Single-Pass Concat Copy 60 FPS
  console.log(`\n🎞️ [TAHAP 4/4] Menggabungkan seluruh segmen roulette & speedup (Single-Pass 60 FPS)...`);
  const outputDir = path.resolve(__dirname, 'final_roulette_output');
  const finalVideoPath = concatenateCompilation(
    allCompilationClips,
    workDir,
    outputDir,
    config.ffmpegBin
  );

  // 8. Unggah ke Google Drive (jika GDRIVE_RESULT_FOLDER_ID tersedia)
  if (config.resultFolderId) {
    console.log('\n☁️ Mengunggah video kompilasi roulette ke Google Drive...');
    await uploadCompilationToDrive(drive, finalVideoPath, config.resultFolderId);
  } else {
    console.log('ℹ️ GDRIVE_RESULT_FOLDER_ID tidak disetel, video lokal tersimpan di folder output.');
  }

  cleanupWorkDir();
  console.log('\n========================================================================================');
  console.log('🎉 KOMPILASI GUDANG DOKSLI ROULETTE BERHASIL SELESAI!');
  console.log('========================================================================================\n');
}

main().catch((err) => {
  console.error('\n❌ Terjadi kesalahan fatal:', err.message);
  process.exit(1);
});
