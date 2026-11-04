import React from 'react';
import { Img, interpolate } from 'remotion';

interface PokemonCardProps {
  cardTitle?: string;
  cardRarity?: string;
  cardDesc?: string;
  passiveName?: string;
  passiveDesc?: string;
  cardColor?: string; // Warna kustom kartu (hex, misal: "#f59e0b")
  // Pengaturan ukuran font kustom (pixel)
  titleFontSize?: number;
  rarityFontSize?: number;
  descFontSize?: number;
  passiveNameFontSize?: number;
  passiveDescFontSize?: number;
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
  cardColor = '#f59e0b',
  titleFontSize = 48,
  rarityFontSize = 24,
  descFontSize = 30,
  passiveNameFontSize = 30,
  passiveDescFontSize = 24,
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
      className="relative w-[760px] h-[1140px] rounded-[38px] p-5 border-2 select-none overflow-hidden"
      style={{
        transform: `translateY(${translateY}px)`,
        opacity: Math.min(1, slideProgress * 2.5),
        borderColor: `${cardColor}ee`,
        background: `linear-gradient(to bottom, ${cardColor}dd, ${cardColor}88 40%, ${cardColor}44 80%, ${cardColor}bb)`,
        boxShadow: `0 0 100px ${cardColor}55, 0 30px 70px rgba(0,0,0,0.95)`,
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

      {/* 2. Body Dalam Kartu (Minimalis Jimat Koleksi Meme - Rasio 2:3 Animal Kaiser) */}
      <div
        className="relative w-full h-full rounded-[28px] bg-gradient-to-b from-neutral-900 via-neutral-950 to-black p-7 border flex flex-col justify-between items-start"
        style={{ borderColor: `${cardColor}55` }}
      >
        {/* BAGIAN PALING ATAS: Murni Gambar 1:1, tidak full width (ada padding x), ukuran compact ~380px */}
        <div className="w-full flex justify-center pt-1">
          <div
            className="relative w-[380px] aspect-square rounded-2xl overflow-hidden border-2 bg-black shadow-2xl flex items-center justify-center shrink-0"
            style={{ borderColor: `${cardColor}dd` }}
          >
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

            {/* Aksen Sudut Mewah Dinamis */}
            <div
              className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 pointer-events-none"
              style={{ borderColor: cardColor }}
            />
            <div
              className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 pointer-events-none"
              style={{ borderColor: cardColor }}
            />
            <div
              className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 pointer-events-none"
              style={{ borderColor: cardColor }}
            />
            <div
              className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 pointer-events-none"
              style={{ borderColor: cardColor }}
            />
          </div>
        </div>

        {/* DIBAWAH GAMBAR: Judul Kartu FLEX ROW dengan Rarity (Ruang tinggi cukup agar huruf g, j tidak terpotong) */}
        <div
          className="flex flex-row items-baseline justify-between gap-4 w-full pb-2 border-b"
          style={{ borderColor: `${cardColor}40` }}
        >
          <h2
            className="font-black text-white text-left tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] leading-[1.25] pb-1 min-w-0 truncate"
            style={{ fontSize: `${titleFontSize}px` }}
          >
            {displayTitle}
          </h2>
          <span
            className="font-black tracking-wider uppercase shrink-0 drop-shadow"
            style={{ color: cardColor, fontSize: `${rarityFontSize}px` }}
          >
            {displayRarity}
          </span>
        </div>

        {/* DIBAWAHNYA LAGI: Deskripsi Biasa (Left Align) */}
        <p
          className="text-neutral-200 text-left leading-relaxed font-normal w-full px-1 whitespace-pre-line drop-shadow"
          style={{ fontSize: `${descFontSize}px` }}
        >
          {displayDesc}
        </p>

        {/* DIBAWAHNYA LAGI: Pasif (Left Align, Jimat Lucu) */}
        <div
          className="w-full rounded-2xl bg-neutral-900/95 border-2 p-6 flex flex-col items-start gap-3 shadow-inner"
          style={{ borderColor: `${cardColor}60` }}
        >
          <div
            className="px-5 py-1.5 rounded-full border inline-block"
            style={{
              backgroundColor: `${cardColor}25`,
              borderColor: `${cardColor}60`,
            }}
          >
            <span
              className="font-black uppercase tracking-wider"
              style={{ color: cardColor, fontSize: `${passiveNameFontSize}px` }}
            >
              {displayPassiveName}
            </span>
          </div>
          <p
            className="text-neutral-300 text-left leading-relaxed font-normal px-1 whitespace-pre-line w-full"
            style={{ fontSize: `${passiveDescFontSize}px` }}
          >
            {displayPassiveDesc}
          </p>
        </div>
      </div>
    </div>
  );
};
