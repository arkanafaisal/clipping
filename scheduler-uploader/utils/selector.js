const readline = require('readline');

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
 * Mengonversi format waktu teks Indonesia ("jam X menit Y detik Z") atau numerik
 * menjadi format standar "HH:MM:SS" berpanjang tetap 8 karakter dengan zero-padding (misal: "00:39:35", "01:12:05").
 *
 * Diperlukan karena Google Drive menyortir nama secara leksikografis (ASCII strict),
 * sehingga penambahan awalan "00:" dan angka 2 digit memastikan urutan kronologis klip 100% presisi.
 */
function parseTimeToStandardTimestamp(str) {
  if (!str || typeof str !== 'string') return '';
  const clean = cleanText(str);

  // 1. Cek apakah sudah berformat H:M:S atau M:S numerik (misal "01:19:02" atau "02:45")
  const colonMatch = clean.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(.*)$/);
  if (colonMatch) {
    let h = 0;
    let m = 0;
    let s = 0;
    const rest = (colonMatch[4] || '').trim();

    if (colonMatch[3] !== undefined) {
      h = parseInt(colonMatch[1], 10) || 0;
      m = parseInt(colonMatch[2], 10) || 0;
      s = parseInt(colonMatch[3], 10) || 0;
    } else {
      m = parseInt(colonMatch[1], 10) || 0;
      s = parseInt(colonMatch[2], 10) || 0;
    }

    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return rest ? `${hh}:${mm}:${ss} ${rest}`.trim() : `${hh}:${mm}:${ss}`;
  }

  // 2. Parse pola bahasa Indonesia: "jam X", "menit Y", "detik Z"
  const jamMatch = clean.match(/(?:^|\s)jam\s*(\d+)/i);
  const menitMatch = clean.match(/(?:^|\s)menit\s*(\d+)/i);
  const detikMatch = clean.match(/(?:^|\s)detik\s*(\d+)/i);

  if (jamMatch || menitMatch || detikMatch) {
    const h = jamMatch ? parseInt(jamMatch[1], 10) : 0;
    const m = menitMatch ? parseInt(menitMatch[1], 10) : 0;
    const s = detikMatch ? parseInt(detikMatch[1], 10) : 0;

    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');

    // Hapus pola waktu yang sudah diambil untuk memeriksa sisa teks
    const remainingText = clean
      .replace(/(?:^|\s)jam\s*\d+/gi, '')
      .replace(/(?:^|\s)menit\s*\d+/gi, '')
      .replace(/(?:^|\s)detik\s*\d+/gi, '')
      .replace(/^eps\s*\d+\s*/i, '') // Hapus redundansi 'eps X' jika terselip di nama file full
      .replace(/\s+/g, ' ')
      .trim();

    return remainingText ? `${hh}:${mm}:${ss} ${remainingText}` : `${hh}:${mm}:${ss}`;
  }

  // 3. Fallback: nama bersih apa adanya
  return clean;
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
 * Helper menghasilkan 4 opsi pilihan ganda unik berbasis Nama Episode
 * (Digunakan pada Edisi Khusus 1 Game: tebak episode berapa)
 */
function createUniqueEpisodeQuizOptions(correctAnswer, episodePool = []) {
  const rawCorrect = (correctAnswer || '').trim();
  const cleanCorrect = cleanText(rawCorrect);
  const correctOption = cleanCorrect || 'Episode 1';
  const selectedSet = new Set([correctOption]);

  // 1. Ambil dari subfolder episode lain pada game ini
  const cleanedPool = (episodePool || [])
    .map((e) => (typeof e === 'string' ? e : e.name || '').trim())
    .map((name) => cleanText(name))
    .filter((name) => {
      if (!name) return false;
      if (name === '-' || /^[-—–_]+$/.test(name)) return false;
      return name.toLowerCase() !== correctOption.toLowerCase();
    });

  const shuffledPool = shuffleArray(cleanedPool);
  for (const name of shuffledPool) {
    if (selectedSet.size >= 4) break;
    const exists = Array.from(selectedSet).some(
      (existing) => existing.toLowerCase() === name.toLowerCase()
    );
    if (!exists) {
      selectedSet.add(name);
    }
  }

  // 2. Jika opsi belum mencapai 4, buat variasi episode berdasarkan pola angka nama
  if (selectedSet.size < 4) {
    const match = correctOption.match(/^(.*?)(\d+)(.*?)$/);
    const prefix = match ? match[1] : 'eps ';
    const num = match ? parseInt(match[2], 10) : 1;
    const suffix = match ? match[3] : '';

    const candidateNums = [num + 1, num + 2, num + 3, num - 1, num + 4, num - 2, 1, 2, 3, 4, 5];
    for (const cNum of candidateNums) {
      if (cNum <= 0) continue;
      if (selectedSet.size >= 4) break;
      const candidateName = `${prefix}${cNum}${suffix}`.trim();
      const exists = Array.from(selectedSet).some(
        (existing) => existing.toLowerCase() === candidateName.toLowerCase()
      );
      if (!exists) {
        selectedSet.add(candidateName);
      }
    }
  }

  // 3. Failsafe mutlak: jika masih belum 4 opsi unik
  let fallbackCounter = 1;
  while (selectedSet.size < 4) {
    const fbName = `eps ${fallbackCounter}`;
    const exists = Array.from(selectedSet).some(
      (existing) => existing.toLowerCase() === fbName.toLowerCase()
    );
    if (!exists) {
      selectedSet.add(fbName);
    }
    fallbackCounter++;
  }

  const shuffledOptions = shuffleArray(Array.from(selectedSet));
  const correctIndex = shuffledOptions.indexOf(correctOption);

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
 * Menggabungkan nama episode dan nama berkas/folder video full, dengan mengabaikan tanda '-'
 * pada game single-stream/non-episode maupun subfolder klip lapis ke-3.
 *
 * Mendukung struktur baru di mana nama klip tersimpan di folder (misal: "00:39:35")
 * dan berkas videonya telah diganti nama menjadi "full.mp4".
 */
function getFullVideoDisplayText(epsName, fullFileName, clipFolderName = null) {
  const rawCleanEps = epsName ? cleanText(epsName) : '';
  const isSingleStreamNoEps = !rawCleanEps || rawCleanEps === '-' || /^[-—–_]+$/.test(rawCleanEps);
  const cleanEps = isSingleStreamNoEps ? '' : rawCleanEps;

  let cleanFull = cleanText(fullFileName);

  // Jika nama berkas adalah 'full' (karena sudah diorganisir menjadi full.mp4)
  if (cleanFull.toLowerCase() === 'full') {
    const rawCleanClip = clipFolderName ? cleanText(clipFolderName) : '';
    const hasValidClipFolder = rawCleanClip && rawCleanClip !== '-' && !/^[-—–_]+$/.test(rawCleanClip);

    if (hasValidClipFolder) {
      // Ada folder klip waktu (misal: "00:39:35") di bawah folder episode ("eps 1")
      cleanFull = rawCleanClip;
    } else if (cleanEps) {
      // Tidak ada subfolder klip tambahan, nama folder waktu berada langsung di cleanEps (single stream)
      return cleanEps;
    }
  }

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

      const overlayText = getFullVideoDisplayText(p.epsName, p.fullFile.name, p.clipFolderName);
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
 * Menampilkan menu interaktif bernomor di terminal untuk memilih 1 game
 */
function promptGameSelection(gameFolders) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      console.log(`ℹ️ [NON-INTERAKTIF] Memilih game pertama secara otomatis: "${gameFolders[0].name}"`);
      return resolve(gameFolders[0]);
    }

    console.log('\n================================================================');
    console.log('       🎮 PILIH GAME UNTUK KOMPILASI EDISI 1 GAME                ');
    console.log('================================================================');
    gameFolders.forEach((g, idx) => {
      console.log(` [${idx + 1}] ${g.name}`);
    });
    console.log('================================================================');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const ask = () => {
      rl.question(`👉 Masukkan nomor game yang ingin dibuatkan kompilasi [1-${gameFolders.length}]: `, (ans) => {
        const num = parseInt(ans.trim(), 10);
        if (!isNaN(num) && num >= 1 && num <= gameFolders.length) {
          rl.close();
          const chosen = gameFolders[num - 1];
          console.log(`✅ Game Terpilih: "${chosen.name}"\n`);
          resolve(chosen);
        } else {
          console.log(`⚠️ Pilihan tidak valid. Masukkan angka antara 1 sampai ${gameFolders.length}.`);
          ask();
        }
      });
    };

    ask();
  });
}

/**
 * Menyeleksi momen kuis khusus untuk Kompilasi Edisi 1 Game:
 * - Menentukan 1 target game (via ID, nama, atau menu interaktif)
 * - Menerapkan aturan keunikan (sliding-window cooldown) di tingkat Episode
 * - Early Fail jika game bertipe non-episode / single-stream ('-') dan unique window > 1
 * - Menghasilkan 4 opsi pilihan ganda berbasis Nama Episode
 * - Menjamin teks overlay full video tetap unik tanpa duplikasi
 */
async function selectSingleGameQuizMoments(drive, config, allGameFolders) {
  const { skipPrefix, clipCountTarget } = config;
  const gameUniqueWindow = Math.max(1, config.gameUniqueWindow || 5);

  let targetGame = null;
  if (config.singleGameId) {
    targetGame = allGameFolders.find((g) => g.id === config.singleGameId);
    if (!targetGame) {
      try {
        const res = await drive.files.get({
          fileId: config.singleGameId,
          fields: 'id, name',
          supportsAllDrives: true,
        });
        if (res.data) targetGame = res.data;
      } catch (e) {
        console.error(`❌ Gagal menemukan folder game dengan ID "${config.singleGameId}": ${e.message}`);
        process.exit(1);
      }
    }
  } else if (config.singleGameName) {
    const q = config.singleGameName.trim().toLowerCase();
    targetGame =
      allGameFolders.find((g) => g.name.trim().toLowerCase() === q) ||
      allGameFolders.find((g) => g.name.trim().toLowerCase().includes(q));
    if (!targetGame) {
      console.error(`❌ Folder game dengan nama "${config.singleGameName}" tidak ditemukan di Google Drive.`);
      console.error(`   Game yang tersedia: ${allGameFolders.map((g) => `"${g.name}"`).join(', ')}`);
      process.exit(1);
    }
  }

  if (!targetGame) {
    if (allGameFolders.length === 1) {
      targetGame = allGameFolders[0];
    } else {
      targetGame = await promptGameSelection(allGameFolders);
    }
  }

  if (!targetGame) {
    console.error('❌ Tidak ada folder game yang dipilih untuk edisi 1 game.');
    process.exit(1);
  }

  console.log(`\n📁 [EDISI 1 GAME] Memindai isi folder game: "${targetGame.name}"...`);
  const childrenRes = await drive.files.list({
    q: `'${targetGame.id}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType)',
    spaces: 'drive',
    pageSize: 500,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const children = childrenRes.data.files || [];
  const allSubFolders = children.filter((c) => c.mimeType === 'application/vnd.google-apps.folder');
  const validSubFolders = allSubFolders.filter((c) => !isSkippedItem(c.name, skipPrefix));

  // Helper membedakan subfolder seri/episode ("eps 1", "part 2") vs folder klip video / single-stream
  // Folder klip video berkarakter:
  // - Bernama "-"
  // - Diawali angka / format jam ("00:39:35", "01:12:05", "jam ...", "menit ...")
  const isClipOrSingleStreamSub = (name) => {
    const cl = cleanText(name);
    if (!cl || cl === '-' || /^[-—–_]+$/.test(cl)) return true;
    if (/^\d{1,2}:/i.test(cl) || /^(jam|menit|detik)\s*\d+/i.test(cl)) return true;
    return false;
  };

  const hasOnlySingleStream =
    validSubFolders.length === 0 ||
    validSubFolders.every((sf) => isClipOrSingleStreamSub(sf.name));

  if (hasOnlySingleStream && gameUniqueWindow > 1) {
    console.error(`\n❌ [EARLY FAIL] Game "${targetGame.name}" adalah konten single-stream / non-episode (hanya memiliki folder klip waktu seperti "00:xx:xx" / "-" atau langsung berisi file video).`);
    console.error(`   Aturan keunikan saat ini adalah ${gameUniqueWindow} (membutuhkan variasi episode berbeda).`);
    console.error(`   Untuk game single-stream, jalankan dengan --window=1 (atau atur GAME_UNIQUE_WINDOW=1 pada .env) agar boleh mengambil klip dari stream yang sama.`);
    process.exit(1);
  }

  // Kumpulkan daftar episode untuk pool opsi kuis (mengabaikan folder klip waktu dan "-")
  const allEpisodeNamesPool = validSubFolders
    .map((sf) => sf.name.trim())
    .filter((n) => !isClipOrSingleStreamSub(n));

  const targetFolders = validSubFolders.length > 0
    ? validSubFolders
    : [{ id: targetGame.id, name: targetGame.name }];

  const epsClipsCache = new Map();

  async function findEpisodeClipPair(epsFolder, usedPairKeys, usedOverlayKeys) {
    let cache = epsClipsCache.get(epsFolder.id);

    if (!cache) {
      cache = {
        pairs: [],
      };

      if (epsFolder.id === targetGame.id) {
        // Direct files di root game folder
        const directPair = findVideoPair(children, skipPrefix);
        if (directPair) {
          cache.pairs.push({
            epsName: '',
            clipFolderName: null,
            cutFile: directPair.cutFile,
            fullFile: directPair.fullFile,
            memeImageFile: findMemeImage(children, skipPrefix),
          });
        }
      } else {
        const epsRes = await drive.files.list({
          q: `'${epsFolder.id}' in parents and trashed = false`,
          fields: 'files(id, name, mimeType)',
          spaces: 'drive',
          pageSize: 100,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });
        const epsItems = epsRes.data.files || [];

        // Direct pair di dalam folder episode
        const directPair = findVideoPair(epsItems, skipPrefix);
        if (directPair) {
          cache.pairs.push({
            epsName: epsFolder.name.trim(),
            clipFolderName: null,
            cutFile: directPair.cutFile,
            fullFile: directPair.fullFile,
            memeImageFile: findMemeImage(epsItems, skipPrefix),
          });
        }

        // Subfolder lapis ke-3 (misal folder "-")
        const layer3SubFolders = epsItems.filter(
          (f) => f.mimeType === 'application/vnd.google-apps.folder' && !isSkippedItem(f.name, skipPrefix)
        );

        if (layer3SubFolders.length > 0) {
          for (const l3Folder of shuffleArray(layer3SubFolders)) {
            const l3Res = await drive.files.list({
              q: `'${l3Folder.id}' in parents and trashed = false`,
              fields: 'files(id, name, mimeType)',
              spaces: 'drive',
              pageSize: 20,
              supportsAllDrives: true,
              includeItemsFromAllDrives: true,
            });
            const l3Items = l3Res.data.files || [];
            const l3Pair = findVideoPair(l3Items, skipPrefix);
            if (l3Pair) {
              cache.pairs.push({
                epsName: epsFolder.name.trim(),
                clipFolderName: l3Folder.name.trim(),
                cutFile: l3Pair.cutFile,
                fullFile: l3Pair.fullFile,
                memeImageFile: findMemeImage(l3Items, skipPrefix) || findMemeImage(epsItems, skipPrefix),
              });
            }
          }
        }
      }

      epsClipsCache.set(epsFolder.id, cache);
    }

    const gameKey = targetGame.name.trim().toLowerCase();
    return cache.pairs.find((p) => {
      const fileKey = `${p.cutFile.id}_${p.fullFile.id}`;
      if (usedPairKeys && usedPairKeys.has(fileKey)) return false;

      const overlayText = getFullVideoDisplayText(p.epsName, p.fullFile.name, p.clipFolderName);
      const gameOverlayKey = `${gameKey}:::${overlayText.toLowerCase()}`;
      if (usedOverlayKeys && usedOverlayKeys.has(gameOverlayKey)) return false;

      return true;
    }) || null;
  }

  let uniquenessLog = `${gameUniqueWindow} klip berturut-turut`;
  if (gameUniqueWindow <= 1) {
    uniquenessLog = '1 (Bebas duplikat, episode boleh berulang berturut-turut)';
  } else if (gameUniqueWindow >= clipCountTarget) {
    uniquenessLog = `${gameUniqueWindow} klip (Semua momen dijamin episode berbeda)`;
  }

  console.log(`\n[TAHAP 2/4] Mengacak dan menyeleksi ${clipCountTarget} momen kuis dari "${targetGame.name}" (Jarak Keunikan Episode: ${uniquenessLog})...`);

  const validMoments = [];
  const usedPairKeys = new Set();
  const usedOverlayKeys = new Set();
  const gameKey = targetGame.name.trim().toLowerCase();

  while (validMoments.length < clipCountTarget) {
    // 1. Cooldown episode
    const cooldownEps = new Set();
    if (gameUniqueWindow > 1) {
      const windowSlice = validMoments.slice(-(gameUniqueWindow - 1));
      for (const m of windowSlice) {
        if (m.epsName) cooldownEps.add(m.epsName.toLowerCase());
      }
    }

    // 2. Filter episode yang tidak sedang cooldown
    let eligibleFolders = targetFolders.filter(
      (f) => !cooldownEps.has(f.name.trim().toLowerCase())
    );

    // Failsafe jika semua episode sedang cooldown
    if (eligibleFolders.length === 0) {
      eligibleFolders = [...targetFolders];
      if (validMoments.length > 0 && targetFolders.length > 1) {
        const lastEps = (validMoments[validMoments.length - 1].epsName || '').toLowerCase();
        eligibleFolders = eligibleFolders.filter((f) => f.name.trim().toLowerCase() !== lastEps);
      }
    }

    const candidateFolders = shuffleArray(eligibleFolders);
    let chosenMomentData = null;

    for (const epsFolder of candidateFolders) {
      const pair = await findEpisodeClipPair(epsFolder, usedPairKeys, usedOverlayKeys);
      if (pair) {
        const pairKey = `${pair.cutFile.id}_${pair.fullFile.id}`;
        usedPairKeys.add(pairKey);

        const fullVideoDisplayText = getFullVideoDisplayText(pair.epsName, pair.fullFile.name, pair.clipFolderName);
        const gameOverlayKey = `${gameKey}:::${fullVideoDisplayText.toLowerCase()}`;
        usedOverlayKeys.add(gameOverlayKey);

        const rawEpsAnswer = pair.epsName || targetGame.name;
        const { options, correctIndex } = createUniqueEpisodeQuizOptions(
          rawEpsAnswer,
          allEpisodeNamesPool
        );

        chosenMomentData = {
          folderId: targetGame.id,
          momentName: `${targetGame.name} - ${pair.epsName || 'Klip'}`,
          gameName: targetGame.name.trim(),
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

    // Failsafe sisa di cooldown
    if (!chosenMomentData && cooldownEps.size > 0) {
      const remainingFolders = shuffleArray(
        targetFolders.filter((f) => cooldownEps.has(f.name.trim().toLowerCase()))
      );
      for (const epsFolder of remainingFolders) {
        const pair = await findEpisodeClipPair(epsFolder, usedPairKeys, usedOverlayKeys);
        if (pair) {
          const pairKey = `${pair.cutFile.id}_${pair.fullFile.id}`;
          usedPairKeys.add(pairKey);

          const fullVideoDisplayText = getFullVideoDisplayText(pair.epsName, pair.fullFile.name, pair.clipFolderName);
          const gameOverlayKey = `${gameKey}:::${fullVideoDisplayText.toLowerCase()}`;
          usedOverlayKeys.add(gameOverlayKey);

          const rawEpsAnswer = pair.epsName || targetGame.name;
          const { options, correctIndex } = createUniqueEpisodeQuizOptions(
            rawEpsAnswer,
            allEpisodeNamesPool
          );

          chosenMomentData = {
            folderId: targetGame.id,
            momentName: `${targetGame.name} - ${pair.epsName || 'Klip'}`,
            gameName: targetGame.name.trim(),
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
      console.log(` ✅ Terpilih #${validMoments.length}: Episode "${chosenMomentData.epsName || 'Klip'}" (${chosenMomentData.gameName})`);
      const l3Log = chosenMomentData.clipFolderName ? ` [Klip: "${chosenMomentData.clipFolderName}"]` : '';
      console.log(`    - Cut Video  : ${chosenMomentData.cutFile.name}`);
      console.log(`    - Full Video : ${chosenMomentData.fullFile.name}`);
      const memeLog = chosenMomentData.memeImageFile
        ? `"${chosenMomentData.memeImageFile.name}" (1:1 meme facecam, lebar 540px)`
        : '(Tidak ada - layar hitam jika mode meme)';
      console.log(`    - Meme Image : ${memeLog}`);
      console.log(`    - Overlay    : "${chosenMomentData.fullVideoDisplayText}" (1 baris)`);
      console.log(`    - Opsi Kuis  : ${chosenMomentData.options.join(' | ')}`);
      console.log(`    - Kunci Kuis : [${letter}] -> "${chosenMomentData.options[chosenMomentData.correctIndex]}"`);
    } else {
      console.log(`ℹ️ [INFO] Tidak ada lagi klip baru yang tersisa pada game "${targetGame.name}".`);
      break;
    }
  }

  if (validMoments.length === 0) {
    console.error(`❌ Tidak ada klip video yang memenuhi syarat di folder game "${targetGame.name}".`);
    process.exit(1);
  }

  console.log(`\n🎉 Berhasil mengumpulkan ${validMoments.length} momen untuk kompilasi edisi khusus "${targetGame.name}"!`);
  if (validMoments.length < clipCountTarget) {
    console.log(`ℹ️ [INFO] Target diminta ${clipCountTarget} klip, namun klip unik yang valid dan tersedia hanya ${validMoments.length} klip.`);
  }

  return validMoments;
}

/**
 * Memilih secara acak momen kuis dari Google Drive berdasarkan konfigurasi:
 * - Mengambil folder Game (Layer 1)
 * - Jika `config.singleGameMode` aktif: mendelegasikan ke `selectSingleGameQuizMoments`
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

  // Jika Mode Kompilasi Edisi 1 Game aktif
  if (config.singleGameMode) {
    return await selectSingleGameQuizMoments(drive, config, allGameFolders);
  }

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

        const fullVideoDisplayText = getFullVideoDisplayText(pair.epsName, pair.fullFile.name, pair.clipFolderName);
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

          const fullVideoDisplayText = getFullVideoDisplayText(pair.epsName, pair.fullFile.name, pair.clipFolderName);
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
  parseTimeToStandardTimestamp,
  isSkippedItem,
  STATIC_FALLBACK_DISTRACTORS,
  createUniqueQuizOptions,
  createUniqueEpisodeQuizOptions,
  findVideoPair,
  findMemeImage,
  getFullVideoDisplayText,
  findGameMomentPair,
  promptGameSelection,
  selectSingleGameQuizMoments,
  selectQuizMoments,
};

