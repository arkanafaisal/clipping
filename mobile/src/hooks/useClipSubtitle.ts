import { useState, useEffect, useRef } from 'react';
import { ClipItem, SubtitleCue, loadClipSubtitle } from '../services/api';

export interface UseClipSubtitleParams {
  activeClip?: ClipItem;
  subtitlesRef?: React.MutableRefObject<SubtitleCue[]>;
}

export function useClipSubtitle({
  activeClip,
  subtitlesRef: externalSubtitlesRef,
}: UseClipSubtitleParams) {
  const [subtitles, setSubtitles] = useState<SubtitleCue[]>([]);
  const [activeSubtitleText, setActiveSubtitleText] = useState<string>('');
  const [isSubtitleVisible, setIsSubtitleVisible] = useState<boolean>(true);
  const [subtitleModalVisible, setSubtitleModalVisible] = useState<boolean>(false);

  const internalSubtitlesRef = useRef<SubtitleCue[]>(subtitles);
  const subtitlesRef = externalSubtitlesRef || internalSubtitlesRef;

  useEffect(() => {
    subtitlesRef.current = subtitles;
  }, [subtitles, subtitlesRef]);

  // Auto-load subtitle yang sudah tersimpan untuk klip aktif
  useEffect(() => {
    let isCurrent = true;
    async function checkSavedSubtitle() {
      if (!activeClip || !activeClip.videoId) return;
      try {
        const saved = await loadClipSubtitle(activeClip.videoId, activeClip.start, activeClip.end);
        if (isCurrent) {
          if (saved && Array.isArray(saved.cues)) {
            setSubtitles(saved.cues);
          } else {
            setSubtitles([]);
          }
        }
      } catch {
        if (isCurrent) setSubtitles([]);
      }
    }
    checkSavedSubtitle();
    return () => {
      isCurrent = false;
    };
  }, [activeClip?.videoId, activeClip?.start, activeClip?.end]);

  return {
    subtitles,
    setSubtitles,
    activeSubtitleText,
    setActiveSubtitleText,
    isSubtitleVisible,
    setIsSubtitleVisible,
    subtitleModalVisible,
    setSubtitleModalVisible,
    subtitlesRef,
  };
}
