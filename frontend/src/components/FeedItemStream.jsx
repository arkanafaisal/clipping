import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import Hls from 'hls.js';

const FeedItemStream = forwardRef(({ streamUrl, startTime, endTime, onProgress, onPlayStateChange }, ref) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

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

  // HLS & Source Management
  useEffect(() => {
    if (!videoRef.current || !streamUrl) return;

    // Bersihkan HLS lama jika ada
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (streamUrl.includes('.m3u8') || streamUrl.includes('.mpd')) {
      if (Hls.isSupported()) {
        const hls = new Hls({ startPosition: startTime || -1 });
        hls.loadSource(streamUrl);
        hls.attachMedia(videoRef.current);
        hlsRef.current = hls;
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        // Native support (Safari)
        videoRef.current.src = streamUrl;
      }
    } else {
      // Direct MP4
      videoRef.current.src = streamUrl;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl, startTime]); // Include startTime so when user changes clip, HLS re-attaches if needed

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
