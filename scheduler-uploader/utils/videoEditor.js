const fs = require('fs');
const { execSync, spawnSync } = require('child_process');
const {
  generateDarkOverlayASS,
  generateQuizASS,
  generateFullVideoASS,
  generateQuizSoundWav,
} = require('./overlay');

/**
 * Membaca durasi audio dalam detik menggunakan FFmpeg
 */
function getAudioDuration(filePath, ffmpegBin = 'ffmpeg') {
  try {
    const probe = execSync(`"${ffmpegBin}" -i "${filePath}" 2>&1`).toString();
    const match = probe.match(/Duration:\s*(\d+):(\d+):([\d\.]+)/);
    if (match) {
      return parseInt(match[1], 10) * 3600 + parseInt(match[2], 10) * 60 + parseFloat(match[3]);
    }
  } catch (e) {
    const out = (e.stdout || e.stderr || '').toString();
    const match = out.match(/Duration:\s*(\d+):(\d+):([\d\.]+)/);
    if (match) {
      return parseInt(match[1], 10) * 3600 + parseInt(match[2], 10) * 60 + parseFloat(match[3]);
    }
  }
  return 0.7; // default fallback
}

/**
 * Normalisasi video klip ke format prime 1080x1920 60FPS AAC 44.1kHz stereo
 * (Dilengkapi penanganan audio hening serta opsi sensor/blur gameplay untuk video cut kuis)
 */
function normalizeVideo({
  inputPath,
  outputPath,
  assSubtitlePath = null,
  fps = 60,
  censorGameplay = false,
  censorMode = 'pixelate',
  censorY = 1006,
  censorH = 720,
  censorPixelSize = 45,
  censorBlurRadius = 28,
  frozenGameplayImagePath = null,
  speed = 1.0,
  ffmpegBin = 'ffmpeg',
}) {
  const actualSpeed = Math.max(1.0, parseFloat(speed) || 1.0);
  const baseFilter = 'scale=1080:1920:force_original_aspect_ratio=decrease:flags=lanczos,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1';
  const escapedAss = assSubtitlePath ? assSubtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:') : null;
  const assFilter = escapedAss ? `,ass='${escapedAss}'` : '';

  // Filter audio: normal atau dipercepat dengan perubahan nada tinggi / cempreng (asetrate)
  const afFilter = actualSpeed > 1.0
    ? `aformat=sample_rates=44100,asetrate=44100*${actualSpeed},aresample=44100,apad,aresample=async=1:first_pts=0`
    : 'apad,aresample=async=1:first_pts=0';

  // Jika disediakan gameplay beku tersensor (selama play cut.mp4), tumpuk gambar gameplay beku di atas video
  if (censorGameplay && frozenGameplayImagePath && fs.existsSync(frozenGameplayImagePath)) {
    const filterComplex = `[0:v]${baseFilter}[main];[main][1:v]overlay=0:${censorY}:shortest=1${assFilter}[outv]`;
    try {
      execSync(
        `"${ffmpegBin}" -y -i "${inputPath}" -loop 1 -i "${frozenGameplayImagePath}" -filter_complex "${filterComplex}" -map "[outv]" -map 0:a? -af "${afFilter}" -shortest -c:v libx264 -preset fast -crf 16 -profile:v high -level 4.2 -c:a aac -ar 44100 -ac 2 -r ${fps} -fps_mode cfr -video_track_timescale 60000 -movflags +faststart -pix_fmt yuv420p "${outputPath}"`,
        { stdio: 'pipe' }
      );
    } catch (err) {
      // Fallback jika video mentah tidak memiliki stream audio
      execSync(
        `"${ffmpegBin}" -y -i "${inputPath}" -loop 1 -i "${frozenGameplayImagePath}" -f lavfi -i "anullsrc=r=44100:cl=stereo" -filter_complex "${filterComplex}" -map "[outv]" -map 2:a -af "${afFilter}" -shortest -c:v libx264 -preset fast -crf 16 -profile:v high -level 4.2 -c:a aac -ar 44100 -ac 2 -r ${fps} -fps_mode cfr -video_track_timescale 60000 -movflags +faststart -pix_fmt yuv420p "${outputPath}"`,
        { stdio: 'ignore' }
      );
    }
    return;
  }

  let vf = actualSpeed > 1.0 ? `setpts=PTS/${actualSpeed},${baseFilter}` : baseFilter;

  if (censorGameplay) {
    let censorChain = '';
    if (censorMode === 'blur') {
      const radius = Math.max(5, parseInt(censorBlurRadius, 10) || 28);
      censorChain = `boxblur=${radius}:5`;
    } else {
      const px = Math.max(4, parseInt(censorPixelSize, 10) || 45);
      censorChain = `scale=1080/${px}:${censorH}/${px}:flags=neighbor,scale=1080:${censorH}:flags=neighbor`;
    }
    vf = `${baseFilter},split[main][gp];[gp]crop=1080:${censorH}:0:${censorY},${censorChain}[censored];[main][censored]overlay=0:${censorY}`;
    if (actualSpeed > 1.0) {
      vf = `setpts=PTS/${actualSpeed},${vf}`;
    }
  }

  if (assSubtitlePath) {
    vf += assFilter;
  }

  try {
    execSync(
      `"${ffmpegBin}" -y -i "${inputPath}" -vf "${vf}" -af "${afFilter}" -shortest -c:v libx264 -preset fast -crf 16 -profile:v high -level 4.2 -c:a aac -ar 44100 -ac 2 -r ${fps} -fps_mode cfr -video_track_timescale 60000 -movflags +faststart -pix_fmt yuv420p "${outputPath}"`,
      { stdio: 'pipe' }
    );
  } catch (err) {
    // Fallback jika video mentah tidak memiliki stream audio
    execSync(
      `"${ffmpegBin}" -y -i "${inputPath}" -f lavfi -i "anullsrc=r=44100:cl=stereo" -vf "${vf}" -af "${afFilter}" -shortest -c:v libx264 -preset fast -crf 16 -profile:v high -level 4.2 -c:a aac -ar 44100 -ac 2 -r ${fps} -fps_mode cfr -video_track_timescale 60000 -movflags +faststart -pix_fmt yuv420p "${outputPath}"`,
      { stdio: 'ignore' }
    );
  }
}

/**
 * Merender Bagian 1: Video Potongan (cut.mp4) dengan sensor gameplay beku dan layer gelap
 */
function renderCutClip({
  rawCutPath,
  outputPath,
  momentIndex,
  workDir,
  config,
  tempFilesTracker,
}) {
  const { censorGameplay, censorMode, censorY, censorH, censorPixelSize, censorBlurRadius, ffmpegBin } = config;

  let frozenGpPng = null;
  let cutDarkAssPath = null;

  if (censorGameplay) {
    frozenGpPng = `${workDir}/frozen_gp_${momentIndex}.png`;
    tempFilesTracker.push(frozenGpPng);

    let censorChain = '';
    if (censorMode === 'blur') {
      const radius = Math.max(5, parseInt(censorBlurRadius, 10) || 28);
      censorChain = `boxblur=${radius}:5`;
    } else {
      const px = Math.max(4, parseInt(censorPixelSize, 10) || 45);
      censorChain = `scale=1080/${px}:${censorH}/${px}:flags=neighbor,scale=1080:${censorH}:flags=neighbor`;
    }
    const baseFilter = 'scale=1080:1920:force_original_aspect_ratio=decrease:flags=lanczos,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1';

    // Ambil 1 frame gameplay awal, sensor/blurkan, dan jadikan gambar diam sepanjang cut.mp4
    execSync(
      `"${ffmpegBin}" -y -i "${rawCutPath}" -vf "${baseFilter},crop=1080:${censorH}:0:${censorY},${censorChain}" -vframes 1 "${frozenGpPng}"`,
      { stdio: 'ignore' }
    );

    // Subtitle layer gelap murni di atas gameplay beku
    cutDarkAssPath = `${workDir}/cut_dark_${momentIndex}.ass`;
    tempFilesTracker.push(cutDarkAssPath);
    fs.writeFileSync(
      cutDarkAssPath,
      generateDarkOverlayASS({
        gameplayY: censorY,
        gameplayH: censorH,
      }),
      'utf8'
    );
  }

  normalizeVideo({
    inputPath: rawCutPath,
    outputPath,
    assSubtitlePath: cutDarkAssPath,
    censorGameplay,
    censorMode,
    censorY,
    censorH,
    censorPixelSize,
    censorBlurRadius,
    frozenGameplayImagePath: frozenGpPng,
    ffmpegBin,
  });

  return outputPath;
}

/**
 * Merender Bagian 2: Freeze Frame Kuis (Countdown Smooth Bar + Reveal Jawaban Benar)
 */
function renderQuizFreezeClip({
  rawCutPath,
  outputPath,
  moment,
  momentIndex,
  workDir,
  config,
  tempFilesTracker,
}) {
  const {
    censorGameplay,
    censorMode,
    censorY,
    censorH,
    censorPixelSize,
    censorBlurRadius,
    quizTickSeconds,
    quizQuestion,
    quizOffsetY,
    ffmpegBin,
  } = config;

  const totalQuizFrames = Math.max(1, Math.round(4 * quizTickSeconds * 60));
  const totalQuizSec = (totalQuizFrames / 60).toFixed(4);

  const freezeFramePng = `${workDir}/freeze_${momentIndex}.png`;
  tempFilesTracker.push(freezeFramePng);

  let censorChain = '';
  if (censorMode === 'blur') {
    const radius = Math.max(5, parseInt(censorBlurRadius, 10) || 28);
    censorChain = `boxblur=${radius}:5`;
  } else {
    const px = Math.max(4, parseInt(censorPixelSize, 10) || 45);
    censorChain = `scale=1080/${px}:${censorH}/${px}:flags=neighbor,scale=1080:${censorH}:flags=neighbor`;
  }
  const freezeBaseVf = 'scale=1080:1920:force_original_aspect_ratio=decrease:flags=lanczos,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1';
  const freezeVf = censorGameplay
    ? `${freezeBaseVf},split[main][gp];[gp]crop=1080:${censorH}:0:${censorY},${censorChain}[censored];[main][censored]overlay=0:${censorY}`
    : freezeBaseVf;

  execSync(`"${ffmpegBin}" -y -sseof -0.1 -i "${rawCutPath}" -vf "${freezeVf}" -update 1 -q:v 1 "${freezeFramePng}"`, { stdio: 'ignore' });

  const quizAssPath = `${workDir}/quiz_${momentIndex}.ass`;
  tempFilesTracker.push(quizAssPath);
  fs.writeFileSync(
    quizAssPath,
    generateQuizASS({
      question: quizQuestion,
      options: moment.options,
      correctIndex: moment.correctIndex,
      offsetY: quizOffsetY,
      tickDuration: quizTickSeconds,
      totalDuration: parseFloat(totalQuizSec),
      gameplayY: censorY,
      gameplayH: censorH,
    }),
    'utf8'
  );

  const sfxWavPath = `${workDir}/sfx_${momentIndex}.wav`;
  tempFilesTracker.push(sfxWavPath);
  generateQuizSoundWav(sfxWavPath, quizTickSeconds, parseFloat(totalQuizSec));

  const escapedQuizAss = quizAssPath.replace(/\\/g, '/').replace(/:/g, '\\:');
  execSync(
    `"${ffmpegBin}" -y -framerate 60 -loop 1 -i "${freezeFramePng}" -i "${sfxWavPath}" -vf "scale=1080:1920:force_original_aspect_ratio=decrease:flags=lanczos,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,ass='${escapedQuizAss}'" -af "apad,aresample=async=1:first_pts=0" -t ${totalQuizSec} -vframes ${totalQuizFrames} -shortest -c:v libx264 -preset fast -crf 16 -profile:v high -level 4.2 -c:a aac -ar 44100 -ac 2 -r 60 -fps_mode cfr -video_track_timescale 60000 -movflags +faststart -pix_fmt yuv420p "${outputPath}"`,
    { stdio: 'ignore' }
  );

  return outputPath;
}

/**
 * Merender Bagian 3: Video Full Meme dengan overlay teks dan akselerasi kecepatan / audio cempreng
 */
function renderFullMemeClip({
  rawFullPath,
  outputPath,
  moment,
  momentIndex,
  workDir,
  config,
  tempFilesTracker,
}) {
  const { isFullVideoAutoSpeed, fullVideoSpeed, fullVideoMaxDuration, memeTextY, ffmpegBin } = config;

  let clipSpeed = fullVideoSpeed;
  if (isFullVideoAutoSpeed) {
    const rawDur = getAudioDuration(rawFullPath, ffmpegBin);
    if (rawDur > fullVideoMaxDuration) {
      clipSpeed = Math.round((rawDur / fullVideoMaxDuration) * 100) / 100;
      console.log(`   3. Merender video full meme ("${moment.fullVideoDisplayText}") [Durasi: ${rawDur.toFixed(2)}s > ${fullVideoMaxDuration}s -> Auto Speed: ${clipSpeed}x, Target: ~${fullVideoMaxDuration}s, Audio Cempreng]...`);
    } else {
      clipSpeed = 1.0;
      console.log(`   3. Merender video full meme ("${moment.fullVideoDisplayText}") [Durasi: ${rawDur.toFixed(2)}s <= ${fullVideoMaxDuration}s -> Kecepatan normal 1.0x]...`);
    }
  } else {
    console.log(`   3. Merender video full meme ("${moment.fullVideoDisplayText}")${clipSpeed > 1.0 ? ` (Kecepatan: ${clipSpeed}x, Audio Cempreng)` : ''}...`);
  }

  const memeAssPath = `${workDir}/meme_${momentIndex}.ass`;
  tempFilesTracker.push(memeAssPath);
  fs.writeFileSync(
    memeAssPath,
    generateFullVideoASS({
      text: moment.fullVideoDisplayText,
      durationSeconds: 600,
      posY: memeTextY,
    }),
    'utf8'
  );

  normalizeVideo({
    inputPath: rawFullPath,
    outputPath,
    assSubtitlePath: memeAssPath,
    speed: clipSpeed,
    ffmpegBin,
  });

  return outputPath;
}

module.exports = {
  getAudioDuration,
  normalizeVideo,
  renderCutClip,
  renderQuizFreezeClip,
  renderFullMemeClip,
};
