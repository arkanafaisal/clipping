import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
  PanResponder,
  Modal,
  Animated,
} from 'react-native';
import {
  Trash2,
  CheckCircle2,
  Download,
  Subtitles,
  Plus,
  X,
  Type,
  Globe,
  Clock,
  Move,
  Film,
  Layout,
  Camera,
  Gamepad2,
  SlidersHorizontal,
  Stamp,
  AlignLeft,
  AlignCenter,
} from 'lucide-react-native';
import { ClipItem, SubtitleCue, ClipTemplateConfig } from '../../services/api';
import { formatTimeWithMs, formatDisplayTime } from './timeUtils';

interface SubtitleCuePillProps {
  cue: SubtitleCue;
  index: number;
  clipDuration: number;
  trackWidth: number;
}

const SubtitleCuePill: React.FC<SubtitleCuePillProps> = React.memo(
  ({ cue, index, clipDuration, trackWidth }) => {
    const startPct = clipDuration > 0 ? Math.max(0, Math.min(1, cue.start / clipDuration)) : 0;
    const endPct = clipDuration > 0 ? Math.max(0, Math.min(1, cue.end / clipDuration)) : 1;
    const leftPos = startPct * trackWidth;
    // Lebar murni sesuai durasi (end - start) terhadap total clipDuration tanpa minWidth artifisial
    const pillWidth = Math.max(1, (endPct - startPct) * trackWidth);
    const isEven = index % 2 === 0;

    return (
      <View
        pointerEvents="none"
        style={[
          styles.cuePill,
          isEven ? styles.cuePillEven : styles.cuePillOdd,
          {
            left: leftPos,
            width: pillWidth,
          },
        ]}
      />
    );
  }
);

interface LiveTimeDisplayProps {
  progressAnim?: Animated.Value;
  duration: number;
  fallbackTime: number;
  clipId?: string;
}

const LiveTimeDisplay: React.FC<LiveTimeDisplayProps> = React.memo(({ progressAnim, duration, fallbackTime, clipId }) => {
  const [displayTime, setDisplayTime] = useState<string>(() => formatTimeWithMs(fallbackTime));
  const lastSecRef = useRef<number>(fallbackTime);

  useEffect(() => {
    if (!progressAnim || duration <= 0) {
      setDisplayTime(formatTimeWithMs(fallbackTime));
      return;
    }

    // Set initial display time for current clip
    setDisplayTime(formatTimeWithMs(fallbackTime));
    lastSecRef.current = fallbackTime;

    const listenerId = progressAnim.addListener(({ value }) => {
      const curSec = (Math.max(0, Math.min(100, value)) / 100) * duration;
      // Perbarui tampilan waktu milidetik secara halus ~30 FPS (interval 33ms)
      if (Math.abs(curSec - lastSecRef.current) >= 0.033) {
        lastSecRef.current = curSec;
        setDisplayTime(formatTimeWithMs(curSec));
      }
    });

    return () => {
      progressAnim.removeListener(listenerId);
    };
  }, [progressAnim, duration]);

  useEffect(() => {
    // Sinkronisasi saat progressAnim tidak tersedia (fallback mode)
    if (!progressAnim) {
      setDisplayTime(formatTimeWithMs(fallbackTime));
      lastSecRef.current = fallbackTime;
    }
  }, [fallbackTime, progressAnim]);

  useEffect(() => {
    // Sinkronisasi saat pergantian klip
    setDisplayTime(formatTimeWithMs(fallbackTime));
    lastSecRef.current = fallbackTime;
  }, [clipId]);

  return (
    <Text style={[styles.timeNumberText, styles.timeMsText]}>
      {displayTime}
    </Text>
  );
});

export type EditorMode = 'subtitle' | 'template' | null;

export interface FeedTopControlsProps {
  activeClip: ClipItem;
  progressAnim?: Animated.Value;
  currentClipTime?: number;
  isDownloaded: boolean;
  isDownloading: boolean;
  isExporting?: boolean;
  downloadProgressInfo?: { stage: string; code: string; percent: number };
  visibleHeatmapCount?: number;
  onAddCustomPress?: () => void;
  onChangeVisibleCountPress?: () => void;
  hasSubtitles: boolean;
  isSubtitleVisible: boolean;
  subtitles: SubtitleCue[];
  selectedCueId: string | null;
  isFetchingSubtitles: boolean;
  subtitlePosition: { x: number; y: number };
  activeEditorMode?: EditorMode;
  onSelectEditorMode?: (mode: EditorMode) => void;
  onExportClip?: () => void;
  onUpdateSubtitlePosition: (x: number, y: number) => void;
  templateConfig?: ClipTemplateConfig;
  onUpdateContext?: (updates: Partial<ClipTemplateConfig['context']>) => void;
  onUpdateFacecam?: (updates: Partial<ClipTemplateConfig['facecam']>) => void;
  onUpdateMainVideo?: (updates: Partial<ClipTemplateConfig['mainVideo']>) => void;
  onUpdateWatermark?: (updates: Partial<ClipTemplateConfig['watermark']>) => void;
  activeTimeEdit: 'start' | 'end' | null;
  tempTimeValue: string;
  getDownloadProgressLabel: (info?: { stage: string; code: string; percent: number }) => string;
  onToggleTrash: () => void;
  onToggleDone: () => void;
  onDownloadClip: () => void;
  onToggleSubtitleVisibility: () => void;
  onSelectCue: (id: string | null) => void;
  onAddCue: (atTime: number) => void;
  onUpdateCue: (id: string, updates: Partial<SubtitleCue>) => void;
  onShiftCueTime: (id: string, newStart: number) => void;
  onDeleteCue: (id: string) => void;
  onFetchSubtitles: (preferredLang?: string) => void;
  onSeek: (relSec: number) => void;
  onStartEditTime: (type: 'start' | 'end') => void;
  onMsTimeChange: (type: 'start' | 'end', val: string) => void;
  onBlurTimeEdit: () => void;
  onUpdateStart: (delta: number) => void;
  onUpdateEnd: (delta: number) => void;
}

export const FeedTopControls: React.FC<FeedTopControlsProps> = React.memo(({
  activeClip,
  progressAnim,
  currentClipTime = 0,
  isDownloaded,
  isDownloading,
  isExporting,
  downloadProgressInfo,
  visibleHeatmapCount = 50,
  onAddCustomPress,
  onChangeVisibleCountPress,
  hasSubtitles,
  isSubtitleVisible,
  subtitles,
  selectedCueId,
  isFetchingSubtitles,
  subtitlePosition,
  activeEditorMode,
  onSelectEditorMode,
  onExportClip,
  onUpdateSubtitlePosition,
  templateConfig,
  onUpdateContext,
  onUpdateFacecam,
  onUpdateMainVideo,
  onUpdateWatermark,
  activeTimeEdit,
  tempTimeValue,
  getDownloadProgressLabel,
  onToggleTrash,
  onToggleDone,
  onDownloadClip,
  onToggleSubtitleVisibility,
  onSelectCue,
  onAddCue,
  onUpdateCue,
  onShiftCueTime,
  onDeleteCue,
  onFetchSubtitles,
  onSeek,
  onStartEditTime,
  onMsTimeChange,
  onBlurTimeEdit,
  onUpdateStart,
  onUpdateEnd,
}) => {
  const [trackLayoutWidth, setTrackLayoutWidth] = useState<number>(0);
  const [showLangModal, setShowLangModal] = useState<boolean>(false);
  const [showTextModal, setShowTextModal] = useState<boolean>(false);
  const [showFontModal, setShowFontModal] = useState<boolean>(false);
  const [tempEditText, setTempEditText] = useState<string>('');
  const [tempEditSize, setTempEditSize] = useState<string>('14');
  const [showTimeModal, setShowTimeModal] = useState<boolean>(false);
  const [showPositionModal, setShowPositionModal] = useState<boolean>(false);
  const [tempPosX, setTempPosX] = useState<string>('50');
  const [tempPosY, setTempPosY] = useState<string>('85');
  const [internalEditorMode, setInternalEditorMode] = useState<EditorMode>(null);
  const currentMode = activeEditorMode !== undefined ? activeEditorMode : internalEditorMode;
  const setCurrentMode = onSelectEditorMode || setInternalEditorMode;
  const isSubtitleEditorOpen = currentMode === 'subtitle';

  useEffect(() => {
    setInternalEditorMode(null);
  }, [activeClip.id]);

  const handleToggleEditorMode = (mode: 'subtitle' | 'template') => {
    const next = currentMode === mode ? null : mode;
    setCurrentMode(next);
    if (next !== 'subtitle') {
      onSelectCue(null);
    }
  };

  const [startMin, setStartMin] = useState<string>('00');
  const [startSec, setStartSec] = useState<string>('00');
  const [startMs, setStartMs] = useState<string>('000');
  const [endMin, setEndMin] = useState<string>('00');
  const [endSec, setEndSec] = useState<string>('00');
  const [endMs, setEndMs] = useState<string>('000');

  // Modals untuk Pengaturan Template
  const [showContextModal, setShowContextModal] = useState<boolean>(false);
  const [showFacecamModal, setShowFacecamModal] = useState<boolean>(false);
  const [showMainVideoModal, setShowMainVideoModal] = useState<boolean>(false);
  const [showWatermarkModal, setShowWatermarkModal] = useState<boolean>(false);

  // Temp states untuk modal Elemen Konteks
  const [tempContextEnabled, setTempContextEnabled] = useState<boolean>(false);
  const [tempContextText, setTempContextText] = useState<string>('');
  const [tempContextFontSize, setTempContextFontSize] = useState<string>('16');
  const [tempContextPaddingY, setTempContextPaddingY] = useState<string>('10');
  const [tempContextAlign, setTempContextAlign] = useState<'start' | 'center'>('start');

  // Temp states untuk modal Elemen Watermark
  const [tempWatermarkEnabled, setTempWatermarkEnabled] = useState<boolean>(false);
  const [tempWatermarkText, setTempWatermarkText] = useState<string>('');
  const [tempWatermarkSize, setTempWatermarkSize] = useState<string>('14');
  const [tempWatermarkX, setTempWatermarkX] = useState<string>('85');
  const [tempWatermarkY, setTempWatermarkY] = useState<string>('15');

  // Temp states untuk modal Elemen Facecam
  const [tempFacecamEnabled, setTempFacecamEnabled] = useState<boolean>(false);
  const [tempFacecamZoom, setTempFacecamZoom] = useState<string>('200');
  const [tempFacecamCropX, setTempFacecamCropX] = useState<string>('80');
  const [tempFacecamCropY, setTempFacecamCropY] = useState<string>('20');

  // Temp states untuk modal Elemen Main Video (Gameplay)
  const [tempMainEnabled, setTempMainEnabled] = useState<boolean>(true);
  const [tempMainZoom, setTempMainZoom] = useState<string>('100');
  const [tempMainCropX, setTempMainCropX] = useState<string>('50');
  const [tempMainCropY, setTempMainCropY] = useState<string>('50');

  const openContextModal = () => {
    if (templateConfig) {
      setTempContextEnabled(templateConfig.context.enabled);
      setTempContextText(templateConfig.context.text);
      setTempContextFontSize(String(templateConfig.context.fontSize));
      setTempContextPaddingY(String(templateConfig.context.paddingY));
      setTempContextAlign(templateConfig.context.align || 'start');
    }
    setShowContextModal(true);
  };

  const openFacecamModal = () => {
    if (templateConfig) {
      setTempFacecamEnabled(templateConfig.facecam.enabled);
      setTempFacecamZoom(String(Math.round((templateConfig.facecam.zoom || 2.0) * 100)));
      setTempFacecamCropX(String(templateConfig.facecam.cropX));
      setTempFacecamCropY(String(templateConfig.facecam.cropY));
    }
    setShowFacecamModal(true);
  };

  const openMainVideoModal = () => {
    if (templateConfig) {
      setTempMainEnabled(templateConfig.mainVideo.enabled !== false);
      setTempMainZoom(String(Math.round((templateConfig.mainVideo.zoom || 1.0) * 100)));
      setTempMainCropX(String(templateConfig.mainVideo.cropX));
      setTempMainCropY(String(templateConfig.mainVideo.cropY));
    }
    setShowMainVideoModal(true);
  };

  const openWatermarkModal = () => {
    if (templateConfig) {
      setTempWatermarkEnabled(templateConfig.watermark?.enabled ?? false);
      setTempWatermarkText(templateConfig.watermark?.text ?? '');
      setTempWatermarkSize(String(templateConfig.watermark?.size ?? 14));
      setTempWatermarkX(String(templateConfig.watermark?.x ?? 85));
      setTempWatermarkY(String(templateConfig.watermark?.y ?? 15));
    }
    setShowWatermarkModal(true);
  };

  const clipDuration = Math.max(0.1, activeClip.end - activeClip.start);

  const trackWidthRef = useRef<number>(0);
  const clipDurationRef = useRef<number>(0);
  const onSeekRef = useRef(onSeek);
  const startTouchX = useRef<number>(0);

  trackWidthRef.current = trackLayoutWidth;
  clipDurationRef.current = clipDuration;
  onSeekRef.current = onSeek;

  const handleScrubAt = useCallback((x: number) => {
    const w = trackWidthRef.current;
    const dur = clipDurationRef.current;
    if (w <= 0 || dur <= 0) return;
    const clampedX = Math.max(0, Math.min(w, x));
    const relSec = (clampedX / w) * dur;
    onSeekRef.current(relSec);
  }, []);

  const trackPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        startTouchX.current = evt.nativeEvent.locationX;
        handleScrubAt(startTouchX.current);
      },
      onPanResponderMove: (_evt, gestureState) => {
        handleScrubAt(startTouchX.current + gestureState.dx);
      },
      onPanResponderRelease: () => {},
      onPanResponderTerminate: () => {},
    })
  ).current;

  const getPlayheadTime = useCallback(() => {
    if (progressAnim) {
      const val = (progressAnim as any)._value;
      if (typeof val === 'number') {
        return Math.max(0, Math.min(clipDuration, (val / 100) * clipDuration));
      }
    }
    return Math.max(0, Math.min(clipDuration, currentClipTime || 0));
  }, [progressAnim, clipDuration, currentClipTime]);

  const openPositionModal = () => {
    setTempPosX(String(subtitlePosition.x));
    setTempPosY(String(subtitlePosition.y));
    setShowPositionModal(true);
  };

  const handleSavePosition = () => {
    const parsedX = parseFloat(tempPosX);
    const parsedY = parseFloat(tempPosY);
    const finalX = isNaN(parsedX) ? 50 : Math.round(parsedX * 10) / 10;
    const finalY = isNaN(parsedY) ? 85 : Math.round(parsedY * 10) / 10;
    onUpdateSubtitlePosition(finalX, finalY);
    setShowPositionModal(false);
  };

  const selectedCue = useMemo(
    () => subtitles.find((c) => c.id === selectedCueId) || null,
    [subtitles, selectedCueId]
  );

  const openTimeModal = () => {
    if (!selectedCue) return;
    const sTotal = Math.max(0, selectedCue.start);
    const eTotal = Math.max(sTotal + 0.1, selectedCue.end);

    const sM = Math.floor(sTotal / 60);
    const sS = Math.floor(sTotal % 60);
    const sMs = Math.round((sTotal - Math.floor(sTotal)) * 1000);

    const eM = Math.floor(eTotal / 60);
    const eS = Math.floor(eTotal % 60);
    const eMs = Math.round((eTotal - Math.floor(eTotal)) * 1000);

    setStartMin(String(sM).padStart(2, '0'));
    setStartSec(String(sS).padStart(2, '0'));
    setStartMs(String(sMs).padStart(3, '0').slice(0, 3));

    setEndMin(String(eM).padStart(2, '0'));
    setEndSec(String(eS).padStart(2, '0'));
    setEndMs(String(eMs).padStart(3, '0').slice(0, 3));

    setShowTimeModal(true);
  };

  const setStartToPlayhead = () => {
    const cur = getPlayheadTime();
    const m = Math.floor(cur / 60);
    const s = Math.floor(cur % 60);
    const ms = Math.round((cur - Math.floor(cur)) * 1000);
    setStartMin(String(m).padStart(2, '0'));
    setStartSec(String(s).padStart(2, '0'));
    setStartMs(String(ms).padStart(3, '0').slice(0, 3));
  };

  const setEndToPlayhead = () => {
    const cur = getPlayheadTime();
    const m = Math.floor(cur / 60);
    const s = Math.floor(cur % 60);
    const ms = Math.round((cur - Math.floor(cur)) * 1000);
    setEndMin(String(m).padStart(2, '0'));
    setEndSec(String(s).padStart(2, '0'));
    setEndMs(String(ms).padStart(3, '0').slice(0, 3));
  };

  const handleSaveTimeRange = () => {
    if (!selectedCue) return;

    const parseNumber = (val: string) => {
      const digits = val.replace(/\D/g, '');
      return digits ? parseInt(digits, 10) : 0;
    };

    const parseMs = (val: string) => {
      const digits = val.replace(/\D/g, '');
      if (!digits) return 0;
      if (digits.length === 1) return parseInt(digits + '00', 10);
      if (digits.length === 2) return parseInt(digits + '0', 10);
      return parseInt(digits.slice(0, 3), 10);
    };

    const sM = parseNumber(startMin);
    const sS = parseNumber(startSec);
    const sMs = parseMs(startMs);

    const eM = parseNumber(endMin);
    const eS = parseNumber(endSec);
    const eMs = parseMs(endMs);

    let newStart = Math.max(0, sM * 60 + sS + sMs / 1000);
    let newEnd = Math.max(0, eM * 60 + eS + eMs / 1000);

    if (newEnd <= newStart) {
      newEnd = Math.min(clipDuration, newStart + 1.5);
    }
    if (newStart >= clipDuration) {
      newStart = Math.max(0, clipDuration - 1.0);
    }
    if (newEnd > clipDuration) {
      newEnd = clipDuration;
    }

    newStart = Math.round(newStart * 1000) / 1000;
    newEnd = Math.round(newEnd * 1000) / 1000;

    onUpdateCue(selectedCue.id, {
      start: newStart,
      end: newEnd,
    });
    onSeek(newStart);
    setShowTimeModal(false);
  };

  return (
    <View style={styles.topSection}>
      <View style={styles.timeRangeRow}>
        {/* SISI KIRI: Tambah Custom & Ubah Jumlah Klip (jika belum done) / Ekspor Clip (jika done & terunduh) */}
        {activeClip.status !== 'done' ? (
          <View style={styles.leftActionGroup}>
            <Pressable
              style={({ pressed }) => [
                styles.statusBtn,
                styles.customAddBtn,
                pressed && { opacity: 0.7 },
              ]}
              onPress={onAddCustomPress}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Plus size={18} color="#c4b5fd" />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.statusBtn,
                styles.visibleCountBtn,
                pressed && { opacity: 0.7 },
              ]}
              onPress={onChangeVisibleCountPress}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <SlidersHorizontal size={17} color="#38bdf8" />
            </Pressable>
          </View>
        ) : (
          <View style={styles.leftActionGroup}>
            {/* Tombol Ekspor (jika sudah terunduh) */}
            {isDownloaded && (
              <Pressable
                style={({ pressed }) => [
                  styles.statusBtn,
                  styles.exportBtn,
                  isExporting && styles.exportBtnActive,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={onExportClip}
                disabled={isExporting}
              >
                {isExporting ? (
                  <ActivityIndicator size="small" color="#38bdf8" />
                ) : (
                  <Film size={18} color="#38bdf8" />
                )}
              </Pressable>
            )}
          </View>
        )}

        {/* SISI TENGAH: Jika Mode Done -> Durasi realtime presisi ms, Jika Normal -> Rentang Waktu & Edit MS */}
        <View style={styles.centerTimeWrapper} pointerEvents="box-none">
          {activeClip.status === 'done' ? (
            <View style={styles.timeDisplay}>
              <LiveTimeDisplay
                progressAnim={progressAnim}
                duration={activeClip.end - activeClip.start}
                fallbackTime={currentClipTime}
                clipId={activeClip.id}
              />
              <Text style={styles.timeSeparatorText}>/</Text>
              <Text style={[styles.timeNumberText, styles.timeMsText, styles.timeMsDim]}>
                {formatTimeWithMs(activeClip.end - activeClip.start)}
              </Text>
            </View>
          ) : (
            <View style={styles.timeDisplay}>
              {activeTimeEdit === 'start' ? (
                <TextInput
                  style={styles.timeInput}
                  value={tempTimeValue}
                  onChangeText={(val) => onMsTimeChange('start', val)}
                  onBlur={onBlurTimeEdit}
                  keyboardType="number-pad"
                  maxLength={2}
                  autoFocus
                  selectTextOnFocus
                  placeholder="00"
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                />
              ) : (
                <Pressable
                  style={styles.timePressable}
                  onPress={() => onStartEditTime('start')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 6 }}
                >
                  <Text style={styles.timeNumberText}>
                    {formatDisplayTime(activeClip.start)}
                  </Text>
                </Pressable>
              )}

              <Text style={styles.timeSeparatorText}>-</Text>

              {activeTimeEdit === 'end' ? (
                <TextInput
                  style={styles.timeInput}
                  value={tempTimeValue}
                  onChangeText={(val) => onMsTimeChange('end', val)}
                  onBlur={onBlurTimeEdit}
                  keyboardType="number-pad"
                  maxLength={2}
                  autoFocus
                  selectTextOnFocus
                  placeholder="00"
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                />
              ) : (
                <Pressable
                  style={styles.timePressable}
                  onPress={() => onStartEditTime('end')}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}
                >
                  <Text style={styles.timeNumberText}>
                    {formatDisplayTime(activeClip.end)}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* SISI KANAN: Trash & Done / Download & Done */}
        <View style={styles.rightActionGroup}>
          {activeClip.status === 'done' ? (
            <>
              {!isDownloaded && (
                <Pressable
                  style={({ pressed }) => [
                    styles.statusBtn,
                    styles.downloadBtn,
                    isDownloading && styles.downloadBtnActive,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={onDownloadClip}
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <View style={styles.downloadLoadingRow}>
                      <ActivityIndicator size="small" color="#38bdf8" />
                      <Text style={styles.downloadProgressText}>
                        {getDownloadProgressLabel(downloadProgressInfo)}
                      </Text>
                    </View>
                  ) : (
                    <Download size={18} color="#38bdf8" />
                  )}
                </Pressable>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.statusBtn,
                  styles.doneBtnActive,
                  pressed && { opacity: 0.7 },
                ]}
                onPressIn={onToggleDone}
              >
                <CheckCircle2 size={18} color="#ffffff" />
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                style={({ pressed }) => [
                  styles.statusBtn,
                  activeClip.status === 'trash' ? styles.trashBtnActive : styles.trashBtnInactive,
                  pressed && { opacity: 0.7 },
                ]}
                onPressIn={onToggleTrash}
              >
                <Trash2
                  size={18}
                  color={activeClip.status === 'trash' ? '#ffffff' : '#f87171'}
                />
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.statusBtn,
                  styles.doneBtnInactive,
                  pressed && { opacity: 0.7 },
                ]}
                onPressIn={onToggleDone}
              >
                <CheckCircle2 size={18} color="#34d399" />
              </Pressable>
            </>
          )}
        </View>
      </View>

      {/* Baris Extend & Crop HANYA muncul saat klip belum berstatus 'done' */}
      {activeClip.status !== 'done' ? (
        <>
          {/* Row 2: Extend Row */}
          <View style={styles.extendRow}>
            <View style={styles.fineTuneGroup}>
              <Pressable
                style={({ pressed }) => [styles.extendBtn, pressed && { opacity: 0.6 }]}
                onPressIn={() => onUpdateStart(-5)}
              >
                <Text style={styles.extendBtnText}>+5</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.extendBtn, pressed && { opacity: 0.6 }]}
                onPressIn={() => onUpdateStart(-1)}
              >
                <Text style={styles.extendBtnText}>+1</Text>
              </Pressable>
            </View>

            <Text style={styles.extendLabel}>EXTEND</Text>

            <View style={styles.fineTuneGroup}>
              <Pressable
                style={({ pressed }) => [styles.extendBtn, pressed && { opacity: 0.6 }]}
                onPressIn={() => onUpdateEnd(1)}
              >
                <Text style={styles.extendBtnText}>+1</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.extendBtn, pressed && { opacity: 0.6 }]}
                onPressIn={() => onUpdateEnd(5)}
              >
                <Text style={styles.extendBtnText}>+5</Text>
              </Pressable>
            </View>
          </View>

          {/* Row 3: Crop Row */}
          <View style={styles.cropRow}>
            <View style={styles.fineTuneGroup}>
              <Pressable
                style={({ pressed }) => [styles.cropBtn, pressed && { opacity: 0.6 }]}
                onPressIn={() => onUpdateStart(5)}
              >
                <Text style={styles.cropBtnText}>-5</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.cropBtn, pressed && { opacity: 0.6 }]}
                onPressIn={() => onUpdateStart(1)}
              >
                <Text style={styles.cropBtnText}>-1</Text>
              </Pressable>
            </View>

            <Text style={styles.cropLabel}>CROP</Text>

            <View style={styles.fineTuneGroup}>
              <Pressable
                style={({ pressed }) => [styles.cropBtn, pressed && { opacity: 0.6 }]}
                onPressIn={() => onUpdateEnd(-1)}
              >
                <Text style={styles.cropBtnText}>-1</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.cropBtn, pressed && { opacity: 0.6 }]}
                onPressIn={() => onUpdateEnd(-5)}
              >
                <Text style={styles.cropBtnText}>-5</Text>
              </Pressable>
            </View>
          </View>
        </>
      ) : isDownloaded ? (
        <>
          {/* Row 2: Mode Switcher Row */}
          <View style={styles.editorModeRow}>
            {/* Mode 1: Subtitle */}
            <Pressable
              style={({ pressed }) => [
                styles.modeToggleBtn,
                currentMode === 'subtitle' && styles.modeToggleBtnActive,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => handleToggleEditorMode('subtitle')}
            >
              <Subtitles
                size={14}
                color={currentMode === 'subtitle' ? '#38bdf8' : 'rgba(255, 255, 255, 0.7)'}
              />
              <Text
                style={[
                  styles.modeToggleText,
                  currentMode === 'subtitle' && styles.modeToggleTextActive,
                ]}
              >
                Subtitle
              </Text>
            </Pressable>

            {/* Mode 2: Template */}
            <Pressable
              style={({ pressed }) => [
                styles.modeToggleBtn,
                currentMode === 'template' && styles.modeToggleBtnActive,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => handleToggleEditorMode('template')}
            >
              <Layout
                size={14}
                color={currentMode === 'template' ? '#38bdf8' : 'rgba(255, 255, 255, 0.7)'}
              />
              <Text
                style={[
                  styles.modeToggleText,
                  currentMode === 'template' && styles.modeToggleTextActive,
                ]}
              >
                Template
              </Text>
            </Pressable>
          </View>

          {/* Row 3: Fixed Height Container untuk 3 Kondisi Editor (Subtitle, Template, & None) */}
          <View style={styles.editorContentContainer}>
            {currentMode === 'subtitle' ? (
              <View style={styles.subtitleLayerSection}>
                {/* 1. HORIZONTAL MINI TRACK (100% width, tap/drag to scrub pointer & select cue) */}
                <View
                  style={styles.miniTrackWrapper}
                  onLayout={(e) => setTrackLayoutWidth(e.nativeEvent.layout.width)}
                  {...trackPanResponder.panHandlers}
                >
                  <View style={styles.miniTrackBackground} pointerEvents="none">
                    {/* Needle Playhead (Merah kontras seperti scrubber bawah, 60 FPS via progressAnim) */}
                    <Animated.View
                      style={[
                        styles.playheadNeedle,
                        {
                          left:
                            progressAnim && trackLayoutWidth > 0
                              ? progressAnim.interpolate({
                                  inputRange: [0, 100],
                                  outputRange: [0, Math.max(0, trackLayoutWidth - 2.5)],
                                })
                              : clipDuration > 0
                              ? Math.max(
                                  0,
                                  Math.min(
                                    trackLayoutWidth - 2.5,
                                    (currentClipTime / clipDuration) * trackLayoutWidth
                                  )
                                )
                              : 0,
                        },
                      ]}
                    >
                      <View style={styles.playheadCap} />
                    </Animated.View>

                    {/* Subtitle Cue Pills (Visual timeline blocks) */}
                    {subtitles.map((cue, index) => (
                      <SubtitleCuePill
                        key={cue.id}
                        cue={cue}
                        index={index}
                        clipDuration={clipDuration}
                        trackWidth={trackLayoutWidth}
                      />
                    ))}

                    {subtitles.length === 0 && (
                      <View style={styles.emptyTrackHint}>
                        <Text style={styles.emptyTrackText}>Belum ada subtitle track</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* 2. ACTION & EDITOR ROW */}
                <View style={styles.cueActionsRow}>
                  {/* SISI KIRI: Tombol Generate Subtitle, Tombol Tambah Manual & Tombol Posisi Global (X, Y) */}
                  <View style={styles.leftCueButtonsGroup}>
                    {/* Tombol Generate / Ambil Subtitle YouTube (Globe) */}
                    <Pressable
                      style={({ pressed }) => [styles.positionBtn, pressed && { opacity: 0.7 }]}
                      onPress={() => setShowLangModal(true)}
                      disabled={isFetchingSubtitles}
                      hitSlop={6}
                    >
                      {isFetchingSubtitles ? (
                        <ActivityIndicator size="small" color="#38bdf8" />
                      ) : (
                        <Globe size={15} color="#38bdf8" />
                      )}
                    </Pressable>

                    {/* Tombol Tambah Manual (+) */}
                    <Pressable
                      style={({ pressed }) => [styles.addCueBtn, pressed && { opacity: 0.7 }]}
                      onPress={() => onAddCue(getPlayheadTime())}
                      hitSlop={6}
                    >
                      <Plus size={16} color="#38bdf8" />
                    </Pressable>

                    {/* Tombol Posisi Global (Move) */}
                    <Pressable
                      style={({ pressed }) => [styles.positionBtn, pressed && { opacity: 0.7 }]}
                      onPress={openPositionModal}
                      hitSlop={6}
                    >
                      <Move size={15} color="#38bdf8" />
                    </Pressable>
                  </View>

                  {/* SISI KANAN (Dekat jempol): Tombol Icon Edit Teks, Ukuran Font, Hapus */}
                  <View
                    style={[
                      styles.cueEditorActionIcons,
                      { opacity: selectedCue ? 1 : 0 },
                    ]}
                    pointerEvents={selectedCue ? 'auto' : 'none'}
                  >
                    {/* 1. Edit Teks (Buka Modal Multiline) */}
                    <Pressable
                      style={({ pressed }) => [styles.iconActionBtn, pressed && { opacity: 0.6 }]}
                      onPress={() => {
                        if (selectedCue) {
                          setTempEditText(selectedCue.text || '');
                          setShowTextModal(true);
                        }
                      }}
                      hitSlop={6}
                      disabled={!selectedCue}
                    >
                      <Type size={16} color="#38bdf8" />
                    </Pressable>

                    {/* 2. Ukuran Font (Buka Modal Font Size) */}
                    <Pressable
                      style={({ pressed }) => [styles.iconActionBtn, pressed && { opacity: 0.6 }]}
                      onPress={() => {
                        if (selectedCue) {
                          setTempEditSize(String(selectedCue.fontSize || 14));
                          setShowFontModal(true);
                        }
                      }}
                      hitSlop={6}
                      disabled={!selectedCue}
                    >
                      <Text style={styles.fontSizeIconText}>Aa</Text>
                    </Pressable>

                    {/* 3. Rentang Waktu (Buka Modal Time Range 6-box: Menit, Detik, Milidetik) */}
                    <Pressable
                      style={({ pressed }) => [styles.iconActionBtn, pressed && { opacity: 0.6 }]}
                      onPress={() => {
                        if (selectedCue) {
                          openTimeModal();
                        }
                      }}
                      hitSlop={6}
                      disabled={!selectedCue}
                    >
                      <Clock size={16} color="#38bdf8" />
                    </Pressable>

                    {/* 4. Hapus Cue (Langsung hapus tanpa modal konfirmasi) */}
                    <Pressable
                      style={({ pressed }) => [
                        styles.iconActionBtn,
                        styles.deleteActionBtn,
                        pressed && { opacity: 0.6 },
                      ]}
                      onPress={() => {
                        if (selectedCue) {
                          onDeleteCue(selectedCue.id);
                        }
                      }}
                      hitSlop={6}
                      disabled={!selectedCue}
                    >
                      <Trash2 size={16} color="#f87171" />
                    </Pressable>
                  </View>
                </View>
              </View>
            ) : currentMode === 'template' ? (
              <View style={styles.templateLayerSection}>
                {/* Baris 1: Facecam & Konteks */}
                <View style={styles.templateButtonsRow}>
                  {/* 1. Tombol Elemen Facecam */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.templateActionBtn,
                      templateConfig?.facecam.enabled && styles.templateBtnActive,
                      pressed && { opacity: 0.6 },
                    ]}
                    onPress={openFacecamModal}
                    hitSlop={6}
                  >
                    <Camera
                      size={15}
                      color={templateConfig?.facecam.enabled ? '#38bdf8' : 'rgba(255, 255, 255, 0.7)'}
                    />
                    <Text
                      style={[
                        styles.templateActionBtnText,
                        templateConfig?.facecam.enabled && styles.templateActionBtnTextActive,
                      ]}
                    >
                      Facecam
                    </Text>
                  </Pressable>

                  {/* 2. Tombol Elemen Konteks (Teks Judul Banner) */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.templateActionBtn,
                      templateConfig?.context.enabled && styles.templateBtnActive,
                      pressed && { opacity: 0.6 },
                    ]}
                    onPress={openContextModal}
                    hitSlop={6}
                  >
                    <Type
                      size={15}
                      color={templateConfig?.context.enabled ? '#38bdf8' : 'rgba(255, 255, 255, 0.7)'}
                    />
                    <Text
                      style={[
                        styles.templateActionBtnText,
                        templateConfig?.context.enabled && styles.templateActionBtnTextActive,
                      ]}
                    >
                      Konteks
                    </Text>
                  </Pressable>
                </View>

                {/* Baris 2: Gameplay & Watermark */}
                <View style={styles.templateButtonsRow}>
                  {/* 3. Tombol Edit Main Gameplay */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.templateActionBtn,
                      (templateConfig?.mainVideo?.enabled !== false) && styles.templateBtnActive,
                      pressed && { opacity: 0.6 },
                    ]}
                    onPress={openMainVideoModal}
                    hitSlop={6}
                  >
                    <Gamepad2
                      size={15}
                      color={(templateConfig?.mainVideo?.enabled !== false) ? '#38bdf8' : 'rgba(255, 255, 255, 0.7)'}
                    />
                    <Text
                      style={[
                        styles.templateActionBtnText,
                        (templateConfig?.mainVideo?.enabled !== false) && styles.templateActionBtnTextActive,
                      ]}
                    >
                      Gameplay
                    </Text>
                  </Pressable>

                  {/* 4. Tombol Watermark */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.templateActionBtn,
                      templateConfig?.watermark?.enabled && styles.templateBtnActive,
                      pressed && { opacity: 0.6 },
                    ]}
                    onPress={openWatermarkModal}
                    hitSlop={6}
                  >
                    <Stamp
                      size={15}
                      color={templateConfig?.watermark?.enabled ? '#38bdf8' : 'rgba(255, 255, 255, 0.7)'}
                    />
                    <Text
                      style={[
                        styles.templateActionBtnText,
                        templateConfig?.watermark?.enabled && styles.templateActionBtnTextActive,
                      ]}
                    >
                      {templateConfig?.watermark?.enabled ? 'WM: ON' : 'Watermark'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.editorEmptyPlaceholder}>
                <Text style={styles.editorEmptyPlaceholderText}>
                  Pilih tab Subtitle atau Template untuk kustomisasi klip
                </Text>
              </View>
            )}
          </View>
    </>
  ) : null}

      {/* MODAL 1: Language Selection Modal */}
      <Modal
        visible={showLangModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLangModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowLangModal(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Globe size={18} color="#38bdf8" />
                <Text style={styles.modalTitle}>Ambil Subtitle YouTube</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.modalCloseBtn, pressed && { opacity: 0.6 }]}
                onPress={() => setShowLangModal(false)}
                hitSlop={8}
              >
                <X size={18} color="#94a3b8" />
              </Pressable>
            </View>

            <Text style={styles.modalDescription}>
              Pilih preferensi bahasa track subtitle yang ingin dimuat dari YouTube:
            </Text>

            <View style={styles.langOptionsList}>
              {/* Option ID */}
              <Pressable
                style={({ pressed }) => [styles.langOptionCard, pressed && { opacity: 0.7 }]}
                onPress={() => {
                  setShowLangModal(false);
                  onFetchSubtitles('id');
                }}
              >
                <View style={[styles.langBadge, styles.langBadgeId]}>
                  <Text style={styles.langBadgeText}>ID</Text>
                </View>
                <View style={styles.langOptionInfo}>
                  <Text style={styles.langOptionTitle}>Bahasa Indonesia</Text>
                  <Text style={styles.langOptionSub}>Subtitle resmi atau automatic captions ID</Text>
                </View>
              </Pressable>

              {/* Option EN */}
              <Pressable
                style={({ pressed }) => [styles.langOptionCard, pressed && { opacity: 0.7 }]}
                onPress={() => {
                  setShowLangModal(false);
                  onFetchSubtitles('en');
                }}
              >
                <View style={[styles.langBadge, styles.langBadgeEn]}>
                  <Text style={styles.langBadgeText}>EN</Text>
                </View>
                <View style={styles.langOptionInfo}>
                  <Text style={styles.langOptionTitle}>English</Text>
                  <Text style={styles.langOptionSub}>Manual captions or automatic captions EN</Text>
                </View>
              </Pressable>

              {/* Option JA */}
              <Pressable
                style={({ pressed }) => [styles.langOptionCard, pressed && { opacity: 0.7 }]}
                onPress={() => {
                  setShowLangModal(false);
                  onFetchSubtitles('ja');
                }}
              >
                <View style={[styles.langBadge, styles.langBadgeJa]}>
                  <Text style={styles.langBadgeText}>JA</Text>
                </View>
                <View style={styles.langOptionInfo}>
                  <Text style={styles.langOptionTitle}>日本語 (Japanese)</Text>
                  <Text style={styles.langOptionSub}>Official Japanese captions or auto-generated JA</Text>
                </View>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* MODAL 2: Multiline Text Input Modal */}
      <Modal
        visible={showTextModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTextModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowTextModal(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Type size={18} color="#38bdf8" />
                <Text style={styles.modalTitle}>Edit Teks Subtitle</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.modalCloseBtn, pressed && { opacity: 0.6 }]}
                onPress={() => setShowTextModal(false)}
                hitSlop={8}
              >
                <X size={18} color="#94a3b8" />
              </Pressable>
            </View>

            <TextInput
              style={styles.multilineTextInput}
              value={tempEditText}
              onChangeText={setTempEditText}
              placeholder="Ketik teks subtitle... (Enter untuk baris baru)"
              placeholderTextColor="rgba(255, 255, 255, 0.35)"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              autoFocus
            />

            <View style={styles.modalActionsRow}>
              <Pressable
                style={({ pressed }) => [styles.modalCancelBtn, pressed && { opacity: 0.7 }]}
                onPress={() => setShowTextModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>Batal</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalSaveBtn, pressed && { opacity: 0.8 }]}
                onPress={() => {
                  if (selectedCue) {
                    onUpdateCue(selectedCue.id, { text: tempEditText });
                  }
                  setShowTextModal(false);
                }}
              >
                <Text style={styles.modalSaveBtnText}>Simpan</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* MODAL 3: Font Size Input Modal (Support Decimal) */}
      <Modal
        visible={showFontModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFontModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowFontModal(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Text style={styles.fontSizeModalHeaderIcon}>Aa</Text>
                <Text style={styles.modalTitle}>Ukuran Font Subtitle</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.modalCloseBtn, pressed && { opacity: 0.6 }]}
                onPress={() => setShowFontModal(false)}
                hitSlop={8}
              >
                <X size={18} color="#94a3b8" />
              </Pressable>
            </View>

            <View style={styles.fontSizeInputRow}>
              <TextInput
                style={styles.fontSizeInputField}
                value={tempEditSize}
                onChangeText={setTempEditSize}
                keyboardType="decimal-pad"
                placeholder="14"
                placeholderTextColor="rgba(255, 255, 255, 0.35)"
                autoFocus
                selectTextOnFocus
              />
              <Text style={styles.fontSizeUnitText}>px</Text>
            </View>

            {/* Preset buttons */}
            <View style={styles.fontSizePresetGroup}>
              {['8', '10', '11', '12', '13', '14', '15', '16', '18'].map((preset) => (
                <Pressable
                  key={preset}
                  style={({ pressed }) => [
                    styles.fontSizePresetBtn,
                    tempEditSize === preset && styles.fontSizePresetBtnActive,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => setTempEditSize(preset)}
                >
                  <Text
                    style={[
                      styles.fontSizePresetText,
                      tempEditSize === preset && styles.fontSizePresetTextActive,
                    ]}
                  >
                    {preset}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.modalActionsRow}>
              <Pressable
                style={({ pressed }) => [styles.modalCancelBtn, pressed && { opacity: 0.7 }]}
                onPress={() => setShowFontModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>Batal</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalSaveBtn, pressed && { opacity: 0.8 }]}
                onPress={() => {
                  const parsed = parseFloat(tempEditSize);
                  if (selectedCue && !isNaN(parsed) && parsed > 0) {
                    if (parsed === 14) {
                      onUpdateCue(selectedCue.id, { fontSize: undefined });
                    } else {
                      onUpdateCue(selectedCue.id, { fontSize: parsed });
                    }
                  }
                  setShowFontModal(false);
                }}
              >
                <Text style={styles.modalSaveBtnText}>Simpan</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* MODAL 4: Subtitle Time Range Modal (6 Boxes: MM:SS.ms -> MM:SS.ms) */}
      <Modal
        visible={showTimeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTimeModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowTimeModal(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Clock size={18} color="#38bdf8" />
                <Text style={styles.modalTitle}>Rentang Waktu Subtitle</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.modalCloseBtn, pressed && { opacity: 0.6 }]}
                onPress={() => setShowTimeModal(false)}
                hitSlop={8}
              >
                <X size={18} color="#94a3b8" />
              </Pressable>
            </View>

            <Text style={styles.modalDescription}>
              Atur waktu mulai masuk dan selesai hilangnya subtitle secara presisi (Menit, Detik, Milidetik):
            </Text>

            {/* SEKSI 1: WAKTU MULAI (START) */}
            <View style={styles.timeSectionContainer}>
              <View style={styles.timeSectionHeaderRow}>
                <Text style={styles.timeSectionLabel}>WAKTU MULAI (START)</Text>
                <Pressable
                  style={({ pressed }) => [styles.timePlayheadBtn, pressed && { opacity: 0.7 }]}
                  onPress={setStartToPlayhead}
                >
                  <Text style={styles.timePlayheadBtnText}>Set ke Playhead</Text>
                </Pressable>
              </View>

              <View style={styles.timeBoxesRow}>
                {/* Box Menit */}
                <View style={styles.timeBoxWrapper}>
                  <TextInput
                    style={styles.timeBoxInput}
                    value={startMin}
                    onChangeText={setStartMin}
                    keyboardType="numeric"
                    placeholder="00"
                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
                    selectTextOnFocus
                  />
                  <Text style={styles.timeBoxSublabel}>Menit</Text>
                </View>

                <Text style={styles.timeColonSeparator}>:</Text>

                {/* Box Detik */}
                <View style={styles.timeBoxWrapper}>
                  <TextInput
                    style={styles.timeBoxInput}
                    value={startSec}
                    onChangeText={setStartSec}
                    keyboardType="numeric"
                    placeholder="00"
                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
                    selectTextOnFocus
                  />
                  <Text style={styles.timeBoxSublabel}>Detik</Text>
                </View>

                <Text style={styles.timeColonSeparator}>.</Text>

                {/* Box Milidetik */}
                <View style={[styles.timeBoxWrapper, styles.timeBoxWrapperMs]}>
                  <TextInput
                    style={[styles.timeBoxInput, styles.timeBoxInputMs]}
                    value={startMs}
                    onChangeText={setStartMs}
                    keyboardType="numeric"
                    placeholder="000"
                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
                    selectTextOnFocus
                  />
                  <Text style={styles.timeBoxSublabel}>Milidetik</Text>
                </View>
              </View>
            </View>

            {/* SEKSI 2: WAKTU SELESAI (END) */}
            <View style={styles.timeSectionContainer}>
              <View style={styles.timeSectionHeaderRow}>
                <Text style={styles.timeSectionLabel}>WAKTU SELESAI (END)</Text>
                <Pressable
                  style={({ pressed }) => [styles.timePlayheadBtn, pressed && { opacity: 0.7 }]}
                  onPress={setEndToPlayhead}
                >
                  <Text style={styles.timePlayheadBtnText}>Set ke Playhead</Text>
                </Pressable>
              </View>

              <View style={styles.timeBoxesRow}>
                {/* Box Menit */}
                <View style={styles.timeBoxWrapper}>
                  <TextInput
                    style={styles.timeBoxInput}
                    value={endMin}
                    onChangeText={setEndMin}
                    keyboardType="numeric"
                    placeholder="00"
                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
                    selectTextOnFocus
                  />
                  <Text style={styles.timeBoxSublabel}>Menit</Text>
                </View>

                <Text style={styles.timeColonSeparator}>:</Text>

                {/* Box Detik */}
                <View style={styles.timeBoxWrapper}>
                  <TextInput
                    style={styles.timeBoxInput}
                    value={endSec}
                    onChangeText={setEndSec}
                    keyboardType="numeric"
                    placeholder="00"
                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
                    selectTextOnFocus
                  />
                  <Text style={styles.timeBoxSublabel}>Detik</Text>
                </View>

                <Text style={styles.timeColonSeparator}>.</Text>

                {/* Box Milidetik */}
                <View style={[styles.timeBoxWrapper, styles.timeBoxWrapperMs]}>
                  <TextInput
                    style={[styles.timeBoxInput, styles.timeBoxInputMs]}
                    value={endMs}
                    onChangeText={setEndMs}
                    keyboardType="numeric"
                    placeholder="000"
                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
                    selectTextOnFocus
                  />
                  <Text style={styles.timeBoxSublabel}>Milidetik</Text>
                </View>
              </View>
            </View>

            <View style={styles.modalActionsRow}>
              <Pressable
                style={({ pressed }) => [styles.modalCancelBtn, pressed && { opacity: 0.7 }]}
                onPress={() => setShowTimeModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>Batal</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalSaveBtn, pressed && { opacity: 0.8 }]}
                onPress={handleSaveTimeRange}
              >
                <Text style={styles.modalSaveBtnText}>Simpan</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* MODAL 5: Subtitle Global Position (X, Y) Modal */}
      <Modal
        visible={showPositionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPositionModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowPositionModal(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Move size={18} color="#38bdf8" />
                <Text style={styles.modalTitle}>Posisi Subtitle (Global)</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.modalCloseBtn, pressed && { opacity: 0.6 }]}
                onPress={() => setShowPositionModal(false)}
                hitSlop={8}
              >
                <X size={18} color="#94a3b8" />
              </Pressable>
            </View>

            <Text style={styles.modalDescription}>
              Atur posisi titik pusat teks subtitle (skala 0 - 100 terhadap frame 16:9 video player):
            </Text>

            {/* SEKSI X */}
            <View style={styles.posSectionContainer}>
              <View style={styles.posHeaderRow}>
                <Text style={styles.timeSectionLabel}>KOORDINAT X</Text>
              </View>
              <View style={styles.posInputRow}>
                <TextInput
                  style={styles.posTextInput}
                  value={tempPosX}
                  onChangeText={setTempPosX}
                  keyboardType="numbers-and-punctuation"
                  placeholder="50"
                  placeholderTextColor="rgba(255, 255, 255, 0.3)"
                  selectTextOnFocus
                />
                <View style={styles.posPresetGroup}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.posPresetBtn,
                      tempPosX === '25' && styles.posPresetBtnActive,
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={() => setTempPosX('25')}
                  >
                    <Text style={[styles.posPresetText, tempPosX === '25' && styles.posPresetTextActive]}>Kiri</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.posPresetBtn,
                      tempPosX === '50' && styles.posPresetBtnActive,
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={() => setTempPosX('50')}
                  >
                    <Text style={[styles.posPresetText, tempPosX === '50' && styles.posPresetTextActive]}>Tengah</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.posPresetBtn,
                      tempPosX === '75' && styles.posPresetBtnActive,
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={() => setTempPosX('75')}
                  >
                    <Text style={[styles.posPresetText, tempPosX === '75' && styles.posPresetTextActive]}>Kanan</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* SEKSI Y */}
            <View style={styles.posSectionContainer}>
              <View style={styles.posHeaderRow}>
                <Text style={styles.timeSectionLabel}>KOORDINAT Y</Text>
              </View>
              <View style={styles.posInputRow}>
                <TextInput
                  style={styles.posTextInput}
                  value={tempPosY}
                  onChangeText={setTempPosY}
                  keyboardType="numbers-and-punctuation"
                  placeholder="85"
                  placeholderTextColor="rgba(255, 255, 255, 0.3)"
                  selectTextOnFocus
                />
                <View style={styles.posPresetGroup}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.posPresetBtn,
                      tempPosY === '15' && styles.posPresetBtnActive,
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={() => setTempPosY('15')}
                  >
                    <Text style={[styles.posPresetText, tempPosY === '15' && styles.posPresetTextActive]}>Atas</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.posPresetBtn,
                      tempPosY === '50' && styles.posPresetBtnActive,
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={() => setTempPosY('50')}
                  >
                    <Text style={[styles.posPresetText, tempPosY === '50' && styles.posPresetTextActive]}>Tengah</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.posPresetBtn,
                      tempPosY === '85' && styles.posPresetBtnActive,
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={() => setTempPosY('85')}
                  >
                    <Text style={[styles.posPresetText, tempPosY === '85' && styles.posPresetTextActive]}>Bawah</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            <View style={styles.modalActionsRow}>
              <Pressable
                style={({ pressed }) => [styles.modalResetBtn, pressed && { opacity: 0.7 }]}
                onPress={() => {
                  setTempPosX('50');
                  setTempPosY('85');
                }}
              >
                <Text style={styles.modalResetBtnText}>Reset</Text>
              </Pressable>
              <View style={{ flex: 1 }} />
              <Pressable
                style={({ pressed }) => [styles.modalCancelBtn, pressed && { opacity: 0.7 }]}
                onPress={() => setShowPositionModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>Batal</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalSaveBtn, pressed && { opacity: 0.8 }]}
                onPress={handleSavePosition}
              >
                <Text style={styles.modalSaveBtnText}>Simpan</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* MODAL 6: Modal Elemen Konteks */}
      <Modal
        visible={showContextModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowContextModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowContextModal(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Type size={18} color="#38bdf8" />
                <Text style={styles.modalTitle}>Konteks Judul</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.modalCloseBtn, pressed && { opacity: 0.6 }]}
                onPress={() => setShowContextModal(false)}
                hitSlop={8}
              >
                <X size={18} color="#94a3b8" />
              </Pressable>
            </View>

            {/* Toggle Aktif */}
            <Pressable
              style={[
                styles.templateToggleRow,
                tempContextEnabled && styles.templateToggleRowActive,
              ]}
              onPress={() => setTempContextEnabled((p) => !p)}
            >
              <Text style={styles.templateToggleLabel}>Tampilkan Banner Judul</Text>
              <View
                style={[
                  styles.templateToggleSwitch,
                  tempContextEnabled && styles.templateToggleSwitchActive,
                ]}
              >
                <View
                  style={[
                    styles.templateToggleKnob,
                    tempContextEnabled && styles.templateToggleKnobActive,
                  ]}
                />
              </View>
            </Pressable>

            {/* Input Teks Banner (Multiline Textarea, maks 3 baris) */}
            <View style={styles.posSectionContainer}>
              <Text style={styles.timeSectionLabel}>TEKS BANNER (MAKS 3 BARIS)</Text>
              <TextInput
                style={[
                  styles.multilineTextInput,
                  { minHeight: 72, maxHeight: 96, textAlignVertical: 'top' },
                ]}
                value={tempContextText}
                onChangeText={(text) => {
                  const lines = text.split('\n');
                  if (lines.length > 3) {
                    setTempContextText(lines.slice(0, 3).join('\n'));
                  } else {
                    setTempContextText(text);
                  }
                }}
                placeholder="JUDUL VIDEO&#10;(Enter untuk baris baru)"
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Perataan Teks (1 Row: Label di kiri, Icon buttons compact di kanan) */}
            <View style={styles.alignRowContainer}>
              <Text style={styles.alignRowLabel}>Perataan Teks</Text>
              <View style={styles.alignBtnGroup}>
                <Pressable
                  style={[
                    styles.compactAlignBtn,
                    tempContextAlign === 'start' && styles.compactAlignBtnActive,
                  ]}
                  onPress={() => setTempContextAlign('start')}
                  hitSlop={6}
                >
                  <AlignLeft
                    size={18}
                    color={tempContextAlign === 'start' ? '#38bdf8' : '#94a3b8'}
                  />
                </Pressable>
                <Pressable
                  style={[
                    styles.compactAlignBtn,
                    tempContextAlign === 'center' && styles.compactAlignBtnActive,
                  ]}
                  onPress={() => setTempContextAlign('center')}
                  hitSlop={6}
                >
                  <AlignCenter
                    size={18}
                    color={tempContextAlign === 'center' ? '#38bdf8' : '#94a3b8'}
                  />
                </Pressable>
              </View>
            </View>

            {/* Ukuran Font & Padding Vertikal (Input Angka Dinamis) */}
            <View style={styles.posSectionContainer}>
              <Text style={styles.timeSectionLabel}>UKURAN & PADDING (ANGKA BEBAS)</Text>
              <View style={styles.cropCoordinatesRow}>
                <View style={styles.cropCoordinateBox}>
                  <Text style={styles.coordinatePrefixLabel}>Size</Text>
                  <TextInput
                    style={styles.coordinateInput}
                    value={tempContextFontSize}
                    onChangeText={setTempContextFontSize}
                    keyboardType="numeric"
                    placeholder="16"
                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
                    selectTextOnFocus
                  />
                  <Text style={styles.coordinateSuffixUnit}>dp</Text>
                </View>
                <View style={styles.cropCoordinateBox}>
                  <Text style={styles.coordinatePrefixLabel}>Pad</Text>
                  <TextInput
                    style={styles.coordinateInput}
                    value={tempContextPaddingY}
                    onChangeText={setTempContextPaddingY}
                    keyboardType="numeric"
                    placeholder="10"
                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
                    selectTextOnFocus
                  />
                  <Text style={styles.coordinateSuffixUnit}>px</Text>
                </View>
              </View>
              <Text style={styles.cropCoordinatesHint}>
                Bebas diisi angka berapa pun. Otomatis dikalibrasi saat ekspor.
              </Text>
            </View>

            {/* Footer Buttons */}
            <View style={styles.modalActionsRow}>
              <Pressable
                style={({ pressed }) => [styles.modalCancelBtn, pressed && { opacity: 0.7 }]}
                onPress={() => setShowContextModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>Batal</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalSaveBtn, pressed && { opacity: 0.8 }]}
                onPress={() => {
                  onUpdateContext?.({
                    enabled: tempContextEnabled,
                    text: tempContextText.trim() || 'JUDUL VIDEO',
                    fontSize: Math.max(6, Math.min(60, parseInt(tempContextFontSize, 10) || 16)),
                    paddingY: Math.max(0, Math.min(60, parseInt(tempContextPaddingY, 10) || 10)),
                    align: tempContextAlign,
                  });
                  setShowContextModal(false);
                }}
              >
                <Text style={styles.modalSaveBtnText}>Simpan</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* MODAL 7: Modal Elemen Facecam */}
      <Modal
        visible={showFacecamModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFacecamModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowFacecamModal(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Camera size={18} color="#38bdf8" />
                <Text style={styles.modalTitle}>Pengaturan Facecam</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.modalCloseBtn, pressed && { opacity: 0.6 }]}
                onPress={() => setShowFacecamModal(false)}
                hitSlop={8}
              >
                <X size={18} color="#94a3b8" />
              </Pressable>
            </View>

            {/* Toggle Aktif */}
            <Pressable
              style={[
                styles.templateToggleRow,
                tempFacecamEnabled && styles.templateToggleRowActive,
              ]}
              onPress={() => setTempFacecamEnabled((p) => !p)}
            >
              <Text style={styles.templateToggleLabel}>Tampilkan Box Facecam (4:3)</Text>
              <View
                style={[
                  styles.templateToggleSwitch,
                  tempFacecamEnabled && styles.templateToggleSwitchActive,
                ]}
              >
                <View
                  style={[
                    styles.templateToggleKnob,
                    tempFacecamEnabled && styles.templateToggleKnobActive,
                  ]}
                />
              </View>
            </Pressable>

            {/* Input Zoom Persen */}
            <View style={styles.posSectionContainer}>
              <Text style={styles.timeSectionLabel}>ZOOM FACECAM (%)</Text>
              <View style={styles.percentageInputRow}>
                <TextInput
                  style={styles.percentageTextInput}
                  value={tempFacecamZoom}
                  onChangeText={setTempFacecamZoom}
                  keyboardType="numeric"
                  placeholder="200"
                  placeholderTextColor="rgba(255, 255, 255, 0.3)"
                  selectTextOnFocus
                />
                <Text style={styles.percentageUnitText}>%</Text>
              </View>
            </View>

            {/* Input Titik Tengah Crop (X, Y) */}
            <View style={styles.posSectionContainer}>
              <Text style={styles.timeSectionLabel}>TITIK TENGAH CROP (X, Y)</Text>
              <View style={styles.cropCoordinatesRow}>
                <View style={styles.cropCoordinateBox}>
                  <Text style={styles.coordinatePrefixLabel}>X</Text>
                  <TextInput
                    style={styles.coordinateInput}
                    value={tempFacecamCropX}
                    onChangeText={setTempFacecamCropX}
                    keyboardType="numeric"
                    placeholder="80"
                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
                    selectTextOnFocus
                  />
                  <Text style={styles.coordinateSuffixUnit}>%</Text>
                </View>
                <View style={styles.cropCoordinateBox}>
                  <Text style={styles.coordinatePrefixLabel}>Y</Text>
                  <TextInput
                    style={styles.coordinateInput}
                    value={tempFacecamCropY}
                    onChangeText={setTempFacecamCropY}
                    keyboardType="numeric"
                    placeholder="20"
                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
                    selectTextOnFocus
                  />
                  <Text style={styles.coordinateSuffixUnit}>%</Text>
                </View>
              </View>
              <Text style={styles.cropCoordinatesHint}>
                0% = Kiri / Atas, 50% = Tengah, 100% = Kanan / Bawah
              </Text>
            </View>

            {/* Footer Buttons */}
            <View style={styles.modalActionsRow}>
              <Pressable
                style={({ pressed }) => [styles.modalCancelBtn, pressed && { opacity: 0.7 }]}
                onPress={() => setShowFacecamModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>Batal</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalSaveBtn, pressed && { opacity: 0.8 }]}
                onPress={() => {
                  onUpdateFacecam?.({
                    enabled: tempFacecamEnabled,
                    zoom: Math.max(1.0, Math.min(5.0, (parseFloat(tempFacecamZoom) || 200) / 100)),
                    cropX: Math.max(0, Math.min(100, parseInt(tempFacecamCropX, 10) || 80)),
                    cropY: Math.max(0, Math.min(100, parseInt(tempFacecamCropY, 10) || 20)),
                  });
                  setShowFacecamModal(false);
                }}
              >
                <Text style={styles.modalSaveBtnText}>Simpan</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* MODAL 8: Modal Elemen Main Video */}
      <Modal
        visible={showMainVideoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMainVideoModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowMainVideoModal(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Gamepad2 size={18} color="#38bdf8" />
                <Text style={styles.modalTitle}>Main Gameplay</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.modalCloseBtn, pressed && { opacity: 0.6 }]}
                onPress={() => setShowMainVideoModal(false)}
                hitSlop={8}
              >
                <X size={18} color="#94a3b8" />
              </Pressable>
            </View>

            {/* Toggle Aktif */}
            <Pressable
              style={[
                styles.templateToggleRow,
                tempMainEnabled && styles.templateToggleRowActive,
              ]}
              onPress={() => setTempMainEnabled((p) => !p)}
            >
              <Text style={styles.templateToggleLabel}>Tampilkan Box Gameplay</Text>
              <View
                style={[
                  styles.templateToggleSwitch,
                  tempMainEnabled && styles.templateToggleSwitchActive,
                ]}
              >
                <View
                  style={[
                    styles.templateToggleKnob,
                    tempMainEnabled && styles.templateToggleKnobActive,
                  ]}
                />
              </View>
            </Pressable>

            {/* Input Zoom Persen */}
            <View style={styles.posSectionContainer}>
              <Text style={styles.timeSectionLabel}>ZOOM GAMEPLAY (%)</Text>
              <View style={styles.percentageInputRow}>
                <TextInput
                  style={styles.percentageTextInput}
                  value={tempMainZoom}
                  onChangeText={setTempMainZoom}
                  keyboardType="numeric"
                  placeholder="100"
                  placeholderTextColor="rgba(255, 255, 255, 0.3)"
                  selectTextOnFocus
                />
                <Text style={styles.percentageUnitText}>%</Text>
              </View>
            </View>

            {/* Input Titik Tengah Crop (X, Y) */}
            <View style={styles.posSectionContainer}>
              <Text style={styles.timeSectionLabel}>TITIK TENGAH CROP (X, Y)</Text>
              <View style={styles.cropCoordinatesRow}>
                <View style={styles.cropCoordinateBox}>
                  <Text style={styles.coordinatePrefixLabel}>X</Text>
                  <TextInput
                    style={styles.coordinateInput}
                    value={tempMainCropX}
                    onChangeText={setTempMainCropX}
                    keyboardType="numeric"
                    placeholder="50"
                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
                    selectTextOnFocus
                  />
                  <Text style={styles.coordinateSuffixUnit}>%</Text>
                </View>
                <View style={styles.cropCoordinateBox}>
                  <Text style={styles.coordinatePrefixLabel}>Y</Text>
                  <TextInput
                    style={styles.coordinateInput}
                    value={tempMainCropY}
                    onChangeText={setTempMainCropY}
                    keyboardType="numeric"
                    placeholder="50"
                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
                    selectTextOnFocus
                  />
                  <Text style={styles.coordinateSuffixUnit}>%</Text>
                </View>
              </View>
              <Text style={styles.cropCoordinatesHint}>
                0% = Kiri / Atas, 50% = Tengah, 100% = Kanan / Bawah
              </Text>
            </View>

            {/* Footer Buttons */}
            <View style={styles.modalActionsRow}>
              <Pressable
                style={({ pressed }) => [styles.modalCancelBtn, pressed && { opacity: 0.7 }]}
                onPress={() => setShowMainVideoModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>Batal</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalSaveBtn, pressed && { opacity: 0.8 }]}
                onPress={() => {
                  onUpdateMainVideo?.({
                    enabled: tempMainEnabled,
                    zoom: Math.max(1.0, Math.min(5.0, (parseFloat(tempMainZoom) || 100) / 100)),
                    cropX: Math.max(0, Math.min(100, parseInt(tempMainCropX, 10) || 50)),
                    cropY: Math.max(0, Math.min(100, parseInt(tempMainCropY, 10) || 50)),
                  });
                  setShowMainVideoModal(false);
                }}
              >
                <Text style={styles.modalSaveBtnText}>Simpan</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* MODAL: Modal Elemen Watermark */}
      <Modal
        visible={showWatermarkModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWatermarkModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowWatermarkModal(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Stamp size={18} color="#38bdf8" />
                <Text style={styles.modalTitle}>Pengaturan Watermark</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.modalCloseBtn, pressed && { opacity: 0.6 }]}
                onPress={() => setShowWatermarkModal(false)}
                hitSlop={8}
              >
                <X size={18} color="#94a3b8" />
              </Pressable>
            </View>

            {/* Toggle Aktif (1 Line seragam dengan template config lainnya) */}
            <Pressable
              style={[
                styles.templateToggleRow,
                tempWatermarkEnabled && styles.templateToggleRowActive,
              ]}
              onPress={() => setTempWatermarkEnabled((p) => !p)}
            >
              <Text style={styles.templateToggleLabel}>Tampilkan Watermark</Text>
              <View
                style={[
                  styles.templateToggleSwitch,
                  tempWatermarkEnabled && styles.templateToggleSwitchActive,
                ]}
              >
                <View
                  style={[
                    styles.templateToggleKnob,
                    tempWatermarkEnabled && styles.templateToggleKnobActive,
                  ]}
                />
              </View>
            </Pressable>

            {/* Input Teks Watermark */}
            <View style={styles.posSectionContainer}>
              <Text style={styles.timeSectionLabel}>TEKS WATERMARK</Text>
              <TextInput
                style={styles.modalSingleInput}
                value={tempWatermarkText}
                onChangeText={setTempWatermarkText}
                placeholder="Contoh: @channel_kamu"
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                autoCapitalize="none"
                selectTextOnFocus
              />
            </View>

            {/* Input Ukuran Font Size (Numeric) */}
            <View style={styles.posSectionContainer}>
              <Text style={styles.timeSectionLabel}>UKURAN WATERMARK (DP)</Text>
              <View style={styles.cropCoordinatesRow}>
                <View style={styles.cropCoordinateBox}>
                  <Text style={styles.coordinatePrefixLabel}>Size</Text>
                  <TextInput
                    style={styles.coordinateInput}
                    value={tempWatermarkSize}
                    onChangeText={setTempWatermarkSize}
                    keyboardType="numeric"
                    placeholder="14"
                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
                    selectTextOnFocus
                  />
                  <Text style={styles.coordinateSuffixUnit}>dp</Text>
                </View>
              </View>
            </View>

            {/* Input Posisi X, Y (Hanya Angka tanpa Input Cepat) */}
            <View style={styles.posSectionContainer}>
              <Text style={styles.timeSectionLabel}>POSISI (X, Y)</Text>
              <View style={styles.cropCoordinatesRow}>
                <View style={styles.cropCoordinateBox}>
                  <Text style={styles.coordinatePrefixLabel}>X</Text>
                  <TextInput
                    style={styles.coordinateInput}
                    value={tempWatermarkX}
                    onChangeText={setTempWatermarkX}
                    keyboardType="numeric"
                    placeholder="85"
                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
                    selectTextOnFocus
                  />
                  <Text style={styles.coordinateSuffixUnit}>%</Text>
                </View>
                <View style={styles.cropCoordinateBox}>
                  <Text style={styles.coordinatePrefixLabel}>Y</Text>
                  <TextInput
                    style={styles.coordinateInput}
                    value={tempWatermarkY}
                    onChangeText={setTempWatermarkY}
                    keyboardType="numeric"
                    placeholder="15"
                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
                    selectTextOnFocus
                  />
                  <Text style={styles.coordinateSuffixUnit}>%</Text>
                </View>
              </View>
              <Text style={styles.cropCoordinatesHint}>
                0% = Kiri / Atas, 50% = Tengah, 100% = Kanan / Bawah
              </Text>
            </View>

            {/* Footer Buttons */}
            <View style={styles.modalActionsRow}>
              <Pressable
                style={({ pressed }) => [styles.modalCancelBtn, pressed && { opacity: 0.7 }]}
                onPress={() => setShowWatermarkModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>Batal</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalSaveBtn, pressed && { opacity: 0.8 }]}
                onPress={() => {
                  onUpdateWatermark?.({
                    enabled: tempWatermarkEnabled,
                    text: tempWatermarkText.trim(),
                    size: Math.max(8, Math.min(40, parseInt(tempWatermarkSize, 10) || 14)),
                    x: Math.max(0, Math.min(100, parseFloat(tempWatermarkX) || 85)),
                    y: Math.max(0, Math.min(100, parseFloat(tempWatermarkY) || 15)),
                  });
                  setShowWatermarkModal(false);
                }}
              >
                <Text style={styles.modalSaveBtnText}>Simpan</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  topSection: {
    backgroundColor: '#121212',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    zIndex: 25,
  },
  timeRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 46,
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  leftActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 10,
  },
  customAddBtn: {
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
  },
  visibleCountBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  doneLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  downloadLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  centerTimeWrapper: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  timeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeNumberText: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  timeMsText: {
    fontSize: 13,
    letterSpacing: 0.2,
  },
  timeMsDim: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  timeSeparatorText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: '700',
  },
  timePressable: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.25)',
  },
  timeInput: {
    minWidth: 44,
    height: 28,
    backgroundColor: '#18181b',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 0,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    fontWeight: '800',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    color: 'rgba(255, 255, 255, 0.95)',
  },
  rightActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  statusBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  downloadBtnActive: {
    width: 'auto',
    paddingHorizontal: 8,
    flexDirection: 'row',
  },
  downloadProgressText: {
    color: '#38bdf8',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  exportBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  exportBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.25)',
    borderColor: '#38bdf8',
  },
  editorModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  modeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modeToggleBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
    borderColor: '#38bdf8',
  },
  modeToggleText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    fontWeight: '600',
  },
  modeToggleTextActive: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  editorContentContainer: {
    height: 88,
    backgroundColor: '#121212',
    overflow: 'hidden',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  templateLayerSection: {
    height: 88,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: '#121212',
    justifyContent: 'center',
    gap: 7,
  },
  templateButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  templateActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 33,
    borderRadius: 7,
    backgroundColor: '#1c1c20',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  templateBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    borderColor: '#38bdf8',
  },
  templateActionBtnText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '600',
  },
  templateActionBtnTextActive: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  editorEmptyPlaceholder: {
    height: 88,
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  editorEmptyPlaceholderText: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  templateToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  templateToggleRowActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  templateToggleLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  templateToggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#333338',
    padding: 2,
    justifyContent: 'center',
  },
  templateToggleSwitchActive: {
    backgroundColor: '#38bdf8',
  },
  templateToggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
  },
  templateToggleKnobActive: {
    alignSelf: 'flex-end',
  },
  modalSingleInput: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  trashBtnInactive: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  trashBtnActive: {
    backgroundColor: '#dc2626',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 4,
  },
  doneBtnInactive: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  doneBtnActive: {
    backgroundColor: '#059669',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 4,
  },
  extendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  cropRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: 'rgba(225, 29, 72, 0.08)',
  },
  fineTuneGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  extendBtn: {
    width: 38,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  extendBtnText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '800',
  },
  extendLabel: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  cropBtn: {
    width: 38,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(225, 29, 72, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(225, 29, 72, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cropBtnText: {
    color: '#fb7185',
    fontSize: 11,
    fontWeight: '800',
  },
  cropLabel: {
    color: '#f43f5e',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  subtitleLayerSection: {
    height: 88,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#121212',
    justifyContent: 'space-between',
  },
  miniTrackWrapper: {
    width: '100%',
    height: 34,
    backgroundColor: '#18181b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    position: 'relative',
  },
  miniTrackBackground: {
    ...StyleSheet.absoluteFill,
  },
  playheadNeedle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2.5,
    backgroundColor: '#ef4444',
    zIndex: 20,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
    elevation: 4,
  },
  playheadCap: {
    position: 'absolute',
    top: 0,
    left: -3.5,
    width: 9.5,
    height: 6,
    backgroundColor: '#ef4444',
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  cuePill: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    borderRadius: 3,
    overflow: 'hidden',
  },
  cuePillEven: {
    backgroundColor: 'rgba(14, 165, 233, 0.75)',
  },
  cuePillOdd: {
    backgroundColor: 'rgba(245, 158, 11, 0.75)',
  },
  emptyTrackHint: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTrackText: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 11,
    fontStyle: 'italic',
  },
  cueActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 36,
  },
  addCueBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderRadius: 7,
  },
  cueEditorActionIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 7,
    backgroundColor: '#1c1c20',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteActionBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  fontSizeIconText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#18181b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 18,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fontSizeModalHeaderIcon: {
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalDescription: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    lineHeight: 18,
  },
  langOptionsList: {
    gap: 8,
  },
  langOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#202024',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    padding: 10,
    gap: 12,
  },
  langBadge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langBadgeId: {
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  langBadgeEn: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  langBadgeJa: {
    backgroundColor: 'rgba(244, 63, 94, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.4)',
  },
  langBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  langOptionInfo: {
    flex: 1,
  },
  langOptionTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  langOptionSub: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 11,
    marginTop: 2,
  },
  multilineTextInput: {
    backgroundColor: '#121214',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 10,
    padding: 12,
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 20,
    minHeight: 100,
  },
  fontSizeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  fontSizeInputField: {
    backgroundColor: '#121214',
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.5)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: '#38bdf8',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    minWidth: 90,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  fontSizeUnitText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 15,
    fontWeight: '700',
  },
  fontSizePresetGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  fontSizePresetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#202024',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  fontSizePresetBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderColor: '#38bdf8',
  },
  fontSizePresetText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  fontSizePresetTextActive: {
    color: '#38bdf8',
  },
  modalActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalCancelBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  modalSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#0284c7',
    gap: 6,
  },
  modalSaveBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  timeSectionContainer: {
    backgroundColor: '#16161a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 10,
    gap: 8,
  },
  timeSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeSectionLabel: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  timePlayheadBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  timePlayheadBtnText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '700',
  },
  timeBoxesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  timeBoxWrapper: {
    alignItems: 'center',
    width: 60,
  },
  timeBoxWrapperMs: {
    width: 74,
  },
  timeBoxInput: {
    width: '100%',
    backgroundColor: '#0f0f12',
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    borderRadius: 8,
    paddingVertical: 6,
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  timeBoxInputMs: {
    borderColor: 'rgba(245, 158, 11, 0.5)',
    color: '#fbbf24',
  },
  timeBoxSublabel: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 3,
    textTransform: 'uppercase',
  },
  timeColonSeparator: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  leftCueButtonsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  positionBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    borderRadius: 7,
  },
  posSectionContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  posHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  posHintText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.4)',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  posInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  posTextInput: {
    width: 64,
    height: 34,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    borderRadius: 6,
    color: '#ffffff',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '800',
    textAlign: 'center',
  },
  posPresetGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  posPresetBtn: {
    flex: 1,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posPresetBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderColor: '#38bdf8',
  },
  posPresetText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    fontWeight: '700',
  },
  posPresetTextActive: {
    color: '#38bdf8',
  },
  modalResetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalResetBtnText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: '600',
  },
  percentageInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  percentageTextInput: {
    width: 80,
    height: 36,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    borderRadius: 6,
    color: '#ffffff',
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '800',
    textAlign: 'center',
  },
  percentageUnitText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '700',
  },
  cropCoordinatesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cropCoordinateBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderRadius: 6,
    paddingHorizontal: 10,
    height: 36,
    gap: 8,
  },
  coordinatePrefixLabel: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '800',
  },
  coordinateInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '800',
    textAlign: 'center',
    padding: 0,
  },
  coordinateSuffixUnit: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  cropCoordinatesHint: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 11,
    marginTop: 4,
  },
  alignRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  alignRowLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  alignBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactAlignBtn: {
    width: 44,
    height: 32,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactAlignBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderColor: '#38bdf8',
  },
});
