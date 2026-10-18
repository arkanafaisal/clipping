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
} from 'react-native';
import {
  Trash2,
  CheckCircle2,
  Download,
  Subtitles,
  Plus,
  X,
  Type,
  Check,
  Globe,
  Clock,
} from 'lucide-react-native';
import { ClipItem, SubtitleCue } from '../../services/api';
import { formatTimeWithMs, formatDisplayTime } from './timeUtils';

interface SubtitleCuePillProps {
  cue: SubtitleCue;
  index: number;
  clipDuration: number;
  trackWidth: number;
  isSelected: boolean;
}

const SubtitleCuePill: React.FC<SubtitleCuePillProps> = React.memo(
  ({ cue, index, clipDuration, trackWidth, isSelected }) => {
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
          isSelected && (isEven ? styles.cuePillEvenSelected : styles.cuePillOddSelected),
        ]}
      />
    );
  }
);

export interface FeedTopControlsProps {
  activeClip: ClipItem;
  currentClipTime: number;
  isDownloaded: boolean;
  isDownloading: boolean;
  downloadProgressInfo?: { stage: string; code: string; percent: number };
  hasSubtitles: boolean;
  isSubtitleVisible: boolean;
  subtitles: SubtitleCue[];
  selectedCueId: string | null;
  isFetchingSubtitles: boolean;
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

export const FeedTopControls: React.FC<FeedTopControlsProps> = ({
  activeClip,
  currentClipTime,
  isDownloaded,
  isDownloading,
  downloadProgressInfo,
  hasSubtitles,
  isSubtitleVisible,
  subtitles,
  selectedCueId,
  isFetchingSubtitles,
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
  const [startMin, setStartMin] = useState<string>('00');
  const [startSec, setStartSec] = useState<string>('00');
  const [startMs, setStartMs] = useState<string>('000');
  const [endMin, setEndMin] = useState<string>('00');
  const [endSec, setEndSec] = useState<string>('00');
  const [endMs, setEndMs] = useState<string>('000');

  const clipDuration = Math.max(0.1, activeClip.end - activeClip.start);

  const trackWidthRef = useRef<number>(0);
  const clipDurationRef = useRef<number>(0);
  const onSeekRef = useRef(onSeek);
  const startTouchX = useRef<number>(0);
  const manuallyDismissedCueIdRef = useRef<string | null>(null);

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

  // Cue yang saat ini berada tepat di bawah posisi playhead needle
  const currentMatchingCue = useMemo(() => {
    if (subtitles.length === 0 || clipDuration <= 0) return null;
    return (
      subtitles.find(
        (cue) => currentClipTime >= cue.start && currentClipTime <= cue.end
      ) || null
    );
  }, [subtitles, currentClipTime, clipDuration]);

  // Sinkronisasi dinamis: pilih subtitle yang tersentuh needle (baik saat playback maupun saat di-scrub)
  useEffect(() => {
    if (showTextModal || showFontModal || showTimeModal || showLangModal) {
      return;
    }

    const matchedId = currentMatchingCue ? currentMatchingCue.id : null;

    if (matchedId !== manuallyDismissedCueIdRef.current) {
      manuallyDismissedCueIdRef.current = null;
    }

    if (manuallyDismissedCueIdRef.current === null && matchedId !== selectedCueId) {
      onSelectCue(matchedId);
    }
  }, [
    currentMatchingCue,
    selectedCueId,
    onSelectCue,
    showTextModal,
    showFontModal,
    showTimeModal,
    showLangModal,
  ]);

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
    const cur = Math.max(0, Math.min(clipDuration, currentClipTime));
    const m = Math.floor(cur / 60);
    const s = Math.floor(cur % 60);
    const ms = Math.round((cur - Math.floor(cur)) * 1000);
    setStartMin(String(m).padStart(2, '0'));
    setStartSec(String(s).padStart(2, '0'));
    setStartMs(String(ms).padStart(3, '0').slice(0, 3));
  };

  const setEndToPlayhead = () => {
    const cur = Math.max(0, Math.min(clipDuration, currentClipTime));
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
        {/* SISI KIRI: Mode Done -> Download / Get Subtitle, Mode Normal -> Trash */}
        <View style={styles.leftActionGroup}>
          {activeClip.status === 'done' ? (
            <View style={styles.doneLeftGroup}>
              {/* Tombol Unduh (jika belum terunduh) */}
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

              {/* Tombol Get Subtitle di kiri atas: HANYA muncul saat track kosong (subtitles.length === 0) */}
              {subtitles.length === 0 && (
                <Pressable
                  style={({ pressed }) => [
                    styles.statusBtn,
                    styles.getSubtitleBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => setShowLangModal(true)}
                  disabled={isFetchingSubtitles}
                >
                  {isFetchingSubtitles ? (
                    <ActivityIndicator size="small" color="#38bdf8" />
                  ) : (
                    <Subtitles size={18} color="#38bdf8" />
                  )}
                </Pressable>
              )}
            </View>
          ) : (
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
          )}
        </View>

        {/* SISI TENGAH: Jika Mode Done -> Durasi realtime presisi ms, Jika Normal -> Rentang Waktu & Edit MS */}
        <View style={styles.centerTimeWrapper} pointerEvents="box-none">
          {activeClip.status === 'done' ? (
            <View style={styles.timeDisplay}>
              <Text style={[styles.timeNumberText, styles.timeMsText]}>
                {formatTimeWithMs(currentClipTime)}
              </Text>
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

        {/* SISI KANAN: Tombol Done */}
        <View style={styles.rightActionGroup}>
          <Pressable
            style={({ pressed }) => [
              styles.statusBtn,
              activeClip.status === 'done' ? styles.doneBtnActive : styles.doneBtnInactive,
              pressed && { opacity: 0.7 },
            ]}
            onPressIn={onToggleDone}
          >
            <CheckCircle2
              size={18}
              color={activeClip.status === 'done' ? '#ffffff' : '#34d399'}
            />
          </Pressable>
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
      ) : (
        /* MODE DONE: Subtitle Mini Track & Inline Editor Layer */
        <View style={styles.subtitleLayerSection}>
          {/* 1. HORIZONTAL MINI TRACK (100% width, tap/drag to scrub pointer & select cue) */}
          <View
            style={styles.miniTrackWrapper}
            onLayout={(e) => setTrackLayoutWidth(e.nativeEvent.layout.width)}
            {...trackPanResponder.panHandlers}
          >
            <View style={styles.miniTrackBackground} pointerEvents="none">
              {/* Needle Playhead (Merah kontras seperti scrubber bawah) */}
              <View
                style={[
                  styles.playheadNeedle,
                  {
                    left:
                      clipDuration > 0
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
              </View>

              {/* Subtitle Cue Pills (Visual timeline blocks) */}
              {subtitles.map((cue, index) => (
                <SubtitleCuePill
                  key={cue.id}
                  cue={cue}
                  index={index}
                  clipDuration={clipDuration}
                  trackWidth={trackLayoutWidth}
                  isSelected={selectedCueId === cue.id}
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
            {/* SISI KIRI: Tombol Tambah Manual */}
            <Pressable
              style={({ pressed }) => [styles.addCueBtn, pressed && { opacity: 0.7 }]}
              onPress={() => onAddCue(currentClipTime)}
            >
              <Plus size={14} color="#38bdf8" />
              <Text style={styles.addCueBtnText}>+ Subtitle</Text>
            </Pressable>

            {/* SISI KANAN (Dekat jempol): Tombol Icon Edit Teks, Ukuran Font, Hapus */}
            {selectedCue ? (
              <View style={styles.cueEditorActionIcons}>
                {/* 1. Edit Teks (Buka Modal Multiline) */}
                <Pressable
                  style={({ pressed }) => [styles.iconActionBtn, pressed && { opacity: 0.6 }]}
                  onPress={() => {
                    setTempEditText(selectedCue.text || '');
                    setShowTextModal(true);
                  }}
                  hitSlop={6}
                >
                  <Type size={16} color="#38bdf8" />
                </Pressable>

                {/* 2. Ukuran Font (Buka Modal Font Size) */}
                <Pressable
                  style={({ pressed }) => [styles.iconActionBtn, pressed && { opacity: 0.6 }]}
                  onPress={() => {
                    setTempEditSize(String(selectedCue.fontSize || 14));
                    setShowFontModal(true);
                  }}
                  hitSlop={6}
                >
                  <Text style={styles.fontSizeIconText}>Aa</Text>
                </Pressable>

                {/* 3. Rentang Waktu (Buka Modal Time Range 6-box: Menit, Detik, Milidetik) */}
                <Pressable
                  style={({ pressed }) => [styles.iconActionBtn, pressed && { opacity: 0.6 }]}
                  onPress={openTimeModal}
                  hitSlop={6}
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
                  onPress={() => onDeleteCue(selectedCue.id)}
                  hitSlop={6}
                >
                  <Trash2 size={16} color="#f87171" />
                </Pressable>

                {/* 5. Deselect / Close */}
                <Pressable
                  style={({ pressed }) => [styles.iconActionBtn, pressed && { opacity: 0.6 }]}
                  onPress={() => {
                    manuallyDismissedCueIdRef.current = selectedCueId;
                    onSelectCue(null);
                  }}
                  hitSlop={6}
                >
                  <X size={16} color="#94a3b8" />
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      )}

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
                <Check size={16} color="#ffffff" />
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
                    onUpdateCue(selectedCue.id, { fontSize: parsed });
                  }
                  setShowFontModal(false);
                }}
              >
                <Check size={16} color="#ffffff" />
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
                <Check size={16} color="#ffffff" />
                <Text style={styles.modalSaveBtnText}>Simpan</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

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
    zIndex: 10,
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
  getSubtitleBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
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
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#121212',
    gap: 6,
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
    borderWidth: 1,
  },
  cuePillEven: {
    backgroundColor: 'rgba(14, 165, 233, 0.75)',
    borderColor: 'rgba(56, 189, 248, 0.9)',
  },
  cuePillOdd: {
    backgroundColor: 'rgba(245, 158, 11, 0.75)',
    borderColor: 'rgba(251, 191, 36, 0.9)',
  },
  cuePillEvenSelected: {
    backgroundColor: '#38bdf8',
    borderColor: '#ffffff',
    borderWidth: 2,
    zIndex: 10,
  },
  cuePillOddSelected: {
    backgroundColor: '#fbbf24',
    borderColor: '#ffffff',
    borderWidth: 2,
    zIndex: 10,
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderRadius: 6,
    paddingHorizontal: 10,
    height: 30,
    gap: 4,
  },
  addCueBtnText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
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
});
