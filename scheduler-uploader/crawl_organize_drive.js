/**
 * ============================================================================
 * CRAWLER & PENGORGANISIR FOLDER DOKSLI GOOGLE DRIVE
 * ============================================================================
 * Script pembantu untuk menelusuri (crawl) seluruh folder di dalam folder Doksli
 * Google Drive, menemukan setiap folder klip yang berisi pasangan video (cut.mp4 & video full),
 * lalu:
 * 1. Mengubah nama folder klip (parent) dari "-" menjadi format angka jam standar
 *    "HH:MM:SS" (misal: "00:39:35", "01:12:05") berdasarkan nama video full sebelumnya.
 *    - Ketika jamnya 0, tetap ditulis "00:" agar panjang karakter seragam (8 karakter)
 *      sehingga fitur Sort by Name bawaan Google Drive (ASCII leksikografis) menyortir
 *      klip dalam urutan kronologis yang 100% presisi.
 *    - Memudahkan membedakan antara folder seri (diawali teks "eps x" / nama seri)
 *      dengan folder klip video (diawali angka "00:xx:xx" / "01:xx:xx").
 * 2. Setelah nama folder terkonfirmasi berhasil diubah di Google Drive, barulah
 *    file video full diubah namanya menjadi "full.mp4".
 * 3. Tetap mematuhi aturan skip: folder/file yang diawali '!' (atau SKIP_PREFIX)
 *    otomatis dilewati dan tidak akan disentuh.
 *
 * Penggunaan:
 *   node crawl_organize_drive.js             # Mode interaktif (tampilkan tabel & tanya konfirmasi)
 *   node crawl_organize_drive.js --dry-run   # Mode simulasi (hanya scan tanpa mengubah apapun di GDrive)
 *   node crawl_organize_drive.js --yes       # Otomatis konfirmasi tanpa prompt terminal
 *   node crawl_organize_drive.js --game="X"  # Hanya scan untuk 1 game tertentu
 * ============================================================================
 */

const readline = require('readline');
const path = require('path');
const { google } = require('googleapis');

const {
  getConfig,
  getGoogleAuth,
} = require('./utils/config');

const {
  cleanText,
  parseTimeToStandardTimestamp,
  isSkippedItem,
} = require('./utils/selector');

/**
 * Helper prompt konfirmasi terminal interaktif
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
      fields: 'nextPageToken, files(id, name, mimeType)',
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
 * Mendeteksi apakah daftar berkas memiliki pasangan video (cut.* dan video full)
 */
function detectVideoPair(files) {
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

  const otherVideos = vidFiles.filter((f) => f.id !== cutFile?.id);
  const fullFile = otherVideos.length === 1 ? otherVideos[0] : null;

  return { cutFile, fullFile, totalVideos: vidFiles.length };
}

/**
 * Menelusuri seluruh hierarki folder game secara rekursif
 */
async function crawlFolderRecursive(drive, folder, context, skipPrefix, results) {
  const items = await listAllFolderItems(drive, folder.id);
  const subFolders = items.filter(
    (item) => item.mimeType === 'application/vnd.google-apps.folder'
  );
  const files = items.filter(
    (item) => item.mimeType !== 'application/vnd.google-apps.folder'
  );

  // Periksa apakah folder ini adalah folder klip yang berisi pasangan video (cut.* + video full)
  // Syarat folder klip:
  // 1. Berada di dalam game (context.gameName sudah ada)
  // 2. BUKAN folder seri/episode (misal bukan "eps 1", "part 2", "!eps 1")
  // 3. Tidak memiliki subfolder lagi (leaf folder) ATAU bernama "-" / "!-"
  const isSeriesFolder = /(^|[\s_!-])(eps|episode|part|season|chapter)\s*\d+/i.test(folder.name.trim());
  const isDashFolder = /^!?[-—–_]+$/.test(folder.name.trim());
  const cleanFolderName = folder.name.trim().replace(/^!+\s*/, '');
  const isTimestampFolder =
    /^!?\d{1,2}:\d{2}:\d{2}$/.test(folder.name.trim()) ||
    parseTimeToStandardTimestamp(cleanFolderName) !== cleanFolderName;
  const isClipCandidate =
    context.gameName &&
    !isSeriesFolder &&
    (isDashFolder || isTimestampFolder);

  if (isClipCandidate) {
    const { cutFile, fullFile } = detectVideoPair(files);

    if (cutFile && fullFile) {
      const fullBase = fullFile.name.toLowerCase().replace(/^!+\s*/, '').replace(/\.[^.]+$/, '');
      const ext = path.extname(fullFile.name) || '.mp4';
      const isFullAlready = fullBase === 'full';

      // Cek apakah folder saat ini memiliki prefix skip '!' (misal "!-" atau "! 00:xx:xx")
      const isFolderSkipped = folder.name.trim().startsWith('!');

      // Hitung target nama folder dan target nama file
      let targetFolderName = folder.name;
      if (!isFullAlready) {
        const rawTs = parseTimeToStandardTimestamp(fullFile.name).replace(/^!+/, '');
        targetFolderName = isFolderSkipped ? `!${rawTs}` : rawTs;
      } else if (cleanFolderName === '-' || /^[-—–_]+$/.test(cleanFolderName)) {
        // Jika file sudah 'full.mp4' tapi nama folder masih '-' atau '!-'
        targetFolderName = folder.name;
      }

      const targetFileName = `full${ext}`;

      const folderNeedsRename = folder.name.trim() !== targetFolderName;
      const fileNeedsRename = fullFile.name.trim() !== targetFileName;
      const isAlreadyOrganized = isFullAlready && !folderNeedsRename;

      results.push({
        gameName: context.gameName,
        epsName: context.epsName || '-',
        folderId: folder.id,
        currentFolderName: folder.name,
        newFolderName: targetFolderName,
        folderNeedsRename,
        fileId: fullFile.id,
        currentFileName: fullFile.name,
        newFileName: targetFileName,
        fileNeedsRename,
        isAlreadyOrganized,
        cutFileName: cutFile.name,
      });

      // Selesai memeriksa folder klip ini (tidak perlu menelusuri subfolder lebih dalam lagi)
      return;
    }
  }

  // Jika belum menemukan pasangan video di folder ini, lanjutkan menelusuri subfolder-subfoldernya
  for (const sf of subFolders) {
    const nextContext = {
      gameName: context.gameName || folder.name,
      epsName: context.gameName
        ? (context.epsName ? `${context.epsName} > ${sf.name}` : sf.name)
        : '',
    };
    await crawlFolderRecursive(drive, sf, nextContext, skipPrefix, results);
  }
}

/**
 * Program Utama Crawler & Pengorganisir Folder Doksli
 */
async function main() {
  console.clear();
  console.log('========================================================================================');
  console.log('       📁 CRAWLER & PENGORGANISIR FOLDER DOKSLI GOOGLE DRIVE                           ');
  console.log('       Format Folder: "HH:MM:SS" (Zero-Padded) | Format Video: "full.mp4"             ');
  console.log('========================================================================================\n');

  // 1. Baca Konfigurasi & Argumen CLI
  const config = getConfig();
  let doksliFolderId = config.doksliFolderId;
  let targetGameFilter = null;
  let isDryRun = false;
  let autoConfirm = false;

  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run' || arg === '--dry') isDryRun = true;
    if (arg === '--yes' || arg === '-y') autoConfirm = true;
    if (arg.startsWith('--game=')) targetGameFilter = arg.slice(arg.indexOf('=') + 1).trim();
    if (arg.startsWith('--folder=')) doksliFolderId = arg.slice(arg.indexOf('=') + 1).trim();
    if (arg === '--help' || arg === '-h') {
      console.log('Opsi Argumen:');
      console.log('  --dry-run       : Mode simulasi (hanya scan tanpa mengubah apapun di GDrive)');
      console.log('  --yes, -y       : Lewati tanya konfirmasi dan langsung terapkan perubahan');
      console.log('  --game="<nama>" : Hanya telusuri folder game tertentu');
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
    gameFolders = gameFolders.filter((g) => g.name.toLowerCase().includes(filterLower));
    console.log(`🎯 Memfilter game dengan kata kunci "${targetGameFilter}" (Ditemukan: ${gameFolders.length} game)`);
  }

  if (gameFolders.length === 0) {
    console.error('❌ Tidak ada folder game yang ditemukan di Google Drive.');
    process.exit(1);
  }

  console.log(`   Ditemukan ${gameFolders.length} folder game.`);
  console.log(`🔍 [TAHAP 2/3] Menelusuri seluruh subfolder dan mendeteksi pasangan video (cut.mp4 + video full)...`);

  const crawlResults = [];
  for (let idx = 0; idx < gameFolders.length; idx++) {
    const g = gameFolders[idx];
    process.stdout.write(`   [${idx + 1}/${gameFolders.length}] Menelusuri game: "${g.name}"... `);
    const beforeCount = crawlResults.length;
    await crawlFolderRecursive(drive, g, { gameName: g.name, epsName: '' }, config.skipPrefix, crawlResults);
    const foundInGame = crawlResults.length - beforeCount;
    console.log(`(${foundInGame} klip terdeteksi)`);
  }

  const itemsToMigrate = crawlResults.filter((item) => item.folderNeedsRename || item.fileNeedsRename);
  const alreadyMigrated = crawlResults.filter((item) => item.isAlreadyOrganized);

  console.log('\n========================================================================================');
  console.log('📋 RINGKASAN HASIL PENELUSURAN FOLDER:');
  console.log('========================================================================================');
  console.log(` Total klip ditemukan       : ${crawlResults.length} klip`);
  console.log(` Klip sudah terorganisir    : ${alreadyMigrated.length} klip`);
  console.log(` Klip yang perlu dimigrasi  : ${itemsToMigrate.length} klip`);
  console.log('========================================================================================\n');

  if (itemsToMigrate.length === 0) {
    console.log('🎉 Seluruh folder klip dan file video di Google Drive sudah rapi dan terorganisir!');
    console.log('   Semua folder klip sudah menggunakan format angka "HH:MM:SS" dan videonya "full.mp4".');
    console.log('   Tidak ada perubahan yang diperlukan.');
    process.exit(0);
  }

  // Tampilkan tabel rencana perubahan
  console.log('DAFTAR PERUBAHAN YANG AKAN DILAKUKAN:');
  console.log('------------------------------------------------------------------------------------------------------------------------');
  console.log(
    'No.'.padEnd(4) +
    'Game'.padEnd(28) +
    'Episode'.padEnd(14) +
    'Perubahan Folder'.padEnd(36) +
    'Perubahan File Video'
  );
  console.log('------------------------------------------------------------------------------------------------------------------------');

  itemsToMigrate.forEach((item, i) => {
    const no = String(i + 1).padEnd(4);
    const gName = (item.gameName.length > 26 ? item.gameName.slice(0, 23) + '...' : item.gameName).padEnd(28);
    const eps = (item.epsName.length > 12 ? item.epsName.slice(0, 10) + '..' : item.epsName).padEnd(14);
    const folderChange = item.folderNeedsRename
      ? `"${item.currentFolderName}" -> "${item.newFolderName}"`
      : `(Tetap: "${item.currentFolderName}")`;
    const fChange = folderChange.padEnd(36);
    const fileChange = item.fileNeedsRename
      ? `"${item.currentFileName}" -> "${item.newFileName}"`
      : `(Tetap: "${item.currentFileName}")`;

    console.log(`${no}${gName}${eps}${fChange}${fileChange}`);
  });
  console.log('------------------------------------------------------------------------------------------------------------------------\n');

  if (isDryRun) {
    console.log('ℹ️ [DRY RUN] Mode simulasi selesai. Tidak ada folder atau file yang diubah di Google Drive.');
    console.log('   Untuk menerapkan perubahan secara nyata, jalankan kembali tanpa argumen --dry-run.');
    process.exit(0);
  }

  // 4. Konfirmasi Pengguna
  if (!autoConfirm) {
    const answer = await askConfirmation(`⚠️ Terapkan perubahan pada ${itemsToMigrate.length} klip di atas ke Google Drive? (y/N): `);
    if (answer !== 'y' && answer !== 'yes') {
      console.log('❌ Dibatalkan oleh pengguna. Tidak ada perubahan yang dilakukan.');
      process.exit(0);
    }
  }

  // 5. Eksekusi Perubahan dengan Urutan Ketat & Aman:
  //    Folder diubah terlebih dahulu -> Dikonfirmasi sukses -> Barulah file video diubah menjadi full.mp4
  console.log('\n🚀 [TAHAP 3/3] Menerapkan perubahan nama folder dan file di Google Drive...');
  let successCount = 0;
  let failCount = 0;

  for (let idx = 0; idx < itemsToMigrate.length; idx++) {
    const item = itemsToMigrate[idx];
    const prefix = `[${idx + 1}/${itemsToMigrate.length}] "${item.gameName}" (${item.epsName})`;

    try {
      // Langkah A: Ubah nama folder parent dari "-" menjadi format waktu standar (HH:MM:SS)
      if (item.folderNeedsRename) {
        process.stdout.write(`${prefix} 📁 Mengubah folder: "${item.currentFolderName}" -> "${item.newFolderName}"... `);

        const folderRes = await drive.files.update({
          fileId: item.folderId,
          requestBody: { name: item.newFolderName },
          supportsAllDrives: true,
        });

        // Konfirmasi respon API
        if (!folderRes.data || folderRes.data.name !== item.newFolderName) {
          throw new Error(`Nama folder tidak terkonfirmasi di respons Google Drive (nama: "${folderRes.data?.name}")`);
        }
        console.log('✅ OK');
      }

      // Langkah B: Setelah nama folder terkonfirmasi sukses, ubah nama file video full menjadi full.mp4
      if (item.fileNeedsRename) {
        process.stdout.write(`       🎬 Mengubah file  : "${item.currentFileName}" -> "${item.newFileName}"... `);

        const fileRes = await drive.files.update({
          fileId: item.fileId,
          requestBody: { name: item.newFileName },
          supportsAllDrives: true,
        });

        if (!fileRes.data || fileRes.data.name !== item.newFileName) {
          throw new Error(`Nama file video tidak terkonfirmasi di respons Google Drive`);
        }
        console.log('✅ OK');
      }

      successCount++;

      // Jeda ringan antar request API Google Drive untuk menghindari rate limiting
      await new Promise((resolve) => setTimeout(resolve, 150));
    } catch (err) {
      failCount++;
      console.log(`❌ GAGAL: ${err.message}`);
    }
  }

  console.log('\n========================================================================================');
  console.log('🎉 PROSES PENGORGANISASIAN FOLDER SELESAI!');
  console.log('========================================================================================');
  console.log(` Berhasil diubah : ${successCount} klip`);
  if (failCount > 0) {
    console.log(` Gagal diubah    : ${failCount} klip`);
  }
  console.log(' Seluruh klip kini berada di folder format jam standar (00:xx:xx / 01:xx:xx) dengan file "full.mp4".');
  console.log(' Fitur sort by name di Google Drive kini siap digunakan untuk manajemen konten yang rapi!');
  console.log(' Program kompilasi "npm run doksli" otomatis mendukung struktur baru ini.');
  console.log('========================================================================================\n');
}

main().catch((err) => {
  console.error('\n❌ [FATAL ERROR]:', err.message);
  process.exit(1);
});
