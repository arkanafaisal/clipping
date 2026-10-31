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
function generateRouletteAudioWav({ duration = 4.4, stopTime = 3.4, outputPath }) {
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
    const interval = 0.03 + 0.16 * Math.pow(progress, 2.5);
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
    // Berikan sedikit offset acak agar berhentinya tidak harus persis di tengah
    // bervariasi antara -18% s/d +18% dari lebar kartu (agar terlihat natural dan acak),
    // namun tetap memastikan garis pointer tengah X=540 memotong kartu tersebut.
    const targetCenter = targetCardIndex * laneHeight + laneHeight / 2;
    const randomOffsets = [-0.18, 0.15, -0.12, 0.18, -0.15, 0.10];
    const offsetFrac = randomOffsets[k % randomOffsets.length];
    const cardOffset = Math.round(laneHeight * offsetFrac);
    const stopCenter = targetCenter + cardOffset;
    const xStop = Math.max(0, Math.round(stopCenter - 540));
    const totalRibbonWidth = cardsPerRibbon * laneHeight;

    // Posisi X kartu terpilih di layar 1080px saat pita berada di posisi xStop:
    const cardScreenX = (targetCardIndex * laneHeight) - xStop;

    ribbonResults.push({
      laneIndex: k,
      ribbonImgPath,
      targetCardIndex,
      xStop,
      cardScreenX,
      totalRibbonWidth,
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
 * - Jalur saat ini (currentMomentIndex): Bergerak cepat lalu melambat mulus (cubic ease-out) dan berhenti di t = stopTime.
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

  // Hitung kecepatan awal top speed deselerasi cubic ease-out pada t = 0:
  // x(t) = xStart + dist * (1 - (1 - t/stopTime)^3)
  // Turunan v(t) = dx/dt = 3 * dist / stopTime * (1 - t/stopTime)^2
  // Pada t = 0, v(0) = 3 * dist / stopTime.
  // Seluruh jalur background (k > currentMomentIndex) harus berputar pada topSpeed ini
  // agar kecepatan awalnya identik dan tidak terasa melambat di background lalu mendadak kencang lagi saat giliran aktif!
  const refDist = Math.round(laneHeight * 12);
  const topSpeed = Math.max(1000, Math.round((3 * refDist) / stopTime));

  for (let k = 0; k < laneCount; k++) {
    const r = ribbons[k];
    inputArgs.push('-loop', '1', '-i', r.ribbonImgPath);

    let xExpr = '';
    const maxX = Math.max(100, r.totalRibbonWidth - 1080);
    const xStop = Math.min(r.xStop, maxX);

    if (k < currentMomentIndex) {
      // Jalur yang sudah berhenti pada segmen sebelumnya -> Tetap diam di posisinya
      xExpr = `${xStop}`;
    } else if (k === currentMomentIndex) {
      // Jalur aktif saat ini -> Bergerak dari topSpeed lalu melambat (cubic ease-out) dan berhenti tepat di xStop saat t = stopTime
      const dist = Math.min(xStop, refDist);
      const xStart = xStop - dist;
      xExpr = `if(gte(t\\,${stopTime})\\,${xStop}\\,${xStart}+${dist}*(1-pow(1-(t/${stopTime})\\,3)))`;
    } else {
      // Jalur selanjutnya yang belum tiba gilirannya -> Berputar kontinu pada topSpeed yang identik
      xExpr = `mod(${k * 600}+t*${topSpeed}\\,${maxX})`;
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

  // 2. Garis pointer vertikal di tengah (HANYA 1 garis lurus vertikal di X = 540)
  drawFilters.push(`drawbox=x=537:y=0:w=6:h=${totalStackHeight}:color=0xFFCC00@0.9:t=fill`);
  drawFilters.push(`drawbox=x=539:y=0:w=2:h=${totalStackHeight}:color=white@0.95:t=fill`);

  // 3. Kotak sorotan hijau (#00FF66) HANYA untuk sesi aktif saat ini saat t >= stopTime
  // Sesi lama yang sudah lewat tidak lagi menampilkan kotak hijau sehingga maksimal hanya 1 kotak hijau dalam 1 frame
  const currY = currentMomentIndex * laneHeight;
  const rCurr = ribbons[currentMomentIndex];
  drawFilters.push(`drawbox=enable='gte(t\\,${stopTime})':x=${rCurr.cardScreenX}:y=${currY}:w=${laneHeight}:h=${laneHeight}:color=0x00FF66:t=6`);

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

  const res = spawnSync(ffmpegBin, ffmpegArgs, { stdio: 'pipe' });
  if (res.status !== 0) {
    const errStr = res.stderr ? res.stderr.toString() : '';
    throw new Error(`FFmpeg error in renderRouletteSpinSegment: ${errStr.slice(-500)}`);
  }

  return outputPath;
}

/**
 * Menyiapkan Klip Speedup Video Full dengan Animasi Freeze Fade-In & Freeze Fade-Out
 * - Fade-In (0.25s): Frame 0 ditahan (still/freeze frame) sambil bertransisi opacity 0% -> 100%
 * - Playback: Video speedup diputar normal dari awal hingga akhir (~5s) pada opacity 100%
 * - Fade-Out (0.25s): Frame terakhir ditahan (still/freeze frame) sambil bertransisi opacity 100% -> 0%
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
  const baseScale = 'scale=1080:1920:force_original_aspect_ratio=decrease:flags=lanczos,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1';

  const playDuration = rawDur / clipSpeed;
  const fadeDuration = parseFloat(config?.rouletteFadeDuration) || 0.5;
  const fadeOutStart = fadeDuration + playDuration;
  const totalDuration = playDuration + (2 * fadeDuration);
  const adelayMs = Math.round(fadeDuration * 1000);

  // Filter video:
  // 1. Skalakan ke 1080x1920, tempelkan subtitle ASS
  // 2. Gunakan tpad untuk clone frame awal (freeze selama fade-in) dan clone frame akhir (freeze selama fade-out)
  // 3. Terapkan fade-in (st=0:d=fadeDuration) dan fade-out (st=fadeOutStart:d=fadeDuration)
  const speedFilter = clipSpeed > 1.0 ? `setpts=PTS/${clipSpeed}` : null;
  const tpadFilter = `tpad=start_mode=clone:start_duration=${fadeDuration}:stop_mode=clone:stop_duration=${fadeDuration}`;
  const fadeFilter = `fade=t=in:st=0:d=${fadeDuration}:alpha=1,fade=t=out:st=${fadeOutStart.toFixed(2)}:d=${fadeDuration}:alpha=1`;

  let filterComplex = '';
  let inputArgs = ['-i', rawVideoPath];

  if (bgStillPath && fs.existsSync(bgStillPath)) {
    inputArgs.push('-loop', '1', '-i', bgStillPath);
    filterComplex = `
      [0:v]${speedFilter ? speedFilter + ',' : ''}${baseScale},ass='${escapedAss}',${tpadFilter},format=yuva420p,${fadeFilter}[fg];
      [1:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1[bg];
      [bg][fg]overlay=0:0[finalv]
    `.replace(/\s+/g, ' ').trim();
  } else {
    filterComplex = `
      [0:v]${speedFilter ? speedFilter + ',' : ''}${baseScale},ass='${escapedAss}',${tpadFilter},${fadeFilter}[finalv]
    `.replace(/\s+/g, ' ').trim();
  }

  // Filter audio:
  // Tunda audio sebesar adelayMs (0.25s) agar audio tidak diputar selama animasi fade-in berlangsung
  const af = clipSpeed > 1.0
    ? `aformat=sample_rates=44100,asetrate=44100*${clipSpeed},aresample=44100,adelay=delays=${adelayMs}:all=1,afade=t=in:st=${fadeDuration}:d=${fadeDuration},afade=t=out:st=${fadeOutStart.toFixed(2)}:d=${fadeDuration},apad,aresample=async=1:first_pts=0`
    : `adelay=delays=${adelayMs}:all=1,afade=t=in:st=${fadeDuration}:d=${fadeDuration},afade=t=out:st=${fadeOutStart.toFixed(2)}:d=${fadeDuration},apad,aresample=async=1:first_pts=0`;

  let ffmpegArgs = [
    '-y',
    ...inputArgs,
    '-filter_complex', filterComplex,
    '-map', '[finalv]',
    '-map', '0:a?',
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

  let res = spawnSync(ffmpegBin, ffmpegArgs, { stdio: 'pipe' });
  if (res.status !== 0) {
    // Fallback jika video mentah tidak memiliki audio stream: gunakan anullsrc
    const nullAudioIndex = Math.floor(inputArgs.length / 2);
    inputArgs.push('-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo');
    ffmpegArgs = [
      '-y',
      ...inputArgs,
      '-filter_complex', filterComplex,
      '-map', '[finalv]',
      '-map', `${nullAudioIndex}:a`,
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
    res = spawnSync(ffmpegBin, ffmpegArgs, { stdio: 'pipe' });
    if (res.status !== 0) {
      const errStr = res.stderr ? res.stderr.toString() : '';
      throw new Error(`FFmpeg error in renderSpeedupClipWithFade: ${errStr.slice(-500)}`);
    }
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
