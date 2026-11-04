import React, { useState } from 'react';
import { Player } from '@remotion/player';
import { MemeDiscoveryComposition } from './styles/meme-discovery/MemeDiscoveryComposition';
import { MemeDiscoveryProps } from './styles/meme-discovery/types';
import { RouletteQuizComposition } from './styles/roulette-quiz/RouletteQuizComposition';
import { RouletteQuizProps } from './styles/roulette-quiz/types';
import data from './data.json';
import {
  Film,
  Sliders,
  Sparkles,
  Layers,
  Tv,
  FolderDown,
  CheckCircle2,
  HardDrive,
  CreditCard,
  ShieldAlert,
  Eye,
  EyeOff,
} from 'lucide-react';

type StyleMode = 'meme-discovery' | 'roulette-quiz';

export default function App() {
  const moments = data.moments || [];
  const initialMoment = moments[0];

  const [activeStyle, setActiveStyle] = useState<StyleMode>('meme-discovery');
  const [selectedMomentName, setSelectedMomentName] = useState<string>(
    initialMoment?.name || 'grim reaper'
  );
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [showSafeZoneGuides, setShowSafeZoneGuides] = useState<boolean>(false);

  const currentMoment = moments.find((m) => m.name === selectedMomentName) || initialMoment;
  const currentVideoSrc = currentMoment ? `/temp/${currentMoment.path}/full.mp4` : '/temp/grim reaper/full.mp4';
  const currentImageSrc = currentMoment?.files.image
    ? `/temp/${currentMoment.path}/image.jpg`
    : undefined;

  const videoDurationSeconds = currentMoment?.files.full?.durationSeconds || 10.95;
  const totalFrames = Math.max(180, Math.round(videoDurationSeconds * 30));

  // Initial config from data.json's memeDiscovery
  const initialMemeConfig = currentMoment?.memeDiscovery || {
    targetUndoTimestamp: '00:03.466',
    rewindDurationSeconds: 0.8,
    title: 'Meme Discovery: Momen Langka!',
    cardTitle: 'Grim Reaper Facecam',
    cardSubtitle: 'Meme Discovery Series #01',
    cardRarity: '⭐⭐⭐⭐⭐ SSR LEGENDARY',
    hp: 9999,
    attackName: 'Ekspresi Lucu Jumpscare',
    attackDesc: 'Menatap tajam ke kamera dengan ekspresi bingung yang memicu tawa penonton.',
  };

  // State for Meme Discovery style
  const [memeProps, setMemeProps] = useState<MemeDiscoveryProps>({
    videoSrc: currentVideoSrc,
    title: initialMemeConfig.title,
    gameTitle: currentMoment?.name || 'Grim Reaper',
    targetUndoTimestamp: initialMemeConfig.targetUndoTimestamp,
    rewindDurationSeconds: initialMemeConfig.rewindDurationSeconds,
    cardTitle: initialMemeConfig.cardTitle,
    cardSubtitle: initialMemeConfig.cardSubtitle,
    cardRarity: initialMemeConfig.cardRarity,
    cardImageSrc: currentImageSrc,
    hp: initialMemeConfig.hp,
    attackName: initialMemeConfig.attackName,
    attackDesc: initialMemeConfig.attackDesc,
    showSafeZoneGuides,
  });

  // State for Roulette Quiz style
  const [quizProps, setQuizProps] = useState<RouletteQuizProps>({
    title: 'Grim Reaper Momen Seru',
    gameTitle: currentMoment?.name || 'Grim Reaper',
    timestampText: '00:00:10',
    captionText: 'Momen video Grim Reaper yang diunduh dari Google Drive!',
    videoSrc: currentVideoSrc,
    showRoulettePreview: false,
    activeLaneIndex: 1,
    dimOpacity: 0.65,
  });

  // Handle moment change
  const handleSelectMoment = (momentName: string) => {
    setSelectedMomentName(momentName);
    const m = moments.find((item) => item.name === momentName);
    if (m) {
      const videoPath = `/temp/${m.path}/full.mp4`;
      const imagePath = m.files.image ? `/temp/${m.path}/image.jpg` : undefined;
      const mConfig = m.memeDiscovery || initialMemeConfig;

      setMemeProps((prev) => ({
        ...prev,
        gameTitle: m.name,
        videoSrc: videoPath,
        cardImageSrc: imagePath,
        title: mConfig.title || prev.title,
        targetUndoTimestamp: mConfig.targetUndoTimestamp || prev.targetUndoTimestamp,
        cardTitle: mConfig.cardTitle || prev.cardTitle,
        cardRarity: mConfig.cardRarity || prev.cardRarity,
        hp: mConfig.hp || prev.hp,
        attackName: mConfig.attackName || prev.attackName,
        attackDesc: mConfig.attackDesc || prev.attackDesc,
      }));

      setQuizProps((prev) => ({
        ...prev,
        gameTitle: m.name,
        videoSrc: videoPath,
      }));
    }
  };

  // Toggle safe zone guides
  const toggleSafeZoneGuides = () => {
    const nextVal = !showSafeZoneGuides;
    setShowSafeZoneGuides(nextVal);
    setMemeProps((prev) => ({ ...prev, showSafeZoneGuides: nextVal }));
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-neutral-950 text-neutral-100">
      {/* LEFT: Main Video Studio Canvas & Player */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-neutral-800">
        {/* Top Header */}
        <header className="h-14 px-6 border-b border-neutral-800 bg-neutral-900/60 backdrop-blur-md flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/20">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wide flex items-center gap-2">
                Programmatic Video Studio
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                  Google Drive + Remotion
                </span>
              </h1>
              <p className="text-xs text-neutral-400">
                Visualisasi video & komponen web sebelum render FFmpeg
              </p>
            </div>
          </div>

          {/* Style Switcher Tabs in Header */}
          <div className="flex items-center gap-2 bg-neutral-900 p-1 rounded-xl border border-neutral-800">
            <button
              onClick={() => setActiveStyle('meme-discovery')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeStyle === 'meme-discovery'
                  ? 'bg-amber-500 text-black shadow-md font-bold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Meme Discovery
            </button>
            <button
              onClick={() => setActiveStyle('roulette-quiz')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeStyle === 'roulette-quiz'
                  ? 'bg-amber-500 text-black shadow-md font-bold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Roulette Quiz
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleSafeZoneGuides}
              className={`text-xs px-2.5 py-1.5 rounded-md border font-mono flex items-center gap-1.5 transition-colors ${
                showSafeZoneGuides
                  ? 'bg-red-950/80 border-red-700 text-red-300'
                  : 'bg-neutral-800/80 border-neutral-700/60 text-neutral-400 hover:text-neutral-200'
              }`}
              title="Toggle garis panduan Safe Zone 80% (area tertutup medsos atas & bawah)"
            >
              {showSafeZoneGuides ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              Safe Zone 80%
            </button>

            <div className="text-xs font-mono text-neutral-400 bg-neutral-800/80 px-3 py-1.5 rounded-md border border-neutral-700/60 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              1080x1920 (9:16) • 80% Safe Area
            </div>
          </div>
        </header>

        {/* Video Player Container */}
        <main className="flex-1 overflow-hidden p-6 flex flex-col items-center justify-center bg-[radial-gradient(#262626_1px,transparent_1px)] [background-size:24px_24px] relative">
          <div className="relative h-full max-h-[760px] aspect-[9/16] rounded-2xl overflow-hidden shadow-2xl shadow-black/80 border border-neutral-800 bg-black flex items-center justify-center">
            {activeStyle === 'meme-discovery' ? (
              <Player
                component={MemeDiscoveryComposition}
                inputProps={{
                  ...memeProps,
                  showSafeZoneGuides,
                }}
                durationInFrames={totalFrames}
                fps={30}
                compositionWidth={1080}
                compositionHeight={1920}
                style={{ width: '100%', height: '100%' }}
                controls
                autoPlay
                loop
                playbackRate={playbackRate}
              />
            ) : (
              <Player
                component={RouletteQuizComposition}
                inputProps={quizProps}
                durationInFrames={totalFrames}
                fps={30}
                compositionWidth={1080}
                compositionHeight={1920}
                style={{ width: '100%', height: '100%' }}
                controls
                autoPlay
                loop
                playbackRate={playbackRate}
              />
            )}
          </div>

          {/* Quick Player Bar */}
          <div className="mt-4 flex items-center gap-3 bg-neutral-900/90 border border-neutral-800 px-4 py-2 rounded-xl backdrop-blur-md shadow-xl">
            <span className="text-xs font-medium text-neutral-400">Kecepatan:</span>
            {[0.5, 1, 1.5, 2].map((rate) => (
              <button
                key={rate}
                onClick={() => setPlaybackRate(rate)}
                className={`text-xs px-2.5 py-1 rounded-md font-mono transition-all ${
                  playbackRate === rate
                    ? 'bg-amber-500 text-black font-bold shadow'
                    : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>
        </main>
      </div>

      {/* RIGHT: Live Interactive Controls & Parameters Sidebar */}
      <aside className="w-96 flex flex-col bg-neutral-900/40 backdrop-blur-xl shrink-0">
        <div className="h-14 px-6 border-b border-neutral-800 flex items-center gap-2 text-sm font-semibold text-neutral-200">
          <Sliders className="w-4 h-4 text-amber-400" />
          {activeStyle === 'meme-discovery' ? 'Meme Discovery Config' : 'Roulette Quiz Controls'}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Google Drive Asset Selector */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-400">
                <HardDrive className="w-3.5 h-3.5 text-neutral-500" />
                Google Drive Momen
              </span>
              <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {moments.length} Momen
              </span>
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-300 block mb-1">
                Pilih Momen / Folder
              </label>
              <select
                value={selectedMomentName}
                onChange={(e) => handleSelectMoment(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500 transition-colors"
              >
                {moments.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name} ({m.files.full?.durationFormatted || m.files.full?.sizeFormatted || 'N/A'})
                  </option>
                ))}
              </select>
            </div>

            {/* Current Moment Status */}
            {currentMoment && (
              <div className="p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800 text-xs space-y-2">
                <div className="flex justify-between items-center text-neutral-400">
                  <span>File Video:</span>
                  <span className="font-semibold text-neutral-200">
                    {currentMoment.files.full?.name || 'full.mp4'} ({currentMoment.files.full?.sizeFormatted})
                  </span>
                </div>
                <div className="flex justify-between items-center text-neutral-400">
                  <span>Durasi Asli:</span>
                  <span className="font-mono text-amber-400 font-bold">
                    {currentMoment.files.full?.durationFormatted || 'N/A'} ({videoDurationSeconds}s)
                  </span>
                </div>
                <div className="flex justify-between items-center text-neutral-400">
                  <span>Safe Zone Canvas:</span>
                  <span className="font-mono text-emerald-400 text-[11px]">
                    9:16 (80% Area Aman Aktif)
                  </span>
                </div>
                <div className="flex justify-between items-center text-neutral-400">
                  <span>Aset Kartu 1:1:</span>
                  <span className="font-mono text-neutral-300 text-[11px]">
                    {currentMoment.files.image ? 'Tersedia di Drive (image.jpg)' : 'Freeze Frame Video'}
                  </span>
                </div>
              </div>
            )}
          </div>

          <hr className="border-neutral-800" />

          {/* Section 2: Conditional Controls based on Style */}
          {activeStyle === 'meme-discovery' ? (
            <div className="space-y-6">
              {/* Callout Info: Konfigurasi data.json */}
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs space-y-1.5 text-amber-200">
                <div className="flex items-center gap-1.5 font-bold text-amber-300">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Konfigurasi Tersinkron `data.json`
                </div>
                <p className="text-[11px] text-amber-200/80 leading-snug">
                  Nilai detik & milidetik undo diinput manual dari video editor HP (relatif dari awal video), dan tersimpan pada properti <code className="bg-black/50 px-1 py-0.5 rounded text-amber-300 font-mono">memeDiscovery</code> di `data.json`.
                </p>
              </div>

              {/* Meme Discovery Props */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-400">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Parameter Seek Undo Video
                </div>

                <div>
                  <label className="text-xs font-medium text-neutral-300 block mb-1">
                    Judul Banner Atas (Safe Zone)
                  </label>
                  <input
                    type="text"
                    value={memeProps.title}
                    onChange={(e) => setMemeProps({ ...memeProps, title: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-neutral-300 block mb-1">
                      Target Undo (MM:SS.mmm)
                    </label>
                    <input
                      type="text"
                      value={memeProps.targetUndoTimestamp}
                      onChange={(e) =>
                        setMemeProps({ ...memeProps, targetUndoTimestamp: e.target.value })
                      }
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm font-mono text-amber-300 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-neutral-300 block mb-1">
                      Durasi Undo (detik)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={memeProps.rewindDurationSeconds}
                      onChange={(e) =>
                        setMemeProps({
                          ...memeProps,
                          rewindDurationSeconds: parseFloat(e.target.value) || 0.8,
                        })
                      }
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm font-mono text-neutral-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              <hr className="border-neutral-800" />

              {/* Pokemon Card Customizer */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-400">
                  <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                  Kustomisasi Kartu Holographic 1:1
                </div>

                <div>
                  <label className="text-xs font-medium text-neutral-300 block mb-1">
                    Nama Karakter Kartu
                  </label>
                  <input
                    type="text"
                    value={memeProps.cardTitle}
                    onChange={(e) => setMemeProps({ ...memeProps, cardTitle: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-neutral-300 block mb-1">
                      Rarity Bintang
                    </label>
                    <input
                      type="text"
                      value={memeProps.cardRarity}
                      onChange={(e) => setMemeProps({ ...memeProps, cardRarity: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-neutral-300 block mb-1">
                      HP Power
                    </label>
                    <input
                      type="number"
                      value={memeProps.hp}
                      onChange={(e) =>
                        setMemeProps({ ...memeProps, hp: parseInt(e.target.value) || 100 })
                      }
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm font-mono text-emerald-400 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-neutral-300 block mb-1">
                    Nama Jurus / Serangan
                  </label>
                  <input
                    type="text"
                    value={memeProps.attackName}
                    onChange={(e) => setMemeProps({ ...memeProps, attackName: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-neutral-300 block mb-1">
                    Deskripsi Efek Kartu (Dukung \n manual)
                  </label>
                  <textarea
                    rows={2}
                    value={memeProps.attackDesc}
                    onChange={(e) => setMemeProps({ ...memeProps, attackDesc: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-amber-500 resize-none"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Roulette Quiz Controls */
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-400">
                <Tv className="w-3.5 h-3.5 text-neutral-500" />
                Teks & Overlay Video
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-300 block mb-1">
                  Judul Utama
                </label>
                <input
                  type="text"
                  value={quizProps.title}
                  onChange={(e) => setQuizProps({ ...quizProps, title: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-neutral-300 block mb-1">
                    Nama Game
                  </label>
                  <input
                    type="text"
                    value={quizProps.gameTitle}
                    onChange={(e) => setQuizProps({ ...quizProps, gameTitle: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-neutral-300 block mb-1">
                    Timestamp
                  </label>
                  <input
                    type="text"
                    value={quizProps.timestampText}
                    onChange={(e) =>
                      setQuizProps({ ...quizProps, timestampText: e.target.value })
                    }
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm font-mono text-neutral-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-300 block mb-1">
                  Subtitle / Caption Bar
                </label>
                <textarea
                  rows={2}
                  value={quizProps.captionText}
                  onChange={(e) =>
                    setQuizProps({ ...quizProps, captionText: e.target.value })
                  }
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-950 border border-neutral-800/80">
                <span className="text-xs font-medium text-neutral-300">
                  Tampilkan Animasi Roulette
                </span>
                <input
                  type="checkbox"
                  checked={quizProps.showRoulettePreview}
                  onChange={(e) =>
                    setQuizProps({ ...quizProps, showRoulettePreview: e.target.checked })
                  }
                  className="w-4 h-4 accent-amber-500 cursor-pointer"
                />
              </div>
            </div>
          )}

          <hr className="border-neutral-800" />

          {/* Section: CLI Helper Callout */}
          <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 text-xs space-y-2.5">
            <p className="font-semibold text-neutral-200 flex items-center gap-1.5">
              <FolderDown className="w-4 h-4 text-amber-400" />
              CLI Moment Downloader & Sync
            </p>
            <p className="text-neutral-400 text-[11px] leading-relaxed">
              Sinkronkan metadata durasi terbaru atau unduh momen baru dari Google Drive:
            </p>
            <div className="bg-black/80 px-3 py-2 rounded-lg font-mono text-[11px] text-amber-300 border border-neutral-800 select-all">
              npm run sync
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
