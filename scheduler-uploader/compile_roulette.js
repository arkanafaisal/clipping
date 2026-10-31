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

  // 4. Unduh Pool Gambar Meme 1:1 & Seluruh Video Full Speedup Momen Terpilih
  console.log(`\n📦 [TAHAP 2/4] Mengunduh aset kartu roulette dan video full speedup dari Google Drive...`);
  const imagePool = await downloadMemeImagesPool(drive, config.doksliFolderId, workDir, 30);

  // Unduh gambar kartu dan video untuk masing-masing momen dari Drive
  for (let i = 0; i < laneCount; i++) {
    const m = validMoments[i];
    const momentIndex = i + 1;
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

    // Unduh video full / speedup
    const rawVideoPath = path.join(workDir, `raw_full_${momentIndex}.mp4`);
    if (m.speedupFile && !isSkippedItem(m.speedupFile.name, config.skipPrefix)) {
      console.log(`   ⚡ Mengunduh speedup "${m.gameName}" langsung dari Google Drive...`);
      await downloadDriveFile(drive, m.speedupFile.id, rawVideoPath);
    } else {
      console.log(`   📥 Mengunduh video full "${m.gameName}" dari Google Drive...`);
      await downloadDriveFile(drive, m.fullFile.id, rawVideoPath);
    }
    m.localRawVideoPath = rawVideoPath;
  }

  // 5. Bangun Pita Horizontal (Ribbon) yang Kontinu
  const totalRouletteHeight = 1536;
  const laneHeight = Math.floor(totalRouletteHeight / laneCount);
  console.log(`\n   📐 Dimensi: ${laneCount} jalur horizontal, tinggi per jalur: ${laneHeight} px, terpusat vertikal (Y: 192 - 1728).`);

  const spinDuration = parseFloat(config.rouletteSpinDuration) || 4.4;
  const lockDuration = parseFloat(config.rouletteLockDuration) || 1.0;
  const maxSpeed = parseFloat(config.rouletteMaxSpeed) || 3600;
  const stopTime = Math.max(0.5, Math.round((spinDuration - lockDuration) * 10) / 10);

  const ribbons = buildLaneRibbons({
    imagePool,
    moments: validMoments,
    laneCount,
    laneHeight,
    rouletteItems: config.rouletteItems || 5,
    maxSpeed,
    spinDuration,
    lockDuration,
    workDir,
    ffmpegBin: config.ffmpegBin,
  });

  // 6. TAHAP 3A: Render Seluruh Animasi Putaran Roulette Terlebih Dahulu (Create Dulu di Awal)
  console.log(`\n🎡 [TAHAP 3A/4] Merender seluruh putaran roulette terlebih dahulu (${laneCount} segmen kontinu, zero-jumping)...`);
  const spinClips = [];
  const stillSnapshots = [];

  for (let k = 0; k < laneCount; k++) {
    const moment = validMoments[k];
    const momentIndex = k + 1;
    console.log(`   🎡 [Segmen ${momentIndex}/${laneCount}] Putaran roulette "${moment.gameName}" (durasi: ${spinDuration}s, deselerasi: ${stopTime}s, lock: ${lockDuration}s)...`);
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
      maxSpeed,
    });
    spinClips.push(spinOutputPath);

    // Ambil snapshot frame terakhir papan roulette yang berhenti untuk background transisi speedup
    const bgStillPath = path.join(workDir, `roulette_still_${momentIndex}.jpg`);
    try {
      spawnSync(
        config.ffmpegBin,
        ['-y', '-sseof', '-0.1', '-i', spinOutputPath, '-update', '1', '-frames:v', '1', '-q:v', '2', bgStillPath],
        { stdio: 'ignore' }
      );
    } catch (_) {}
    stillSnapshots.push(bgStillPath);
    console.log(`      ✅ Segmen putaran roulette #${momentIndex} & snapshot still siap.`);
  }

  // 7. TAHAP 3B: Render Seluruh Klip Speedup Video dengan Freeze Fade-In & Freeze Fade-Out
  console.log(`\n🎬 [TAHAP 3B/4] Merangkai video full speedup dengan Freeze Fade di atas snapshot papan roulette...`);
  const speedupClips = [];
  const fadeDur = config.rouletteFadeDuration || 0.5;
  const freezeDur = config.rouletteFreezeDuration !== undefined ? config.rouletteFreezeDuration : 0.5;
  const boardFreezeDur = config.rouletteBoardFreeze !== undefined ? config.rouletteBoardFreeze : 0.5;

  for (let k = 0; k < laneCount; k++) {
    const moment = validMoments[k];
    const momentIndex = k + 1;
    console.log(`   ✂️ [Klip ${momentIndex}/${laneCount}] Menyiapkan speedup "${moment.gameName}" (board freeze: ${boardFreezeDur}s, fade: ${fadeDur}s, freeze doksli: ${freezeDur}s)...`);
    const fadedSpeedupPath = path.join(workDir, `faded_speedup_${momentIndex}.mp4`);
    renderSpeedupClipWithFade({
      rawVideoPath: moment.localRawVideoPath,
      outputPath: fadedSpeedupPath,
      moment,
      workDir,
      config,
      bgStillPath: stillSnapshots[k],
      ffmpegBin: config.ffmpegBin,
    });
    speedupClips.push(fadedSpeedupPath);
    console.log(`      ✅ Video full speedup #${momentIndex} siap.`);

    // Bersihkan file mentah lokal momen ini
    try {
      if (fs.existsSync(moment.localRawVideoPath)) fs.unlinkSync(moment.localRawVideoPath);
    } catch (_) {}
  }

  // 8. Rangkai Seluruh Segmen Berselingan: [Spin 1] -> [Speedup 1] -> [Spin 2] -> [Speedup 2]...
  const allCompilationClips = [];
  for (let k = 0; k < laneCount; k++) {
    allCompilationClips.push(spinClips[k]);
    allCompilationClips.push(speedupClips[k]);
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
