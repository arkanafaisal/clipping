const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

const tokenPath = path.join(__dirname, 'po_token.json');
const cookiePath = path.join(__dirname, '..', 'cookies.txt');

(async () => {
  let poToken = null;
  let visitorData = null;

  console.log("[Puppeteer] Membuka browser...");
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--autoplay-policy=no-user-gesture-required',
      '--mute-audio'
    ] 
  });
  
  const page = await browser.newPage();
  
  // Baca dan injeksi cookies jika ada (PENTING untuk memicu BotGuard di akun yang terblokir)
  if (fs.existsSync(cookiePath)) {
      try {
          const cookieContent = fs.readFileSync(cookiePath, 'utf8');
          const cookies = [];
          cookieContent.split('\n').forEach(line => {
              if (line.trim() && !line.startsWith('#')) {
                  const parts = line.split('\t');
                  if (parts.length >= 7) {
                      cookies.push({
                          domain: parts[0],
                          path: parts[2],
                          secure: parts[3] === 'TRUE',
                          expires: parseInt(parts[4]),
                          name: parts[5],
                          value: parts[6].replace(/\r/g, '')
                      });
                  }
              }
          });
          if (cookies.length > 0) {
              await page.setCookie(...cookies);
              console.log("[Puppeteer] Berhasil menginjeksi cookies.txt ke browser.");
          }
      } catch (err) {
          console.log("[Puppeteer] Gagal membaca cookies.txt, melanjutkan sebagai Anonim...");
      }
  }
  
  // Intercept request untuk menangkap poToken dan visitorData
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url();
    if (url.includes('/youtubei/v1/')) {
      const postData = request.postData();
      if (postData) {
        try {
          const json = JSON.parse(postData);
          if (json.context && json.context.client && json.context.client.visitorData) {
            visitorData = json.context.client.visitorData;
          }
          if (json.serviceIntegrityDimensions && json.serviceIntegrityDimensions.poToken) {
            poToken = json.serviceIntegrityDimensions.poToken;
          }
        } catch(e) {}
      }
    }
    request.continue();
  });

  console.log("[Puppeteer] Mengunjungi YouTube...");
  // Kunjungi video yang tidak dibatasi usia dan autoplay, gunakan domcontentloaded agar tidak hang menunggu analytics
  try {
      await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ?autoplay=1', { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (e) {
      console.log("[Puppeteer] Info: Halaman dimuat sebagian, tetap mencoba mengekstrak token.");
  }
  
  // Coba menekan tombol play jika tidak auto-play
  try {
      await page.waitForSelector('.ytp-play-button', { timeout: 3000 });
      await page.click('.ytp-play-button');
  } catch(e) {}

  // Tunggu maksimal 10 detik agar YouTube memicu log_event atau player
  for(let i=0; i<10; i++) {
    if (poToken && visitorData) {
        console.log("[Puppeteer] Token Ditemukan!");
        break;
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  await browser.close();

  if (poToken && visitorData) {
    const data = { poToken, visitorData, timestamp: Date.now() };
    fs.writeFileSync(tokenPath, JSON.stringify(data, null, 2));
    console.log("SUCCESS");
  } else {
    console.log("[Puppeteer] Tidak ada PO Token yang terdeteksi (IP Anda mungkin masuk whitelist YouTube).");
    process.exit(1);
  }
})();
