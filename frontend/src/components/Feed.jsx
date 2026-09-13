import { useEffect, useState } from 'react';
import FeedItemStream from './FeedItemStream';
import { fetchStreamUrl } from '../services/api';

export default function Feed() {
  const clips = [
    { id: 1, videoId: "e7uVibGgVuM", start: 30, end: 60 },
    { id: 2, videoId: "e7uVibGgVuM", start: 60, end: 90 },
    { id: 3, videoId: "e7uVibGgVuM", start: 90, end: 120 },
    { id: 4, videoId: "e7uVibGgVuM", start: 120, end: 150 },
    { id: 5, videoId: "e7uVibGgVuM", start: 150, end: 180 },
  ];

  const [globalStreamUrl, setGlobalStreamUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Kita mengambil videoId dari klip pertama karena semua klip berasal dari video yang sama
    const videoId = clips[0]?.videoId;
    if (!videoId) return;

    let mounted = true;
    fetchStreamUrl(videoId)
      .then(url => {
        if (mounted) {
          setGlobalStreamUrl(url);
          setLoading(false);
        }
      })
      .catch(err => {
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []); 

  if (loading) {
    return <div className="h-[100dvh] w-full bg-black flex justify-center items-center text-white">Mempersiapkan Semua Klip (Sekitar 10 detik)...</div>;
  }

  if (error) {
    return <div className="h-[100dvh] w-full bg-black flex justify-center items-center text-red-500">Gagal memuat video: {error}</div>;
  }

  return (
    <div className="h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory bg-black scroll-smooth hide-scrollbar">
      {clips.map(clip => (
        <FeedItemStream key={clip.id} streamUrl={globalStreamUrl} startTime={clip.start} endTime={clip.end} />
      ))}
    </div>
  )
}

