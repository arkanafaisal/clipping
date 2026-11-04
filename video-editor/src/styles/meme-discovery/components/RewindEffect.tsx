import React from 'react';
import { interpolate } from 'remotion';
import { secondsToTimestamp } from '../../../utils/time';

interface RewindEffectProps {
  progress: number; // 0 to 1
  currentRewindSec: number;
}

export const RewindEffect: React.FC<RewindEffectProps> = ({
  progress,
  currentRewindSec,
}) => {
  // Flash opacity of rewind HUD
  const scanlineShift = (progress * 100) % 20;

  return (
    <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden flex flex-col justify-between p-8">
      {/* VHS / Rewind Scanlines */}
      <div
        className="absolute inset-0 opacity-25 mix-blend-overlay"
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, rgba(0,0,0,0.5) 0px, rgba(0,0,0,0.5) 2px, transparent 2px, transparent 4px)`,
          transform: `translateY(${scanlineShift}px)`,
        }}
      />

      {/* Top Banner: REWIND / UNDO Status */}
      <div className="relative self-start inline-flex items-center gap-3 px-4 py-2 rounded-lg bg-red-600/90 text-white font-mono font-black text-sm tracking-widest shadow-2xl animate-pulse">
        <span>⏪ REWIND / UNDO</span>
        <span className="w-2 h-2 rounded-full bg-white animate-ping" />
      </div>

      {/* Center Rewind Overlay Effect */}
      <div className="relative self-center flex flex-col items-center gap-2 drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)]">
        <div className="text-6xl font-black text-amber-400 font-mono tracking-tighter">
          {secondsToTimestamp(currentRewindSec)}
        </div>
        <span className="text-xs uppercase font-mono font-bold tracking-widest text-neutral-300 bg-black/70 px-3 py-1 rounded">
          Mencari Frame Momen Terbaik...
        </span>
      </div>

      {/* Bottom Bar: Rewind Speed Indicator */}
      <div className="relative self-end text-xs font-mono font-bold text-amber-300 bg-black/60 px-3 py-1.5 rounded border border-amber-500/30">
        SPEED: -8.0x REVERSE
      </div>
    </div>
  );
};
