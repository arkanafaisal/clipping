import React, { useState } from 'react';
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

// Sample demonstration workshops for immediate rich preview
const INITIAL_DEMO_WORKSHOPS: WorkshopItem[] = [
  {
    videoId: 'dQw4w9WgXcQ',
    title: 'Rick Astley - Never Gonna Give You Up (Official Music Video)',
    count: 50,
    doneCount: 4,
    lastUpdated: Date.now(),
  },
  {
    videoId: 'jNQXAC9IVRw',
    title: 'Me at the zoo - First YouTube Video Ever',
    count: 25,
    doneCount: 1,
    lastUpdated: Date.now() - 3600000,
  },
];

interface DashboardProps {
  onOpenWorkshop?: (videoId: string, count: number) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onOpenWorkshop }) => {
  const [workshops, setWorkshops] = useState<WorkshopItem[]>(INITIAL_DEMO_WORKSHOPS);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importModalVisible, setImportModalVisible] = useState(false);

  // Helper extracting 11-char YouTube ID
  const extractVideoId = (url: string): string | null => {
    const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regExp);
    if (match && match[1].length === 11) return match[1];
    if (url.trim().length === 11) return url.trim();
    return null;
  };

  const handleCreateWorkshop = (url: string, count: number) => {
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

    // Check if workshop already exists
    const existingIndex = workshops.findIndex((w) => w.videoId === videoId);
    if (existingIndex >= 0) {
      const updated = [...workshops];
      updated[existingIndex].count = count;
      updated[existingIndex].lastUpdated = Date.now();
      setWorkshops(updated);
      onOpenWorkshop?.(videoId, count);
      return;
    }

    // Add new workshop
    const newWorkshop: WorkshopItem = {
      videoId,
      title: `YouTube Video (${videoId})`,
      count,
      doneCount: 0,
      lastUpdated: Date.now(),
    };

    setWorkshops([newWorkshop, ...workshops]);
    onOpenWorkshop?.(videoId, count);
  };

  const handleDeleteWorkshop = (videoId: string) => {
    Alert.alert('Hapus Draft', 'Yakin ingin menghapus draf workshop ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: () => {
          setWorkshops(workshops.filter((w) => w.videoId !== videoId));
        },
      },
    ]);
  };

  const handleImportJSON = (jsonText: string) => {
    try {
      const parsed = JSON.parse(jsonText);
      const wsData = parsed.workshop || parsed;
      if (!wsData.videoId) {
        throw new Error('Data workshop harus memiliki videoId');
      }

      setWorkshops((prev) => {
        const filtered = prev.filter((w) => w.videoId !== wsData.videoId);
        return [wsData, ...filtered];
      });

      setImportModalVisible(false);
      Alert.alert('Sukses', 'Workshop berhasil di-import!');
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
      <WorkshopInputForm onCreate={handleCreateWorkshop} error={errorMessage} />

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
          <Text style={styles.importBtnText}>IMPORT WORKSHOP</Text>
        </TouchableOpacity>
      </View>

      {/* 4. Workshop Cards List */}
      {workshops.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Belum ada workshop. Buat satu di atas!</Text>
        </View>
      ) : (
        workshops.map((ws) => (
          <WorkshopCard
            key={ws.videoId}
            workshop={ws}
            onPress={(vid) => onOpenWorkshop?.(vid, ws.count || 50)}
            onDelete={handleDeleteWorkshop}
            onExport={(w) => Alert.alert('Export JSON', JSON.stringify(w))}
            onBulkWA={(vid) => Alert.alert('WhatsApp Export', `Ekspor klip ${vid} ke WhatsApp!`)}
            onDownloadDrive={(vid) => Alert.alert('GDrive', `Download & upload ${vid} ke Google Drive`)}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 13,
    fontWeight: '500',
  },
});
