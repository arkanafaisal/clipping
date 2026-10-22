import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { Settings, Download } from 'lucide-react-native';
import { WorkshopCard, WorkshopItem } from './WorkshopCard';
import { WorkshopInputForm } from './WorkshopInputForm';
import { ImportWorkshopModal } from './ImportWorkshopModal';
import { ExportWorkshopModal } from './ExportWorkshopModal';
import { SettingsModal } from './SettingsModal';
import { PlayModeModal } from './PlayModeModal';
import { LocalStorage } from '../services/storage';
import { ToastManager } from './Toast';
import {
  fetchHeatmap,
  fetchStreamUrl,
  checkFullVideoExists,
  downloadFullVideo,
} from '../services/api';

const WORKSHOPS_STORAGE_KEY = 'workshops_list';
const BOT_NUMBER = '6285742923730';

function formatTimeWithMs(seconds: number): string {
  if (seconds === undefined || seconds === null || isNaN(seconds)) return '00:00:00.00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  const pad = (num: number, len = 2) => num.toString().padStart(len, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 2)}`;
}

interface DashboardProps {
  onOpenWorkshop?: (videoId: string, count: number, playMode?: 'local' | 'stream') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onOpenWorkshop }) => {
  const [workshops, setWorkshops] = useState<WorkshopItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportDataJson, setExportDataJson] = useState('');
  const [exportWorkshopTitle, setExportWorkshopTitle] = useState('');
  const [exportVideoId, setExportVideoId] = useState('');
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [playModeTarget, setPlayModeTarget] = useState<{ videoId: string; count: number } | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [fullVideoStatus, setFullVideoStatus] = useState<
    Record<string, { exists: boolean; isDownloading: boolean; percent: number }>
  >({});

  // Load workshops & attach current doneCount from drafts
  const loadSavedWorkshops = useCallback(async () => {
    try {
      const saved = await LocalStorage.getItem(WORKSHOPS_STORAGE_KEY);
      if (saved) {
        const parsed: WorkshopItem[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Sync doneCount for each item
          const synced = await Promise.all(
            parsed.map(async (ws) => {
              try {
                const draftStr = await LocalStorage.getItem(`clips_draft_${ws.videoId}`);
                if (draftStr) {
                  const clips = JSON.parse(draftStr);
                  const done = Array.isArray(clips)
                    ? clips.filter((c: any) => c.status === 'done').length
                    : 0;
                  return { ...ws, doneCount: done };
                }
              } catch (e) {}
              return ws;
            })
          );
          synced.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
          setWorkshops(synced);

          // Cek keberadaan file fisik full video untuk setiap workshop
          const statusMap: Record<string, { exists: boolean; isDownloading: boolean; percent: number }> = {};
          await Promise.all(
            synced.map(async (ws) => {
              const exists = await checkFullVideoExists(ws.videoId);
              statusMap[ws.videoId] = { exists, isDownloading: false, percent: 0 };
            })
          );
          setFullVideoStatus((prev) => ({ ...prev, ...statusMap }));
        }
      }
    } catch (e) {
      console.warn('[Dashboard] Failed to load workshops:', e);
    }
  }, []);

  useEffect(() => {
    loadSavedWorkshops();
  }, [loadSavedWorkshops]);

  // Helper extracting 11-char YouTube ID
  const extractVideoId = (url: string): string | null => {
    const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regExp);
    if (match && match[1].length === 11) return match[1];
    if (url.trim().length === 11) return url.trim();
    return null;
  };

  const saveWorkshops = async (newList: WorkshopItem[]) => {
    setWorkshops(newList);
    await LocalStorage.setItem(WORKSHOPS_STORAGE_KEY, JSON.stringify(newList));
  };

  const handleCreateWorkshop = async (url: string, count: number) => {
    setErrorMessage(null);
    if (!url) {
      setErrorMessage('Masukkan link YouTube terlebih dahulu.');
      return;
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      setErrorMessage('Format Link YouTube tidak valid.');
      return;
    }

    setIsExtracting(true);

    try {
      // 1. Ekstrak heatmap 100 klip penuh
      const data = await fetchHeatmap(videoId, 100, 0);
      if (!data.clips || data.clips.length === 0) {
        throw new Error('Heatmap tidak mengembalikan segmen klip.');
      }

      const formattedClips = data.clips.map((c, idx) => ({
        ...c,
        status: 'none' as const,
        rank: c.rank || idx + 1,
      }));
      const videoTitle = data.title || `YouTube Video (${videoId})`;
      await LocalStorage.setItem(`clips_draft_${videoId}`, JSON.stringify(formattedClips));
      await LocalStorage.setItem(`clipping_full_fetched_${videoId}`, 'true');

      // 2. Ambil direct stream URL
      await fetchStreamUrl(videoId);

      // 3. Simpan workshop ke daftar
      const existingIndex = workshops.findIndex((w) => w.videoId === videoId);
      let updatedList: WorkshopItem[];

      if (existingIndex >= 0) {
        updatedList = [...workshops];
        updatedList[existingIndex].title = videoTitle;
        updatedList[existingIndex].count = count;
        updatedList[existingIndex].lastUpdated = Date.now();
      } else {
        const newWorkshop: WorkshopItem = {
          videoId,
          title: videoTitle,
          count,
          doneCount: 0,
          lastUpdated: Date.now(),
        };
        updatedList = [newWorkshop, ...workshops];
      }

      await saveWorkshops(updatedList);
      setIsExtracting(false);

      // 4. Masuk ke FeedScreen setelah data berhasil diperoleh
      onOpenWorkshop?.(videoId, count);
    } catch (err: any) {
      setIsExtracting(false);
      ToastManager.show({
        type: 'error',
        title: 'Gagal Membuat Workshop',
        rawError: err.rawError || err.stack || err.message,
        errorCode: err.code || 'WORKSHOP_ERROR',
        duration: 6000,
      });
    }
  };

  const handleOpenExisting = async (videoId: string, count: number, playMode: 'local' | 'stream' = 'local') => {
    try {
      // 1. Cek apakah draft sudah ada, jika belum fetch heatmap
      let savedDraft = await LocalStorage.getItem(`clips_draft_${videoId}`);
      let hasValidClips = false;

      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          if (Array.isArray(parsed) && parsed.length > 0) {
            hasValidClips = true;
          }
        } catch (e) {}
      }

      if (!hasValidClips) {
        const data = await fetchHeatmap(videoId, 100, 0);
        if (!data.clips || data.clips.length === 0) {
          throw new Error('Heatmap tidak mengembalikan klip.');
        }

        const formattedClips = data.clips.map((c, idx) => ({
          ...c,
          status: 'none' as const,
          rank: c.rank || idx + 1,
        }));

        await LocalStorage.setItem(`clips_draft_${videoId}`, JSON.stringify(formattedClips));
        await LocalStorage.setItem(`clipping_full_fetched_${videoId}`, 'true');
      }

      // 2. Ambil direct stream URL jika memilih mode stream online
      if (playMode === 'stream') {
        await fetchStreamUrl(videoId);
      }

      // 3. Update lastUpdated
      const existingIndex = workshops.findIndex((w) => w.videoId === videoId);
      if (existingIndex >= 0) {
        const updated = [...workshops];
        updated[existingIndex].lastUpdated = Date.now();
        await saveWorkshops(updated);
      }

      // 4. Masuk ke FeedScreen setelah respons berhasil
      setPlayModeTarget(null);
      onOpenWorkshop?.(videoId, count, playMode);
    } catch (err: any) {
      setPlayModeTarget(null);
      ToastManager.show({
        type: 'error',
        title: 'Gagal Membuka Workshop',
        rawError: err.rawError || err.stack || err.message,
        errorCode: err.code,
        duration: 5000,
      });
    }
  };

  const handleCardPress = async (videoId: string, count: number) => {
    const hasFull = Boolean(fullVideoStatus[videoId]?.exists) || (await checkFullVideoExists(videoId));
    if (hasFull) {
      setPlayModeTarget({ videoId, count });
    } else {
      handleOpenExisting(videoId, count, 'stream');
    }
  };

  const handleDownloadFullVideo = async (videoId: string) => {
    if (fullVideoStatus[videoId]?.isDownloading) return;
    setFullVideoStatus((prev) => ({
      ...prev,
      [videoId]: { exists: false, isDownloading: true, percent: 0 },
    }));

    try {
      await downloadFullVideo(videoId, (info) => {
        setFullVideoStatus((prev) => ({
          ...prev,
          [videoId]: {
            ...prev[videoId],
            percent: info.percent || 0,
            isDownloading: true,
          },
        }));
      });

      setFullVideoStatus((prev) => ({
        ...prev,
        [videoId]: { exists: true, isDownloading: false, percent: 100 },
      }));

      ToastManager.show({
        type: 'success',
        title: 'Unduh Full Video Berhasil',
        duration: 3500,
      });
    } catch (err: any) {
      setFullVideoStatus((prev) => ({
        ...prev,
        [videoId]: { exists: false, isDownloading: false, percent: 0 },
      }));
      ToastManager.show({
        type: 'error',
        title: 'Unduh Full Video Gagal',
        rawError: err.rawError || err.stack || err.message,
        errorCode: err.code || 'DOWNLOAD_FAILED',
        duration: 6000,
      });
    }
  };

  const handleDeleteWorkshop = (videoId: string) => {
    Alert.alert('Hapus Draft', 'Yakin ingin menghapus draf workshop ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          const filtered = workshops.filter((w) => w.videoId !== videoId);
          await saveWorkshops(filtered);
          await LocalStorage.removeItem(`clips_draft_${videoId}`);
          ToastManager.show({
            type: 'info',
            title: 'Draft Dihapus',
            duration: 2000,
          });
        },
      },
    ]);
  };

  // Kirim semua klip yang Done (Hijau) ke WhatsApp Bot
  const handleBulkWA = async (videoId: string) => {
    const stored = await LocalStorage.getItem(`clips_draft_${videoId}`);
    if (!stored) {
      ToastManager.show({
        type: 'info',
        title: 'Draft Klip Kosong',
        duration: 2000,
      });
      return;
    }

    try {
      const clips = JSON.parse(stored);
      const doneClips = clips
        .filter((c: any) => c.status === 'done')
        .sort((a: any, b: any) => a.start - b.start);

      if (doneClips.length === 0) {
        ToastManager.show({
          type: 'info',
          title: 'Belum Ada Klip Selesai',
          duration: 2500,
        });
        return;
      }

      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      let command = `!download ${videoUrl}\n`;

      doneClips.forEach((c: any) => {
        command += `${formatTimeWithMs(c.start)} - ${formatTimeWithMs(c.end)}\n`;
      });

      const encodedCommand = encodeURIComponent(command.trim());
      const waUrl = `https://wa.me/${BOT_NUMBER}?text=${encodedCommand}`;

      const supported = await Linking.canOpenURL(waUrl);
      if (supported) {
        await Linking.openURL(waUrl);
      } else {
        // Fallback open via browser
        await Linking.openURL(`https://api.whatsapp.com/send?phone=${BOT_NUMBER}&text=${encodedCommand}`);
      }
    } catch (err: any) {
      console.error(err);
      ToastManager.show({
        type: 'error',
        title: 'Gagal Kirim WhatsApp',
        rawError: err?.stack || err?.message,
        duration: 4000,
      });
    }
  };

  // Ekspor full data workshop (100 klip heatmap + klip custom) dalam format JSON
  const handleExportWorkshop = async (videoId: string) => {
    try {
      const ws = workshops.find((w) => w.videoId === videoId);
      const draftStr = await LocalStorage.getItem(`clips_draft_${videoId}`);
      let draftClips = [];
      if (draftStr) {
        try {
          draftClips = JSON.parse(draftStr);
        } catch {}
      }

      const exportPayload = {
        version: 1,
        exportedAt: Date.now(),
        workshop: ws || { videoId, count: 50, lastUpdated: Date.now() },
        draft: draftClips,
      };

      setExportDataJson(JSON.stringify(exportPayload, null, 2));
      setExportWorkshopTitle(ws?.title || `Workshop ${videoId}`);
      setExportVideoId(videoId);
      setExportModalVisible(true);
    } catch (err: any) {
      ToastManager.show({
        type: 'error',
        title: 'Gagal Menyiapkan Ekspor',
        rawError: err?.message || String(err),
        duration: 3000,
      });
    }
  };

  const handleImportJSON = async (jsonText: string) => {
    try {
      const parsed = JSON.parse(jsonText);
      const wsData = parsed.workshop || parsed;
      if (!wsData.videoId) {
        throw new Error('Data JSON workshop harus memiliki videoId.');
      }

      const rawDraft = parsed.draft || parsed.clips;
      let parsedClips: any[] = [];
      if (rawDraft) {
        parsedClips = typeof rawDraft === 'string' ? JSON.parse(rawDraft) : rawDraft;
      }

      // Hitung doneCount nyata dari daftar klip
      const realDoneCount = Array.isArray(parsedClips)
        ? parsedClips.filter((c: any) => c.status === 'done').length
        : (wsData.doneCount || 0);

      const cleanWs: WorkshopItem = {
        videoId: wsData.videoId,
        title: wsData.title || `Video (${wsData.videoId})`,
        count: wsData.count || 50,
        doneCount: realDoneCount,
        lastUpdated: Date.now(),
      };

      const filtered = workshops.filter((w) => w.videoId !== wsData.videoId);
      const updatedList = [cleanWs, ...filtered];
      await saveWorkshops(updatedList);

      // Simpan seluruh 100 klip + klip custom ke draf penyimpanan lokal
      if (Array.isArray(parsedClips) && parsedClips.length > 0) {
        await LocalStorage.setItem(`clips_draft_${wsData.videoId}`, JSON.stringify(parsedClips));
      }

      setImportModalVisible(false);
      ToastManager.show({
        type: 'success',
        title: 'Impor Workshop Berhasil',
        duration: 2500,
      });
      loadSavedWorkshops();
    } catch (err: any) {
      ToastManager.show({
        type: 'error',
        title: 'Impor Workshop Gagal',
        rawError: err instanceof Error ? err.message : String(err),
        duration: 4000,
      });
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
      {/* 1. Dashboard Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.titleGradient}>Clipping Workshop</Text>
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => setSettingsModalVisible(true)}
            activeOpacity={0.7}
          >
            <Settings size={20} color="rgba(255, 255, 255, 0.85)" />
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>Buat dan kelola video klip dari AI Heatmap</Text>
      </View>

      {/* 2. Input Form (Link & Klip) */}
      <WorkshopInputForm
        onCreate={handleCreateWorkshop}
        error={errorMessage}
        loading={isExtracting}
      />

      {/* 3. Saved Projects Bar */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Proyek Tersimpan</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{workshops.length}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.importBtn}
          onPress={() => setImportModalVisible(true)}
          activeOpacity={0.8}
        >
          <Download size={13} color="rgba(255, 255, 255, 0.85)" />
          <Text style={styles.actionBtnText}>IMPORT</Text>
        </TouchableOpacity>
      </View>

      {/* 4. Workshop Cards List */}
      {workshops.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Belum ada workshop tersimpan.</Text>
          <Text style={styles.emptySubtext}>Tempel link YouTube di atas untuk memulai!</Text>
        </View>
      ) : (
        workshops.map((ws) => (
          <WorkshopCard
            key={ws.videoId}
            workshop={ws}
            hasFullVideo={Boolean(fullVideoStatus[ws.videoId]?.exists)}
            isDownloadingFullVideo={Boolean(fullVideoStatus[ws.videoId]?.isDownloading)}
            downloadPercent={fullVideoStatus[ws.videoId]?.percent || 0}
            onDownloadFullVideo={handleDownloadFullVideo}
            onPress={(vid) => handleCardPress(vid, ws.count || 50)}
            onDelete={handleDeleteWorkshop}
            onBulkWA={handleBulkWA}
            onExport={handleExportWorkshop}
          />
        ))
      )}

      {/* 5. Import Modal */}
      <ImportWorkshopModal
        visible={importModalVisible}
        onClose={() => setImportModalVisible(false)}
        onImport={handleImportJSON}
      />

      {/* 5b. Export Modal */}
      <ExportWorkshopModal
        visible={exportModalVisible}
        workshopTitle={exportWorkshopTitle}
        videoId={exportVideoId}
        exportDataJson={exportDataJson}
        onClose={() => setExportModalVisible(false)}
      />

      {/* 6. Settings Modal (Shared Storage & Cookies) */}
      <SettingsModal
        visible={settingsModalVisible}
        onClose={() => setSettingsModalVisible(false)}
      />

      {/* 7. Modal Pilihan Mode Pemutaran (Lokal vs Stream) */}
      <PlayModeModal
        visible={Boolean(playModeTarget)}
        onClose={() => setPlayModeTarget(null)}
        onSelectLocal={() => {
          if (playModeTarget) {
            const { videoId, count } = playModeTarget;
            handleOpenExisting(videoId, count, 'local');
          }
        }}
        onSelectStream={() => {
          if (playModeTarget) {
            const { videoId, count } = playModeTarget;
            handleOpenExisting(videoId, count, 'stream');
          }
        }}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleGradient: {
    fontSize: 28,
    fontWeight: '900',
    color: '#ef4444',
    letterSpacing: 0.5,
  },
  settingsBtn: {
    padding: 8,
    backgroundColor: '#18181b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '500',
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 14,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  countBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#262626',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  actionBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 0.5,
  },
  emptyCard: {
    paddingVertical: 60,
    backgroundColor: 'rgba(23, 23, 23, 0.4)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    fontWeight: '600',
  },
  emptySubtext: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 12,
    fontWeight: '400',
  },
});
