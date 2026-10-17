import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  X,
  Subtitles,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Clock,
  Sparkles,
} from 'lucide-react-native';
import {
  SubtitleCue,
  DEFAULT_SUBTITLE_STYLE,
  fetchSubtitlesForVideo,
  sliceCuesForClip,
  loadClipSubtitle,
  saveClipSubtitle,
} from '../services/api';
import { ToastManager } from './Toast';

interface SubtitleEditModalProps {
  visible: boolean;
  onClose: () => void;
  videoId: string;
  clip: {
    id: string;
    start: number;
    end: number;
    rank?: number;
  };
  onSave?: (cues: SubtitleCue[]) => void;
  onSeekTo?: (timeSeconds: number) => void;
}

function formatCueTime(seconds: number): string {
  if (seconds === undefined || seconds === null || isNaN(seconds)) return '00:00.0';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  const pad = (num: number) => num.toString().padStart(2, '0');
  return `${pad(m)}:${pad(s)}.${ms}`;
}

export const SubtitleEditModal: React.FC<SubtitleEditModalProps> = ({
  visible,
  onClose,
  videoId,
  clip,
  onSave,
  onSeekTo,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [originalCues, setOriginalCues] = useState<SubtitleCue[]>([]);
  const [lang, setLang] = useState<string>('id');
  const [isAuto, setIsAuto] = useState<boolean>(false);

  const clipDuration = Math.max(0.1, clip.end - clip.start);

  const loadSubtitles = useCallback(async () => {
    if (!visible || !videoId || !clip.id) return;
    setLoading(true);

    try {
      // 1. Cek apakah sudah pernah disimpan khusus klip ini
      const saved = await loadClipSubtitle(videoId, clip.start, clip.end);
      if (saved && Array.isArray(saved.cues) && saved.cues.length > 0) {
        setCues(saved.cues);
        setOriginalCues(saved.cues);
        setLang(saved.lang || 'id');
        setIsAuto(Boolean(saved.isAuto));
        setLoading(false);
        return;
      }

      // 2. Jika belum ada file simpanan, fetch track YouTube utuh & potong (slice)
      const fullSubs = await fetchSubtitlesForVideo(videoId);
      const sliced = sliceCuesForClip(fullSubs.cues, clip.start, clip.end);
      setCues(sliced);
      setOriginalCues(sliced);
      setLang(fullSubs.lang || 'id');
      setIsAuto(fullSubs.isAuto);
    } catch (err: any) {
      console.warn('[SubtitleModal] Gagal memuat subtitle:', err);
      ToastManager.show({
        type: 'info',
        title: 'Subtitle Belum Tersedia',
        message: err.message || 'Tidak dapat memuat subtitle otomatis untuk video ini.',
        duration: 3500,
      });
      setCues([]);
      setOriginalCues([]);
    } finally {
      setLoading(false);
    }
  }, [visible, videoId, clip.id, clip.start, clip.end]);

  useEffect(() => {
    if (visible) {
      loadSubtitles();
    }
  }, [visible, loadSubtitles]);

  // Handler: Tambah Baris Subtitle Baru
  const handleAddCue = () => {
    const lastCue = cues[cues.length - 1];
    const newStart = lastCue ? Math.min(clipDuration, lastCue.end + 0.1) : 0;
    const newEnd = Math.min(clipDuration, newStart + 2.5);

    const newCue: SubtitleCue = {
      id: `cue_custom_${Date.now()}`,
      start: Math.round(newStart * 10) / 10,
      end: Math.round(newEnd * 10) / 10,
      rawStart: clip.start + newStart,
      rawEnd: clip.start + newEnd,
      text: '',
    };

    setCues([...cues, newCue]);
  };

  // Handler: Update Teks Cue
  const handleUpdateText = (index: number, text: string) => {
    const updated = [...cues];
    updated[index] = { ...updated[index], text };
    setCues(updated);
  };

  // Handler: Hapus Cue
  const handleDeleteCue = (index: number) => {
    const updated = cues.filter((_, idx) => idx !== index);
    setCues(updated);
  };

  // Handler: Geser Waktu (Start / End)
  const handleAdjustTime = (index: number, field: 'start' | 'end', delta: number) => {
    const updated = [...cues];
    const cue = { ...updated[index] };

    if (field === 'start') {
      const target = Math.max(0, Math.min(cue.end - 0.2, cue.start + delta));
      cue.start = Math.round(target * 10) / 10;
      cue.rawStart = clip.start + cue.start;
    } else {
      const target = Math.max(cue.start + 0.2, Math.min(clipDuration, cue.end + delta));
      cue.end = Math.round(target * 10) / 10;
      cue.rawEnd = clip.start + cue.end;
    }

    updated[index] = cue;
    setCues(updated);
  };

  // Handler: Reset ke Versi Asli YouTube
  const handleReset = () => {
    setCues([...originalCues]);
    ToastManager.show({
      type: 'info',
      title: 'Direset',
      message: 'Subtitle dikembalikan ke teks asli YouTube.',
      duration: 2000,
    });
  };

  // Handler: Simpan Subtitle
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const cleaned = cues
        .filter((c) => c.text.trim().length > 0)
        .sort((a, b) => a.start - b.start);

      await saveClipSubtitle({
        videoId,
        start: clip.start,
        end: clip.end,
        lang,
        isAuto,
        style: DEFAULT_SUBTITLE_STYLE,
        cues: cleaned,
        updatedAt: Date.now(),
      });

      onSave?.(cleaned);

      ToastManager.show({
        type: 'success',
        title: 'Subtitle Tersimpan',
        message: `${cleaned.length} baris subtitle tersimpan untuk klip ini.`,
        duration: 2500,
      });

      onClose();
    } catch (err: any) {
      console.warn('[SubtitleModal] Gagal menyimpan subtitle:', err);
      ToastManager.show({
        type: 'error',
        title: 'Gagal Menyimpan',
        message: err.message || 'Terjadi kesalahan saat menyimpan file subtitle.',
        duration: 3500,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Subtitles size={20} color="#38bdf8" />
              <Text style={styles.headerTitle}>
                Edit Subtitle Klip #{clip.rank || ''}
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
              onPress={onClose}
            >
              <X size={20} color="#94a3b8" />
            </Pressable>
          </View>

          {/* Sub-Header Metadata */}
          <View style={styles.metaRow}>
            <View style={styles.badgeGroup}>
              <View style={styles.badge}>
                <Clock size={12} color="#94a3b8" />
                <Text style={styles.badgeText}>
                  {formatCueTime(0)} - {formatCueTime(clipDuration)}
                </Text>
              </View>
              <View style={[styles.badge, styles.badgeActive]}>
                <Text style={styles.badgeActiveText}>{lang.toUpperCase()}</Text>
              </View>
              {isAuto && (
                <View style={styles.badge}>
                  <Sparkles size={11} color="#fbbf24" />
                  <Text style={[styles.badgeText, { color: '#fbbf24' }]}>Auto</Text>
                </View>
              )}
            </View>

            <Pressable
              style={({ pressed }) => [styles.resetBtn, pressed && { opacity: 0.7 }]}
              onPress={handleReset}
              disabled={loading}
            >
              <RotateCcw size={13} color="#94a3b8" />
              <Text style={styles.resetBtnText}>Reset Asli</Text>
            </Pressable>
          </View>

          {/* Body Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#38bdf8" />
              <Text style={styles.loadingText}>Mengambil caption dari YouTube...</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.cueList}
              contentContainerStyle={styles.cueListContent}
              keyboardShouldPersistTaps="handled"
            >
              {cues.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyTitle}>Belum Ada Subtitle</Text>
                  <Text style={styles.emptyDesc}>
                    Klip ini belum memiliki baris subtitle. Tekan tombol di bawah untuk menambahkan teks pembicara secara manual.
                  </Text>
                </View>
              ) : (
                cues.map((cue, idx) => (
                  <View key={cue.id || `cue_${idx}`} style={styles.cueCard}>
                    {/* Cue Header: Index, Time badge, Seek preview, Delete */}
                    <View style={styles.cueHeader}>
                      <View style={styles.cueIndexBadge}>
                        <Text style={styles.cueIndexText}>#{idx + 1}</Text>
                      </View>

                      {/* Time Controls */}
                      <View style={styles.timeControlGroup}>
                        <Pressable
                          style={styles.nudgeBtn}
                          onPress={() => handleAdjustTime(idx, 'start', -0.2)}
                        >
                          <Text style={styles.nudgeBtnText}>-</Text>
                        </Pressable>
                        <Pressable
                          style={styles.timeBadge}
                          onPress={() => onSeekTo?.(cue.start)}
                        >
                          <Text style={styles.timeBadgeText}>
                            {formatCueTime(cue.start)} - {formatCueTime(cue.end)}
                          </Text>
                        </Pressable>
                        <Pressable
                          style={styles.nudgeBtn}
                          onPress={() => handleAdjustTime(idx, 'end', 0.2)}
                        >
                          <Text style={styles.nudgeBtnText}>+</Text>
                        </Pressable>
                      </View>

                      <Pressable
                        style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.6 }]}
                        onPress={() => handleDeleteCue(idx)}
                      >
                        <Trash2 size={16} color="#f87171" />
                      </Pressable>
                    </View>

                    {/* Text Input */}
                    <TextInput
                      style={styles.cueTextInput}
                      value={cue.text}
                      onChangeText={(val) => handleUpdateText(idx, val)}
                      placeholder="Ketik teks subtitle di sini..."
                      placeholderTextColor="#64748b"
                      multiline
                    />
                  </View>
                ))
              )}

              {/* Tombol Tambah Baris */}
              <Pressable
                style={({ pressed }) => [styles.addCueBtn, pressed && { opacity: 0.75 }]}
                onPress={handleAddCue}
              >
                <Plus size={16} color="#38bdf8" />
                <Text style={styles.addCueBtnText}>Tambah Baris Subtitle</Text>
              </Pressable>
            </ScrollView>
          )}

          {/* Footer Actions */}
          <View style={styles.footer}>
            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
              onPress={onClose}
              disabled={isSaving}
            >
              <Text style={styles.cancelBtnText}>Batal</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.saveBtn,
                (loading || isSaving) && styles.saveBtnDisabled,
                pressed && { opacity: 0.8 },
              ]}
              onPress={handleSave}
              disabled={loading || isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Save size={16} color="#ffffff" />
                  <Text style={styles.saveBtnText}>Simpan Subtitle</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    maxHeight: '85%',
    minHeight: '55%',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#090d16',
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#1e293b',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
  badgeActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  badgeActiveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38bdf8',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  resetBtnText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  cueList: {
    flex: 1,
  },
  cueListContent: {
    padding: 16,
    gap: 12,
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  cueCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 8,
  },
  cueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cueIndexBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#0f172a',
  },
  cueIndexText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  timeControlGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeBadge: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  timeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38bdf8',
  },
  nudgeBtn: {
    backgroundColor: '#334155',
    width: 24,
    height: 24,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nudgeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
  },
  deleteBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  cueTextInput: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#f8fafc',
    fontSize: 14,
    lineHeight: 20,
    minHeight: 44,
  },
  addCueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 6,
  },
  addCueBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#38bdf8',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    backgroundColor: '#090d16',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0284c7',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
