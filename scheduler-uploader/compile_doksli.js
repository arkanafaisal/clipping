/**
 * ============================================================================
 * AUTO EDIT KOMPILASI TEBAK-TEBAKAN DOKSLI (VIDEO QUIZ COMPILER)
 * ============================================================================
 * Script mandiri yang mengambil 5-10 video klip secara acak dari 1 folder
 * Google Drive (tanpa subfolder), lalu secara otomatis mengeditnya menjadi
 * 1 video kompilasi vertikal (Shorts / Reels / TikTok) dengan format kuis:
 *
 * Alur Tiap Klip:
 * 1. Video klip diputar normal.
 * 2. Di frame terakhir video, klip di-freeze selama 4 detik:
 *    - Overlay gelap semi-transparan dengan judul "Momen manakah itu?".
 *    - Pilihan ganda A, B, C, D (1 nama file benar + 3 nama file acak dari pool).
 *    - Hitung mundur 3 detik (angka 3, 2, 1 + progress bar).
 *    - Setelah 3 detik: Opsi yang benar berubah menjadi HIJAU EMERALD (selama 1 detik).
 * 3. Langsung berpindah ke video berikutnya lengkap dengan kuisnya.
 * 4. Seluruh video digabungkan secara seamless menjadi 1 file output .mp4.
 *
 * Jalankan dengan:
 *   node compile_doksli.js
 * atau
 *   npm run doksli
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { execSync } = require('child_process');
const dotenv = require('dotenv');
const { google } = require('googleapis');

// Path binary FFmpeg (menggunakan ffmpeg-static yang sudah terpasang)
let FFMPEG_BIN = 'ffmpeg';
try {
  FFMPEG_BIN = require('ffmpeg-static') || 'ffmpeg';
} catch (e) {
  FFMPEG_BIN = process.env.FFMPEG_PATH || 'ffmpeg';
}

// Muat variabel lingkungan dari .env
const localEnvPath = path.resolve(__dirname, '.env');
const rootEnvPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath });
} else if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else {
  dotenv.config();
}

/**
 * Factory kredensial Google API yang fleksibel (Drive API)
 */
function getGoogleAuth(tokenOrCreds, scopes) {
  if (!tokenOrCreds) {
    throw new Error('Kredensial Google API (GDRIVE_TOKEN / token.json) tidak ditemukan di konfigurasi!');
  }

  let credsObj = null;
  if (typeof tokenOrCreds === 'string') {
    const trimmed = tokenOrCreds.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        credsObj = JSON.parse(trimmed);
      } catch (e) {
        throw new Error('Format string JSON kredensial Google tidak valid.');
      }
    } else if (fs.existsSync(trimmed)) {
      try {
        const fileContent = fs.readFileSync(trimmed, 'utf8');
        credsObj = JSON.parse(fileContent);
      } catch (e) {
        throw new Error(`Gagal membaca file kredensial Google di "${trimmed}": ${e.message}`);
      }
    }
  } else if (typeof tokenOrCreds === 'object' && tokenOrCreds !== null) {
    credsObj = tokenOrCreds;
  }

  if (credsObj) {
    if (credsObj.type === 'service_account') {
      return new google.auth.JWT({
        email: credsObj.client_email,
        key: credsObj.private_key,
        scopes,
      });
    }

    const clientId = credsObj.client_id || (credsObj.installed && credsObj.installed.client_id);
    const clientSecret = credsObj.client_secret || (credsObj.installed && credsObj.installed.client_secret);
    const refreshToken = credsObj.refresh_token;

    if (clientId && clientSecret && refreshToken) {
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      return oauth2Client;
    }

    if (refreshToken) {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GDRIVE_CLIENT_ID,
        process.env.GDRIVE_CLIENT_SECRET
      );
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      return oauth2Client;
    }
  }

  if (typeof tokenOrCreds === 'string') {
    const trimmed = tokenOrCreds.trim();
    const oauth2Client = new google.auth.OAuth2(
      process.env.GDRIVE_CLIENT_ID,
      process.env.GDRIVE_CLIENT_SECRET
    );
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
 * Helper shuffle array secara acak (Fisher-Yates)
 */
function shuffleArray(arr) {
  const list = [...arr];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/**
 * Helper membersihkan nama file untuk dijadikan jawaban kuis
 */
function cleanMomentName(filename) {
  return filename
    .replace(/\.[a-zA-Z0-9]+$/i, '') // Hapus ekstensi (.mp4, .mkv, dll)
    .replace(/^[0-9]+[_\-\s]+/i, '') // Hapus angka prefix penomoran jika ada
    .replace(/[_\-]+/g, ' ')         // Ubah underscore / dash menjadi spasi
    .replace(/\s+/g, ' ')            // Rapikan spasi ganda
    .trim();
}

/**
 * Pembuat Subtitle ASS Dinamis untuk Overlay Kuis & Animasi Pilihan Ganda
 */
function generateQuizASS({
  question = 'Momen manakah itu?',
  options = [],
  correctIndex = 0,
}) {
  const cardY = [1120, 1270, 1420, 1570];
  const cardW = 920;
  const cardH = 110;
  const leftX = (1080 - cardW) / 2; // 80

  // Path vektor rounded rectangle (920 x 110 dengan radius 20px)
  const roundRect = `m 0 20 b 0 9 9 0 20 0 l 900 0 b 911 0 920 9 920 20 l 920 90 b 920 101 911 110 900 110 l 20 110 b 9 110 0 101 0 90`;

  const events = [];

  // 1. Fullscreen Dark Overlay (Gelapkan frame video asli sekitar 70%)
  events.push(`Dialogue: 0,0:00:00.00,0:00:04.00,Default,,0,0,0,,{\\pos(0,0)\\an7\\p1\\1a&H45&\\1c&H000000&\\3a&HFF&}m 0 0 l 1080 0 l 1080 1920 l 0 1920{\\p0}`);

  // 2. Question Header
  events.push(`Dialogue: 1,0:00:00.00,0:00:04.00,Default,,0,0,0,,{\\pos(540,560)\\an5\\fs38\\b1\\c&H00D4FF&}TEBAK DOKSLI`);
  events.push(`Dialogue: 1,0:00:00.00,0:00:04.00,Default,,0,0,0,,{\\pos(540,660)\\an5\\fs64\\b1\\c&HFFFFFF&\\bord4\\3c&H000000&}${question}`);

  // 3. Countdown Display (3, 2, 1, dan JAWABAN BENAR)
  events.push(`Dialogue: 2,0:00:00.00,0:00:01.00,Default,,0,0,0,,{\\pos(540,840)\\an5\\fs120\\b1\\c&H00E5FF&\\bord6\\3c&H000000&}3`);
  events.push(`Dialogue: 2,0:00:01.00,0:00:02.00,Default,,0,0,0,,{\\pos(540,840)\\an5\\fs120\\b1\\c&H00E5FF&\\bord6\\3c&H000000&}2`);
  events.push(`Dialogue: 2,0:00:02.00,0:00:03.00,Default,,0,0,0,,{\\pos(540,840)\\an5\\fs130\\b1\\c&H0099FF&\\bord6\\3c&H000000&}1`);
  events.push(`Dialogue: 2,0:00:03.00,0:00:04.00,Default,,0,0,0,,{\\pos(540,840)\\an5\\fs68\\b1\\c&H00E65C&\\bord4\\3c&H000000&}JAWABAN BENAR:`);

  // Progress Bar (Mengecil selama 3 detik)
  events.push(`Dialogue: 1,0:00:00.00,0:00:01.00,Default,,0,0,0,,{\\pos(140,940)\\an7\\p1\\1c&H00E65C&\\3a&HFF&}m 0 0 l 800 0 l 800 12 l 0 12{\\p0}`);
  events.push(`Dialogue: 1,0:00:01.00,0:00:02.00,Default,,0,0,0,,{\\pos(140,940)\\an7\\p1\\1c&H00D4FF&\\3a&HFF&}m 0 0 l 530 0 l 530 12 l 0 12{\\p0}`);
  events.push(`Dialogue: 1,0:00:02.00,0:00:03.00,Default,,0,0,0,,{\\pos(140,940)\\an7\\p1\\1c&H0077FF&\\3a&HFF&}m 0 0 l 260 0 l 260 12 l 0 12{\\p0}`);

  // 4. Opsi Pilihan Ganda (A, B, C, D)
  const letters = ['A', 'B', 'C', 'D'];
  for (let i = 0; i < 4; i++) {
    const yTop = cardY[i];
    const yMid = yTop + 55;
    const isCorrect = i === correctIndex;
    
    // Potong teks jika terlalu panjang agar tidak keluar batas kartu
    let text = options[i] || `Pilihan ${letters[i]}`;
    if (text.length > 36) {
      text = text.substring(0, 33) + '...';
    }
    const label = `${letters[i]}. ${text}`;

    // --- FASE 1: Detik 0.0 s/d 3.0 (Semua Opsi Netral) ---
    events.push(`Dialogue: 1,0:00:00.00,0:00:03.00,Default,,0,0,0,,{\\pos(${leftX},${yTop})\\an7\\p1\\1a&H35&\\1c&H251D18&\\3a&H20&\\3c&H605040&\\bord3}${roundRect}{\\p0}`);
    events.push(`Dialogue: 2,0:00:00.00,0:00:03.00,Default,,0,0,0,,{\\pos(140,${yMid})\\an4\\fs44\\b1\\c&HFFFFFF&\\bord2\\3c&H000000&}${label}`);

    // --- FASE 2: Detik 3.0 s/d 4.0 (Jawaban Terbuka) ---
    if (isCorrect) {
      // HIJAU EMERALD TERANG (#22C55E)
      events.push(`Dialogue: 1,0:00:03.00,0:00:04.00,Default,,0,0,0,,{\\pos(${leftX},${yTop})\\an7\\p1\\1a&H00&\\1c&H30A020&\\3a&H00&\\3c&H60F040&\\bord5}${roundRect}{\\p0}`);
      events.push(`Dialogue: 2,0:00:03.00,0:00:04.00,Default,,0,0,0,,{\\pos(140,${yMid})\\an4\\fs48\\b1\\c&HFFFFFF&\\bord3\\3c&H104010&}[V]  ${label}`);
    } else {
      // Opsi salah dibuat redup
      events.push(`Dialogue: 1,0:00:03.00,0:00:04.00,Default,,0,0,0,,{\\pos(${leftX},${yTop})\\an7\\p1\\1a&H75&\\1c&H101010&\\3a&H85&\\3c&H303030&\\bord2}${roundRect}{\\p0}`);
      events.push(`Dialogue: 2,0:00:03.00,0:00:04.00,Default,,0,0,0,,{\\pos(140,${yMid})\\an4\\fs42\\b0\\c&H888888&\\bord2\\3c&H000000&}${label}`);
    }
  }

  return `[Script Info]
Title: Quiz Doksli Overlay
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default, Arial, 48, &H00FFFFFF, &H000000FF, &H00000000, &H00000000, 1, 0, 0, 0, 100, 100, 0, 0, 1, 2, 0, 5, 40, 40, 40, 1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events.join('\n')}
`;
}

/**
 * Eksekusi Utama Kompilator Kuis Doksli
 */
async function runQuizCompiler() {
  console.clear();
  console.log('================================================================');
  console.log('       🎬 AUTO EDIT KOMPILASI TEBAK-TEBAKAN DOKSLI              ');
  console.log('================================================================');

  // 1. Validasi folder doksli Google Drive
  let doksliFolderId =
    process.env.GDRIVE_DOKSLI_FOLDER_ID ||
    process.env.GDRIVE_UNUSED_FOLDER_ID ||
    process.env.GDRIVE_ROOT_FOLDER_ID;

  // Cek argumen CLI (misal: node compile_doksli.js --folder=1xyz --count=7)
  let clipCountTarget = parseInt(process.env.QUIZ_CLIP_COUNT || '5', 10);
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--folder=')) doksliFolderId = arg.split('=')[1];
    if (arg.startsWith('--count=')) clipCountTarget = parseInt(arg.split('=')[1], 10);
  }

  if (!doksliFolderId) {
    console.error('❌ [ERROR] ID Folder Google Drive (GDRIVE_DOKSLI_FOLDER_ID) belum diatur di .env!');
    console.error('   Silakan isi GDRIVE_DOKSLI_FOLDER_ID=<id_folder_gdrive_anda> pada .env');
    process.exit(1);
  }

  // Batasi jumlah klip yang wajar (5 s/d 10)
  if (isNaN(clipCountTarget) || clipCountTarget < 2) clipCountTarget = 5;
  if (clipCountTarget > 15) clipCountTarget = 10;

  console.log(`\nKonfigurasi:`);
  console.log(` - ID Folder Google Drive : ${doksliFolderId}`);
  console.log(` - Target Klip Kompilasi  : ${clipCountTarget} video`);
  console.log(` - Format Output          : Vertikal 9:16 (1080x1920) 30 FPS`);
  console.log(` - Durasi Freeze Kuis     : 3 detik tebak + 1 detik jawaban hijau (4 detik total)\n`);

  // 2. Hubungkan ke Google Drive API
  const gdriveToken =
    process.env.GDRIVE_TOKEN ||
    process.env.GDRIVE_OAUTH_TOKEN ||
    (fs.existsSync(path.resolve(__dirname, 'token.json')) ? path.resolve(__dirname, 'token.json') : null) ||
    (fs.existsSync(path.resolve(__dirname, '../token.json')) ? path.resolve(__dirname, '../token.json') : null);

  if (!gdriveToken) {
    console.error('❌ [ERROR] Kredensial Google (token.json) tidak ditemukan! Jalankan "npm run auth" terlebih dahulu.');
    process.exit(1);
  }

  const driveAuth = getGoogleAuth(gdriveToken, [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive',
  ]);
  const drive = google.drive({ version: 'v3', auth: driveAuth });

  // 3. Ambil daftar file video di dalam folder DokSli
  console.log('[TAHAP 1/4] Mengambil seluruh daftar file video di Google Drive...');
  const res = await drive.files.list({
    q: `'${doksliFolderId}' in parents and (mimeType contains 'video/' or name contains '.mp4' or name contains '.mkv' or name contains '.mov') and trashed = false`,
    fields: 'files(id, name, size, mimeType)',
    spaces: 'drive',
    pageSize: 500,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const allFiles = res.data.files || [];
  if (allFiles.length === 0) {
    console.error('❌ [ERROR] Tidak ada file video yang ditemukan di folder Google Drive tersebut.');
    process.exit(1);
  }

  console.log(`✅ Berhasil menemukan ${allFiles.length} file video di dalam pool Google Drive.`);
  if (allFiles.length < 4) {
    console.error('❌ Diperlukan minimal 4 video di dalam folder untuk membuat 4 pilihan ganda (A, B, C, D).');
    process.exit(1);
  }

  // 4. Pilih klip secara acak dan susun kuis
  console.log('\n[TAHAP 2/4] Mengacak pemilihan video dan merangkai tebak-tebakan pilihan ganda...');
  const countToPick = Math.min(clipCountTarget, allFiles.length);
  const shuffledPool = shuffleArray(allFiles);
  const selectedClips = shuffledPool.slice(0, countToPick);

  // Buat pool nama seluruh momen
  const allMomentNames = allFiles.map((f) => cleanMomentName(f.name));

  const quizSegments = [];
  for (let i = 0; i < selectedClips.length; i++) {
    const currentClip = selectedClips[i];
    const correctName = cleanMomentName(currentClip.name);

    // Ambil 3 nama momen salah yang unik dari pool
    const wrongCandidates = shuffleArray(allMomentNames.filter((name) => name !== correctName));
    const wrongOptions = wrongCandidates.slice(0, 3);

    // Gabungkan dan acak posisi jawaban benar di antara A, B, C, D
    const options = shuffleArray([correctName, ...wrongOptions]);
    const correctIndex = options.indexOf(correctName);

    quizSegments.push({
      fileInfo: currentClip,
      correctName,
      options,
      correctIndex,
    });

    const letter = ['A', 'B', 'C', 'D'][correctIndex];
    console.log(` 📌 Klip #${i + 1}: "${correctName}" -> Kunci Jawaban: [${letter}]`);
  }

  // 5. Download dan proses pengeditan segmen video
  console.log('\n[TAHAP 3/4] Mengunduh dan memproses klip dengan freeze frame & overlay kuis...');

  const workDir = path.resolve(__dirname, 'temp_doksli_work');
  if (fs.existsSync(workDir)) {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
  fs.mkdirSync(workDir, { recursive: true });

  const finalSegmentPaths = [];

  for (let i = 0; i < quizSegments.length; i++) {
    const segment = quizSegments[i];
    const clipIndex = i + 1;
    console.log(`\n🎬 [MEMPROSES KLIP ${clipIndex}/${quizSegments.length}]: "${segment.correctName}"...`);

    // a. Unduh video dari Google Drive
    const rawPath = path.join(workDir, `raw_${clipIndex}.mp4`);
    console.log(`   - Mengunduh dari GDrive...`);
    const driveStream = await drive.files.get(
      { fileId: segment.fileInfo.id, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream' }
    );
    await pipeline(driveStream.data, fs.createWriteStream(rawPath));

    // b. Ekstrak frame terakhir video
    console.log(`   - Mengekstrak frame terakhir untuk freeze frame...`);
    const freezeFramePng = path.join(workDir, `freeze_${clipIndex}.png`);
    execSync(`"${FFMPEG_BIN}" -y -sseof -0.1 -i "${rawPath}" -update 1 -q:v 1 "${freezeFramePng}"`, { stdio: 'ignore' });

    // c. Buat file ASS subtitle untuk kuis
    console.log(`   - Men-generate overlay kuis (DirectWrite vector ASS)...`);
    const assPath = path.join(workDir, `quiz_${clipIndex}.ass`);
    fs.writeFileSync(
      assPath,
      generateQuizASS({
        question: 'Momen manakah itu?',
        options: segment.options,
        correctIndex: segment.correctIndex,
      }),
      'utf8'
    );

    // d. Render video freeze 4 detik dengan overlay ASS dan audio hening stereo
    const freezeVideoPath = path.join(workDir, `freeze_vid_${clipIndex}.mp4`);
    const escapedAss = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');
    console.log(`   - Merender 4 detik freeze kuis...`);
    execSync(
      `"${FFMPEG_BIN}" -y -loop 1 -i "${freezeFramePng}" -f lavfi -i "anullsrc=r=44100:cl=stereo" -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,ass='${escapedAss}'" -t 4 -c:v libx264 -preset veryfast -c:a aac -ar 44100 -ac 2 -r 30 -pix_fmt yuv420p "${freezeVideoPath}"`,
      { stdio: 'ignore' }
    );

    // e. Normalisasi video asli (format 1080x1920 30fps dan audio 44100Hz stereo agar cocok di-concat)
    console.log(`   - Menormalisasi video klip utama...`);
    const normClipPath = path.join(workDir, `norm_clip_${clipIndex}.mp4`);
    execSync(
      `"${FFMPEG_BIN}" -y -i "${rawPath}" -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" -c:v libx264 -preset veryfast -c:a aac -ar 44100 -ac 2 -r 30 -pix_fmt yuv420p "${normClipPath}"`,
      { stdio: 'ignore' }
    );

    // f. Gabungkan klip asli + freeze kuis menjadi 1 segmen
    console.log(`   - Menggabungkan klip + freeze kuis...`);
    const segmentOut = path.join(workDir, `segment_${clipIndex}.mp4`);
    const concatListTxt = path.join(workDir, `concat_clip_${clipIndex}.txt`);
    fs.writeFileSync(
      concatListTxt,
      `file '${normClipPath.replace(/\\/g, '/')}'\nfile '${freezeVideoPath.replace(/\\/g, '/')}'\n`,
      'utf8'
    );
    execSync(`"${FFMPEG_BIN}" -y -f concat -safe 0 -i "${concatListTxt}" -c copy "${segmentOut}"`, { stdio: 'ignore' });

    finalSegmentPaths.push(segmentOut);
    console.log(`   ✅ Segmen #${clipIndex} selesai.`);
  }

  // 6. Gabungkan seluruh segmen menjadi 1 video kompilasi final
  console.log('\n[TAHAP 4/4] Menggabungkan seluruh segmen menjadi 1 video kompilasi utuh...');

  const outputDir = path.resolve(__dirname, 'output_kompilasi');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const finalOutputPath = path.join(outputDir, `kompilasi_tebak_doksli_${timestamp}.mp4`);

  const mainConcatList = path.join(workDir, 'final_concat_list.txt');
  fs.writeFileSync(
    mainConcatList,
    finalSegmentPaths.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n') + '\n',
    'utf8'
  );

  execSync(`"${FFMPEG_BIN}" -y -f concat -safe 0 -i "${mainConcatList}" -c copy "${finalOutputPath}"`, { stdio: 'ignore' });

  // Bersihkan temporary work directory
  console.log('\n[BERSIH-BERSIH] Menghapus cache temporary video mentah...');
  try {
    fs.rmSync(workDir, { recursive: true, force: true });
  } catch (e) {}

  const finalStats = fs.statSync(finalOutputPath);
  const sizeMb = (finalStats.size / (1024 * 1024)).toFixed(2);

  console.log('\n================================================================');
  console.log('🎉 KOMPILASI TEBAK DOKSLI BERHASIL DIBUAT!');
  console.log('================================================================');
  console.log(`📁 File Output : ${finalOutputPath}`);
  console.log(`📊 Ukuran File : ${sizeMb} MB`);
  console.log(`🎞️ Total Klip  : ${quizSegments.length} momen kuis`);
  console.log('================================================================\n');
}

runQuizCompiler().catch((err) => {
  console.error('\n❌ Terjadi kesalahan saat memproses kompilasi doksli:', err);
  process.exit(1);
});
