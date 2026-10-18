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
          {cue.text.replace(/\r?\n+/g, ' ') || '...'}
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
  const [showLangModal, setShowLangModal] = useState<boolean>(false);
  const [showTextModal, setShowTextModal] = useState<boolean>(false);
  const [showFontModal, setShowFontModal] = useState<boolean>(false);
  const [tempEditText, setTempEditText] = useState<string>('');
  const [tempEditSize, setTempEditSize] = useState<string>('20');

  const clipDuration = Math.max(0.1, activeClip.end - activeClip.start);

  const selectedCue = useMemo(
    () => subtitles.find((c) => c.id === selectedCueId) || null,
    [subtitles, selectedCueId]
  );

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
                    setTempEditSize(String(selectedCue.fontSize || 20));
                    setShowFontModal(true);
                  }}
                  hitSlop={6}
                >
                  <Text style={styles.fontSizeIconText}>Aa</Text>
                </Pressable>

                {/* 3. Hapus Cue (Langsung hapus tanpa modal konfirmasi) */}
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

                {/* 4. Deselect / Close */}
                <Pressable
                  style={({ pressed }) => [styles.iconActionBtn, pressed && { opacity: 0.6 }]}
                  onPress={() => onSelectCue(null)}
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
                placeholder="20"
                placeholderTextColor="rgba(255, 255, 255, 0.35)"
                autoFocus
                selectTextOnFocus
              />
              <Text style={styles.fontSizeUnitText}>px</Text>
            </View>

            {/* Preset buttons */}
            <View style={styles.fontSizePresetGroup}>
              {['14', '16', '18', '20', '22', '24', '28'].map((preset) => (
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
});
