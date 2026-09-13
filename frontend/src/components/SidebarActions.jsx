export default function SidebarActions() {
  return (
    <div className="absolute right-4 bottom-20 flex flex-col items-center gap-5 z-20">
      {/* Like Button */}
      <button className="flex flex-col items-center gap-1 group">
        <div className="p-3 bg-black/20 rounded-full backdrop-blur-md group-hover:bg-white/20 transition-all border border-white/10">
          <svg className="w-8 h-8 text-white fill-current drop-shadow-lg" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </div>
        <span className="text-white text-sm font-semibold drop-shadow-md">1.2M</span>
      </button>

      {/* Comment Button */}
      <button className="flex flex-col items-center gap-1 group">
        <div className="p-3 bg-black/20 rounded-full backdrop-blur-md group-hover:bg-white/20 transition-all border border-white/10">
          <svg className="w-8 h-8 text-white fill-current drop-shadow-lg" viewBox="0 0 24 24">
            <path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
          </svg>
        </div>
        <span className="text-white text-sm font-semibold drop-shadow-md">4,321</span>
      </button>

      {/* Share Button */}
      <button className="flex flex-col items-center gap-1 group">
        <div className="p-3 bg-black/20 rounded-full backdrop-blur-md group-hover:bg-white/20 transition-all border border-white/10">
          <svg className="w-8 h-8 text-white fill-current drop-shadow-lg" viewBox="0 0 24 24">
            <path d="M14.59 2.59l6.71 6.71c.39.39.39 1.02 0 1.41l-6.71 6.71c-.39.39-1.02.39-1.41 0-.39-.39-.39-1.02 0-1.41L18.17 11H3c-.55 0-1-.45-1-1s.45-1 1-1h15.17l-4.99-4.99c-.39-.39-.39-1.02 0-1.41.39-.38 1.02-.38 1.41-.01z" />
          </svg>
        </div>
        <span className="text-white text-sm font-semibold drop-shadow-md">Share</span>
      </button>
    </div>
  )
}
