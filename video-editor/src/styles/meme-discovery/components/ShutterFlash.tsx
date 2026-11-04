import React from 'react';
import { interpolate } from 'remotion';

interface ShutterFlashProps {
  progress: number; // 0 to 1
}

export const ShutterFlash: React.FC<ShutterFlashProps> = ({ progress }) => {
  // Flash opacity curve: rises sharply to 1, then fades smoothly to 0
  const opacity = interpolate(
    progress,
    [0, 0.15, 0.4, 1],
    [0, 1, 0.8, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  if (opacity <= 0.01) return null;

  return (
    <div
      className="absolute inset-0 bg-white pointer-events-none z-50 transition-opacity"
      style={{ opacity }}
    >
      {/* Subtle camera shutter viewfinder overlay */}
      <div className="absolute inset-8 border border-white/60 pointer-events-none flex items-center justify-center">
        <div className="w-12 h-12 border-t-2 border-l-2 border-white absolute top-0 left-0" />
        <div className="w-12 h-12 border-t-2 border-r-2 border-white absolute top-0 right-0" />
        <div className="w-12 h-12 border-b-2 border-l-2 border-white absolute bottom-0 left-0" />
        <div className="w-12 h-12 border-b-2 border-r-2 border-white absolute bottom-0 right-0" />
        <div className="w-6 h-6 border border-white/80 rounded-full" />
      </div>
    </div>
  );
};

