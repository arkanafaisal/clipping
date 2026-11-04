import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Video,
} from 'remotion';
import { VerticalVideoProps } from '../types';

export const VerticalShortsComposition: React.FC<VerticalVideoProps> = ({
  title,
  gameTitle,
  timestampText,
  captionText,
  showRoulettePreview = false,
  videoSrc,
  activeLaneIndex = 1,
  dimOpacity = 0.65,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();

  // Entrance spring animation for top banner
  const bannerProgress = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.8, stiffness: 100 },
  });

  const bannerY = interpolate(bannerProgress, [0, 1], [-120, 0]);
  const bannerOpacity = interpolate(bannerProgress, [0, 1], [0, 1]);

  // Roulette lane horizontal scrolling simulation
  const spinProgress = interpolate(
    frame,
    [0, 30, 90, 130],
    [0, 1200, 2400, 2760],
    {
      extrapolateRight: 'clamp',
    }
  );

  // Subtitle pulse effect
  const subtitleScale = interpolate(
    Math.sin((frame / fps) * Math.PI * 4),
    [-1, 1],
    [0.98, 1.02]
  );

  // Progress bar calculation
  const progressRatio = Math.min(1, Math.max(0, frame / durationInFrames));

  // Sample cards for roulette lane
  const sampleCards = [
    { id: 1, label: 'Momen 1', bg: 'from-amber-600 to-yellow-500' },
    { id: 2, label: 'Momen 2', bg: 'from-blue-600 to-cyan-500' },
    { id: 3, label: 'Momen 3', bg: 'from-purple-600 to-pink-500' },
    { id: 4, label: 'Target Menang', bg: 'from-emerald-500 to-teal-400' },
    { id: 5, label: 'Momen 5', bg: 'from-rose-600 to-red-500' },
    { id: 6, label: 'Momen 6', bg: 'from-indigo-600 to-violet-500' },
  ];

  return (
    <AbsoluteFill className="bg-neutral-950 text-white font-sans overflow-hidden select-none">
      {/* Dynamic Background Atmosphere */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-800/40 via-neutral-950 to-black" />

      {/* Grid Pattern overlay */}
      <div
        className="absolute inset-0 opacity-15"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* TOP SECTION: Header / Game Info & Timestamp */}
      <div
        className="absolute top-16 left-0 right-0 px-8 flex flex-col items-center gap-3 z-30"
        style={{
          transform: `translateY(${bannerY}px)`,
          opacity: bannerOpacity,
        }}
      >
        <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-neutral-900/90 border border-neutral-700/80 shadow-2xl backdrop-blur-md">
          <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xl font-bold tracking-wider uppercase text-neutral-200">
            {gameTitle}
          </span>
          <span className="text-neutral-500">•</span>
          <span className="text-lg font-mono text-amber-400 font-semibold">
            {timestampText}
          </span>
        </div>

        <h1 className="text-4xl font-black text-center tracking-tight text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] px-4">
          {title}
        </h1>
      </div>

      {/* MIDDLE SECTION: Video Canvas / Roulette / Real Video Playback */}
      <div className="absolute inset-x-8 top-52 bottom-64 rounded-3xl overflow-hidden border border-neutral-800 bg-neutral-900 shadow-2xl flex flex-col justify-center items-center">
        {videoSrc ? (
          /* Actual Video from Google Drive / Temp Folder */
          <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
            <Video
              src={videoSrc}
              className="w-full h-full object-cover"
            />
            {/* Watermark / Source Tag */}
            <div className="absolute top-4 right-4 px-3 py-1 rounded-md bg-black/60 border border-white/10 text-xs font-mono text-amber-300 backdrop-blur-md">
              Google Drive Stream (temp)
            </div>
          </div>
        ) : showRoulettePreview ? (
          /* Roulette Lanes Simulation */
          <div className="relative w-full h-full flex flex-col justify-around py-6 bg-neutral-950">
            {[0, 1, 2].map((laneIdx) => {
              const isActive = laneIdx === activeLaneIndex;
              const laneScrollX = isActive ? -(spinProgress % 1800) : -(frame * 4) % 1800;

              return (
                <div
                  key={laneIdx}
                  className="relative w-full h-36 overflow-hidden border-y border-neutral-800/80 bg-neutral-900/40"
                >
                  <div
                    className="absolute flex items-center gap-4 h-full px-4"
                    style={{
                      transform: `translateX(${laneScrollX}px)`,
                      width: '4000px',
                    }}
                  >
                    {[...sampleCards, ...sampleCards, ...sampleCards].map((card, i) => (
                      <div
                        key={i}
                        className={`h-28 w-44 rounded-xl flex flex-col items-center justify-center p-3 text-center shadow-lg bg-gradient-to-br ${card.bg} text-white font-bold text-lg border border-white/20 shrink-0`}
                      >
                        <span className="text-xs uppercase tracking-widest text-white/70">
                          #{i + 1}
                        </span>
                        <span>{card.label}</span>
                      </div>
                    ))}
                  </div>

                  {!isActive && (
                    <div
                      className="absolute inset-0 bg-black pointer-events-none transition-opacity"
                      style={{ opacity: dimOpacity }}
                    />
                  )}

                  {isActive && (
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1.5 bg-gradient-to-b from-amber-300 via-yellow-400 to-amber-500 shadow-[0_0_16px_rgba(250,204,21,0.9)] z-20 pointer-events-none">
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-yellow-400 rotate-45" />
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-yellow-400 rotate-45" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-8 gap-4">
            <div className="w-20 h-20 rounded-full bg-neutral-800 flex items-center justify-center text-3xl">
              🎬
            </div>
            <p className="text-neutral-400 text-xl font-medium max-w-md">
              Pilih video di panel kanan untuk memutar berkas dari Google Drive.
            </p>
          </div>
        )}
      </div>

      {/* LOWER SECTION: Caption / Subtitle Overlay */}
      <div className="absolute bottom-28 inset-x-8 flex flex-col items-center z-30">
        <div
          className="max-w-xl px-8 py-4 rounded-2xl bg-neutral-900/95 border border-neutral-700/80 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl text-center"
          style={{
            transform: `scale(${subtitleScale})`,
          }}
        >
          <p className="text-2xl font-extrabold text-amber-300 tracking-wide leading-relaxed">
            "{captionText}"
          </p>
        </div>
      </div>

      {/* BOTTOM SECTION: Progress Bar & Frame Counter */}
      <div className="absolute bottom-8 inset-x-8 flex flex-col gap-2 z-30">
        <div className="w-full h-2 rounded-full bg-neutral-800/80 overflow-hidden backdrop-blur-sm">
          <div
            className="h-full bg-gradient-to-r from-amber-500 via-rose-500 to-cyan-500 transition-all duration-75"
            style={{ width: `${progressRatio * 100}%` }}
          />
        </div>

        <div className="flex justify-between items-center text-xs text-neutral-400 font-mono">
          <span>
            Frame: {frame} / {durationInFrames} ({Math.round(frame / fps)}s)
          </span>
          <span className="text-emerald-400 font-semibold">
            {width}x{height} @ {fps}fps
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
