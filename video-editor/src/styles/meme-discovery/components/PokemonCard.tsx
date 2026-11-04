import React from 'react';
import { Freeze, Img, interpolate, Video } from 'remotion';

interface PokemonCardProps {
  cardTitle: string;
  cardSubtitle?: string;
  cardRarity?: string;
  imageSrc?: string;
  targetFrameImage?: string;
  videoSrc?: string;
  targetUndoSeconds: number;
  hp?: number;
  attackName?: string;
  attackDesc?: string;
  slideProgress: number; // 0 to 1 (slide-up entrance from bottom)
  frame: number;
  // Detail anatomi kartu Pokemon TCG
  stage?: string;
  energyType?: string;
  speciesInfo?: string;
  abilityName?: string;
  abilityDesc?: string;
  weakness?: string;
  resistance?: string;
  retreatCost?: string;
  illustrator?: string;
}

export const PokemonCard: React.FC<PokemonCardProps> = ({
  cardTitle,
  cardSubtitle = 'Meme Discovery Card',
  cardRarity = '⭐⭐⭐⭐⭐ SSR LEGENDARY',
  imageSrc,
  targetFrameImage,
  videoSrc,
  targetUndoSeconds,
  hp = 9999,
  attackName = 'Ekspresi Lucu Jumpscare',
  attackDesc = 'Menatap tajam ke kamera dengan ekspresi bingung yang memicu tawa penonton.',
  slideProgress,
  frame,
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
  // Efek kilau holographic foil diagonal
  const shineX = interpolate(
    (frame * 3) % 200,
    [0, 200],
    [-200, 300]
  );

  // Animasi kartu meluncur naik DARI BAWAH layar ke tengah safe zone
  const translateY = interpolate(slideProgress, [0, 1], [1200, 0]);

  return (
    <div
      className="relative w-[820px] rounded-[36px] p-5 bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 shadow-[0_0_80px_rgba(245,158,11,0.7)] border-4 border-yellow-200 select-none overflow-hidden"
      style={{
        transform: `translateY(${translateY}px)`,
        opacity: Math.min(1, slideProgress * 2.5),
      }}
    >
      {/* 1. Holographic Rainbow Sheen Foil Layer */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40 mix-blend-color-dodge z-30"
        style={{
          background: `linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.85) 45%, rgba(255,215,0,0.85) 50%, rgba(0,255,255,0.85) 55%, transparent 75%)`,
          transform: `translateX(${shineX}%)`,
        }}
      />

      {/* 2. Card Inner Body (Classic Gold-Dark TCG Frame) */}
      <div className="relative rounded-[28px] bg-gradient-to-b from-neutral-900 via-neutral-950 to-black p-5 border-2 border-yellow-500/50 flex flex-col gap-3">
        {/* TOP BAR: Stage Badge, Card Name, HP & Energy Type */}
        <div className="flex justify-between items-center border-b border-yellow-500/30 pb-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-amber-500 text-black text-[11px] font-black uppercase tracking-wider shadow">
              {stage}
            </span>
            <div>
              <h2 className="text-3xl font-black tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                {cardTitle}
              </h2>
              <span className="text-[10px] font-mono text-amber-300 uppercase tracking-widest block font-semibold">
                {cardSubtitle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-neutral-900/90 px-3.5 py-1.5 rounded-full border border-yellow-500/40 shadow-inner">
            <span className="text-xs font-bold text-neutral-400">HP</span>
            <span className="text-2xl font-black text-emerald-400 font-mono tracking-tight">
              {hp}
            </span>
            <span className="text-amber-400 text-base">{energyType}</span>
          </div>
        </div>

        {/* ILLUSTRATION WINDOW (1:1 Aspect Frame) */}
        <div className="relative w-full aspect-square max-h-[460px] rounded-2xl overflow-hidden border-4 border-amber-400/90 bg-black shadow-2xl flex items-center justify-center">
          {imageSrc ? (
            /* Gambar 1:1 Asli dari Google Drive (image.jpg) */
            <Img
              src={imageSrc}
              alt={cardTitle}
              className="w-full h-full object-cover"
            />
          ) : targetFrameImage ? (
            /* Gambar frame beku hasil tangkapan canvas (instan tanpa delay video) */
            <Img
              src={targetFrameImage}
              alt={cardTitle}
              className="w-full h-full object-cover"
            />
          ) : videoSrc ? (
            /* Fallback Otomatis: Video Frame Beku pada Detik Target x */
            <div className="w-full h-full relative">
              <Freeze frame={Math.round(targetUndoSeconds * 30)}>
                <Video
                  src={videoSrc}
                  className="w-full h-full object-cover pointer-events-none"
                />
              </Freeze>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl bg-neutral-900 text-neutral-600">
              🖼️
            </div>
          )}

          {/* Golden Corner Accents */}
          <div className="absolute top-1.5 left-1.5 w-4 h-4 border-t-2 border-l-2 border-yellow-300 pointer-events-none" />
          <div className="absolute top-1.5 right-1.5 w-4 h-4 border-t-2 border-r-2 border-yellow-300 pointer-events-none" />
          <div className="absolute bottom-1.5 left-1.5 w-4 h-4 border-b-2 border-l-2 border-yellow-300 pointer-events-none" />
          <div className="absolute bottom-1.5 right-1.5 w-4 h-4 border-b-2 border-r-2 border-yellow-300 pointer-events-none" />
        </div>

        {/* POKEDEX / SPECIES INFO STRIP */}
        <div className="text-center text-[11px] font-mono font-semibold text-amber-300/90 bg-neutral-900/80 py-1 px-3 rounded-md border border-neutral-800">
          {speciesInfo}
        </div>

        {/* ABILITY BOX (Poké-Power) */}
        {abilityName && (
          <div className="rounded-xl bg-neutral-900/90 border border-rose-500/40 p-2.5 flex items-start gap-2.5">
            <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider shrink-0 mt-0.5">
              Ability
            </span>
            <div className="text-xs leading-snug">
              <span className="font-extrabold text-amber-300 mr-1.5">
                {abilityName}:
              </span>
              <span className="text-neutral-300">{abilityDesc}</span>
            </div>
          </div>
        )}

        {/* ATTACK MOVE SECTION */}
        <div className="rounded-xl bg-neutral-900/90 border border-neutral-800 p-3.5 space-y-1.5">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-mono text-sm tracking-widest">
                {energyType}{energyType}💀
              </span>
              <span className="font-extrabold text-base text-yellow-300">
                {attackName}
              </span>
            </div>
            <span className="font-mono font-black text-2xl text-amber-400">
              999+
            </span>
          </div>

          <p className="text-xs text-neutral-300 leading-relaxed whitespace-pre-line">
            {attackDesc}
          </p>
        </div>

        {/* BATTLE MODIFIERS STRIP (Weakness, Resistance, Retreat) */}
        <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono text-neutral-400 bg-neutral-950 py-1.5 px-3 rounded-lg border border-neutral-900">
          <div>
            <span className="text-neutral-500 block">Weakness</span>
            <span className="font-bold text-rose-400">{weakness}</span>
          </div>
          <div>
            <span className="text-neutral-500 block">Resistance</span>
            <span className="font-bold text-cyan-400">{resistance}</span>
          </div>
          <div>
            <span className="text-neutral-500 block">Retreat</span>
            <span className="font-bold text-neutral-300">{retreatCost}</span>
          </div>
        </div>

        {/* COLLECTOR FINE PRINT FOOTER */}
        <div className="flex justify-between items-center text-[10px] text-neutral-500 font-mono pt-1 border-t border-neutral-900">
          <span>{illustrator}</span>
          <span className="text-amber-400 font-bold">{cardRarity}</span>
          <span>© 2026 Meme Discovery TCG</span>
        </div>
      </div>
    </div>
  );
};
