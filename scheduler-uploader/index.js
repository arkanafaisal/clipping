/**
 * ============================================================================
 * Heroku Scheduler Video Uploader (Static CLI Script)
 * ============================================================================
 * Script Node.js statis murni (bukan web server) yang didesain khusus untuk
 * dijalankan secara terjadwal oleh Heroku Scheduler.
 *
 * Alur Kerja:
 * 1. Konversi waktu UTC saat ini ke zona waktu WIB (Asia/Jakarta, UTC+7).
 * 2. Hitung target nama folder (YYYY-MM-DD) dan target nama file (<JAM>_00.mp4).
 * 3. TAHAP A (Cari Folder): Akses GDrive & cari folder tanggal di root folder.
 * 4. TAHAP B (Cari File): Cari file video sesuai jam trigger di folder tanggal.
 * 5. TAHAP C (Download Stream): Unduh video secara streaming ke disk lokal (./temp_video.mp4).
 * 6. TAHAP D (Upload Paralel): Unggah bersamaan ke YouTube & TikTok via Promise.all().
 * 7. TAHAP E (Clean Up & Exit): Hapus file sementara dan akhiri proses (exit 0/1).
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const dotenv = require('dotenv');
const { google } = require('googleapis');
const axios = require('axios');

// Muat environment variables dari .env (prioritas: folder lokal, root proyek, atau Heroku Config Vars)
const localEnvPath = path.resolve(__dirname, '.env');
const rootEnvPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath });
} else if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else {
  dotenv.config();
}

// Lokasi penyimpanan file video sementara di local disk (tidak disimpan di RAM/buffer)
const TEMP_VIDEO_FILE = path.resolve(__dirname, 'temp_video.mp4');

/**
 * Mendapatkan informasi waktu saat ini yang dikonversikan ke zona waktu WIB (Asia/Jakarta, UTC+7).
 * Format target folder : YYYY-MM-DD (contoh: "2026-10-23")
 * Format target file   : <JAM>_00.mp4 (contoh: "12_00.mp4", "15_00.mp4", "17_00.mp4")
 */
function getWIBTarget() {
  const now = new Date();

  // Format ke WIB (Asia/Jakarta) menggunakan built-in Intl
  const dtf = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts = Object.fromEntries(dtf.formatToParts(now).map((p) => [p.type, p.value]));

  // Dukungan override manual untuk keperluan pengujian CLI (opsional)
  // Contoh penggunaan: node index.js --hour=12 --date=2026-10-23
  let cliDate = null;
  let cliHour = null;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--date=')) cliDate = arg.split('=')[1];
    if (arg.startsWith('--hour=')) cliHour = arg.split('=')[1];
  }

  const targetDate = cliDate || process.env.TARGET_DATE || `${parts.year}-${parts.month}-${parts.day}`;
  const targetHour = (cliHour || process.env.TARGET_HOUR || parts.hour).padStart(2, '0');

  const targetFolderName = targetDate;
  const targetFileName = `${targetHour}_00.mp4`;
  const wibTimeFormatted = `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} WIB`;

  return {
    now,
    wibTimeFormatted,
    targetDate,
    targetHour,
    targetFolderName,
    targetFileName,
  };
}

/**
 * Factory kredensial Google API yang fleksibel:
 * Mendukung input JSON string kredensial (seperti isi token.json), path file .json,
 * kredensial service account, atau OAuth refresh token mentah.
 */
function getGoogleAuth(tokenOrCreds, scopes) {
  if (!tokenOrCreds) {
    throw new Error('Kredensial Google API (GDRIVE_TOKEN / YOUTUBE_API_TOKEN) tidak ditemukan di konfigurasi!');
  }

  let credsObj = null;

  // 1. Cek jika berupa path file lokal yang ada
  const resolvedPath = path.resolve(__dirname, tokenOrCreds);
  if (fs.existsSync(resolvedPath)) {
    try {
      credsObj = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
    } catch (_) {}
  } else if (fs.existsSync(tokenOrCreds)) {
    try {
      credsObj = JSON.parse(fs.readFileSync(tokenOrCreds, 'utf8'));
    } catch (_) {}
  }

  // 2. Cek jika berupa string JSON mentah
  if (!credsObj && typeof tokenOrCreds === 'string' && tokenOrCreds.trim().startsWith('{')) {
    try {
      credsObj = JSON.parse(tokenOrCreds);
    } catch (_) {}
  }

  // 3. Jika berhasil menguraikan kredensial terstruktur (OAuth2 / Service Account)
  if (credsObj) {
    // Mode Google Service Account
    if (credsObj.type === 'service_account') {
      return new google.auth.JWT({
        email: credsObj.client_email,
        key: credsObj.private_key,
        scopes: scopes,
      });
    }

    // Mode Authorized User / OAuth2 (seperti token.json atau credentials.json)
    const clientId =
      credsObj.client_id ||
      credsObj.installed?.client_id ||
      process.env.GOOGLE_CLIENT_ID ||
      process.env.GDRIVE_CLIENT_ID;
    const clientSecret =
      credsObj.client_secret ||
      credsObj.installed?.client_secret ||
      process.env.GOOGLE_CLIENT_SECRET ||
      process.env.GDRIVE_CLIENT_SECRET;
    const refreshToken = credsObj.refresh_token;

    if (refreshToken && clientId && clientSecret) {
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, 'http://localhost');
      oauth2Client.setCredentials({
        refresh_token: refreshToken,
        access_token: credsObj.token || credsObj.access_token,
      });
      return oauth2Client;
    }

    if (refreshToken) {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({
        refresh_token: refreshToken,
        access_token: credsObj.token || credsObj.access_token,
      });
      return oauth2Client;
    }
  }

  // 4. Fallback: string token biasa (OAuth access token atau refresh token)
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.GDRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.GDRIVE_CLIENT_SECRET;
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);

  if (typeof tokenOrCreds === 'string') {
    const trimmed = tokenOrCreds.trim();
    if (trimmed.startsWith('1//') || trimmed.length > 50) {
      oauth2Client.setCredentials({ refresh_token: trimmed });
    } else {
      oauth2Client.setCredentials({ access_token: trimmed });
    }
    return oauth2Client;
  }

  throw new Error('Format kredensial Google tidak dikenali.');
}

/**
 * ============================================================================
 * FUNGSI UPLOAD YOUTUBE
 * ============================================================================
 * Mengunggah file video lokal ke YouTube menggunakan YouTube Data API v3.
 * Parameter metadata dapat disesuaikan di dalam fungsi ini.
 */
async function uploadToYouTube(filePath, metadata) {
  console.log('[TAHAP D - YOUTUBE] Mempersiapkan upload ke YouTube API...');

  // Mode simulasi/mock untuk pengujian tanpa konsumsi kuota API
  if (process.env.MOCK_UPLOAD === 'true') {
    console.log('[TAHAP D - YOUTUBE] [MOCK] Berhasil menyimulasikan upload ke YouTube.');
    return { id: 'MOCK_YOUTUBE_VIDEO_ID' };
  }

  const youtubeToken =
    process.env.YOUTUBE_API_TOKEN ||
    process.env.YOUTUBE_TOKEN ||
    process.env.YOUTUBE_OAUTH_TOKEN ||
    process.env.GOOGLE_OAUTH_TOKEN ||
    process.env.GDRIVE_TOKEN ||
    (fs.existsSync(path.resolve(__dirname, 'token.json')) ? path.resolve(__dirname, 'token.json') : null) ||
    (fs.existsSync(path.resolve(__dirname, '../token.json')) ? path.resolve(__dirname, '../token.json') : null);

  if (!youtubeToken) {
    throw new Error('Kredensial YOUTUBE_API_TOKEN (atau GDRIVE_TOKEN / token.json) tidak ditemukan di konfigurasi!');
  }

  const auth = getGoogleAuth(youtubeToken, [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube',
  ]);

  const youtube = google.youtube({ version: 'v3', auth });

  /*
   * ---------------------------------------------------------------------------
   * KUSTOMISASI METADATA YOUTUBE
   * Silakan sesuaikan judul, deskripsi, tags, kategori, dan visibilitas di sini:
   * ---------------------------------------------------------------------------
   */
  const videoTitle = metadata.title || `Video Jadwal ${metadata.date} ${metadata.hour}:00 WIB`;
  const videoDescription =
    metadata.description ||
    `Otomatis diunggah oleh Heroku Scheduler Uploader pada ${metadata.date} jam ${metadata.hour}:00 WIB.\n#shorts #trending #viral`;
  const videoTags = metadata.tags || ['shorts', 'trending', 'viral', 'clipping'];
  const privacyStatus = process.env.YOUTUBE_PRIVACY_STATUS || 'public'; // 'public', 'unlisted', atau 'private'

  console.log(`[TAHAP D - YOUTUBE] Mengunggah "${videoTitle}" (Visibilitas: ${privacyStatus})...`);

  // Stream video langsung dari disk lokal menggunakan independent read stream
  const videoReadStream = fs.createReadStream(filePath);

  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: videoTitle,
        description: videoDescription,
        tags: videoTags,
        categoryId: '22', // 22: People & Blogs, 24: Entertainment, dll.
        defaultLanguage: 'id',
      },
      status: {
        privacyStatus: privacyStatus,
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: videoReadStream,
    },
  });

  console.log(`[TAHAP D - YOUTUBE] Sukses diunggah ke YouTube! Video ID: ${res.data.id} (URL: https://youtu.be/${res.data.id})`);
  return res.data;
}

/**
 * ============================================================================
 * FUNGSI UPLOAD TIKTOK
 * ============================================================================
 * Mengunggah file video lokal ke TikTok Content Posting API (v2 / Direct Post).
 * Parameter judul/caption, izin duet, stitch, komentar, dan visibilitas dapat diatur di sini.
 */
async function uploadToTikTok(filePath, metadata) {
  console.log('[TAHAP D - TIKTOK] Mempersiapkan upload ke TikTok API...');

  // Mode simulasi/mock untuk pengujian tanpa konsumsi kuota API
  if (process.env.MOCK_UPLOAD === 'true') {
    console.log('[TAHAP D - TIKTOK] [MOCK] Berhasil menyimulasikan upload ke TikTok.');
    return { publish_id: 'MOCK_TIKTOK_PUBLISH_ID' };
  }

  const tiktokToken = process.env.TIKTOK_API_TOKEN;
  if (!tiktokToken) {
    throw new Error('Kredensial TIKTOK_API_TOKEN tidak ditemukan di konfigurasi!');
  }

  const fileStats = fs.statSync(filePath);
  const fileSize = fileStats.size;

  /*
   * ---------------------------------------------------------------------------
   * KUSTOMISASI METADATA TIKTOK
   * Silakan sesuaikan caption, visibilitas privasi, dan preferensi interaksi:
   * ---------------------------------------------------------------------------
   */
  const postTitle = metadata.title || `Video Jadwal ${metadata.date} ${metadata.hour}:00 WIB #fyp #viral #trending`;
  const privacyLevel = process.env.TIKTOK_PRIVACY_LEVEL || 'PUBLIC_TO_EVERYONE';
  // Opsi privasi TikTok:
  // - 'PUBLIC_TO_EVERYONE'     (Publik untuk semua orang)
  // - 'MUTUAL_FOLLOW_FRIENDS'  (Hanya teman saling follow)
  // - 'FOLLOWER_OF_CREATOR'    (Hanya pengikut akun)
  // - 'SELF_ONLY'              (Privat / Hanya Saya)

  console.log(`[TAHAP D - TIKTOK] Inisialisasi post di TikTok API v2 (Ukuran File: ${(fileSize / (1024 * 1024)).toFixed(2)} MB)...`);

  // Langkah 1: Inisialisasi posting ke TikTok API v2
  const initEndpoint = 'https://open.tiktokapis.com/v2/post/publish/video/init/';
  const initPayload = {
    post_info: {
      title: postTitle,
      privacy_level: privacyLevel,
      disable_duet: false,
      disable_stitch: false,
      disable_comment: false,
      video_cover_timestamp_ms: 1000,
    },
    source_info: {
      source: 'FILE_UPLOAD',
      video_size: fileSize,
      chunk_size: fileSize,
      total_chunk_count: 1,
    },
  };

  const initRes = await axios.post(initEndpoint, initPayload, {
    headers: {
      Authorization: `Bearer ${tiktokToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
  });

  const publishData = initRes.data?.data;
  if (!publishData || !publishData.upload_url) {
    throw new Error(`Gagal inisialisasi posting TikTok: ${JSON.stringify(initRes.data)}`);
  }

  const { publish_id, upload_url } = publishData;
  console.log(`[TAHAP D - TIKTOK] Inisialisasi berhasil. Publish ID: ${publish_id}. Mengunggah binary video ke upload URL...`);

  // Langkah 2: Unggah binary video ke upload_url menggunakan streaming
  const videoReadStream = fs.createReadStream(filePath);
  await axios.put(upload_url, videoReadStream, {
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': fileSize,
      'Content-Range': `bytes 0-${fileSize - 1}/${fileSize}`,
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  console.log(`[TAHAP D - TIKTOK] Sukses diunggah ke TikTok! Publish ID: ${publish_id}`);
  return { publish_id };
}

/**
 * ============================================================================
 * ORKESTRASI UTAMA SCRIPT
 * ============================================================================
 */
async function runSchedulerUploader() {
  console.log('================================================================');
  console.log('       HEROKU SCHEDULER VIDEO UPLOADER - STATIC CLI SCRIPT      ');
  console.log('================================================================');

  // Validasi variabel lingkungan yang wajib ada
  const unusedFolderId = process.env.GDRIVE_UNUSED_FOLDER_ID || process.env.GDRIVE_ROOT_FOLDER_ID;
  if (!unusedFolderId) {
    console.error('[KONFIGURASI ERROR] GDRIVE_UNUSED_FOLDER_ID belum diatur pada environment variables!');
    process.exit(1);
  }

  const gdriveToken =
    process.env.GDRIVE_TOKEN ||
    process.env.GDRIVE_OAUTH_TOKEN ||
    process.env.GOOGLE_OAUTH_TOKEN ||
    (fs.existsSync(path.resolve(__dirname, 'token.json')) ? path.resolve(__dirname, 'token.json') : null) ||
    (fs.existsSync(path.resolve(__dirname, '../token.json')) ? path.resolve(__dirname, '../token.json') : null);

  if (!gdriveToken) {
    console.error('[KONFIGURASI ERROR] GDRIVE_TOKEN (atau token.json) belum diatur pada environment variables!');
    process.exit(1);
  }

  // 1. Ambil target tanggal dan jam berdasarkan waktu WIB (UTC+7)
  const { wibTimeFormatted, targetDate, targetHour, targetFolderName, targetFileName } = getWIBTarget();
  console.log(`[WAKTU] Saat ini       : ${wibTimeFormatted}`);
  console.log(`[TARGET] Folder GDrive : "${targetFolderName}"`);
  console.log(`[TARGET] File Video    : "${targetFileName}"`);

  // Inisialisasi Google Drive Client
  const driveAuth = getGoogleAuth(gdriveToken, [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.readonly',
  ]);
  const drive = google.drive({ version: 'v3', auth: driveAuth });

  // Mode Antrean: 'random' (pilih acak game & klip, lalu pindah ke used) atau 'schedule' (folder tanggal & jam)
  const queueMode = process.env.QUEUE_MODE || 'random';
  const usedFolderId = process.env.GDRIVE_USED_FOLDER_ID;

  let selectedFolder = null;
  let videoFile = null;

  // Helper shuffle array secara acak
  function shuffleArray(arr) {
    const list = [...arr];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  if (queueMode === 'random') {
    // --------------------------------------------------------------------------
    // MODE RANDOM:
    // 1. Ambil seluruh folder game/stream di dalam root folder (abaikan folder used)
    // 2. Acak urutan folder game
    // 3. Di dalam folder game terpilih, ambil file video acak yang belum [USED]
    // --------------------------------------------------------------------------
    console.log(`\n[MODE ANTRIAN: RANDOM / CONTENT POOL]`);
    console.log(`Mencari folder game/stream di dalam folder Unused (${unusedFolderId})...`);

    const folderRes = await drive.files.list({
      q: `'${unusedFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    // Saring folder: abaikan folder 'used', 'archive', 'trash', dan ID usedFolderId
    const candidateFolders = (folderRes.data.files || []).filter((f) => {
      if (usedFolderId && f.id === usedFolderId) return false;
      const lower = f.name.toLowerCase();
      return !['used', 'archive', 'trash', 'bin'].includes(lower);
    });

    if (candidateFolders.length === 0) {
      // Jika tidak ada subfolder, cari video langsung di dalam folder unused
      console.log('Tidak ada subfolder game. Mencari video klip langsung di folder unused...');
      const rootFilesRes = await drive.files.list({
        q: `'${unusedFolderId}' in parents and (mimeType contains 'video/' or name contains '.mp4') and not name contains '[USED]' and trashed = false`,
        fields: 'files(id, name, size, mimeType)',
        spaces: 'drive',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const directFiles = rootFilesRes.data.files || [];
      if (directFiles.length === 0) {
        console.log('Tidak ada file video baru di Google Drive. Semua klip sudah terpakai.');
        process.exit(0);
      }
      selectedFolder = { id: unusedFolderId, name: 'Root' };
      videoFile = shuffleArray(directFiles)[0];
    } else {
      // Acak folder game
      const shuffledFolders = shuffleArray(candidateFolders);

      for (const folder of shuffledFolders) {
        console.log(`Memeriksa folder game/stream: "${folder.name}"...`);
        const filesRes = await drive.files.list({
          q: `'${folder.id}' in parents and (mimeType contains 'video/' or name contains '.mp4') and not name contains '[USED]' and trashed = false`,
          fields: 'files(id, name, size, mimeType)',
          spaces: 'drive',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });

        const availableClips = filesRes.data.files || [];
        if (availableClips.length > 0) {
          selectedFolder = folder;
          videoFile = shuffleArray(availableClips)[0];
          console.log(`\n🎲 [TERPILIH SECARA ACAK]`);
          console.log(` - Kategori / Game : "${selectedFolder.name}"`);
          console.log(` - File Video Klip : "${videoFile.name}" (dari ${availableClips.length} klip tersedia)`);
          break;
        }
      }

      if (!videoFile) {
        console.log('\nSeluruh folder game sudah kosong / semua klip sudah berlabel [USED]. Selesai.');
        process.exit(0);
      }
    }
  } else {
    // --------------------------------------------------------------------------
    // MODE SCHEDULE LAMA (Pencocokan Nama Folder Tanggal & Nama File Jam):
    // --------------------------------------------------------------------------
    console.log(`\n[MODE ANTRIAN: STRICT SCHEDULE]`);
    console.log(`Mencari folder "${targetFolderName}" di folder unused (${unusedFolderId})...`);

    const folderRes = await drive.files.list({
      q: `name = '${targetFolderName}' and '${unusedFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const matchingFolders = folderRes.data.files || [];
    if (matchingFolders.length === 0) {
      console.log(`Folder tanggal "${targetFolderName}" tidak ditemukan. Tidak ada jadwal hari ini.`);
      process.exit(0);
    }

    selectedFolder = matchingFolders[0];
    console.log(`Folder ditemukan: "${selectedFolder.name}" (ID: ${selectedFolder.id})`);

    const fileRes = await drive.files.list({
      q: `name = '${targetFileName}' and '${selectedFolder.id}' in parents and trashed = false`,
      fields: 'files(id, name, size, mimeType)',
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const matchingFiles = fileRes.data.files || [];
    if (matchingFiles.length === 0) {
      console.log(`File video "${targetFileName}" tidak ditemukan di folder "${selectedFolder.name}".`);
      process.exit(0);
    }

    videoFile = matchingFiles[0];
  }

  const sizeMb = videoFile.size ? (parseInt(videoFile.size, 10) / (1024 * 1024)).toFixed(2) : 'unknown';
  console.log(`\n[DETAIL KLIP] Nama: "${videoFile.name}" (ID: ${videoFile.id}, Ukuran: ${sizeMb} MB)`);

  // --------------------------------------------------------------------------
  // TAHAP C (Download):
  // Download file video secara streaming (fs.createWriteStream) langsung ke disk lokal.
  // --------------------------------------------------------------------------
  console.log(`\n[TAHAP C] Mengunduh video secara streaming ke "${TEMP_VIDEO_FILE}"...`);
  if (fs.existsSync(TEMP_VIDEO_FILE)) {
    fs.unlinkSync(TEMP_VIDEO_FILE);
  }

  const driveStreamRes = await drive.files.get(
    {
      fileId: videoFile.id,
      alt: 'media',
      supportsAllDrives: true,
    },
    { responseType: 'stream' }
  );

  const localWriteStream = fs.createWriteStream(TEMP_VIDEO_FILE);
  await pipeline(driveStreamRes.data, localWriteStream);

  const stats = fs.statSync(TEMP_VIDEO_FILE);
  const downloadedMb = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`[TAHAP C] Download selesai 100%. File tersimpan di disk lokal (${downloadedMb} MB).`);

  // --------------------------------------------------------------------------
  // TAHAP D (Upload Paralel):
  // Mengunggah ./temp_video.mp4 secara bersamaan ke YouTube dan TikTok via Promise.all().
  // --------------------------------------------------------------------------
  console.log(`\n[TAHAP D] Memulai pengunggahan paralel (Promise.all) ke YouTube dan TikTok...`);

  // Susun judul & tag yang relevan dengan nama game dan nama klip
  const gameTag = selectedFolder && selectedFolder.name !== 'Root' ? `#${selectedFolder.name.replace(/\s+/g, '')}` : '';
  const cleanClipName = videoFile.name.replace(/\.mp4$/i, '').replace(/^\[USED[^\]]*\]_?/i, '').trim();

  const sharedMetadata = {
    date: targetDate,
    hour: targetHour,
    fileName: videoFile.name,
    title: `${cleanClipName} ${gameTag}`.trim() || `Video Klip ${targetDate} ${targetHour}:00 WIB`,
    description: `Otomatis diunggah oleh Heroku Scheduler Uploader pada ${targetDate} jam ${targetHour}:00 WIB.\n#shorts #trending #viral ${gameTag} #fyp`,
    tags: ['shorts', 'trending', 'viral', 'clipping', selectedFolder?.name].filter(Boolean),
  };

  const [youtubeResult, tiktokResult] = await Promise.all([
    uploadToYouTube(TEMP_VIDEO_FILE, sharedMetadata),
    uploadToTikTok(TEMP_VIDEO_FILE, sharedMetadata),
  ]);

  console.log('\n[TAHAP D] Hasil Eksekusi Upload Paralel:');
  console.log(` - YouTube ID        : ${youtubeResult?.id || 'OK'}`);
  console.log(` - TikTok Publish ID : ${tiktokResult?.publish_id || 'OK'}`);

  // --------------------------------------------------------------------------
  // TAHAP E (Instant Move / Rename di Google Drive & Clean Up Lokal):
  // Pindahkan file video ke GDRIVE_USED_FOLDER_ID (pointer update instan tanpa re-upload!)
  // dan rename menjadi [USED_YYYY-MM-DD_HHh]_nama.mp4
  // --------------------------------------------------------------------------
  const cleanOriginalName = videoFile.name.replace(/^\[USED[^\]]*\]_?/i, '');
  const newGdriveFileName = `[USED_${targetDate}_${targetHour}h]_${cleanOriginalName}`;

  try {
    if (usedFolderId && selectedFolder && selectedFolder.id !== usedFolderId) {
      console.log(`\n[TAHAP E] Memindahkan file di Google Drive ke folder Used (${usedFolderId})...`);
      console.log(`(Perpindahan instan via metadata pointer update: NOL kuota upload!)`);

      await drive.files.update({
        fileId: videoFile.id,
        addParents: usedFolderId,
        removeParents: selectedFolder.id,
        requestBody: {
          name: newGdriveFileName,
        },
        fields: 'id, name, parents',
        supportsAllDrives: true,
      });

      console.log(`[TAHAP E] Berhasil dipindahkan ke folder Used & di-rename menjadi "${newGdriveFileName}".`);
    } else {
      console.log(`\n[TAHAP E] Me-rename file di tempat menjadi "${newGdriveFileName}" agar tidak terpilih lagi...`);
      await drive.files.update({
        fileId: videoFile.id,
        requestBody: {
          name: newGdriveFileName,
        },
        fields: 'id, name',
        supportsAllDrives: true,
      });
      console.log(`[TAHAP E] Berhasil di-rename di tempat.`);
    }
  } catch (gdriveUpdateErr) {
    console.warn(`[TAHAP E PERINGATAN] Gagal memindahkan/me-rename file di Google Drive: ${gdriveUpdateErr.message}`);
    console.warn('Proses upload ke YouTube dan TikTok tetap dinyatakan berhasil.');
  }

  // Bersihkan file sementara di disk lokal
  console.log(`\n[CLEANUP] Membersihkan file sementara "${TEMP_VIDEO_FILE}" dari disk...`);
  if (fs.existsSync(TEMP_VIDEO_FILE)) {
    fs.unlinkSync(TEMP_VIDEO_FILE);
    console.log(`[CLEANUP] File sementara berhasil dihapus.`);
  }

  console.log('\nUpload Berhasil');
  process.exit(0);
}

// Eksekusi utama dengan penanganan error global
runSchedulerUploader().catch((error) => {
  console.error('\n================================================================');
  console.error('[ERROR] Terjadi kesalahan selama eksekusi scheduler:');
  console.error(error.message || error);
  if (error.response?.data) {
    console.error('[ERROR RESPONSE DATA]:', JSON.stringify(error.response.data, null, 2));
  }
  console.error('================================================================');

  // Bersihkan file sementara jika masih ada di disk setelah terjadi kegagalan
  try {
    if (fs.existsSync(TEMP_VIDEO_FILE)) {
      fs.unlinkSync(TEMP_VIDEO_FILE);
      console.log(`[CLEANUP] File sementara "${TEMP_VIDEO_FILE}" berhasil dibersihkan setelah error.`);
    }
  } catch (cleanErr) {
    console.error(`[CLEANUP ERROR] Gagal menghapus file sementara:`, cleanErr.message);
  }

  // Akhiri dengan exit code 1 jika terjadi kesalahan
  process.exit(1);
});
