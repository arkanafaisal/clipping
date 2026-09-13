import FeedItem from './FeedItem';

export default function Feed() {
  const clips = [
    { id: 1, start: 30, end: 60 },
    { id: 2, start: 60, end: 90 },
    { id: 3, start: 90, end: 120 },
    { id: 4, start: 120, end: 150 },
    { id: 5, start: 150, end: 180 },
  ];

  return (
    <div className="h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory bg-black scroll-smooth hide-scrollbar">
      {clips.map(clip => (
        <FeedItem key={clip.id} startTime={clip.start} endTime={clip.end} />
      ))}
    </div>
  )
}

