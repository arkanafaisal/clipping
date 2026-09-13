import FeedItem from './FeedItem';

export default function Feed() {
  return (
    <div className="h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory bg-black scroll-smooth hide-scrollbar">
      <FeedItem />
      <FeedItem />
      <FeedItem />
    </div>
  )
}
