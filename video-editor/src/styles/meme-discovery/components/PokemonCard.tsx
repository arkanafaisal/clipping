import React from 'react';
import { Easing, Img, interpolate } from 'remotion';
import { CardSkill } from '../types';

interface PokemonCardProps {
  cardTitle?: string;
  cardRarity?: string;
  cardDesc?: string;
  skills?: CardSkill[];
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
  slideProgress?: number; // legacy fallback
  cardRelativeFrame?: number; // Frame relatif sejak kemunculan kartu
  frame: number;
}

export const PokemonCard: React.FC<PokemonCardProps> = ({
  cardTitle,
  cardRarity,
  cardDesc,
  skills,
  passiveName,
  passiveDesc,
  cardColor = '#f59e0b',
  titleFontSize = 46,
  rarityFontSize = 32,
  descFontSize = 32,
  passiveNameFontSize = 32,
  passiveDescFontSize = 26,
  imageSrc,
  targetFrameImage,
  slideProgress,
  cardRelativeFrame,
  frame,
}) => {
  // Resolusi frame animasi kartu
  const relFrame =
    cardRelativeFrame !== undefined
      ? cardRelativeFrame
      : (slideProgress ?? 0) * 45;

  // ============================================================
  // ANIMASI MASUK KARTU (3D FLIP REVEAL TIMING):
  // 1. RelFrame 0 - 18: Meluncur naik dari bawah, ukuran kecil (scale 0.48 -> 0.72), teks tersembunyi
  // 2. RelFrame 18 - 28: Berputar horizontal 3D (rotateY: 0deg -> 90deg), width mengecil hingga 0
  // 3. RelFrame 28 - 40: Tepat di width 0 (frame 28), teks dibuka (opacity 1)!
  //    Lanjut berputar (-90deg -> 0deg) sambil membesar ke ukuran penuh (scale 1.0) dengan subtle pop
  // 4. RelFrame >= 40: Kartu penuh stabil di tengah safe zone
  // ============================================================
  let translateY = 0;
  let scale = 1;
  let rotateY = 0;
  let textOpacity = 0;
  let cardOpacity = 1;

  if (relFrame < 18) {
    translateY = interpolate(relFrame, [0, 18], [1300, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    });
    scale = interpolate(relFrame, [0, 18], [0.48, 0.72], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    });
    cardOpacity = interpolate(relFrame, [0, 5], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    rotateY = 0;
    textOpacity = 0;
  } else if (relFrame < 28) {
    translateY = 0;
    cardOpacity = 1;
    scale = interpolate(relFrame, [18, 28], [0.72, 0.76], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    rotateY = interpolate(relFrame, [18, 28], [0, 90], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.in(Easing.quad),
    });
    textOpacity = 0;
  } else if (relFrame < 40) {
    translateY = 0;
    cardOpacity = 1;
    // Tepat saat width paling tipis (frame 28), teks dimunculkan!
    rotateY = interpolate(relFrame, [28, 40], [-90, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    });
    scale = interpolate(relFrame, [28, 40], [0.76, 1.0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.back(1.2)),
    });
    textOpacity = 1;
  } else {
    translateY = 0;
    cardOpacity = 1;
    scale = 1;
    rotateY = 0;
    textOpacity = 1;
  }

  // Efek kilau holographic foil: menyapu kartu begitu kartu selesai membalik
  const shineX =
    relFrame < 28
      ? -200
      : relFrame < 60
        ? interpolate(relFrame, [28, 60], [-200, 300], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.out(Easing.cubic),
          })
        : interpolate((frame * 2.5) % 200, [0, 200], [-200, 300]);

  // Fallbacks placeholder persis sesuai arahan prompts.md:L2
  const displayTitle = cardTitle || 'judul kartu';
  const displayRarity = cardRarity || 'rarity';
  const displayDesc = cardDesc || 'ini deskripsi panjang, maksimal 40 kata';

  // Resolusi daftar skill (maks 3) - kosongkan jika tidak diisi user
  const activeSkills: CardSkill[] = skills
    ? skills.filter(
        (s) =>
          (s.name && s.name.trim() !== '') ||
          (s.desc && s.desc.trim() !== '')
      )
    : (passiveName || passiveDesc)
      ? [
          {
            name: passiveName || 'pasif',
            desc: passiveDesc || 'ini deskripsi pasif',
            nameFontSize: passiveNameFontSize || 28,
            descFontSize: passiveDescFontSize || 22,
          },
        ]
      : [];

  return (
    <div
      className="relative w-[760px] h-[1140px] rounded-[38px] p-5 border-2 select-none overflow-hidden"
      style={{
        transform: `translateY(${translateY}px) scale(${scale}) rotateY(${rotateY}deg)`,
        transformStyle: 'preserve-3d',
        opacity: cardOpacity,
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

      {/* 2. Body Dalam Kartu (Minimalis Jimat Koleksi Meme - Rasio 2:3 Animal Kaiser, Flex Start Vertikal Fixed Gap) */}
      <div
        className="relative w-full h-full rounded-[28px] bg-gradient-to-b from-neutral-900 via-neutral-950 to-black p-7 border flex flex-col justify-start items-start gap-5"
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

        {/* DIBAWAH GAMBAR: Judul Kartu FLEX ROW dengan Rarity (Justify Center, muncul pasca-flip) */}
        <div
          className="flex flex-row items-baseline justify-center gap-6 w-full pb-2 border-b"
          style={{
            borderColor: `${cardColor}40`,
            opacity: textOpacity,
            visibility: textOpacity > 0 ? 'visible' : 'hidden',
          }}
        >
          <h2
            className="font-black text-white text-center tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] leading-[1.25] pb-1 min-w-0"
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

        {/* DIBAWAHNYA LAGI: Deskripsi Kartu Biasa (Justify Center / Rata Tengah, muncul pasca-flip) */}
        {displayDesc && (
          <p
            className="text-neutral-200 text-center leading-relaxed font-normal w-full px-4 whitespace-pre-line drop-shadow"
            style={{
              fontSize: `${descFontSize}px`,
              opacity: textOpacity,
              visibility: textOpacity > 0 ? 'visible' : 'hidden',
            }}
          >
            {displayDesc}
          </p>
        )}

        {/* DIBAWAHNYA LAGI: Daftar Skill (Maksimal 3, Judul tanpa background pill / no overstyling, muncul pasca-flip) */}
        {activeSkills.length > 0 && (
          <div
            className="w-full flex flex-col gap-3.5"
            style={{
              opacity: textOpacity,
              visibility: textOpacity > 0 ? 'visible' : 'hidden',
            }}
          >
            {activeSkills.map((skill, idx) => (
              <div
                key={idx}
                className="w-full rounded-2xl bg-neutral-900/95 border p-5 flex flex-col items-start gap-1.5 shadow-inner"
                style={{ borderColor: `${cardColor}50` }}
              >
                {skill.name && (
                  <div
                    className="font-black uppercase tracking-wider leading-snug"
                    style={{
                      color: cardColor,
                      fontSize: `${skill.nameFontSize || 32}px`,
                    }}
                  >
                    {skill.name}
                  </div>
                )}
                {skill.desc && (
                  <p
                    className="text-neutral-300 text-left leading-relaxed font-normal whitespace-pre-line w-full"
                    style={{
                      fontSize: `${skill.descFontSize || 26}px`,
                    }}
                  >
                    {skill.desc}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
