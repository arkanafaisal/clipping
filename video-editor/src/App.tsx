import React, { useState, useEffect, useRef } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { MemeDiscoveryComposition } from './styles/meme-discovery/MemeDiscoveryComposition';
import { RouletteQuizComposition } from './styles/roulette-quiz/RouletteQuizComposition';
import { CardSkill, RARITY_CONFIG, getRarityColor } from './styles/meme-discovery/types';
import initialData from './data.json';
import { captureVideoFrame } from './utils/frameCapture';
import { parseTimestampToSeconds } from './utils/time';
import { ArrowLeft, Check, Save, Sparkles, Layers, RefreshCw, Film, ExternalLink } from 'lucide-react';

type StyleMode = 'meme-discovery' | 'roulette-quiz';

interface DriveFolder {
  id: string;
  name: string;
}

// Helper routing mandiri via URL search params (tanpa react-router)
function getUrlParams(): { momentId: string | null; style: StyleMode } {
  try {
    const params = new URLSearchParams(window.location.search);
    const moment = params.get('moment') || params.get('m');
    const styleParam = (params.get('style') || params.get('mode')) as StyleMode;
    const style: StyleMode =
      styleParam === 'roulette-quiz' ? 'roulette-quiz' : 'meme-discovery';
    return { momentId: moment || null, style };
  } catch {
    return { momentId: null, style: 'meme-discovery' };
  }
}

function syncUrlWithState(
  momentId: string | null,
  style: StyleMode,
  replace: boolean = true
) {
  try {
    const currentParams = new URLSearchParams(window.location.search);
    const currentMoment = currentParams.get('moment') || currentParams.get('m') || null;
    const currentStyle =
      currentParams.get('style') || currentParams.get('mode') || 'meme-discovery';

    if (currentMoment === momentId && currentStyle === style) {
      return;
    }

    const url = new URL(window.location.href);
    if (momentId) {
      url.searchParams.set('moment', momentId);
      url.searchParams.set('style', style);
      url.searchParams.delete('m');
      url.searchParams.delete('mode');
    } else {
      url.searchParams.delete('moment');
      url.searchParams.delete('m');
      url.searchParams.delete('style');
      url.searchParams.delete('mode');
    }

    const newUrl = url.search ? `${url.pathname}${url.search}` : url.pathname;
    if (replace) {
      window.history.replaceState({ momentId, style }, '', newUrl);
    } else {
      window.history.pushState({ momentId, style }, '', newUrl);
    }
  } catch (e) {
    console.warn('Gagal sinkronisasi URL:', e);
  }
}

export default function App() {
  const [data, setData] = useState<any>(initialData);
  const moments = data.moments || [];

  // State pemilihan momen & mode (diinisialisasi dari URL agar tidak reset saat refresh)
  const initialUrl = getUrlParams();
  const [selectedMomentId, setSelectedMomentId] = useState<string | null>(
    () => initialUrl.momentId
  );
  const [activeStyle, setActiveStyle] = useState<StyleMode>(
    () => initialUrl.style
  );

  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState<boolean>(true);
  const [isOpeningMoment, setIsOpeningMoment] = useState<string | null>(null);

  const currentMoment =
    moments.find(
      (m: any) =>
        m.id === selectedMomentId ||
        m.name === selectedMomentId ||
        m.path === selectedMomentId
    ) || (selectedMomentId ? { id: selectedMomentId, name: selectedMomentId, path: selectedMomentId } : moments[0]);

  const playerRef = useRef<PlayerRef>(null);

  useEffect(() => {
    (window as any).playerRef = playerRef;
  }, []);

  // Sinkronisasi navigasi browser Back/Forward (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const { momentId, style } = getUrlParams();
      setSelectedMomentId(momentId);
      setActiveStyle(style);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Update URL otomatis saat state momen/style berubah
  useEffect(() => {
    syncUrlWithState(selectedMomentId, activeStyle, true);
  }, [selectedMomentId, activeStyle]);

  // Jika URL mengakses momen yang belum terdaftar di data.json lokal, otomatis daftarkan via API
  useEffect(() => {
    if (!selectedMomentId) return;
    const exists = moments.some(
      (m: any) =>
        m.id === selectedMomentId ||
        m.name === selectedMomentId ||
        m.path === selectedMomentId
    );
    if (!exists) {
      fetch('/api/select-moment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: selectedMomentId, folderName: selectedMomentId }),
      })
        .then((res) => res.json())
        .then((res) => {
          if (res.success && res.metadata) {
            setData(res.metadata);
          }
        })
        .catch((err) => console.warn('Gagal auto-sync momen dari URL:', err));
    }
  }, [selectedMomentId, moments]);

  // Memuat daftar folder root Google Drive untuk dashboard
  useEffect(() => {
    setIsLoadingFolders(true);
    fetch('/api/folders')
      .then((res) => res.json())
      .then((res) => {
        if (Array.isArray(res.folders) && res.folders.length > 0) {
          setFolders(res.folders);
        } else if (moments.length > 0) {
          setFolders(moments.map((m: any) => ({ id: m.id, name: m.name })));
        }
      })
      .catch((err) => {
        console.warn('Gagal memuat folder Google Drive:', err);
        if (moments.length > 0) {
          setFolders(moments.map((m: any) => ({ id: m.id, name: m.name })));
        }
      })
      .finally(() => {
        setIsLoadingFolders(false);
      });
  }, []);

  // Handler masuk ke ruang momen tertentu dari dashboard
  const handleSelectMode = async (
    folder: DriveFolder,
    mode: StyleMode = 'meme-discovery'
  ) => {
    setActiveStyle(mode);
    setIsOpeningMoment(folder.id);
    try {
      const res = await fetch('/api/select-moment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: folder.id, folderName: folder.name }),
      });
      const result = await res.json();
      const momentTarget = result?.moment?.path || result?.moment?.id || folder.id;
      if (result.success && result.moment) {
        if (result.metadata) {
          setData(result.metadata);
        }
        setSelectedMomentId(momentTarget);
      } else {
        setSelectedMomentId(momentTarget);
      }
      syncUrlWithState(momentTarget, mode, false);
    } catch (err: any) {
      console.warn('Gagal select-moment:', err);
      setSelectedMomentId(folder.id);
      syncUrlWithState(folder.id, mode, false);
    } finally {
      setIsOpeningMoment(null);
    }
  };

  // Handler navigasi kembali ke dashboard
  const handleBackToDashboard = () => {
    setSelectedMomentId(null);
    syncUrlWithState(null, activeStyle, false);
  };

  // Helper parsing skill kartu (maks 3 skill dengan fallback legacy passive)
  const getInitialSkills = (md?: any): CardSkill[] => {
    if (Array.isArray(md?.skills) && md.skills.length > 0) {
      return [
        md.skills[0] || { name: '', desc: '', nameFontSize: 32, descFontSize: 26 },
        md.skills[1] || { name: '', desc: '', nameFontSize: 32, descFontSize: 26 },
        md.skills[2] || { name: '', desc: '', nameFontSize: 32, descFontSize: 26 },
      ];
    }
    return [
      {
        name: md?.passiveName || 'kesempatan kedua',
        desc: md?.passiveDesc || 'memberikan 70% chance untuk lolos dari grim reaper. hanya berlaku 1 kali.',
        nameFontSize: md?.passiveNameFontSize || 32,
        descFontSize: md?.passiveDescFontSize || 26,
      },
      { name: '', desc: '', nameFontSize: 32, descFontSize: 26 },
      { name: '', desc: '', nameFontSize: 32, descFontSize: 26 },
    ];
  };

  // Input dan teks kartu Meme Discovery
  const initialMeme = currentMoment?.memeDiscovery || {};
  const [targetTimestamp, setTargetTimestamp] = useState<string>(
    initialMeme.targetUndoTimestamp || '00:07.105'
  );
  const [cardTitle, setCardTitle] = useState<string>(
    initialMeme.cardTitle || ''
  );
  const [cardRarity, setCardRarity] = useState<string>(
    initialMeme.cardRarity || 'Common'
  );
  const [cardDesc, setCardDesc] = useState<string>(
    initialMeme.cardDesc || ''
  );
  const [cardColor, setCardColor] = useState<string>(() =>
    getRarityColor(initialMeme.cardRarity || 'Common')
  );

  // Ukuran font teks kartu (dalam pixel, dapat disetel langsung oleh pengguna)
  const [titleFontSize, setTitleFontSize] = useState<number>(
    initialMeme.titleFontSize || 46
  );
  const [rarityFontSize, setRarityFontSize] = useState<number>(
    initialMeme.rarityFontSize || 32
  );
  const [descFontSize, setDescFontSize] = useState<number>(
    initialMeme.descFontSize || 32
  );

  // State daftar skill (maksimal 3 skill)
  const [skills, setSkills] = useState<CardSkill[]>(() =>
    getInitialSkills(initialMeme)
  );

  const handleSkillChange = (
    index: number,
    field: keyof CardSkill,
    value: string | number
  ) => {
    setSkills((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleRarityChange = (newRarity: string) => {
    setCardRarity(newRarity);
    setCardColor(getRarityColor(newRarity));
  };

  const activeRarityKey =
    Object.keys(RARITY_CONFIG).find(
      (key) => key.toLowerCase() === (cardRarity || '').toLowerCase()
    ) || 'Common';

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Sinkronisasi otomatis saat currentMoment berubah (atau saat data.json berubah via Vite HMR)
  useEffect(() => {
    if (!currentMoment) return;
    const md = currentMoment.memeDiscovery;
    if (md) {
      if (md.targetUndoTimestamp) setTargetTimestamp(md.targetUndoTimestamp);
      if (md.cardTitle !== undefined) setCardTitle(md.cardTitle);
      const r = md.cardRarity || 'Common';
      setCardRarity(r);
      setCardColor(getRarityColor(r));
      if (md.cardDesc !== undefined) setCardDesc(md.cardDesc);
      setTitleFontSize(md.titleFontSize || 46);
      setRarityFontSize(md.rarityFontSize || 32);
      setDescFontSize(md.descFontSize || 32);
      setSkills(getInitialSkills(md));
    }
  }, [currentMoment?.id, currentMoment?.name, initialData]);

  const videoDurationSeconds =
    currentMoment?.files?.full?.durationSeconds || 10.95;
  const momentFolder = currentMoment?.path?.replace(/\s+/g, '-');
  const videoSrc = momentFolder
    ? `/temp/${momentFolder}/full.mp4`
    : '/temp/full.mp4';
  const imageSrc = currentMoment?.files?.image
    ? (momentFolder ? `/temp/${momentFolder}/image.jpg` : '/temp/image.jpg')
    : undefined;

  // Tangkapan frame beku statis target x momen puncak (canvas)
  const [targetFrameImage, setTargetFrameImage] = useState<string | undefined>();

  // 2. Ekstrak frame target x momen puncak (update dinamis saat user mengubah timestamp, debounced 200ms)
  useEffect(() => {
    if (!videoSrc) return;
    let isCancelled = false;

    const timer = setTimeout(() => {
      const targetSec = parseTimestampToSeconds(targetTimestamp);
      captureVideoFrame(videoSrc, targetSec)
        .then((targetImg) => {
          if (!isCancelled) setTargetFrameImage(targetImg);
        })
        .catch((err) => {
          console.warn('Gagal ekstrak target frame:', err);
        });
    }, 200);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [videoSrc, targetTimestamp]);

  // Total durasi sekuens video berurutan (Fast Paced & High Retention):
  // 1. Video play sampai timestamp puncak (stopFrame)
  // 2. Screenshot shutter flash (10f)
  // 3. Jeda 0.5 detik pasca-screenshot (15f)
  // 4. Kartu meme slide-up dari bawah & 3D reveal (105f)
  const stopSeconds = parseTimestampToSeconds(targetTimestamp) || videoDurationSeconds;
  const stopFrame = Math.max(1, Math.round(stopSeconds * 30));
  const totalFrames = stopFrame + 10 + 15 + 105;

  // Simpan nilai baru ke data.json via server endpoint
  const handleSave = async (silent: boolean = false) => {
    setIsSaving(true);
    try {
      const updatedMoments = moments.map((m: any) => {
        if (m.name === currentMoment?.name || m.id === currentMoment?.id) {
          return {
            ...m,
            memeDiscovery: {
              ...(m.memeDiscovery || {}),
              targetUndoTimestamp: targetTimestamp,
              cardTitle,
              cardRarity,
              cardDesc,
              cardColor,
              titleFontSize,
              rarityFontSize,
              descFontSize,
              skills,
              // Tetap simpan legacy passive untuk kompatibilitas data
              passiveName: skills[0]?.name || '',
              passiveDesc: skills[0]?.desc || '',
              passiveNameFontSize: skills[0]?.nameFontSize || 28,
              passiveDescFontSize: skills[0]?.descFontSize || 22,
            },
          };
        }
        return m;
      });

      const payload = {
        ...data,
        activeMomentId: currentMoment?.path || currentMoment?.id,
        activeStyle,
        moments: updatedMoments,
      };

      const res = await fetch('/api/save-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setData(payload);
        if (!silent) {
          setSaveStatus('Tersimpan ke data.json');
          setTimeout(() => setSaveStatus(null), 2500);
        }
      } else {
        if (!silent) {
          setSaveStatus('Gagal menyimpan');
          setTimeout(() => setSaveStatus(null), 3000);
        }
      }
    } catch {
      if (!silent) {
        setSaveStatus('Gagal menyimpan (offline)');
        setTimeout(() => setSaveStatus(null), 3000);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // State dan handler ekspor video langsung dari Web UI
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [renderStatus, setRenderStatus] = useState<string | null>(null);
  const [lastExportPath, setLastExportPath] = useState<string | null>(null);

  const handleRender = async () => {
    setIsRendering(true);
    setRenderStatus('Menyimpan perubahan konfigurasi...');
    try {
      await handleSave(true);
      setRenderStatus('Sedang merender video MP4 (memerlukan ~20-40 detik)...');

      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          momentId: currentMoment?.path || currentMoment?.id,
          style: activeStyle,
        }),
      });

      const result = await res.json();
      if (result.success && result.outputPath) {
        setLastExportPath(result.outputPath);
        setRenderStatus(`Selesai: ${result.outputPath}`);
        setTimeout(() => setRenderStatus(null), 15000);
      } else {
        const errMsg = result.error || result.details || 'Terjadi kesalahan ekspor';
        setRenderStatus(`❌ ${errMsg}`);
        setTimeout(() => setRenderStatus(null), 10000);
      }
    } catch (err: any) {
      console.error('Gagal render:', err);
      setRenderStatus(`❌ Gagal koneksi render: ${err?.message || err}`);
      setTimeout(() => setRenderStatus(null), 10000);
    } finally {
      setIsRendering(false);
    }
  };

  // JIKA BELUM MEMILIH MOMEN: Tampilkan Dashboard minimalis untuk memilih momen
  if (!selectedMomentId) {
    return (
      <div className="min-h-screen w-screen bg-black text-neutral-100 p-8 flex flex-col justify-start select-none">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold text-neutral-300">Pilih Momen</h1>
            <button
              onClick={() => {
                setIsLoadingFolders(true);
                fetch('/api/folders')
                  .then((res) => res.json())
                  .then((res) => {
                    if (Array.isArray(res.folders) && res.folders.length > 0) {
                      setFolders(res.folders);
                    }
                  })
                  .finally(() => setIsLoadingFolders(false));
              }}
              className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
              title="Refresh daftar folder"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFolders ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {isLoadingFolders && (
            <span className="text-xs text-neutral-500">Memuat folder Google Drive...</span>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          {folders.map((folder) => {
            const isOpening = isOpeningMoment === folder.id;
            return (
              <div
                key={folder.id}
                className="w-fit border border-neutral-800 bg-neutral-950 rounded-lg p-3 hover:border-neutral-700 transition-colors"
              >
                <div className="text-sm font-medium text-white mb-2.5 capitalize">
                  {folder.name}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={isOpening}
                    onClick={() => handleSelectMode(folder, 'meme-discovery')}
                    className="text-xs bg-amber-500/20 hover:bg-amber-500 hover:text-black text-amber-300 px-2.5 py-1 rounded transition-colors cursor-pointer font-medium disabled:opacity-50"
                  >
                    {isOpening ? 'Menyiapkan...' : 'Meme Discovery'}
                  </button>
                </div>
              </div>
            );
          })}

          {!isLoadingFolders && folders.length === 0 && (
            <p className="text-xs text-neutral-500">Tidak ada folder ditemukan di Google Drive.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-black text-neutral-100 select-none">
      {/* AREA UTAMA: Video Canvas 9:16 Full Height Laptop (100% Height Tanpa Navbar/Padding) */}
      <div className="flex-1 h-screen flex items-center justify-center bg-black overflow-hidden p-0 m-0">
        <div className="h-screen w-auto aspect-[9/16] max-h-screen bg-black flex items-center justify-center relative overflow-hidden shadow-2xl">
          {activeStyle === 'meme-discovery' ? (
            <Player
              ref={playerRef}
              component={MemeDiscoveryComposition}
              inputProps={{
                videoSrc,
                targetUndoTimestamp: targetTimestamp,
                totalVideoDurationSeconds: videoDurationSeconds,
                cardImageSrc: imageSrc,
                targetFrameImage,
                title: currentMoment?.memeDiscovery?.title || 'Meme Discovery: Momen Langka!',
                gameTitle: currentMoment?.name || 'Grim Reaper',
                cardTitle: cardTitle || undefined,
                cardRarity: cardRarity || undefined,
                cardDesc: cardDesc || undefined,
                skills,
                cardColor: cardColor || '#f59e0b',
                titleFontSize,
                rarityFontSize,
                descFontSize,
              }}
              durationInFrames={totalFrames}
              fps={30}
              compositionWidth={1080}
              compositionHeight={1920}
              style={{ width: '100%', height: '100%' }}
              controls
              autoPlay
              loop
            />
          ) : (
            <Player
              component={RouletteQuizComposition}
              inputProps={{
                title: 'Grim Reaper Momen Seru',
                gameTitle: currentMoment?.name || 'Grim Reaper',
                timestampText: '00:00:10',
                captionText: 'Momen video Grim Reaper yang diunduh dari Google Drive!',
                videoSrc,
                showRoulettePreview: false,
                activeLaneIndex: 1,
                dimOpacity: 0.65,
              }}
              durationInFrames={300}
              fps={30}
              compositionWidth={1080}
              compositionHeight={1920}
              style={{ width: '100%', height: '100%' }}
              controls
              autoPlay
              loop
            />
          )}
        </div>
      </div>

      {/* SIDEBAR EDITING: Input Detail Kartu Meme, Posisi Timestamp, dan Simpan ke data.json */}
      <aside className="w-88 h-screen border-l border-neutral-900 bg-neutral-950/95 flex flex-col justify-between p-5 shrink-0 overflow-hidden">
        {/* Header Bar: Back Button ke Dashboard & Detail Mode Aktif */}
        <div className="flex items-center justify-between pb-3.5 border-b border-neutral-900 shrink-0">
          <button
            onClick={handleBackToDashboard}
            className="inline-flex items-center gap-1.5 text-xs text-neutral-300 hover:text-white transition-colors py-1 px-2.5 rounded-lg hover:bg-neutral-900 cursor-pointer border border-neutral-800"
            title="Kembali ke Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </button>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-xs font-semibold text-amber-300">
            {activeStyle === 'meme-discovery' ? (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Meme Discovery
              </>
            ) : (
              <>
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                Roulette Quiz
              </>
            )}
          </div>
        </div>

        {/* Form Input Scrollable */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3.5 pr-1 scrollbar-thin scrollbar-thumb-neutral-800">
          {activeStyle === 'meme-discovery' ? (
            <>
              {/* 1. Durasi Stop / Timestamp Puncak */}
              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  Durasi Stop / Timestamp Puncak
                </label>
                <input
                  type="text"
                  value={targetTimestamp}
                  onChange={(e) => setTargetTimestamp(e.target.value)}
                  placeholder="00:07.105"
                  className="w-full bg-black border border-neutral-800 rounded-xl px-3 py-2 text-xs font-mono text-amber-400 focus:outline-none focus:border-amber-500 transition-colors"
                />
                <p className="text-[10px] text-neutral-500 mt-1">
                  Video otomatis stop di <code className="text-neutral-400">MM:SS.mmm</code>, langsung screenshot & reveal kartu.
                </p>
              </div>

              {/* 2. Judul Kartu */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-neutral-300">
                    Judul Kartu
                  </label>
                  <span className="text-[10px] text-neutral-500 font-mono">Font Size</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={cardTitle}
                    onChange={(e) => setCardTitle(e.target.value)}
                    placeholder="judul kartu"
                    className="flex-1 bg-black border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 transition-colors"
                  />
                  <div className="flex items-center gap-1 shrink-0 bg-neutral-900 border border-neutral-800 rounded-xl px-2 py-1.5" title="Ukuran Font Judul (px)">
                    <input
                      type="number"
                      min="16"
                      max="100"
                      value={titleFontSize}
                      onChange={(e) => setTitleFontSize(Number(e.target.value) || 16)}
                      className="w-8 bg-transparent text-xs text-amber-400 font-mono text-center focus:outline-none"
                    />
                    <span className="text-[10px] text-neutral-500 font-mono">px</span>
                  </div>
                </div>
              </div>

              {/* 3. Rarity Kartu (Dropdown Konstan & Otomatis Warna Tema) */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-neutral-300">
                    Rarity Kartu
                  </label>
                  <span className="text-[10px] text-neutral-500 font-mono">Font Size</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 flex items-center">
                    <span
                      className="absolute left-3 w-3 h-3 rounded-full pointer-events-none transition-all duration-300 shadow-sm"
                      style={{ backgroundColor: cardColor, boxShadow: `0 0 8px ${cardColor}88` }}
                    />
                    <select
                      value={activeRarityKey}
                      onChange={(e) => handleRarityChange(e.target.value)}
                      className="w-full bg-black border border-neutral-800 rounded-xl pl-8 pr-3 py-2 text-xs font-bold focus:outline-none focus:border-amber-500 transition-colors cursor-pointer"
                      style={{ color: cardColor }}
                    >
                      {Object.entries(RARITY_CONFIG).map(([key, cfg]) => (
                        <option
                          key={key}
                          value={key}
                          className="bg-neutral-950 text-white font-medium"
                        >
                          {cfg.label} ({cfg.desc})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 bg-neutral-900 border border-neutral-800 rounded-xl px-2 py-1.5" title="Ukuran Font Rarity (px)">
                    <input
                      type="number"
                      min="12"
                      max="80"
                      value={rarityFontSize}
                      onChange={(e) => setRarityFontSize(Number(e.target.value) || 12)}
                      className="w-8 bg-transparent text-xs text-amber-400 font-mono text-center focus:outline-none"
                    />
                    <span className="text-[10px] text-neutral-500 font-mono">px</span>
                  </div>
                </div>
              </div>

              {/* 4. Deskripsi Kartu (Biasa) */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-neutral-300">
                    Deskripsi Kartu (Maks 40 Kata)
                  </label>
                  <span className="text-[10px] text-neutral-500 font-mono">Font Size</span>
                </div>
                <div className="flex items-start gap-2">
                  <textarea
                    rows={2}
                    value={cardDesc}
                    onChange={(e) => setCardDesc(e.target.value)}
                    placeholder="ini deskripsi panjang, maksimal 40 kata"
                    className="flex-1 bg-black border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                  />
                  <div className="flex items-center gap-1 shrink-0 bg-neutral-900 border border-neutral-800 rounded-xl px-2 py-1.5 mt-0.5" title="Ukuran Font Deskripsi (px)">
                    <input
                      type="number"
                      min="12"
                      max="80"
                      value={descFontSize}
                      onChange={(e) => setDescFontSize(Number(e.target.value) || 12)}
                      className="w-8 bg-transparent text-xs text-amber-400 font-mono text-center focus:outline-none"
                    />
                    <span className="text-[10px] text-neutral-500 font-mono">px</span>
                  </div>
                </div>
              </div>

              {/* 5. Daftar Skill Kartu (Maksimal 3 Skill, Skill 2 & 3 Opsional) */}
              <div className="pt-2 border-t border-neutral-900 space-y-3.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-300">
                    Skill Kartu (Maks. 3)
                  </label>
                  <span className="text-[10px] text-neutral-500">Kosongkan jika tidak ada</span>
                </div>

                {skills.map((skill, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800/80 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-neutral-300">
                        Skill {index + 1} {index > 0 ? '(Opsional)' : ''}
                      </span>
                      <span className="text-[10px] text-neutral-500 font-mono">Font Size</span>
                    </div>

                    {/* Nama Skill */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={skill.name}
                        onChange={(e) => handleSkillChange(index, 'name', e.target.value)}
                        placeholder={`nama skill ${index + 1}`}
                        className="flex-1 bg-black border border-neutral-800 rounded-xl px-3 py-2 text-xs text-amber-300 font-semibold focus:outline-none focus:border-amber-500 transition-colors"
                      />
                      <div
                        className="flex items-center gap-1 shrink-0 bg-neutral-900 border border-neutral-800 rounded-xl px-2 py-1.5"
                        title={`Ukuran Font Nama Skill ${index + 1} (px)`}
                      >
                        <input
                          type="number"
                          min="12"
                          max="80"
                          value={skill.nameFontSize || 28}
                          onChange={(e) =>
                            handleSkillChange(
                              index,
                              'nameFontSize',
                              Number(e.target.value) || 12
                            )
                          }
                          className="w-8 bg-transparent text-xs text-amber-400 font-mono text-center focus:outline-none"
                        />
                        <span className="text-[10px] text-neutral-500 font-mono">px</span>
                      </div>
                    </div>

                    {/* Deskripsi Skill */}
                    <div className="flex items-start gap-2">
                      <textarea
                        rows={2}
                        value={skill.desc}
                        onChange={(e) => handleSkillChange(index, 'desc', e.target.value)}
                        placeholder={`deskripsi skill ${index + 1}`}
                        className="flex-1 bg-black border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-300 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                      />
                      <div
                        className="flex items-center gap-1 shrink-0 bg-neutral-900 border border-neutral-800 rounded-xl px-2 py-1.5 mt-0.5"
                        title={`Ukuran Font Deskripsi Skill ${index + 1} (px)`}
                      >
                        <input
                          type="number"
                          min="10"
                          max="80"
                          value={skill.descFontSize || 22}
                          onChange={(e) =>
                            handleSkillChange(
                              index,
                              'descFontSize',
                              Number(e.target.value) || 10
                            )
                          }
                          className="w-8 bg-transparent text-xs text-amber-400 font-mono text-center focus:outline-none"
                        />
                        <span className="text-[10px] text-neutral-500 font-mono">px</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tombol Aksi: Simpan & Ekspor Video Langsung */}
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSave}
                    disabled={isSaving || isRendering}
                    className="flex-1 py-2 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-950 disabled:opacity-50 text-neutral-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-neutral-800"
                    title="Simpan konfigurasi ke data.json"
                  >
                    {saveStatus ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="truncate">{saveStatus}</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5 text-neutral-400" />
                        <span>{isSaving ? 'Menyimpan...' : 'Simpan'}</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleRender}
                    disabled={isRendering || isSaving}
                    className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 text-black font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-amber-500/10 cursor-pointer"
                    title="Render video MP4 secara langsung dari browser"
                  >
                    {isRendering ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-black" />
                        <span>Rendering...</span>
                      </>
                    ) : (
                      <>
                        <Film className="w-3.5 h-3.5 text-black" />
                        <span>Ekspor MP4</span>
                      </>
                    )}
                  </button>
                </div>

                {renderStatus && (
                  <div className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-[11px] text-amber-300 flex items-center justify-between gap-2">
                    <span className="truncate">{renderStatus}</span>
                    {lastExportPath && (
                      <a
                        href={`/${lastExportPath}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-bold text-white hover:text-amber-400 shrink-0 text-xs underline"
                        title="Buka file video yang telah diekspor"
                      >
                        <span>Buka</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-4 py-4">
              <div className="text-xs text-neutral-400 leading-relaxed">
                Mode Roulette Quiz aktif untuk momen <strong className="text-white">{currentMoment?.name}</strong>.
              </div>
              <button
                onClick={handleRender}
                disabled={isRendering || isSaving}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-amber-500/10"
              >
                {isRendering ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Rendering Quiz...</span>
                  </>
                ) : (
                  <>
                    <Film className="w-3.5 h-3.5" />
                    <span>Ekspor Video Quiz (MP4)</span>
                  </>
                )}
              </button>
              {renderStatus && (
                <div className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-[11px] text-amber-300 flex items-center justify-between gap-2">
                  <span className="truncate">{renderStatus}</span>
                  {lastExportPath && (
                    <a
                      href={`/${lastExportPath}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-bold text-white hover:text-amber-400 shrink-0 text-xs underline"
                    >
                      <span>Buka</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Minimalis Status Ringkas */}
        <div className="text-[10px] font-mono text-neutral-600 border-t border-neutral-900/80 pt-3 flex justify-between items-center shrink-0">
          <span>9:16 • 80% Safe</span>
          <span className="text-neutral-500">{currentMoment?.name}</span>
        </div>
      </aside>
    </div>
  );
}
