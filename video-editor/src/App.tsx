import React, { useState } from 'react';
import { Player } from '@remotion/player';
import { VerticalShortsComposition } from './remotion/compositions/VerticalShortsComposition';
import { VerticalVideoProps } from './remotion/types';
import {
  Film,
  Sliders,
  Play,
  RotateCcw,
  Sparkles,
  Layers,
  Settings2,
  Tv,
} from 'lucide-react';

export default function App() {
  const [props, setProps] = useState<VerticalVideoProps>({
    title: 'Tebak Momen Paling Lucu!',
    gameTitle: "Chilla's Art: The Bathhouse",
    timestampText: '00:15:20',
    captionText: 'Detik-detik penampakan muncul di balik tirai kamar mandi...',
    showRoulettePreview: true,
    activeLaneIndex: 1,
    dimOpacity: 0.65,
  });

  const [playbackRate, setPlaybackRate] = useState<number>(1);

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
                  Tailwind v4 + Remotion
                </span>
              </h1>
              <p className="text-xs text-neutral-400">
                Visualisasi kode sebelum rendering FFmpeg
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs font-mono text-neutral-400 bg-neutral-800/80 px-3 py-1.5 rounded-md border border-neutral-700/60 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              1080x1920 (9:16) • 30 FPS • 180 Frames (6s)
            </div>
          </div>
        </header>

        {/* Video Player Container */}
        <main className="flex-1 overflow-hidden p-6 flex flex-col items-center justify-center bg-[radial-gradient(#262626_1px,transparent_1px)] [background-size:24px_24px] relative">
          <div className="relative h-full max-h-[760px] aspect-[9/16] rounded-2xl overflow-hidden shadow-2xl shadow-black/80 border border-neutral-800 bg-black flex items-center justify-center">
            <Player
              component={VerticalShortsComposition}
              inputProps={props}
              durationInFrames={180}
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
          Live Composition Controls
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section: Text Content */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-400">
              <Tv className="w-3.5 h-3.5 text-neutral-500" />
              Teks & Informasi Video
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

            <div>
              <label className="text-xs font-medium text-neutral-300 block mb-1">
                Nama Game / Seri
              </label>
              <input
                type="text"
                value={props.gameTitle}
                onChange={(e) => setProps({ ...props, gameTitle: e.target.value })}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-neutral-300 block mb-1">
                  Timestamp Momen
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

              <div>
                <label className="text-xs font-medium text-neutral-300 block mb-1">
                  Jalur Aktif (0-2)
                </label>
                <select
                  value={props.activeLaneIndex}
                  onChange={(e) =>
                    setProps({ ...props, activeLaneIndex: Number(e.target.value) })
                  }
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500 transition-colors"
                >
                  <option value={0}>Jalur 1 (Atas)</option>
                  <option value={1}>Jalur 2 (Tengah)</option>
                  <option value={2}>Jalur 3 (Bawah)</option>
                </select>
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

          {/* Section: Effect & Overlay Simulation */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-400">
              <Sparkles className="w-3.5 h-3.5 text-neutral-500" />
              Efek & Simulasi Kompilasi
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-950 border border-neutral-800/80">
              <span className="text-sm font-medium text-neutral-300">
                Tampilkan Roda Roulette
              </span>
              <input
                type="checkbox"
                checked={props.showRoulettePreview}
                onChange={(e) =>
                  setProps({ ...props, showRoulettePreview: e.target.checked })
                }
                className="w-4 h-4 accent-amber-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between items-center text-xs font-medium text-neutral-300 mb-2">
                <span>Spotlight Dark Overlay Dim</span>
                <span className="font-mono text-amber-400">
                  {Math.round((props.dimOpacity ?? 0.65) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.95"
                step="0.05"
                value={props.dimOpacity}
                onChange={(e) =>
                  setProps({ ...props, dimOpacity: parseFloat(e.target.value) })
                }
                className="w-full accent-amber-500 cursor-pointer"
              />
              <p className="text-[11px] text-neutral-500 mt-1">
                Mengatur kegelapan kartu non-aktif sesuai parameter ROULETTE_DIM_OPACITY.
              </p>
            </div>
          </div>

          <hr className="border-neutral-800" />

          {/* Information Callout */}
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 leading-relaxed space-y-2">
            <p className="font-semibold text-amber-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              Keunggulan Remotion + Tailwind
            </p>
            <p>
              Perubahan desain, posisi kartu, easing curve, dan font langsung terlihat seketika via browser (Hot Reload) tanpa perlu rendering ulang file video via FFmpeg.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
