import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';

const FeedItemStream = forwardRef(({ id, streamUrl, startTime, endTime, onVisible, onProgress, onPlayStateChange }, ref) => {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

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

  // Intersection Observer for auto-play/pause
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting);
          if (entry.isIntersecting) {
            onVisible(id);
          }
        });
      },
      {
        threshold: 0.6, // Trigger when 60% of the item is visible
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, [id, onVisible]);

  // Memutar atau menjeda video berdasarkan posisi scroll (isVisible)
  useEffect(() => {
    if (videoRef.current) {
      if (isVisible && streamUrl) {
        videoRef.current.play().catch(e => console.log("Autoplay blocked (klik layar 1x untuk mengizinkan suara):", e));
      } else {
        videoRef.current.pause();
      }
    }
  }, [isVisible, streamUrl]);

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
      
      if (isVisible) {
        onProgress(pct);
      }

      // Looping
      if (current >= endTime) {
        videoRef.current.currentTime = startTime || 0;
        videoRef.current.play().catch(e => console.log("Play interrupted:", e));
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current && startTime) {
      videoRef.current.currentTime = startTime;
    }
  };

  return (
    <div ref={containerRef} className="w-full h-[100dvh] snap-start bg-black flex justify-center items-center relative">
      {streamUrl && (
        <video 
          ref={videoRef}
          src={streamUrl}
          className="w-full h-full object-contain pointer-events-none"
          playsInline
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => { if (isVisible && onPlayStateChange) onPlayStateChange(true) }}
          onPause={() => { if (isVisible && onPlayStateChange) onPlayStateChange(false) }}
        />
      )}
    </div>
  )
});

export default FeedItemStream;
