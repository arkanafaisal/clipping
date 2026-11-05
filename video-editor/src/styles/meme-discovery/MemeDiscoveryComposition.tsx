import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Freeze,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Video,
  staticFile,
} from 'remotion';
import { MemeDiscoveryProps } from './types';
import { parseTimestampToSeconds } from '../../utils/time';
import { ShutterFlash } from './components/ShutterFlash';
import { PokemonCard } from './components/PokemonCard';

export const MemeDiscoveryComposition: React.FC<MemeDiscoveryProps> = ({
  videoSrc,
  title = 'Meme Discovery: Momen Langka!',
  gameTitle = 'Grim Reaper',
  targetUndoTimestamp = '00:07.105',
  totalVideoDurationSeconds = 10.95,
  cardTitle,
  cardRarity,
  cardDesc,
  skills,
  passiveName,
  passiveDesc,
  cardColor,
  titleFontSize,
  rarityFontSize,
  descFontSize,
  passiveNameFontSize,
  passiveDescFontSize,
  cardImageSrc,
  sfxSrc = '/sfx/magical-reveal.webm',
  cardEmergeSfxSrc,
  cameraShutterSfxSrc = '/sfx/camera-shutter.webm',
  enableSfx = true,
  showSafeZoneGuides = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 1. Durasi pemutaran video dibatasi tepat pada timestamp puncak (targetUndoTimestamp)
  const stopSeconds =
    parseTimestampToSeconds(targetUndoTimestamp) || totalVideoDurationSeconds || 10.95;
  const stopFrame = Math.max(1, Math.round(stopSeconds * fps));

  // ========================================================
  // SEKUENSIAL TIMELINE (FAST PACED & HIGH RETENTION):
  // 1. Play video normal dari awal sampai momen puncak (0 -> stopFrame)
  // 2. Tepat di stopFrame: video langsung stop & LANGSUNG efek screenshot (tanpa jeda, tanpa freeze frame timpaan)
  // 3. Efek screenshot camera shutter flash putih (10 frame = ~0.33s)
  const flashFrames = 10;
  const flashStartFrame = stopFrame;
  const flashEndFrame = flashStartFrame + flashFrames;

  // 4. Jeda pasca-screenshot 0.5 detik (15 frame pada 30fps)
  const postScreenshotPauseFrames = 15;
  const cardStartFrame = flashEndFrame + postScreenshotPauseFrames;

  // 5. Kartu meme slide-up masuk dari bawah & 3D reveal (105 frame)
  // ========================================================

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
      {/* 1. LAYER VIDEO: Play natural 0 -> stopFrame & Stop       */}
      {/* Tanpa timpaan freeze frame, murni video berhenti         */}
      {/* ======================================================== */}
      <AbsoluteFill className="overflow-hidden flex items-center justify-center bg-black">
        {videoSrc && (
          <Freeze active={frame >= stopFrame} frame={Math.max(0, stopFrame - 1)}>
            <Video
              src={videoSrc}
              className="w-full h-full object-cover"
              volume={frame >= stopFrame ? 0 : 1}
            />
          </Freeze>
        )}

        {/* Video Dimming Overlay saat kartu muncul (Solid dark overlay) */}
        {isCardRevealed && (
          <div className="absolute inset-0 bg-black/85 transition-opacity duration-300 z-20" />
        )}
      </AbsoluteFill>

      {/* ======================================================== */}
      {/* 2. OVERLAYS & SEKUENS EFEK MEME DISCOVERY                */}
      {/* ======================================================== */}
      {/* Camera Shutter White Flash (Screenshot Efek langsung di stopFrame) */}
      {isFlashing && (
        <div className="absolute inset-0 z-30 pointer-events-none">
          <ShutterFlash progress={flashProgress} />
        </div>
      )}

      {/* 1. Sound Effect: Camera Shutter Click saat efek screenshot flash putih */}
      {enableSfx && cameraShutterSfxSrc && frame >= flashStartFrame && (
        <Sequence from={flashStartFrame} durationInFrames={45}>
          <Audio
            src={
              cameraShutterSfxSrc.startsWith('http')
                ? cameraShutterSfxSrc
                : staticFile(cameraShutterSfxSrc.replace(/^\//, ''))
            }
            volume={0.9}
          />
        </Sequence>
      )}

      {/* 2. Sound Effect: Magical Reveal Harp Glissando saat kartu kecil muncul dari bawah */}
      {enableSfx && (sfxSrc || cardEmergeSfxSrc) && isCardRevealed && (
        <Sequence from={cardStartFrame} durationInFrames={120}>
          <Audio
            src={
              (sfxSrc || cardEmergeSfxSrc)!.startsWith('http')
                ? (sfxSrc || cardEmergeSfxSrc)!
                : staticFile((sfxSrc || cardEmergeSfxSrc)!.replace(/^\//, ''))
            }
            volume={1.25}
          />
        </Sequence>
      )}

      {/* Kartu Koleksi Meme Minimalis: Muncul kecil dari bawah, lalu Flip 3D Reveal Teks di Tengah */}
      {isCardRevealed && (
        <div
          className="absolute inset-0 flex items-center justify-center z-40 p-4"
          style={{ perspective: 1800 }}
        >
          <PokemonCard
            cardTitle={cardTitle}
            cardRarity={cardRarity}
            cardDesc={cardDesc}
            skills={skills}
            passiveName={passiveName}
            passiveDesc={passiveDesc}
            cardColor={cardColor}
            titleFontSize={titleFontSize}
            rarityFontSize={rarityFontSize}
            descFontSize={descFontSize}
            passiveNameFontSize={passiveNameFontSize}
            passiveDescFontSize={passiveDescFontSize}
            imageSrc={cardImageSrc}
            slideProgress={cardSpring}
            cardRelativeFrame={Math.max(0, frame - cardStartFrame)}
            frame={frame}
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
              STOP: {targetUndoTimestamp}
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
