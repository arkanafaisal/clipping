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
        durationInFrames={180} // 6 seconds at 30 fps
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          title: 'Tebak Momen Paling Lucu!',
          gameTitle: "Chilla's Art: The Bathhouse",
          timestampText: '00:15:20',
          captionText: 'Detik-detik penampakan muncul di balik tirai kamar mandi...',
          showRoulettePreview: true,
          activeLaneIndex: 1,
          dimOpacity: 0.65,
        }}
      />
    </>
  );
};
