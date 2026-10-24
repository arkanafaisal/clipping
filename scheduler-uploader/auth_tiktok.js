/**
 * ============================================================================
 * TikTok OAuth2 Token Generator (Flexible & Non-Localhost Supported)
 * ============================================================================
 * Menggunakan Node.js Built-in (Fetch & FS) - Tanpa wajib install modul tambahan!
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { exec } = require('child_process');

// Muat .env secara native (tanpa perlu dependensi dotenv)
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(envPath);
    } catch (_) {}
  } else {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = (match[2] || '').trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[key] = val;
      }
    }
  }
}

// Redirect URI yang didaftarkan di TikTok Developer Portal
const REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI || 'https://clipping.arkana.studio/';

const clientKey = process.env.TIKTOK_CLIENT_KEY || process.env.TIKTOK_CLIENT_ID;
const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

if (!clientKey || !clientSecret) {
  console.log('================================================================');
  console.log('                 TIKTOK OAUTH2 TOKEN GENERATOR                  ');
  console.log('================================================================');
  console.log('⚠️ Kredensial TikTok belum diisi di file .env!');
  console.log('Silakan buka file scheduler-uploader/.env dan isi:');
  console.log('  TIKTOK_CLIENT_KEY=salin_client_key_dari_dashboard_tiktok');
  console.log('  TIKTOK_CLIENT_SECRET=salin_client_secret_dari_dashboard_tiktok\n');
  console.log('Lalu jalankan kembali: npm run auth:tiktok\n');
  process.exit(1);
}

// Scope resmi yang aktif di aplikasi Anda: user.info.basic dan video.upload
const SCOPES = process.env.TIKTOK_SCOPES || 'user.info.basic,video.upload';

const authUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${encodeURIComponent(
  clientKey
)}&scope=${SCOPES}&response_type=code&redirect_uri=${encodeURIComponent(
  REDIRECT_URI
)}&state=clipping_uploader`;

console.log('================================================================');
console.log('                 TIKTOK OAUTH2 TOKEN GENERATOR                  ');
console.log('================================================================');
console.log('1. Membuka browser untuk login & otorisasi TikTok...\n');
console.log('Jika browser tidak terbuka otomatis, salin URL ini ke browser:');
console.log(authUrl);
console.log('\n----------------------------------------------------------------');
console.log('2. PETUNJUK SETELAH KLIK "AUTHORIZE" DI BROWSER:');
console.log('Browser akan dialihkan ke alamat yang diawali:');
console.log(`  ${REDIRECT_URI}?code=xxxxxx...`);
console.log('(Tidak apa-apa jika halaman tersebut menampilkan "Site can\'t be reached").');
console.log('Cukup SALIN seluruh URL di address bar browser Anda, lalu paste di bawah:');
console.log('----------------------------------------------------------------\n');

// Otomatis buka browser di Windows / Mac / Linux
try {
  const startCmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  exec(`${startCmd} "${authUrl}"`);
} catch (_) {}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Tempelkan (Paste) URL hasil redirect atau nilai kodenya di sini:\n> ', async (input) => {
  rl.close();
  const trimmed = input.trim();

  if (!trimmed) {
    console.error('❌ Input kosong. Proses dibatalkan.');
    process.exit(1);
  }

  // Ekstrak nilai code dari URL lengkap atau jika user hanya mem-paste string kodenya
  let authCode = trimmed;
  if (trimmed.includes('code=')) {
    try {
      const parsedUrl = new URL(trimmed);
      authCode = parsedUrl.searchParams.get('code') || authCode;
    } catch (_) {
      const match = trimmed.match(/code=([^&]+)/);
      if (match) authCode = match[1];
    }
  }

  console.log('\nMenukarkan authorization code dengan TikTok Access Token...');

  try {
    const tokenEndpoint = 'https://open.tiktokapis.com/v2/oauth/token/';
    const params = new URLSearchParams();
    params.append('client_key', clientKey);
    params.append('client_secret', clientSecret);
    params.append('code', authCode);
    params.append('grant_type', 'authorization_code');
    params.append('redirect_uri', REDIRECT_URI);

    // Menggunakan built-in fetch bawaan Node.js v24 (tanpa perlu install axios)
    const tokenRes = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache',
      },
      body: params.toString(),
    });

    const resJson = await tokenRes.json();
    const tokenData = resJson?.data || resJson;

    if (!tokenData || !tokenData.access_token) {
      throw new Error(`Respon tidak valid dari TikTok: ${JSON.stringify(resJson)}`);
    }

    // Simpan ke token_tiktok.json
    const fullTokenRecord = {
      client_key: clientKey,
      ...tokenData,
      saved_at: new Date().toISOString(),
    };

    const tokenJsonPath = path.resolve(__dirname, 'token_tiktok.json');
    fs.writeFileSync(tokenJsonPath, JSON.stringify(fullTokenRecord, null, 2));

    // Otomatis update .env
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    if (envContent.includes('TIKTOK_API_TOKEN=')) {
      envContent = envContent.replace(/TIKTOK_API_TOKEN=.*/g, `TIKTOK_API_TOKEN=${tokenData.access_token}`);
    } else {
      envContent += `\nTIKTOK_API_TOKEN=${tokenData.access_token}\n`;
    }
    fs.writeFileSync(envPath, envContent);

    console.log('\n================================================================');
    console.log('🎉 BERHASIL MENDAPATKAN TIKTOK ACCESS TOKEN!');
    console.log('================================================================');
    console.log(`Access Token : ${tokenData.access_token}`);
    console.log(`Masa Berlaku : ${tokenData.expires_in} detik (~${Math.round(tokenData.expires_in / 3600)} jam)`);
    console.log(`File JSON    : ${tokenJsonPath}`);
    console.log('\n✅ File .env berhasil diperbarui dengan token terbaru.');
    console.log('Sekarang Anda sudah siap menguji coba upload video ke TikTok!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Gagal menukarkan token TikTok:');
    console.error(err.message || err);
    process.exit(1);
  }
});
