import { useState } from 'react';
import Feed from './components/Feed';
import Dashboard from './components/Dashboard';

function App() {
  const [currentVideoId, setCurrentVideoId] = useState(null);
  const [currentCount, setCurrentCount] = useState(25);

  const handleOpenWorkshop = (videoId, count) => {
    setCurrentVideoId(videoId);
    setCurrentCount(count);
  };

  const handleBack = () => {
    setCurrentVideoId(null);
  };

  return (
    <div className="w-full min-h-[100dvh] bg-black font-sans text-white">
      {currentVideoId ? (
        <Feed videoId={currentVideoId} initialCount={currentCount} onBack={handleBack} />
      ) : (
        <Dashboard onOpenWorkshop={handleOpenWorkshop} />
      )}
    </div>
  );
}

export default App;

