const fs = require('fs');

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
 * Pembuat Subtitle ASS untuk Layer Gelap Murni di Area Gameplay (Selama cut.mp4)
 * Menutup area gameplay yang sudah di-freeze dan disensor agar fokus penonton
 * 100% tertuju pada ekspresi Facecam streamer di bagian atas tanpa distraksi kuis.
 */
function generateDarkOverlayASS({ gameplayY = 1006, gameplayH = 720 }) {
  const strEnd = formatAssTime(600); // 10 menit agar melingkupi seluruh durasi cut.mp4
  return `[Script Info]
Title: Dark Overlay Only
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default, Arial, 36, &H00FFFFFF, &H000000FF, &H00000000, &H80000000, -1, 0, 0, 0, 100, 100, 0, 0, 1, 2, 0, 5, 20, 20, 20, 1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,${strEnd},Default,,0,0,0,,{\\pos(0,${gameplayY})\\an7\\p1\\1a&H35&\\1c&H000000&\\3a&HFF&}m 0 0 l 1080 0 l 1080 ${gameplayH} l 0 ${gameplayH}{\\p0}
`;
}

/**
 * Pembuat Subtitle ASS Dinamis untuk Overlay Kuis Kompak Grid 2x2 (Freeze Frame)
 * Ditempatkan khusus di area gameplay 2:3 yang terblur/tersensor (Y = 1006 s/d 1726),
 * sehingga area Facecam di bagian atas (Y = 196 s/d 1006) tetap 100% jernih tanpa switch/jumping drastis.
 */
function generateQuizASS({
  question = 'Momen manakah itu?',
  options = [],
  correctIndex = 0,
  offsetY = 0,
  tickDuration = 0.5,
  totalDuration = 2.0,
  gameplayY = 1006,
  gameplayH = 720,
}) {
  const baseY = gameplayY + offsetY;

  // Path vektor rounded rectangle untuk kartu opsi (442 x 110 dengan radius 18px)
  const roundRectCard = `m 0 18 b 0 8 8 0 18 0 l 424 0 b 434 0 442 8 442 18 l 442 92 b 442 102 434 110 424 110 l 18 110 b 8 110 0 102 0 92`;

  // Path vektor progress bar (lebar 940px, tinggi 12px dengan rounded radius 6px)
  // Menutupi bentang dari sisi kiri Card A/C (X=70) s/d sisi kanan Card B/D (X=1010)
  const barW = 940;
  const barH = 12;
  const barTrackPath = `m 6 0 l ${barW - 6} 0 b ${barW} 0 ${barW} 6 ${barW} 6 l ${barW} 6 b ${barW} ${barH} ${barW - 6} ${barH} ${barW - 6} ${barH} l 6 ${barH} b 0 ${barH} 0 6 0 6 l 0 6 b 0 0 6 0 6 0`;

  const str0 = formatAssTime(0);
  const events = [];

  const colX = [70, 568, 70, 568];
  const rowY = [baseY + 195, baseY + 195, baseY + 330, baseY + 330];

  // Mode countdown & reveal pada freeze frame kuis
  const countdownSec = 3 * tickDuration;
  const countdownMs = Math.round(countdownSec * 1000);
  const strCountdown = formatAssTime(countdownSec);
  const strEnd = formatAssTime(totalDuration);

  // 1. Dark Overlay HANYA di area gameplay 2:3 (Terkunci di gameplayY s/d gameplayY + gameplayH, tidak terpengaruh offsetY)
  events.push(`Dialogue: 0,${str0},${strEnd},Default,,0,0,0,,{\\pos(0,${gameplayY})\\an7\\p1\\1a&H35&\\1c&H000000&\\3a&HFF&}m 0 0 l 1080 0 l 1080 ${gameplayH} l 0 ${gameplayH}{\\p0}`);

  // 2. Pertanyaan Kuis Saja (Teks putih tebal, bersih tanpa label/tag kuning di atasnya)
  events.push(`Dialogue: 1,${str0},${strEnd},Default,,0,0,0,,{\\pos(540,${baseY + 85})\\an5\\fs48\\b1\\c&HFFFFFF&\\bord3\\3c&H000000&\\q2}${question}`);

  // 3. Smooth Animated Progress Bar (Full width 940px, animasi menyusut halus 60 fps dari X=1010 ke X=70)
  const barY = baseY + 145;
  const barStartX = 70;
  const barEndX = barStartX + barW; // 1010
  // Track latar belakang gelap (tetap tampil selama countdown berlangsung)
  events.push(`Dialogue: 1,${str0},${strCountdown},Default,,0,0,0,,{\\pos(${barStartX},${barY})\\an7\\p1\\1a&H70&\\1c&H201810&\\3a&HFF&}${barTrackPath}{\\p0}`);
  // Bar aktif berwarna yang menyusut secara kontinu (smooth 60 fps) menggunakan tag \\clip + \\t
  events.push(`Dialogue: 2,${str0},${strCountdown},Default,,0,0,0,,{\\pos(${barStartX},${barY})\\an7\\p1\\1c&H00D4FF&\\3a&HFF&\\clip(${barStartX},${barY},${barEndX},${barY + barH})\\t(0,${countdownMs},\\clip(${barStartX},${barY},${barStartX},${barY + barH}))}${barTrackPath}{\\p0}`);

  // 4. Grid 2x2 Opsi Pilihan Ganda (Kolom Kiri: Baris 1 & 2, Kolom Kanan: Baris 1 & 2)
  for (let i = 0; i < 4; i++) {
    const cX = colX[i];
    const cY = rowY[i];
    const tX = cX + 221; // Posisi horizontal tepat di tengah kartu
    const tY = cY + 55;  // Posisi vertikal tepat di tengah kartu
    const isCorrect = i === correctIndex;

    const text = options[i] || 'Pilihan';
    const fontSize = 34;

    if (!isCorrect) {
      // Opsi salah: Tetap dalam tampilan normal aslinya dari awal hingga akhir kuis (tidak diredupkan)
      events.push(`Dialogue: 1,${str0},${strEnd},Default,,0,0,0,,{\\pos(${cX},${cY})\\an7\\p1\\1a&H35&\\1c&H251D18&\\3a&H20&\\3c&H605040&\\bord3}${roundRectCard}{\\p0}`);
      events.push(`Dialogue: 2,${str0},${strEnd},Default,,0,0,0,,{\\pos(${tX},${tY})\\an5\\fs${fontSize}\\b1\\c&HFFFFFF&\\bord2\\3c&H000000&\\q2}${text}`);
    } else {
      // Opsi benar: Tampil normal selama countdown, lalu berubah warna menjadi Hijau Emerald saat reveal
      events.push(`Dialogue: 1,${str0},${strCountdown},Default,,0,0,0,,{\\pos(${cX},${cY})\\an7\\p1\\1a&H35&\\1c&H251D18&\\3a&H20&\\3c&H605040&\\bord3}${roundRectCard}{\\p0}`);
      events.push(`Dialogue: 2,${str0},${strCountdown},Default,,0,0,0,,{\\pos(${tX},${tY})\\an5\\fs${fontSize}\\b1\\c&HFFFFFF&\\bord2\\3c&H000000&\\q2}${text}`);

      // Reveal: Hanya opsi benar yang berubah warna menjadi Hijau Emerald (#22C55E)
      events.push(`Dialogue: 1,${strCountdown},${strEnd},Default,,0,0,0,,{\\pos(${cX},${cY})\\an7\\p1\\1a&H00&\\1c&H30A020&\\3a&H00&\\3c&H60F040&\\bord5}${roundRectCard}{\\p0}`);
      events.push(`Dialogue: 2,${strCountdown},${strEnd},Default,,0,0,0,,{\\pos(${tX},${tY})\\an5\\fs${fontSize}\\b1\\c&HFFFFFF&\\bord3\\3c&H104010&\\q2}${text}`);
    }
  }

  return `[Script Info]
Title: Simplified Quiz 2x2 Grid Overlay
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default, Arial, 42, &H00FFFFFF, &H000000FF, &H00000000, &H00000000, 1, 0, 0, 0, 100, 100, 0, 0, 1, 2, 0, 5, 20, 20, 20, 1

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
 * Pembuat Subtitle ASS untuk Teks Counter Transisi Layar Hitam (TikTok Core)
 * Menampilkan teks "x / y" di tengah presisi (horizontal & vertikal) dengan ukuran font besar (default: 72px)
 */
function generateTransitionASS({ text, durationSeconds = 2.0, fontSize = 72 }) {
  const durStr = formatAssTime(Math.max(durationSeconds + 5, 60));

  return `[Script Info]
Title: Transition Counter Overlay
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Counter, Arial, ${fontSize}, &H00FFFFFF, &H000000FF, &H00000000, &H00000000, 1, 0, 0, 0, 100, 100, 0, 0, 1, 4, 0, 5, 20, 20, 20, 1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,${durStr},Counter,,0,0,0,,{\\pos(540,960)\\an5\\b1\\fs${fontSize}\\c&HFFFFFF&\\bord4\\3c&H000000&\\q2}${text}
`;
}

module.exports = {
  formatAssTime,
  generateDarkOverlayASS,
  generateQuizASS,
  generateFullVideoASS,
  generateTransitionASS,
  generateQuizSoundWav,
};
