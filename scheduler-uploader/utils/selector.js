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
 * Helper mencari berkas gambar meme (.png, .jpg, .jpeg, .webp) dalam daftar berkas.
 * Gambar ini bersifat opsional (jika tidak ada, mengembalikan null dan BUKAN dianggap skip).
 */
function findMemeImage(files, skipPrefix) {
  if (!files || !Array.isArray(files)) return null;
  return (
    files.find((f) => {
      const isImg =
        (f.mimeType && f.mimeType.startsWith('image/')) ||
        /\.(png|jpe?g|webp)$/i.test(f.name);
      if (!isImg) return false;
      if (isSkippedItem(f.name, skipPrefix)) return false;
      return true;
    }) || null
  );
}

/**
 * Menghasilkan teks overlay satu baris untuk video full meme:
 * Menggabungkan nama episode dan nama berkas video full, dengan mengabaikan tanda '-'
 * pada game single-stream/non-episode maupun subfolder klip lapis ke-3.
 */
function getFullVideoDisplayText(epsName, fullFileName) {
  const rawCleanEps = epsName ? cleanText(epsName) : '';
  const isSingleStreamNoEps = !rawCleanEps || rawCleanEps === '-' || /^[-—–_]+$/.test(rawCleanEps);
  const cleanEps = isSingleStreamNoEps ? '' : rawCleanEps;
  const cleanFull = cleanText(fullFileName);
  return cleanEps ? `${cleanEps} ${cleanFull}`.trim() : cleanFull;
}

/**
 * Mencari satu pasangan klip video yang valid dan belum terpakai di dalam sebuah folder game.
 * Menggunakan cache agar pencarian episode/klip berikutnya untuk game yang sama tidak mengulang query API.
 * Menegakkan aturan keunikan:
 * 1. Pasangan file video (cutFile.id + fullFile.id) belum pernah dipakai.
 * 2. Teks overlay video full (fullVideoDisplayText) untuk game ini belum pernah dipakai.
 *    (Episode boleh sama asalkan teks overlay full video berbeda).
 */
async function findGameMomentPair(drive, gameFolder, skipPrefix, usedPairKeys, usedOverlayKeys, gameClipsCache) {
  let cache = gameClipsCache.get(gameFolder.id);

  if (!cache) {
    const childrenRes = await drive.files.list({
      q: `'${gameFolder.id}' in parents and trashed = false`,
      fields: 'files(id, name, size, mimeType)',
      spaces: 'drive',
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const children = childrenRes.data.files || [];
    const allEpsFolders = children.filter((c) => c.mimeType === 'application/vnd.google-apps.folder');
    const validEpsFolders = allEpsFolders.filter((c) => !isSkippedItem(c.name, skipPrefix));

    cache = {
      children,
      epsFolders: shuffleArray(validEpsFolders),
      discoveredPairs: [],
      directChecked: false,
    };

    // Fallback: Jika tidak ada subfolder episode, periksa apakah ada 2 video langsung di folder game
    if (validEpsFolders.length === 0) {
      const directPair = findVideoPair(children, skipPrefix);
      if (directPair) {
        cache.discoveredPairs.push({
          epsName: '',
          clipFolderName: null,
          cutFile: directPair.cutFile,
          fullFile: directPair.fullFile,
          memeImageFile: findMemeImage(children, skipPrefix),
        });
      }
      cache.directChecked = true;
    }

    gameClipsCache.set(gameFolder.id, cache);
  }

  const gameKey = gameFolder.name.trim().toLowerCase();

  // 1. Cek apakah ada pasangan yang belum dipakai dari yang sudah pernah ditemukan:
  // - ID file pasangan video (cut + full) belum pernah dipakai
  // - Teks overlay fullvid untuk game ini belum pernah dipakai (teks overlay tidak boleh sama dalam 1 game, meski eps sama)
  const getUnused = () => {
    return cache.discoveredPairs.find((p) => {
      const fileKey = `${p.cutFile.id}_${p.fullFile.id}`;
      if (usedPairKeys && usedPairKeys.has(fileKey)) return false;

      const overlayText = getFullVideoDisplayText(p.epsName, p.fullFile.name);
      const gameOverlayKey = `${gameKey}:::${overlayText.toLowerCase()}`;
      if (usedOverlayKeys && usedOverlayKeys.has(gameOverlayKey)) return false;

      return true;
    });
  };

  let unusedPair = getUnused();
  if (unusedPair) return unusedPair;

  // 2. Jika belum ada, scan sisa subfolder episode secara bertahap
  while (cache.epsFolders.length > 0 && !unusedPair) {
    const epsFolder = cache.epsFolders.pop();

    const epsChildrenRes = await drive.files.list({
      q: `'${epsFolder.id}' in parents and trashed = false`,
      fields: 'files(id, name, size, mimeType)',
      spaces: 'drive',
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const epsItems = epsChildrenRes.data.files || [];

    // Cek direct pair di folder episode
    const directPair = findVideoPair(epsItems, skipPrefix);
    if (directPair) {
      cache.discoveredPairs.push({
        epsName: epsFolder.name.trim(),
        clipFolderName: null,
        cutFile: directPair.cutFile,
        fullFile: directPair.fullFile,
        memeImageFile: findMemeImage(epsItems, skipPrefix),
      });
    }

    // Cek subfolder klip lapis ke-3 (misal folder "-")
    const layer3SubFolders = epsItems.filter(
      (f) => f.mimeType === 'application/vnd.google-apps.folder' && !isSkippedItem(f.name, skipPrefix)
    );

    if (layer3SubFolders.length > 0) {
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
          cache.discoveredPairs.push({
            epsName: epsFolder.name.trim(),
            clipFolderName: l3Folder.name.trim(),
            cutFile: l3Pair.cutFile,
            fullFile: l3Pair.fullFile,
            memeImageFile: findMemeImage(l3Items, skipPrefix) || findMemeImage(epsItems, skipPrefix),
          });
        }
      }
    }

    unusedPair = getUnused();
  }

  return unusedPair || null;
}

/**
 * Memilih secara acak momen kuis dari Google Drive berdasarkan konfigurasi:
 * - Mengambil folder Game (Layer 1)
 * - Tingkat keunikan game dikontrol oleh `gameUniqueWindow` (default: 5)
 *   Jika window = 5: dalam 5 klip berturut-turut dijamin tidak ada duplikat game.
 *   Jika window = 1: bebas duplikat (game yang sama boleh muncul berturut-turut dengan klip berbeda).
 * - Pemilihan benar-benar adil (Uniform Random di tingkat Game), sehingga Game dengan 100 klip
 *   tidak memiliki peluang lebih besar daripada Game dengan 5 klip.
 * - Memvalidasi ketersediaan tepat 2 video (cut.mp4 dan full video)
 * - Mendeteksi gambar meme 1:1 opsional (facecam) jika ada
 * - Menghasilkan 4 opsi kuis unik
 * - Membentuk teks overlay full video dengan mengabaikan tanda "-"
 */
async function selectQuizMoments(drive, config) {
  const { doksliFolderId, clipCountTarget, skipPrefix } = config;
  const gameUniqueWindow = Math.max(1, config.gameUniqueWindow || 5);

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

  let uniquenessLog = `${gameUniqueWindow} klip berturut-turut`;
  if (gameUniqueWindow <= 1) {
    uniquenessLog = '1 (Bebas duplikat, game boleh berulang berturut-turut)';
  } else if (gameUniqueWindow >= clipCountTarget) {
    uniquenessLog = `${gameUniqueWindow} klip (Semua momen dijamin game unik)`;
  }

  console.log(`\n[TAHAP 2/4] Mengacak dan menyeleksi ${clipCountTarget} momen kuis (Jarak Keunikan Game: ${uniquenessLog})...`);

  const validMoments = [];
  const usedPairKeys = new Set();
  const usedOverlayKeys = new Set();
  const gameClipsCache = new Map();

  // Loop terus sampai target klip terpenuhi atau seluruh klip di GDrive habis
  while (validMoments.length < clipCountTarget) {
    // 1. Tentukan game mana yang sedang dalam cooldown window
    const cooldownGames = new Set();
    if (gameUniqueWindow > 1) {
      const windowSlice = validMoments.slice(-(gameUniqueWindow - 1));
      for (const m of windowSlice) {
        cooldownGames.add(m.gameName.toLowerCase());
      }
    }

    // 2. Filter game yang memenuhi syarat (tidak sedang cooldown)
    let eligibleGames = allGameFolders.filter(
      (g) => !cooldownGames.has(g.name.trim().toLowerCase())
    );

    // Failsafe: Jika semua game sedang cooldown (misal jumlah total game < window)
    if (eligibleGames.length === 0) {
      eligibleGames = [...allGameFolders];
      if (validMoments.length > 0 && allGameFolders.length > 1) {
        const lastGame = validMoments[validMoments.length - 1].gameName.toLowerCase();
        eligibleGames = eligibleGames.filter((g) => g.name.trim().toLowerCase() !== lastGame);
      }
    }

    // 3. Acak game kandidat secara setara (UNIFORM RANDOM per Game)
    // Setiap folder game memiliki peluang terpilih yang persis sama, terlepas dari berapa banyak klip di dalamnya
    const candidateGames = shuffleArray(eligibleGames);

    let chosenMomentData = null;

    for (const gameFolder of candidateGames) {
      const gameName = gameFolder.name.trim();
      const pair = await findGameMomentPair(
        drive,
        gameFolder,
        skipPrefix,
        usedPairKeys,
        usedOverlayKeys,
        gameClipsCache
      );

      if (pair) {
        const pairKey = `${pair.cutFile.id}_${pair.fullFile.id}`;
        usedPairKeys.add(pairKey);

        const fullVideoDisplayText = getFullVideoDisplayText(pair.epsName, pair.fullFile.name);
        const gameOverlayKey = `${gameName.toLowerCase()}:::${fullVideoDisplayText.toLowerCase()}`;
        usedOverlayKeys.add(gameOverlayKey);

        const { options, correctIndex } = createUniqueQuizOptions(gameName, allGameNamesPool);

        chosenMomentData = {
          folderId: gameFolder.id,
          momentName: gameName,
          gameName,
          epsName: pair.epsName,
          clipFolderName: pair.clipFolderName || null,
          cutFile: pair.cutFile,
          fullFile: pair.fullFile,
          memeImageFile: pair.memeImageFile || null,
          fullVideoDisplayText,
          options,
          correctIndex,
        };
        break;
      }
    }

    // Jika tidak ada klip tersisa di eligibleGames, coba cek sisa game di cooldown
    if (!chosenMomentData && cooldownGames.size > 0) {
      const remainingGames = shuffleArray(
        allGameFolders.filter((g) => cooldownGames.has(g.name.trim().toLowerCase()))
      );
      for (const gameFolder of remainingGames) {
        const gameName = gameFolder.name.trim();
        const pair = await findGameMomentPair(
          drive,
          gameFolder,
          skipPrefix,
          usedPairKeys,
          usedOverlayKeys,
          gameClipsCache
        );
        if (pair) {
          const pairKey = `${pair.cutFile.id}_${pair.fullFile.id}`;
          usedPairKeys.add(pairKey);

          const fullVideoDisplayText = getFullVideoDisplayText(pair.epsName, pair.fullFile.name);
          const gameOverlayKey = `${gameName.toLowerCase()}:::${fullVideoDisplayText.toLowerCase()}`;
          usedOverlayKeys.add(gameOverlayKey);

          const { options, correctIndex } = createUniqueQuizOptions(gameName, allGameNamesPool);

          chosenMomentData = {
            folderId: gameFolder.id,
            momentName: gameName,
            gameName,
            epsName: pair.epsName,
            clipFolderName: pair.clipFolderName || null,
            cutFile: pair.cutFile,
            fullFile: pair.fullFile,
            memeImageFile: pair.memeImageFile || null,
            fullVideoDisplayText,
            options,
            correctIndex,
          };
          break;
        }
      }
    }

    if (chosenMomentData) {
      validMoments.push(chosenMomentData);

      const letter = ['A', 'B', 'C', 'D'][chosenMomentData.correctIndex];
      console.log(` ✅ Terpilih #${validMoments.length}: Game "${chosenMomentData.gameName}"`);
      const l3Log = chosenMomentData.clipFolderName ? ` [Klip: "${chosenMomentData.clipFolderName}"]` : '';
      const isSingleStreamNoEps =
        !chosenMomentData.epsName || chosenMomentData.epsName === '-' || /^[-—–_]+$/.test(chosenMomentData.epsName);
      if (chosenMomentData.epsName && !isSingleStreamNoEps) {
        console.log(`    - Episode    : ${chosenMomentData.epsName}${l3Log}`);
      } else if (chosenMomentData.epsName) {
        console.log(`    - Episode    : ${chosenMomentData.epsName} (Tamat 1 stream, tidak dimasukkan ke overlay)${l3Log}`);
      }
      console.log(`    - Cut Video  : ${chosenMomentData.cutFile.name}`);
      console.log(`    - Full Video : ${chosenMomentData.fullFile.name}`);
      const memeLog = chosenMomentData.memeImageFile
        ? `"${chosenMomentData.memeImageFile.name}" (1:1 meme facecam, lebar 540px)`
        : '(Tidak ada - layar hitam jika mode meme)';
      console.log(`    - Meme Image : ${memeLog}`);
      console.log(`    - Overlay    : "${chosenMomentData.fullVideoDisplayText}" (1 baris)`);
      console.log(`    - Kunci Kuis : [${letter}]`);
    } else {
      console.log(`ℹ️ [INFO] Tidak ada lagi klip baru yang tersisa di seluruh folder game Google Drive.`);
      break;
    }
  }

  if (validMoments.length === 0) {
    console.error('❌ Tidak ada folder game/momen yang memenuhi syarat (harus berisi subfolder episode dengan cut.mp4 & video full).');
    process.exit(1);
  }

  console.log(`\n🎉 Berhasil mengumpulkan ${validMoments.length} momen untuk kompilasi!`);
  if (validMoments.length < clipCountTarget) {
    console.log(`ℹ️ [INFO] Target diminta ${clipCountTarget} klip, namun klip unik yang valid dan tersedia hanya ${validMoments.length} klip.`);
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
  findMemeImage,
  getFullVideoDisplayText,
  findGameMomentPair,
  selectQuizMoments,
};

