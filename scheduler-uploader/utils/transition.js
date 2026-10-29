const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { generateTransitionASS } = require('./overlay');
const { getAudioDuration } = require('./videoEditor');

/**
 * Mendeteksi berkas audio transisi (TikTok Core) dari jalur kustom atau lokasi default
 */
function detectTransitionSfx(customTransitionSfx = null) {
  const candidateSfxPaths = [
    customTransitionSfx,
    path.resolve(__dirname, '../tiktok core.mp3'),
    path.resolve(__dirname, '../../tiktok core.mp3'),
    path.resolve(__dirname, '../assets/transition.mp3'),
    path.resolve(__dirname, '../assets/transition.wav'),
  ].filter(Boolean);

  return candidateSfxPaths.find((p) => fs.existsSync(p)) || null;
}

/**
 * Merender 1 klip transisi layar hitam untuk momen tertentu:
 * - Mode "meme"   : Menampilkan gambar 1:1 meme facecam di tengah layar (540x540px) jika tersedia.
 *                   Jika gambar tidak ada, layar tetap hitam polos (bukan skip).
 * - Mode "number" : Menampilkan teks counter "x / y" di tengah layar.
 * - Mode "off"    : Layar hitam polos murni tanpa overlay visual.
 */
function renderTransitionClip({
  transitionSfxPath,
  momentIndex,
  totalMoments,
  transitionMode = 'number',
  memeImagePath = null,
  transitionFontSize = 72,
  workDir,
  outputPath = null,
  ffmpegBin = 'ffmpeg',
}) {
  if (!transitionSfxPath) return null;
  const transClipPath = outputPath || path.join(workDir, `transition_${momentIndex}.mp4`);

  const sfxDur = getAudioDuration(transitionSfxPath, ffmpegBin);
  const transFrames = Math.max(1, Math.round(sfxDur * 60));
  const transDurSec = (transFrames / 60).toFixed(4);

  // 1. Mode MEME: Menampilkan gambar facecam 1:1 selebar 540x540px di tengah layar (X=270, Y=690)
  if (transitionMode === 'meme' && memeImagePath && fs.existsSync(memeImagePath)) {
    const filter =
      '[1:v]scale=540:540:force_original_aspect_ratio=decrease:flags=lanczos,pad=540:540:(540-iw)/2:(540-ih)/2:color=black@0[img];[0:v][img]overlay=270:690:format=auto[outv]';

    execSync(
      `"${ffmpegBin}" -y -f lavfi -i "color=c=black:s=1080x1920:r=60" -loop 1 -framerate 60 -i "${memeImagePath}" -i "${transitionSfxPath}" -filter_complex "${filter}" -map "[outv]" -map 2:a -af "apad,aresample=async=1:first_pts=0" -t ${transDurSec} -vframes ${transFrames} -shortest -c:v libx264 -preset fast -crf 16 -profile:v high -level 4.2 -c:a aac -ar 44100 -ac 2 -r 60 -fps_mode cfr -video_track_timescale 60000 -movflags +faststart -pix_fmt yuv420p "${transClipPath}"`,
      { stdio: 'ignore' }
    );
    return transClipPath;
  }

  // 2. Mode NUMBER: Menampilkan teks counter "x / y" di tengah layar
  if (transitionMode === 'number') {
    const transAssPath = path.join(workDir, `trans_${momentIndex}.ass`);
    const counterText = `${momentIndex} / ${totalMoments}`;

    fs.writeFileSync(
      transAssPath,
      generateTransitionASS({
        text: counterText,
        durationSeconds: parseFloat(transDurSec),
        fontSize: transitionFontSize,
      }),
      'utf8'
    );

    const escapedTransAss = transAssPath.replace(/\\/g, '/').replace(/:/g, '\\:');
    execSync(
      `"${ffmpegBin}" -y -f lavfi -i "color=c=black:s=1080x1920:r=60" -i "${transitionSfxPath}" -vf "ass='${escapedTransAss}'" -af "apad,aresample=async=1:first_pts=0" -t ${transDurSec} -vframes ${transFrames} -shortest -c:v libx264 -preset fast -crf 16 -profile:v high -level 4.2 -c:a aac -ar 44100 -ac 2 -r 60 -fps_mode cfr -video_track_timescale 60000 -movflags +faststart -pix_fmt yuv420p "${transClipPath}"`,
      { stdio: 'ignore' }
    );
    return transClipPath;
  }

  // 3. Mode OFF atau fallback jika mode meme tanpa file gambar: Layar hitam polos
  execSync(
    `"${ffmpegBin}" -y -f lavfi -i "color=c=black:s=1080x1920:r=60" -i "${transitionSfxPath}" -af "apad,aresample=async=1:first_pts=0" -t ${transDurSec} -vframes ${transFrames} -shortest -c:v libx264 -preset fast -crf 16 -profile:v high -level 4.2 -c:a aac -ar 44100 -ac 2 -r 60 -fps_mode cfr -video_track_timescale 60000 -movflags +faststart -pix_fmt yuv420p "${transClipPath}"`,
    { stdio: 'ignore' }
  );

  return transClipPath;
}

/**
 * Menyiapkan klip transisi layar hitam (TikTok Core) antara momen kuis.
 * Mendukung mode 'off', 'number' ("x / y"), dan 'meme' (gambar 1:1).
 */
function prepareTransitionClips({
  transitionSfxPath,
  totalMoments,
  transitionMode = 'number',
  showTransitionCounter = true,
  transitionFontSize = 72,
  workDir,
  ffmpegBin = 'ffmpeg',
}) {
  const transitionClips = {};
  if (!transitionSfxPath || totalMoments <= 0) return transitionClips;

  // Sinkronisasi mode jika transitionMode belum didefinisikan secara eksplisit
  const activeMode = transitionMode || (showTransitionCounter ? 'number' : 'off');

  if (activeMode === 'meme') {
    console.log(`\n🎞️ [TRANSISI] Mode MEME aktif: Klip transisi 1:1 meme facecam (540x540px) akan dirangkai per momen saat pengunduhan gambar.`);
    return transitionClips;
  }

  const modeDesc =
    activeMode === 'number'
      ? `dengan counter "x / ${totalMoments}" (font: ${transitionFontSize}px)`
      : 'layar hitam polos tanpa counter';

  console.log(`\n🎞️ [TRANSISI] Menyiapkan ${totalMoments} klip transisi ${modeDesc} (audio: "${path.basename(transitionSfxPath)}")...`);

  try {
    for (let idx = 1; idx <= totalMoments; idx++) {
      const transClipPath = renderTransitionClip({
        transitionSfxPath,
        momentIndex: idx,
        totalMoments,
        transitionMode: activeMode,
        memeImagePath: null,
        transitionFontSize,
        workDir,
        ffmpegBin,
      });
      if (transClipPath) {
        transitionClips[idx] = transClipPath;
      }
    }
    console.log(`   ✅ Seluruh ${totalMoments} klip transisi siap disisipkan antar momen.`);
  } catch (e) {
    console.warn(`   ⚠️ Gagal membuat klip transisi: ${e.message}`);
  }

  return transitionClips;
}

module.exports = {
  detectTransitionSfx,
  renderTransitionClip,
  prepareTransitionClips,
};
