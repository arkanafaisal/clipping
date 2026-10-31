const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { google } = require('googleapis');

// Path binary FFmpeg (menggunakan ffmpeg-static jika tersedia)
let FFMPEG_BIN = 'ffmpeg';
try {
  FFMPEG_BIN = require('ffmpeg-static') || 'ffmpeg';
} catch (e) {
  FFMPEG_BIN = process.env.FFMPEG_PATH || 'ffmpeg';
}

// Muat variabel lingkungan dari .env
const localEnvPath = path.resolve(__dirname, '../.env');
const rootEnvPath = path.resolve(__dirname, '../../.env');
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
 * Membaca dan mem-parsing seluruh konfigurasi lingkungan (.env) & argumen CLI
 */
function getConfig() {
  let doksliFolderId =
    process.env.GDRIVE_DOKSLI_FOLDER_ID ||
    process.env.GDRIVE_UNUSED_FOLDER_ID ||
    process.env.GDRIVE_ROOT_FOLDER_ID;

  let clipCountTarget = parseInt(process.env.QUIZ_CLIP_COUNT || '5', 10);
  let gameUniqueWindow = parseInt(
    process.env.GAME_UNIQUE_WINDOW ||
    process.env.GAME_UNIQUENESS ||
    process.env.QUIZ_GAME_UNIQUENESS ||
    '5',
    10
  );
  if (isNaN(gameUniqueWindow) || gameUniqueWindow < 1) gameUniqueWindow = 1;

  let quizOffsetY = parseInt(process.env.QUIZ_OFFSET_Y || '0', 10);
  let memeTextY = parseInt(process.env.MEME_TEXT_Y || '480', 10);
  let quizQuestion = process.env.QUIZ_QUESTION || 'Momen manakah itu?';
  let quizTickSeconds = parseFloat(process.env.QUIZ_TICK_SECONDS || '0.5');
  if (isNaN(quizTickSeconds) || quizTickSeconds <= 0.1) quizTickSeconds = 0.5;

  let quizTickSfx = process.env.QUIZ_TICK_SFX_PATH || null;
  let quizCorrectSfx = process.env.QUIZ_CORRECT_SFX_PATH || null;

  // Auto-deteksi berkas audio SFX kustom jika diletakkan di folder proyek
  const possibleTickFiles = [
    'quiz_tick.mp3',
    'quiz_tick.wav',
    'tick.mp3',
    'tick.wav',
    'beep.mp3',
    'beep.wav',
  ];
  const possibleCorrectFiles = [
    'quiz_correct.mp3',
    'quiz_correct.wav',
    'correct.mp3',
    'correct.wav',
    'chime.mp3',
    'chime.wav',
  ];

  if (!quizTickSfx) {
    for (const name of possibleTickFiles) {
      const p1 = path.resolve(__dirname, '../', name);
      const p2 = path.resolve(__dirname, '../../', name);
      if (fs.existsSync(p1)) {
        quizTickSfx = p1;
        break;
      } else if (fs.existsSync(p2)) {
        quizTickSfx = p2;
        break;
      }
    }
  }

  if (!quizCorrectSfx) {
    for (const name of possibleCorrectFiles) {
      const p1 = path.resolve(__dirname, '../', name);
      const p2 = path.resolve(__dirname, '../../', name);
      if (fs.existsSync(p1)) {
        quizCorrectSfx = p1;
        break;
      } else if (fs.existsSync(p2)) {
        quizCorrectSfx = p2;
        break;
      }
    }
  }

  let customTransitionSfx = process.env.TRANSITION_SFX_PATH || null;
  let transitionMode = (process.env.TRANSITION_MODE || '').trim().toLowerCase();
  if (!['off', 'number', 'meme'].includes(transitionMode)) {
    if (process.env.TRANSITION_SHOW_COUNTER === 'false' || process.env.TRANSITION_FONT_SIZE === '0') {
      transitionMode = 'off';
    } else {
      transitionMode = 'number';
    }
  }

  let showTransitionCounter = transitionMode === 'number';
  let transitionFontSize = parseInt(process.env.TRANSITION_FONT_SIZE || '72', 10);
  if (transitionFontSize === 0) {
    transitionMode = 'off';
    showTransitionCounter = false;
  }
  if (isNaN(transitionFontSize) || transitionFontSize <= 0) {
    transitionFontSize = 72;
  }

  const speedEnvRaw = (process.env.FULL_VIDEO_SPEED || '1.0').trim().toLowerCase();
  let isFullVideoAutoSpeed = process.env.FULL_VIDEO_AUTO_SPEED === 'true' || speedEnvRaw === 'auto';
  let fullVideoSpeed = 1.0;
  if (!isFullVideoAutoSpeed) {
    fullVideoSpeed = parseFloat(speedEnvRaw);
    if (isNaN(fullVideoSpeed) || fullVideoSpeed < 1.0) fullVideoSpeed = 1.0;
  }
  let fullVideoMaxDuration = parseFloat(process.env.FULL_VIDEO_MAX_DURATION || '5.0');
  if (isNaN(fullVideoMaxDuration) || fullVideoMaxDuration <= 0.5) fullVideoMaxDuration = 5.0;

  let rouletteSpinDuration = parseFloat(process.env.ROULETTE_SPIN_DURATION || '4.4');
  if (isNaN(rouletteSpinDuration) || rouletteSpinDuration <= 0.5) rouletteSpinDuration = 4.4;

  let rouletteLockDuration = parseFloat(process.env.ROULETTE_LOCK_DURATION || process.env.ROULETTE_STOP_DURATION || '1.0');
  if (isNaN(rouletteLockDuration) || rouletteLockDuration < 0.1) rouletteLockDuration = 1.0;

  let rouletteFadeDuration = parseFloat(process.env.ROULETTE_FADE_DURATION || '0.5');
  if (isNaN(rouletteFadeDuration) || rouletteFadeDuration < 0.05) rouletteFadeDuration = 0.5;

  let rouletteFreezeDuration = parseFloat(process.env.ROULETTE_FREEZE_DURATION || process.env.ROULETTE_PREPLAY_FREEZE || '0.5');
  if (isNaN(rouletteFreezeDuration) || rouletteFreezeDuration < 0.0) rouletteFreezeDuration = 0.5;

  let rouletteBoardFreeze = parseFloat(process.env.ROULETTE_BOARD_FREEZE || process.env.ROULETTE_BOARD_PAUSE || '0.5');
  if (isNaN(rouletteBoardFreeze) || rouletteBoardFreeze < 0.0) rouletteBoardFreeze = 0.5;

  let rouletteItems = parseInt(process.env.ROULETTE_ITEMS || process.env.ROULETTE_ITEM_COUNT || '5', 10);
  if (isNaN(rouletteItems) || rouletteItems < 2) rouletteItems = 5;

  let rouletteMaxSpeed = parseFloat(process.env.ROULETTE_MAX_SPEED || process.env.ROULETTE_SPEED || '3600');
  if (isNaN(rouletteMaxSpeed) || rouletteMaxSpeed < 500) rouletteMaxSpeed = 3600;

  let rouletteDimOpacity = parseFloat(process.env.ROULETTE_DIM_OPACITY || process.env.ROULETTE_SPOTLIGHT_OPACITY || '0.65');
  if (isNaN(rouletteDimOpacity) || rouletteDimOpacity < 0.1 || rouletteDimOpacity > 1.0) rouletteDimOpacity = 0.65;

  let resultFolderId =
    process.env.GDRIVE_RESULT_FOLDER_ID ||
    process.env.GDRIVE_OUTPUT_FOLDER_ID ||
    null;

  let skipPrefix = process.env.SKIP_PREFIX || '!';

  let singleGameMode = process.env.SINGLE_GAME_MODE === 'true';
  let singleGameName = (process.env.SINGLE_GAME_NAME || '').trim() || null;
  let singleGameId = (process.env.SINGLE_GAME_ID || process.env.SINGLE_GAME_FOLDER_ID || '').trim() || null;
  if (singleGameName || singleGameId) {
    singleGameMode = true;
  }

  let censorGameplay = process.env.CENSOR_GAMEPLAY !== 'false';
  let censorMode = (process.env.CENSOR_MODE || process.env.CENSOR_GAMEPLAY_MODE || 'pixelate').toLowerCase();
  let censorY = parseInt(process.env.CENSOR_GAMEPLAY_Y || '1006', 10);
  let censorH = parseInt(process.env.CENSOR_GAMEPLAY_H || '720', 10);
  let censorPixelSize = parseInt(process.env.CENSOR_PIXEL_SIZE || '45', 10);
  let censorBlurRadius = parseInt(process.env.CENSOR_BLUR_RADIUS || '28', 10);

  // Parsing CLI arguments
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--folder=')) doksliFolderId = arg.split('=')[1];
    if (arg.startsWith('--count=')) clipCountTarget = parseInt(arg.split('=')[1], 10);
    if (arg.startsWith('--offset-y=')) quizOffsetY = parseInt(arg.split('=')[1], 10);
    if (arg.startsWith('--meme-y=')) memeTextY = parseInt(arg.split('=')[1], 10);
    if (arg.startsWith('--tick=')) quizTickSeconds = parseFloat(arg.split('=')[1]);
    if (arg.startsWith('--tick-sfx=') || arg.startsWith('--quiz-tick-sfx=')) {
      quizTickSfx = arg.slice(arg.indexOf('=') + 1).trim();
    }
    if (arg.startsWith('--correct-sfx=') || arg.startsWith('--quiz-correct-sfx=')) {
      quizCorrectSfx = arg.slice(arg.indexOf('=') + 1).trim();
    }
    if (arg.startsWith('--question=')) quizQuestion = arg.slice(arg.indexOf('=') + 1);
    if (arg.startsWith('--transition-sfx=')) customTransitionSfx = arg.slice(arg.indexOf('=') + 1);
    if (arg.startsWith('--transition-mode=') || arg.startsWith('--trans-mode=')) {
      const mode = arg.split('=')[1].trim().toLowerCase();
      if (['off', 'number', 'meme'].includes(mode)) {
        transitionMode = mode;
        showTransitionCounter = mode === 'number';
      }
    }
    if (arg === '--meme' || arg === '--transition-meme') {
      transitionMode = 'meme';
      showTransitionCounter = false;
    }
    if (arg === '--no-transition-counter' || arg === '--no-counter' || arg === '--transition-counter=false' || arg === '--trans-off') {
      transitionMode = 'off';
      showTransitionCounter = false;
    }
    if (arg === '--transition-counter=true' || arg === '--transition-counter' || arg === '--trans-number') {
      transitionMode = 'number';
      showTransitionCounter = true;
    }
    if (arg.startsWith('--transition-fs=') || arg.startsWith('--transition-fontsize=')) {
      const fsVal = parseInt(arg.split('=')[1], 10);
      if (fsVal === 0) {
        transitionMode = 'off';
        showTransitionCounter = false;
      } else if (!isNaN(fsVal) && fsVal > 0) {
        transitionFontSize = fsVal;
      }
    }
    if (arg === '--auto-speed' || arg === '--speed=auto' || arg === '--full-speed=auto') {
      isFullVideoAutoSpeed = true;
    } else if (arg.startsWith('--speed=') || arg.startsWith('--full-speed=') || arg.startsWith('--speed-full=')) {
      const val = arg.split('=')[1].toLowerCase();
      if (val === 'auto') {
        isFullVideoAutoSpeed = true;
      } else {
        const spd = parseFloat(val);
        if (!isNaN(spd)) {
          fullVideoSpeed = Math.max(1.0, spd);
          isFullVideoAutoSpeed = false;
        }
      }
    }
    if (arg.startsWith('--max-duration=') || arg.startsWith('--full-max-dur=')) {
      const dur = parseFloat(arg.split('=')[1]);
      if (!isNaN(dur) && dur > 0.5) fullVideoMaxDuration = dur;
    }
    if (arg.startsWith('--spin-duration=') || arg.startsWith('--roulette-duration=')) {
      const dur = parseFloat(arg.split('=')[1]);
      if (!isNaN(dur) && dur > 0.5) rouletteSpinDuration = dur;
    }
    if (arg.startsWith('--lock-duration=') || arg.startsWith('--stop-duration=') || arg.startsWith('--roulette-lock=')) {
      const dur = parseFloat(arg.split('=')[1]);
      if (!isNaN(dur) && dur >= 0.1) rouletteLockDuration = dur;
    }
    if (arg.startsWith('--fade-duration=') || arg.startsWith('--roulette-fade=')) {
      const dur = parseFloat(arg.split('=')[1]);
      if (!isNaN(dur) && dur >= 0.05) rouletteFadeDuration = dur;
    }
    if (arg.startsWith('--freeze-duration=') || arg.startsWith('--preplay-freeze=') || arg.startsWith('--roulette-freeze=')) {
      const dur = parseFloat(arg.split('=')[1]);
      if (!isNaN(dur) && dur >= 0.0) rouletteFreezeDuration = dur;
    }
    if (arg.startsWith('--board-freeze=') || arg.startsWith('--roulette-board-freeze=') || arg.startsWith('--board-pause=')) {
      const dur = parseFloat(arg.split('=')[1]);
      if (!isNaN(dur) && dur >= 0.0) rouletteBoardFreeze = dur;
    }
    if (arg.startsWith('--items=') || arg.startsWith('--roulette-items=')) {
      const itm = parseInt(arg.split('=')[1], 10);
      if (!isNaN(itm) && itm >= 2) rouletteItems = itm;
    }
    if (arg.startsWith('--max-speed=') || arg.startsWith('--roulette-speed=') || arg.startsWith('--speed-max=')) {
      const spd = parseFloat(arg.split('=')[1]);
      if (!isNaN(spd) && spd >= 500) rouletteMaxSpeed = spd;
    }
    if (arg.startsWith('--dim-opacity=') || arg.startsWith('--roulette-dim=') || arg.startsWith('--spotlight-dim=')) {
      const dim = parseFloat(arg.split('=')[1]);
      if (!isNaN(dim) && dim >= 0.05 && dim <= 1.0) rouletteDimOpacity = dim;
    }
    if (arg.startsWith('--unique-window=') || arg.startsWith('--game-uniqueness=') || arg.startsWith('--uniqueness=') || arg.startsWith('--window=')) {
      const val = parseInt(arg.split('=')[1], 10);
      if (!isNaN(val) && val >= 1) gameUniqueWindow = val;
    }
    if (arg === '--single-game' || arg === '--single') {
      singleGameMode = true;
    } else if (arg.startsWith('--single-game=')) {
      singleGameMode = true;
      singleGameName = arg.slice(arg.indexOf('=') + 1).trim();
    } else if (arg.startsWith('--game=') || arg.startsWith('--game-name=')) {
      singleGameMode = true;
      singleGameName = arg.slice(arg.indexOf('=') + 1).trim();
    } else if (arg.startsWith('--game-id=') || arg.startsWith('--single-game-id=')) {
      singleGameMode = true;
      singleGameId = arg.slice(arg.indexOf('=') + 1).trim();
    }
    if (arg.startsWith('--result-folder=')) resultFolderId = arg.slice(arg.indexOf('=') + 1);
    if (arg.startsWith('--skip-prefix=')) skipPrefix = arg.slice(arg.indexOf('=') + 1);
    if (arg.startsWith('--censor-mode=')) censorMode = arg.split('=')[1].toLowerCase();
    if (arg.startsWith('--censor-y=')) censorY = parseInt(arg.split('=')[1], 10);
    if (arg.startsWith('--censor-h=')) censorH = parseInt(arg.split('=')[1], 10);
    if (arg.startsWith('--censor-size=')) censorPixelSize = parseInt(arg.split('=')[1], 10);
    if (arg.startsWith('--censor-blur=')) censorBlurRadius = parseInt(arg.split('=')[1], 10);
    if (arg === '--no-censor') censorGameplay = false;
  }

  // Batasi jumlah klip target yang wajar
  if (isNaN(clipCountTarget) || clipCountTarget < 1) clipCountTarget = 5;
  if (clipCountTarget > 15) clipCountTarget = 10;

  // Cari kredensial Google
  const gdriveToken =
    process.env.GDRIVE_TOKEN ||
    process.env.GDRIVE_OAUTH_TOKEN ||
    (fs.existsSync(path.resolve(__dirname, '../token.json')) ? path.resolve(__dirname, '../token.json') : null) ||
    (fs.existsSync(path.resolve(__dirname, '../../token.json')) ? path.resolve(__dirname, '../../token.json') : null);

  return {
    doksliFolderId,
    clipCountTarget,
    gameUniqueWindow,
    singleGameMode,
    singleGameName,
    singleGameId,
    quizOffsetY,
    memeTextY,
    quizQuestion,
    quizTickSeconds,
    quizTickSfx,
    quizCorrectSfx,
    customTransitionSfx,
    transitionMode,
    showTransitionCounter,
    transitionFontSize,
    isFullVideoAutoSpeed,
    fullVideoSpeed,
    fullVideoMaxDuration,
    rouletteSpinDuration,
    rouletteLockDuration,
    rouletteFadeDuration,
    rouletteFreezeDuration,
    rouletteBoardFreeze,
    rouletteItems,
    rouletteMaxSpeed,
    rouletteDimOpacity,
    resultFolderId,
    skipPrefix,
    censorGameplay,
    censorMode,
    censorY,
    censorH,
    censorPixelSize,
    censorBlurRadius,
    gdriveToken,
    ffmpegBin: FFMPEG_BIN,
  };
}

/**
 * Mencetak ringkasan konfigurasi ke konsol
 */
function printConfigBanner(config, transitionSfxPath = null) {
  let speedDesc = '1.0x (Normal)';
  if (config.isFullVideoAutoSpeed) {
    speedDesc = `Otomatis (Target: maks ${config.fullVideoMaxDuration}s per klip jika > ${config.fullVideoMaxDuration}s)`;
  } else if (config.fullVideoSpeed > 1.0) {
    speedDesc = `${config.fullVideoSpeed}x (Tetap, Audio Cempreng)`;
  }

  let transDesc = 'Tidak aktif (file tidak ditemukan)';
  if (transitionSfxPath) {
    const sfxName = path.basename(transitionSfxPath);
    if (config.transitionMode === 'meme') {
      transDesc = `${sfxName} [Mode: MEME (Gambar Facecam 1:1 selebar 540x540px jika tersedia)]`;
    } else if (config.transitionMode === 'number') {
      transDesc = `${sfxName} [Mode: NUMBER (Teks counter "x / y", Font: ${config.transitionFontSize}px)]`;
    } else {
      transDesc = `${sfxName} [Mode: OFF (Layar hitam polos tanpa overlay)]`;
    }
  }

  const modeDesc = config.singleGameMode
    ? `Aktif (Edisi Khusus 1 Game${config.singleGameName ? `: "${config.singleGameName}"` : (config.singleGameId ? `: ID ${config.singleGameId}` : ' - Pilih Interaktif')})`
    : 'Multi-Game Reguler';

  const uniqueUnit = config.singleGameMode ? 'Episode' : 'Game';
  let uniquenessDesc = `${config.gameUniqueWindow} klip berturut-turut (${uniqueUnit})`;
  if (config.gameUniqueWindow <= 1) {
    uniquenessDesc = `1 (Bebas duplikat, ${uniqueUnit} yang sama boleh berulang)`;
  } else if (config.gameUniqueWindow >= config.clipCountTarget) {
    uniquenessDesc = `${config.gameUniqueWindow} klip (Semua momen dalam kompilasi dijamin ${uniqueUnit} berbeda)`;
  }

  console.log(`\nKonfigurasi:`);
  console.log(` - ID Folder Google Drive : ${config.doksliFolderId}`);
  console.log(` - Mode Kompilasi         : ${modeDesc}`);
  console.log(` - Target Momen Terpilih  : ${config.clipCountTarget} momen`);
  console.log(` - Jarak Keunikan         : ${uniquenessDesc}`);
  console.log(` - Format Output          : Vertikal 9:16 (1080x1920) 60 FPS`);
  console.log(` - Durasi Freeze Kuis     : ${(4 * config.quizTickSeconds).toFixed(2)}s (Tick: ${config.quizTickSeconds}s x 4 beat)`);
  const tickDesc = config.quizTickSfx
    ? `Custom (${path.basename(config.quizTickSfx)})`
    : 'Akustik Marimba D5 Halus (Warm Low Peak ~0.18)';
  const chimeDesc = config.quizCorrectSfx
    ? `Custom (${path.basename(config.quizCorrectSfx)})`
    : 'Akor C6-E6-G6 Halus (-55% Volume)';
  console.log(` - Efek Suara Kuis (SFX)  : Tick: ${tickDesc} | Chime: ${chimeDesc}`);
  console.log(` - Pertanyaan Kuis        : "${config.quizQuestion}"`);
  console.log(` - Prefix Abaikan/Skip    : "${config.skipPrefix}" (folder/file diawali prefix ini otomatis dilewati)`);
  console.log(` - Ending Transisi        : ${transDesc}`);
  console.log(` - Kecepatan Video Full   : ${speedDesc}`);
  console.log(` - Auto-Upload Hasil      : ${config.resultFolderId ? 'Aktif (Folder: ' + config.resultFolderId + ', auto-hapus lokal)' : 'Nonaktif (tersimpan di lokal)'}`);
  console.log(` - Posisi Freeze Kuis     : Area Gameplay 2:3 (Y = ${config.censorY}px s/d ${config.censorY + config.censorH}px, Grid 2x2, Offset: ${config.quizOffsetY}px)`);
  console.log(` - Posisi Teks Video Full : 1/4 tinggi kanvas (Y = ${config.memeTextY}px)\n`);
}

module.exports = {
  FFMPEG_BIN,
  getGoogleAuth,
  getConfig,
  printConfigBanner,
};
