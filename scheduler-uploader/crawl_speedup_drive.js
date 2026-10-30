/**
 * ============================================================================
 * CRAWLER & GENERATOR SPEEDUP FULL VIDEO GOOGLE DRIVE (PROGRESIF 1 PER 1)
 * ============================================================================
 * Script pembantu untuk menelusuri seluruh klip Doksli di Google Drive,
 * mendeteksi video full (full.mp4), merender versi speedup dinamis (~5 detik,
 * rasio 9:16 vertikal, 60 FPS CFR, audio cempreng, dan overlay teks judul),
 * lalu LANGSUNG mengunggahnya 1 per 1 ke folder yang sama di Google Drive
 * dengan nama "speedup.mp4".
 *
 * Keunggulan Alur Progresif (1 per 1):
 * 1. Selesai 1 klip langsung diunggah ke Google Drive.
 * 2. Jika program dihentikan (Ctrl+C / early stop), hasil yang sudah diunggah
 *    tetap aman dan tersimpan di Google Drive.
 * 3. Ketika dijalankan kembali, klip yang sudah memiliki "speedup.mp4" otomatis
 *    dilewati (skip) sehingga proses berjalan efisien dan idempoten.
 * 4. Menyediakan berkas speedup.mp4 siap pakai untuk mempercepat compile_doksli
 *    tanpa perlu download ulang video full mentah dan tanpa render ulang FFmpeg.
 *
 * Penggunaan:
 *   node crawl_speedup_drive.js             # Mode interaktif progresif (tanya konfirmasi)
 *   node crawl_speedup_drive.js --dry-run   # Mode simulasi (hanya scan klip yang butuh speedup)
 *   node crawl_speedup_drive.js --yes       # Otomatis langsung eksekusi tanpa prompt
 *   node crawl_speedup_drive.js --game="X"  # Hanya proses klip untuk 1 game tertentu
 *   node crawl_speedup_drive.js --limit=5   # Batasi pemrosesan maksimal N klip
 *   node crawl_speedup_drive.js --force     # Paksa render ulang meskipun speedup.mp4 sudah ada
 * ============================================================================
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { google } = require('googleapis');

const {
  getConfig,
  getGoogleAuth,
} = require('./utils/config');

const {
  cleanText,
  isSkippedItem,
  getFullVideoDisplayText,
} = require('./utils/selector');

const {
  downloadDriveFile,
} = require('./utils/downloader');

const {
  getAudioDuration,
  normalizeVideo,
} = require('./utils/videoEditor');

const {
  generateFullVideoASS,
} = require('./utils/overlay');

/**
 * Prompt konfirmasi terminal interaktif
 */
function askConfirmation(question) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      return resolve('y');
    }
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

/**
 * Mengambil seluruh item berkas/folder di dalam suatu folder Google Drive dengan paginasi
 */
async function listAllFolderItems(drive, folderId) {
  const allFiles = [];
  let pageToken = null;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, size)',
      spaces: 'drive',
      pageSize: 100,
      pageToken: pageToken || undefined,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    if (res.data && Array.isArray(res.data.files)) {
      allFiles.push(...res.data.files);
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return allFiles;
}

/**
 * Mendeteksi berkas cut, full, dan speedup pada suatu daftar berkas di folder
 */
function detectClipFolderFiles(files) {
  const vidFiles = files.filter((f) => {
    return (
      (f.mimeType && f.mimeType.startsWith('video/')) ||
      /\.(mp4|mkv|mov|webm)$/i.test(f.name)
    );
  });

  const cutFile = vidFiles.find((f) => {
    const base = f.name.toLowerCase().replace(/^!+\s*/, '').replace(/\.[^.]+$/, '');
    return base === 'cut';
  });

  const speedupFile = vidFiles.find((f) => {
    const base = f.name.toLowerCase().replace(/^!+\s*/, '').replace(/\.[^.]+$/, '');
    return base === 'speedup';
  });

  const otherVideos = vidFiles.filter((f) => f.id !== cutFile?.id && f.id !== speedupFile?.id);
  const fullFile = otherVideos.length === 1 ? otherVideos[0] : null;

  return { cutFile, fullFile, speedupFile };
}

/**
 * Menelusuri seluruh hierarki folder Google Drive untuk menemukan klip kandidat speedup
 */
async function crawlForSpeedupCandidates(drive, folder, context, skipPrefix, results) {
  const items = await listAllFolderItems(drive, folder.id);
  const subFolders = items.filter(
    (item) => item.mimeType === 'application/vnd.google-apps.folder'
  );
  const files = items.filter(
    (item) => item.mimeType !== 'application/vnd.google-apps.folder'
  );

  // Kriteria folder klip:
  // 1. Sudah di dalam game
  // 2. BUKAN folder seri/episode
  // 3. Bernama dash ("-", "!-") ATAU berformat waktu ("00:xx:xx", "01:xx:xx") ATAU leaf folder
  const isSeriesFolder = /(^|[\s_!-])(eps|episode|part|season|chapter)\s*\d+/i.test(folder.name.trim());
  const isDashFolder = /^!?[-—–_]+$/.test(folder.name.trim());
  const isTimestampFolder = /^!?\d{1,2}:\d{2}:\d{2}$/.test(folder.name.trim());
  const isClipCandidate =
    context.gameName &&
    !isSeriesFolder &&
    (isDashFolder || isTimestampFolder || subFolders.length === 0);

  if (isClipCandidate) {
    const { cutFile, fullFile, speedupFile } = detectClipFolderFiles(files);

    // Folder klip valid minimal memiliki cutFile dan fullFile (atau sudah ada speedupFile)
    if (cutFile && (fullFile || speedupFile)) {
      results.push({
        gameName: context.gameName,
        epsName: context.epsName || '-',
        folderId: folder.id,
        folderName: folder.name,
        cutFile,
        fullFile: fullFile || speedupFile,
        speedupFile,
        hasSpeedup: !!speedupFile,
      });
      return;
    }
  }

  // Rekursif ke subfolder
  for (const sf of subFolders) {
    const isSfSeries = /(^|[\s_!-])(eps|episode|part|season|chapter)\s*\d+/i.test(sf.name.trim());
    let nextEpsName = context.epsName || '';
    if (isSfSeries) {
      nextEpsName = sf.name.trim();
    }
    const nextContext = {
      gameName: context.gameName || folder.name,
      epsName: nextEpsName,
    };
    await crawlForSpeedupCandidates(drive, sf, nextContext, skipPrefix, results);
  }
}

/**
 * Program Utama
 */
async function main() {
  console.log('========================================================================================');
  console.log('       ⚡ CRAWLER SPEEDUP DOKSLI GOOGLE DRIVE (PROGRESIF 1 PER 1)                      ');
  console.log('       Target Durasi: ~5 Detik (Auto Speed) | Format: 1080x1920 (9:16 Vertikal, 60 FPS)');
  console.log('========================================================================================\n');

  // 1. Konfigurasi & Opsi CLI
  const config = getConfig();
  let doksliFolderId = config.doksliFolderId;
  let targetGameFilter = null;
  let isDryRun = false;
  let autoConfirm = false;
  let forceRerender = false;
  let maxLimit = null;
  let withOverlay = true;

  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run' || arg === '--dry') isDryRun = true;
    if (arg === '--yes' || arg === '-y') autoConfirm = true;
    if (arg === '--force' || arg === '-f') forceRerender = true;
    if (arg === '--no-overlay') withOverlay = false;
    if (arg.startsWith('--game=')) targetGameFilter = arg.slice(arg.indexOf('=') + 1).trim();
    if (arg.startsWith('--folder=')) doksliFolderId = arg.slice(arg.indexOf('=') + 1).trim();
    if (arg.startsWith('--limit=')) maxLimit = parseInt(arg.slice(arg.indexOf('=') + 1).trim(), 10) || null;
    if (arg === '--help' || arg === '-h') {
      console.log('Opsi Argumen:');
      console.log('  --dry-run       : Mode simulasi (hanya scan klip tanpa download/upload)');
      console.log('  --yes, -y       : Langsung eksekusi tanpa konfirmasi manual');
      console.log('  --force, -f     : Paksa buat ulang speedup.mp4 meskipun sudah ada');
      console.log('  --no-overlay    : Render video speedup tanpa overlay teks judul');
      console.log('  --game="<nama>" : Hanya proses klip pada game tertentu');
      console.log('  --limit=<n>     : Batasi pemrosesan maksimal N klip');
      console.log('  --folder="<id>" : Override ID folder induk Doksli Google Drive');
      process.exit(0);
    }
  }

  if (!doksliFolderId) {
    console.error('❌ [ERROR] ID Folder Google Drive (GDRIVE_DOKSLI_FOLDER_ID) belum disetel di .env!');
    process.exit(1);
  }

  if (!config.gdriveToken) {
    console.error('❌ [ERROR] Kredensial Google (token.json) tidak ditemukan! Jalankan "npm run auth" terlebih dahulu.');
    process.exit(1);
  }

  console.log(`ℹ️ Menghubungkan ke Google Drive API...`);
  const driveAuth = getGoogleAuth(config.gdriveToken, ['https://www.googleapis.com/auth/drive']);
  const drive = google.drive({ version: 'v3', auth: driveAuth });

  console.log(`🔍 [TAHAP 1/3] Membaca daftar game di folder Doksli (ID: ${doksliFolderId})...`);
  const topItems = await listAllFolderItems(drive, doksliFolderId);
  let gameFolders = topItems.filter(
    (item) => item.mimeType === 'application/vnd.google-apps.folder' && !isSkippedItem(item.name, config.skipPrefix)
  );

  if (targetGameFilter) {
    const filterLower = targetGameFilter.toLowerCase();
    gameFolders = gameFolders.filter((gf) => gf.name.toLowerCase().includes(filterLower));
    console.log(`🎯 Memfilter game dengan kata kunci: "${targetGameFilter}" (${gameFolders.length} folder game cocok).`);
  }

  if (gameFolders.length === 0) {
    console.warn('⚠️ Tidak ada folder game yang ditemukan atau sesuai dengan filter.');
    process.exit(0);
  }

  console.log(`🔍 [TAHAP 2/3] Menelusuri seluruh klip dan mengecek keberadaan "speedup.mp4"...`);
  const crawlResults = [];
  for (let idx = 0; idx < gameFolders.length; idx++) {
    const g = gameFolders[idx];
    process.stdout.write(`   [${idx + 1}/${gameFolders.length}] Menelusuri game: "${g.name}"... `);
    const beforeCount = crawlResults.length;
    await crawlForSpeedupCandidates(drive, g, { gameName: g.name, epsName: '' }, config.skipPrefix, crawlResults);
    const foundInGame = crawlResults.length - beforeCount;
    console.log(`(${foundInGame} klip terdeteksi)`);
  }

  // Pisahkan antara yang sudah memiliki speedup.mp4 vs yang belum
  const alreadyHaveSpeedup = crawlResults.filter((c) => c.hasSpeedup && !forceRerender);
  let itemsToProcess = crawlResults.filter((c) => !c.hasSpeedup || forceRerender);

  if (maxLimit && maxLimit > 0) {
    itemsToProcess = itemsToProcess.slice(0, maxLimit);
  }

  console.log('\n========================================================================================');
  console.log('📋 RINGKASAN PENELUSURAN KLIP DOKSLI:');
  console.log('========================================================================================');
  console.log(` Total klip terdeteksi         : ${crawlResults.length} klip`);
  console.log(` Sudah memiliki speedup.mp4    : ${alreadyHaveSpeedup.length} klip (akan dilewati)`);
  console.log(` Perlu diproses speedup        : ${itemsToProcess.length} klip`);
  console.log(` Target durasi maksimal        : ${config.fullVideoMaxDuration || 5.0} detik (Auto Speed & Cempreng)`);
  console.log(` Overlay teks judul            : ${withOverlay ? 'Aktif (Bahasa Indonesia Alami)' : 'Nonaktif'}`);
  console.log('========================================================================================\n');

  if (itemsToProcess.length === 0) {
    console.log('🎉 Seluruh klip video di Google Drive sudah memiliki "speedup.mp4"!');
    console.log('   Semua berkas speedup siap digunakan oleh compile_doksli.');
    process.exit(0);
  }

  // Tampilkan daftar klip yang akan diproses
  console.log('DAFTAR KLIP YANG AKAN DIBUATKAN SPEEDUP.MP4:');
  console.log('----------------------------------------------------------------------------------------');
  console.log(
    'No.'.padEnd(4) +
    'Game'.padEnd(28) +
    'Episode / Folder'.padEnd(28) +
    'Video Sumber'.padEnd(30) +
    'Status'
  );
  console.log('----------------------------------------------------------------------------------------');

  itemsToProcess.forEach((item, i) => {
    const no = String(i + 1).padEnd(4);
    const gName = (item.gameName.length > 26 ? item.gameName.slice(0, 23) + '...' : item.gameName).padEnd(28);
    const folderPath = `${item.epsName} > ${item.folderName}`;
    const fPath = (folderPath.length > 26 ? folderPath.slice(0, 23) + '...' : folderPath).padEnd(28);
    const srcFile = (item.fullFile.name.length > 28 ? item.fullFile.name.slice(0, 25) + '...' : item.fullFile.name).padEnd(30);
    const status = item.hasSpeedup ? '[FORCE RERENDER]' : '[BELUM ADA]';
    console.log(`${no}${gName}${fPath}${srcFile}${status}`);
  });
  console.log('----------------------------------------------------------------------------------------\n');

  if (isDryRun) {
    console.log('ℹ️ [DRY RUN] Mode simulasi selesai. Tidak ada video yang diunduh, diedit, atau diunggah.');
    console.log('   Untuk mulai memproses secara nyata, jalankan kembali tanpa argumen --dry-run.');
    process.exit(0);
  }

  // Konfirmasi sebelum mulai
  if (!autoConfirm) {
    const answer = await askConfirmation(`⚠️ Mulai proses render & upload speedup.mp4 untuk ${itemsToProcess.length} klip di atas? (y/N): `);
    if (answer !== 'y' && answer !== 'yes') {
      console.log('❌ Dibatalkan oleh pengguna. Tidak ada video yang diproses.');
      process.exit(0);
    }
  }

  // 2. Direktori kerja lokal sementara
  const workDir = path.resolve(__dirname, 'temp_speedup_work');
  if (fs.existsSync(workDir)) {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
  fs.mkdirSync(workDir, { recursive: true });

  // Cleanup handler jika proses diinterupsi Ctrl+C
  const cleanupWorkDir = () => {
    try {
      if (fs.existsSync(workDir)) {
        fs.rmSync(workDir, { recursive: true, force: true });
      }
    } catch (_) {}
  };
  process.on('SIGINT', () => {
    console.log('\n\n⚠️ Proses dihentikan oleh pengguna (Ctrl+C).');
    console.log('   Klip yang sudah selesai diunggah sebelumnya tetap aman tersimpan di Google Drive.');
    cleanupWorkDir();
    process.exit(0);
  });

  // 3. Eksekusi Progresif 1 per 1 (Download -> Speedup -> Upload GDrive -> Hapus Temp)
  console.log('\n🚀 [TAHAP 3/3] Memulai pemrosesan progresif 1 per 1 (Download -> Speedup -> Upload GDrive)...');
  const targetMaxDuration = parseFloat(config.fullVideoMaxDuration) || 5.0;
  const ffmpegBin = config.ffmpegBin || 'ffmpeg';

  let successCount = 0;
  let failCount = 0;

  for (let idx = 0; idx < itemsToProcess.length; idx++) {
    const item = itemsToProcess[idx];
    const prefix = `[${idx + 1}/${itemsToProcess.length}] "${item.gameName}" (${item.epsName} > ${item.folderName})`;
    console.log(`\n----------------------------------------------------------------------------------------`);
    console.log(`🎬 ${prefix}`);
    console.log(`   Sumber File: "${item.fullFile.name}" (ID: ${item.fullFile.id})`);

    const rawFullPath = path.join(workDir, `raw_full_${idx}.mp4`);
    const localSpeedupPath = path.join(workDir, `speedup_${idx}.mp4`);
    const assSubtitlePath = path.join(workDir, `speedup_overlay_${idx}.ass`);

    try {
      // Langkah 1: Unduh video full sumber dari Google Drive
      process.stdout.write(`   1. 📥 Mengunduh video full dari Google Drive... `);
      await downloadDriveFile(drive, item.fullFile.id, rawFullPath);
      console.log('✅ Selesai');

      // Langkah 2: Hitung durasi dan kalkulasi rasio akselerasi dinamis (Auto Speed)
      const rawDur = getAudioDuration(rawFullPath, ffmpegBin);
      let clipSpeed = 1.0;
      if (rawDur > targetMaxDuration) {
        clipSpeed = Math.round((rawDur / targetMaxDuration) * 100) / 100;
        console.log(`   2. ⚡ Durasi awal: ${rawDur.toFixed(2)}s > ${targetMaxDuration}s -> Auto Speed: ${clipSpeed}x (~${(rawDur / clipSpeed).toFixed(2)}s, Audio Cempreng)`);
      } else {
        console.log(`   2. ⚡ Durasi awal: ${rawDur.toFixed(2)}s <= ${targetMaxDuration}s -> Kecepatan normal 1.0x (Sudah under 5 detik)`);
      }

      // Langkah 3: Siapkan Subtitle ASS untuk teks overlay video full
      let appliedAssPath = null;
      if (withOverlay) {
        const displayText = getFullVideoDisplayText(item.epsName, item.fullFile.name, item.folderName);
        fs.writeFileSync(
          assSubtitlePath,
          generateFullVideoASS({
            text: displayText,
            durationSeconds: 600,
            posY: config.memeTextY || 360,
          }),
          'utf8'
        );
        appliedAssPath = assSubtitlePath;
        console.log(`   3. 📝 Overlay teks meme: "${displayText}"`);
      }

      // Langkah 4: Render video 1080x1920 60 FPS CFR dengan akselerasi dan audio pitch shift
      process.stdout.write(`   4. 🛠️ Merender speedup.mp4 dengan FFmpeg... `);
      normalizeVideo({
        inputPath: rawFullPath,
        outputPath: localSpeedupPath,
        assSubtitlePath: appliedAssPath,
        speed: clipSpeed,
        ffmpegBin,
      });
      console.log('✅ Render Selesai');

      // Langkah 5: Unggah berkas speedup.mp4 langsung ke Google Drive di folder yang sama
      process.stdout.write(`   5. ☁️ Mengunggah "speedup.mp4" ke Google Drive... `);

      // Jika mode --force dan speedupFile sudah ada sebelumnya, hapus/update
      if (item.speedupFile && forceRerender) {
        try {
          await drive.files.delete({ fileId: item.speedupFile.id, supportsAllDrives: true });
        } catch (_) {}
      }

      const fileMetadata = {
        name: 'speedup.mp4',
        parents: [item.folderId],
      };
      const media = {
        mimeType: 'video/mp4',
        body: fs.createReadStream(localSpeedupPath),
      };

      const uploadRes = await drive.files.create({
        requestBody: fileMetadata,
        media,
        fields: 'id, name, webViewLink, size',
        supportsAllDrives: true,
      });

      console.log(`✅ Sukses (ID: ${uploadRes.data.id})`);
      successCount++;

      // Langkah 6: Langsung bersihkan berkas lokal sementara untuk klip ini
      try {
        if (fs.existsSync(rawFullPath)) fs.unlinkSync(rawFullPath);
        if (fs.existsSync(localSpeedupPath)) fs.unlinkSync(localSpeedupPath);
        if (fs.existsSync(assSubtitlePath)) fs.unlinkSync(assSubtitlePath);
      } catch (_) {}

      // Jeda ringan antar panggilan Google API
      await new Promise((resolve) => setTimeout(resolve, 250));
    } catch (err) {
      failCount++;
      console.log(`❌ GAGAL: ${err.message}`);

      // Bersihkan file sementara jika error
      try {
        if (fs.existsSync(rawFullPath)) fs.unlinkSync(rawFullPath);
        if (fs.existsSync(localSpeedupPath)) fs.unlinkSync(localSpeedupPath);
        if (fs.existsSync(assSubtitlePath)) fs.unlinkSync(assSubtitlePath);
      } catch (_) {}
    }
  }

  cleanupWorkDir();

  console.log('\n========================================================================================');
  console.log('🎉 PROSES GENERASI & UPLOAD SPEEDUP.MP4 SELESAI!');
  console.log('========================================================================================');
  console.log(` Berhasil diunggah ke Google Drive : ${successCount} klip`);
  if (failCount > 0) {
    console.log(` Gagal diproses                    : ${failCount} klip`);
    console.log(` ℹ️ Anda dapat menjalankan kembali script ini untuk mencoba kembali klip yang gagal.`);
  }
  console.log('========================================================================================\n');
}

main().catch((err) => {
  console.error('\n❌ Terjadi kesalahan fatal:', err.message);
  process.exit(1);
});
