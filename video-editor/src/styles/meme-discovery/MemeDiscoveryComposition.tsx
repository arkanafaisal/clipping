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
  targetUndoTimestamp = '00:03.466',
  rewindDurationSeconds = 0.8,
  cardTitle = 'Grim Reaper Facecam',
  cardSubtitle = 'Meme Discovery Series #01',
  cardRarity = '⭐⭐⭐⭐⭐ SSR LEGENDARY',
  cardImageSrc,
  hp = 9999,
  attackName = 'Ekspresi Lucu Jumpscare',
  attackDesc = 'Menatap tajam ke kamera dengan ekspresi bingung yang memicu tawa penonton.',
  showSafeZoneGuides = false,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Detik target saat berhenti undo (relatif dari awal video)
  const targetUndoSeconds = parseTimestampToSeconds(targetUndoTimestamp);

  // Time sequence:
  // 1. Durasi animasi Card Reveal di akhir video: 90 frame (3s)
  const cardDisplayFrames = 90;
  // 2. Durasi flash shutter kamera: 10 frame (~0.33s)
  const flashDurationFrames = 10;
  // 3. Durasi rewind / undo: rewindDurationSeconds (default 0.8s * 30 = 24 frame)
  const rewindFrames = Math.max(15, Math.round((rewindDurationSeconds || 0.8) * fps));

  // Sequence Milestones:
  // Total durasi sekuens penutup = rewindFrames + flashDurationFrames + cardDisplayFrames
  const endSequenceFrames = rewindFrames + flashDurationFrames + cardDisplayFrames;
  const playDurationFrames = Math.max(30, durationInFrames - endSequenceFrames);

  const rewindStartFrame = playDurationFrames;
  const rewindEndFrame = rewindStartFrame + rewindFrames;
  const flashStartFrame = rewindEndFrame;
  const flashEndFrame = flashStartFrame + flashDurationFrames;
  const cardStartFrame = flashStartFrame + 3;

  // State fase aktif
  const isPlaying = frame < rewindStartFrame;
  const isRewinding = frame >= rewindStartFrame && frame < rewindEndFrame;
  const isFlashing = frame >= flashStartFrame && frame < flashEndFrame;
  const isCardRevealed = frame >= cardStartFrame;

  // Hitung posisi detik pemutaran video (playback seek)
  let currentVideoSeconds = frame / fps;
  if (isRewinding) {
    const rewindProgress = (frame - rewindStartFrame) / rewindFrames;
    const playEndSeconds = playDurationFrames / fps;
    currentVideoSeconds = interpolate(
      rewindProgress,
      [0, 1],
      [playEndSeconds, targetUndoSeconds]
    );
  } else if (frame >= rewindEndFrame) {
    // Freeze persis pada frame target undo
    currentVideoSeconds = targetUndoSeconds;
  }

  // Progress flash shutter (0 sampai 1)
  const flashProgress = isFlashing
    ? (frame - flashStartFrame) / flashDurationFrames
    : 0;

  // Spring animation pop-up kartu
  const cardSpring = spring({
    frame: frame - cardStartFrame,
    fps,
    config: { damping: 13, mass: 0.7, stiffness: 120 },
  });

  return (
    <AbsoluteFill className="bg-black text-white font-sans overflow-hidden select-none">
      {/* ======================================================== */}
      {/* 1. TOP UNSAFE AREA: 10% HEIGHT (192px) - PURE BLACK WALL */}
      {/* ======================================================== */}
      <div className="absolute top-0 inset-x-0 h-[10%] bg-black z-30 pointer-events-none flex items-center justify-center">
        {showSafeZoneGuides && (
          <div className="w-full h-full border-b-2 border-dashed border-red-500/70 flex items-center justify-center bg-red-950/20 text-red-400 font-mono text-xs font-bold tracking-widest uppercase">
            ⚠️ Area Unsafe Atas (10% - Status Bar Medsos)
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 2. ACTIVE 80% SAFE ZONE CANVAS (1536px Vertical Safe Area)*/}
      {/* ======================================================== */}
      <div className="absolute top-[10%] bottom-[10%] inset-x-0 overflow-hidden flex items-center justify-center bg-black">
        {/* Konten Video Utama 9:16 (Centered Vertical) */}
        {videoSrc ? (
          <div className="relative w-full h-full overflow-hidden flex items-center justify-center">
            {isPlaying ? (
              <Video
                src={videoSrc}
                className="w-full h-full object-contain"
              />
            ) : (
              <Video
                src={videoSrc}
                startFrom={Math.round(currentVideoSeconds * fps)}
                className="w-full h-full object-contain pointer-events-none"
              />
            )}

            {/* Video Dimming Overlay saat kartu muncul */}
            {isCardRevealed && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-all duration-300 z-20" />
            )}
          </div>
        ) : (
          <div className="text-center p-8 text-neutral-500 font-mono text-sm">
            Video tidak ditemukan. Jalankan <code className="text-amber-400">npm run download</code>
          </div>
        )}

        {/* Rewind / Undo Overlay Glitch & Tape Counter */}
        {isRewinding && (
          <div className="absolute inset-0 z-20 pointer-events-none">
            <RewindEffect
              progress={(frame - rewindStartFrame) / rewindFrames}
              currentRewindSec={currentVideoSeconds}
            />
          </div>
        )}

        {/* Camera Shutter White Flash */}
        {isFlashing && (
          <div className="absolute inset-0 z-30 pointer-events-none">
            <ShutterFlash progress={flashProgress} />
          </div>
        )}

        {/* Reveal Kartu Pokemon 1:1 Holographic Center Stage */}
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

      {/* ======================================================== */}
      {/* 3. OPTIONAL HEADER: Tepat di dalam margin atas Safe Zone   */}
      {/* ======================================================== */}
      {title && (
        <div className="absolute top-[10.5%] left-0 right-0 px-8 flex flex-col items-center gap-1.5 z-30 pointer-events-none">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-black/80 border border-neutral-700/80 shadow-2xl backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-xs font-bold tracking-wider uppercase text-neutral-300">
              {gameTitle}
            </span>
            <span className="text-neutral-600">•</span>
            <span className="text-[11px] font-mono text-amber-400 font-semibold">
              UNDO: {targetUndoTimestamp}
            </span>
          </div>

          <h1 className="text-2xl font-black text-center tracking-tight text-white drop-shadow-[0_3px_8px_rgba(0,0,0,0.9)]">
            {title}
          </h1>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. BOTTOM UNSAFE AREA: 10% HEIGHT (192px) - PURE BLACK WALL */}
      {/* ======================================================== */}
      <div className="absolute bottom-0 inset-x-0 h-[10%] bg-black z-30 pointer-events-none flex items-center justify-center">
        {showSafeZoneGuides && (
          <div className="w-full h-full border-t-2 border-dashed border-red-500/70 flex items-center justify-center bg-red-950/20 text-red-400 font-mono text-xs font-bold tracking-widest uppercase">
            ⚠️ Area Unsafe Bawah (10% - Caption & Nav Medsos)
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
