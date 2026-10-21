import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Animated,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  Linking,
} from 'react-native';
import {
  CheckCircle2,
  AlertCircle,
  Info,
  X,
  Code2,
  Bug,
} from 'lucide-react-native';

export type ToastType = 'info' | 'success' | 'error' | 'loading';

export interface ToastConfig {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  rawError?: string; // Log raw error asli untuk kebutuhan debug developer
  errorCode?: string; // Kode error API (misal: "STREAM_NOT_FOUND")
  duration?: number; // ms (0 means persistent until replaced or closed)
}

type ToastListener = (config: ToastConfig | null) => void;

class ToastService {
  private listener: ToastListener | null = null;
  private currentToast: ToastConfig | null = null;
  private timer: any = null;

  subscribe(listener: ToastListener) {
    this.listener = listener;
    if (this.currentToast) {
      listener(this.currentToast);
    }
    return () => {
      this.listener = null;
    };
  }

  show(config: Omit<ToastConfig, 'id'>) {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const toast: ToastConfig = {
      ...config,
      id: Math.random().toString(),
      duration: config.duration !== undefined ? config.duration : config.type === 'loading' ? 0 : 3500,
    };

    this.currentToast = toast;
    this.listener?.(toast);

    if (toast.duration && toast.duration > 0) {
      this.timer = setTimeout(() => {
        this.hide();
      }, toast.duration);
    }
  }

  hide() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.currentToast = null;
    this.listener?.(null);
  }
}

export const ToastManager = new ToastService();

interface DebugErrorData {
  title: string;
  message?: string;
  rawError?: string;
  errorCode?: string;
}

export const ToastContainer: React.FC = () => {
  const [toast, setToast] = useState<ToastConfig | null>(null);
  const [debugData, setDebugData] = useState<DebugErrorData | null>(null);
  const [debugModalVisible, setDebugModalVisible] = useState(false);
  const opacityAnim = useState(new Animated.Value(0))[0];
  const translateYAnim = useState(new Animated.Value(-20))[0];

  useEffect(() => {
    return ToastManager.subscribe((nextToast) => {
      if (nextToast) {
        setToast(nextToast);
        Animated.parallel([
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(translateYAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        Animated.parallel([
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(translateYAnim, {
            toValue: -15,
            duration: 180,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setToast(null);
        });
      }
    });
  }, [opacityAnim, translateYAnim]);

  const handleOpenDebug = () => {
    if (toast) {
      setDebugData({
        title: toast.title,
        message: toast.message,
        rawError: toast.rawError || toast.message || 'Tidak ada detail raw error tambahan.',
        errorCode: toast.errorCode || 'UNKNOWN_ERROR',
      });
      setDebugModalVisible(true);
    }
  };

  const handleCloseDebug = () => {
    setDebugModalVisible(false);
    setDebugData(null);
  };

  if (!toast && !debugModalVisible) return null;

  const renderIcon = () => {
    if (!toast) return null;
    switch (toast.type) {
      case 'loading':
        return <ActivityIndicator size="small" color="#60a5fa" style={styles.iconStyle} />;
      case 'success':
        return <CheckCircle2 size={18} color="#34d399" style={styles.iconStyle} />;
      case 'error':
        return <AlertCircle size={18} color="#f87171" style={styles.iconStyle} />;
      case 'info':
      default:
        return <Info size={18} color="#60a5fa" style={styles.iconStyle} />;
    }
  };

  const getBorderColor = () => {
    if (!toast) return 'rgba(255, 255, 255, 0.15)';
    switch (toast.type) {
      case 'success':
        return 'rgba(16, 185, 129, 0.4)';
      case 'error':
        return 'rgba(239, 68, 68, 0.4)';
      case 'loading':
        return 'rgba(59, 130, 246, 0.4)';
      default:
        return 'rgba(255, 255, 255, 0.15)';
    }
  };

  return (
    <>
      {toast ? (
        <Animated.View
          style={[
            styles.container,
            {
              borderColor: getBorderColor(),
              opacity: opacityAnim,
              transform: [{ translateY: translateYAnim }],
            },
          ]}
          pointerEvents="box-none"
        >
          <View style={styles.contentRow}>
            {renderIcon()}
            <View style={styles.textContainer}>
              <Text style={styles.titleText} numberOfLines={1}>{toast.title}</Text>
            </View>

            {/* Icon Button Khusus Debug Modal (Selalu muncul untuk tipe error atau jika ada rawError) */}
            {(toast.type === 'error' || toast.rawError) ? (
              <TouchableOpacity
                style={styles.debugBtn}
                onPress={handleOpenDebug}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Code2 size={15} color="#fca5a5" />
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => ToastManager.hide()}
              activeOpacity={0.7}
            >
              <X size={14} color="rgba(255, 255, 255, 0.5)" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      ) : null}

      {/* Modal Detail Debug Log Error - Terisolasi dari timer auto-dismiss notifikasi toast */}
      <Modal
        visible={debugModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseDebug}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleGroup}>
                <Bug size={18} color="#f87171" />
                <Text style={styles.modalTitle}>Detail Debug Error</Text>
              </View>
              <TouchableOpacity
                onPress={handleCloseDebug}
                style={styles.modalCloseBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={16} color="rgba(255, 255, 255, 0.7)" />
              </TouchableOpacity>
            </View>

            {debugData?.errorCode ? (
              <View style={styles.codeBadge}>
                <Text style={styles.codeBadgeKey}>KODE:</Text>
                <Text style={styles.codeBadgeVal}>{debugData.errorCode}</Text>
              </View>
            ) : null}

            <Text style={styles.sectionLabel}>Fitur / Konteks:</Text>
            <Text style={styles.userMsgText}>{debugData?.title}</Text>

            <Text style={styles.sectionLabel}>Raw Error / Respon Server:</Text>
            <ScrollView
              style={styles.rawErrorContainer}
              contentContainerStyle={styles.rawErrorContent}
            >
              <Text style={styles.rawErrorText} selectable={true}>
                {debugData?.rawError}
              </Text>
            </ScrollView>

            <View style={styles.modalFooter}>
              {(debugData?.errorCode === 'STORAGE_PERMISSION_DENIED' ||
                debugData?.rawError?.toLowerCase().includes('permission denied') ||
                debugData?.rawError?.toLowerCase().includes('operation not permitted') ||
                debugData?.rawError?.toLowerCase().includes('not permitted')) ? (
                <TouchableOpacity
                  style={styles.settingsActionBtn}
                  onPress={() => Linking.openSettings()}
                  activeOpacity={0.8}
                >
                  <Text style={styles.settingsActionBtnText}>Buka Pengaturan HP</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.modalDismissBtn}
                onPress={handleCloseDebug}
                activeOpacity={0.8}
              >
                <Text style={styles.modalDismissBtnText}>Tutup</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 9999,
    backgroundColor: 'rgba(20, 20, 20, 0.96)',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconStyle: {
    marginRight: 2,
  },
  textContainer: {
    flex: 1,
  },
  titleText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  messageText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  debugBtn: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    marginRight: 2,
  },
  closeBtn: {
    padding: 4,
    marginLeft: 6,
  },
  // Debug Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: '#18181b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  modalCloseBtn: {
    padding: 4,
  },
  codeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  codeBadgeKey: {
    color: '#f87171',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  codeBadgeVal: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  sectionLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  userMsgText: {
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  rawErrorContainer: {
    maxHeight: 220,
    backgroundColor: '#09090b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 14,
  },
  rawErrorContent: {
    padding: 12,
  },
  rawErrorText: {
    color: '#f87171',
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  settingsActionBtn: {
    backgroundColor: '#dc2626',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginRight: 10,
  },
  settingsActionBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  modalDismissBtn: {
    backgroundColor: '#27272a',
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  modalDismissBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});
