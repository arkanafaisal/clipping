import { useEffect, useState, useRef } from 'react';
import FeedItemStream from './FeedItemStream';
import { fetchStreamUrl, fetchHeatmap } from '../services/api';
import { Play, Pause, Rewind, FastForward, ChevronLeft, ChevronRight } from 'lucide-react';

const VIDEO_ID = "e7uVibGgVuM"; // Hardcoded for development
const DRAFT_KEY = `clips_draft_${VIDEO_ID}`;

// Helper Format Waktu
function formatTime(seconds) {
  if (seconds === undefined || seconds === null) return '00:00:00.00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);

  const pad = (num, len = 2) => num.toString().padStart(len, '0');

  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms)}`;
  return `${pad(m)}:${pad(s)}.${pad(ms)}`;
}

// Tombol UI
const AdjustButton = ({ icon: Icon, number, onClick, label }) => (
  <button 
    onClick={onClick}
    className="relative flex justify-center items-center text-white/80 hover:text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] transition-transform hover:scale-110 active:scale-95 flex-shrink-0"
    title={label}
  >
    <Icon size={44} strokeWidth={1.5} />
    <span className="absolute text-[14px] font-bold" style={{ marginTop: '2px' }}>{number}</span>
  </button>
);

export default function Feed() {
  const [clips, setClips] = useState([]);

  const [globalStreamUrl, setGlobalStreamUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingText, setLoadingText] = useState("Memeriksa draft lokal...");

  // State untuk UI Global
  const [activeClipId, setActiveClipId] = useState(1); // Default sementara
  const [activeProgress, setActiveProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Menyimpan referensi video
  const videoRefs = useRef({});

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
          const heatmapData = await fetchHeatmap(VIDEO_ID, 5, 5); // numClips=5, offset=5
          loadedClips = heatmapData.clips;
          if (mounted) {
            setClips(loadedClips);
            localStorage.setItem(DRAFT_KEY, JSON.stringify(loadedClips));
          }
        }
        
        // 3. Fetch Stream URL
        if (loadedClips.length > 0) {
          setLoadingText("Mengekstrak Stream URL untuk pemutaran...");
          const url = await fetchStreamUrl(VIDEO_ID);
          if (mounted) {
            setGlobalStreamUrl(url);
            setActiveClipId(loadedClips[0].id); // Set aktif ke klip pertama
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

  const togglePlayGlobal = () => {
    const currentVideo = videoRefs.current[activeClipId];
    if (currentVideo) {
      if (isPlaying) {
        currentVideo.pause();
      } else {
        currentVideo.play();
      }
    }
  };

  const triggerSkip = (seconds) => {
    const currentVideo = videoRefs.current[activeClipId];
    if (currentVideo) {
      currentVideo.skip(seconds);
    }
  };

  if (loading) {
    return <div className="h-[100dvh] w-full bg-black flex justify-center items-center text-white">Mempersiapkan Semua Klip (Sekitar 10 detik)...</div>;
  }

  if (error) {
    return <div className="h-[100dvh] w-full bg-black flex justify-center items-center text-red-500">Gagal memuat video: {error}</div>;
  }

  const activeClip = clips.find(c => c.id === activeClipId) || clips[0];

  return (
    <div className="relative w-full h-[100dvh] bg-black overflow-hidden">

      {/* GLOBAL TOP NAV (Simetris 3 Lapis) */}
      <div className="absolute top-0 left-0 w-full z-50 flex flex-col pointer-events-none">

        {/* Lapis 1: TIME RANGE */}
        <div className="bg-black/90 text-white text-center py-2 font-mono text-sm tracking-wider border-b border-white/10 shadow-xl pointer-events-auto">
          {formatTime(activeClip.start)} - {formatTime(activeClip.end)}
        </div>

        {/* Lapis 2: EXTEND ROW (Hijau) */}
        <div className="flex justify-between items-center bg-emerald-900/80 backdrop-blur-md px-4 py-2.5 border-b border-white/10 pointer-events-auto">
          <div className="flex gap-2.5">
            <button className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-md text-white font-bold text-sm transition-colors active:scale-95 shadow-md">+5</button>
            <button className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-md text-white font-bold text-sm transition-colors active:scale-95 shadow-md">+1</button>
          </div>
          <div className="text-emerald-100 font-black tracking-widest text-[11px] uppercase drop-shadow-md">Extend</div>
          <div className="flex gap-2.5">
            <button className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-md text-white font-bold text-sm transition-colors active:scale-95 shadow-md">+1</button>
            <button className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-md text-white font-bold text-sm transition-colors active:scale-95 shadow-md">+5</button>
          </div>
        </div>

        {/* Lapis 3: CROP ROW (Merah) */}
        <div className="flex justify-between items-center bg-rose-900/80 backdrop-blur-md px-4 py-2.5 border-b border-white/10 pointer-events-auto shadow-lg">
          <div className="flex gap-2.5">
            <button className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-md text-white font-bold text-sm transition-colors active:scale-95 shadow-md">-5</button>
            <button className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-md text-white font-bold text-sm transition-colors active:scale-95 shadow-md">-1</button>
          </div>
          <div className="text-rose-100 font-black tracking-widest text-[11px] uppercase drop-shadow-md">Crop</div>
          <div className="flex gap-2.5">
            <button className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-md text-white font-bold text-sm transition-colors active:scale-95 shadow-md">-1</button>
            <button className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-md text-white font-bold text-sm transition-colors active:scale-95 shadow-md">-5</button>
          </div>
        </div>

      </div>

      {/* FEED SCROLL CONTAINER */}
      <div className="h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory bg-black scroll-smooth hide-scrollbar">
        {clips.map(clip => (
          <FeedItemStream
            key={clip.id}
            id={clip.id}
            ref={(el) => (videoRefs.current[clip.id] = el)}
            streamUrl={globalStreamUrl}
            startTime={clip.start}
            endTime={clip.end}
            onVisible={(id) => setActiveClipId(id)}
            onProgress={(pct) => setActiveProgress(pct)}
            onPlayStateChange={(playing) => setIsPlaying(playing)}
          />
        ))}
      </div>

      {/* GLOBAL BOTTOM NAV (Playback Controls) */}
      <div className="absolute bottom-0 left-0 w-full z-50 flex flex-col bg-black/90 backdrop-blur-xl border-t border-white/10">

        {/* PROGRESS BAR */}
        <div className="w-full h-1 bg-white/20">
          <div
            className="h-full bg-red-500 transition-all duration-75 ease-linear shadow-[0_0_10px_rgba(239,68,68,0.7)]"
            style={{ width: `${activeProgress}%` }}
          ></div>
        </div>

        {/* PLAYBACK CONTROLS */}
        <div className="flex justify-center items-center gap-6 py-4 px-4 pb-8">
          <button onClick={() => triggerSkip(-10)} className="text-white/60 hover:text-white transition-colors active:scale-90"><Rewind size={24} /></button>
          <button onClick={() => triggerSkip(-3)} className="text-white/60 hover:text-white transition-colors active:scale-90"><ChevronLeft size={32} /></button>

          <button onClick={togglePlayGlobal} className="text-black bg-white p-3 rounded-full hover:bg-gray-200 transition-colors active:scale-95 shadow-[0_0_15px_rgba(255,255,255,0.4)] mx-2">
            {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
          </button>

          <button onClick={() => triggerSkip(3)} className="text-white/60 hover:text-white transition-colors active:scale-90"><ChevronRight size={32} /></button>
          <button onClick={() => triggerSkip(10)} className="text-white/60 hover:text-white transition-colors active:scale-90"><FastForward size={24} /></button>
        </div>
      </div>

    </div>
  )
}

