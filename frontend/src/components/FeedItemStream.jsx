import { useRef, useEffect, useState } from 'react';

export default function FeedItemStream({ streamUrl, startTime, endTime }) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  // Intersection Observer for auto-play/pause
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting);
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
  }, []);

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

  // Handle looping logic between startTime and endTime
  const handleTimeUpdate = () => {
    if (videoRef.current && endTime) {
      if (videoRef.current.currentTime >= endTime) {
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

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
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
        />
      )}
      
      {/* Invisible overlay captures clicks to play/pause natively */}
      <div 
        className="absolute inset-0 z-10 cursor-pointer"
        onClick={togglePlay}
      ></div>
    </div>
  )
}
