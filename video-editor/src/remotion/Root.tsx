import React from 'react';
import { Composition } from 'remotion';
import '../index.css';
import { MemeDiscoveryComposition } from '../styles/meme-discovery/MemeDiscoveryComposition';
import { RouletteQuizComposition } from '../styles/roulette-quiz/RouletteQuizComposition';
import { VerticalShortsComposition } from './compositions/VerticalShortsComposition';
import initialData from '../data.json';

export const RemotionRoot: React.FC = () => {
  const currentMoment = initialData.moments?.[0];
  const md = currentMoment?.memeDiscovery;
  const videoDurationSeconds = currentMoment?.files?.full?.durationSeconds || 10.95;
  const videoFrames = Math.round(videoDurationSeconds * 30);
  const totalFrames = videoFrames + 12 + 22 + 18 + 10 + 15 + 105;

  const videoSrc = currentMoment
    ? `/temp/${currentMoment.path}/full.mp4`
    : '/temp/grim reaper/full.mp4';
  const imageSrc = currentMoment?.files?.image
    ? `/temp/${currentMoment.path}/image.jpg`
    : undefined;

  return (
    <>
      {/* Style 1: Meme Discovery (Sequential: Full Play -> Pause -> YouTube Skip -> Funny Frame View -> Flash -> 0.5s Pause -> Card Slide Up) */}
      <Composition
        id="MemeDiscovery"
        component={MemeDiscoveryComposition}
        durationInFrames={totalFrames}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          title: md?.title || 'Meme Discovery: Momen Langka!',
          gameTitle: currentMoment?.name || 'Grim Reaper',
          targetUndoTimestamp: md?.targetUndoTimestamp || '00:07.105',
          totalVideoDurationSeconds: videoDurationSeconds,
          videoSrc,
          cardImageSrc: imageSrc,
          cardTitle: md?.cardTitle || 'death evader',
          cardRarity: md?.cardRarity || 'Mythic',
          cardDesc: md?.cardDesc || 'Pria tua yang masih mau hidup.',
          cardColor: md?.cardColor || '#f59e0b',
          titleFontSize: md?.titleFontSize || 48,
          rarityFontSize: md?.rarityFontSize || 24,
          descFontSize: md?.descFontSize || 30,
          skills: md?.skills || [],
          showSafeZoneGuides: false,
        }}
      />

      {/* Style 2: Roulette Quiz */}
      <Composition
        id="RouletteQuiz"
        component={RouletteQuizComposition}
        durationInFrames={300} // 10s at 30 fps
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          title: 'Grim Reaper Momen Seru',
          gameTitle: 'Grim Reaper',
          timestampText: '00:00:10',
          captionText: 'Momen video Grim Reaper yang diunduh dari Google Drive!',
          videoSrc: '/temp/grim reaper/full.mp4',
          showRoulettePreview: false,
          activeLaneIndex: 1,
          dimOpacity: 0.65,
        }}
      />

      {/* Backward Compatibility */}
      <Composition
        id="VerticalShorts"
        component={VerticalShortsComposition}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          title: 'Grim Reaper Momen Seru',
          gameTitle: 'Grim Reaper',
          timestampText: '00:00:10',
          captionText: 'Momen penampakan Grim Reaper di Google Drive!',
          videoSrc: '/temp/grim reaper/full.mp4',
          showRoulettePreview: false,
          activeLaneIndex: 1,
          dimOpacity: 0.65,
        }}
      />
    </>
  );
};
