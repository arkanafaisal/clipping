/**
 * ============================================================================
 * Google OAuth2 Token Generator (Drive & YouTube Unified)
 * ============================================================================
 * Script pembantu untuk dijalankan SATU KALI di komputer lokal Anda:
 *   npm run auth   (atau: node auth.js)
 *
 * Tujuan:
 * 1. Mengotorisasi izin Google Drive (baca file) dan YouTube Data API (upload).
 * 2. Menerima refresh_token permanen (unlimited) dari Google Cloud Console
 *    (status aplikasi Production / Unverified).
 * 3. Menyimpan hasilnya ke token.json yang siap disalin ke Environment Variable
 *    Heroku (GDRIVE_TOKEN / YOUTUBE_API_TOKEN).
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { URL } = require('url');
const { exec } = require('child_process');
const { google } = require('googleapis');

// Scopes terpadu: Google Drive (baca, pindah, rename) dan YouTube (upload)
const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
];

// Port server callback lokal
const PORT = 8080;
const REDIRECT_URI = `http://localhost:${PORT}/`;

function findCredentialsFile() {
  const candidatePaths = [
    path.resolve(__dirname, 'credentials.json'),
    path.resolve(__dirname, '../credentials.json'),
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const credPath = findCredentialsFile();
if (!credPath) {
  console.error('\n❌ ERROR: File credentials.json tidak ditemukan!');
  console.error('Letakkan file credentials.json di folder scheduler-uploader atau root project.');
  console.error('Langkah-langkah di Google Cloud Console:');
  console.error(' 1. Buka https://console.cloud.google.com/');
  console.error(' 2. Pilih Project -> Enabled APIs & Services -> Pastikan "Google Drive API" & "YouTube Data API v3" aktif.');
  console.error(' 3. Menu "Credentials" -> "Create Credentials" -> "OAuth Client ID" (tipe "Desktop App").');
  console.error(' 4. Unduh file JSON lalu simpan sebagai "credentials.json".\n');
  process.exit(1);
}

const credentials = JSON.parse(fs.readFileSync(credPath, 'utf8'));
const clientData = credentials.installed || credentials.web;

if (!clientData || !clientData.client_id || !clientData.client_secret) {
  console.error('❌ ERROR: credentials.json tidak memiliki client_id atau client_secret yang valid.');
  process.exit(1);
}

const { client_id, client_secret } = clientData;
const oauth2Client = new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline', // Wajib: agar menghasilkan refresh_token yang tidak kedaluwarsa
  prompt: 'consent',     // Wajib: memaksa Google menerbitkan refresh_token baru
  scope: SCOPES,
});

console.log('================================================================');
console.log('     GOOGLE OAUTH2 TOKEN GENERATOR (DRIVE + YOUTUBE UNIFIED)    ');
console.log('================================================================');
console.log('1. Buka URL otorisasi berikut di browser Anda:\n');
console.log(authUrl);
console.log('\n2. Jika muncul peringatan "Google hasn\'t verified this app":');
console.log('   -> Klik "Advanced"');
console.log('   -> Klik "Go to [Nama Aplikasi] (unsafe)"');
console.log('3. Berikan izin akses Google Drive dan YouTube.\n');
console.log(`Menunggu otorisasi browser (server mendengarkan di http://localhost:${PORT})...\n`);

const server = http.createServer(async (req, res) => {
  try {
    const reqUrl = new URL(req.url, `http://localhost:${PORT}`);
    const code = reqUrl.searchParams.get('code');
    const errorParam = reqUrl.searchParams.get('error');

    if (errorParam) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<h1>❌ Otorisasi Dibatalkan</h1><p>${errorParam}</p>`);
      console.error(`❌ Otorisasi dibatalkan: ${errorParam}`);
      server.close();
      process.exit(1);
    }

    if (code) {
      console.log('Authorization code diterima. Menukarkan dengan Refresh Token...');
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      const tokenOutput = {
        client_id,
        client_secret,
        ...tokens,
      };

      const outputPath = path.resolve(__dirname, 'token.json');
      fs.writeFileSync(outputPath, JSON.stringify(tokenOutput, null, 2));

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h1 style="color: #10b981;">✅ Otorisasi Berhasil!</h1>
          <p style="font-size: 16px;">File <code>token.json</code> telah berhasil dibuat di folder <code>scheduler-uploader</code>.</p>
          <p>Anda dapat menutup jendela browser ini dan kembali ke terminal.</p>
        </div>
      `);

      console.log('\n================================================================');
      console.log('🎉 SUKSES! TOKEN UNLIMITED BERHASIL DIBUAT!');
      console.log('================================================================');
      console.log(`Lokasi file: ${outputPath}`);
      console.log('\n--- CARA MEMASANG KE HEROKU ---');
      console.log('Salin seluruh isi file token.json ke Config Vars Heroku:');
      console.log('GDRIVE_TOKEN = <seluruh_teks_json_dari_token.json>');
      console.log('\nCatatan Penting:');
      console.log('Karena token ini sudah memiliki izin Google Drive DAN YouTube, Anda');
      console.log('CUKUP mengisi GDRIVE_TOKEN. Variabel YOUTUBE_API_TOKEN otomatis menggunakan');
      console.log('token yang sama jika dikosongkan!');
      console.log('================================================================\n');

      setTimeout(() => {
        server.close();
        process.exit(0);
      }, 1000);
    }
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Gagal menukarkan token: ' + err.message);
    console.error('Error saat menukarkan code:', err.message);
    server.close();
    process.exit(1);
  }
});

server.listen(PORT, () => {
  // Otomatis buka browser di OS Windows / Mac / Linux
  try {
    const startCmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    exec(`${startCmd} "${authUrl}"`);
  } catch (_) {}
});
