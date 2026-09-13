export default function VideoInfo() {
  return (
    <div className="absolute left-4 bottom-6 right-20 z-20 text-white">
      <h2 className="text-lg font-bold drop-shadow-md mb-1">@clipping_master</h2>
      <p className="text-sm font-medium drop-shadow-md line-clamp-2 mb-3">
        This is a clip from the podcast! Notice how it loops perfectly between 0:30 and 1:00. #podcast #clips #viral
      </p>
      
      {/* Original sound marquee */}
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" style={{ animationDuration: '3s' }}>
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
          <circle cx="12" cy="12" r="3" fill="currentColor"/>
          <path d="M12 2v4" stroke="currentColor" strokeWidth="2"/>
        </svg>
        <div className="overflow-hidden w-48 relative">
          <p className="text-sm font-semibold whitespace-nowrap animate-marquee">
            Original sound - clipping_master
          </p>
        </div>
      </div>
    </div>
  )
}
