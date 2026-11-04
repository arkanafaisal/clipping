import React from 'react';
import { Composition } from 'remotion';
import { VerticalShortsComposition } from './compositions/VerticalShortsComposition';
import { VerticalVideoProps } from './types';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="VerticalShorts"
        component={VerticalShortsComposition}
        durationInFrames={300} // 10 seconds at 30 fps
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
