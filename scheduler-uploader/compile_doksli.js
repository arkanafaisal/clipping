/**
 * ============================================================================
 * AUTO EDIT KOMPILASI TEBAK-TEBAKAN DOKSLI (VIDEO QUIZ COMPILER)
 * ============================================================================
 * Script mandiri yang mengambil 5-10 momen secara acak dari folder induk
 * Google Drive. Folder induk berisi subfolder-subfolder momen (nama folder
 * adalah kunci jawaban kuis).
 *
 * Di dalam masing-masing subfolder momen, terdapat tepat 2 video file:
 * 1. cut.mp4           : Klip potongan epik (misal facecam saja).
 * 2. <nama_momen>.mp4  : Video full meme yang lebih panjang (nama dinamis).
 *
 * Jika jumlah file video di dalam folder tidak tepat 2 atau tidak ada cut.mp4,
 * folder tersebut otomatis dilewati dan memilih folder acak lainnya.
 *
 * Alur Tiap Momen:
 * 1. Video 'cut.mp4' diputar normal.
 * 2. Frame terakhir 'cut.mp4' di-freeze selama 4 detik:
 *    - Overlay gelap semi-transparan dengan judul "Momen manakah itu?".
 *    - Pilihan ganda A, B, C, D (1 nama folder benar + 3 nama folder acak lain).
 *    - Hitung mundur 3 detik (angka 3, 2, 1 + progress bar).
 *    - Detik ke-3 s/d 4: Opsi yang benar berubah menjadi HIJAU EMERALD (tanpa [V]).
 * 3. Video full diputar dengan overlay teks judul file full di tengah layar
 *    (vertikal & horizontal) dengan dukungan manual line break (\n).
 * 4. Seluruh momen digabungkan secara seamless menjadi 1 video vertikal .mp4.
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
const { execSync, spawnSync } = require('child_process');
const dotenv = require('dotenv');
const { google } = require('googleapis');

// Path binary FFmpeg (menggunakan ffmpeg-static)
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
 * Bank Opsi Pengecoh Cadangan Statis (Digunakan jika subfolder di Google Drive kurang dari 4)
 */
const STATIC_FALLBACK_DISTRACTORS = [
  'Minecraft',
  'Resident Evil 4',
  'GTA San Andreas',
  'Grand Theft Auto V',
  'Only Up!',
  'Mobile Legends',
  'Roblox',
  'Subway Surfers',
  'Stumble Guys',
  'God of War',
  'Outlast',
  'Elden Ring',
  'Clash of Clans',
  'Cat Mario',
  'Getting Over It',
  'Silent Hill',
  'DreadOut',
  'Valorant',
  'The Last of Us',
  'Dark Souls',
];

/**
 * Helper menghasilkan 4 opsi pilihan ganda unik (1 jawaban benar + 3 pengecoh).
 * Menggunakan Set dan validasi case-insensitive sehingga DIJAMIN 100% TIDAK AKAN PERNAH DUPLIKAT.
 */
function createUniqueQuizOptions(correctAnswer, folderPool = []) {
  const correctClean = correctAnswer.trim();
  const selectedSet = new Set([correctClean]);

  // 1. Ambil kandidat dari subfolder Google Drive lain jika ada
  const candidatesFromDrive = shuffleArray(
    folderPool
      .map((f) => (typeof f === 'string' ? f : f.name || '').trim())
      .filter((name) => name && name.toLowerCase() !== correctClean.toLowerCase())
  );

  for (const name of candidatesFromDrive) {
    if (selectedSet.size >= 4) break;
    const alreadyExists = Array.from(selectedSet).some(
      (existing) => existing.toLowerCase() === name.toLowerCase()
    );
    if (!alreadyExists) {
      selectedSet.add(name);
    }
  }

  // 2. Jika opsi belum mencapai 4 (misal baru ada 1 folder), lengkapi dari bank statis
  if (selectedSet.size < 4) {
    const candidatesFromStatic = shuffleArray(
      STATIC_FALLBACK_DISTRACTORS.filter(
        (name) => !Array.from(selectedSet).some((existing) => existing.toLowerCase() === name.toLowerCase())
      )
    );

    for (const name of candidatesFromStatic) {
      if (selectedSet.size >= 4) break;
      selectedSet.add(name);
    }
  }

  // Acak urutan 4 opsi (A, B, C, D)
  const shuffledOptions = shuffleArray(Array.from(selectedSet));
  const correctIndex = shuffledOptions.indexOf(correctClean);

  return {
    options: shuffledOptions,
    correctIndex,
  };
}

/**
 * Helper membersihkan nama untuk display
 */
function cleanText(str) {
  return str
    .replace(/\.[a-zA-Z0-9]+$/i, '')
    .trim();
}

/**
 * Helper mendapatkan durasi file audio secara presisi (detik)
 */
function getAudioDuration(filePath) {
  try {
    const res = spawnSync(FFMPEG_BIN, ['-i', filePath], { encoding: 'utf8' });
    const match = res.stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (match) {
      const hours = parseFloat(match[1]);
      const mins = parseFloat(match[2]);
      const secs = parseFloat(match[3]);
      return hours * 3600 + mins * 60 + secs;
    }
  } catch (e) {}
  return 0.7; // default fallback
}

/**
 * Helper format detik ke timecode ASS (H:MM:SS.cs)
 */
function formatAssTime(sec) {
  const totalCs = Math.round(sec * 100);
  const cs = String(totalCs % 100).padStart(2, '0');
  const totalSec = Math.floor(totalCs / 100);
  const s = String(totalSec % 60).padStart(2, '0');
  const m = String(Math.floor(totalSec / 60) % 60).padStart(2, '0');
  const h = String(Math.floor(totalSec / 3600));
  return `${h}:${m}:${s}.${cs}`;
}

/**
 * Generator Efek Suara WAV Kuis (3 Countdown Beep & 1 Correct Chime)
 * Menghasilkan file PCM WAV stereo 44.1kHz murni tanpa aset audio eksternal:
 * - t = 0 * tick : Beep 880Hz (Countdown 3)
 * - t = 1 * tick : Beep 880Hz (Countdown 2)
 * - t = 2 * tick : Beep 880Hz (Countdown 1)
 * - t = 3 * tick : Correct Chime (Rising Major Arpeggio C6-E6-G6 + harmoni lonceng)
 */
function generateQuizSoundWav(outputPath, tickDuration = 0.5, totalDuration = 2.0) {
  const sampleRate = 44100;
  const numSamples = Math.round(sampleRate * totalDuration);
  const numChannels = 2;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;

  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF Header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // Subchunk 1 (fmt)
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20);  // Format 1 = PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // 16 bits per sample

  // Subchunk 2 (data)
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Parameter Countdown Beep Identik (3, 2, 1)
  const beepTimes = [0.0 * tickDuration, 1.0 * tickDuration, 2.0 * tickDuration];
  const beepDuration = Math.min(0.11, tickDuration * 0.25);
  const beepFreq = 880; // 880Hz (A5) seragam untuk semua countdown
  const beepPeakAmp = 0.70; // Volume kencang dan bertenaga

  const chimeStart = 3.0 * tickDuration;
  const chimeDuration = Math.max(0.2, totalDuration - chimeStart);

  // Sintesis audio gelombang
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;

    // 1. Countdown Beep Identik di t = 0 * tick, 1 * tick, dan 2 * tick
    for (const t0 of beepTimes) {
      if (t >= t0 && t < t0 + beepDuration) {
        const dt = t - t0;
        let env = 1.0;
        if (dt < 0.005) {
          env = dt / 0.005; // 5ms attack halus bebas klik
        } else if (dt > 0.06) {
          env = Math.max(0, 1.0 - (dt - 0.06) / (beepDuration - 0.06)); // release lembut
        }
        sample += beepPeakAmp * Math.sin(2 * Math.PI * beepFreq * dt) * env;
      }
    }

    // 2. Correct Chime di t = 3 * tick (C6 -> E6 -> G6)
    if (t >= chimeStart) {
      const dt = t - chimeStart;
      const decayRate = Math.max(6, 4.0 / chimeDuration);

      // Note 1: C6 (1046.5 Hz)
      if (dt >= 0.0 && dt < chimeDuration * 0.8) {
        const env1 = Math.exp(-dt * decayRate);
        sample += 0.25 * Math.sin(2 * Math.PI * 1046.5 * dt) * env1;
      }

      // Note 2: E6 (1318.5 Hz)
      const note2Offset = Math.min(0.06, chimeDuration * 0.12);
      if (dt >= note2Offset && dt < chimeDuration * 0.9) {
        const dt2 = dt - note2Offset;
        const env2 = Math.exp(-dt2 * decayRate);
        sample += 0.28 * Math.sin(2 * Math.PI * 1318.5 * dt2) * env2;
      }

      // Note 3: G6 (1568 Hz) + harmoni lonceng cerah
      const note3Offset = Math.min(0.12, chimeDuration * 0.24);
      if (dt >= note3Offset && dt < chimeDuration) {
        const dt3 = dt - note3Offset;
        const env3 = Math.exp(-dt3 * (decayRate * 0.9));
        sample += 0.35 * Math.sin(2 * Math.PI * 1567.98 * dt3) * env3;
        sample += 0.15 * Math.sin(2 * Math.PI * 3135.96 * dt3) * env3;
      }
    }

    // Soft limiter pencegah distorsi
    if (sample > 0.95) sample = 0.95;
    if (sample < -0.95) sample = -0.95;

    const intSample = Math.floor(sample * 32767);
    const offset = 44 + i * 4;
    buffer.writeInt16LE(intSample, offset);
    buffer.writeInt16LE(intSample, offset + 2);
  }

  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

/**
 * Pembuat Subtitle ASS Dinamis untuk Overlay Kuis & Animasi Pilihan Ganda (Freeze Frame)
 * Terpusat secara matematis di tengah layar (Y ~ 960px) dan mendukung manual offset vertikal (offsetY)
 */
function generateQuizASS({
  question = 'Momen manakah itu?',
  options = [],
  correctIndex = 0,
  offsetY = 0,
  tickDuration = 0.5,
  totalDuration = 2.0,
}) {
  const cardW = 920;
  const leftX = (1080 - cardW) / 2; // 80

  // Koordinat Y Terpusat Secara Matematis (Midpoint ~960px pada kanvas 1080x1920)
  // Menjaga elemen kuis tidak terlalu bawah dan aman dari tombol UI TikTok/Reels di bagian bawah
  const headerY = 520 + offsetY;
  const questionY = 600 + offsetY;
  const countdownY = 735 + offsetY;
  const progressY = 815 + offsetY;
  const cardY = [875 + offsetY, 1010 + offsetY, 1145 + offsetY, 1280 + offsetY];

  // Path vektor rounded rectangle (920 x 110 dengan radius 20px)
  const roundRect = `m 0 20 b 0 9 9 0 20 0 l 900 0 b 911 0 920 9 920 20 l 920 90 b 920 101 911 110 900 110 l 20 110 b 9 110 0 101 0 90`;

  const str0 = formatAssTime(0);
  const str1 = formatAssTime(1 * tickDuration);
  const str2 = formatAssTime(2 * tickDuration);
  const str3 = formatAssTime(3 * tickDuration);
  const str4 = formatAssTime(totalDuration);

  const events = [];

  // 1. Fullscreen Dark Overlay (Gelapkan frame video asli sekitar 70%)
  events.push(`Dialogue: 0,${str0},${str4},Default,,0,0,0,,{\\pos(0,0)\\an7\\p1\\1a&H45&\\1c&H000000&\\3a&HFF&}m 0 0 l 1080 0 l 1080 1920 l 0 1920{\\p0}`);

  // 2. Question Header
  events.push(`Dialogue: 1,${str0},${str4},Default,,0,0,0,,{\\pos(540,${headerY})\\an5\\fs38\\b1\\c&H00D4FF&}TEBAK DOKSLI`);
  events.push(`Dialogue: 1,${str0},${str4},Default,,0,0,0,,{\\pos(540,${questionY})\\an5\\fs64\\b1\\c&HFFFFFF&\\bord4\\3c&H000000&}${question}`);

  // 3. Countdown Display (3, 2, 1, dan JAWABAN BENAR)
  events.push(`Dialogue: 2,${str0},${str1},Default,,0,0,0,,{\\pos(540,${countdownY})\\an5\\fs120\\b1\\c&H00E5FF&\\bord6\\3c&H000000&}3`);
  events.push(`Dialogue: 2,${str1},${str2},Default,,0,0,0,,{\\pos(540,${countdownY})\\an5\\fs120\\b1\\c&H00E5FF&\\bord6\\3c&H000000&}2`);
  events.push(`Dialogue: 2,${str2},${str3},Default,,0,0,0,,{\\pos(540,${countdownY})\\an5\\fs130\\b1\\c&H0099FF&\\bord6\\3c&H000000&}1`);
  events.push(`Dialogue: 2,${str3},${str4},Default,,0,0,0,,{\\pos(540,${countdownY})\\an5\\fs64\\b1\\c&H00E65C&\\bord4\\3c&H000000&}JAWABAN BENAR:`);

  // Progress Bar (Mengecil selama 3 tick countdown)
  events.push(`Dialogue: 1,${str0},${str1},Default,,0,0,0,,{\\pos(140,${progressY})\\an7\\p1\\1c&H00E65C&\\3a&HFF&}m 0 0 l 800 0 l 800 12 l 0 12{\\p0}`);
  events.push(`Dialogue: 1,${str1},${str2},Default,,0,0,0,,{\\pos(140,${progressY})\\an7\\p1\\1c&H00D4FF&\\3a&HFF&}m 0 0 l 530 0 l 530 12 l 0 12{\\p0}`);
  events.push(`Dialogue: 1,${str2},${str3},Default,,0,0,0,,{\\pos(140,${progressY})\\an7\\p1\\1c&H0077FF&\\3a&HFF&}m 0 0 l 260 0 l 260 12 l 0 12{\\p0}`);

  // 4. Opsi Pilihan Ganda (A, B, C, D)
  const letters = ['A', 'B', 'C', 'D'];
  for (let i = 0; i < 4; i++) {
    const yTop = cardY[i];
    const yMid = yTop + 55;
    const isCorrect = i === correctIndex;

    const text = options[i] || `Pilihan ${letters[i]}`;
    const fontSize = 42;
    const label = `${letters[i]}. ${text}`;

    // --- FASE 1: Detik 0.0 s/d 3 * tick (Semua Opsi Netral) ---
    events.push(`Dialogue: 1,${str0},${str3},Default,,0,0,0,,{\\pos(${leftX},${yTop})\\an7\\p1\\1a&H35&\\1c&H251D18&\\3a&H20&\\3c&H605040&\\bord3}${roundRect}{\\p0}`);
    events.push(`Dialogue: 2,${str0},${str3},Default,,0,0,0,,{\\pos(140,${yMid})\\an4\\fs${fontSize}\\b1\\c&HFFFFFF&\\bord2\\3c&H000000&}${label}`);

    // --- FASE 2: Detik 3 * tick s/d 4 * tick (Jawaban Terbuka Tanpa [V], Opsi Benar Hijau Emerald) ---
    if (isCorrect) {
      // HIJAU EMERALD (#22C55E -> BGR: &H30A020&)
      events.push(`Dialogue: 1,${str3},${str4},Default,,0,0,0,,{\\pos(${leftX},${yTop})\\an7\\p1\\1a&H00&\\1c&H30A020&\\3a&H00&\\3c&H60F040&\\bord5}${roundRect}{\\p0}`);
      events.push(`Dialogue: 2,${str3},${str4},Default,,0,0,0,,{\\pos(140,${yMid})\\an4\\fs${fontSize}\\b1\\c&HFFFFFF&\\bord3\\3c&H104010&}${label}`);
    } else {
      // Opsi salah dibuat redup
      events.push(`Dialogue: 1,${str3},${str4},Default,,0,0,0,,{\\pos(${leftX},${yTop})\\an7\\p1\\1a&H75&\\1c&H101010&\\3a&H85&\\3c&H303030&\\bord2}${roundRect}{\\p0}`);
      events.push(`Dialogue: 2,${str3},${str4},Default,,0,0,0,,{\\pos(140,${yMid})\\an4\\fs${fontSize}\\b0\\c&H888888&\\bord2\\3c&H000000&}${label}`);
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
 * Pembuat Subtitle ASS untuk Overlay Teks Nama File Full di 1/4 Atas Video Portrait
 * Tampil 1 baris ketat tanpa mekanisme line break (\n) agar tidak menutupi visual konten
 */
function generateFullVideoASS({ text, durationSeconds = 600, posY = 480 }) {
  // Bersihkan ekstensi berkas (.mp4 dll), hapus semua karakter enter/newline (\n, \r), dan normalisasi spasi
  const formattedText = text
    .replace(/\.[a-zA-Z0-9]+$/i, '')
    .replace(/\\n/gi, ' ')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const hh = String(Math.floor(durationSeconds / 3600)).padStart(1, '0');
  const mm = String(Math.floor((durationSeconds % 3600) / 60)).padStart(2, '0');
  const ss = String(Math.floor(durationSeconds % 60)).padStart(2, '0');
  const durStr = `${hh}:${mm}:${ss}.00`;

  return `[Script Info]
Title: Full Video Episode Overlay
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: MemeTitle, Arial, 42, &H00FFFFFF, &H000000FF, &H00000000, &H00000000, 1, 0, 0, 0, 100, 100, 0, 0, 1, 4, 2, 5, 40, 40, 40, 1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,${durStr},MemeTitle,,0,0,0,,{\\pos(540,${posY})\\an5\\bord5\\3c&H000000&\\q2}${formattedText}
`;
}

/**
 * Normalisasi video klip ke format prime 1080x1920 60FPS AAC 44.1kHz stereo
 * (Dilengkapi penanganan audio hening serta opsi sensor/blur gameplay untuk video cut kuis)
 */
function normalizeVideo({
  inputPath,
  outputPath,
  assSubtitlePath = null,
  fps = 60,
  censorGameplay = false,
  censorMode = 'pixelate',
  censorY = 1006,
  censorH = 720,
  censorPixelSize = 24,
  censorBlurRadius = 28,
}) {
  const baseFilter = 'scale=1080:1920:force_original_aspect_ratio=decrease:flags=lanczos,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1';
  let vf = baseFilter;

  if (censorGameplay) {
    let censorChain = '';
    if (censorMode === 'blur') {
      const radius = Math.max(5, parseInt(censorBlurRadius, 10) || 28);
      censorChain = `boxblur=${radius}:5`;
    } else {
      // Default: sensor piksel rendah (pixelate / mosaic)
      const px = Math.max(4, parseInt(censorPixelSize, 10) || 24);
      censorChain = `scale=1080/${px}:${censorH}/${px}:flags=neighbor,scale=1080:${censorH}:flags=neighbor`;
    }
    vf = `${baseFilter},split[main][gp];[gp]crop=1080:${censorH}:0:${censorY},${censorChain}[censored];[main][censored]overlay=0:${censorY}`;
  }

  if (assSubtitlePath) {
    const escapedAss = assSubtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:');
    vf += `,ass='${escapedAss}'`;
  }

  try {
    execSync(
      `"${FFMPEG_BIN}" -y -i "${inputPath}" -vf "${vf}" -af "apad,aresample=async=1:first_pts=0" -shortest -c:v libx264 -preset fast -crf 16 -profile:v high -level 4.2 -c:a aac -ar 44100 -ac 2 -r ${fps} -fps_mode cfr -video_track_timescale 60000 -movflags +faststart -pix_fmt yuv420p "${outputPath}"`,
      { stdio: 'pipe' }
    );
  } catch (err) {
    // Fallback jika video mentah tidak memiliki stream audio
    execSync(
      `"${FFMPEG_BIN}" -y -i "${inputPath}" -f lavfi -i "anullsrc=r=44100:cl=stereo" -vf "${vf}" -af "apad,aresample=async=1:first_pts=0" -shortest -c:v libx264 -preset fast -crf 16 -profile:v high -level 4.2 -c:a aac -ar 44100 -ac 2 -r ${fps} -fps_mode cfr -video_track_timescale 60000 -movflags +faststart -pix_fmt yuv420p "${outputPath}"`,
      { stdio: 'ignore' }
    );
  }
}

/**
 * Membaca durasi audio dalam detik menggunakan FFmpeg
 */
function getAudioDuration(filePath) {
  try {
    const probe = execSync(`"${FFMPEG_BIN}" -i "${filePath}" 2>&1`).toString();
    const match = probe.match(/Duration:\s*(\d+):(\d+):([\d\.]+)/);
    if (match) {
      return parseInt(match[1], 10) * 3600 + parseInt(match[2], 10) * 60 + parseFloat(match[3]);
    }
  } catch (e) {
    const out = (e.stdout || e.stderr || '').toString();
    const match = out.match(/Duration:\s*(\d+):(\d+):([\d\.]+)/);
    if (match) {
      return parseInt(match[1], 10) * 3600 + parseInt(match[2], 10) * 60 + parseFloat(match[3]);
    }
  }
  return 0.7;
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

  // Cek argumen CLI (misal: node compile_doksli.js --folder=1xyz --count=7 --offset-y=-50 --tick=0.5 --question="Momen apakah ini?")
  let clipCountTarget = parseInt(process.env.QUIZ_CLIP_COUNT || '5', 10);
  let quizOffsetY = parseInt(process.env.QUIZ_OFFSET_Y || '0', 10);
  let memeTextY = parseInt(process.env.MEME_TEXT_Y || '480', 10);
  let quizQuestion = process.env.QUIZ_QUESTION || 'Momen manakah itu?';
  let quizTickSeconds = parseFloat(process.env.QUIZ_TICK_SECONDS || '0.5');
  if (isNaN(quizTickSeconds) || quizTickSeconds <= 0.1) quizTickSeconds = 0.5;
  let customTransitionSfx = process.env.TRANSITION_SFX_PATH || null;
  let resultFolderId =
    process.env.GDRIVE_RESULT_FOLDER_ID ||
    process.env.GDRIVE_OUTPUT_FOLDER_ID ||
    null;

  let censorGameplay = process.env.CENSOR_GAMEPLAY !== 'false';
  let censorMode = (process.env.CENSOR_MODE || process.env.CENSOR_GAMEPLAY_MODE || 'pixelate').toLowerCase();
  let censorY = parseInt(process.env.CENSOR_GAMEPLAY_Y || '1006', 10);
  let censorH = parseInt(process.env.CENSOR_GAMEPLAY_H || '720', 10);
  let censorPixelSize = parseInt(process.env.CENSOR_PIXEL_SIZE || '24', 10);
  let censorBlurRadius = parseInt(process.env.CENSOR_BLUR_RADIUS || '28', 10);

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--folder=')) doksliFolderId = arg.split('=')[1];
    if (arg.startsWith('--count=')) clipCountTarget = parseInt(arg.split('=')[1], 10);
    if (arg.startsWith('--offset-y=')) quizOffsetY = parseInt(arg.split('=')[1], 10);
    if (arg.startsWith('--meme-y=')) memeTextY = parseInt(arg.split('=')[1], 10);
    if (arg.startsWith('--tick=')) quizTickSeconds = parseFloat(arg.split('=')[1]);
    if (arg.startsWith('--question=')) quizQuestion = arg.slice(arg.indexOf('=') + 1);
    if (arg.startsWith('--transition-sfx=')) customTransitionSfx = arg.slice(arg.indexOf('=') + 1);
    if (arg.startsWith('--result-folder=')) resultFolderId = arg.slice(arg.indexOf('=') + 1);
    if (arg.startsWith('--censor-mode=')) censorMode = arg.split('=')[1].toLowerCase();
    if (arg.startsWith('--censor-y=')) censorY = parseInt(arg.split('=')[1], 10);
    if (arg.startsWith('--censor-h=')) censorH = parseInt(arg.split('=')[1], 10);
    if (arg.startsWith('--censor-size=')) censorPixelSize = parseInt(arg.split('=')[1], 10);
    if (arg.startsWith('--censor-blur=')) censorBlurRadius = parseInt(arg.split('=')[1], 10);
    if (arg === '--no-censor') censorGameplay = false;
  }

  // Deteksi audio transisi (prioritas: custom CLI/env -> tiktok core.mp3 -> assets/)
  const candidateSfxPaths = [
    customTransitionSfx,
    path.resolve(__dirname, 'tiktok core.mp3'),
    path.resolve(__dirname, 'assets/transition.mp3'),
    path.resolve(__dirname, 'assets/transition.wav'),
  ].filter(Boolean);
  const transitionSfxPath = candidateSfxPaths.find((p) => fs.existsSync(p)) || null;

  if (!doksliFolderId) {
    console.error('❌ [ERROR] ID Folder Google Drive (GDRIVE_DOKSLI_FOLDER_ID) belum diatur di .env!');
    console.error('   Silakan isi GDRIVE_DOKSLI_FOLDER_ID=<id_folder_gdrive_anda> pada .env');
    process.exit(1);
  }

  // Batasi jumlah klip yang wajar (5 s/d 10)
  if (isNaN(clipCountTarget) || clipCountTarget < 1) clipCountTarget = 5;
  if (clipCountTarget > 15) clipCountTarget = 10;

  console.log(`\nKonfigurasi:`);
  console.log(` - ID Folder Google Drive : ${doksliFolderId}`);
  console.log(` - Target Momen Terpilih  : ${clipCountTarget} momen`);
  console.log(` - Format Output          : Vertikal 9:16 (1080x1920) 60 FPS`);
  console.log(` - Durasi Freeze Kuis     : ${(4 * quizTickSeconds).toFixed(2)}s (Tick: ${quizTickSeconds}s x 4 beat)`);
  console.log(` - Pertanyaan Kuis        : "${quizQuestion}"`);
  console.log(` - Audio Penutup Momen    : ${transitionSfxPath ? path.basename(transitionSfxPath) : 'Tidak aktif (file tidak ditemukan)'}`);
  console.log(` - Auto-Upload Hasil      : ${resultFolderId ? 'Aktif (Folder: ' + resultFolderId + ', auto-hapus lokal)' : 'Nonaktif (tersimpan di lokal)'}`);
  console.log(` - Posisi Freeze Kuis     : Terpusat matematis (Y ~ 960px, Offset: ${quizOffsetY}px)`);
  console.log(` - Posisi Teks Video Full : 1/4 tinggi kanvas (Y = ${memeTextY}px)\n`);

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
    'https://www.googleapis.com/auth/drive',
  ]);
  const drive = google.drive({ version: 'v3', auth: driveAuth });

  // 3. Ambil daftar seluruh folder Game di Google Drive
  console.log('[TAHAP 1/4] Mengambil daftar folder game di Google Drive...');
  const res = await drive.files.list({
    q: `'${doksliFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    spaces: 'drive',
    pageSize: 500,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const allGameFolders = res.data.files || [];
  if (allGameFolders.length === 0) {
    console.error('❌ [ERROR] Tidak ada folder game yang ditemukan di folder Google Drive tersebut.');
    console.error('   Konsep berlapis: Folder Doksli berisi folder Game (nama game = jawaban kuis).');
    console.error('   Di dalam folder Game terdapat subfolder episode ("eps x") yang berisi cut.mp4 dan video full.');
    process.exit(1);
  }

  console.log(`✅ Berhasil menemukan ${allGameFolders.length} folder game di Google Drive.`);
  if (allGameFolders.length < 4) {
    console.log(`ℹ️ [INFO] Folder Google Drive saat ini memiliki ${allGameFolders.length} folder game (kurang dari 4).`);
    console.log(`   Opsi pengecoh kuis lainnya otomatis dilengkapi secara unik dari bank judul game statis.`);
  }

  // Pool seluruh nama game untuk distractor pilihan ganda kuis
  const allGameNamesPool = allGameFolders.map((f) => f.name.trim());

  // 4. Acak dan validasi isi folder game (mencari subfolder "eps x" yang berisi cut.mp4 & video full, anti-duplikat game)
  console.log('\n[TAHAP 2/4] Mengacak dan memvalidasi isi folder game (mencari subfolder eps, cut.mp4 & video full, anti-duplikat game)...');
  const shuffledGameFolders = shuffleArray(allGameFolders);
  const validMoments = [];
  const selectedGameNames = new Set();

  for (const gameFolder of shuffledGameFolders) {
    if (validMoments.length >= clipCountTarget) break;

    const gameName = gameFolder.name.trim();

    // Aturan Uniqueness Game: Klip yang dipilih untuk kompilasi tidak boleh berasal dari game yang sama (case-insensitive)
    const isDuplicateGame = Array.from(selectedGameNames).some(
      (existing) => existing.toLowerCase() === gameName.toLowerCase()
    );
    if (isDuplicateGame) {
      console.log(` ⚠️ Game "${gameName}" dilewati (game ini sudah terpilih di kompilasi ini).`);
      continue;
    }

    // Ambil daftar item di dalam folder game (mencari subfolder episode "eps x" atau fallback berkas langsung)
    const childrenRes = await drive.files.list({
      q: `'${gameFolder.id}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType)',
      spaces: 'drive',
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const children = childrenRes.data.files || [];
    const epsFolders = children.filter((c) => c.mimeType === 'application/vnd.google-apps.folder');

    let chosenEps = null;

    if (epsFolders.length > 0) {
      // Acak urutan episode agar pilihan klip bervariasi jika game memiliki banyak episode
      const shuffledEps = shuffleArray(epsFolders);

      for (const epsFolder of shuffledEps) {
        const vidRes = await drive.files.list({
          q: `'${epsFolder.id}' in parents and (mimeType contains 'video/' or name contains '.mp4' or name contains '.mkv' or name contains '.mov' or name contains '.webm') and trashed = false`,
          fields: 'files(id, name, size, mimeType)',
          spaces: 'drive',
          pageSize: 20,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });

        const vidFiles = vidRes.data.files || [];
        if (vidFiles.length === 2) {
          const cutFile = vidFiles.find((f) => {
            const base = f.name.toLowerCase().replace(/\.[^.]+$/, '');
            return base === 'cut';
          });
          const fullFile = vidFiles.find((f) => f.id !== cutFile?.id);
          if (cutFile && fullFile) {
            chosenEps = {
              epsName: epsFolder.name.trim(),
              cutFile,
              fullFile,
            };
            break;
          }
        }
      }
    } else {
      // Fallback kompatibilitas: jika video diletakkan langsung di dalam folder game
      const vidFiles = children.filter(
        (f) =>
          (f.mimeType && f.mimeType.startsWith('video/')) ||
          /\.(mp4|mkv|mov|webm)$/i.test(f.name)
      );
      if (vidFiles.length === 2) {
        const cutFile = vidFiles.find((f) => {
          const base = f.name.toLowerCase().replace(/\.[^.]+$/, '');
          return base === 'cut';
        });
        const fullFile = vidFiles.find((f) => f.id !== cutFile?.id);
        if (cutFile && fullFile) {
          chosenEps = {
            epsName: '',
            cutFile,
            fullFile,
          };
        }
      }
    }

    if (!chosenEps) {
      console.log(` ⚠️ Game "${gameName}" dilewati (tidak ada subfolder episode yang memiliki cut.mp4 dan video full).`);
      continue;
    }

    // Siapkan pilihan ganda kuis berbasis Game (100% unik tanpa duplikat via Set & fallback statis)
    const { options, correctIndex } = createUniqueQuizOptions(gameName, allGameNamesPool);

    // Format display text untuk overlay full video: "nama folder eps x + nama file full vid", 1 baris ketat tanpa \n
    const cleanEps = chosenEps.epsName ? cleanText(chosenEps.epsName) : '';
    const cleanFull = cleanText(chosenEps.fullFile.name);
    const fullVideoDisplayText = cleanEps ? `${cleanEps} ${cleanFull}`.trim() : cleanFull;

    validMoments.push({
      folderId: gameFolder.id,
      momentName: gameName,
      gameName,
      epsName: chosenEps.epsName,
      cutFile: chosenEps.cutFile,
      fullFile: chosenEps.fullFile,
      fullVideoDisplayText,
      options,
      correctIndex,
    });
    selectedGameNames.add(gameName);

    const letter = ['A', 'B', 'C', 'D'][correctIndex];
    console.log(` ✅ Terpilih #${validMoments.length}: Game "${gameName}"`);
    if (chosenEps.epsName) {
      console.log(`    - Episode    : ${chosenEps.epsName}`);
    }
    console.log(`    - Cut Video  : ${chosenEps.cutFile.name}`);
    console.log(`    - Full Video : ${chosenEps.fullFile.name}`);
    console.log(`    - Overlay    : "${fullVideoDisplayText}" (1 baris)`);
    console.log(`    - Kunci Kuis : [${letter}]`);
  }

  if (validMoments.length === 0) {
    console.error('❌ Tidak ada folder game/momen yang memenuhi syarat (harus berisi subfolder episode dengan cut.mp4 & video full).');
    process.exit(1);
  }

  console.log(`\n🎉 Berhasil mengumpulkan ${validMoments.length} game unik untuk kompilasi!`);
  if (validMoments.length < clipCountTarget) {
    console.log(`ℹ️ [INFO] Target diminta ${clipCountTarget} klip, namun game unik yang valid dan tersedia hanya ${validMoments.length} game.`);
  }

  // 5. Download dan proses pengeditan tiap momen
  console.log('\n[TAHAP 3/4] Mengunduh dan merangkai alur klip (Cut -> Freeze Kuis -> Full Meme)...');

  const workDir = path.resolve(__dirname, 'temp_doksli_work');
  if (fs.existsSync(workDir)) {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
  fs.mkdirSync(workDir, { recursive: true });

  // Siapkan klip transisi layar hitam jika audio transisi tersedia
  let transitionClipPath = null;
  if (transitionSfxPath) {
    console.log(`\n🎞️ [TRANSISI] Menyiapkan klip transisi layar hitam dengan audio "${path.basename(transitionSfxPath)}"...`);
    transitionClipPath = path.join(workDir, 'transition_clip.mp4');
    try {
      const sfxDur = getAudioDuration(transitionSfxPath);
      const transFrames = Math.max(1, Math.round(sfxDur * 60));
      const transDurSec = (transFrames / 60).toFixed(4);
      execSync(
        `"${FFMPEG_BIN}" -y -f lavfi -i "color=c=black:s=1080x1920:r=60" -i "${transitionSfxPath}" -af "apad,aresample=async=1:first_pts=0" -t ${transDurSec} -vframes ${transFrames} -shortest -c:v libx264 -preset fast -crf 16 -profile:v high -level 4.2 -c:a aac -ar 44100 -ac 2 -r 60 -fps_mode cfr -video_track_timescale 60000 -movflags +faststart -pix_fmt yuv420p "${transitionClipPath}"`,
        { stdio: 'ignore' }
      );
      console.log(`   ✅ Klip transisi layar hitam siap disisipkan antar momen (${transFrames} frame / ${transDurSec}s).`);
    } catch (e) {
      console.warn(`   ⚠️ Gagal membuat klip transisi layar hitam: ${e.message}`);
      transitionClipPath = null;
    }
  }

  const allCompilationClips = [];

  for (let i = 0; i < validMoments.length; i++) {
    const moment = validMoments[i];
    const momentIndex = i + 1;
    console.log(`\n🎬 [MEMPROSES MOMEN ${momentIndex}/${validMoments.length}]: "${moment.momentName}"...`);

    // --- BAGIAN 1: VIDEO POTONGAN (cut.mp4) ---
    console.log(`   1. Mengunduh dan menormalisasi cut.mp4${censorGameplay ? ` (Sensor Gameplay: ${censorMode})` : ''}...`);
    const rawCutPath = path.join(workDir, `raw_cut_${momentIndex}.mp4`);
    const cutStream = await drive.files.get(
      { fileId: moment.cutFile.id, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream' }
    );
    await pipeline(cutStream.data, fs.createWriteStream(rawCutPath));

    const normCutPath = path.join(workDir, `norm_cut_${momentIndex}.mp4`);
    normalizeVideo({
      inputPath: rawCutPath,
      outputPath: normCutPath,
      censorGameplay,
      censorMode,
      censorY,
      censorH,
      censorPixelSize,
      censorBlurRadius,
    });

    // --- BAGIAN 2: FREEZE FRAME KUIS (3 COUNTDOWN + 1 REVEAL) ---
    const totalQuizFrames = Math.max(1, Math.round(4 * quizTickSeconds * 60));
    const totalQuizSec = (totalQuizFrames / 60).toFixed(4);

    console.log(`   2. Mengekstrak frame terakhir & membuat freeze kuis (${totalQuizSec}s / ${totalQuizFrames} frame, tick: ${quizTickSeconds}s)...`);
    const freezeFramePng = path.join(workDir, `freeze_${momentIndex}.png`);
    execSync(`"${FFMPEG_BIN}" -y -sseof -0.1 -i "${normCutPath}" -update 1 -q:v 1 "${freezeFramePng}"`, { stdio: 'ignore' });

    const quizAssPath = path.join(workDir, `quiz_${momentIndex}.ass`);
    fs.writeFileSync(
      quizAssPath,
      generateQuizASS({
        question: quizQuestion,
        options: moment.options,
        correctIndex: moment.correctIndex,
        offsetY: quizOffsetY,
        tickDuration: quizTickSeconds,
        totalDuration: parseFloat(totalQuizSec),
      }),
      'utf8'
    );

    // Buat file audio efek suara (3 countdown beep + 1 reveal chime)
    const sfxWavPath = path.join(workDir, `sfx_${momentIndex}.wav`);
    generateQuizSoundWav(sfxWavPath, quizTickSeconds, parseFloat(totalQuizSec));

    const freezeVideoPath = path.join(workDir, `freeze_vid_${momentIndex}.mp4`);
    const escapedQuizAss = quizAssPath.replace(/\\/g, '/').replace(/:/g, '\\:');
    execSync(
      `"${FFMPEG_BIN}" -y -framerate 60 -loop 1 -i "${freezeFramePng}" -i "${sfxWavPath}" -vf "scale=1080:1920:force_original_aspect_ratio=decrease:flags=lanczos,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,ass='${escapedQuizAss}'" -af "apad,aresample=async=1:first_pts=0" -t ${totalQuizSec} -vframes ${totalQuizFrames} -shortest -c:v libx264 -preset fast -crf 16 -profile:v high -level 4.2 -c:a aac -ar 44100 -ac 2 -r 60 -fps_mode cfr -video_track_timescale 60000 -movflags +faststart -pix_fmt yuv420p "${freezeVideoPath}"`,
      { stdio: 'ignore' }
    );

    // --- BAGIAN 3: VIDEO FULL DENGAN OVERLAY TEKS DI 1/4 ATAS KANVAS ---
    console.log(`   3. Mengunduh & merender video full ("${moment.fullVideoDisplayText}")...`);
    const rawFullPath = path.join(workDir, `raw_full_${momentIndex}.mp4`);
    const fullStream = await drive.files.get(
      { fileId: moment.fullFile.id, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream' }
    );
    await pipeline(fullStream.data, fs.createWriteStream(rawFullPath));

    const memeAssPath = path.join(workDir, `meme_${momentIndex}.ass`);
    fs.writeFileSync(
      memeAssPath,
      generateFullVideoASS({
        text: moment.fullVideoDisplayText,
        durationSeconds: 600,
        posY: memeTextY,
      }),
      'utf8'
    );

    const normFullPath = path.join(workDir, `norm_full_${momentIndex}.mp4`);
    normalizeVideo({
      inputPath: rawFullPath,
      outputPath: normFullPath,
      assSubtitlePath: memeAssPath,
    });

    // Masukkan ketiga bagian alur momen langsung ke list kompilasi
    allCompilationClips.push(normCutPath, freezeVideoPath, normFullPath);

    // Sisipkan klip layar hitam dan sound TikTok Core setelah setiap momen (termasuk momen terakhir / ke-X)
    if (transitionClipPath) {
      allCompilationClips.push(transitionClipPath);
    }

    console.log(`   ✅ Seluruh bagian momen #${momentIndex} siap dirangkai.`);
  }

  // 6. Gabungkan seluruh segmen klip menjadi 1 video kompilasi utuh dalam 1 single-pass concat
  // Metode single-pass langsung dari video hasil render menjamin 100% 60.000 FPS CFR murni tanpa gap PTS/audio priming
  console.log('\n[TAHAP 4/4] Menggabungkan seluruh rangkaian klip menjadi 1 video kompilasi utuh (Single-Pass 60 FPS)...');

  const outputDir = path.resolve(__dirname, 'output_kompilasi');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const finalOutputPath = path.join(outputDir, `kompilasi_tebak_doksli_${timestamp}.mp4`);

  const mainConcatList = path.join(workDir, 'final_concat_list.txt');
  fs.writeFileSync(
    mainConcatList,
    allCompilationClips.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n') + '\n',
    'utf8'
  );

  execSync(`"${FFMPEG_BIN}" -y -f concat -safe 0 -i "${mainConcatList}" -c copy -video_track_timescale 60000 -movflags +faststart "${finalOutputPath}"`, { stdio: 'ignore' });

  // Bersihkan temporary work directory
  console.log('\n[BERSIH-BERSIH] Menghapus cache temporary video mentah...');
  try {
    fs.rmSync(workDir, { recursive: true, force: true });
  } catch (e) {}

  console.log('\n================================================================');
  console.log('🎉 KOMPILASI TEBAK-TEBAKAN DOKSLI BERHASIL DIBUAT!');
  console.log(`📁 Lokasi Video Final : ${finalOutputPath}`);
  console.log('================================================================\n');

  // 7. Auto-Upload ke Google Drive (jika GDRIVE_RESULT_FOLDER_ID diatur)
  if (resultFolderId) {
    console.log('[TAHAP 5/5] Mengunggah video kompilasi ke Google Drive...');
    console.log(` - Target Folder ID : ${resultFolderId}`);
    try {
      const uploadFileName = path.basename(finalOutputPath);
      const fileMetadata = {
        name: uploadFileName,
        parents: [resultFolderId],
      };
      const media = {
        mimeType: 'video/mp4',
        body: fs.createReadStream(finalOutputPath),
      };

      const uploadRes = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink',
        supportsAllDrives: true,
      });

      console.log(`✅ Berhasil mengunggah video ke Google Drive!`);
      console.log(` - File ID     : ${uploadRes.data.id}`);
      if (uploadRes.data.webViewLink) {
        console.log(` - Link GDrive : ${uploadRes.data.webViewLink}`);
      }

      // Hapus file video lokal setelah sukses upload
      console.log(`\n[CLEANUP] Menghapus video lokal setelah sukses diunggah ke Google Drive...`);
      fs.unlinkSync(finalOutputPath);
      console.log(`✅ File video lokal berhasil dihapus (${uploadFileName}).`);
    } catch (uploadErr) {
      console.error(`❌ Gagal mengunggah video ke Google Drive:`, uploadErr.message);
      console.log(`ℹ️ File video lokal tetap aman tersimpan di: ${finalOutputPath}`);
    }
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

module.exports = {
  createUniqueQuizOptions,
  generateQuizASS,
  generateFullVideoASS,
  generateQuizSoundWav,
  getAudioDuration,
  STATIC_FALLBACK_DISTRACTORS,
};
