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
import { Download } from 'lucide-react-native';
import { WorkshopCard, WorkshopItem } from './WorkshopCard';
import { WorkshopInputForm } from './WorkshopInputForm';
import { ImportWorkshopModal } from './ImportWorkshopModal';
import { CookiesModal } from './CookiesModal';
import { LocalStorage } from '../services/storage';
import { ToastManager } from './Toast';
import { fetchHeatmap, fetchStreamUrl } from '../services/api';

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
  onOpenWorkshop?: (videoId: string, count: number) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onOpenWorkshop }) => {
  const [workshops, setWorkshops] = useState<WorkshopItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [cookiesModalVisible, setCookiesModalVisible] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);

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
      // 1. Ekstrak heatmap
      const data = await fetchHeatmap(videoId, count, 0);
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
      if (err.code === 'RATE_LIMIT_EXCEEDED' || (err.message && err.message.includes('429'))) {
        setCookiesModalVisible(true);
      }
      ToastManager.show({
        type: 'error',
        title: 'Gagal Membuat Workshop',
        message: err.message || 'Server gagal mengambil data.',
        rawError: err.rawError,
        errorCode: err.code,
        duration: 5000,
      });

      Alert.alert(
        'Gagal Membuka Workshop',
        `${err.message || 'Koneksi ke backend gagal.'}\n\nAplikasi tetap berada di Dashboard karena data klip atau stream belum siap.`
      );
    }
  };

  const handleOpenExisting = async (videoId: string, count: number) => {
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
        const data = await fetchHeatmap(videoId, count, 0);
        if (!data.clips || data.clips.length === 0) {
          throw new Error('Heatmap tidak mengembalikan klip.');
        }

        const formattedClips = data.clips.map((c, idx) => ({
          ...c,
          status: 'none' as const,
          rank: c.rank || idx + 1,
        }));

        await LocalStorage.setItem(`clips_draft_${videoId}`, JSON.stringify(formattedClips));
      }

      // 2. Ambil direct stream URL
      await fetchStreamUrl(videoId);

      // 3. Update lastUpdated
      const existingIndex = workshops.findIndex((w) => w.videoId === videoId);
      if (existingIndex >= 0) {
        const updated = [...workshops];
        updated[existingIndex].lastUpdated = Date.now();
        await saveWorkshops(updated);
      }

      // 4. Masuk ke FeedScreen setelah respons berhasil
      onOpenWorkshop?.(videoId, count);
    } catch (err: any) {
      if (err.code === 'RATE_LIMIT_EXCEEDED' || (err.message && err.message.includes('429'))) {
        setCookiesModalVisible(true);
      }
      ToastManager.show({
        type: 'error',
        title: 'Gagal Membuka Workshop',
        message: err.message || 'Server sedang offline.',
        rawError: err.rawError,
        errorCode: err.code,
        duration: 5000,
      });
      Alert.alert(
        'Tidak Dapat Masuk ke Kamar',
        `${err.message || 'Koneksi ke server gagal.'}\n\nAplikasi tetap berada di Dashboard karena backend belum siap.`
      );
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
            message: `Workshop ${videoId} telah dihapus.`,
          });
        },
      },
    ]);
  };

  // Kirim semua klip yang Done (Hijau) ke WhatsApp Bot
  const handleBulkWA = async (videoId: string) => {
    const stored = await LocalStorage.getItem(`clips_draft_${videoId}`);
    if (!stored) {
      Alert.alert('Perhatian', 'Tidak ada draft klip untuk video ini.');
      return;
    }

    try {
      const clips = JSON.parse(stored);
      const doneClips = clips
        .filter((c: any) => c.status === 'done')
        .sort((a: any, b: any) => a.start - b.start);

      if (doneClips.length === 0) {
        Alert.alert('Perhatian', 'Tidak ada klip yang ditandai Selesai (Hijau) pada video ini.');
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
      Alert.alert('Gagal', 'Gagal memproses draft klip untuk WhatsApp.');
    }
  };

  const handleImportJSON = async (jsonText: string) => {
    try {
      const parsed = JSON.parse(jsonText);
      const wsData = parsed.workshop || parsed;
      if (!wsData.videoId) {
        throw new Error('Data workshop harus memiliki videoId');
      }

      const filtered = workshops.filter((w) => w.videoId !== wsData.videoId);
      const updatedList = [wsData, ...filtered];
      await saveWorkshops(updatedList);

      // If json contains draft clips, save them too
      if (parsed.draft) {
        const draftContent = typeof parsed.draft === 'string' ? parsed.draft : JSON.stringify(parsed.draft);
        await LocalStorage.setItem(`clips_draft_${wsData.videoId}`, draftContent);
      }

      setImportModalVisible(false);
      ToastManager.show({
        type: 'success',
        title: 'Import Sukses',
        message: `Workshop ${wsData.videoId} berhasil di-import.`,
      });
      loadSavedWorkshops();
    } catch (err) {
      Alert.alert('Gagal', 'Format data JSON yang Anda paste tidak valid.');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
      {/* 1. Dashboard Header */}
      <View style={styles.header}>
        <Text style={styles.titleGradient}>Clipping Workshop</Text>
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
          <Text style={styles.importBtnText}>IMPORT</Text>
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
            onPress={(vid) => handleOpenExisting(vid, ws.count || 50)}
            onDelete={handleDeleteWorkshop}
            onBulkWA={handleBulkWA}
          />
        ))
      )}

      {/* 5. Import Modal */}
      <ImportWorkshopModal
        visible={importModalVisible}
        onClose={() => setImportModalVisible(false)}
        onImport={handleImportJSON}
      />

      {/* 6. Cookies Modal for Rate Limits */}
      <CookiesModal
        visible={cookiesModalVisible}
        onClose={() => setCookiesModalVisible(false)}
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
  titleGradient: {
    fontSize: 28,
    fontWeight: '900',
    color: '#ef4444',
    letterSpacing: 0.5,
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
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  importBtnText: {
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
