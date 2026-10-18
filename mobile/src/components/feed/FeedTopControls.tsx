import React, { useState, useRef, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
  PanResponder,
} from 'react-native';
import {
  Trash2,
  CheckCircle2,
  Download,
  Subtitles,
  Plus,
  Minus,
  X,
} from 'lucide-react-native';
import { ClipItem, SubtitleCue } from '../../services/api';
import { formatTimeWithMs, formatDisplayTime } from './timeUtils';

interface SubtitleCuePillProps {
  cue: SubtitleCue;
  clipDuration: number;
  trackWidth: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onShiftTime: (id: string, newStart: number) => void;
}

const SubtitleCuePill: React.FC<SubtitleCuePillProps> = React.memo(
  ({ cue, clipDuration, trackWidth, isSelected, onSelect, onShiftTime }) => {
    const isDraggingRef = useRef(false);
    const dragStartSecRef = useRef(cue.start);

    const panResponder = useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 3,
          onPanResponderGrant: () => {
            isDraggingRef.current = false;
            dragStartSecRef.current = cue.start;
          },
          onPanResponderMove: (_, gesture) => {
            if (trackWidth <= 0 || clipDuration <= 0) return;
            if (Math.abs(gesture.dx) > 3) {
              isDraggingRef.current = true;
            }
            const deltaSec = (gesture.dx / trackWidth) * clipDuration;
            const cueDur = Math.max(0.4, cue.end - cue.start);
            const maxStart = Math.max(0, clipDuration - cueDur);
            const targetStart = Math.max(0, Math.min(maxStart, dragStartSecRef.current + deltaSec));
            onShiftTime(cue.id, Math.round(targetStart * 100) / 100);
          },
          onPanResponderRelease: () => {
            if (!isDraggingRef.current) {
              onSelect(cue.id);
            }
            isDraggingRef.current = false;
          },
          onPanResponderTerminate: () => {
            isDraggingRef.current = false;
          },
        }),
      [cue.id, cue.start, cue.end, clipDuration, trackWidth, onSelect, onShiftTime]
    );

    const startPct = clipDuration > 0 ? Math.max(0, Math.min(1, cue.start / clipDuration)) : 0;
    const endPct = clipDuration > 0 ? Math.max(0, Math.min(1, cue.end / clipDuration)) : 1;
    const leftPos = startPct * trackWidth;
    const pillWidth = Math.max(22, (endPct - startPct) * trackWidth);

    return (
      <View
        {...panResponder.panHandlers}
        style={[
          styles.cuePill,
          {
            left: leftPos,
            width: pillWidth,
          },
          isSelected && styles.cuePillSelected,
        ]}
      >
        <Text numberOfLines={1} ellipsizeMode="tail" style={styles.cuePillText}>
          {cue.text || '...'}
        </Text>
      </View>
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
  const clipDuration = Math.max(0.1, activeClip.end - activeClip.start);

  const selectedCue = useMemo(
    () => subtitles.find((c) => c.id === selectedCueId) || null,
    [subtitles, selectedCueId]
  );

  return (
    <View style={styles.topSection}>
      <View style={styles.timeRangeRow}>
        {/* SISI KIRI: Jika Mode Done -> Tombol Unduh / Subtitle Toggle, Jika Mode Normal -> Tombol Trash */}
        <View style={styles.leftActionGroup}>
          {activeClip.status === 'done' ? (
            <>
              {!isDownloaded ? (
                /* Mode Belum Terdownload: Tampilkan Tombol Download */
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
              ) : (
                /* Mode Sudah Terdownload: Tombol Toggle Subtitle Overlay (CC) */
                <Pressable
                  style={({ pressed }) => [
                    styles.statusBtn,
                    styles.subtitleToggleBtn,
                    isSubtitleVisible && styles.subtitleToggleBtnActive,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={onToggleSubtitleVisibility}
                >
                  <Subtitles size={17} color={isSubtitleVisible ? '#38bdf8' : '#64748b'} />
                </Pressable>
              )}
            </>
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
          {/* 1. HORIZONTAL MINI TRACK (100% width) */}
          <View
            style={styles.miniTrackWrapper}
            onLayout={(e) => setTrackLayoutWidth(e.nativeEvent.layout.width)}
          >
            <Pressable
              style={styles.miniTrackBackground}
              onPress={(e) => {
                if (trackLayoutWidth <= 0 || clipDuration <= 0) return;
                const clickX = e.nativeEvent.locationX;
                const relSec = Math.max(0, Math.min(clipDuration, (clickX / trackLayoutWidth) * clipDuration));
                onSeek(relSec);
                onSelectCue(null);
              }}
            >
              {/* Needle Playhead */}
              <View
                style={[
                  styles.playheadNeedle,
                  {
                    left:
                      clipDuration > 0
                        ? Math.max(
                            0,
                            Math.min(
                              trackLayoutWidth - 2,
                              (currentClipTime / clipDuration) * trackLayoutWidth
                            )
                          )
                        : 0,
                  },
                ]}
                pointerEvents="none"
              />

              {/* Subtitle Cue Pills */}
              {subtitles.map((cue) => (
                <SubtitleCuePill
                  key={cue.id}
                  cue={cue}
                  clipDuration={clipDuration}
                  trackWidth={trackLayoutWidth}
                  isSelected={selectedCueId === cue.id}
                  onSelect={(id) => {
                    onSelectCue(id);
                    onSeek(cue.start);
                  }}
                  onShiftTime={onShiftCueTime}
                />
              ))}

              {subtitles.length === 0 && (
                <View style={styles.emptyTrackHint} pointerEvents="none">
                  <Text style={styles.emptyTrackText}>Belum ada subtitle track</Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* 2. ACTION / INLINE EDITOR ROW */}
          {selectedCue ? (
            /* Cue Editor Row */
            <View style={styles.cueEditorRow}>
              <TextInput
                style={styles.cueTextInput}
                value={selectedCue.text}
                onChangeText={(text) => onUpdateCue(selectedCue.id, { text })}
                placeholder="Teks subtitle..."
                placeholderTextColor="rgba(255, 255, 255, 0.35)"
                multiline={false}
              />

              {/* Font Size Adjuster */}
              <View style={styles.fontSizeControlGroup}>
                <Pressable
                  style={({ pressed }) => [styles.fontBtn, pressed && { opacity: 0.6 }]}
                  onPress={() =>
                    onUpdateCue(selectedCue.id, {
                      fontSize: Math.max(12, (selectedCue.fontSize || 20) - 2),
                    })
                  }
                  hitSlop={4}
                >
                  <Minus size={12} color="#94a3b8" />
                </Pressable>
                <Text style={styles.fontSizeText}>{selectedCue.fontSize || 20}</Text>
                <Pressable
                  style={({ pressed }) => [styles.fontBtn, pressed && { opacity: 0.6 }]}
                  onPress={() =>
                    onUpdateCue(selectedCue.id, {
                      fontSize: Math.min(36, (selectedCue.fontSize || 20) + 2),
                    })
                  }
                  hitSlop={4}
                >
                  <Plus size={12} color="#94a3b8" />
                </Pressable>
              </View>

              {/* Delete Cue Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.cueActionBtn,
                  styles.cueDeleteBtn,
                  pressed && { opacity: 0.6 },
                ]}
                onPress={() => onDeleteCue(selectedCue.id)}
                hitSlop={4}
              >
                <Trash2 size={15} color="#f87171" />
              </Pressable>

              {/* Deselect / Close Button */}
              <Pressable
                style={({ pressed }) => [styles.cueActionBtn, pressed && { opacity: 0.6 }]}
                onPress={() => onSelectCue(null)}
                hitSlop={4}
              >
                <X size={15} color="#94a3b8" />
              </Pressable>
            </View>
          ) : (
            /* Default Actions Row: Add Cue & Quick YT Sub Fetch */
            <View style={styles.cueActionsRow}>
              <Pressable
                style={({ pressed }) => [styles.addCueBtn, pressed && { opacity: 0.7 }]}
                onPress={() => onAddCue(currentClipTime)}
              >
                <Plus size={14} color="#38bdf8" />
                <Text style={styles.addCueBtnText}>+ Subtitle</Text>
              </Pressable>

              <View style={styles.langFetchGroup}>
                <Text style={styles.langFetchLabel}>YT Sub:</Text>
                <Pressable
                  style={({ pressed }) => [styles.langPill, pressed && { opacity: 0.6 }]}
                  onPress={() => onFetchSubtitles('id')}
                  disabled={isFetchingSubtitles}
                >
                  <Text style={styles.langPillText}>ID</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.langPill, pressed && { opacity: 0.6 }]}
                  onPress={() => onFetchSubtitles('en')}
                  disabled={isFetchingSubtitles}
                >
                  <Text style={styles.langPillText}>EN</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.langPill, pressed && { opacity: 0.6 }]}
                  onPress={() => onFetchSubtitles('ja')}
                  disabled={isFetchingSubtitles}
                >
                  <Text style={styles.langPillText}>JA</Text>
                </Pressable>
                {isFetchingSubtitles && (
                  <ActivityIndicator size="small" color="#38bdf8" style={styles.langFetchSpinner} />
                )}
              </View>
            </View>
          )}
        </View>
      )}
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
  subtitleToggleBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  subtitleToggleBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderColor: '#38bdf8',
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
    width: 2,
    backgroundColor: '#ffffff',
    zIndex: 10,
  },
  cuePill: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    backgroundColor: 'rgba(56, 189, 248, 0.22)',
    borderColor: 'rgba(56, 189, 248, 0.6)',
    borderWidth: 1,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    overflow: 'hidden',
  },
  cuePillSelected: {
    backgroundColor: 'rgba(56, 189, 248, 0.65)',
    borderColor: '#ffffff',
    borderWidth: 1.5,
    zIndex: 5,
  },
  cuePillText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: -0.2,
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
  cueEditorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
    gap: 6,
  },
  cueTextInput: {
    flex: 1,
    height: 32,
    backgroundColor: '#1c1c20',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    color: '#ffffff',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 0,
  },
  fontSizeControlGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c20',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    height: 32,
    paddingHorizontal: 4,
    gap: 4,
  },
  fontBtn: {
    width: 20,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 4,
  },
  fontSizeText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
    minWidth: 16,
    textAlign: 'center',
  },
  cueActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#1c1c20',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cueDeleteBtn: {
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderColor: 'rgba(248, 113, 113, 0.25)',
  },
  cueActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 34,
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
  langFetchGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  langFetchLabel: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 11,
    fontWeight: '500',
  },
  langPill: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  langPillText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700',
  },
  langFetchSpinner: {
    marginLeft: 2,
  },
});
