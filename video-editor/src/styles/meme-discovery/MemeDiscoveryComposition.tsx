import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Video,
} from 'remotion';
import { MemeDiscoveryProps } from './types';
import { parseTimestampToSeconds } from '../../utils/time';
import { ShutterFlash } from './components/ShutterFlash';
import { PokemonCard } from './components/PokemonCard';
import { RewindEffect } from './components/RewindEffect';

export const MemeDiscoveryComposition: React.FC<MemeDiscoveryProps> = ({
  videoSrc,
  title = 'Meme Discovery: Momen Langka!',
  gameTitle = 'Grim Reaper',
  targetUndoTimestamp = '00:03.450',
  rewindDurationSeconds = 0.8,
  cardTitle = 'Grim Reaper Facecam',
  cardSubtitle = 'Meme Discovery Series #01',
  cardRarity = '⭐⭐⭐⭐⭐ SSR LEGENDARY',
  cardImageSrc,
  hp = 9999,
  attackName = 'Ekspresi Lucu Jumpscare',
  attackDesc = 'Menatap tajam ke kamera dengan ekspresi bingung yang memicu tawa penonton.',
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const targetUndoSeconds = parseTimestampToSeconds(targetUndoTimestamp);
  const targetUndoFrame = Math.round(targetUndoSeconds * fps);

  // Time sequence milestones:
  // 1. Playback utama: 0 sampai frame 150 (5 detik)
  const playDurationFrames = 150;
  // 2. Rewind / Undo: durasi rewindFrames (default 0.8s * 30 = 24 frame)
  const rewindFrames = Math.max(15, Math.round((rewindDurationSeconds || 0.8) * fps));
  const rewindStartFrame = playDurationFrames;
  const rewindEndFrame = rewindStartFrame + rewindFrames;
  // 3. Shutter Flash: 12 frame
  const flashStartFrame = rewindEndFrame;
  const flashDurationFrames = 12;
  const flashEndFrame = flashStartFrame + flashDurationFrames;
  // 4. Card Reveal: dari flashEndFrame sampai akhir
  const cardStartFrame = flashStartFrame + 3;

  // Determine current active state
  const isPlaying = frame < rewindStartFrame;
  const isRewinding = frame >= rewindStartFrame && frame < rewindEndFrame;
  const isFlashing = frame >= flashStartFrame && frame < flashEndFrame;
  const isCardRevealed = frame >= cardStartFrame;

  // Calculate current playback time for the video
  let currentVideoSeconds = (frame / fps);
  if (isRewinding) {
    const rewindProgress = (frame - rewindStartFrame) / rewindFrames;
    const playEndSeconds = playDurationFrames / fps;
    currentVideoSeconds = interpolate(
      rewindProgress,
      [0, 1],
      [playEndSeconds, targetUndoSeconds]
    );
  } else if (frame >= rewindEndFrame) {
    currentVideoSeconds = targetUndoSeconds;
  }

  // Flash progress (0 to 1)
  const flashProgress = isFlashing
    ? (frame - flashStartFrame) / flashDurationFrames
    : 0;

  // Card spring scale entrance
  const cardSpring = spring({
    frame: frame - cardStartFrame,
    fps,
    config: { damping: 12, mass: 0.7, stiffness: 120 },
  });

  return (
    <AbsoluteFill className="bg-neutral-950 text-white font-sans overflow-hidden select-none">
      {/* Background Atmosphere */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-800/40 via-neutral-950 to-black" />

      {/* TOP HEADER */}
      <div className="absolute top-14 left-0 right-0 px-8 flex flex-col items-center gap-2 z-30">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-neutral-900/90 border border-neutral-700/80 shadow-xl backdrop-blur-md">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
          <span className="text-sm font-bold tracking-wider uppercase text-neutral-200">
            {gameTitle}
          </span>
          <span className="text-neutral-500">•</span>
          <span className="text-xs font-mono text-amber-400 font-semibold">
            TARGET: {targetUndoTimestamp}
          </span>
        </div>

        <h1 className="text-3xl font-black text-center tracking-tight text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
          {title}
        </h1>
      </div>

      {/* MAIN VIDEO STAGE */}
      <div className="absolute inset-x-8 top-44 bottom-32 rounded-3xl overflow-hidden border border-neutral-800 bg-black shadow-2xl flex items-center justify-center">
        {videoSrc ? (
          <div className="relative w-full h-full overflow-hidden flex items-center justify-center">
            {/* When rewinding or frozen, we render video paused or startFrom target */}
            {isPlaying ? (
              <Video
                src={videoSrc}
                className="w-full h-full object-cover"
              />
            ) : (
              <Video
                src={videoSrc}
                startFrom={Math.round(currentVideoSeconds * fps)}
                className="w-full h-full object-cover pointer-events-none"
              />
            )}

            {/* Video Stage Dark Dim when Card is Pop-up */}
            {isCardRevealed && (
              <div className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-all duration-300 z-20" />
            )}
          </div>
        ) : (
          <div className="text-center p-8 text-neutral-500">
            Video tidak ditemukan. Jalankan <code className="text-amber-400">npm run download</code>
          </div>
        )}

        {/* Rewind / Undo Overlay Effect */}
        {isRewinding && (
          <RewindEffect
            progress={(frame - rewindStartFrame) / rewindFrames}
            currentRewindSec={currentVideoSeconds}
          />
        )}

        {/* Camera Shutter White Flash */}
        {isFlashing && <ShutterFlash progress={flashProgress} />}

        {/* 1:1 Holographic Pokemon Card Center Stage */}
        {isCardRevealed && (
          <div className="absolute inset-0 flex items-center justify-center z-40 p-4">
            <PokemonCard
              cardTitle={cardTitle}
              cardSubtitle={cardSubtitle}
              cardRarity={cardRarity}
              imageSrc={cardImageSrc}
              videoSrc={videoSrc}
              targetUndoSeconds={targetUndoSeconds}
              hp={hp}
              attackName={attackName}
              attackDesc={attackDesc}
              scaleProgress={cardSpring}
              frame={frame}
            />
          </div>
        )}
      </div>

      {/* FOOTER BAR */}
      <div className="absolute bottom-10 inset-x-8 flex justify-between items-center text-xs font-mono text-neutral-400 z-30 bg-neutral-900/60 px-5 py-2.5 rounded-xl border border-neutral-800/80 backdrop-blur-md">
        <span className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isCardRevealed ? 'bg-amber-400' : isRewinding ? 'bg-rose-500 animate-ping' : 'bg-emerald-400'}`} />
          MODE: {isCardRevealed ? 'DISCOVERY REVEAL' : isRewinding ? 'UNDO / REWIND' : 'PLAYBACK'}
        </span>
        <span className="text-amber-300 font-bold">
          {Math.round(currentVideoSeconds * 10) / 10}s / {Math.round(durationInFrames / fps)}s
        </span>
      </div>
    </AbsoluteFill>
  );
};
