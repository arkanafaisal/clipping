import SidebarActions from './SidebarActions';
import VideoInfo from './VideoInfo';

export default function FeedItem() {
  const videoId = "e7uVibGgVuM";
  const embedUrl = `https://www.youtube.com/embed/${videoId}?start=30&end=60&autoplay=1&mute=1&controls=0&loop=1&playlist=${videoId}&rel=0&modestbranding=1&playsinline=1`;

  return (
    <div className="relative w-full h-[100dvh] snap-start bg-black overflow-hidden">
      {/* IFrame container styled to simulate object-fit: cover for a 16:9 video */}
      <iframe 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vw] h-[56.25vw] min-h-[100dvh] min-w-[177.77vh] pointer-events-none"
        src={embedUrl} 
        title="YouTube video player" 
        frameBorder="0" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
        allowFullScreen>
      </iframe>
      
      {/* Dark gradient overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/80 pointer-events-none"></div>

      <SidebarActions />
      <VideoInfo />
    </div>
  )
}
