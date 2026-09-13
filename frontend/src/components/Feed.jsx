import { useEffect, useState, useRef } from 'react';
import FeedItemStream from './FeedItemStream';
import { fetchStreamUrl, fetchHeatmap } from '../services/api';
import { Play, Pause, Rewind, FastForward, ChevronLeft, ChevronRight, ArrowLeft, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';

// Helper Format Waktu
function formatTime(seconds) {
  if (seconds === undefined || seconds === null) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const pad = (num, len = 2) => num.toString().padStart(len, '0');

  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export default function Feed({ videoId, initialCount = 25, onBack }) {
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

  useEffect(() => {
    let mounted = true;

    async function initData() {
      try {
        let loadedClips = [];
        
        // 1. Cek Local Storage
        const savedDraft = localStorage.getItem(DRAFT_KEY);
        if (savedDraft) {
          setLoadingText("Memuat draft potongan klip Anda...");
          loadedClips = JSON.parse(savedDraft);
          if (mounted) setClips(loadedClips);
        } else {
          // 2. Jika kosong, fetch dari API Heatmap
          setLoadingText("Mengekstrak Heatmap AI (Bisa memakan waktu belasan detik)...");
          const heatmapData = await fetchHeatmap(videoId, 100, 0); // Meminta 100 klip secara eksplisit, offset 0
          loadedClips = heatmapData.clips.map(c => ({ ...c, status: 'none' })); // Tambah status
          
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

  const updateClipStart = (seconds) => {
    setClips(prev => prev.map(c => {
      if (c.id === activeClipId) {
        let newStart = c.start + seconds;
        if (newStart < 0) newStart = 0;
        if (newStart >= c.end) newStart = c.end - 1; // Jangan melebihi End
        return { ...c, start: newStart };
      }
      return c;
    }));
  };

  const updateClipEnd = (seconds) => {
    setClips(prev => prev.map(c => {
      if (c.id === activeClipId) {
        let newEnd = c.end + seconds;
        if (newEnd <= c.start) newEnd = c.start + 1; // Jangan mendahului Start
        return { ...c, end: newEnd };
      }
      return c;
    }));
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

  if (loading) {
    return <div className="h-[100dvh] w-full bg-black flex justify-center items-center text-white">{loadingText}</div>;
  }

  if (error) {
    return <div className="h-[100dvh] w-full bg-black flex justify-center items-center text-red-500">Gagal memuat video: {error}</div>;
  }

  const activeClip = clips.find(c => c.id === activeClipId) || clips[0];
  const visibleClips = [...clips].slice(0, visibleCount).sort((a, b) => a.start - b.start);

  return (
    <div className="flex flex-col w-full h-[100dvh] bg-neutral-950 overflow-hidden font-sans">
      
      {/* 1. TOP CONTROLS (Status, Extend, Crop) */}
      <div className="shrink-0 bg-neutral-900 border-b border-white/10 flex flex-col z-30 shadow-md">
        
        {/* Time Range & Status Marking Row */}
        <div className="flex justify-between items-center py-2.5 px-4 bg-black border-b border-white/5">
          <div className="font-mono text-sm font-bold tracking-widest text-white/90">
            {formatTime(activeClip.start)} - {formatTime(activeClip.end)}
          </div>
          <div className="flex items-center gap-3">
             <button 
               onClick={() => updateClipStatus('done')} 
               className={`flex items-center justify-center p-2 rounded-lg transition-colors ${activeClip.status === 'done' ? 'bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-white/5 text-emerald-400 hover:bg-emerald-600/20'}`}
              >
               <CheckCircle2 size={18} />
             </button>
             <button 
               onClick={() => updateClipStatus('skip')} 
               className={`flex items-center justify-center p-2 rounded-lg transition-colors ${activeClip.status === 'skip' ? 'bg-rose-600 text-white shadow-[0_0_15px_rgba(225,29,72,0.4)]' : 'bg-white/5 text-rose-400 hover:bg-rose-600/20'}`}
              >
               <XCircle size={18} />
             </button>
          </div>
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
            streamUrl={globalStreamUrl}
            startTime={activeClip.start}
            endTime={activeClip.end}
            onProgress={(pct) => setActiveProgress(pct)}
            onPlayStateChange={(playing) => setIsPlaying(playing)}
          />
      </div>

      {/* 3. BOTTOM PLAYBACK (Fixed) */}
      <div className="shrink-0 flex flex-col bg-neutral-950 border-t border-white/5 z-20 shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
        {/* PROGRESS BAR - With subtle outline to distinguish from video background */}
        <div className="w-full h-[6px] bg-white/10 border-y border-white/10">
          <div
            className="h-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.8)] transition-all duration-100 ease-linear"
            style={{ width: `${activeProgress}%` }}
          ></div>
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

          <button onClick={() => triggerSkip(3)} className="text-white/40 hover:text-white transition-colors active:scale-90"><ChevronRight size={28} /></button>
          <button onClick={() => triggerSkip(10)} className="text-white/40 hover:text-white transition-colors active:scale-90"><FastForward size={22} /></button>
        </div>
      </div>

      {/* 4. CLIP GRID MENU (Fixed di posisi paling bawah, scroll horizontal) */}
      <div className="shrink-0 w-full bg-black border-t border-white/10 flex flex-col justify-center overflow-hidden z-30 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
        <div className="overflow-x-auto hide-scrollbar w-full px-4 py-3">
          <div className="grid grid-rows-2 grid-flow-col gap-3 min-w-max h-max">
            {visibleClips.map((clip, idx) => {
              let statusClasses = "bg-neutral-900 border-white/10 text-white/70";
              if (clip.status === 'done') statusClasses = "bg-emerald-900/60 border-emerald-500/50 text-emerald-100 shadow-[0_0_10px_rgba(16,185,129,0.2)]";
              if (clip.status === 'skip') statusClasses = "bg-rose-900/60 border-rose-500/50 text-rose-100 shadow-[0_0_10px_rgba(244,63,94,0.2)]";
              
              const isActive = activeClipId === clip.id;
              if (isActive) statusClasses += " ring-2 ring-white scale-105 z-10 font-bold";

              return (
                <button
                  key={clip.id}
                  onClick={() => setActiveClipId(clip.id)}
                  className={`w-[85px] relative flex flex-col items-center justify-center py-2.5 px-1 rounded-xl border transition-all duration-200 hover:brightness-125 active:scale-95 ${statusClasses}`}
                >
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

