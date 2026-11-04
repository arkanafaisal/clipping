import React, { useState, useEffect, useRef } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { MemeDiscoveryComposition } from './styles/meme-discovery/MemeDiscoveryComposition';
import { RouletteQuizComposition } from './styles/roulette-quiz/RouletteQuizComposition';
import initialData from './data.json';
import { captureVideoFrame } from './utils/frameCapture';
import { parseTimestampToSeconds } from './utils/time';
import { ArrowLeft, Check, Save, Sparkles, Layers } from 'lucide-react';

type StyleMode = 'meme-discovery' | 'roulette-quiz';

export default function App() {
  const [data, setData] = useState(initialData);
  const moments = data.moments || [];
  const currentMoment = moments[0]; // momen utama

  const [activeStyle, setActiveStyle] = useState<StyleMode>('meme-discovery');
  const playerRef = useRef<PlayerRef>(null);

  useEffect(() => {
    (window as any).playerRef = playerRef;
  }, []);

  // Input dan teks kartu Meme Discovery
  const initialMeme = currentMoment?.memeDiscovery || {};
  const [targetTimestamp, setTargetTimestamp] = useState<string>(
    initialMeme.targetUndoTimestamp || '00:07.105'
  );
  const [cardTitle, setCardTitle] = useState<string>(
    initialMeme.cardTitle || ''
  );
  const [cardRarity, setCardRarity] = useState<string>(
    initialMeme.cardRarity || ''
  );
  const [cardDesc, setCardDesc] = useState<string>(
    initialMeme.cardDesc || ''
  );
  const [passiveName, setPassiveName] = useState<string>(
    initialMeme.passiveName || ''
  );
  const [passiveDesc, setPassiveDesc] = useState<string>(
    initialMeme.passiveDesc || ''
  );

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Deteksi & download otomatis image.jpg dari Google Drive saat studio direload
  useEffect(() => {
    fetch('/api/check-image')
      .then((res) => res.json())
      .then((res) => {
        if (res.metadata) {
          setData(res.metadata);
          const updatedMoment = res.metadata.moments?.[0];
          const md = updatedMoment?.memeDiscovery;
          if (md) {
            if (md.targetUndoTimestamp) setTargetTimestamp(md.targetUndoTimestamp);
            if (md.cardTitle !== undefined) setCardTitle(md.cardTitle);
            if (md.cardRarity !== undefined) setCardRarity(md.cardRarity);
            if (md.cardDesc !== undefined) setCardDesc(md.cardDesc);
            if (md.passiveName !== undefined) setPassiveName(md.passiveName);
            if (md.passiveDesc !== undefined) setPassiveDesc(md.passiveDesc);
          }
        }
      })
      .catch((err) => {
        console.warn('Auto sync image failed on reload:', err);
      });
  }, []);

  const videoDurationSeconds =
    currentMoment?.files?.full?.durationSeconds || 10.95;
  const videoSrc = currentMoment
    ? `/temp/${currentMoment.path}/full.mp4`
    : '/temp/grim reaper/full.mp4';
  const imageSrc = currentMoment?.files?.image
    ? `/temp/${currentMoment.path}/image.jpg`
    : undefined;

  // Tangkapan frame beku statis (canvas) agar bebas jeda hitam & bebas seek delay
  const [lastFrameImage, setLastFrameImage] = useState<string | undefined>();
  const [targetFrameImage, setTargetFrameImage] = useState<string | undefined>();

  // 1. Ekstrak frame terakhir video (untuk fase jeda & rewind, diekstrak sekali per video)
  useEffect(() => {
    if (!videoSrc) return;
    let isCancelled = false;

    captureVideoFrame(videoSrc, Math.max(0, videoDurationSeconds - 0.45))
      .then((lastImg) => {
        if (!isCancelled) setLastFrameImage(lastImg);
      })
      .catch((err) => {
        console.warn('Gagal ekstrak last frame:', err);
      });

    return () => {
      isCancelled = true;
    };
  }, [videoSrc, videoDurationSeconds]);

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

  // Total durasi sekuens video berurutan:
  // 1. Video full play (Math.round(totalVideoDurationSeconds * 30))
  // 2. Jeda freeze akhir + pause icon (12f)
  // 3. YouTube skip backward effect (22f)
  // 4. Jeda viewer mencerna frame lucu (18f)
  // 5. Screenshot shutter flash (10f)
  // 6. Jeda 0.5 detik pasca-screenshot (15f)
  // 7. Kartu meme slide-up dari bawah (105f)
  const videoFrames = Math.round(videoDurationSeconds * 30);
  const totalFrames = videoFrames + 12 + 22 + 18 + 10 + 15 + 105;

  // Simpan nilai baru ke data.json via server endpoint
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedMoments = moments.map((m) => {
        if (m.name === currentMoment?.name || m.id === currentMoment?.id) {
          return {
            ...m,
            memeDiscovery: {
              ...(m.memeDiscovery || {}),
              targetUndoTimestamp: targetTimestamp,
              cardTitle,
              cardRarity,
              cardDesc,
              passiveName,
              passiveDesc,
            },
          };
        }
        return m;
      });

      const payload = {
        ...data,
        moments: updatedMoments,
      };

      const res = await fetch('/api/save-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setData(payload);
        setSaveStatus('Tersimpan ke data.json');
        setTimeout(() => setSaveStatus(null), 2500);
      } else {
        setSaveStatus('Gagal menyimpan');
        setTimeout(() => setSaveStatus(null), 3000);
      }
    } catch {
      setSaveStatus('Gagal menyimpan (offline)');
      setTimeout(() => setSaveStatus(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

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
                lastFrameImage,
                targetFrameImage,
                title: currentMoment?.memeDiscovery?.title || 'Meme Discovery: Momen Langka!',
                gameTitle: currentMoment?.name || 'Grim Reaper',
                cardTitle: cardTitle || undefined,
                cardRarity: cardRarity || undefined,
                cardDesc: cardDesc || undefined,
                passiveName: passiveName || undefined,
                passiveDesc: passiveDesc || undefined,
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
        {/* Header Bar: Back Button & Detail Mode Aktif */}
        <div className="flex items-center justify-between pb-3.5 border-b border-neutral-900 shrink-0">
          <button
            onClick={() =>
              setActiveStyle(
                activeStyle === 'meme-discovery'
                  ? 'roulette-quiz'
                  : 'meme-discovery'
              )
            }
            className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors py-1 px-2 rounded-lg hover:bg-neutral-900 cursor-pointer"
            title="Ganti Mode / Kembali"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Ganti Mode</span>
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
              {/* 1. Posisi Frame Target Undo */}
              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  Posisi Frame Target Undo
                </label>
                <input
                  type="text"
                  value={targetTimestamp}
                  onChange={(e) => setTargetTimestamp(e.target.value)}
                  placeholder="00:07.105"
                  className="w-full bg-black border border-neutral-800 rounded-xl px-3 py-2 text-xs font-mono text-amber-400 focus:outline-none focus:border-amber-500 transition-colors"
                />
                <p className="text-[10px] text-neutral-500 mt-1">
                  Format <code className="text-neutral-400">MM:SS.mmm</code> relatif dari detik 0 video.
                </p>
              </div>

              {/* 2. Judul Kartu */}
              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  Judul Kartu
                </label>
                <input
                  type="text"
                  value={cardTitle}
                  onChange={(e) => setCardTitle(e.target.value)}
                  placeholder="judul kartu"
                  className="w-full bg-black border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              {/* 3. Rarity */}
              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  Rarity Kartu
                </label>
                <input
                  type="text"
                  value={cardRarity}
                  onChange={(e) => setCardRarity(e.target.value)}
                  placeholder="rarity"
                  className="w-full bg-black border border-neutral-800 rounded-xl px-3 py-2 text-xs text-amber-400 font-bold focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              {/* 4. Deskripsi Kartu (Biasa) */}
              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  Deskripsi Kartu (Maks 40 Kata)
                </label>
                <textarea
                  rows={2}
                  value={cardDesc}
                  onChange={(e) => setCardDesc(e.target.value)}
                  placeholder="ini deskripsi panjang, maksimal 40 kata"
                  className="w-full bg-black border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                />
              </div>

              {/* 5. Nama Pasif (Jimat / Kekuatan Lucu) */}
              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  Nama Pasif (Jimat)
                </label>
                <input
                  type="text"
                  value={passiveName}
                  onChange={(e) => setPassiveName(e.target.value)}
                  placeholder="pasif"
                  className="w-full bg-black border border-neutral-800 rounded-xl px-3 py-2 text-xs text-amber-300 font-semibold focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              {/* 6. Deskripsi Pasif */}
              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  Deskripsi Pasif
                </label>
                <textarea
                  rows={2}
                  value={passiveDesc}
                  onChange={(e) => setPassiveDesc(e.target.value)}
                  placeholder="ini deskripsi pasif"
                  className="w-full bg-black border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-300 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                />
              </div>

              {/* Tombol Simpan ke data.json */}
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 text-black font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/10 cursor-pointer mt-2"
              >
                {saveStatus ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-950" />
                    <span>{saveStatus}</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{isSaving ? 'Menyimpan...' : 'Simpan ke data.json'}</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="text-xs text-neutral-500 leading-relaxed py-4">
              Mode Roulette Quiz aktif. Klik tombol "Ganti Mode" untuk kembali ke Meme Discovery.
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
