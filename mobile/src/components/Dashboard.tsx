import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Download } from 'lucide-react-native';
import { WorkshopCard, WorkshopItem } from './WorkshopCard';
import { WorkshopInputForm } from './WorkshopInputForm';
import { ImportWorkshopModal } from './ImportWorkshopModal';
import { LocalStorage } from '../services/storage';
import { ToastManager } from './Toast';
import { fetchHeatmap } from '../services/api';

const WORKSHOPS_STORAGE_KEY = 'workshops_list';

interface DashboardProps {
  onOpenWorkshop?: (videoId: string, count: number) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onOpenWorkshop }) => {
  const [workshops, setWorkshops] = useState<WorkshopItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);

  // Load workshops from LocalStorage on mount
  useEffect(() => {
    async function loadSavedWorkshops() {
      try {
        const saved = await LocalStorage.getItem(WORKSHOPS_STORAGE_KEY);
        if (saved) {
          const parsed: WorkshopItem[] = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            parsed.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
            setWorkshops(parsed);
          }
        }
      } catch (e) {
        console.warn('[Dashboard] Failed to load workshops:', e);
      }
    }
    loadSavedWorkshops();
  }, []);

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

    // 1. Cek apakah draft klip lokal sudah pernah tersimpan
    const savedDraft = await LocalStorage.getItem(`clips_draft_${videoId}`);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Buka langsung karena draft sudah ada
          const existingIndex = workshops.findIndex((w) => w.videoId === videoId);
          if (existingIndex >= 0) {
            const updated = [...workshops];
            updated[existingIndex].count = count;
            updated[existingIndex].lastUpdated = Date.now();
            await saveWorkshops(updated);
          }
          onOpenWorkshop?.(videoId, count);
          return;
        }
      } catch (e) {
        // Abaikan parse error, lanjut fetch
      }
    }

    // 2. Jika belum ada draft, fetch heatmap DULU sebelum masuk ke halaman room
    setIsExtracting(true);
    ToastManager.show({
      type: 'loading',
      title: 'Mengekstrak Heatmap',
      message: `Mengambil data Most Replayed untuk video ${videoId}...`,
    });

    try {
      const data = await fetchHeatmap(videoId, count, 0);

      if (!data.clips || data.clips.length === 0) {
        throw new Error('Heatmap tidak mengembalikan segmen klip.');
      }

      // Format klip dengan status 'none'
      const formattedClips = data.clips.map((c, idx) => ({
        ...c,
        status: 'none' as const,
        rank: c.rank || idx + 1,
      }));

      // Simpan draft klip ke LocalStorage
      await LocalStorage.setItem(`clips_draft_${videoId}`, JSON.stringify(formattedClips));

      // Update / Simpan workshop ke list
      const title = data.title || `YouTube Video (${videoId})`;
      const existingIndex = workshops.findIndex((w) => w.videoId === videoId);
      let updatedList: WorkshopItem[];

      if (existingIndex >= 0) {
        updatedList = [...workshops];
        updatedList[existingIndex].title = title;
        updatedList[existingIndex].count = count;
        updatedList[existingIndex].lastUpdated = Date.now();
      } else {
        const newWorkshop: WorkshopItem = {
          videoId,
          title,
          count,
          doneCount: 0,
          lastUpdated: Date.now(),
        };
        updatedList = [newWorkshop, ...workshops];
      }

      await saveWorkshops(updatedList);
      setIsExtracting(false);

      ToastManager.show({
        type: 'success',
        title: 'Heatmap Berhasil',
        message: `${formattedClips.length} klip berhasil diambil!`,
      });

      // HANYA masuk ke FeedScreen jika ekstraksi benar-benar sukses!
      onOpenWorkshop?.(videoId, count);
    } catch (err: any) {
      setIsExtracting(false);
      ToastManager.show({
        type: 'error',
        title: 'Gagal Ekstrak Heatmap',
        message: err.message || 'Server gagal mengambil data.',
        duration: 5000,
      });

      Alert.alert(
        'Gagal Mengambil Heatmap',
        `${err.message}\n\nAplikasi tetap berada di Dashboard karena data klip belum berhasil diperoleh.`
      );
      // TIDAK MEMBUKA FeedScreen!
    }
  };

  const handleOpenExisting = async (videoId: string, count: number) => {
    // Cek apakah draft sudah ada
    const savedDraft = await LocalStorage.getItem(`clips_draft_${videoId}`);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Update lastUpdated
          const existingIndex = workshops.findIndex((w) => w.videoId === videoId);
          if (existingIndex >= 0) {
            const updated = [...workshops];
            updated[existingIndex].lastUpdated = Date.now();
            await saveWorkshops(updated);
          }
          onOpenWorkshop?.(videoId, count);
          return;
        }
      } catch (e) {
        // Lanjut ke fetch jika draft korup
      }
    }

    // Jika belum ada draft, coba fetch heatmap terlebih dahulu
    setIsExtracting(true);
    ToastManager.show({
      type: 'loading',
      title: 'Mengekstrak Heatmap',
      message: `Mengambil data klip untuk ${videoId}...`,
    });

    try {
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
      setIsExtracting(false);

      ToastManager.show({
        type: 'success',
        title: 'Heatmap Berhasil',
        message: `${formattedClips.length} klip siap di-review.`,
      });

      onOpenWorkshop?.(videoId, count);
    } catch (err: any) {
      setIsExtracting(false);
      ToastManager.show({
        type: 'error',
        title: 'Gagal Mengambil Klip',
        message: err.message,
      });
      Alert.alert('Gagal Mengambil Heatmap', err.message);
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
      if (parsed.draft && Array.isArray(parsed.draft)) {
        await LocalStorage.setItem(`clips_draft_${wsData.videoId}`, JSON.stringify(parsed.draft));
      }

      setImportModalVisible(false);
      ToastManager.show({
        type: 'success',
        title: 'Import Sukses',
        message: `Workshop ${wsData.videoId} berhasil di-import.`,
      });
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
          />
        ))
      )}

      {/* 5. Import Modal */}
      <ImportWorkshopModal
        visible={importModalVisible}
        onClose={() => setImportModalVisible(false)}
        onImport={handleImportJSON}
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
