const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { downloadMomentVideos } = require('./downloader');
const {
  renderCutClip,
  renderQuizFreezeClip,
  renderFullMemeClip,
} = require('./videoEditor');
const { renderTransitionClip } = require('./transition');

/**
 * Memproses 1 momen kuis secara utuh:
 * - Mengunduh berkas video mentah (cut & full) serta gambar meme facecam (opsional)
 * - Merender Bagian 1: Cut clip (dengan sensor gameplay beku & dark overlay)
 * - Merender Bagian 2: Freeze frame kuis (smooth progress bar & reveal jawaban)
 * - Merender Bagian 3: Full meme video (overlay teks 1 baris & audio cempreng/speed)
 * - Merender/menyisipkan klip transisi (mode 'meme' 1:1, 'number', atau 'off')
 *
 * Mengembalikan array daftar jalur berkas klip hasil render untuk digabungkan.
 */
async function processSingleMoment({
  drive,
  moment,
  momentIndex,
  totalMoments,
  config,
  workDir,
  transitionClipPath = null,
  transitionSfxPath = null,
  downloadedFiles = null,
  isPrefetched = false,
}) {
  const momentTempFiles = [];
  const cleanupMomentTempFiles = () => {
    for (const p of momentTempFiles) {
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch (_) {}
    }
  };

  try {
    // 1. Mengunduh video potongan (cut.mp4), video full, serta gambar meme facecam (jika ada)
    let rawCutPath;
    let rawFullPath;
    let rawMemeImgPath;

    if (downloadedFiles) {
      if (isPrefetched) {
        console.log(`   ⚡ [PREFETCH] Berkas video Momen #${momentIndex} sudah siap diunduh di background sebelumnya.`);
      }
      rawCutPath = downloadedFiles.rawCutPath;
      rawFullPath = downloadedFiles.rawFullPath;
      rawMemeImgPath = downloadedFiles.rawMemeImgPath;
    } else {
      const memeNote = moment.memeImageFile ? ' + Gambar Meme 1:1' : '';
      console.log(`   1. Mengunduh dan menormalisasi berkas video${memeNote}${config.censorGameplay ? ` (Sensor Gameplay Beku: ${config.censorMode})` : ''}...`);
      const dl = await downloadMomentVideos(
        drive,
        moment,
        workDir,
        momentIndex,
        config.skipPrefix
      );
      rawCutPath = dl.rawCutPath;
      rawFullPath = dl.rawFullPath;
      rawMemeImgPath = dl.rawMemeImgPath;
    }

    momentTempFiles.push(rawCutPath, rawFullPath);
    if (rawMemeImgPath) momentTempFiles.push(rawMemeImgPath);

    // 2. Merender Bagian 1: Video Cut
    const normCutPath = path.join(workDir, `norm_cut_${momentIndex}.mp4`);
    momentTempFiles.push(normCutPath);
    renderCutClip({
      rawCutPath,
      outputPath: normCutPath,
      momentIndex,
      workDir,
      config,
      tempFilesTracker: momentTempFiles,
    });

    // 3. Merender Bagian 2: Freeze Frame Kuis
    console.log(`   2. Mengekstrak frame terakhir & membuat freeze kuis (${(4 * config.quizTickSeconds).toFixed(2)}s, tick: ${config.quizTickSeconds}s)...`);
    const freezeVideoPath = path.join(workDir, `freeze_vid_${momentIndex}.mp4`);
    momentTempFiles.push(freezeVideoPath);
    renderQuizFreezeClip({
      rawCutPath,
      outputPath: freezeVideoPath,
      moment,
      momentIndex,
      workDir,
      config,
      tempFilesTracker: momentTempFiles,
    });

    // 4. Merender Bagian 3: Video Full Meme
    const normFullPath = path.join(workDir, `norm_full_${momentIndex}.mp4`);
    momentTempFiles.push(normFullPath);
    renderFullMemeClip({
      rawFullPath,
      outputPath: normFullPath,
      moment,
      momentIndex,
      workDir,
      config,
      tempFilesTracker: momentTempFiles,
    });

    // 5. Menyiapkan klip transisi (TikTok Core: meme 1:1 / number / off)
    let finalTransitionPath = transitionClipPath;
    if (!finalTransitionPath && transitionSfxPath) {
      finalTransitionPath = renderTransitionClip({
        transitionSfxPath,
        momentIndex,
        totalMoments,
        transitionMode: config.transitionMode,
        memeImagePath: rawMemeImgPath,
        transitionFontSize: config.transitionFontSize,
        workDir,
        ffmpegBin: config.ffmpegBin,
      });
      if (finalTransitionPath) {
        momentTempFiles.push(finalTransitionPath);
      }
    }

    // Bersihkan berkas video mentah (raw cut, raw full, raw meme) setelah selesai di-render
    // untuk menghemat ruang disk sementara selagi background download berjalan
    try {
      if (fs.existsSync(rawCutPath)) fs.unlinkSync(rawCutPath);
      if (fs.existsSync(rawFullPath)) fs.unlinkSync(rawFullPath);
      if (rawMemeImgPath && fs.existsSync(rawMemeImgPath)) fs.unlinkSync(rawMemeImgPath);
    } catch (_) {}

    // 6. Susun klip-klip momen
    const momentClips = [normCutPath, freezeVideoPath, normFullPath];
    if (finalTransitionPath) {
      momentClips.push(finalTransitionPath);
    }

    console.log(`   ✅ Seluruh bagian momen #${momentIndex} siap dirangkai.`);
    return momentClips;
  } catch (err) {
    console.warn(`   ⚠️ [ERROR MOMEN #${momentIndex}] Gagal memproses momen "${moment.momentName}": ${err.message}`);
    cleanupMomentTempFiles();
    return [];
  }
}

/**
 * Menggabungkan seluruh rangkaian klip video menjadi 1 video kompilasi utuh
 * menggunakan metode single-pass concat copy (menjamin 60 FPS CFR murni tanpa gap audio/video)
 */
function concatenateCompilation(allCompilationClips, workDir, outputDir, ffmpegBin = 'ffmpeg') {
  console.log('\n[TAHAP 4/4] Menggabungkan seluruh rangkaian klip menjadi 1 video kompilasi utuh (Single-Pass 60 FPS)...');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const finalOutputPath = path.join(outputDir, `kompilasi_tebak_doksli_${timestamp}.mp4`);

  const mainConcatList = path.join(workDir, 'final_concat_list.txt');
  fs.writeFileSync(
    mainConcatList,
    allCompilationClips.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n') + '\n',
    'utf8'
  );

  execSync(
    `"${ffmpegBin}" -y -f concat -safe 0 -i "${mainConcatList}" -c copy -video_track_timescale 60000 -movflags +faststart "${finalOutputPath}"`,
    { stdio: 'ignore' }
  );

  // Bersihkan temporary work directory
  console.log('\n[BERSIH-BERSIH] Menghapus cache temporary video mentah...');
  try {
    fs.rmSync(workDir, { recursive: true, force: true });
  } catch (e) {}

  console.log('\n================================================================');
  console.log('🎉 KOMPILASI TEBAK-TEBAKAN DOKSLI BERHASIL DIBUAT!');
  console.log(`📁 Lokasi Video Final : ${finalOutputPath}`);
  console.log('================================================================\n');

  return finalOutputPath;
}

/**
 * Mengunggah berkas video kompilasi final ke Google Drive
 */
async function uploadCompilationToDrive(drive, finalOutputPath, resultFolderId) {
  console.log('[TAHAP 5/5] Mengunggah video kompilasi ke Google Drive...');
  console.log(` - Target Folder ID : ${resultFolderId}`);

  try {
    const uploadFileName = path.basename(finalOutputPath);
    const fileMetadata = {
      name: uploadFileName,
      parents: [resultFolderId],
    };
    const media = {
      mimeType: 'video/mp4',
      body: fs.createReadStream(finalOutputPath),
    };

    const uploadRes = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: 'id, name, webViewLink',
      supportsAllDrives: true,
    });

    console.log(`✅ Berhasil mengunggah video ke Google Drive!`);
    console.log(` - File ID     : ${uploadRes.data.id}`);
    if (uploadRes.data.webViewLink) {
      console.log(` - Link GDrive : ${uploadRes.data.webViewLink}`);
    }

    // Hapus file video lokal setelah sukses upload
    console.log(`\n[CLEANUP] Menghapus video lokal setelah sukses diunggah ke Google Drive...`);
    fs.unlinkSync(finalOutputPath);
    console.log(`✅ File video lokal berhasil dihapus (${uploadFileName}).`);
    return uploadRes.data;
  } catch (uploadErr) {
    console.error(`❌ Gagal mengunggah video ke Google Drive:`, uploadErr.message);
    console.log(`ℹ️ File video lokal tetap aman tersimpan di: ${finalOutputPath}`);
    return null;
  }
}

module.exports = {
  processSingleMoment,
  concatenateCompilation,
  uploadCompilationToDrive,
};
