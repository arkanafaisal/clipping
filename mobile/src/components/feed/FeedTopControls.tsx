import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {
  Trash2,
  CheckCircle2,
  Download,
  Subtitles,
} from 'lucide-react-native';
import { ClipItem } from '../../services/api';
import { formatTimeWithMs, formatDisplayTime } from './timeUtils';

export interface FeedTopControlsProps {
  activeClip: ClipItem;
  currentClipTime: number;
  isDownloaded: boolean;
  isDownloading: boolean;
  downloadProgressInfo?: { stage: string; code: string; percent: number };
  hasSubtitles: boolean;
  isSubtitleVisible: boolean;
  activeTimeEdit: 'start' | 'end' | null;
  tempTimeValue: string;
  getDownloadProgressLabel: (info?: { stage: string; code: string; percent: number }) => string;
  onToggleTrash: () => void;
  onToggleDone: () => void;
  onDownloadClip: () => void;
  onOpenSubtitleModal: () => void;
  onToggleSubtitleVisibility: () => void;
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
  activeTimeEdit,
  tempTimeValue,
  getDownloadProgressLabel,
  onToggleTrash,
  onToggleDone,
  onDownloadClip,
  onOpenSubtitleModal,
  onToggleSubtitleVisibility,
  onStartEditTime,
  onMsTimeChange,
  onBlurTimeEdit,
  onUpdateStart,
  onUpdateEnd,
}) => {
  return (
    <View style={styles.topSection}>
      <View style={styles.timeRangeRow}>
        {/* SISI KIRI: Jika Mode Done -> Tombol Unduh / Subtitle, Jika Mode Normal -> Tombol Trash */}
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
                /* Mode Sudah Terdownload: Tombol Download disembunyikan, diganti Tombol Subtitle */
                <View style={styles.subtitleGroup}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.statusBtn,
                      styles.subtitleBtn,
                      hasSubtitles && styles.subtitleBtnActive,
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={onOpenSubtitleModal}
                  >
                    <Subtitles size={18} color={hasSubtitles ? '#38bdf8' : '#94a3b8'} />
                  </Pressable>

                  {/* Tombol Toggle CC Overlay (jika subtitle sudah tersedia) */}
                  {hasSubtitles && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.statusBtn,
                        styles.subtitleToggleBtn,
                        isSubtitleVisible && styles.subtitleToggleBtnActive,
                        pressed && { opacity: 0.7 },
                      ]}
                      onPress={onToggleSubtitleVisibility}
                    >
                      <Text
                        style={[
                          styles.subtitleBtnText,
                          isSubtitleVisible && { color: '#38bdf8' },
                        ]}
                      >
                        CC
                      </Text>
                    </Pressable>
                  )}
                </View>
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

        {/* SISI KANAN: Tombol Done (Tetap ada, jika diklik mengembalikan mode ke normal) */}
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
      {activeClip.status !== 'done' && (
        <>
          {/* Row 2: Extend Row (Emerald) */}
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

          {/* Row 3: Crop Row (Rose/Red) */}
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
  subtitleGroup: {
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
  subtitleBtn: {
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  subtitleBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: 'rgba(56, 189, 248, 0.4)',
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
  subtitleBtnText: {
    color: '#ffffff',
    fontSize: 11,
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
});
