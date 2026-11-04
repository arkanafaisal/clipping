import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';

interface RewindEffectProps {
  progress: number; // 0 to 1
  skipAmountSeconds: number; // total - x
  targetTimestampText?: string;
}

/**
 * Efek Skip Kebelakang persis seperti YouTube Double-Tap Rewind:
 * - Muncul di bagian KIRI layar (setengah lingkaran / kubah gelombang busur putih melengkung)
 * - Tiga panah berriak bergelombang ke arah kiri (◀◀◀)
 * - Teks durasi lompatan: "{N} detik"
 */
export const RewindEffect: React.FC<RewindEffectProps> = ({
  progress,
  skipAmountSeconds,
}) => {
  const frame = useCurrentFrame();

  // Gelombang kubah melengkung di sisi kiri mengembang dan memudar
  const waveWidth = interpolate(progress, [0, 0.45, 1], [32, 54, 58]);
  const waveOpacity = interpolate(progress, [0, 0.15, 0.8, 1], [0, 1, 0.9, 0]);

  // Animasi riak sekuensial pada 3 panah chevron YouTube (dari kanan ke kiri)
  const chevronWave = (progress * 5) % 1;
  const opacity1 = chevronWave >= 0.0 && chevronWave < 0.6 ? 1 : 0.35;
  const opacity2 = chevronWave >= 0.2 && chevronWave < 0.8 ? 1 : 0.35;
  const opacity3 = chevronWave >= 0.4 ? 1 : 0.35;

  // Bulatkan detik lompatan (ala YouTube: "10 detik", "7 detik", dst)
  const secondsDisplay = Math.max(1, Math.round(skipAmountSeconds));

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
      {/* Kubah busur melengkung putih di sisi kiri ala YouTube */}
      <div
        className="absolute inset-y-0 left-0 flex items-center justify-center rounded-r-full bg-white/20 backdrop-blur-[2px] transition-all"
        style={{
          width: `${waveWidth}%`,
          opacity: waveOpacity,
        }}
      >
        <div className="flex flex-col items-center gap-2 pr-10">
          {/* Tiga panah segitiga YouTube beriak ke arah kiri */}
          <div className="flex items-center gap-2 text-white text-5xl font-black drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] select-none">
            <span style={{ opacity: opacity3 }}>◀</span>
            <span style={{ opacity: opacity2 }}>◀</span>
            <span style={{ opacity: opacity1 }}>◀</span>
          </div>

          {/* Teks durasi lompatan detik ala YouTube */}
          <div className="text-white font-sans font-black text-2xl tracking-wide drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] select-none text-center">
            {secondsDisplay} detik
          </div>
        </div>
      </div>
    </div>
  );
};
