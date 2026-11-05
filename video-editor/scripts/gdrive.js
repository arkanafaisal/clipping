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
 * Sanitasi path agar tidak ada spasi (ganti spasi dengan hyphen "-")
 * untuk mencegah error URL encoding (%20) dan 404 pada browser / player.
 */
export function sanitizePath(p) {
  if (!p) return '';
  return p
    .split('/')
    .map((seg) => seg.trim().replace(/\s+/g, '-'))
    .join('/');
}

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
    access_token: tokenData.access_token || tokenData.token,
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
 * Mendapatkan daftar folder langsung di root folder Google Drive
 */
export async function listRootFolders() {
  try {
    const drive = getDriveClient();
    const res = await drive.files.list({
      q: `'${GDRIVE_ROOT_FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      pageSize: 50,
      orderBy: 'name',
    });
    return res.data.files || [];
  } catch (err) {
    console.warn('Gagal memuat listRootFolders dari Google Drive:', err.message);
    const meta = loadMetadata();
    if (meta && meta.moments) {
      return meta.moments.map((m) => ({ id: m.id, name: m.name }));
    }
    return [];
  }
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
      const cleanPath = sanitizePath(currentPath);
      moments.push({
        id: parentId,
        name: path.basename(currentPath),
        path: cleanPath,
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
            tempRelPath: `temp/${cleanPath}/${fullFile.name}`,
          },
          cut: cutFile
            ? {
                id: cutFile.id,
                name: cutFile.name,
                size: Number(cutFile.size || 0),
                sizeFormatted: formatBytes(Number(cutFile.size || 0)),
                tempRelPath: `temp/${cleanPath}/${cutFile.name}`,
              }
            : null,
          image: imageFile
            ? {
                id: imageFile.id,
                name: imageFile.name,
                size: Number(imageFile.size || 0),
                sizeFormatted: formatBytes(Number(imageFile.size || 0)),
                tempRelPath: `temp/${cleanPath}/${imageFile.name}`,
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

    // Unduh otomatis file image jika ditemukan di Google Drive
    if (m.files && m.files.image) {
      try {
        await downloadMomentImage(drive, m);
      } catch (err) {
        console.warn(`   ⚠️ Gagal mengunduh gambar untuk ${m.name}: ${err.message}`);
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
  const cleanPath = sanitizePath(moment.path);
  moment.path = cleanPath;
  const fullFile = moment.files.full;
  const targetDir = path.join(TEMP_DIR, cleanPath);
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

  // Unduh juga gambar (image.jpg / png) jika momen memiliki kartu gambar
  if (moment.files && moment.files.image) {
    try {
      await downloadMomentImage(drive, moment);
    } catch (err) {
      console.warn(`   ⚠️ Gagal mengunduh gambar untuk ${moment.name}: ${err.message}`);
    }
  }

  return targetPath;
}

/**
 * Mengunduh berkas gambar (image.jpg / png) untuk suatu momen
 */
export async function downloadMomentImage(drive, moment) {
  if (!moment || !moment.files || !moment.files.image) {
    return null;
  }

  const cleanPath = sanitizePath(moment.path);
  moment.path = cleanPath;
  const imageFile = moment.files.image;
  const targetDir = path.join(TEMP_DIR, cleanPath);
  const targetPath = path.join(targetDir, imageFile.name);
  const quickPath = path.join(TEMP_DIR, imageFile.name);

  // Jika file lokal sudah ada dan ukuran cocok, lewati
  if (fs.existsSync(targetPath)) {
    const stat = fs.statSync(targetPath);
    if (stat.size === imageFile.size && stat.size > 0) {
      if (!fs.existsSync(quickPath)) {
        try {
          fs.copyFileSync(targetPath, quickPath);
        } catch (e) {}
      }
      return targetPath;
    }
  }

  console.log(`\n🖼️ Mengunduh kartu gambar untuk momen: "${moment.name}"`);
  console.log(`   File: ${imageFile.name} (Ukuran: ${imageFile.sizeFormatted})`);
  console.log(`   Tujuan: ${path.relative(rootDir, targetPath)}`);

  await downloadDriveFile(drive, imageFile.id, targetPath, `${moment.name}/${imageFile.name}`);

  // Buat juga salinan ke public/temp/image.jpg agar mudah diakses langsung
  try {
    fs.copyFileSync(targetPath, quickPath);
  } catch (e) {
    // ignore
  }

  return targetPath;
}

/**
 * Periksa keberadaan image.jpg di folder Google Drive suatu momen,
 * unduh jika ada/berubah, dan perbarui src/data.json secara cepat (~300ms).
 */
export async function syncMomentImage(momentPathOrName) {
  const metadata = loadMetadata();
  if (!metadata || !metadata.moments) return null;

  const moment = metadata.moments.find(
    (m) =>
      m.path === momentPathOrName ||
      m.name === momentPathOrName ||
      sanitizePath(m.path) === sanitizePath(momentPathOrName) ||
      !momentPathOrName
  );

  if (!moment) return null;

  const cleanPath = sanitizePath(moment.path);
  moment.path = cleanPath;
  const targetDir = path.join(TEMP_DIR, cleanPath);
  const quickImagePath = path.join(TEMP_DIR, 'image.jpg');

  // Migrasi aset dari folder lama dengan spasi (misal "grim reaper" -> "grim-reaper") jika ada
  const legacyDir = path.join(TEMP_DIR, moment.name);
  if (fs.existsSync(legacyDir) && legacyDir !== targetDir) {
    try {
      fs.mkdirSync(targetDir, { recursive: true });
      for (const f of fs.readdirSync(legacyDir)) {
        const srcF = path.join(legacyDir, f);
        const dstF = path.join(targetDir, f);
        if (!fs.existsSync(dstF) && fs.statSync(srcF).isFile()) {
          fs.copyFileSync(srcF, dstF);
        }
      }
    } catch (e) {}
  }

  const drive = getDriveClient();

  // Cari file image.jpg / png langsung di folder momen tersebut (sangat cepat)
  const res = await drive.files.list({
    q: `'${moment.id}' in parents and trashed = false and (name = 'image.jpg' or name = 'image.png' or mimeType contains 'image/')`,
    fields: 'files(id, name, mimeType, size)',
    pageSize: 10,
  });

  const files = res.data.files || [];
  const imageFile = files.find(
    (f) => f.name.toLowerCase() === 'image.jpg' || f.name.toLowerCase().endsWith('.png')
  );

  if (imageFile) {
    moment.files = moment.files || {};
    moment.files.image = {
      id: imageFile.id,
      name: imageFile.name,
      size: Number(imageFile.size || 0),
      sizeFormatted: formatBytes(Number(imageFile.size || 0)),
      tempRelPath: `temp/${cleanPath}/${imageFile.name}`,
    };

    const targetImagePath = path.join(targetDir, imageFile.name);
    const fileExistsLocally = fs.existsSync(targetImagePath) && fs.statSync(targetImagePath).size > 0;
    const quickExistsLocally = fs.existsSync(quickImagePath) && fs.statSync(quickImagePath).size > 0;

    // Sinkronkan salinan lokal jika salah satu ada
    if (fileExistsLocally && !quickExistsLocally) {
      try { fs.copyFileSync(targetImagePath, quickImagePath); } catch (e) {}
    } else if (!fileExistsLocally && quickExistsLocally) {
      try {
        fs.mkdirSync(targetDir, { recursive: true });
        fs.copyFileSync(quickImagePath, targetImagePath);
      } catch (e) {}
    }

    let downloaded = false;
    if (!fs.existsSync(targetImagePath) || fs.statSync(targetImagePath).size === 0) {
      await downloadMomentImage(drive, moment);
      downloaded = true;
    }

    // Simpan metadata terupdate ke data.json
    metadata.lastUpdate = formatHumanDate(new Date());
    fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
    fs.writeFileSync(DATA_PATH, JSON.stringify(metadata, null, 2), 'utf8');

    return { moment, metadata, downloaded, alreadyExists: !downloaded };
  }

  return { moment, metadata, downloaded: false };
}

/**
 * Periksa keberadaan full.mp4 di folder lokal atau Google Drive suatu momen,
 * unduh jika belum ada di lokal, dan perbarui src/data.json secara cepat.
 */
export async function syncMomentVideo(momentPathOrName) {
  const metadata = loadMetadata();
  if (!metadata || !metadata.moments) return null;

  const moment = metadata.moments.find(
    (m) =>
      m.path === momentPathOrName ||
      m.name === momentPathOrName ||
      sanitizePath(m.path) === sanitizePath(momentPathOrName) ||
      !momentPathOrName
  );

  if (!moment) return null;

  const cleanPath = sanitizePath(moment.path);
  moment.path = cleanPath;
  const targetDir = path.join(TEMP_DIR, cleanPath);
  const targetPath = path.join(targetDir, 'full.mp4');
  const quickPath = path.join(TEMP_DIR, 'full.mp4');

  // Migrasi aset dari folder lama dengan spasi (misal "grim reaper" -> "grim-reaper") jika ada
  const legacyDir = path.join(TEMP_DIR, moment.name);
  if (fs.existsSync(legacyDir) && legacyDir !== targetDir) {
    try {
      fs.mkdirSync(targetDir, { recursive: true });
      for (const f of fs.readdirSync(legacyDir)) {
        const srcF = path.join(legacyDir, f);
        const dstF = path.join(targetDir, f);
        if (!fs.existsSync(dstF) && fs.statSync(srcF).isFile()) {
          fs.copyFileSync(srcF, dstF);
        }
      }
    } catch (e) {}
  }

  const fileExistsLocally = fs.existsSync(targetPath) && fs.statSync(targetPath).size > 0;
  const quickExistsLocally = fs.existsSync(quickPath) && fs.statSync(quickPath).size > 0;
  const hasMetadata = Boolean(moment.files && moment.files.full && moment.files.full.id);

  // Sinkronkan salinan lokal jika salah satu sudah ada (hindari download ulang)
  if (fileExistsLocally && !quickExistsLocally) {
    try {
      fs.copyFileSync(targetPath, quickPath);
    } catch (e) {}
  } else if (!fileExistsLocally && quickExistsLocally) {
    try {
      fs.mkdirSync(targetDir, { recursive: true });
      fs.copyFileSync(quickPath, targetPath);
    } catch (e) {}
  }

  // Jika file lokal sudah ada di salah satu folder dan metadata lengkap, tidak perlu download ulang
  if ((fileExistsLocally || quickExistsLocally) && hasMetadata) {
    moment.files.full.tempRelPath = `temp/${cleanPath}/full.mp4`;
    return { moment, metadata, downloaded: false, alreadyExists: true };
  }

  const drive = getDriveClient();

  // Cari file full.mp4 langsung di folder Google Drive momen tersebut
  let fullFile = null;
  if (hasMetadata) {
    fullFile = moment.files.full;
  } else {
    const res = await drive.files.list({
      q: `'${moment.id}' in parents and trashed = false and name = 'full.mp4'`,
      fields: 'files(id, name, mimeType, size, videoMediaMetadata)',
      pageSize: 5,
    });
    const files = res.data.files || [];
    fullFile = files.find((f) => f.name.toLowerCase() === 'full.mp4');
  }

  if (fullFile) {
    moment.files = moment.files || {};
    moment.files.full = {
      id: fullFile.id,
      name: fullFile.name,
      mimeType: fullFile.mimeType || 'video/mp4',
      size: Number(fullFile.size || 0),
      sizeFormatted: formatBytes(Number(fullFile.size || 0)),
      durationSeconds: fullFile.videoMediaMetadata?.durationMillis
        ? parseFloat((Number(fullFile.videoMediaMetadata.durationMillis) / 1000).toFixed(2))
        : moment.files?.full?.durationSeconds || 10.95,
      durationFormatted: fullFile.videoMediaMetadata?.durationMillis
        ? `${(Number(fullFile.videoMediaMetadata.durationMillis) / 1000).toFixed(2)}s`
        : moment.files?.full?.durationFormatted || '10.95s',
      width: fullFile.videoMediaMetadata?.width || 1080,
      height: fullFile.videoMediaMetadata?.height || 1920,
      tempRelPath: `temp/${cleanPath}/${fullFile.name}`,
    };

    let downloaded = false;
    const finalLocalExists = fs.existsSync(targetPath) && fs.statSync(targetPath).size > 0;
    if (!finalLocalExists) {
      console.log(`\n🎬 Video full.mp4 lokal tidak ditemukan untuk "${moment.name}".`);
      console.log(`   ⬇️ Mengunduh otomatis dari Google Drive...`);
      await downloadDriveFile(drive, fullFile.id, targetPath, `${moment.name}/${fullFile.name}`);
      try {
        fs.copyFileSync(targetPath, quickPath);
      } catch (e) {}
      downloaded = true;
    }

    // Simpan metadata terupdate ke data.json
    metadata.lastUpdate = formatHumanDate(new Date());
    fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
    fs.writeFileSync(DATA_PATH, JSON.stringify(metadata, null, 2), 'utf8');

    return { moment, metadata, downloaded, alreadyExists: !downloaded };
  }

  return { moment, metadata, downloaded: false, notFoundOnDrive: true };
}

/**
 * Memastikan semua aset penting (full.mp4 dan image.jpg) tersedia di lokal.
 * Jika belum ada, otomatis diunduh dari Google Drive.
 */
export async function ensureMomentAssets(momentPathOrName) {
  console.log('🔍 Memeriksa ketersediaan aset momen (video & gambar)...');
  const imgRes = await syncMomentImage(momentPathOrName).catch((err) => {
    console.warn('   ⚠️ syncMomentImage warning:', err?.message || err);
    return null;
  });
  const vidRes = await syncMomentVideo(momentPathOrName).catch((err) => {
    console.warn('   ⚠️ syncMomentVideo warning:', err?.message || err);
    return null;
  });
  return {
    image: imgRes,
    video: vidRes,
    metadata: vidRes?.metadata || imgRes?.metadata || loadMetadata(),
  };
}

/**
 * Inisialisasi struktur momen di data.json jika belum ada dan pastikan asetnya diunduh
 */
export async function initOrEnsureMoment(folderId, folderName) {
  const metadata = loadMetadata() || {
    lastUpdate: formatHumanDate(new Date()),
    totalMoments: 0,
    moments: [],
  };
  metadata.moments = metadata.moments || [];

  const cleanPath = sanitizePath(folderName);
  let moment = metadata.moments.find(
    (m) =>
      (folderId && m.id === folderId) ||
      m.name.toLowerCase() === folderName.toLowerCase() ||
      m.path.toLowerCase() === cleanPath.toLowerCase()
  );

  const drive = getDriveClient();

  // Jika momen belum ada di data.json, telusuri folder Google Drive dan buatkan strukturnya otomatis
  if (!moment) {
    console.log(`\n📁 Momen baru terdeteksi: "${folderName}" (${folderId})`);
    console.log(`   Menelusuri file di Google Drive...`);

    let files = [];
    try {
      const res = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType, size, videoMediaMetadata)',
        pageSize: 50,
      });
      files = res.data.files || [];
    } catch (err) {
      console.warn(`Gagal membaca folder ${folderName} di Drive:`, err.message);
    }

    // Rule 24: Strictly require exact "full.mp4"
    const fullFile = files.find((f) => f.name.toLowerCase() === 'full.mp4');
    const cutFile = files.find((f) => f.name.toLowerCase() === 'cut.mp4');
    const imageFile = files.find(
      (f) => f.name.toLowerCase() === 'image.jpg' || f.name.toLowerCase().endsWith('.png')
    );

    const durationSec = fullFile?.videoMediaMetadata?.durationMillis
      ? parseFloat((Number(fullFile.videoMediaMetadata.durationMillis) / 1000).toFixed(2))
      : 10.95;

    moment = {
      id: folderId,
      name: folderName,
      path: cleanPath,
      files: {
        image: imageFile
          ? {
              id: imageFile.id,
              name: imageFile.name,
              size: Number(imageFile.size || 0),
              sizeFormatted: formatBytes(Number(imageFile.size || 0)),
              tempRelPath: `temp/${cleanPath}/${imageFile.name}`,
            }
          : null,
        full: fullFile
          ? {
              id: fullFile.id,
              name: fullFile.name,
              mimeType: fullFile.mimeType || 'video/mp4',
              size: Number(fullFile.size || 0),
              sizeFormatted: formatBytes(Number(fullFile.size || 0)),
              durationSeconds: durationSec,
              durationFormatted: `${durationSec}s`,
              width: fullFile.videoMediaMetadata?.width || 1080,
              height: fullFile.videoMediaMetadata?.height || 1920,
              tempRelPath: `temp/${cleanPath}/${fullFile.name}`,
            }
          : null,
        cut: cutFile
          ? {
              id: cutFile.id,
              name: cutFile.name,
              size: Number(cutFile.size || 0),
              sizeFormatted: formatBytes(Number(cutFile.size || 0)),
              tempRelPath: `temp/${cleanPath}/${cutFile.name}`,
            }
          : null,
      },
      memeDiscovery: {
        targetUndoTimestamp: '00:05.000',
        title: `Meme Discovery: ${folderName}`,
        cardTitle: folderName,
        cardRarity: 'Rare',
        cardDesc: '',
        skills: [
          { name: '', desc: '', nameFontSize: 28, descFontSize: 22 },
          { name: '', desc: '', nameFontSize: 28, descFontSize: 22 },
          { name: '', desc: '', nameFontSize: 28, descFontSize: 22 },
        ],
        cardColor: '#f59e0b',
        titleFontSize: 48,
        rarityFontSize: 24,
        descFontSize: 30,
        passiveName: '',
        passiveDesc: '',
        passiveNameFontSize: 28,
        passiveDescFontSize: 22,
      },
    };

    metadata.moments.push(moment);
    metadata.totalMoments = metadata.moments.length;
    metadata.lastUpdate = formatHumanDate(new Date());

    fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
    fs.writeFileSync(DATA_PATH, JSON.stringify(metadata, null, 2), 'utf8');
  }

  // Unduh aset ke folder temp/<cleanPath>/ jika belum ada di lokal
  const targetDir = path.join(TEMP_DIR, cleanPath);
  fs.mkdirSync(targetDir, { recursive: true });

  if (moment.files?.full?.id) {
    const fullPath = path.join(targetDir, 'full.mp4');
    if (!fs.existsSync(fullPath) || fs.statSync(fullPath).size === 0) {
      console.log(`\n⬇️ Mengunduh full.mp4 untuk "${moment.name}"...`);
      await downloadDriveFile(drive, moment.files.full.id, fullPath, `${moment.name}/full.mp4`);
    }
  }

  if (moment.files?.image?.id) {
    const imagePath = path.join(targetDir, moment.files.image.name);
    if (!fs.existsSync(imagePath) || fs.statSync(imagePath).size === 0) {
      console.log(`\n🖼️ Mengunduh kartu gambar untuk "${moment.name}"...`);
      await downloadDriveFile(drive, moment.files.image.id, imagePath, `${moment.name}/${moment.files.image.name}`);
    }
  }

  return { moment, metadata };
}

/**
 * Periksa apakah berkas momen sudah ada di lokal
 */
export function isMomentDownloaded(moment) {
  if (!moment || !moment.files || !moment.files.full) return false;
  const targetPath = path.join(TEMP_DIR, moment.path, moment.files.full.name);
  return fs.existsSync(targetPath) && fs.statSync(targetPath).size > 0;
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
  } else if (process.argv.includes('--check-image') || process.argv.includes('--sync-image')) {
    syncMomentImage().then((res) => {
      console.log('Sync moment image result:', res?.downloaded ? 'Downloaded image.jpg' : 'No new image');
      process.exit(0);
    }).catch((err) => {
      console.error(err);
      process.exit(1);
    });
  } else if (process.argv.includes('--check-video') || process.argv.includes('--sync-video')) {
    syncMomentVideo().then((res) => {
      console.log('Sync moment video result:', res?.downloaded ? 'Downloaded full.mp4' : 'Video already up to date');
      process.exit(0);
    }).catch((err) => {
      console.error(err);
      process.exit(1);
    });
  } else if (process.argv.includes('--check-assets') || process.argv.includes('--ensure')) {
    ensureMomentAssets().then((res) => {
      const vidStatus = res?.video?.downloaded
        ? '⬇️ Berhasil diunduh'
        : (res?.video?.alreadyExists || res?.video ? '✅ Sudah tersedia di lokal' : '⚠️ Tidak ada video');
      const imgStatus = res?.image?.downloaded
        ? '⬇️ Berhasil diunduh'
        : (res?.image?.alreadyExists || res?.image ? '✅ Sudah tersedia di lokal' : '⚠️ Tidak ada gambar');
      console.log(`\n📦 Status Aset Momen:`);
      console.log(`   🎬 Video : ${vidStatus}`);
      console.log(`   🖼️ Gambar: ${imgStatus}\n`);
      process.exit(0);
    }).catch((err) => {
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
