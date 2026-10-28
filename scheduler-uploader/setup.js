/**
 * ============================================================================
 * INTERACTIVE SETUP WIZARD (Panduan Setup Interaktif)
 * ============================================================================
 * Skrip panduan interaktif ramah pengguna untuk mengatur seluruh alur kerja
 * Scheduler Uploader: instalasi dependensi, otorisasi akun (TikTok & Google),
 * ID/link folder Google Drive, hashtag konstan, dan uji coba.
 *
 * Jalankan dengan:
 *   npm run setup
 * atau
 *   node setup.js
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const ENV_PATH = path.resolve(__dirname, '.env');
const HASHTAGS_PATH = path.resolve(__dirname, 'hashtags.txt');
const TOKEN_JSON_PATH = path.resolve(__dirname, 'token.json');
const ROOT_TOKEN_PATH = path.resolve(__dirname, '../token.json');

// Buat interface readline untuk membaca input interaktif di terminal
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/**
 * Helper promise-based untuk mengajukan pertanyaan di terminal.
 */
function askQuestion(query) {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Helper untuk membaca isi file .env menjadi objek key-value.
 */
function readEnv() {
  if (!fs.existsSync(ENV_PATH)) return {};
  const content = fs.readFileSync(ENV_PATH, 'utf8');
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      env[key] = val;
    }
  }
  return env;
}

/**
 * Helper untuk menyimpan atau memperbarui variabel di file .env dengan aman.
 */
function updateEnv(updates) {
  let content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  const lines = content ? content.split(/\r?\n/) : [];

  for (const [key, val] of Object.entries(updates)) {
    let found = false;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith(`${key}=`)) {
        lines[i] = `${key}=${val}`;
        found = true;
        break;
      }
    }
    if (!found) {
      lines.push(`${key}=${val}`);
    }
  }

  fs.writeFileSync(ENV_PATH, lines.join('\n').trim() + '\n', 'utf8');
}

/**
 * Ekstraktor cerdas ID folder Google Drive:
 * Mendukung link URL Google Drive lengkap atau Raw ID biasa.
 * Contoh URL yang didukung:
 * - https://drive.google.com/drive/folders/1D5nuuSiGWKjWjc4aUEz8V0kzJKy-oFWf
 * - https://drive.google.com/drive/u/0/folders/1D5nuuSiGWKjWjc4aUEz8V0kzJKy-oFWf?usp=sharing
 * - 1D5nuuSiGWKjWjc4aUEz8V0kzJKy-oFWf
 */
function extractFolderId(input) {
  if (!input) return '';
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }
  return trimmed;
}

/**
 * Alur Utama Setup Wizard
 */
async function runSetup() {
  console.clear();
  console.log('================================================================');
  console.log('       🚀 SCHEDULER UPLOADER - INTERACTIVE SETUP WIZARD         ');
  console.log('================================================================');
  console.log('Selamat datang! Wizard ini akan membimbing Anda langkah demi');
  console.log('langkah untuk menyiapkan otomatisasi upload video ke TikTok & YouTube.\n');

  // ============================================================================
  // TAHAP 1: PENJELASAN ALUR KERJA & CEK DEPENDENSI
  // ============================================================================
  console.log('----------------------------------------------------------------');
  console.log('📌 TAHAP 1: Alur Kerja Sistem & Dependensi Node.js');
  console.log('----------------------------------------------------------------');
  console.log('Alur Kerja Otomatisasi:');
  console.log(' 1. Mengakses folder UNUSED di Google Drive (berisi folder game/stream).');
  console.log(' 2. Memilih 1 folder game secara ACAK, lalu 1 klip video acak (.mp4).');
  console.log(' 3. Membuat caption: <NamaFile> #<NamaFolder> <TagKonstan>.');
  console.log(' 4. Mengunggah klip secara bersamaan (paralel) ke TikTok & YouTube.');
  console.log(' 5. Memindahkan video ke folder USED secara instan di Google Drive');
  console.log('    (hanya update pointer, 0 kuota upload ulang!).\n');

  const nodeModulesPath = path.resolve(__dirname, 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    console.log('⚠️  Folder "node_modules" belum terdeteksi.');
    const doInstall = await askQuestion('👉 Ingin menjalankan "npm install" sekarang secara otomatis? (Y/n): ');
    if (doInstall.toLowerCase() !== 'n') {
      console.log('\nSedang menjalankan npm install, mohon tunggu sebentar...');
      try {
        execSync('npm install', { cwd: __dirname, stdio: 'inherit' });
        console.log('✅ npm install selesai!\n');
      } catch (err) {
        console.error('❌ Gagal menjalankan npm install:', err.message);
      }
    }
  } else {
    console.log('✅ Dependensi (node_modules) sudah terpasang.\n');
  }

  await askQuestion('👉 Apakah Tahap 1 sudah selesai dan siap lanjut ke Otorisasi Akun? (Tekan ENTER) ');

  // ============================================================================
  // TAHAP 2: OTORISASI AKUN (TIKTOK & GOOGLE DRIVE / YOUTUBE)
  // ============================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('🔐 TAHAP 2: Otorisasi Akun (TikTok & Google Drive/YouTube)');
  console.log('----------------------------------------------------------------');
  console.log('Hubungkan akun TikTok dan Google agar script memiliki izin upload & akses drive.\n');

  let envData = readEnv();
  let hasTikTokToken = !!envData.TIKTOK_API_TOKEN;
  let hasGoogleToken =
    fs.existsSync(TOKEN_JSON_PATH) ||
    fs.existsSync(ROOT_TOKEN_PATH) ||
    !!envData.GDRIVE_TOKEN;

  // 1. Akun TikTok
  console.log('1. Akun TikTok (Content Posting API):');
  if (hasTikTokToken) {
    console.log('   ✅ [TERHUBUNG] Token TikTok aktif terdeteksi di .env');
    console.log(`      Status Privasi Video : ${envData.TIKTOK_PRIVACY_LEVEL || 'SELF_ONLY'}`);
    const reAuthT = await askQuestion('   👉 Ingin login ulang / ganti akun TikTok? (y/N): ');
    if (reAuthT.toLowerCase() === 'y') {
      try {
        execSync('node auth_tiktok.js', { cwd: __dirname, stdio: 'inherit' });
      } catch (e) {}
    }
  } else {
    console.log('   ⚠️  [BELUM TERHUBUNG] Token TikTok belum ditemukan.');
    const doAuthT = await askQuestion('   👉 Jalankan otorisasi TikTok sekarang? (Y/n): ');
    if (doAuthT.toLowerCase() !== 'n') {
      try {
        execSync('node auth_tiktok.js', { cwd: __dirname, stdio: 'inherit' });
      } catch (e) {
        console.error('   ❌ Gagal otorisasi TikTok:', e.message);
      }
    }
  }

  // 2. Akun Google Drive & YouTube
  envData = readEnv();
  hasGoogleToken =
    fs.existsSync(TOKEN_JSON_PATH) ||
    fs.existsSync(ROOT_TOKEN_PATH) ||
    !!envData.GDRIVE_TOKEN;

  console.log('\n2. Akun Google Drive & YouTube:');
  if (hasGoogleToken) {
    console.log('   ✅ [TERHUBUNG] Kredensial Google (token.json) terdeteksi.');
    console.log('      Memiliki izin penuh baca/tulis Google Drive dan upload YouTube.');
    const reAuthG = await askQuestion('   👉 Ingin login ulang akun Google? (y/N): ');
    if (reAuthG.toLowerCase() === 'y') {
      try {
        execSync('node auth.js', { cwd: __dirname, stdio: 'inherit' });
      } catch (e) {}
    }
  } else {
    console.log('   ⚠️  [BELUM TERHUBUNG] File token.json belum ditemukan.');
    const doAuthG = await askQuestion('   👉 Jalankan otorisasi Google Drive & YouTube sekarang? (Y/n): ');
    if (doAuthG.toLowerCase() !== 'n') {
      try {
        execSync('node auth.js', { cwd: __dirname, stdio: 'inherit' });
      } catch (e) {
        console.error('   ❌ Gagal otorisasi Google:', e.message);
      }
    }
  }

  console.log('');
  await askQuestion('👉 Apakah Tahap 2 sudah selesai dan siap lanjut ke konfigurasi Google Drive? (Tekan ENTER) ');

  // ============================================================================
  // TAHAP 3: KONFIGURASI FOLDER GOOGLE DRIVE (UNUSED & USED)
  // ============================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('📁 TAHAP 3: Konfigurasi Folder Google Drive (Unused & Used)');
  console.log('----------------------------------------------------------------');
  console.log('Tips: Anda bisa langsung menempelkan LINK URL Google Drive lengkap');
  console.log('      (misal: https://drive.google.com/drive/folders/...) atau ID mentahnya.\n');

  const currentEnv = readEnv();
  const currentUnused = currentEnv.GDRIVE_UNUSED_FOLDER_ID || currentEnv.GDRIVE_ROOT_FOLDER_ID || '';
  const currentUsed = currentEnv.GDRIVE_USED_FOLDER_ID || '';

  console.log('1. Folder UNUSED (Folder induk yang berisi folder game / stream klip)');
  if (currentUnused) {
    console.log(`   ID saat ini: ${currentUnused}`);
  }
  const unusedInput = await askQuestion(`   Masukkan Link URL atau ID Folder UNUSED ${currentUnused ? `[Tekan ENTER jika tetap]: ` : `: `}`);
  const finalUnused = unusedInput ? extractFolderId(unusedInput) : currentUnused;

  console.log('\n2. Folder USED (Folder tujuan untuk memindahkan klip yang sudah tayang)');
  if (currentUsed) {
    console.log(`   ID saat ini: ${currentUsed}`);
  }
  const usedInput = await askQuestion(`   Masukkan Link URL atau ID Folder USED ${currentUsed ? `[Tekan ENTER jika tetap]: ` : `: `}`);
  const finalUsed = usedInput ? extractFolderId(usedInput) : currentUsed;

  console.log('\n3. Folder DOKSLI (Opsional: Folder berisi klip doksli untuk auto-edit kompilasi tebak-tebakan)');
  const currentDoksli = currentEnv.GDRIVE_DOKSLI_FOLDER_ID || '';
  if (currentDoksli) {
    console.log(`   ID saat ini: ${currentDoksli}`);
  }
  const doksliInput = await askQuestion(`   Masukkan Link URL atau ID Folder DOKSLI ${currentDoksli ? `[Tekan ENTER jika tetap]: ` : `[Tekan ENTER untuk lewati]: `}`);
  const finalDoksli = doksliInput ? extractFolderId(doksliInput) : currentDoksli;

  // Simpan ke file .env
  updateEnv({
    GDRIVE_UNUSED_FOLDER_ID: finalUnused,
    GDRIVE_USED_FOLDER_ID: finalUsed,
    GDRIVE_DOKSLI_FOLDER_ID: finalDoksli,
    QUEUE_MODE: 'random',
  });

  console.log('\n✅ Konfigurasi folder Google Drive tersimpan:');
  console.log(` - GDRIVE_UNUSED_FOLDER_ID : ${finalUnused || '(Belum diisi)'}`);
  console.log(` - GDRIVE_USED_FOLDER_ID   : ${finalUsed || '(Belum diisi)'}`);
  console.log(` - GDRIVE_DOKSLI_FOLDER_ID : ${finalDoksli || '(Belum diisi)'}\n`);

  await askQuestion('👉 Apakah Tahap 3 sudah selesai dan siap lanjut ke pengaturan Hashtag? (Tekan ENTER) ');

  // ============================================================================
  // TAHAP 4: KONFIGURASI GLOBAL HASHTAGS (MAKSIMAL 4 TAG KONSTAN)
  // ============================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('🏷️  TAHAP 4: Konfigurasi Hashtag Konstan (hashtags.txt)');
  console.log('----------------------------------------------------------------');
  console.log('Setiap video yang terupload otomatis memiliki caption:');
  console.log('  "<Nama File Terpilih> #<NamaFolderGame> <Hashtag Konstan>"');
  console.log('Contoh: "Momen Savage #MobileLegends #shorts #fyp #viral #trending"');
  console.log('\nAturan Hashtag Konstan:');
  console.log(' - Maksimal 4 hashtag konstan (boleh di bawah 4, misal 2 atau 3).');
  console.log(' - Boleh juga kosong (maka caption hanya nama file dan tag folder game).');
  console.log(' - Disimpan di file teks biasa "hashtags.txt" agar awam dan mudah diedit kapan saja.\n');

  let currentTags = '';
  if (fs.existsSync(HASHTAGS_PATH)) {
    const rawTxt = fs.readFileSync(HASHTAGS_PATH, 'utf8');
    const validWords = [];
    for (const line of rawTxt.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('//') || t.startsWith('# ') || t.startsWith('#!')) continue;
      for (const w of t.split(/[\s,]+/)) {
        const clean = w.replace(/^#+/, '').trim();
        if (clean) validWords.push(`#${clean}`);
      }
    }
    currentTags = validWords.slice(0, 4).join(' ');
  }

  if (currentTags) {
    console.log(`Hashtag saat ini: ${currentTags}`);
  }

  const tagPrompt = currentTags
    ? `Masukkan hingga 4 hashtag baru [Tekan ENTER untuk tetap "${currentTags}"]: `
    : `Masukkan hingga 4 hashtag (contoh: #shorts #fyp #viral #trending, pisahkan spasi, atau ENTER jika kosong): `;

  const inputTags = await askQuestion(tagPrompt);
  let finalTagsToSave = currentTags;

  if (inputTags.length > 0) {
    const words = inputTags
      .split(/[\s,]+/)
      .map((w) => w.replace(/^#+/, '').trim())
      .filter(Boolean)
      .slice(0, 4)
      .map((w) => `#${w}`);
    finalTagsToSave = words.join(' ');
  }

  // Simpan ke hashtags.txt
  const fileContent = `# Hashtag konstan (maksimal 4 tag). Boleh kosong jika tidak ingin tag tambahan.\n${finalTagsToSave}\n`;
  fs.writeFileSync(HASHTAGS_PATH, fileContent, 'utf8');

  console.log(`\n✅ File "hashtags.txt" berhasil diperbarui:`);
  console.log(`   Tags: ${finalTagsToSave || '(Kosong / hanya tag folder game)'}\n`);

  await askQuestion('👉 Apakah Tahap 4 sudah selesai dan siap ke ringkasan & uji coba? (Tekan ENTER) ');

  // ============================================================================
  // TAHAP 5: RINGKASAN KONFIGURASI & PILIHAN PENGUJIAN
  // ============================================================================
  console.log('\n================================================================');
  console.log('📋 TAHAP 5: Ringkasan Konfigurasi & Uji Coba');
  console.log('================================================================');
  const finalEnv = readEnv();
  const finalHasTikTok = !!finalEnv.TIKTOK_API_TOKEN;
  const finalHasGoogle =
    fs.existsSync(TOKEN_JSON_PATH) ||
    fs.existsSync(ROOT_TOKEN_PATH) ||
    !!finalEnv.GDRIVE_TOKEN;

  console.log(`- Folder Unused (Input)  : ${finalEnv.GDRIVE_UNUSED_FOLDER_ID || 'Belum diisi'}`);
  console.log(`- Folder Used (Arsip)    : ${finalEnv.GDRIVE_USED_FOLDER_ID || 'Belum diisi'}`);
  console.log(`- Mode Antrean           : ${finalEnv.QUEUE_MODE || 'random'}`);
  console.log(`- Hashtag Konstan        : ${finalTagsToSave || '(Hanya tag folder game)'}`);
  console.log(`- TikTok OAuth           : ${finalHasTikTok ? 'Siap (Token OK)' : 'Belum Login'}`);
  console.log(`- Google OAuth           : ${finalHasGoogle ? 'Siap (Token OK)' : 'Belum Login'}`);
  console.log('================================================================\n');

  console.log('Pilihan Tindakan Selanjutnya:');
  console.log(' [1] Selesai & Keluar.');
  console.log(' [2] Uji coba simulasi aman (MOCK UPLOAD: tes pemilihan folder/file tanpa kuota API).');
  console.log(' [3] Uji coba sesungguhnya (Live Execution: download, upload ke TikTok & YouTube, lalu move).');

  const action = await askQuestion('\n👉 Pilih opsi [1/2/3] (Default: 1): ');

  if (action === '2') {
    console.log('\n▶️ Menjalankan pengujian mode SIMULASI (MOCK UPLOAD)...\n');
    rl.close();
    try {
      execSync('node index.js', {
        cwd: __dirname,
        env: { ...process.env, MOCK_UPLOAD: 'true' },
        stdio: 'inherit',
      });
    } catch (e) {
      console.log('Pengujian selesai.');
    }
    return;
  } else if (action === '3') {
    console.log('\n▶️ Menjalankan eksekusi LIVE (node index.js)...\n');
    rl.close();
    try {
      execSync('node index.js', {
        cwd: __dirname,
        env: process.env,
        stdio: 'inherit',
      });
    } catch (e) {
      console.log('Eksekusi selesai.');
    }
    return;
  }

  console.log('\n🎉 Setup selesai! Anda bisa menjalankan script kapan saja dengan:');
  console.log('   node index.js');
  console.log('Atau jalankan ulang wizard ini dengan:');
  console.log('   npm run setup\n');

  rl.close();
}

// Jalankan wizard
runSetup().catch((err) => {
  console.error('\n❌ Terjadi kesalahan pada Setup Wizard:', err);
  rl.close();
  process.exit(1);
});
