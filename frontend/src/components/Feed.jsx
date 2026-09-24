import { useEffect, useState, useRef } from 'react';
import FeedItemStream from './FeedItemStream';
import { fetchStreamUrl, fetchHeatmap } from '../services/api';
import { Play, Pause, Rewind, FastForward, ChevronLeft, ChevronRight, CheckCircle2, RotateCcw, Download } from 'lucide-react';

// Helper Format Waktu
function formatTime(seconds) {
  if (seconds === undefined || seconds === null) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const pad = (num, len = 2) => num.toString().padStart(len, '0');

  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatTimeWithMs(seconds) {
  if (seconds === undefined || seconds === null) return '00:00:00.00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);

  const pad = (num, len = 2) => num.toString().padStart(len, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 2)}`;
}

export default function Feed({ videoId, initialCount = 25 }) {
  const DRAFT_KEY = `clips_draft_${videoId}`;

  const [clips, setClips] = useState([]);
  const [visibleCount, setVisibleCount] = useState(initialCount);

  const [globalStreamUrl, setGlobalStreamUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingText, setLoadingText] = useState("Memeriksa draft lokal...");

  // State untuk UI Global
  const [activeClipId, setActiveClipId] = useState(null);
  const [activeProgress, setActiveProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Menyimpan referensi video tunggal
  const videoRef = useRef(null);
  
  // Drag progress state
  const progressBarRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);

  // Absolute time edit state
  const [activeTimeEdit, setActiveTimeEdit] = useState(null);
  const [tempTimeValue, setTempTimeValue] = useState("");
  const debounceTimerRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    async function initData() {
      try {
        let loadedClips = [];

        // 1. Cek Local Storage
        const savedDraft = localStorage.getItem(DRAFT_KEY);
        if (savedDraft) {
          setLoadingText("Memuat draft potongan klip Anda...");
          // Amankan data lama yang mungkin belum punya rank dengan fallback idx + 1
          loadedClips = JSON.parse(savedDraft).map((c, idx) => ({ ...c, rank: c.rank || idx + 1 }));
          if (mounted) setClips(loadedClips);
        } else {
          // 2. Jika kosong, fetch dari API Heatmap
          setLoadingText("Mengekstrak Heatmap AI (Bisa memakan waktu belasan detik)...");
          const heatmapData = await fetchHeatmap(videoId, 100, 0); // Meminta 100 klip secara eksplisit, offset 0
          loadedClips = heatmapData.clips.map((c, idx) => ({ ...c, status: 'none', rank: idx + 1 })); // Tambah status dan rank

          if (mounted) {
            setClips(loadedClips);
            localStorage.setItem(DRAFT_KEY, JSON.stringify(loadedClips));

            // Simpan info workshop ke Dashboard
            const savedWorkshops = JSON.parse(localStorage.getItem('workshops_list') || '[]');
            const existingIndex = savedWorkshops.findIndex(w => w.videoId === videoId);
            const workshopData = {
              videoId,
              title: heatmapData.title,
              count: initialCount,
              lastUpdated: Date.now()
            };

            if (existingIndex >= 0) {
              savedWorkshops[existingIndex] = workshopData;
            } else {
              savedWorkshops.push(workshopData);
            }
            localStorage.setItem('workshops_list', JSON.stringify(savedWorkshops));
          }
        }

        // 3. Fetch Stream URL
        if (loadedClips.length > 0) {
          setLoadingText("Mengekstrak Stream URL untuk pemutaran...");
          const url = await fetchStreamUrl(videoId);
          if (mounted) {
            setGlobalStreamUrl(url);
            // Set klip aktif ke klip pertama berdasarkan urutan waktu (kronologis) dari yang terlihat
            const initialVisible = [...loadedClips].slice(0, initialCount).sort((a, b) => a.start - b.start);
            setActiveClipId(initialVisible[0].id);
            setLoading(false);
          }
        } else {
          throw new Error("Tidak ada klip yang ditemukan dari heatmap.");
        }

      } catch (err) {
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    }

    initData();

    return () => { mounted = false; };
  }, []);

  // Sinkronisasi otomatis ke Local Storage saat klip di-edit
  useEffect(() => {
    if (clips.length > 0) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(clips));
    }
  }, [clips]);

  const updateClipStart = (delta) => {
    const currentClip = clips.find(c => c.id === activeClipId);
    if (!currentClip) return;
    
    const newStart = Math.max(0, Math.min(currentClip.start + delta, currentClip.end - 1));
    
    setClips(prev => prev.map(c => {
      if (c.id === activeClipId) return { ...c, start: newStart };
      return c;
    }));
    
    if (videoRef.current) {
        videoRef.current.seekTo(newStart);
    }
  };

  const updateClipEnd = (delta) => {
    const currentClip = clips.find(c => c.id === activeClipId);
    if (!currentClip) return;

    const newEnd = Math.max(currentClip.start + 1, currentClip.end + delta);
    
    setClips(prev => prev.map(c => {
      if (c.id === activeClipId) return { ...c, end: newEnd };
      return c;
    }));
    
    if (videoRef.current) {
        videoRef.current.seekTo(Math.max(0, newEnd - 3));
    }
  };

  const handleMsTimeChange = (type, valStr) => {
    setTempTimeValue(valStr);
    
    // Agar '6' dievaluasi sebagai '60' (60 centiseconds / 600ms)
    const msStr = valStr.toString().padEnd(2, '0').slice(0, 2);
    const msValue = parseInt(msStr, 10);
    
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    
    debounceTimerRef.current = setTimeout(() => {
      if (isNaN(msValue)) return;
      
      const currentClip = clips.find(c => c.id === activeClipId);
      if (!currentClip) return;
      
      let baseSeconds = Math.floor(type === 'start' ? currentClip.start : currentClip.end);
      // Batasi antara 0 - 99
      let safeMs = Math.max(0, Math.min(99, msValue));
      const newFinalValue = baseSeconds + (safeMs / 100);
      
      setClips(prev => {
        const newClips = prev.map(c => {
          if (c.id === activeClipId) {
            return { ...c, [type]: newFinalValue };
          }
          return c;
        });
        localStorage.setItem(DRAFT_KEY, JSON.stringify(newClips));
        return newClips;
      });

      // Auto-preview logic (dieksekusi langsung tanpa perlu setClips kedua)
      if (videoRef.current && videoRef.current.seekTo) {
          if (type === 'end') {
              const previewTime = Math.max(0, newFinalValue - 3);
              videoRef.current.seekTo(previewTime);
          } else if (type === 'start') {
              videoRef.current.seekTo(newFinalValue);
          }
      }
    }, 1500); // 1.5 detik debounce (sangat hemat limit & cocok untuk ketik manual di HP)
  };

  const updateClipStatus = (status) => {
    setClips(prev => prev.map(c => {
      if (c.id === activeClipId) {
        // Toggle: Jika status sama dengan yang ditekan, matikan (none)
        return { ...c, status: c.status === status ? 'none' : status };
      }
      return c;
    }));
  };



  const handleSendToWhatsApp = () => {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const command = `!download ${videoUrl}\n${formatTimeWithMs(activeClip.start)} - ${formatTimeWithMs(activeClip.end)}`;
    const encodedCommand = encodeURIComponent(command);

    // Konstanta nomor bot, silakan diisi nanti misal: "6281234567890"
    // Jika kosong, wa.me akan meminta user memilih kontak
    const BOT_NUMBER = "6285742923730";
    const waUrl = BOT_NUMBER
      ? `https://wa.me/${BOT_NUMBER}?text=${encodedCommand}`
      : `https://wa.me/?text=${encodedCommand}`;

    window.open(waUrl, '_blank');
  };

  const togglePlayGlobal = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const triggerSkip = (seconds) => {
    if (videoRef.current) {
      videoRef.current.skip(seconds);
    }
  };

  const activeClip = clips.find(c => c.id === activeClipId) || clips[0] || { start: 0, end: 0, status: 'none' };

  useEffect(() => {
    const handlePointerMove = (e) => {
      if (isDragging) {
        updateDrag(e);
      }
    };

    const handlePointerUp = (e) => {
      if (isDragging) {
        const newPct = updateDrag(e);
        setActiveProgress(newPct); // Optimistic UI update agar bar tidak lompat balik
        setIsDragging(false);
        const duration = activeClip.end - activeClip.start;
        const targetTime = activeClip.start + (newPct / 100) * duration;
        if (videoRef.current && videoRef.current.seekTo) {
          videoRef.current.seekTo(targetTime);
          videoRef.current.play(); // Auto resume after drag
        }
      }
    };

    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, activeClip]);

  if (loading) {
    return <div className="h-[100dvh] w-full bg-black flex justify-center items-center text-white">{loadingText}</div>;
  }

  if (error) {
    return <div className="h-[100dvh] w-full bg-black flex justify-center items-center text-red-500">Gagal memuat video: {error}</div>;
  }

  const visibleClips = [...clips].slice(0, visibleCount).sort((a, b) => a.start - b.start);

  const formatRelativeTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const updateDrag = (e) => {
    if (progressBarRef.current) {
      const rect = progressBarRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      let pct = (x / rect.width) * 100;
      if (pct < 0) pct = 0;
      if (pct > 100) pct = 100;
      setDragProgress(pct);
      return pct;
    }
    return 0;
  };

  const handlePointerDown = (e) => {
    setIsDragging(true);
    updateDrag(e);
    // Optional: Pause video while dragging for smoother UX
    if (videoRef.current && isPlaying) videoRef.current.pause();
  };

  return (
    <div className="flex flex-col w-full h-[100dvh] bg-neutral-950 overflow-hidden font-sans">

      {/* 1. TOP CONTROLS (Status, Extend, Crop) */}
      <div className="shrink-0 bg-neutral-900 border-b border-white/10 flex flex-col z-30 shadow-md">

        {/* Time Range & Status Marking Row */}
        <div className="flex flex-row justify-between items-center py-2.5 px-4 bg-black border-b border-white/5 min-h-[44px]">

          {/* KIRI: Tombol Kirim ke WA Bot */}
          <button 
            onClick={handleSendToWhatsApp} 
            className="flex items-center justify-center p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
            title="Kirim Perintah ke Bot WhatsApp"
          >
            <Download size={18} />
          </button>

          {/* TENGAH: Rentang Waktu */}
          <div className="font-mono text-sm font-bold tracking-widest text-white/90 whitespace-nowrap px-2 flex gap-2 items-center justify-center min-w-[200px]">
            {activeTimeEdit === 'start' ? (
              <input
                type="number"
                step="1"
                min="0"
                max="99"
                className="w-16 bg-neutral-900 border border-emerald-500 rounded px-1.5 py-0.5 text-center text-emerald-400 focus:outline-none"
                value={tempTimeValue}
                onChange={(e) => handleMsTimeChange('start', e.target.value)}
                onBlur={() => setActiveTimeEdit(null)}
                autoFocus
              />
            ) : (
              <span 
                className="cursor-pointer hover:text-emerald-400 transition-colors px-1 border-b border-transparent hover:border-emerald-500/50"
                onClick={() => { 
                    setActiveTimeEdit('start'); 
                    setTempTimeValue(Math.floor((activeClip.start % 1) * 100).toString().padStart(2, '0')); 
                }}
                title="Edit Milidetik Mulai"
              >
                {formatTime(activeClip.start)}
              </span>
            )}
            
            <span className="opacity-50">-</span>
            
            {activeTimeEdit === 'end' ? (
              <input
                type="number"
                step="1"
                min="0"
                max="99"
                className="w-16 bg-neutral-900 border border-rose-500 rounded px-1.5 py-0.5 text-center text-rose-400 focus:outline-none"
                value={tempTimeValue}
                onChange={(e) => handleMsTimeChange('end', e.target.value)}
                onBlur={() => setActiveTimeEdit(null)}
                autoFocus
              />
            ) : (
              <span 
                className="cursor-pointer hover:text-rose-400 transition-colors px-1 border-b border-transparent hover:border-rose-500/50"
                onClick={() => { 
                    setActiveTimeEdit('end'); 
                    setTempTimeValue(Math.floor((activeClip.end % 1) * 100).toString().padStart(2, '0')); 
                }}
                title="Edit Milidetik Selesai"
              >
                {formatTime(activeClip.end)}
              </span>
            )}
          </div>

          {/* KANAN: Tombol Tandai Selesai */}
          <button
            onClick={() => updateClipStatus('done')}
            className={`flex items-center justify-center p-2 rounded-lg transition-colors ${activeClip.status === 'done' ? 'bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-white/5 text-emerald-400 hover:bg-emerald-600/20'}`}
            title="Tandai Selesai"
          >
            <CheckCircle2 size={18} />
          </button>

        </div>

        {/* Extend Row */}
        <div className="flex justify-between items-center px-4 py-2 border-b border-white/5 bg-gradient-to-r from-emerald-900/10 via-emerald-900/20 to-emerald-900/10">
          <div className="flex gap-2">
            <button onClick={() => updateClipStart(-5)} className="w-11 h-8 flex justify-center items-center bg-emerald-600/20 hover:bg-emerald-600/40 rounded text-emerald-400 font-bold text-xs transition-colors active:scale-95 border border-emerald-500/20">+5</button>
            <button onClick={() => updateClipStart(-1)} className="w-11 h-8 flex justify-center items-center bg-emerald-600/20 hover:bg-emerald-600/40 rounded text-emerald-400 font-bold text-xs transition-colors active:scale-95 border border-emerald-500/20">+1</button>
          </div>
          <div className="text-emerald-500 font-black tracking-widest text-[10px] uppercase drop-shadow-md">Extend</div>
          <div className="flex gap-2">
            <button onClick={() => updateClipEnd(1)} className="w-11 h-8 flex justify-center items-center bg-emerald-600/20 hover:bg-emerald-600/40 rounded text-emerald-400 font-bold text-xs transition-colors active:scale-95 border border-emerald-500/20">+1</button>
            <button onClick={() => updateClipEnd(5)} className="w-11 h-8 flex justify-center items-center bg-emerald-600/20 hover:bg-emerald-600/40 rounded text-emerald-400 font-bold text-xs transition-colors active:scale-95 border border-emerald-500/20">+5</button>
          </div>
        </div>

        {/* Crop Row */}
        <div className="flex justify-between items-center px-4 py-2 bg-gradient-to-r from-rose-900/10 via-rose-900/20 to-rose-900/10">
          <div className="flex gap-2">
            <button onClick={() => updateClipStart(5)} className="w-11 h-8 flex justify-center items-center bg-rose-600/20 hover:bg-rose-600/40 rounded text-rose-400 font-bold text-xs transition-colors active:scale-95 border border-rose-500/20">-5</button>
            <button onClick={() => updateClipStart(1)} className="w-11 h-8 flex justify-center items-center bg-rose-600/20 hover:bg-rose-600/40 rounded text-rose-400 font-bold text-xs transition-colors active:scale-95 border border-rose-500/20">-1</button>
          </div>
          <div className="text-rose-500 font-black tracking-widest text-[10px] uppercase drop-shadow-md">Crop</div>
          <div className="flex gap-2">
            <button onClick={() => updateClipEnd(-1)} className="w-11 h-8 flex justify-center items-center bg-rose-600/20 hover:bg-rose-600/40 rounded text-rose-400 font-bold text-xs transition-colors active:scale-95 border border-rose-500/20">-1</button>
            <button onClick={() => updateClipEnd(-5)} className="w-11 h-8 flex justify-center items-center bg-rose-600/20 hover:bg-rose-600/40 rounded text-rose-400 font-bold text-xs transition-colors active:scale-95 border border-rose-500/20">-5</button>
          </div>
        </div>
      </div>

      {/* 2. VIDEO PLAYER (flex-1 mengisi sisa layar, object-contain di dalam komponen akan memusatkan video) */}
      <div className="flex-1 w-full bg-black relative z-20">
        <FeedItemStream
          ref={videoRef}
          clipId={activeClipId}
          streamUrl={globalStreamUrl}
          startTime={activeClip.start}
          endTime={activeClip.end}
          onProgress={(pct) => setActiveProgress(pct)}
          onPlayStateChange={(playing) => setIsPlaying(playing)}
        />
      </div>

      {/* 3. BOTTOM PLAYBACK (Fixed) */}
      <div className="shrink-0 flex flex-col bg-neutral-950 border-t border-white/5 z-20 shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
        {/* PROGRESS BAR - Interaktif & Draggable */}
        <div 
          className="w-full h-[6px] bg-white/10 border-y border-white/10 relative cursor-pointer group touch-none"
          ref={progressBarRef}
          onPointerDown={handlePointerDown}
        >
          {/* Track Bar (Garis Merah) */}
          <div
            className={`h-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.8)] transition-all ${isDragging ? 'duration-0' : 'duration-100 ease-linear'}`}
            style={{ width: `${isDragging ? dragProgress : activeProgress}%` }}
          ></div>

          {/* Draggable Knob (Lingkaran Ujung) */}
          <div 
             className={`absolute top-1/2 -translate-y-1/2 -ml-2 w-4 h-4 bg-red-600 rounded-full shadow-[0_0_10px_rgba(220,38,38,1)] transition-all flex items-center justify-center ${isDragging ? 'duration-0 scale-125 opacity-100' : 'duration-100 ease-linear opacity-0 group-hover:opacity-100'}`}
             style={{ left: `${isDragging ? dragProgress : activeProgress}%` }}
          >
             {/* Tooltip Waktu Relatif (Hanya muncul saat di-drag atau disentuh/hover) */}
             <div className={`absolute bottom-6 bg-black text-white text-[10px] font-mono px-2 py-1 rounded shadow-lg pointer-events-none whitespace-nowrap transition-opacity border border-white/20 ${isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
               {formatRelativeTime( (isDragging ? dragProgress : activeProgress) / 100 * (activeClip.end - activeClip.start) )}
             </div>
          </div>
        </div>

        {/* PLAYBACK CONTROLS */}
        <div className="flex justify-center items-center gap-6 py-3 px-4">
          <button onClick={() => triggerSkip(-10)} className="text-white/40 hover:text-white transition-colors active:scale-90"><Rewind size={22} /></button>
          <button onClick={() => triggerSkip(-3)} className="text-white/40 hover:text-white transition-colors active:scale-90"><ChevronLeft size={28} /></button>

          <button
            onClick={togglePlayGlobal}
            className="flex justify-center items-center w-12 h-12 text-black bg-white rounded-full hover:bg-gray-200 transition-colors active:scale-95 shadow-[0_0_15px_rgba(255,255,255,0.4)] mx-2"
          >
            {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
          </button>

          <button onClick={() => triggerSkip(5)} className="text-white/40 hover:text-white transition-colors active:scale-90"><ChevronRight size={28} /></button>
          <button onClick={() => triggerSkip(15)} className="text-white/40 hover:text-white transition-colors active:scale-90"><FastForward size={22} /></button>
        </div>
      </div>

      {/* 4. CLIP GRID MENU (Fixed di posisi paling bawah, scroll horizontal) */}
      <div className="shrink-0 w-full bg-black border-t border-white/10 flex flex-col justify-center overflow-hidden z-30 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
        <div className="overflow-x-auto hide-scrollbar w-full px-4 py-3 border-b border-white/5">
          <div className="grid grid-rows-2 grid-flow-col gap-3 min-w-max h-max">
            {visibleClips.map((clip, idx) => {
              let statusClasses = "bg-neutral-900 border-white/10 text-white/70";
              if (clip.status === 'done') statusClasses = "bg-emerald-900/60 border-emerald-500/50 text-emerald-100 shadow-[0_0_10px_rgba(16,185,129,0.2)]";

              const isActive = activeClipId === clip.id;
              if (isActive) statusClasses += " ring-2 ring-white scale-105 z-10 font-bold";

              return (
                <button
                  key={clip.id}
                  onClick={() => setActiveClipId(clip.id)}
                  className={`w-[85px] relative flex flex-col items-center justify-center py-2.5 px-1 rounded-xl border transition-all duration-200 hover:brightness-125 active:scale-95 ${statusClasses}`}
                >
                  {/* Badge Peringkat Popularitas */}
                  <div className="absolute -top-1.5 -right-1.5 bg-rose-600/90 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-[0_2px_5px_rgba(0,0,0,0.5)] z-20 flex items-center justify-center border border-white/20">
                    #{clip.rank}
                  </div>

                  <span className="text-[10px] uppercase tracking-wider mb-1 opacity-60">Klip {idx + 1}</span>
                  <span className="text-[11px] font-mono leading-none">{formatTime(clip.start)}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

    </div>
  )
}

