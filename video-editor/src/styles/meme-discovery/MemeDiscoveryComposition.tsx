import React from 'react';
import {
  AbsoluteFill,
  Img,
  Sequence,
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
  totalVideoDurationSeconds = 10.95,
  cardTitle = 'Grim Reaper Facecam',
  cardSubtitle = 'Meme Discovery Series #01',
  cardRarity = '⭐⭐⭐⭐⭐ SSR LEGENDARY',
  cardImageSrc,
  lastFrameImage,
  targetFrameImage,
  hp = 9999,
  attackName = 'Ekspresi Lucu Jumpscare',
  attackDesc = 'Menatap tajam ke kamera dengan ekspresi bingung yang memicu tawa penonton.',
  showSafeZoneGuides = false,
  stage = 'BASIC MEME',
  energyType = '⚡',
  speciesInfo = "NO. 001 Facecam • HT: 5'11\" • WT: 0 lbs • Rare Discovery Edition",
  abilityName = 'Momen Spontan',
  abilityDesc = 'Setiap kali viewer tertawa atau kaget, kartu ini memicu auto-subscribe.',
  weakness = '⚡ x2',
  resistance = '🛡️ -30',
  retreatCost = '⚪⚪',
  illustrator = 'Illus. Antigravity Editor',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 1. Posisi timestamp target x (relatif dari detik 0)
  const targetUndoSeconds = parseTimestampToSeconds(targetUndoTimestamp);

  // 2. Durasi video penuh (berhenti 0.08s sebelum EOF fisik agar browser tidak freeze di event 'ended')
  const totalSeconds = totalVideoDurationSeconds || 10.95;
  const playEndFrame = Math.max(1, Math.floor((totalSeconds - 0.08) * fps));

  // Jumlah detik lompatan mundur: total - x detik
  const skipAmountSeconds = Math.max(0, totalSeconds - targetUndoSeconds);

  // ========================================================
  // SEKUENSIAL JEDA ANTAR KEJADIAN (STORYBOARD):
  // 1. Play full video utuh tanpa gangguan: 0 -> playEndFrame
  // 2. Jeda freeze akhir video + pause icon ringan (12 frame = 0.4s)
  const endPauseFrames = 12;
  const skipStartFrame = playEndFrame + endPauseFrames;

  // 3. Efek skip kebelakang ala YouTube di sisi kiri (22 frame = ~0.73s)
  const skipFrames = 22;
  const skipEndFrame = skipStartFrame + skipFrames;

  // 4. Jeda menampilkan freezed frame lucu agar viewer bisa menangkapnya (18 frame = 0.6s)
  const funnyFramePauseFrames = 18;
  const flashStartFrame = skipEndFrame + funnyFramePauseFrames;

  // 5. Efek screenshot camera shutter flash putih (10 frame = ~0.33s)
  const flashFrames = 10;
  const flashEndFrame = flashStartFrame + flashFrames;

  // 6. Jeda pasca-screenshot persis 0.5 detik (15 frame pada 30fps)
  const postScreenshotPauseFrames = 15;
  const cardStartFrame = flashEndFrame + postScreenshotPauseFrames;

  // ========================================================
  // STATE FASE AKTIF:
  const isPlayingFull = frame < playEndFrame;
  const isEndPaused = frame >= playEndFrame && frame < skipStartFrame;
  const isSkipping = frame >= skipStartFrame && frame < skipEndFrame;
  const isFlashing = frame >= flashStartFrame && frame < flashEndFrame;
  const isCardRevealed = frame >= cardStartFrame;

  // Progress flash shutter
  const flashProgress = isFlashing
    ? (frame - flashStartFrame) / flashFrames
    : 0;

  // Spring entrance meluncur dari bawah ke tengah (slide-up)
  const cardSpring = spring({
    frame: frame - cardStartFrame,
    fps,
    config: { damping: 15, mass: 0.8, stiffness: 90 },
  });

  return (
    <AbsoluteFill className="bg-black text-white font-sans overflow-hidden select-none">
      {/* ======================================================== */}
      {/* 1. LAYER VIDEO / GAMBAR FRAME BEKU (Zero Stalls / 0 Seek)  */}
      {/* ======================================================== */}
      <AbsoluteFill className="overflow-hidden flex items-center justify-center bg-black">
        {/* A. Video diputar murni hanya pada rentang Sequence (0 -> playEndFrame) */}
        {isPlayingFull && videoSrc && (
          <Sequence from={0} durationInFrames={playEndFrame}>
            <Video
              src={videoSrc}
              className="w-full h-full object-cover"
            />
          </Sequence>
        )}

        {/* B. Setelah video selesai & selama jeda pause serta skip YouTube: Gambar statis frame terakhir */}
        {!isPlayingFull && frame < skipEndFrame && (
          lastFrameImage ? (
            <Img
              src={lastFrameImage}
              className="w-full h-full object-cover"
            />
          ) : null
        )}

        {/* C. Setelah skip YouTube selesai: Langsung gambar frame target / kartu (0 seek, 0 delay) */}
        {!isPlayingFull && frame >= skipEndFrame && (
          targetFrameImage ? (
            <Img
              src={targetFrameImage}
              className="w-full h-full object-cover"
            />
          ) : cardImageSrc ? (
            <Img
              src={cardImageSrc}
              className="w-full h-full object-cover"
            />
          ) : lastFrameImage ? (
            <Img
              src={lastFrameImage}
              className="w-full h-full object-cover"
            />
          ) : null
        )}

        {/* Video Dimming Overlay saat kartu muncul (Solid dark overlay tanpa filter blur berat) */}
        {isCardRevealed && (
          <div className="absolute inset-0 bg-black/85 transition-opacity duration-300 z-20" />
        )}
      </AbsoluteFill>

      {/* ======================================================== */}
      {/* 2. OVERLAYS & SEKUENS EFEK MEME DISCOVERY                */}
      {/* ======================================================== */}
      {/* Ikon Pause Ringan Transparan saat video baru selesai */}
      {isEndPaused && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="w-24 h-24 rounded-full bg-black/50 border border-white/20 flex items-center justify-center opacity-30 shadow-2xl">
            <div className="flex gap-3">
              <div className="w-3 h-10 bg-white rounded-sm" />
              <div className="w-3 h-10 bg-white rounded-sm" />
            </div>
          </div>
        </div>
      )}

      {/* Efek Skip Kebelakang persis seperti YouTube di bagian KIRI */}
      {isSkipping && (
        <RewindEffect
          progress={(frame - skipStartFrame) / skipFrames}
          skipAmountSeconds={skipAmountSeconds}
        />
      )}

      {/* Camera Shutter White Flash (Screenshot Efek) */}
      {isFlashing && (
        <div className="absolute inset-0 z-30 pointer-events-none">
          <ShutterFlash progress={flashProgress} />
        </div>
      )}

      {/* Kartu Meme 1:1 Holographic Pokemon TCG Meluncur Naik DARI BAWAH ke Tengah */}
      {isCardRevealed && (
        <div className="absolute inset-0 flex items-center justify-center z-40 p-4">
          <PokemonCard
            cardTitle={cardTitle}
            cardSubtitle={cardSubtitle}
            cardRarity={cardRarity}
            imageSrc={cardImageSrc}
            targetFrameImage={targetFrameImage}
            videoSrc={videoSrc}
            targetUndoSeconds={targetUndoSeconds}
            hp={hp}
            attackName={attackName}
            attackDesc={attackDesc}
            slideProgress={cardSpring}
            frame={frame}
            stage={stage}
            energyType={energyType}
            speciesInfo={speciesInfo}
            abilityName={abilityName}
            abilityDesc={abilityDesc}
            weakness={weakness}
            resistance={resistance}
            retreatCost={retreatCost}
            illustrator={illustrator}
          />
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. OPTIONAL HEADER: Tepat di dalam margin atas Safe Zone   */}
      {/* ======================================================== */}
      {title && (
        <div className="absolute top-[3%] left-0 right-0 px-8 flex flex-col items-center gap-1.5 z-30 pointer-events-none">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-black/80 border border-neutral-700/80 shadow-2xl">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-xs font-bold tracking-wider uppercase text-neutral-300">
              {gameTitle}
            </span>
            <span className="text-neutral-600">•</span>
            <span className="text-[11px] font-mono text-amber-400 font-semibold">
              SEEK: {targetUndoTimestamp} (-{Math.round(skipAmountSeconds)}s)
            </span>
          </div>

          <h1 className="text-2xl font-black text-center tracking-tight text-white drop-shadow-[0_3px_8px_rgba(0,0,0,0.9)]">
            {title}
          </h1>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. SAFE ZONE GUIDES (Hanya jika showSafeZoneGuides aktif)  */}
      {/* ======================================================== */}
      {showSafeZoneGuides && (
        <>
          <div className="absolute top-0 inset-x-0 h-[10%] border-b-2 border-dashed border-red-500/70 flex items-center justify-center bg-red-950/20 text-red-400 font-mono text-xs font-bold tracking-widest uppercase z-30 pointer-events-none">
            ⚠️ Area Unsafe Atas (10% - Status Bar Medsos)
          </div>
          <div className="absolute bottom-0 inset-x-0 h-[10%] border-t-2 border-dashed border-red-500/70 flex items-center justify-center bg-red-950/20 text-red-400 font-mono text-xs font-bold tracking-widest uppercase z-30 pointer-events-none">
            ⚠️ Area Unsafe Bawah (10% - Caption & Nav Medsos)
          </div>
        </>
      )}
    </AbsoluteFill>
  );
};
