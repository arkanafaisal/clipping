const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
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
  // Hasilkan kartu placeholder artistik bergradasi agar roulette tetap berjalan mulus
  if (downloadedPaths.length < 5) {
    console.log(`   ℹ️ Membuat variasi kartu sintetis untuk melengkapi roulette pool...`);
    const colors = ['#e63946', '#f1faee', '#a8dadc', '#457b9d', '#1d3557', '#ffb703', '#fb8500', '#7209b7', '#3a0ca3', '#4361ee'];
    for (let c = 0; c < 15; c++) {
      const phPath = path.join(poolDir, `synth_card_${c}.png`);
      const col = colors[c % colors.length];
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">
        <rect width="300" height="300" fill="${col}"/>
        <rect x="10" y="10" width="280" height="280" fill="none" stroke="#ffffff" stroke-width="6"/>
        <text x="150" y="160" font-family="Arial" font-size="48" font-weight="bold" fill="#ffffff" text-anchor="middle">DOKSLI #${c + 1}</text>
      </svg>`;
      const svgPath = path.join(poolDir, `synth_card_${c}.svg`);
      fs.writeFileSync(svgPath, svg, 'utf8');
      downloadedPaths.push(svgPath);
    }
  }

  console.log(`   ✅ Kumpulan gambar roulette siap (${downloadedPaths.length} kartu gambar).`);
  return downloadedPaths;
}

/**
 * Sintesis Efek Suara WAV Roulette Berputar & Berhenti (Wheel Ratchet Ticks + Lock Bell Chime)
 */
function generateRouletteAudioWav({ duration = 2.2, stopTime = 1.8, outputPath }) {
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
  // Frekuensi ketukan berkurang dari rapat (~35 Hz) menjadi renggang (~5 Hz) menjelang berhenti
  const tickTimes = [];
  let currT = 0.05;
  while (currT < stopTime - 0.05) {
    tickTimes.push(currT);
    const progress = currT / stopTime; // 0 -> 1
    // Interval antar tick memanjang seiring deselerasi
    const interval = 0.03 + 0.12 * Math.pow(progress, 2.5);
    currT += interval;
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
    if (chimeDt >= 0 && chimeDt < 0.7) {
      // Dua nada harmonik bel emas (E6 1318Hz & B6 1975Hz)
      const chime1 = Math.sin(2 * Math.PI * 1318.5 * chimeDt) * Math.exp(-chimeDt * 5.0);
      const chime2 = Math.sin(2 * Math.PI * 1975.5 * chimeDt) * Math.exp(-chimeDt * 7.0);
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
 * Menjahit 20 kartu gambar 1:1 berdampingan menjadi 1 strip panjang horizontal
 */
function buildLaneRibbons({ imagePool, moments, laneCount, laneHeight, workDir, ffmpegBin = 'ffmpeg' }) {
  const ribbonsDir = path.join(workDir, 'ribbons');
  if (!fs.existsSync(ribbonsDir)) {
    fs.mkdirSync(ribbonsDir, { recursive: true });
  }

  const ribbonResults = [];
  const cardsPerRibbon = 24;
  const targetCardIndex = 16; // Kartu target yang akan berhenti tepat di pointer (X = 540)

  console.log(`   🎨 Menyiapkan ${laneCount} pita roulette horizontal (${cardsPerRibbon} kartu 1:1 per jalur)...`);

  for (let k = 0; k < laneCount; k++) {
    const moment = moments[k];
    const ribbonImgPath = path.join(ribbonsDir, `ribbon_${k}.jpg`);

    // Kumpulkan 24 kartu untuk jalur ini
    const cardImages = [];
    for (let c = 0; c < cardsPerRibbon; c++) {
      if (c === targetCardIndex) {
        // Kartu target kemenangan untuk momen k
        if (moment.localMemeImagePath && fs.existsSync(moment.localMemeImagePath)) {
          cardImages.push(moment.localMemeImagePath);
        } else {
          cardImages.push(imagePool[(k * 7) % imagePool.length]);
        }
      } else {
        // Kartu acak di sekitarnya
        const randIdx = (k * 13 + c * 5 + 3) % imagePool.length;
        cardImages.push(imagePool[randIdx]);
      }
    }

    // Buat input argumen FFmpeg hstack
    const inputArgs = cardImages.map((p) => `-i "${p}"`).join(' ');
    const filterParts = [];
    for (let c = 0; c < cardImages.length; c++) {
      // Skalakan ke HxH bujur sangkar, tambahkan padding border tipis gelap agar antar kartu tegas
      filterParts.push(`[${c}:v]scale=${laneHeight}:${laneHeight}:force_original_aspect_ratio=increase,crop=${laneHeight}:${laneHeight},boxblur=0,pad=${laneHeight}:${laneHeight}:0:0:color=black[v${c}]`);
    }
    const hstackInputs = cardImages.map((_, c) => `[v${c}]`).join('');
    const filterComplex = `${filterParts.join(';')};${hstackInputs}hstack=inputs=${cardImages.length}[ribbon]`;

    execSync(
      `"${ffmpegBin}" -y ${inputArgs} -filter_complex "${filterComplex}" -map "[ribbon]" -q:v 2 "${ribbonImgPath}"`,
      { stdio: 'ignore' }
    );

    // Hitung posisi koordinat X saat berhenti di pointer tengah (X = 540)
    // Pusat kartu target = targetCardIndex * laneHeight + laneHeight / 2
    // Jendela crop 1080px berpusat di x + 540
    // Maka x_stop = targetCenter - 540
    const targetCenter = targetCardIndex * laneHeight + laneHeight / 2;
    const xStop = Math.max(0, Math.round(targetCenter - 540));
    const totalRibbonWidth = cardsPerRibbon * laneHeight;

    ribbonResults.push({
      laneIndex: k,
      ribbonImgPath,
      targetCardIndex,
      xStop,
      totalRibbonWidth,
    });
  }

  return ribbonResults;
}

/**
 * Membuat Gambar Pointer dan Garis Pembatas Roulette (Transparan PNG 1080x1536)
 * Menampilkan garis indikator tengah vertikal bercahaya emas, panah penunjuk,
 * dan pembatas antar jalur roulette.
 */
function generateRoulettePointerImage({ width = 1080, height = 1536, laneHeight, laneCount, outputPath, ffmpegBin = 'ffmpeg' }) {
  const pointerSvgPath = outputPath.replace(/\.png$/i, '.svg');

  // Garis pembatas horizontal antar jalur
  let dividersSvg = '';
  for (let k = 1; k < laneCount; k++) {
    const y = k * laneHeight;
    dividersSvg += `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="#ffffff" stroke-width="3" stroke-opacity="0.3"/>`;
  }

  // Pointer indicator di tengah (X = 540)
  const pointerX = width / 2; // 540
  const markerW = Math.max(laneHeight * 0.95, 120);

  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <!-- Pembatas horizontal antar jalur -->
    ${dividersSvg}

    <!-- Garis panduan tengah vertikal bercahaya emas -->
    <rect x="${pointerX - 4}" y="0" width="8" height="${height}" fill="#ffcc00" opacity="0.85"/>
    <rect x="${pointerX - 1}" y="0" width="2" height="${height}" fill="#ffffff" opacity="0.95"/>

    <!-- Bingkai selektor kartu tengah -->
    <rect x="${pointerX - markerW / 2}" y="0" width="${markerW}" height="${height}" fill="none" stroke="#ffcc00" stroke-width="4" stroke-opacity="0.6"/>

    <!-- Panah Penunjuk Atas (Segitiga Emas) -->
    <polygon points="${pointerX - 22},0 ${pointerX + 22},0 ${pointerX},32" fill="#ffcc00" stroke="#000000" stroke-width="3"/>
    
    <!-- Panah Penunjuk Bawah (Segitiga Emas) -->
    <polygon points="${pointerX - 22},${height} ${pointerX + 22},${height} ${pointerX},${height - 32}" fill="#ffcc00" stroke="#000000" stroke-width="3"/>
  </svg>`;

  fs.writeFileSync(pointerSvgPath, svgContent, 'utf8');

  // Konversi SVG ke PNG transparan menggunakan FFmpeg
  execSync(
    `"${ffmpegBin}" -y -i "${pointerSvgPath}" -c:v png "${outputPath}"`,
    { stdio: 'ignore' }
  );

  return outputPath;
}

/**
 * Merender Satu Segmen Putaran Roulette (Durasi ~2.2 Detik, 1080x1920 60 FPS CFR)
 * - Jalur yang sudah menang sebelumnya (0 .. currentMomentIndex - 1): Diam di posisi targetnya.
 * - Jalur saat ini (currentMomentIndex): Bergerak cepat lalu melambat mulus (cubic ease-out) dan berhenti di t = 1.8s.
 * - Jalur berikutnya (currentMomentIndex + 1 .. laneCount - 1): Tetap berputar kontinu.
 */
function renderRouletteSpinSegment({
  segmentIndex,
  currentMomentIndex,
  laneCount,
  laneHeight,
  ribbons,
  pointerPngPath,
  outputPath,
  workDir,
  ffmpegBin = 'ffmpeg',
  spinDuration = 2.2,
  stopTime = 1.8,
}) {
  const segmentAudioPath = path.join(workDir, `roulette_audio_${segmentIndex}.wav`);
  generateRouletteAudioWav({
    duration: spinDuration,
    stopTime,
    outputPath: segmentAudioPath,
  });

  // Susun ekspresi pergerakan horizontal crop untuk tiap-tiap jalur (0 .. laneCount - 1)
  const inputArgs = [];
  const cropFilters = [];

  for (let k = 0; k < laneCount; k++) {
    const r = ribbons[k];
    inputArgs.push(`-loop 1 -i "${r.ribbonImgPath}"`);

    let xExpr = '';
    const maxX = Math.max(100, r.totalRibbonWidth - 1080);
    const xStop = Math.min(r.xStop, maxX);

    if (k < currentMomentIndex) {
      // Jalur yang sudah berhenti pada segmen sebelumnya -> Tetap diam di posisinya
      xExpr = `${xStop}`;
    } else if (k === currentMomentIndex) {
      // Jalur aktif saat ini -> Bergerak cepat lalu melambat (cubic ease-out) dan berhenti tepat di xStop saat t = stopTime
      // Formula: x(t) = if(gte(t, stopTime), xStop, xStart + (xStop - xStart) * (1 - (1 - t/stopTime)^3))
      const xStart = Math.max(0, xStop - Math.round(laneHeight * 8.5));
      const dist = xStop - xStart;
      xExpr = `if(gte(t\\,${stopTime})\\,${xStop}\\,${xStart}+${dist}*(1-pow(1-(t/${stopTime})\\,3)))`;
    } else {
      // Jalur selanjutnya yang belum tiba gilirannya -> Berputar kontinu
      const speed = 1200 + (k * 250);
      xExpr = `mod(${k * 300}+t*${speed}\\,${maxX})`;
    }

    cropFilters.push(`[${k}:v]crop=1080:${laneHeight}:${xExpr}:0[lane${k}]`);
  }

  // Input overlay pointer & audio
  const pointerInputIndex = laneCount;
  const audioInputIndex = laneCount + 1;
  inputArgs.push(`-i "${pointerPngPath}"`);
  inputArgs.push(`-i "${segmentAudioPath}"`);

  // Gabungkan seluruh jalur secara vertikal (vstack), letakkan di kanvas 1080x1920 tepat di tengah (Y = 192),
  // lalu tumpuk gambar pointer indikator
  const vstackInputs = Array.from({ length: laneCount }, (_, i) => `[lane${i}]`).join('');
  const totalStackHeight = laneCount * laneHeight;
  const yOffset = Math.round((1920 - totalStackHeight) / 2); // default: 192

  const filterComplex = `
    ${cropFilters.join(';')};
    ${vstackInputs}vstack=inputs=${laneCount}[stack];
    [stack]pad=1080:1920:0:${yOffset}:color=black[bg];
    [bg][${pointerInputIndex}:v]overlay=0:${yOffset}[finalv]
  `.replace(/\s+/g, ' ').trim();

  execSync(
    `"${ffmpegBin}" -y ${inputArgs.join(' ')} -filter_complex "${filterComplex}" -map "[finalv]" -map ${audioInputIndex}:a -t ${spinDuration} -shortest -c:v libx264 -preset fast -crf 16 -profile:v high -level 4.2 -c:a aac -ar 44100 -ac 2 -r 60 -fps_mode cfr -video_track_timescale 60000 -movflags +faststart -pix_fmt yuv420p "${outputPath}"`,
    { stdio: 'ignore' }
  );

  return outputPath;
}

/**
 * Menyiapkan Klip Speedup Video Full dengan Animasi Fade-In & Fade-Out Mulus
 * (0.25s Fade In di awal dan 0.25s Fade Out di akhir)
 */
function renderSpeedupClipWithFade({
  rawVideoPath,
  outputPath,
  moment,
  workDir,
  config,
  ffmpegBin = 'ffmpeg',
}) {
  const targetMaxDuration = parseFloat(config.fullVideoMaxDuration) || 5.0;
  const rawDur = getAudioDuration(rawVideoPath, ffmpegBin);

  let clipSpeed = 1.0;
  if (rawDur > targetMaxDuration) {
    clipSpeed = Math.round((rawDur / targetMaxDuration) * 100) / 100;
  }

  // Subtitle ASS dua baris: Nama Game \n Waktu
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

  const escapedAss = memeAssPath.replace(/\\/g, '/').replace(/:/g, '\\:');
  const baseFilter = 'scale=1080:1920:force_original_aspect_ratio=decrease:flags=lanczos,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1';
  const finalDuration = rawDur / clipSpeed;
  const fadeDuration = 0.25;
  const fadeOutStart = Math.max(0, finalDuration - fadeDuration);

  const vf = [
    clipSpeed > 1.0 ? `setpts=PTS/${clipSpeed}` : null,
    baseFilter,
    `ass='${escapedAss}'`,
    `fade=t=in:st=0:d=${fadeDuration}`,
    `fade=t=out:st=${fadeOutStart.toFixed(2)}:d=${fadeDuration}`,
  ].filter(Boolean).join(',');

  const af = clipSpeed > 1.0
    ? `aformat=sample_rates=44100,asetrate=44100*${clipSpeed},aresample=44100,afade=t=in:st=0:d=${fadeDuration},afade=t=out:st=${fadeOutStart.toFixed(2)}:d=${fadeDuration},apad,aresample=async=1:first_pts=0`
    : `afade=t=in:st=0:d=${fadeDuration},afade=t=out:st=${fadeOutStart.toFixed(2)}:d=${fadeDuration},apad,aresample=async=1:first_pts=0`;

  try {
    execSync(
      `"${ffmpegBin}" -y -i "${rawVideoPath}" -vf "${vf}" -af "${af}" -shortest -c:v libx264 -preset fast -crf 16 -profile:v high -level 4.2 -c:a aac -ar 44100 -ac 2 -r 60 -fps_mode cfr -video_track_timescale 60000 -movflags +faststart -pix_fmt yuv420p "${outputPath}"`,
      { stdio: 'pipe' }
    );
  } catch (err) {
    // Fallback jika video mentah tidak memiliki audio stream
    execSync(
      `"${ffmpegBin}" -y -i "${rawVideoPath}" -f lavfi -i "anullsrc=r=44100:cl=stereo" -vf "${vf}" -af "${af}" -shortest -c:v libx264 -preset fast -crf 16 -profile:v high -level 4.2 -c:a aac -ar 44100 -ac 2 -r 60 -fps_mode cfr -video_track_timescale 60000 -movflags +faststart -pix_fmt yuv420p "${outputPath}"`,
      { stdio: 'ignore' }
    );
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
