import { useRef, useEffect, useState } from 'react';
import YouTube from 'react-youtube';

export default function FeedItem({ startTime, endTime }) {
  const videoId = "e7uVibGgVuM";
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  const opts = {
    width: '100%',
    height: '100%',
    playerVars: {
      autoplay: 0, // We handle autoplay manually with IntersectionObserver now
      // We removed mute: 1 so you can hear the sound. 
      // Note: Browsers may block autoplay if the user hasn't interacted with the page yet.
      controls: 0,
      rel: 0,
      modestbranding: 1,
      playsinline: 1,
      start: startTime,
      end: endTime,
      disablekb: 1,
      fs: 0,
      iv_load_policy: 3,
    },
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting);
          if (entry.isIntersecting) {
            // Play when it enters the viewport
            if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
              playerRef.current.playVideo();
            }
          } else {
            // Pause when it leaves the viewport
            if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
              playerRef.current.pauseVideo();
            }
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
  }, []);

  const handleReady = (event) => {
    playerRef.current = event.target;
    if (isVisible) {
      playerRef.current.playVideo();
    }
  };

  const handleStateChange = (event) => {
    // When the video reaches the 'end' time (state 0), we seek back to 'start' to loop it.
    if (event.data === 0) {
      event.target.seekTo(startTime);
      event.target.playVideo();
    }
  };

  const togglePlay = () => {
    if (playerRef.current) {
      const state = playerRef.current.getPlayerState();
      // 1 = playing, 2 = paused
      if (state === 1) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
    }
  };

  return (
    <div ref={containerRef} className="w-full h-[100dvh] snap-start bg-black flex justify-center items-center relative">
      {/* We use pointer-events-none to prevent users from clicking the YouTube logo or title. */}
      <YouTube 
        videoId={videoId} 
        opts={opts} 
        className="w-full h-full flex justify-center items-center pointer-events-none" 
        iframeClassName="w-full h-full"
        onReady={handleReady}
        onStateChange={handleStateChange}
      />
      {/* Invisible overlay captures clicks to play/pause natively, completely hiding YouTube interactions */}
      <div 
        className="absolute inset-0 z-10 cursor-pointer"
        onClick={togglePlay}
      ></div>
    </div>
  )
}


