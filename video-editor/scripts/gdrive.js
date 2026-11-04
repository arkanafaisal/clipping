import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream/promises';
import dotenv from 'dotenv';
import { google } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load environment variables
const envPath = path.join(rootDir, '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const GDRIVE_ROOT_FOLDER_ID =
  process.env.GDRIVE_ROOT_FOLDER_ID || '1UT6ifvTpa1IFUfnr8vFkRoUOd1p1dm3x';

// File metadata tunggal di dalam folder src
const DATA_PATH = path.join(rootDir, 'src', 'data.json');

const TEMP_DIR = path.join(rootDir, 'public', 'temp');

/**
 * Format tanggal ke human-readable string (tahun-bulan-hari jam:menit:detik)
 */
export function formatHumanDate(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Mendapatkan OAuth2 Google Drive client
 */
export function getDriveClient() {
  const tokenCandidatePaths = [
    path.join(rootDir, 'token.json'),
    path.join(rootDir, '..', 'token.json'),
    path.join(rootDir, '..', 'scheduler-uploader', 'token.json'),
  ];

  let tokenData = null;
  for (const p of tokenCandidatePaths) {
    if (fs.existsSync(p)) {
      try {
        tokenData = JSON.parse(fs.readFileSync(p, 'utf8'));
        break;
      } catch (e) {
        // continue
      }
    }
  }

  if (!tokenData) {
    throw new Error(
      'token.json tidak ditemukan! Pastikan token.json ada di folder video-editor atau root.'
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    tokenData.client_id,
    tokenData.client_secret
  );

  oauth2Client.setCredentials({
    refresh_token: tokenData.refresh_token,
    access_token: tokenData.access_token,
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

/**
 * Format bytes ke ukuran yang mudah dibaca (MB/KB)
 */
export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Menelusuri seluruh folder di Google Drive secara rekursif
 */
export async function crawlGoogleDrive(drive, parentId = GDRIVE_ROOT_FOLDER_ID, currentPath = '') {
  const res = await drive.files.list({
    q: `'${parentId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, size, videoMediaMetadata)',
    pageSize: 100,
  });

  const files = res.data.files || [];
  const moments = [];

  // Cari file-file video di dalam folder ini
  const videoFiles = files.filter(
    (f) =>
      f.mimeType !== 'application/vnd.google-apps.folder' &&
      (f.name.endsWith('.mp4') || f.name.endsWith('.mkv') || f.name.endsWith('.jpg') || f.name.endsWith('.png'))
  );

  const subFolders = files.filter(
    (f) => f.mimeType === 'application/vnd.google-apps.folder'
  );

  // Jika folder ini memiliki berkas video (seperti full.mp4)
  if (videoFiles.length > 0 && currentPath !== '') {
    // Rule 24: Strictly require exact "full.mp4" and skip folders lacking it
    const fullFile = videoFiles.find((f) => f.name.toLowerCase() === 'full.mp4');
    const cutFile = videoFiles.find((f) => f.name.toLowerCase() === 'cut.mp4');
    const imageFile = videoFiles.find(
      (f) => f.name.toLowerCase() === 'image.jpg' || f.name.toLowerCase().endsWith('.png')
    );

    if (fullFile) {
      moments.push({
        id: parentId,
        name: path.basename(currentPath),
        path: currentPath,
        files: {
          full: {
            id: fullFile.id,
            name: fullFile.name,
            mimeType: fullFile.mimeType,
            size: Number(fullFile.size || 0),
            sizeFormatted: formatBytes(Number(fullFile.size || 0)),
            durationSeconds: fullFile.videoMediaMetadata?.durationMillis
              ? parseFloat((Number(fullFile.videoMediaMetadata.durationMillis) / 1000).toFixed(2))
              : null,
            durationFormatted: fullFile.videoMediaMetadata?.durationMillis
              ? `${(Number(fullFile.videoMediaMetadata.durationMillis) / 1000).toFixed(2)}s`
              : null,
            width: fullFile.videoMediaMetadata?.width || 1080,
            height: fullFile.videoMediaMetadata?.height || 1920,
            tempRelPath: `temp/${currentPath}/${fullFile.name}`,
          },
          cut: cutFile
            ? {
                id: cutFile.id,
                name: cutFile.name,
                size: Number(cutFile.size || 0),
                sizeFormatted: formatBytes(Number(cutFile.size || 0)),
                tempRelPath: `temp/${currentPath}/${cutFile.name}`,
              }
            : null,
          image: imageFile
            ? {
                id: imageFile.id,
                name: imageFile.name,
                size: Number(imageFile.size || 0),
                sizeFormatted: formatBytes(Number(imageFile.size || 0)),
                tempRelPath: `temp/${currentPath}/${imageFile.name}`,
              }
            : null,
        },
      });
    }
  }

  // Telusuri subfolder-subfolder
  for (const folder of subFolders) {
    const nextPath = currentPath ? `${currentPath}/${folder.name}` : folder.name;
    const subMoments = await crawlGoogleDrive(drive, folder.id, nextPath);
    moments.push(...subMoments);
  }

  return moments;
}

/**
 * Sinkronkan metadata dari Google Drive ke src/data.json
 */
export async function syncMetadata() {
  console.log(`\n🔄 Menyinkronkan metadata dari Google Drive...`);
  console.log(`   Root Folder ID: ${GDRIVE_ROOT_FOLDER_ID}`);

  // Muat data lama untuk mempertahankan konfigurasi custom style (seperti memeDiscovery)
  const existingMomentsMap = new Map();
  if (fs.existsSync(DATA_PATH)) {
    try {
      const oldData = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
      if (Array.isArray(oldData.moments)) {
        for (const m of oldData.moments) {
          if (m.id) existingMomentsMap.set(m.id, m);
          if (m.name) existingMomentsMap.set(m.name, m);
        }
      }
    } catch (e) {
      // abaikan error baca data lama
    }
  }

  const drive = getDriveClient();
  const moments = await crawlGoogleDrive(drive, GDRIVE_ROOT_FOLDER_ID, '');

  // Gabungkan konfigurasi custom yang sudah ada (misal memeDiscovery)
  for (const m of moments) {
    const existing = existingMomentsMap.get(m.id) || existingMomentsMap.get(m.name);
    if (existing) {
      if (existing.memeDiscovery) {
        m.memeDiscovery = existing.memeDiscovery;
      }
    }
  }

  const metadata = {
    lastUpdate: formatHumanDate(new Date()),
    totalMoments: moments.length,
    moments,
  };

  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(metadata, null, 2), 'utf8');
  console.log(`   ✅ Metadata tersimpan: ${path.relative(rootDir, DATA_PATH)}`);

  return metadata;
}

/**
 * Muat metadata dari src/data.json lokal
 */
export function loadMetadata() {
  if (fs.existsSync(DATA_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    } catch (e) {
      // continue
    }
  }
  return null;
}

/**
 * Mengunduh berkas tunggal dengan streaming progress
 */
export async function downloadDriveFile(drive, fileId, destPath, label = '') {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });

  const stream = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' }
  );

  let downloadedBytes = 0;
  stream.data.on('data', (chunk) => {
    downloadedBytes += chunk.length;
    process.stdout.write(
      `\r   ⬇️ Mengunduh ${label}: ${formatBytes(downloadedBytes)}`
    );
  });

  await pipeline(stream.data, fs.createWriteStream(destPath));
  process.stdout.write(`\r   ✅ Selesai: ${label} (${formatBytes(fs.statSync(destPath).size)})\n`);
  return destPath;
}

/**
 * Mengunduh video full untuk suatu momen
 */
export async function downloadMoment(moment) {
  if (!moment || !moment.files || !moment.files.full) {
    throw new Error(`Momen "${moment?.name}" tidak memiliki file full.mp4!`);
  }

  const drive = getDriveClient();
  const fullFile = moment.files.full;
  const targetDir = path.join(TEMP_DIR, moment.path);
  const targetPath = path.join(targetDir, fullFile.name);

  console.log(`\n🚀 Mulai proses download untuk momen: "${moment.name}"`);
  console.log(`   File: ${fullFile.name} (Ukuran: ${fullFile.sizeFormatted})`);
  console.log(`   Tujuan: ${path.relative(rootDir, targetPath)}`);

  await downloadDriveFile(drive, fullFile.id, targetPath, `${moment.name}/${fullFile.name}`);

  // Buat juga salinan atau copy ke public/temp/full.mp4 agar mudah diakses langsung
  try {
    const quickPath = path.join(TEMP_DIR, 'full.mp4');
    fs.copyFileSync(targetPath, quickPath);
  } catch (e) {
    // ignore
  }

  return targetPath;
}

/**
 * Periksa apakah berkas momen sudah ada di lokal
 */
export function isMomentDownloaded(moment) {
  if (!moment || !moment.files || !moment.files.full) return false;
  const targetPath = path.join(TEMP_DIR, moment.path, moment.files.full.name);
  return fs.existsSync(targetPath);
}

/**
 * Antarmuka CLI interaktif
 */
export async function runInteractiveCLI() {
  let metadata = loadMetadata();

  if (!metadata || !metadata.moments || metadata.moments.length === 0) {
    console.log('⚠️ File src/data.json belum ditemukan. Menjalankan sinkronisasi awal...');
    metadata = await syncMetadata();
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const promptMenu = () => {
    console.log('\n==============================================================');
    console.log('   🎬 GOOGLE DRIVE MOMENT DOWNLOADER (VIDEO-EDITOR)');
    console.log('==============================================================');
    console.log(`Terakhir Update : ${metadata.lastUpdate || 'Baru'}`);
    console.log(`Total Momen     : ${metadata.moments.length}\n`);

    console.log('Daftar Momen yang Tersedia:');
    metadata.moments.forEach((m, idx) => {
      const downloaded = isMomentDownloaded(m);
      const statusStr = downloaded ? '🟢 [TERUNDUH DI LOKAL]' : '⚪ [BELUM DIUNDUH]';
      const sizeStr = m.files.full ? m.files.full.sizeFormatted : 'N/A';
      console.log(`  [${idx + 1}] ${m.name} - full.mp4 (${sizeStr}) ${statusStr}`);
    });

    console.log('\nOpsi Perintah:');
    console.log('  [s] Sinkronkan / Perbarui Metadata dari Google Drive');
    console.log('  [q] Keluar');
    console.log('--------------------------------------------------------------');

    rl.question('👉 Masukkan nomor momen yang ingin diunduh: ', async (ans) => {
      const trimmed = ans.trim().toLowerCase();

      if (trimmed === 'q' || trimmed === 'exit') {
        console.log('Sampai jumpa! 👋');
        rl.close();
        process.exit(0);
      }

      if (trimmed === 's' || trimmed === 'sync') {
        try {
          metadata = await syncMetadata();
        } catch (e) {
          console.error(`❌ Gagal menyinkronkan: ${e.message}`);
        }
        return promptMenu();
      }

      const num = parseInt(trimmed, 10);
      if (!isNaN(num) && num >= 1 && num <= metadata.moments.length) {
        const selectedMoment = metadata.moments[num - 1];
        try {
          await downloadMoment(selectedMoment);
          console.log(`\n🎉 Berhasil! Video siap diputar di Remotion: /temp/${selectedMoment.path}/full.mp4\n`);
        } catch (e) {
          console.error(`\n❌ Gagal mengunduh: ${e.message}\n`);
        }
        return promptMenu();
      }

      console.log('⚠️ Input tidak valid. Silakan pilih nomor dari daftar atau [s]/[q].');
      promptMenu();
    });
  };

  promptMenu();
}

// Jalankan mode sesuai argumen
if (process.argv[1] && process.argv[1].endsWith('gdrive.js')) {
  if (process.argv.includes('--sync')) {
    syncMetadata().then(() => process.exit(0)).catch((err) => {
      console.error(err);
      process.exit(1);
    });
  } else {
    runInteractiveCLI().catch((err) => {
      console.error(err);
      process.exit(1);
    });
  }
}
