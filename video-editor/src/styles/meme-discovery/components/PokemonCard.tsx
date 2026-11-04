import React from 'react';
import { interpolate, Video } from 'remotion';

interface PokemonCardProps {
  cardTitle: string;
  cardSubtitle?: string;
  cardRarity?: string;
  imageSrc?: string;
  videoSrc?: string;
  targetUndoSeconds: number;
  hp?: number;
  attackName?: string;
  attackDesc?: string;
  scaleProgress: number; // 0 to 1 (spring entrance)
  frame: number;
}

export const PokemonCard: React.FC<PokemonCardProps> = ({
  cardTitle,
  cardSubtitle = 'Meme Discovery Card',
  cardRarity = '⭐⭐⭐⭐⭐ SSR LEGENDARY',
  imageSrc,
  videoSrc,
  targetUndoSeconds,
  hp = 9999,
  attackName = 'Ekspresi Lucu Jumpscare',
  attackDesc = 'Membuat penonton tertawa terpingkal-pingkal dan langsung subscribe.',
  scaleProgress,
  frame,
}) => {
  // Holographic shine angle & position
  const shineX = interpolate(
    (frame * 3) % 200,
    [0, 200],
    [-200, 300]
  );

  return (
    <div
      className="relative w-[520px] rounded-3xl p-4 bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-600 shadow-[0_0_50px_rgba(250,204,21,0.6)] border-4 border-yellow-200 select-none overflow-hidden"
      style={{
        transform: `scale(${scaleProgress}) rotate(${(1 - scaleProgress) * -8}deg)`,
        opacity: Math.min(1, scaleProgress * 1.5),
      }}
    >
      {/* Holographic Sheen Layer */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40 mix-blend-color-dodge z-30"
        style={{
          background: `linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.8) 45%, rgba(255,200,0,0.8) 50%, rgba(0,255,255,0.8) 55%, transparent 75%)`,
          transform: `translateX(${shineX}%)`,
        }}
      />

      {/* Card Inner Background */}
      <div className="relative rounded-2xl bg-neutral-950 p-4 border border-yellow-500/40 flex flex-col gap-3">
        {/* Header: Title, Category & HP */}
        <div className="flex justify-between items-center border-b border-neutral-800 pb-2">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold block">
              {cardSubtitle}
            </span>
            <h2 className="text-2xl font-black tracking-tight text-white drop-shadow">
              {cardTitle}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 bg-neutral-900 px-3 py-1 rounded-full border border-yellow-500/30">
            <span className="text-xs font-bold text-neutral-400">HP</span>
            <span className="text-lg font-black text-emerald-400 font-mono">
              {hp}
            </span>
            <span className="text-amber-400 text-xs">⚡</span>
          </div>
        </div>

        {/* 1:1 Image Frame */}
        <div className="relative w-full aspect-square rounded-xl overflow-hidden border-2 border-yellow-400/80 bg-black shadow-inner">
          {imageSrc ? (
            /* Gambar 1:1 Asli dari Google Drive (image.jpg / card.png) */
            <img
              src={imageSrc}
              alt={cardTitle}
              className="w-full h-full object-cover"
            />
          ) : videoSrc ? (
            /* Fallback: Video Frame Frozen pada Target Seconds */
            <div className="w-full h-full relative">
              <Video
                src={videoSrc}
                startFrom={Math.round(targetUndoSeconds * 30)}
                className="w-full h-full object-cover pointer-events-none"
              />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl bg-neutral-900 text-neutral-600">
              🖼️
            </div>
          )}

          {/* Golden Corner Accents */}
          <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-yellow-300 pointer-events-none" />
          <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-yellow-300 pointer-events-none" />
          <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-yellow-300 pointer-events-none" />
          <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-yellow-300 pointer-events-none" />
        </div>

        {/* Rarity & Card Info */}
        <div className="flex justify-between items-center text-xs font-bold px-1 text-amber-300">
          <span>{cardRarity}</span>
          <span className="text-[11px] font-mono text-neutral-400">NO. 001/MEME</span>
        </div>

        {/* Attack / Ability Box */}
        <div className="rounded-xl bg-neutral-900/90 border border-neutral-800 p-3 space-y-1">
          <div className="flex justify-between items-center">
            <span className="font-extrabold text-sm text-yellow-300 flex items-center gap-1.5">
              <span>🔥</span> {attackName}
            </span>
            <span className="font-mono font-black text-amber-400 text-sm">
              999+
            </span>
          </div>
          <p className="text-[11px] text-neutral-300 leading-snug">
            {attackDesc}
          </p>
        </div>

        {/* Footer */}
        <div className="text-[10px] text-center text-neutral-400 font-mono tracking-wider pt-1 border-t border-neutral-900">
          Programmatic Video Studio • Remotion Card Collector Edition
        </div>
      </div>
    </div>
  );
};
