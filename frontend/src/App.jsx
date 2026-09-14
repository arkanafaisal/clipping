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
    <div className="w-full min-h-[100dvh] bg-black">
      {!currentVideoId ? (
        <Dashboard onOpenWorkshop={handleOpenWorkshop} />
      ) : (
        <Feed videoId={currentVideoId} initialCount={currentCount} />
      )}
    </div>
  );
}

export default App;
