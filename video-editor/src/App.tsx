import React, { useState } from 'react';
import { Player } from '@remotion/player';
import { VerticalShortsComposition } from './remotion/compositions/VerticalShortsComposition';
import { VerticalVideoProps } from './remotion/types';
import metadata from './data/metadata.json';
import {
  Film,
  Sliders,
  Sparkles,
  Layers,
  Tv,
  FolderDown,
  CheckCircle2,
  HardDrive,
  RefreshCw,
} from 'lucide-react';

export default function App() {
  const moments = metadata.moments || [];
  const initialMoment = moments[0];

  const [selectedMomentName, setSelectedMomentName] = useState<string>(
    initialMoment?.name || 'grim reaper'
  );

  const [useRealVideo, setUseRealVideo] = useState<boolean>(true);

  const [props, setProps] = useState<VerticalVideoProps>({
    title: 'Grim Reaper Momen Seru',
    gameTitle: initialMoment?.name || 'Grim Reaper',
    timestampText: '00:00:10',
    captionText: 'Momen video Grim Reaper yang diunduh dari Google Drive!',
    videoSrc: '/temp/grim reaper/full.mp4',
    showRoulettePreview: false,
    activeLaneIndex: 1,
    dimOpacity: 0.65,
  });

  const [playbackRate, setPlaybackRate] = useState<number>(1);

  // Handle moment selection change
  const handleSelectMoment = (momentName: string) => {
    setSelectedMomentName(momentName);
    const m = moments.find((item) => item.name === momentName);
    if (m) {
      const videoPath = `/temp/${m.path}/full.mp4`;
      setProps({
        ...props,
        gameTitle: m.name,
        videoSrc: useRealVideo ? videoPath : undefined,
      });
    }
  };

  // Handle toggle between real video and roulette preview
  const handleToggleRealVideo = (enabled: boolean) => {
    setUseRealVideo(enabled);
    const m = moments.find((item) => item.name === selectedMomentName);
    const videoPath = m ? `/temp/${m.path}/full.mp4` : '/temp/grim reaper/full.mp4';
    setProps({
      ...props,
      videoSrc: enabled ? videoPath : undefined,
      showRoulettePreview: !enabled,
    });
  };

  const currentMoment = moments.find((m) => m.name === selectedMomentName) || initialMoment;

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

          <div className="flex items-center gap-3">
            <div className="text-xs font-mono text-neutral-400 bg-neutral-800/80 px-3 py-1.5 rounded-md border border-neutral-700/60 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              1080x1920 (9:16) • 30 FPS • 300 Frames (10s)
            </div>
          </div>
        </header>

        {/* Video Player Container */}
        <main className="flex-1 overflow-hidden p-6 flex flex-col items-center justify-center bg-[radial-gradient(#262626_1px,transparent_1px)] [background-size:24px_24px] relative">
          <div className="relative h-full max-h-[760px] aspect-[9/16] rounded-2xl overflow-hidden shadow-2xl shadow-black/80 border border-neutral-800 bg-black flex items-center justify-center">
            <Player
              component={VerticalShortsComposition}
              inputProps={props}
              durationInFrames={300}
              fps={30}
              compositionWidth={1080}
              compositionHeight={1920}
              style={{
                width: '100%',
                height: '100%',
              }}
              controls
              autoPlay
              loop
              playbackRate={playbackRate}
            />
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
          Google Drive Asset & Controls
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section: Google Drive Moments Metadata */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-400">
                <HardDrive className="w-3.5 h-3.5 text-neutral-500" />
                Google Drive Momen
              </span>
              <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {moments.length} Momen Tersedia
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
                    {m.name} ({m.files.full?.sizeFormatted || 'N/A'})
                  </option>
                ))}
              </select>
            </div>

            {/* Current Moment Status Card */}
            {currentMoment && (
              <div className="p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800 text-xs space-y-2">
                <div className="flex justify-between items-center text-neutral-400">
                  <span>Folder ID:</span>
                  <span className="font-mono text-neutral-300 text-[11px]">
                    {currentMoment.id.substring(0, 16)}...
                  </span>
                </div>
                <div className="flex justify-between items-center text-neutral-400">
                  <span>Video File:</span>
                  <span className="font-semibold text-neutral-200">
                    {currentMoment.files.full?.name || 'N/A'} ({currentMoment.files.full?.sizeFormatted || '0 MB'})
                  </span>
                </div>
                <div className="flex justify-between items-center text-neutral-400">
                  <span>Lokasi Lokal:</span>
                  <span className="font-mono text-emerald-400 text-[11px]">
                    public/{currentMoment.files.full?.tempRelPath}
                  </span>
                </div>
              </div>
            )}

            {/* Toggle Real Video vs Roulette */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-950 border border-neutral-800/80">
              <span className="text-xs font-medium text-neutral-300">
                Putar Video Asli Google Drive
              </span>
              <input
                type="checkbox"
                checked={useRealVideo}
                onChange={(e) => handleToggleRealVideo(e.target.checked)}
                className="w-4 h-4 accent-amber-500 cursor-pointer"
              />
            </div>
          </div>

          <hr className="border-neutral-800" />

          {/* Section: Text Content */}
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
                value={props.title}
                onChange={(e) => setProps({ ...props, title: e.target.value })}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-neutral-300 block mb-1">
                  Nama Game
                </label>
                <input
                  type="text"
                  value={props.gameTitle}
                  onChange={(e) => setProps({ ...props, gameTitle: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-300 block mb-1">
                  Timestamp
                </label>
                <input
                  type="text"
                  value={props.timestampText}
                  onChange={(e) =>
                    setProps({ ...props, timestampText: e.target.value })
                  }
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm font-mono text-neutral-100 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-300 block mb-1">
                Subtitle / Caption Bar
              </label>
              <textarea
                rows={2}
                value={props.captionText}
                onChange={(e) =>
                  setProps({ ...props, captionText: e.target.value })
                }
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500 transition-colors resize-none"
              />
            </div>
          </div>

          <hr className="border-neutral-800" />

          {/* Section: CLI Helper Callout */}
          <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 text-xs space-y-2.5">
            <p className="font-semibold text-neutral-200 flex items-center gap-1.5">
              <FolderDown className="w-4 h-4 text-amber-400" />
              CLI Moment Downloader
            </p>
            <p className="text-neutral-400 text-[11px] leading-relaxed">
              Jika file video di folder temp terhapus atau ingin mengambil momen lain dari Google Drive, jalankan di terminal:
            </p>
            <div className="bg-black/80 px-3 py-2 rounded-lg font-mono text-[11px] text-amber-300 border border-neutral-800 select-all">
              npm run download
            </div>
            <p className="text-neutral-500 text-[10px]">
              Atau sinkronkan metadata baru dengan: <code className="text-neutral-400">npm run sync</code>
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
