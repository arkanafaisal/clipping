const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const { downloadDriveFile } = require('./downloader');
const { isSkippedItem, getFullVideoDisplayText } = require('./selector');
const { getAudioDuration, normalizeVideo } = require('./videoEditor');
const { generateFullVideoASS } = require('./overlay');

/**
 * Mengunduh kumpulan gambar meme 1:1 dari Google Drive (image.jpg / foto meme)
 * untuk dijadikan koleksi kartu yang berputar pada roulette horizontal
 */
async function downloadMemeImagesPool(drive, doksliFolderId, workDir, minCount = 25) {
  const poolDir = path.join(workDir, 'image_pool');
  if (!fs.existsSync(poolDir)) {
    fs.mkdirSync(poolDir, { recursive: true });
  }

  console.log(`   🎲 Mengumpulkan bahan kartu gambar dari Google Drive untuk roulette...`);
  const downloadedPaths = [];

  try {
    const res = await drive.files.list({
      q: `trashed = false and (name contains 'image' or mimeType contains 'image/')`,
      fields: 'files(id, name, mimeType)',
      pageSize: 60,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const imgFiles = (res.data.files || []).filter((f) => {
      const isImg =
        (f.mimeType && f.mimeType.startsWith('image/')) ||
        /\.(jpe?g|png|webp)$/i.test(f.name);
      return isImg && !isSkippedItem(f.name);
    });

    console.log(`   📷 Ditemukan ${imgFiles.length} berkas gambar di Google Drive.`);

    for (let i = 0; i < Math.min(imgFiles.length, minCount); i++) {
      const f = imgFiles[i];
      const localPath = path.join(poolDir, `pool_img_${i}.jpg`);
      try {
        await downloadDriveFile(drive, f.id, localPath);
        downloadedPaths.push(localPath);
      } catch (e) {
        // Abaikan file yang gagal unduh
      }
    }
  } catch (err) {
    console.warn(`   ⚠️ Gagal mencari gambar di Drive: ${err.message}`);
  }

  // Failsafe jika di Google Drive gambar sedikit/tidak ada
  // Hasilkan kartu placeholder artistik solid PNG menggunakan FFmpeg agar roulette tetap berjalan mulus tanpa SVG
  if (downloadedPaths.length < 10) {
    console.log(`   ℹ️ Membuat variasi kartu sintetis untuk melengkapi roulette pool...`);
    const colors = ['#e63946', '#457b9d', '#1d3557', '#ffb703', '#fb8500', '#7209b7', '#3a0ca3', '#4361ee', '#2a9d8f', '#e76f51'];
    for (let c = 0; c < 10; c++) {
      const phPath = path.join(poolDir, `synth_card_${c}.png`);
      const col = colors[c % colors.length];
      try {
        spawnSync(ffmpegBin, [
          '-y', '-f', 'lavfi', '-i', `color=c=${col}:s=400x400:d=0.1`,
          '-frames:v', '1', phPath
        ], { stdio: 'ignore' });
        if (fs.existsSync(phPath)) downloadedPaths.push(phPath);
      } catch (_) {}
    }
  }

  console.log(`   ✅ Kumpulan gambar roulette siap (${downloadedPaths.length} kartu gambar).`);
  return downloadedPaths;
}

/**
 * Sintesis Efek Suara WAV Roulette Berputar & Berhenti (Wheel Ratchet Ticks + Lock Bell Chime)
 * Menyelaraskan frekuensi ratchet ticks secara fisik dengan pergerakan pita kartu dan maxSpeed
 */
function generateRouletteAudioWav({
  duration = 4.4,
  stopTime = 3.4,
  maxSpeed = 3600,
  laneHeight = 768,
  outputPath,
}) {
  const sampleRate = 44100;
  const numSamples = Math.max(1, Math.round(sampleRate * duration));
  const numChannels = 2;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;

  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF Header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // 1. Rangkaian Ketukan Ratchet Roda Berputar yang Melambat (0s -> stopTime)
  // Menghitung titik waktu ratchet tick berbunyi secara fisik selaras dengan pergerakan pita kartu:
  // Setiap pita kartu berpindah sejauh stepDistance piksel, ratchet berbunyi 1 ketukan.
  // Persamaan gerak quadratic ease-out: s(t) = maxSpeed * (t - t^2 / (2 * stopTime))
  const stepDistance = Math.max(120, Math.round(laneHeight / 2.5));
  const totalDist = (maxSpeed * stopTime) / 2;
  const tickTimes = [];

  let n = 1;
  while (true) {
    const s = n * stepDistance;
    if (s >= totalDist) break;
    const D = 1 - (s / totalDist);
    if (D <= 0) break;
    const t = stopTime * (1 - Math.sqrt(D));
    if (t >= stopTime - 0.03) break;
    tickTimes.push(t);
    n++;
  }

  // 2. Synthesize audio samples
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sampleVal = 0.0;

    // Render ratchet ticks
    for (let k = 0; k < tickTimes.length; k++) {
      const dt = t - tickTimes[k];
      if (dt >= 0 && dt < 0.02) {
        // Suara klik kayu/plastik tajam (2200Hz + decay eksponensial cepat)
        const click = Math.sin(2 * Math.PI * 2200 * dt) * Math.exp(-dt * 300);
        sampleVal += click * 0.35;
      }
    }

    // Render lock chime / bell saat roda berhenti di t = stopTime
    const chimeDt = t - stopTime;
    const lockDuration = Math.max(0.2, duration - stopTime);
    if (chimeDt >= 0 && chimeDt < lockDuration) {
      // Dua nada harmonik bel emas (E6 1318Hz & B6 1975Hz)
      const chime1 = Math.sin(2 * Math.PI * 1318.5 * chimeDt) * Math.exp(-chimeDt * 3.5);
      const chime2 = Math.sin(2 * Math.PI * 1975.5 * chimeDt) * Math.exp(-chimeDt * 5.0);
      sampleVal += (chime1 * 0.5 + chime2 * 0.3) * 0.8;
    }

    // Clamp 16-bit PCM
    sampleVal = Math.max(-1.0, Math.min(1.0, sampleVal));
    const intVal = Math.round(sampleVal * 32767);
    const offset = 44 + i * blockAlign;
    buffer.writeInt16LE(intVal, offset);
    buffer.writeInt16LE(intVal, offset + 2);
  }

  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

/**
 * Membuat Pita Gambar Horizontal (Ribbon) untuk Setiap Jalur Roulette
 * Menjahit strip kartu gambar 1:1 berdampingan menjadi 1 pita panjang horizontal
 */
function buildLaneRibbons({
  imagePool,
  moments,
  laneCount,
  laneHeight,
  rouletteItems = 5,
  maxSpeed = 3600,
  spinDuration = 4.4,
  lockDuration = 1.0,
  workDir,
  ffmpegBin = 'ffmpeg',
}) {
  laneHeight = laneHeight % 2 === 0 ? laneHeight : laneHeight - 1;
  const ribbonsDir = path.join(workDir, 'ribbons');
  if (!fs.existsSync(ribbonsDir)) {
    fs.mkdirSync(ribbonsDir, { recursive: true });
  } else {
    // Bersihkan pita lama agar tidak bentrok dengan parameter kompilasi baru
    try {
      const files = fs.readdirSync(ribbonsDir);
      for (const f of files) {
        fs.unlinkSync(path.join(ribbonsDir, f));
      }
    } catch (_) {}
  }

  const stopTime = Math.max(0.5, Math.round((spinDuration - lockDuration) * 10) / 10);
  const refDist = Math.round((maxSpeed * stopTime) / 2);
  const distPerSegment = Math.round(spinDuration * maxSpeed);

  console.log(`   🎨 Menyiapkan ${laneCount} pita roulette horizontal (${rouletteItems} variasi item per jalur, continuous motion)...`);

  // Gabungkan seluruh kartu lokal momen ke dalam kumpulan gambar agar variasi semakin kaya
  const allAvailableImages = [...imagePool];
  for (const m of moments) {
    if (m.localMemeImagePath && fs.existsSync(m.localMemeImagePath)) {
      if (!allAvailableImages.includes(m.localMemeImagePath)) {
        allAvailableImages.push(m.localMemeImagePath);
      }
    }
  }

  // Variasi offset acak natural (antara -15% s/d +15% dari lebar kartu)
  // Menghasilkan posisi berhenti yang organik dan tidak kaku persis di tengah seperti robot,
  // sambil menjamin garis penunjuk emas X = 540 tetap memotong jelas kartu pemenang
  const randomOffsets = [-0.15, 0.12, -0.10, 0.15, -0.12, 0.10];
  const ribbonResults = [];

  for (let k = 0; k < laneCount; k++) {
    const moment = moments[k];
    const ribbonImgPath = path.join(ribbonsDir, `ribbon_${k}.jpg`);

    const winningCardPath = (moment.localMemeImagePath && fs.existsSync(moment.localMemeImagePath))
      ? moment.localMemeImagePath
      : allAvailableImages[k % allAvailableImages.length];

    // Total jarak tempuh jalur k dari t = 0 segmen pertama hingga berhenti mengunci di segmen k:
    const distTotal = k * distPerSegment + refDist;

    // Ambil (rouletteItems - 1) kartu kandidat acak untuk jalur ini
    const candidatePool = allAvailableImages.filter((p) => p !== winningCardPath);
    const poolToSample = candidatePool.length > 0 ? candidatePool : allAvailableImages;
    // Acak pool kandidat untuk variasi tiap jalur
    const shuffledCandidates = [...poolToSample].sort(() => 0.5 - Math.random());
    const otherCandidates = [];
    for (let i = 0; i < rouletteItems - 1; i++) {
      if (shuffledCandidates.length > 0) {
        otherCandidates.push(shuffledCandidates[i % shuffledCandidates.length]);
      } else {
        otherCandidates.push(winningCardPath);
      }
    }

    // Daftar item unik untuk jalur ini: item 0 = kartu pemenang, item 1..N-1 = kandidat
    const laneItems = [winningCardPath, ...otherCandidates];
    const M = laneItems.length;

    // Pastikan panjang 1 siklus periodik L = Meff * laneHeight > 1080 (lebar layar)
    // agar maksimal hanya ada 1 kartu pemenang di layar dalam satu saat
    const minCyclesNeeded = Math.max(1, Math.ceil(1080 / (M * laneHeight)));
    const effItems = [];
    for (let cy = 0; cy < minCyclesNeeded; cy++) {
      effItems.push(...laneItems);
    }
    const Meff = effItems.length;
    const periodWidth = Meff * laneHeight; // Panjang 1 putaran periodik (L)

    // Bangun pita yang memuat 1 siklus penuh (periodWidth) ditambah kartu ekstra untuk menutup layar 1080 px
    // Total kartu hanya berkisar 15 - 25 kartu, bebas dari limitasi command line 32KB Windows
    const extraCards = Math.ceil(1080 / laneHeight) + 2;
    const totalCards = Meff + extraCards;
    const cardImages = [];
    for (let c = 0; c < totalCards; c++) {
      cardImages.push(effItems[c % Meff]);
    }

    // Buat input argumen FFmpeg hstack menggunakan spawnSync langsung (aman dari batasan cmd.exe Windows)
    const inputArgsArray = [];
    for (const p of cardImages) {
      inputArgsArray.push('-i', p);
    }
    const filterParts = [];
    for (let c = 0; c < cardImages.length; c++) {
      filterParts.push(`[${c}:v]scale=${laneHeight}:${laneHeight}:force_original_aspect_ratio=increase,crop=${laneHeight}:${laneHeight},boxblur=0,pad=${laneHeight}:${laneHeight}:0:0:color=black[v${c}]`);
    }
    const hstackInputs = cardImages.map((_, c) => `[v${c}]`).join('');
    const filterComplex = `${filterParts.join(';')};${hstackInputs}hstack=inputs=${cardImages.length}[ribbon]`;

    const res = spawnSync(
      ffmpegBin,
      ['-y', ...inputArgsArray, '-filter_complex', filterComplex, '-map', '[ribbon]', '-q:v', '2', ribbonImgPath],
      { stdio: 'pipe' }
    );
    if (res.status !== 0) {
      const errStr = res.stderr ? res.stderr.toString() : '';
      throw new Error(`FFmpeg error building ribbon #${k}: ${errStr.slice(-300)}`);
    }

    // Hitung posisi koordinat X saat berhenti dengan offset acak natural
    // Tengah kartu 0 ada di laneHeight / 2. Garis pointer vertikal di X = 540.
    const offsetFrac = randomOffsets[k % randomOffsets.length];
    const cardOffset = Math.round(laneHeight * offsetFrac);
    const xStopRaw = Math.round(laneHeight / 2 + cardOffset - 540);
    const xStopTarget = ((xStopRaw % periodWidth) + periodWidth) % periodWidth;

    // Titik koordinat X pita pada t = 0 segmen pertama (Segmen 0)
    // Menjamin (xStartInitial + distTotal) % periodWidth === xStopTarget secara presisi
    const xStartInitial = ((xStopTarget - (distTotal % periodWidth)) % periodWidth + periodWidth) % periodWidth;

    // Posisi X kartu terpilih di layar 1080px saat pita berada di posisi xStopTarget:
    const cardScreenX = ((540 - Math.round(laneHeight / 2) - cardOffset) % 1080 + 1080) % 1080;

    ribbonResults.push({
      laneIndex: k,
      ribbonImgPath,
      periodWidth,
      xStartInitial,
      xStopTarget,
      cardScreenX,
      distPerSegment,
      distTotal,
      refDist,
      maxSpeed,
      stopTime,
    });
  }

  return ribbonResults;
}

/**
 * Fungsi stub kompatibilitas (pointer kini dirender langsung via native FFmpeg drawbox)
 */
function generateRoulettePointerImage() {
  return null;
}

/**
 * Merender Satu Segmen Putaran Roulette (Durasi Default ~4.4 Detik, 1080x1920 60 FPS CFR)
 * - Jalur yang sudah menang sebelumnya (0 .. currentMomentIndex - 1): Diam di posisi targetnya.
 * - Jalur saat ini (currentMomentIndex): Bergerak cepat lalu melambat mulus (quadratic ease-out) dan berhenti di t = stopTime.
 * - Jalur berikutnya (currentMomentIndex + 1 .. laneCount - 1): Berputar kontinu dengan kecepatan dasar yang seragam.
 * - Pointer tengah: HANYA 1 garis lurus vertikal di X = 540.
 * - Berhenti sedikit off-center secara natural, dan kartu yang terpilih di-highlight dengan border hijau (#00FF66).
 * - Menggunakan spawnSync langsung (tanpa cmd.exe shell) agar tidak pernah stuck/deadlock di Windows.
 */
function renderRouletteSpinSegment({
  segmentIndex,
  currentMomentIndex,
  laneCount,
  laneHeight,
  ribbons,
  outputPath,
  workDir,
  ffmpegBin = 'ffmpeg',
  spinDuration = 4.4,
  stopTime = 3.4,
  maxSpeed = 3600,
  dimOpacity = 0.65,
}) {
  laneHeight = laneHeight % 2 === 0 ? laneHeight : laneHeight - 1;
  const segmentAudioPath = path.join(workDir, `roulette_audio_${segmentIndex}.wav`);
  generateRouletteAudioWav({
    duration: spinDuration,
    stopTime,
    maxSpeed,
    laneHeight,
    outputPath: segmentAudioPath,
  });

  // Susun ekspresi pergerakan horizontal crop untuk tiap-tiap jalur (0 .. laneCount - 1)
  const inputArgs = [];
  const cropFilters = [];

  // Hitung jarak pengereman yang tepat berdasarkan maxSpeed dan stopTime:
  // Jarak pengereman refDist = (maxSpeed * stopTime) / 2
  // Kurva deselerasi quadratic ease-out (n = 2):
  // x(t) = xStart + dist * (1 - (1 - t/stopTime)^2)
  // Kecepatan puncak awal pada t = 0: v(0) = 2 * dist / stopTime = maxSpeed
  const refDist = Math.round((maxSpeed * stopTime) / 2);
  const topSpeed = maxSpeed;

  for (let k = 0; k < laneCount; k++) {
    const r = ribbons[k];
    inputArgs.push('-loop', '1', '-i', r.ribbonImgPath);

    let xExpr = '';
    const L = r.periodWidth;
    const sStart = currentMomentIndex * r.distPerSegment;

    if (k < currentMomentIndex) {
      // Jalur yang sudah berhenti pada segmen sebelumnya -> Tetap diam di posisi xStopTarget
      xExpr = `${r.xStopTarget}`;
    } else if (k === currentMomentIndex) {
      // Jalur aktif saat ini -> Bergerak dari topSpeed lalu melambat halus (quadratic ease-out) dan berhenti tepat di xStopTarget saat t = stopTime
      const decelExpr = `if(gte(t\\,${stopTime})\\,${r.refDist}\\,${r.refDist}*(1-pow(1-(t/${stopTime})\\,2)))`;
      xExpr = `mod(${r.xStartInitial}+${sStart}+${decelExpr}\\,${L})`;
    } else {
      // Jalur selanjutnya yang belum tiba gilirannya -> Berputar kontinu pada topSpeed yang SAMA PERSIS
      // Dimulai persis di mana segmen sebelumnya berakhir
      xExpr = `mod(${r.xStartInitial}+${sStart}+t*${topSpeed}\\,${L})`;
    }

    cropFilters.push(`[${k}:v]crop=1080:${laneHeight}:${xExpr}:0[lane${k}]`);
  }

  // Input audio roulette ratchet + bell chime
  const audioInputIndex = laneCount;
  inputArgs.push('-i', segmentAudioPath);

  // Bangun filter drawbox untuk divider, pointer garis tunggal tengah, dan kotak seleksi kartu hijau
  const totalStackHeight = laneCount * laneHeight;
  const drawFilters = [];

  // 1. Dividers antar baris jalur (garis putih transparan tipis)
  for (let k = 1; k < laneCount; k++) {
    const y = k * laneHeight;
    drawFilters.push(`drawbox=x=0:y=${y}:w=1080:h=3:color=white@0.35:t=fill`);
  }

  // 2. Garis pointer vertikal di tengah HANYA untuk roulette yang sedang aktif (setinggi 1 jalur)
  // Ketika roulette sudah tidak aktif (pada segmen/putaran lain), garis pointer di jalur tersebut otomatis hilang
  const currY = currentMomentIndex * laneHeight;
  drawFilters.push(`drawbox=x=537:y=${currY}:w=6:h=${laneHeight}:color=0xFFCC00@0.9:t=fill`);
  drawFilters.push(`drawbox=x=539:y=${currY}:w=2:h=${laneHeight}:color=white@0.95:t=fill`);

  // 3. Efek Spotlight Overlay Gelap (Menggelapkan item selain kartu terpilih & meredupkan jalur background)
  // - Jalur masa lalu yang sudah menang sebelumnya (j < currentMomentIndex):
  //   Sifat spotlight "terang sendiri" bertahan permanen hingga akhir kompilasi
  for (let j = 0; j < currentMomentIndex; j++) {
    const y = j * laneHeight;
    const rJ = ribbons[j];
    const leftW = rJ.cardScreenX;
    if (leftW > 0) {
      drawFilters.push(`drawbox=x=0:y=${y}:w=${leftW}:h=${laneHeight}:color=black@${dimOpacity}:t=fill`);
    }
    const rightX = rJ.cardScreenX + laneHeight;
    const rightW = 1080 - rightX;
    if (rightW > 0) {
      drawFilters.push(`drawbox=x=${rightX}:y=${y}:w=${rightW}:h=${laneHeight}:color=black@${dimOpacity}:t=fill`);
    }
  }

  // - Jalur aktif saat ini (k === currentMomentIndex):
  //   Saat sedang spin (t < stopTime) TIDAK ADA overlay (terang penuh).
  //   Saat sudah berhenti (t >= stopTime), muncul overlay gelap di kiri & kanan kartu terpilih sehingga hanya kartu terpilih yang tetap terang.
  const rCurr = ribbons[currentMomentIndex];
  const activeLeftW = rCurr.cardScreenX;
  if (activeLeftW > 0) {
    drawFilters.push(`drawbox=enable='gte(t\\,${stopTime})':x=0:y=${currY}:w=${activeLeftW}:h=${laneHeight}:color=black@${dimOpacity}:t=fill`);
  }
  const activeRightX = rCurr.cardScreenX + laneHeight;
  const activeRightW = 1080 - activeRightX;
  if (activeRightW > 0) {
    drawFilters.push(`drawbox=enable='gte(t\\,${stopTime})':x=${activeRightX}:y=${currY}:w=${activeRightW}:h=${laneHeight}:color=black@${dimOpacity}:t=fill`);
  }

  // - Jalur background yang belum sesinya (b > currentMomentIndex):
  //   Diberi overlay gelap penuh sepanjang durasi, namun tetap berputar kontinu di latar belakang agar fokus tertuju ke jalur aktif
  for (let b = currentMomentIndex + 1; b < laneCount; b++) {
    const y = b * laneHeight;
    drawFilters.push(`drawbox=x=0:y=${y}:w=1080:h=${laneHeight}:color=black@${dimOpacity}:t=fill`);
  }

  // Gabungkan seluruh jalur secara vertikal (vstack), letakkan di kanvas 1080x1920 tepat di tengah
  const vstackInputs = Array.from({ length: laneCount }, (_, i) => `[lane${i}]`).join('');
  const yOffset = Math.round((1920 - totalStackHeight) / 2); // default: 192

  const filterComplex = `
    ${cropFilters.join(';')};
    ${vstackInputs}vstack=inputs=${laneCount},${drawFilters.join(',')}[stack];
    [stack]pad=1080:1920:0:${yOffset}:color=black[finalv]
  `.replace(/\s+/g, ' ').trim();

  const ffmpegArgs = [
    '-y',
    ...inputArgs,
    '-filter_complex', filterComplex,
    '-map', '[finalv]',
    '-map', `${audioInputIndex}:a`,
    '-t', String(spinDuration),
    '-shortest',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '16',
    '-profile:v', 'high',
    '-level', '4.2',
    '-c:a', 'aac',
    '-ar', '44100',
    '-ac', '2',
    '-r', '60',
    '-fps_mode', 'cfr',
    '-video_track_timescale', '60000',
    '-movflags', '+faststart',
    '-pix_fmt', 'yuv420p',
    outputPath,
  ];

  const res = spawnSync(ffmpegBin, ffmpegArgs, { stdio: 'pipe', maxBuffer: 50 * 1024 * 1024 });
  if (res.status !== 0) {
    const errStr = (res.stderr ? res.stderr.toString() : '') || (res.error ? res.error.message : '') || `status ${res.status}`;
    throw new Error(`FFmpeg error in renderRouletteSpinSegment: ${errStr.slice(-500)}`);
  }

  return outputPath;
}

/**
 * Memeriksa apakah berkas media memiliki aliran audio (Audio stream)
 */
function hasAudioStream(filePath, ffmpegBin = 'ffmpeg') {
  try {
    const res = spawnSync(ffmpegBin, ['-i', filePath], { encoding: 'utf8' });
    const out = (res.stdout || '') + (res.stderr || '');
    return /Stream #.*Audio:/.test(out);
  } catch (_) {
    return false;
  }
}

/**
 * Menyiapkan Klip Speedup Video Full dengan Animasi Freeze Fade-In, Freeze Pre-Play, & Freeze Fade-Out
 * - Fade-In (fadeDuration): Frame 0 ditahan (still/freeze frame) sambil bertransisi opacity 0% -> 100%
 * - Pre-Play Freeze (freezeDuration): Frame 0 tetap ditahan diam pada opacity 100% agar penonton dapat scanning subtitle & konten
 * - Playback (playDuration): Video speedup diputar penuh dan audio disinkronkan tepat di detik video mulai bergerak
 * - Fade-Out (fadeDuration): Frame terakhir ditahan (still/freeze frame) sambil bertransisi opacity 100% -> 0%
 * - Jika bgStillPath diberikan, transisi fade terjadi di atas latar papan roulette yang berhenti
 */
function renderSpeedupClipWithFade({
  rawVideoPath,
  outputPath,
  moment,
  workDir,
  config,
  bgStillPath = null,
  ffmpegBin = 'ffmpeg',
  isUsingSpeedup = false,
}) {
  const usingSpeedup = isUsingSpeedup || !!moment.isUsingSpeedup;
  const targetMaxDuration = parseFloat(config.fullVideoMaxDuration) || 5.0;
  const rawDur = getAudioDuration(rawVideoPath, ffmpegBin);

  let clipSpeed = 1.0;
  if (!usingSpeedup && rawDur > targetMaxDuration) {
    clipSpeed = Math.round((rawDur / targetMaxDuration) * 100) / 100;
  }

  // Subtitle ASS dua baris: Nama Game \n Waktu HANYA jika bukan speedup.mp4 siap pakai (karena speedup.mp4 dari crawler sudah memiliki teks)
  let escapedAss = null;
  if (!usingSpeedup) {
    const memeAssPath = path.join(workDir, `roulette_speedup_${Date.now()}.ass`);
    const displayText = getFullVideoDisplayText(moment.gameName, moment.epsName, moment.fullFile?.name, moment.clipFolderName);
    fs.writeFileSync(
      memeAssPath,
      generateFullVideoASS({
        text: displayText,
        durationSeconds: 600,
        posY: config.memeTextY || 360,
      }),
      'utf8'
    );
    escapedAss = memeAssPath.replace(/\\/g, '/').replace(/:/g, '\\:');
  }

  const baseScale = 'scale=1080:1920:force_original_aspect_ratio=decrease:flags=lanczos,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1';

  const playDuration = rawDur / clipSpeed;
  const fadeDuration = parseFloat(config?.rouletteFadeDuration) || 0.5;
  const freezeDuration = config?.rouletteFreezeDuration !== undefined ? parseFloat(config.rouletteFreezeDuration) : 0.5;
  const boardFreezeDuration = config?.rouletteBoardFreeze !== undefined ? parseFloat(config.rouletteBoardFreeze) : 0.5;

  // Rangkaian Waktu Transisi Mulus Tanpa Jumping:
  // 1. [0 s/d boardFreezeDuration]: Papan roulette diam terkunci (still frame, opacity video doksli 0%)
  // 2. [boardFreezeDuration s/d + fadeDuration]: Video doksli frame 0 memudar masuk (fade-in 0% -> 100%)
  // 3. [+ freezeDuration]: Video doksli frame 0 ditahan diam pada 100% opacity agar penonton siap & membaca subtitle
  // 4. [+ playDuration]: Video doksli diputar speedup penuh bersama aliran audionya
  // 5. [+ freezeDuration]: Video doksli frame terakhir ditahan diam pada 100% opacity ("freeze dulu baru fadeout")
  // 6. [+ fadeDuration]: Video doksli frame terakhir memudar keluar (fade-out 100% -> 0%) kembali ke papan roulette
  // 7. [+ boardFreezeDuration]: Papan roulette diam terkunci kembali sebelum putaran segmen berikutnya mulai
  const startFreezeDuration = boardFreezeDuration + fadeDuration + freezeDuration;
  const stopFreezeDuration = freezeDuration + fadeDuration + boardFreezeDuration;
  const fadeOutStart = startFreezeDuration + playDuration + freezeDuration;
  const totalDuration = startFreezeDuration + playDuration + stopFreezeDuration;
  const adelayMs = Math.round(startFreezeDuration * 1000);

  // Filter video:
  // 1. Skalakan ke 1080x1920 (tempelkan subtitle ASS hanya jika belum ada di speedup.mp4)
  // 2. Gunakan tpad untuk clone frame awal (freeze board + fade-in + pre-play) dan frame akhir (post-play + fade-out + board)
  // 3. Terapkan fade-in (st=boardFreezeDuration:d=fadeDuration) dan fade-out (st=fadeOutStart:d=fadeDuration)
  const speedFilter = (!usingSpeedup && clipSpeed > 1.0) ? `setpts=PTS/${clipSpeed}` : null;
  const assPart = escapedAss ? `,ass='${escapedAss}'` : '';
  const tpadFilter = `tpad=start_mode=clone:start_duration=${startFreezeDuration.toFixed(3)}:stop_mode=clone:stop_duration=${stopFreezeDuration.toFixed(3)}`;
  const fadeFilter = `fade=t=in:st=${boardFreezeDuration.toFixed(3)}:d=${fadeDuration.toFixed(3)}:alpha=1,fade=t=out:st=${fadeOutStart.toFixed(3)}:d=${fadeDuration.toFixed(3)}:alpha=1`;

  const inputArgs = ['-i', rawVideoPath];
  let numInputs = 1;
  let audioInputRef = '0:a';

  // Periksa apakah video mentah memiliki aliran audio
  const hasAudio = hasAudioStream(rawVideoPath, ffmpegBin);
  if (!hasAudio) {
    const nullAudioIndex = numInputs++;
    inputArgs.push('-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo');
    audioInputRef = `${nullAudioIndex}:a`;
  }

  let videoFilterComplex = '';
  if (bgStillPath && fs.existsSync(bgStillPath)) {
    const bgInputIndex = numInputs++;
    inputArgs.push('-loop', '1', '-i', bgStillPath);
    videoFilterComplex = `
      [0:v]${speedFilter ? speedFilter + ',' : ''}${baseScale}${assPart},${tpadFilter},format=yuva420p,${fadeFilter}[fg];
      [${bgInputIndex}:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1[bg];
      [bg][fg]overlay=0:0[finalv]
    `.replace(/\s+/g, ' ').trim();
  } else {
    videoFilterComplex = `
      [0:v]${speedFilter ? speedFilter + ',' : ''}${baseScale}${assPart},${tpadFilter},format=yuva420p,${fadeFilter}[finalv]
    `.replace(/\s+/g, ' ').trim();
  }

  // Filter audio:
  // Tunda audio sebesar adelayMs (boardFreezeDuration + fadeDuration + freezeDuration)
  // sehingga audio dan gerakan video mulai berputar bersamaan secara presisi
  const afadeStart = startFreezeDuration + playDuration;
  const audioFilters = [];
  if (!usingSpeedup && clipSpeed > 1.0) {
    audioFilters.push(`aformat=sample_rates=44100,asetrate=44100*${clipSpeed},aresample=44100`);
  }
  if (adelayMs > 0) {
    audioFilters.push(`adelay=delays=${adelayMs}:all=1`);
  }
  audioFilters.push(`afade=t=out:st=${afadeStart.toFixed(3)}:d=${Math.min(0.2, fadeDuration).toFixed(3)}`);
  audioFilters.push('apad,aresample=async=1:first_pts=0');

  const filterComplex = `
    ${videoFilterComplex};
    [${audioInputRef}]${audioFilters.join(',')}[finala]
  `.replace(/\s+/g, ' ').trim();

  const ffmpegArgs = [
    '-y',
    ...inputArgs,
    '-filter_complex', filterComplex,
    '-map', '[finalv]',
    '-map', '[finala]',
    '-t', totalDuration.toFixed(2),
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '16',
    '-profile:v', 'high',
    '-level', '4.2',
    '-c:a', 'aac',
    '-ar', '44100',
    '-ac', '2',
    '-r', '60',
    '-fps_mode', 'cfr',
    '-video_track_timescale', '60000',
    '-movflags', '+faststart',
    '-pix_fmt', 'yuv420p',
    outputPath,
  ];

  const res = spawnSync(ffmpegBin, ffmpegArgs, { stdio: 'pipe' });
  if (res.status !== 0) {
    const errStr = res.stderr ? res.stderr.toString() : '';
    throw new Error(`FFmpeg error in renderSpeedupClipWithFade: ${errStr.slice(-500)}`);
  }

  try {
    if (fs.existsSync(memeAssPath)) fs.unlinkSync(memeAssPath);
  } catch (_) {}

  return outputPath;
}

module.exports = {
  downloadMemeImagesPool,
  generateRouletteAudioWav,
  buildLaneRibbons,
  generateRoulettePointerImage,
  renderRouletteSpinSegment,
  renderSpeedupClipWithFade,
};
