import React, { useState } from 'react';
import { Player } from '@remotion/player';
import { MemeDiscoveryComposition } from './styles/meme-discovery/MemeDiscoveryComposition';
import { RouletteQuizComposition } from './styles/roulette-quiz/RouletteQuizComposition';
import initialData from './data.json';
import { ArrowLeft, Check, Save, Sparkles, Layers } from 'lucide-react';

type StyleMode = 'meme-discovery' | 'roulette-quiz';

export default function App() {
  const [data, setData] = useState(initialData);
  const moments = data.moments || [];
  const currentMoment = moments[0]; // momen utama

  const [activeStyle, setActiveStyle] = useState<StyleMode>('meme-discovery');

  // Input timestamp posisi frame relatif dari detik 0
  const initialTimestamp =
    currentMoment?.memeDiscovery?.targetUndoTimestamp || '00:03.466';
  const [targetTimestamp, setTargetTimestamp] = useState<string>(initialTimestamp);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const videoDurationSeconds =
    currentMoment?.files?.full?.durationSeconds || 10.95;
  const videoSrc = currentMoment
    ? `/temp/${currentMoment.path}/full.mp4`
    : '/temp/grim reaper/full.mp4';
  const imageSrc = currentMoment?.files?.image
    ? `/temp/${currentMoment.path}/image.jpg`
    : undefined;

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
              component={MemeDiscoveryComposition}
              inputProps={{
                videoSrc,
                targetUndoTimestamp: targetTimestamp,
                totalVideoDurationSeconds: videoDurationSeconds,
                cardImageSrc: imageSrc,
                title: currentMoment?.memeDiscovery?.title || 'Meme Discovery: Momen Langka!',
                gameTitle: currentMoment?.name || 'Grim Reaper',
                cardTitle: currentMoment?.memeDiscovery?.cardTitle || 'Grim Reaper Facecam',
                cardSubtitle: currentMoment?.memeDiscovery?.cardSubtitle || 'Meme Discovery Series #01',
                cardRarity: currentMoment?.memeDiscovery?.cardRarity || '⭐⭐⭐⭐⭐ SSR LEGENDARY',
                hp: currentMoment?.memeDiscovery?.hp || 9999,
                attackName: currentMoment?.memeDiscovery?.attackName || 'Ekspresi Lucu Jumpscare',
                attackDesc: currentMoment?.memeDiscovery?.attackDesc || 'Menatap tajam ke kamera dengan ekspresi bingung yang memicu tawa penonton.',
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

      {/* SIDEBAR MINIMALIS: Hanya Detail Mode Aktif, Back Button, Input Timestamp & Save */}
      <aside className="w-80 h-screen border-l border-neutral-900 bg-neutral-950/90 flex flex-col justify-between p-6 shrink-0">
        <div className="space-y-6">
          {/* Header Bar: Back Button & Detail Mode Aktif */}
          <div className="flex items-center justify-between pb-4 border-b border-neutral-900">
            <button
              onClick={() =>
                setActiveStyle(
                  activeStyle === 'meme-discovery'
                    ? 'roulette-quiz'
                    : 'meme-discovery'
                )
              }
              className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors py-1 px-2 rounded-lg hover:bg-neutral-900"
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

          {/* Kontrol Input: Hanya Posisi Frame Target Undo & Tombol Save */}
          {activeStyle === 'meme-discovery' ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1.5">
                  Posisi Frame Target Undo
                </label>
                <input
                  type="text"
                  value={targetTimestamp}
                  onChange={(e) => setTargetTimestamp(e.target.value)}
                  placeholder="00:03.466"
                  className="w-full bg-black border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-amber-400 focus:outline-none focus:border-amber-500 transition-colors"
                />
                <p className="text-[11px] text-neutral-500 mt-1.5">
                  Format <code className="text-neutral-400">MM:SS.mmm</code> relatif dari detik 0 video (hasil cek HP).
                </p>
              </div>

              {/* Tombol Simpan Otomatis ke data.json */}
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 text-black font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/10 cursor-pointer"
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
            </div>
          ) : (
            <div className="text-xs text-neutral-500 leading-relaxed">
              Mode Roulette Quiz aktif. Klik tombol "Ganti Mode" untuk kembali ke Meme Discovery.
            </div>
          )}
        </div>

        {/* Footer Minimalis Status Ringkas */}
        <div className="text-[10px] font-mono text-neutral-600 border-t border-neutral-900/80 pt-3 flex justify-between items-center">
          <span>9:16 • 80% Safe</span>
          <span className="text-neutral-500">{currentMoment?.name}</span>
        </div>
      </aside>
    </div>
  );
}
