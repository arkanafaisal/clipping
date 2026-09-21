const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

const tokenPath = path.join(__dirname, 'po_token.json');

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
  // Kunjungi video yang tidak dibatasi usia dan autoplay
  await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ?autoplay=1', { waitUntil: 'networkidle2' });
  
  // Coba menekan tombol play jika tidak auto-play
  try {
      await page.waitForSelector('.ytp-play-button', { timeout: 3000 });
      await page.click('.ytp-play-button');
  } catch(e) {}

  // Tunggu maksimal 5 detik agar YouTube memicu log_event atau player
  for(let i=0; i<5; i++) {
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
