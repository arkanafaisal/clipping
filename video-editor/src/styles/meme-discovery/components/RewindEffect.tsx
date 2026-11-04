import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface RewindEffectProps {
  progress: number; // 0 to 1
  skipAmountSeconds: number; // total - x detik
  targetTimestampText: string;
}

export const RewindEffect: React.FC<RewindEffectProps> = ({
  progress,
  skipAmountSeconds,
  targetTimestampText,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Pulse & ripple scale animation
  const rippleScale = interpolate(progress, [0, 1], [0.8, 1.25]);
  const opacity = interpolate(progress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);

  return (
    <div
      className="absolute inset-0 pointer-events-none z-40 flex flex-col items-center justify-center p-6"
      style={{ opacity }}
    >
      {/* Background Dim */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      {/* Modern Video Player Skip-Back Indicator (ala Double-Tap Rewind) */}
      <div
        className="relative flex flex-col items-center gap-3 p-8 rounded-full bg-black/80 border-2 border-amber-400/80 shadow-[0_0_50px_rgba(245,158,11,0.5)]"
        style={{
          transform: `scale(${rippleScale})`,
        }}
      >
        {/* Double Arrow Rewind Icons */}
        <div className="flex items-center gap-1 text-amber-400 text-5xl font-black tracking-tighter animate-pulse">
          <span>‹‹</span>
          <span className="text-4xl text-amber-300">‹</span>
        </div>

        {/* Skip Amount Counter: -{total - x}s */}
        <div className="text-center font-mono">
          <div className="text-4xl font-black text-white tracking-tight drop-shadow">
            -{skipAmountSeconds.toFixed(1)}s
          </div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-amber-300/90 mt-1">
            SEEK KE {targetTimestampText}
          </div>
        </div>
      </div>
    </div>
  );
};
