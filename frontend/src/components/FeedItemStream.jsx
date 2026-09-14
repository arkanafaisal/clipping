import { useRef, useEffect, forwardRef, useImperativeHandle, useState } from 'react';
import Hls from 'hls.js';

const FeedItemStream = forwardRef(({ streamUrl, startTime, endTime, onProgress, onPlayStateChange }, ref) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [activeUrl, setActiveUrl] = useState(streamUrl);

  // Jika parent memberikan streamUrl baru, reset activeUrl
  useEffect(() => {
    setActiveUrl(streamUrl);
  }, [streamUrl]);

  // Expose imperative methods to parent (Feed.jsx)
  useImperativeHandle(ref, () => ({
    play: () => {
      if (videoRef.current) videoRef.current.play().catch(e => console.log(e));
    },
    pause: () => {
      if (videoRef.current) videoRef.current.pause();
    },
    skip: (seconds) => {
      if (!videoRef.current) return;
      let newTime = videoRef.current.currentTime + seconds;
      
      // Jaga agar skip tidak keluar dari rentang klip
      if (startTime !== undefined && newTime < startTime) newTime = startTime;
      if (endTime !== undefined && newTime > endTime) newTime = endTime;
      
      videoRef.current.currentTime = newTime;
    }
  }));

  // HLS & Source Management (HANYA dijalankan saat activeUrl berubah)
  useEffect(() => {
    if (!videoRef.current || !activeUrl) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const handleError = () => {
      // Jika URL saat ini bukan proxy, coba fallback ke proxy
      if (activeUrl && !activeUrl.includes('/api/proxy_stream')) {
        console.warn("Direct stream failed (CORS/403). Falling back to FastAPI proxy...");
        setActiveUrl(`/api/proxy_stream?url=${encodeURIComponent(activeUrl)}`);
      }
    };

    if (activeUrl.includes('.m3u8') || activeUrl.includes('.mpd')) {
      if (Hls.isSupported()) {
        const hls = new Hls({ startPosition: startTime || -1 });
        hls.loadSource(activeUrl);
        hls.attachMedia(videoRef.current);
        
        hls.on(Hls.Events.ERROR, function (event, data) {
          if (data.fatal) {
            handleError();
          }
        });
        
        hlsRef.current = hls;
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = activeUrl;
        videoRef.current.onerror = handleError;
      }
    } else {
      videoRef.current.src = activeUrl;
      videoRef.current.onerror = handleError;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.onerror = null;
      }
    };
  }, [activeUrl]); // Dihapus: startTime dari dependency!

  // Menangani lompatan (seek) ketika klip berganti atau waktu start dimodifikasi (Crop/Extend)
  useEffect(() => {
    if (videoRef.current && startTime !== undefined) {
      // Kita langsung lompat ke startTime baru tanpa me-reload/mendownload ulang videonya
      videoRef.current.currentTime = startTime;
      videoRef.current.play().catch(e => console.log("Autoplay failed:", e));
    }
  }, [startTime]);

  // Handle looping logic between startTime and endTime & progress bar
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    
    const current = videoRef.current.currentTime;
    
    if (endTime && startTime !== undefined) {
      // Kalkulasi Progress Bar
      const duration = endTime - startTime;
      const currentRel = current - startTime;
      let pct = (currentRel / duration) * 100;
      if (pct < 0) pct = 0;
      if (pct > 100) pct = 100;
      
      onProgress(pct);

      // Looping
      if (current >= endTime) {
        videoRef.current.currentTime = startTime || 0;
        videoRef.current.play().catch(e => console.log("Play interrupted:", e));
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current && startTime !== undefined) {
      videoRef.current.currentTime = startTime;
      videoRef.current.play().catch(e => console.log("Autoplay failed:", e));
    }
  };

  return (
    <div className="w-full h-full bg-black flex justify-center items-center relative overflow-hidden">
      {streamUrl && (
        <video 
          ref={videoRef}
          className="w-full h-full object-contain pointer-events-none"
          playsInline
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => { if (onPlayStateChange) onPlayStateChange(true) }}
          onPause={() => { if (onPlayStateChange) onPlayStateChange(false) }}
        />
      )}
    </div>
  )
});

export default FeedItemStream;
