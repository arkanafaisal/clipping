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
 * Menyiapkan klip transisi layar hitam (TikTok Core) antara momen kuis,
 * dengan atau tanpa counter penomoran "x / y".
 */
function prepareTransitionClips({
  transitionSfxPath,
  totalMoments,
  showTransitionCounter = true,
  transitionFontSize = 72,
  workDir,
  ffmpegBin = 'ffmpeg',
}) {
  const transitionClips = {};
  if (!transitionSfxPath || totalMoments <= 0) return transitionClips;

  const counterDesc = showTransitionCounter
    ? `dengan counter "x / ${totalMoments}" (font: ${transitionFontSize}px)`
    : 'layar hitam polos tanpa counter';

  console.log(`\n🎞️ [TRANSISI] Menyiapkan ${totalMoments} klip transisi ${counterDesc} (audio: "${path.basename(transitionSfxPath)}")...`);

  try {
    const sfxDur = getAudioDuration(transitionSfxPath, ffmpegBin);
    const transFrames = Math.max(1, Math.round(sfxDur * 60));
    const transDurSec = (transFrames / 60).toFixed(4);

    for (let idx = 1; idx <= totalMoments; idx++) {
      const transClipPath = path.join(workDir, `transition_${idx}.mp4`);
      let vfOption = '';

      if (showTransitionCounter) {
        const transAssPath = path.join(workDir, `trans_${idx}.ass`);
        const counterText = `${idx} / ${totalMoments}`;

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
        vfOption = `-vf "ass='${escapedTransAss}'" `;
      }

      execSync(
        `"${ffmpegBin}" -y -f lavfi -i "color=c=black:s=1080x1920:r=60" -i "${transitionSfxPath}" ${vfOption}-af "apad,aresample=async=1:first_pts=0" -t ${transDurSec} -vframes ${transFrames} -shortest -c:v libx264 -preset fast -crf 16 -profile:v high -level 4.2 -c:a aac -ar 44100 -ac 2 -r 60 -fps_mode cfr -video_track_timescale 60000 -movflags +faststart -pix_fmt yuv420p "${transClipPath}"`,
        { stdio: 'ignore' }
      );
      transitionClips[idx] = transClipPath;
    }
    console.log(`   ✅ Seluruh ${totalMoments} klip transisi siap disisipkan antar momen.`);
  } catch (e) {
    console.warn(`   ⚠️ Gagal membuat klip transisi: ${e.message}`);
  }

  return transitionClips;
}

module.exports = {
  detectTransitionSfx,
  prepareTransitionClips,
};
