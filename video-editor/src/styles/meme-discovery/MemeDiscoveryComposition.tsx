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
import { MemeDiscoveryProps, getRarityColor } from './types';
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
  enableScreenshot = true,
  sfxSrc = '/sfx/magical-reveal.webm',
  cardEmergeSfxSrc,
  cameraShutterSfxSrc = '/sfx/camera-shutter.webm',
  enableSfx = true,
  showSafeZoneGuides = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Mode screenshot: jika false, kartu langsung mulai animasi masuk di timestamp tanpa jeda & tanpa flash
  const isScreenshotMode = enableScreenshot !== false;

  // Resolusi warna kartu dan label rarity untuk header
  const activeCardColor = cardColor || getRarityColor(cardRarity);
  const displayRarity = cardRarity
    ? cardRarity.charAt(0).toUpperCase() + cardRarity.slice(1)
    : 'Rare';

  // 1. Durasi pemutaran video dibatasi tepat pada timestamp puncak / kemunculan kartu
  const stopSeconds =
    parseTimestampToSeconds(targetUndoTimestamp) || totalVideoDurationSeconds || 10.95;
  const stopFrame = Math.max(1, Math.round(stopSeconds * fps));

  // Durasi fisik video penuh dalam frame (untuk proteksi EOF saat mode langsung)
  const videoTotalSeconds = totalVideoDurationSeconds || 10.95;
  const videoEndFrame = Math.max(1, Math.floor((videoTotalSeconds - 0.05) * fps));

  // ========================================================
  // SEKUENSIAL TIMELINE:
  // MODE A (isScreenshotMode = true):
  // 1. Play video normal dari awal sampai momen puncak (0 -> stopFrame)
  // 2. Tepat di stopFrame: video freeze & LANGSUNG efek screenshot flash (10 frame)
  // 3. Jeda pasca-screenshot 0.5 detik (15 frame)
  // 4. Kartu meme slide-up masuk dari bawah & 3D reveal (105 frame)
  //
  // MODE B (isScreenshotMode = false / Direct Reveal):
  // 1. Play video normal dari awal sampai timestamp (0 -> stopFrame)
  // 2. Di stopFrame: kartu LANGSUNG masuk & video latar BELAKANG TETAP PLAY
  // 3. Jika video habis sebelum kartu selesai: video hold frame akhir (tanpa replay)
  // 4. Jika video lebih panjang: komposisi otomatis selesai di cardStartFrame + 105 (show kartu tetap normal)
  // ========================================================
  const flashFrames = isScreenshotMode ? 10 : 0;
  const flashStartFrame = stopFrame;
  const flashEndFrame = flashStartFrame + flashFrames;

  const postScreenshotPauseFrames = isScreenshotMode ? 15 : 0;
  const cardStartFrame = isScreenshotMode
    ? flashEndFrame + postScreenshotPauseFrames
    : stopFrame;

  const isFlashing = isScreenshotMode && frame >= flashStartFrame && frame < flashEndFrame;
  const isCardRevealed = frame >= cardStartFrame;

  // Logika pembekuan video (Freeze):
  // - Mode Screenshot: Video freeze di stopFrame (frame puncak)
  // - Mode Langsung: Video terus berputar di latar belakang; HANYA difreeze di frame akhir jika video fisik habis lebih dulu
  const shouldFreezeVideo = isScreenshotMode
    ? frame >= stopFrame
    : frame >= videoEndFrame;

  const frozenFrameNumber = isScreenshotMode
    ? Math.max(0, stopFrame - 1)
    : Math.max(0, videoEndFrame - 1);

  // Volume video:
  // - Sebelum kartu muncul / stop: volume normal 1.0
  // - Saat kartu muncul (atau saat screenshot stop): dihilangkan (0) sepenuhnya agar tidak mengganggu SFX & pembacaan kartu
  const videoVolume =
    (isScreenshotMode ? frame >= stopFrame : frame >= cardStartFrame) ? 0 : 1;

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
      {/* 1. LAYER VIDEO: Play natural / Background Play           */}
      {/* ======================================================== */}
      <AbsoluteFill className="overflow-hidden flex items-center justify-center bg-black">
        {videoSrc && (
          <Freeze active={shouldFreezeVideo} frame={frozenFrameNumber}>
            <Video
              src={videoSrc}
              className="w-full h-full object-cover"
              volume={videoVolume}
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

      {/* 1. Sound Effect: Camera Shutter Click saat efek screenshot flash putih (hanya jika mode screenshot aktif) */}
      {enableSfx && isScreenshotMode && cameraShutterSfxSrc && frame >= flashStartFrame && (
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
      {/* 3. HEADER: Di area hitam atas (di atas Safe Zone)        */}
      {/* ======================================================== */}
      <div className="absolute top-[3.5%] left-0 right-0 px-8 flex justify-center z-30 pointer-events-none">
        <h1
          className="text-[52px] font-black text-center tracking-tight drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)] leading-tight"
          style={{ color: activeCardColor }}
        >
          {displayRarity} card discovered!
        </h1>
      </div>

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
