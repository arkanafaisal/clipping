import { useState, useEffect } from 'react';
import Feed from './components/Feed';
import Dashboard from './components/Dashboard';

function App() {
  const [currentVideoId, setCurrentVideoId] = useState(null);
  const [currentCount, setCurrentCount] = useState(50);

  useEffect(() => {
    const handlePopState = (event) => {
      if (event.state && event.state.videoId) {
        setCurrentVideoId(event.state.videoId);
        if (event.state.count) setCurrentCount(event.state.count);
      } else {
        setCurrentVideoId(null);
      }
    };

    // Saat load awal, pastikan state browser sinkron dengan URL kosong
    window.history.replaceState({ videoId: null }, '', window.location.pathname);

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleOpenWorkshop = (videoId, count) => {
    setCurrentVideoId(videoId);
    if (count) setCurrentCount(count);

    // Push ke history agar tombol Back native browser / HP bisa kembali ke Dashboard
    window.history.pushState({ videoId, count }, '', `?v=${videoId}`);
  };

  return (
    <div className={`w-full bg-black flex justify-center overflow-x-hidden text-white font-sans ${currentVideoId ? 'h-[100dvh] overflow-hidden' : 'min-h-[100dvh]'}`}>
      <div 
        className={`w-full bg-neutral-950 relative flex flex-col ${
          currentVideoId 
            ? "max-w-[420px] h-[100dvh] shadow-[0_0_50px_rgba(0,0,0,0.8)] border-x border-white/5 overflow-hidden" 
            : "min-h-[100dvh]"
        }`}
      >
        {currentVideoId ? (
          <Feed videoId={currentVideoId} initialCount={currentCount} />
        ) : (
          <Dashboard onOpenWorkshop={handleOpenWorkshop} />
        )}
      </div>
    </div>
  );
}

export default App;
