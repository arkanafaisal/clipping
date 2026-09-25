import { useRef, useEffect, forwardRef, useImperativeHandle, useState } from 'react';
import Hls from 'hls.js';

const FeedItemStream = forwardRef(({ clipId, streamUrl, startTime, endTime, onProgress, onPlayStateChange }, ref) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [activeUrl, setActiveUrl] = useState(streamUrl);
  
  const seekDebounceRef = useRef(null);

  // Rate limiter Gerbang 2 (Manual Strict Sliding Window)
  // Max 60 request per 60 detik (1 menit)
  const executeSeek = (time, shouldPlay = true) => {
      // Optimistic Update (Langsung gerakkan bar merah di UI)
      forceUpdateProgress(time);

      // Stop video sementara agar tidak meng-overwrite progress bar (menghentikan onTimeUpdate)
      if (videoRef.current) {
          videoRef.current.pause();
      }

      if (seekDebounceRef.current) {
          clearTimeout(seekDebounceRef.current);
      }

      seekDebounceRef.current = setTimeout(() => {
          // 1. Cek Limit
          let history = JSON.parse(localStorage.getItem('gate2_history') || '[]');
          const now = Date.now();
          history = history.filter(t => now - t < 60000); // Hapus log yang lebih dari 1 menit lalu
          
          if (history.length >= 60) {
              const waitTime = Math.ceil((60000 - (now - history[0])) / 1000);
              alert(`🚫 GERBANG 2 LIMIT TERCAPAI! Anda menekan tombol terlalu cepat. Tunggu ${waitTime} detik agar aman dari Error 403 Google CDN.`);
              return; // Early return (Tolak eksekusi)
          }
          
          // Catat log
          history.push(now);
          localStorage.setItem('gate2_history', JSON.stringify(history));

          // 3. Eksekusi ke Video Player (CDN)
          if (!videoRef.current) return;
          videoRef.current.currentTime = time;
          if (shouldPlay) {
              videoRef.current.play().catch(e => console.log(e));
          }
      }, 1000); // Debounce 1 detik
  };

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
      
      executeSeek(newTime, true);
    },
    seekTo: (time) => {
      executeSeek(time, true);
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
  }, [activeUrl]);

  // Fungsi untuk mengkalkulasi ulang progress secara manual
  const forceUpdateProgress = (forcedCurrentTime) => {
    if (endTime && startTime !== undefined) {
      const duration = endTime - startTime;
      if (duration <= 0) return;
      let pct = ((forcedCurrentTime - startTime) / duration) * 100;
      if (pct < 0) pct = 0;
      if (pct > 100) pct = 100;
      if (onProgress) onProgress(pct);
    }
  };

  // Menangani ganti klip (jump ke start saat clipId berubah)
  useEffect(() => {
    if (videoRef.current && startTime !== undefined) {
      videoRef.current.currentTime = startTime;
      forceUpdateProgress(startTime); // Langsung update UI bar
      videoRef.current.play().catch(e => console.log("Autoplay failed:", e));
    }
  }, [clipId]);

  // Handle looping logic between startTime and endTime & progress bar
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    
    const current = videoRef.current.currentTime;
    
    if (endTime && startTime !== undefined) {
      // Kalkulasi Progress Bar
      forceUpdateProgress(current);

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
