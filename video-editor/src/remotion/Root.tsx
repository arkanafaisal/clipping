import React from 'react';
import { Composition } from 'remotion';
import { MemeDiscoveryComposition } from '../styles/meme-discovery/MemeDiscoveryComposition';
import { RouletteQuizComposition } from '../styles/roulette-quiz/RouletteQuizComposition';
import { VerticalShortsComposition } from './compositions/VerticalShortsComposition';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Style 1: Meme Discovery (Full Play -> Skip Back -> Flash -> Holographic 1:1 Card Reveal) */}
      <Composition
        id="MemeDiscovery"
        component={MemeDiscoveryComposition}
        durationInFrames={449} // 329f video (10.95s) + 20f skip + 10f flash + 90f card = 449 frames (~15s)
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          title: 'Meme Discovery: Momen Langka!',
          gameTitle: 'Grim Reaper',
          targetUndoTimestamp: '00:03.466',
          totalVideoDurationSeconds: 10.95,
          videoSrc: '/temp/grim reaper/full.mp4',
          cardTitle: 'Grim Reaper Facecam',
          cardSubtitle: 'Meme Discovery Series #01',
          cardRarity: '⭐⭐⭐⭐⭐ SSR LEGENDARY',
          hp: 9999,
          attackName: 'Ekspresi Lucu Jumpscare',
          attackDesc: 'Menatap tajam ke kamera dengan ekspresi bingung yang memicu tawa penonton.',
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
