const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { isSkippedItem } = require('./selector');

/**
 * Mengunduh berkas tunggal dari Google Drive ke jalur lokal
 */
async function downloadDriveFile(drive, fileId, destPath) {
  const stream = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' }
  );
  await pipeline(stream.data, fs.createWriteStream(destPath));
  return destPath;
}

/**
 * Mengunduh berkas video (cut.mp4 dan video full) serta gambar meme opsional
 * untuk suatu momen tertentu, disertai pengecekan runtime terhadap kode awalan skip.
 */
async function downloadMomentVideos(drive, moment, workDir, momentIndex, skipPrefix = '!') {
  // 1. Pengecekan sebelum download
  if (isSkippedItem(moment.cutFile?.name, skipPrefix) || isSkippedItem(moment.fullFile?.name, skipPrefix)) {
    throw new Error(`Berkas video pada momen "${moment.momentName}" memiliki kode skip ("${moment.cutFile?.name}" / "${moment.fullFile?.name}").`);
  }

  let rawFullPath = null;
  let rawSpeedupPath = null;

  // Jika speedup.mp4 sudah ada di folder klip, unduh speedup.mp4 langsung (lebih hemat bandwidth & render)
  if (moment.speedupFile && !isSkippedItem(moment.speedupFile.name, skipPrefix)) {
    rawSpeedupPath = `${workDir}/raw_speedup_${momentIndex}.mp4`;
    await downloadDriveFile(drive, moment.speedupFile.id, rawSpeedupPath);
    if (isSkippedItem(moment.speedupFile?.name, skipPrefix)) {
      throw new Error(`Berkas speedup.mp4 ("${moment.speedupFile.name}") memiliki kode skip.`);
    }
  } else if (moment.fullFile) {
    // Unduh full video mentah biasa
    rawFullPath = `${workDir}/raw_full_${momentIndex}.mp4`;
    await downloadDriveFile(drive, moment.fullFile.id, rawFullPath);
    if (isSkippedItem(moment.fullFile?.name, skipPrefix)) {
      throw new Error(`Berkas full video ("${moment.fullFile.name}") memiliki kode skip.`);
    }
  }

  // Unduh meme facecam image jika ada (opsional)
  let rawMemeImgPath = null;
  if (moment.memeImageFile && moment.memeImageFile.id) {
    if (!isSkippedItem(moment.memeImageFile.name, skipPrefix)) {
      const ext = path.extname(moment.memeImageFile.name) || '.png';
      rawMemeImgPath = `${workDir}/raw_meme_${momentIndex}${ext}`;
      try {
        await downloadDriveFile(drive, moment.memeImageFile.id, rawMemeImgPath);
      } catch (e) {
        console.warn(`   ⚠️ Gagal mengunduh meme facecam ("${moment.memeImageFile.name}"): ${e.message}`);
        rawMemeImgPath = null;
      }
    }
  }

  return {
    rawCutPath,
    rawFullPath: rawFullPath || rawSpeedupPath,
    rawSpeedupPath,
    isAlreadySpeedup: !!rawSpeedupPath,
    rawMemeImgPath,
  };
}

module.exports = {
  downloadDriveFile,
  downloadMomentVideos,
};
