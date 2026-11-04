import React from 'react';
import { Img, interpolate } from 'remotion';

interface PokemonCardProps {
  cardTitle?: string;
  cardRarity?: string;
  cardDesc?: string;
  passiveName?: string;
  passiveDesc?: string;
  imageSrc?: string;
  targetFrameImage?: string;
  slideProgress: number; // 0 to 1 (slide-up entrance from bottom)
  frame: number;
}

export const PokemonCard: React.FC<PokemonCardProps> = ({
  cardTitle,
  cardRarity,
  cardDesc,
  passiveName,
  passiveDesc,
  imageSrc,
  targetFrameImage,
  slideProgress,
  frame,
}) => {
  // Efek kilau holographic foil diagonal (GPU Accelerated)
  const shineX = interpolate(
    (frame * 3) % 200,
    [0, 200],
    [-200, 300]
  );

  // Animasi kartu meluncur naik DARI BAWAH layar ke tengah safe zone
  const translateY = interpolate(slideProgress, [0, 1], [1400, 0]);

  // Fallbacks sesuai arahan prompts.md:L2
  const displayTitle = cardTitle || 'Judul Kartu';
  const displayRarity = cardRarity || 'Rarity';
  const displayDesc = cardDesc || 'Ini deskripsi panjang, maksimal 40 kata';
  const displayPassiveName = passiveName || 'Pasif';
  const displayPassiveDesc = passiveDesc || 'Ini deskripsi pasif';

  return (
    <div
      className="relative w-[700px] rounded-[34px] p-4 bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 shadow-[0_0_90px_rgba(245,158,11,0.55),0_30px_60px_rgba(0,0,0,0.95)] border-2 border-yellow-200/90 select-none overflow-hidden"
      style={{
        transform: `translateY(${translateY}px)`,
        opacity: Math.min(1, slideProgress * 2.5),
      }}
    >
      {/* 1. Holographic Rainbow Sheen Foil Layer (GPU Accelerated Alpha Blending) */}
      <div
        className="absolute inset-0 pointer-events-none opacity-25 z-30"
        style={{
          background: `linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.7) 45%, rgba(255,220,120,0.75) 50%, rgba(130,240,255,0.7) 55%, transparent 75%)`,
          transform: `translateX(${shineX}%)`,
        }}
      />

      {/* 2. Body Dalam Kartu (Minimalis Jimat Koleksi Meme) */}
      <div className="relative rounded-[24px] bg-gradient-to-b from-neutral-900 via-neutral-950 to-black p-5 border border-amber-500/40 flex flex-col items-center gap-4">
        {/* BAGIAN PALING ATAS: Murni Gambar 1:1 dengan padding horizontal agar proporsional */}
        <div className="w-full flex justify-center px-8 pt-1">
          <div className="relative w-[430px] aspect-square rounded-2xl overflow-hidden border-2 border-amber-400/90 bg-black shadow-2xl flex items-center justify-center shrink-0">
            {imageSrc ? (
              <Img
                src={imageSrc}
                alt={displayTitle}
                className="w-full h-full object-cover"
              />
            ) : targetFrameImage ? (
              <Img
                src={targetFrameImage}
                alt={displayTitle}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-6xl bg-neutral-900 text-neutral-600">
                🖼️
              </div>
            )}

            {/* Aksen Sudut Emas Mewah */}
            <div className="absolute top-2 left-2 w-3.5 h-3.5 border-t-2 border-l-2 border-yellow-300 pointer-events-none" />
            <div className="absolute top-2 right-2 w-3.5 h-3.5 border-t-2 border-r-2 border-yellow-300 pointer-events-none" />
            <div className="absolute bottom-2 left-2 w-3.5 h-3.5 border-b-2 border-l-2 border-yellow-300 pointer-events-none" />
            <div className="absolute bottom-2 right-2 w-3.5 h-3.5 border-b-2 border-r-2 border-yellow-300 pointer-events-none" />
          </div>
        </div>

        {/* DIBAWAH GAMBAR: Judul Kartu + Flex Col Rarity (Tanpa kata pembantu) */}
        <div className="flex flex-col items-center text-center gap-1 px-4 w-full">
          <h2 className="text-4xl font-black tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] line-clamp-2">
            {displayTitle}
          </h2>
          <span className="text-xl font-extrabold text-amber-400 tracking-wider">
            {displayRarity}
          </span>
        </div>

        {/* DIBAWAHNYA LAGI: Deskripsi Biasa */}
        <p className="text-2xl text-neutral-200 text-center leading-relaxed font-normal px-4 whitespace-pre-line">
          {displayDesc}
        </p>

        {/* DIBAWAHNYA LAGI: Pasif (Kekuatan / Jimat Lucu) */}
        <div className="w-full rounded-2xl bg-neutral-900/90 border border-amber-500/40 p-4 flex flex-col items-center gap-1.5 text-center shadow-inner">
          <span className="text-2xl font-black text-amber-300 uppercase tracking-wide flex items-center justify-center gap-2">
            <span>🧿</span>
            <span>{displayPassiveName}</span>
            <span>🧿</span>
          </span>
          <p className="text-xl text-neutral-300 leading-relaxed font-normal px-2 whitespace-pre-line">
            {displayPassiveDesc}
          </p>
        </div>
      </div>
    </div>
  );
};
