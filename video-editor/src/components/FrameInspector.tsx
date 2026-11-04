import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Check,
  Target,
  Sparkles,
  Clock,
} from 'lucide-react';
import { framesToTimestamp, secondsToTimestamp } from '../utils/time';

interface FrameInspectorProps {
  fps?: number;
  totalDurationSeconds?: number;
  onSetTargetUndo: (timestamp: string) => void;
  currentTarget: string;
}

export const FrameInspector: React.FC<FrameInspectorProps> = ({
  fps = 30,
  totalDurationSeconds = 10.95,
  onSetTargetUndo,
  currentTarget,
}) => {
  const [currentFrame, setCurrentFrame] = useState<number>(Math.round(3.45 * fps));
  const [copied, setCopied] = useState<boolean>(false);

  const maxFrames = Math.max(1, Math.round(totalDurationSeconds * fps));
  const currentSeconds = currentFrame / fps;
  const currentTimestamp = framesToTimestamp(currentFrame, fps);

  const stepFrame = (delta: number) => {
    setCurrentFrame((prev) => Math.min(maxFrames, Math.max(0, prev + delta)));
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(currentTimestamp);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 rounded-2xl bg-neutral-900/90 border border-amber-500/30 shadow-xl space-y-4">
      {/* Title */}
      <div className="flex justify-between items-center">
        <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          Precision Millisecond Inspector
        </span>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
          {fps} FPS ({Math.round(1000 / fps)}ms/frame)
        </span>
      </div>

      <p className="text-[11px] text-neutral-400 leading-snug">
        Geser scrubber atau gunakan tombol step untuk menemukan detik & milidetik presisi saat ekspresi/facecam lucu muncul.
      </p>

      {/* Frame / Timestamp Digital Display */}
      <div className="p-3 rounded-xl bg-black/80 border border-neutral-800 flex justify-between items-center font-mono">
        <div>
          <span className="text-[10px] text-neutral-500 block">TIMESTAMP PRESISI</span>
          <span className="text-2xl font-black text-amber-400">
            {currentTimestamp}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-neutral-500 block">FRAME NUMBER</span>
          <span className="text-sm font-bold text-neutral-300">
            #{currentFrame} / {maxFrames}
          </span>
          <span className="text-[10px] text-emerald-400 block">
            ({currentSeconds.toFixed(3)}s)
          </span>
        </div>
      </div>

      {/* Scrubber Range Slider */}
      <div className="space-y-1">
        <input
          type="range"
          min="0"
          max={maxFrames}
          value={currentFrame}
          onChange={(e) => setCurrentFrame(Number(e.target.value))}
          className="w-full accent-amber-500 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] font-mono text-neutral-500">
          <span>00:00.000</span>
          <span>{secondsToTimestamp(totalDurationSeconds)}</span>
        </div>
      </div>

      {/* Precision Step Buttons */}
      <div className="grid grid-cols-4 gap-2">
        <button
          onClick={() => stepFrame(-fps)}
          title="Mundur 1 detik"
          className="px-2 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-mono font-semibold flex items-center justify-center gap-1 text-neutral-300"
        >
          <ChevronsLeft className="w-3.5 h-3.5" /> -1s
        </button>
        <button
          onClick={() => stepFrame(-1)}
          title="Mundur 1 frame (~33ms)"
          className="px-2 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-mono font-semibold flex items-center justify-center gap-1 text-neutral-300"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> -1F
        </button>
        <button
          onClick={() => stepFrame(1)}
          title="Maju 1 frame (~33ms)"
          className="px-2 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-mono font-semibold flex items-center justify-center gap-1 text-neutral-300"
        >
          +1F <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => stepFrame(fps)}
          title="Maju 1 detik"
          className="px-2 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-mono font-semibold flex items-center justify-center gap-1 text-neutral-300"
        >
          +1s <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Action Buttons: Set as Target or Copy */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSetTargetUndo(currentTimestamp)}
          className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md ${
            currentTarget === currentTimestamp
              ? 'bg-emerald-600 text-white'
              : 'bg-amber-500 hover:bg-amber-400 text-black'
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          {currentTarget === currentTimestamp ? 'Target Aktif!' : 'Jadikan Target Undo'}
        </button>

        <button
          onClick={handleCopy}
          className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs flex items-center justify-center gap-1 font-mono"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};
