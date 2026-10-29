/**
 * Helper shuffle array secara acak (Fisher-Yates)
 */
function shuffleArray(arr) {
  const list = [...arr];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/**
 * Membersihkan teks untuk overlay: menghapus ekstensi berkas, newline/enter, dan normalisasi spasi
 */
function cleanText(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/\.[a-zA-Z0-9]+$/i, '')
    .replace(/\\n/gi, ' ')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Memeriksa apakah nama folder atau file memiliki kode awalan 'skip'
 * (Default kode: tanda seru '!' seperti '!Minecraft', '!eps 1', '!cut.mp4',
 * ']]' atau tag kurung '[skip]' / '[x]', serta dapat dikonfigurasi via SKIP_PREFIX)
 */
function isSkippedItem(name, customPrefix = null) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  const prefix = (customPrefix || process.env.SKIP_PREFIX || '!').trim();
  if (prefix && trimmed.startsWith(prefix)) return true;
  return /^(!|\[skip\]|\[x\]|\]\])/i.test(trimmed);
}

/**
 * Bank Opsi Pengecoh Cadangan Statis (Digunakan jika subfolder di Google Drive kurang dari 4)
 */
const STATIC_FALLBACK_DISTRACTORS = [
  'Minecraft',
  'Resident Evil 4',
  'GTA San Andreas',
  'Grand Theft Auto V',
  'Only Up!',
  'Mobile Legends',
  'Roblox',
  'Subway Surfers',
  'Stumble Guys',
  'God of War',
  'Outlast',
  'Elden Ring',
  'Clash of Clans',
  'Cat Mario',
  'Getting Over It',
  'Silent Hill',
  'DreadOut',
  'Valorant',
  'The Last of Us',
  'Dark Souls',
];

/**
 * Helper menghasilkan 4 opsi pilihan ganda unik (1 jawaban benar + 3 pengecoh).
 * Menggunakan Set dan validasi case-insensitive sehingga DIJAMIN 100% TIDAK AKAN PERNAH DUPLIKAT.
 */
function createUniqueQuizOptions(correctAnswer, folderPool = []) {
  const correctClean = correctAnswer.trim();
  const selectedSet = new Set([correctClean]);

  // 1. Ambil kandidat dari subfolder Google Drive lain jika ada
  const candidatesFromDrive = shuffleArray(
    folderPool
      .map((f) => (typeof f === 'string' ? f : f.name || '').trim())
      .filter((name) => name && name.toLowerCase() !== correctClean.toLowerCase())
  );

  for (const name of candidatesFromDrive) {
    if (selectedSet.size >= 4) break;
    const alreadyExists = Array.from(selectedSet).some(
      (existing) => existing.toLowerCase() === name.toLowerCase()
    );
    if (!alreadyExists) {
      selectedSet.add(name);
    }
  }

  // 2. Jika opsi belum mencapai 4, lengkapi dari bank statis
  if (selectedSet.size < 4) {
    const candidatesFromStatic = shuffleArray(
      STATIC_FALLBACK_DISTRACTORS.filter(
        (name) => !Array.from(selectedSet).some((existing) => existing.toLowerCase() === name.toLowerCase())
      )
    );

    for (const name of candidatesFromStatic) {
      if (selectedSet.size >= 4) break;
      selectedSet.add(name);
    }
  }

  // Acak urutan 4 opsi
  const shuffledOptions = shuffleArray(Array.from(selectedSet));
  const correctIndex = shuffledOptions.indexOf(correctClean);

  return {
    options: shuffledOptions,
    correctIndex,
  };
}

/**
 * Helper memeriksa apakah daftar berkas memiliki pasangan video valid:
 * tepat 2 video, satu bernama 'cut' (misal cut.mp4), dan satu video full.
 */
function findVideoPair(files, skipPrefix) {
  const vidFiles = files.filter((f) => {
    const isVid =
      (f.mimeType && f.mimeType.startsWith('video/')) ||
      /\.(mp4|mkv|mov|webm)$/i.test(f.name);
    if (!isVid) return false;
    if (isSkippedItem(f.name, skipPrefix)) return false;
    return true;
  });

  if (vidFiles.length === 2) {
    const cutFile = vidFiles.find((f) => {
      const base = f.name.toLowerCase().replace(/\.[^.]+$/, '');
      return base === 'cut';
    });
    const fullFile = vidFiles.find((f) => f.id !== cutFile?.id);
    if (cutFile && fullFile) {
      return { cutFile, fullFile };
    }
  }
  return null;
}

/**
 * Memilih secara acak momen kuis dari Google Drive berdasarkan konfigurasi:
 * - Mengambil folder Game (Layer 1)
 * - Memilih episode (Layer 2)
 * - Jika episode memiliki subfolder klip (Layer 3, misal folder "-"), memilih satu klip secara acak
 * - Memvalidasi ketersediaan tepat 2 video (cut.mp4 dan full video)
 * - Menghasilkan 4 opsi kuis unik
 * - Membentuk teks overlay full video dengan mengabaikan tanda "-"
 */
async function selectQuizMoments(drive, config) {
  const { doksliFolderId, clipCountTarget, skipPrefix } = config;

  console.log('[TAHAP 1/4] Mengambil daftar folder game di Google Drive...');
  const res = await drive.files.list({
    q: `'${doksliFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    spaces: 'drive',
    pageSize: 500,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const rawGameFolders = res.data.files || [];
  const allGameFolders = rawGameFolders.filter((f) => {
    if (isSkippedItem(f.name, skipPrefix)) {
      console.log(` ⏭️ [SKIP] Folder game "${f.name}" dilewati (diawali kode skip "${skipPrefix}").`);
      return false;
    }
    return true;
  });

  if (allGameFolders.length === 0) {
    console.error('❌ Tidak ada folder game di folder Google Drive yang ditentukan.');
    process.exit(1);
  }

  console.log(`📁 Ditemukan ${allGameFolders.length} folder game valid di Google Drive.`);

  // Simpan nama semua folder game untuk pool pengecoh kuis
  const allGameNamesPool = allGameFolders.map((f) => f.name.trim());

  // 4. Acak dan seleksi game unik
  console.log(`\n[TAHAP 2/4] Mengacak dan menyeleksi ${clipCountTarget} momen kuis dari episode game...`);
  const shuffledGameFolders = shuffleArray(allGameFolders);

  const validMoments = [];
  const selectedGameNames = new Set();

  for (const gameFolder of shuffledGameFolders) {
    if (validMoments.length >= clipCountTarget) break;

    const gameName = gameFolder.name.trim();

    // Pencegah duplikat game: pastikan game belum pernah terpilih
    const isDuplicateGame = Array.from(selectedGameNames).some(
      (selected) => selected.toLowerCase() === gameName.toLowerCase()
    );
    if (isDuplicateGame) {
      console.log(` ⚠️ Game "${gameName}" dilewati (game ini sudah terpilih di kompilasi ini).`);
      continue;
    }

    // Ambil daftar item di dalam folder game (mencari subfolder episode atau berkas langsung)
    const childrenRes = await drive.files.list({
      q: `'${gameFolder.id}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType)',
      spaces: 'drive',
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const children = childrenRes.data.files || [];
    const allEpsFolders = children.filter((c) => c.mimeType === 'application/vnd.google-apps.folder');
    const epsFolders = allEpsFolders.filter((c) => {
      if (isSkippedItem(c.name, skipPrefix)) {
        console.log(`   ⏭️ [SKIP] Subfolder episode "${c.name}" pada game "${gameName}" dilewati (diawali kode skip).`);
        return false;
      }
      return true;
    });

    let chosenEps = null;

    if (epsFolders.length > 0) {
      // Acak urutan episode agar pilihan klip bervariasi jika game memiliki banyak episode
      const shuffledEps = shuffleArray(epsFolders);

      for (const epsFolder of shuffledEps) {
        // Ambil isi di dalam subfolder episode (dapat berupa berkas video langsung atau subfolder klip lapis ke-3)
        const epsChildrenRes = await drive.files.list({
          q: `'${epsFolder.id}' in parents and trashed = false`,
          fields: 'files(id, name, size, mimeType)',
          spaces: 'drive',
          pageSize: 100,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });

        const epsItems = epsChildrenRes.data.files || [];

        // 1. Cek apakah di dalam folder episode sudah ada langsung 2 berkas video (cut.mp4 & full video)
        const directPair = findVideoPair(epsItems, skipPrefix);
        if (directPair) {
          chosenEps = {
            epsName: epsFolder.name.trim(),
            clipFolderName: null,
            cutFile: directPair.cutFile,
            fullFile: directPair.fullFile,
          };
          break;
        }

        // 2. Jika tidak ada 2 video langsung, periksa apakah terdapat subfolder klip lapis ke-3 (misal: folder-folder "-")
        const layer3SubFolders = epsItems.filter(
          (f) => f.mimeType === 'application/vnd.google-apps.folder' && !isSkippedItem(f.name, skipPrefix)
        );

        if (layer3SubFolders.length > 0) {
          // Acak urutan folder klip lapis ke-3 agar klip terpilih secara acak jika dalam 1 episode terdapat banyak klip
          const shuffledL3 = shuffleArray(layer3SubFolders);

          for (const l3Folder of shuffledL3) {
            const l3Res = await drive.files.list({
              q: `'${l3Folder.id}' in parents and trashed = false`,
              fields: 'files(id, name, size, mimeType)',
              spaces: 'drive',
              pageSize: 20,
              supportsAllDrives: true,
              includeItemsFromAllDrives: true,
            });

            const l3Items = l3Res.data.files || [];
            const l3Pair = findVideoPair(l3Items, skipPrefix);
            if (l3Pair) {
              chosenEps = {
                epsName: epsFolder.name.trim(),
                clipFolderName: l3Folder.name.trim(),
                cutFile: l3Pair.cutFile,
                fullFile: l3Pair.fullFile,
              };
              break;
            }
          }

          if (chosenEps) {
            break;
          }
        }
      }
    } else {
      // Fallback kompatibilitas: jika video diletakkan langsung di dalam folder game
      const directPair = findVideoPair(children, skipPrefix);
      if (directPair) {
        chosenEps = {
          epsName: '',
          clipFolderName: null,
          cutFile: directPair.cutFile,
          fullFile: directPair.fullFile,
        };
      }
    }

    if (!chosenEps) {
      console.log(` ⚠️ Game "${gameName}" dilewati (tidak ada subfolder episode valid yang memiliki cut.mp4 dan video full).`);
      continue;
    }

    // Siapkan pilihan ganda kuis berbasis Game (100% unik tanpa duplikat via Set & fallback statis)
    const { options, correctIndex } = createUniqueQuizOptions(gameName, allGameNamesPool);

    // Format display text untuk overlay full video: "nama folder eps x + nama file full vid", 1 baris ketat tanpa \n
    // Jika nama subfolder episode hanya tanda "-" (artinya game langsung tamat dalam 1 stream tanpa pembagian episode),
    // maka tanda "-" tersebut diabaikan dan tidak dimasukkan ke dalam teks overlay.
    // Begitu juga subfolder klip lapis ke-3 (misal folder "-"), tanda "-" tidak pernah dimasukkan ke overlay.
    const rawCleanEps = chosenEps.epsName ? cleanText(chosenEps.epsName) : '';
    const isSingleStreamNoEps = !rawCleanEps || rawCleanEps === '-' || /^[-—–_]+$/.test(rawCleanEps);
    const cleanEps = isSingleStreamNoEps ? '' : rawCleanEps;
    const cleanFull = cleanText(chosenEps.fullFile.name);
    const fullVideoDisplayText = cleanEps ? `${cleanEps} ${cleanFull}`.trim() : cleanFull;

    validMoments.push({
      folderId: gameFolder.id,
      momentName: gameName,
      gameName,
      epsName: chosenEps.epsName,
      clipFolderName: chosenEps.clipFolderName || null,
      cutFile: chosenEps.cutFile,
      fullFile: chosenEps.fullFile,
      fullVideoDisplayText,
      options,
      correctIndex,
    });
    selectedGameNames.add(gameName);

    const letter = ['A', 'B', 'C', 'D'][correctIndex];
    console.log(` ✅ Terpilih #${validMoments.length}: Game "${gameName}"`);
    const l3Log = chosenEps.clipFolderName ? ` [Klip: "${chosenEps.clipFolderName}"]` : '';
    if (chosenEps.epsName && !isSingleStreamNoEps) {
      console.log(`    - Episode    : ${chosenEps.epsName}${l3Log}`);
    } else if (chosenEps.epsName) {
      console.log(`    - Episode    : ${chosenEps.epsName} (Tamat 1 stream, tidak dimasukkan ke overlay)${l3Log}`);
    }
    console.log(`    - Cut Video  : ${chosenEps.cutFile.name}`);
    console.log(`    - Full Video : ${chosenEps.fullFile.name}`);
    console.log(`    - Overlay    : "${fullVideoDisplayText}" (1 baris)`);
    console.log(`    - Kunci Kuis : [${letter}]`);
  }

  if (validMoments.length === 0) {
    console.error('❌ Tidak ada folder game/momen yang memenuhi syarat (harus berisi subfolder episode dengan cut.mp4 & video full).');
    process.exit(1);
  }

  console.log(`\n🎉 Berhasil mengumpulkan ${validMoments.length} game unik untuk kompilasi!`);
  if (validMoments.length < clipCountTarget) {
    console.log(`ℹ️ [INFO] Target diminta ${clipCountTarget} klip, namun game unik yang valid dan tersedia hanya ${validMoments.length} game.`);
  }

  return validMoments;
}

module.exports = {
  shuffleArray,
  cleanText,
  isSkippedItem,
  STATIC_FALLBACK_DISTRACTORS,
  createUniqueQuizOptions,
  findVideoPair,
  selectQuizMoments,
};
