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
  const translateY = interpolate(slideProgress, [0, 1], [1400, 0]);

  return (
    <div
      className="relative w-[740px] rounded-[34px] p-4 bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 shadow-[0_0_100px_rgba(245,158,11,0.6),0_30px_60px_rgba(0,0,0,0.95)] border-2 border-yellow-200/90 select-none overflow-hidden"
      style={{
        transform: `translateY(${translateY}px)`,
        opacity: Math.min(1, slideProgress * 2.5),
      }}
    >
      {/* 1. Holographic Rainbow Sheen Foil Layer */}
      <div
        className="absolute inset-0 pointer-events-none opacity-35 mix-blend-color-dodge z-30"
        style={{
          background: `linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.85) 45%, rgba(255,215,0,0.85) 50%, rgba(0,255,255,0.85) 55%, transparent 75%)`,
          transform: `translateX(${shineX}%)`,
        }}
      />

      {/* 2. Card Inner Body (Portrait Proportions ~5:7 Ratio) */}
      <div className="relative rounded-[26px] bg-gradient-to-b from-neutral-900 via-neutral-950 to-black p-4 border border-amber-500/40 flex flex-col gap-3">
        {/* TOP BAR: Header Kartu Koleksi Minimalis & Tegas */}
        <div className="flex justify-between items-center border-b border-amber-500/30 pb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="px-3 py-1 rounded bg-amber-400 text-black text-sm font-black uppercase tracking-wider shadow whitespace-nowrap shrink-0">
              {stage}
            </span>
            <div className="min-w-0">
              <h2 className="text-3xl font-black tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] truncate">
                {cardTitle}
              </h2>
              <span className="text-xs font-mono text-amber-300 uppercase tracking-widest block font-semibold truncate">
                {cardSubtitle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-neutral-900/90 px-4 py-1.5 rounded-full border border-amber-500/40 shadow-inner shrink-0">
            <span className="text-xs font-bold text-neutral-400">HP</span>
            <span className="text-2xl font-black text-emerald-400 font-mono tracking-tight">
              {hp}
            </span>
            <span className="text-amber-400 text-base">{energyType}</span>
          </div>
        </div>

        {/* 3. FOTO FACECAM JENDELA 1:1 SQUARE STRICT (Pusat Kartu Koleksi) */}
        <div className="relative w-full aspect-square rounded-2xl overflow-hidden border-2 border-amber-400/90 bg-black shadow-2xl flex items-center justify-center">
          {imageSrc ? (
            /* Gambar 1:1 Asli yang diupload di Google Drive (image.jpg) */
            <Img
              src={imageSrc}
              alt={cardTitle}
              className="w-full h-full object-cover"
            />
          ) : targetFrameImage ? (
            /* Fallback Tangkapan Frame Canvas Browser Instan */
            <Img
              src={targetFrameImage}
              alt={cardTitle}
              className="w-full h-full object-cover"
            />
          ) : videoSrc ? (
            /* Fallback Video Freeze Remotion */
            <div className="w-full h-full relative">
              <Freeze frame={Math.round(targetUndoSeconds * 30)}>
                <Video
                  src={videoSrc}
                  className="w-full h-full object-cover pointer-events-none"
                />
              </Freeze>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl bg-neutral-900 text-neutral-600">
              🖼️
            </div>
          )}

          {/* Golden Corner Accents */}
          <div className="absolute top-2 left-2 w-3.5 h-3.5 border-t-2 border-l-2 border-yellow-300 pointer-events-none" />
          <div className="absolute top-2 right-2 w-3.5 h-3.5 border-t-2 border-r-2 border-yellow-300 pointer-events-none" />
          <div className="absolute bottom-2 left-2 w-3.5 h-3.5 border-b-2 border-l-2 border-yellow-300 pointer-events-none" />
          <div className="absolute bottom-2 right-2 w-3.5 h-3.5 border-b-2 border-r-2 border-yellow-300 pointer-events-none" />
        </div>

        {/* 4. BILAH IDENTITAS / SPECIES STRIP */}
        <div className="text-center text-xs font-mono font-semibold text-amber-300/90 bg-neutral-900/80 py-1.5 px-3 rounded-md border border-neutral-800">
          {speciesInfo}
        </div>

        {/* 5. MEME ACTION / TRAIT PANEL (Elegan & Terpadu) */}
        <div className="rounded-xl bg-neutral-900/90 border border-neutral-800 p-3.5 space-y-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-mono text-base tracking-widest">
                {energyType}{energyType}
              </span>
              <span className="font-extrabold text-lg text-yellow-300">
                {attackName}
              </span>
            </div>
            <span className="font-mono font-black text-2xl text-amber-400">
              999+
            </span>
          </div>

          {/* Rule 23: Strict preserve manual user line breaks with whitespace-pre-line */}
          <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-line">
            {attackDesc}
          </p>
        </div>

        {/* 6. MODIFIER / BATTLE STATS */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono text-neutral-400 bg-neutral-950 py-2 px-3 rounded-lg border border-neutral-900">
          <div>
            <span className="text-neutral-500 block text-[10px]">Weakness</span>
            <span className="font-bold text-rose-400">{weakness}</span>
          </div>
          <div>
            <span className="text-neutral-500 block text-[10px]">Resistance</span>
            <span className="font-bold text-cyan-400">{resistance}</span>
          </div>
          <div>
            <span className="text-neutral-500 block text-[10px]">Retreat</span>
            <span className="font-bold text-neutral-300">{retreatCost}</span>
          </div>
        </div>

        {/* 7. COLLECTOR FOOTER */}
        <div className="flex justify-between items-center text-xs text-neutral-400 font-mono pt-1 border-t border-neutral-900">
          <span>{illustrator}</span>
          <span className="text-amber-400 font-bold">{cardRarity}</span>
          <span>© 2026 Meme Discovery TCG</span>
        </div>
      </div>
    </div>
  );
};
