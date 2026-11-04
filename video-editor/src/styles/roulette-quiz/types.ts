export interface RouletteQuizProps {
  title: string;
  gameTitle: string;
  timestampText: string;
  captionText: string;
  showRoulettePreview?: boolean;
  videoSrc?: string;
  activeLaneIndex?: number;
  dimOpacity?: number;
  [key: string]: unknown;
}
