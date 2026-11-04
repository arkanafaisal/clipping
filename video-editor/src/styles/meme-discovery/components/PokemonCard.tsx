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

  // Fallbacks placeholder persis sesuai arahan prompts.md:L2
  const displayTitle = cardTitle || 'judul kartu';
  const displayRarity = cardRarity || 'rarity';
  const displayDesc = cardDesc || 'ini deskripsi panjang, maksimal 40 kata';
  const displayPassiveName = passiveName || 'pasif';
  const displayPassiveDesc = passiveDesc || 'ini deskripsi pasif';

  return (
    <div
      className="relative w-[740px] rounded-[36px] p-5 bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 shadow-[0_0_100px_rgba(245,158,11,0.6),0_30px_70px_rgba(0,0,0,0.95)] border-2 border-yellow-200/90 select-none overflow-hidden"
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
      <div className="relative rounded-[26px] bg-gradient-to-b from-neutral-900 via-neutral-950 to-black p-6 border border-amber-500/40 flex flex-col items-center gap-5">
        {/* BAGIAN PALING ATAS: Murni Gambar 1:1, tidak full width (ada padding x kanan-kiri), ukuran compact ~360px */}
        <div className="w-full flex justify-center px-12 pt-1">
          <div className="relative w-[360px] aspect-square rounded-2xl overflow-hidden border-2 border-amber-400/90 bg-black shadow-2xl flex items-center justify-center shrink-0">
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

        {/* DIBAWAH GAMBAR: Judul Kartu + Flex Col Rarity (Ukuran besar & jelas terbaca) */}
        <div className="flex flex-col items-center text-center gap-2 px-4 w-full">
          <h2 className="text-5xl font-black tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] line-clamp-2">
            {displayTitle}
          </h2>
          <span className="text-2xl font-black text-amber-400 tracking-wider">
            {displayRarity}
          </span>
        </div>

        {/* DIBAWAHNYA LAGI: Deskripsi Biasa (Ukuran text-3xl jelas terbaca) */}
        <p className="text-3xl text-neutral-200 text-center leading-relaxed font-normal px-4 whitespace-pre-line drop-shadow">
          {displayDesc}
        </p>

        {/* DIBAWAHNYA LAGI: Pasif (Kekuatan / Jimat Lucu) */}
        <div className="w-full rounded-2xl bg-neutral-900/90 border-2 border-amber-500/40 p-5 flex flex-col items-center gap-2.5 text-center shadow-inner">
          <div className="px-5 py-1 rounded-full bg-amber-500/20 border border-amber-400/40">
            <span className="text-3xl font-black text-amber-300 uppercase tracking-wider">
              {displayPassiveName}
            </span>
          </div>
          <p className="text-2xl text-neutral-300 leading-relaxed font-normal px-2 whitespace-pre-line">
            {displayPassiveDesc}
          </p>
        </div>
      </div>
    </div>
  );
};
