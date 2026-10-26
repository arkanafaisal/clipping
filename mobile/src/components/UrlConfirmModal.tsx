import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  TouchableWithoutFeedback,
} from 'react-native';
import { Globe, Wifi, CheckCircle2, AlertCircle, X } from 'lucide-react-native';

export interface UrlConfirmConfig {
  title?: string;
  targetName?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  successMessage?: string;
  onConfirm: () => Promise<void>;
}

type UrlConfirmListener = (config: UrlConfirmConfig | null) => void;

class UrlConfirmService {
  private listener: UrlConfirmListener | null = null;
  private currentConfig: UrlConfirmConfig | null = null;

  subscribe(listener: UrlConfirmListener) {
    this.listener = listener;
    if (this.currentConfig) {
      listener(this.currentConfig);
    }
    return () => {
      this.listener = null;
    };
  }

  show(config: UrlConfirmConfig) {
    this.currentConfig = config;
    if (this.listener) {
      this.listener(config);
    }
  }

  hide() {
    this.currentConfig = null;
    if (this.listener) {
      this.listener(null);
    }
  }
}

export const UrlConfirmManager = new UrlConfirmService();

export const UrlConfirmModal: React.FC = () => {
  const [config, setConfig] = useState<UrlConfirmConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    return UrlConfirmManager.subscribe((cfg) => {
      setConfig(cfg);
      setIsLoading(false);
    });
  }, []);

  if (!config) return null;

  const handleCancel = () => {
    if (isLoading) return;
    UrlConfirmManager.hide();
  };

  const handleConfirm = async () => {
    if (isLoading || !config) return;
    setIsLoading(true);
    try {
      await config.onConfirm();
      const successMsg = config.successMessage || 'URL berhasil didapatkan! Silakan klik tombol kembali.';
      UrlConfirmManager.hide();
      // Import ToastManager lazily to avoid circular imports
      const { ToastManager } = require('./Toast');
      ToastManager.show({
        type: 'success',
        title: 'URL Berhasil Didapatkan',
        rawError: successMsg,
        duration: 3500,
      });
    } catch (err: any) {
      setIsLoading(false);
      const { ToastManager } = require('./Toast');
      ToastManager.show({
        type: 'error',
        title: 'Gagal Mendapatkan URL',
        rawError: err.rawError || err.message,
        errorCode: err.code || 'GET_URL_FAILED',
        duration: 5000,
      });
    }
  };

  return (
    <Modal
      visible={Boolean(config)}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <TouchableWithoutFeedback onPress={handleCancel}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modalCard}>
              {/* Header Icon & Close */}
              <View style={styles.headerRow}>
                <View style={styles.iconContainer}>
                  <Globe color="#06b6d4" size={24} />
                </View>
                {config.targetName ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{config.targetName}</Text>
                  </View>
                ) : null}
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={handleCancel}
                  disabled={isLoading}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X color="#71717a" size={18} />
                </TouchableOpacity>
              </View>

              {/* Title & Prompt */}
              <Text style={styles.title}>{config.title || 'URL Belum Tersedia'}</Text>
              <Text style={styles.message}>
                {config.message || 'URL stream/download belum tersedia atau kedaluwarsa. Hit get URL sekarang?'}
              </Text>

              {/* Data & Network Advice Box */}
              <View style={styles.tipBox}>
                <Wifi color="#38bdf8" size={16} style={styles.tipIcon} />
                <Text style={styles.tipText}>
                  Hanya mengambil metadata (~100 KB kuota data). Jika koneksi Wi-Fi Anda diblokir YouTube, Anda bisa beralih ke paket data seluler sebelum klik "Ya", lalu kembali ke Wi-Fi sebelum mengunduh.
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.btn, styles.cancelBtn]}
                  onPress={handleCancel}
                  disabled={isLoading}
                >
                  <Text style={styles.cancelBtnText}>{config.cancelText || 'Batal'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btn, styles.confirmBtn, isLoading && styles.confirmBtnDisabled]}
                  onPress={handleConfirm}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator size="small" color="#09090b" />
                      <Text style={styles.confirmBtnTextLoading}>Mengambil URL...</Text>
                    </View>
                  ) : (
                    <Text style={styles.confirmBtnText}>{config.confirmText || 'Ya, Hit Get URL'}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#18181b',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272a',
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  badge: {
    backgroundColor: '#27272a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: '#a1a1aa',
    fontSize: 12,
    fontWeight: '600',
  },
  closeButton: {
    marginLeft: 'auto',
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#27272a',
  },
  title: {
    color: '#f4f4f5',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  message: {
    color: '#d4d4d8',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 16,
  },
  tipBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.25)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  tipIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  tipText: {
    flex: 1,
    color: '#93c5fd',
    fontSize: 12,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: '#27272a',
  },
  cancelBtnText: {
    color: '#e4e4e7',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmBtn: {
    backgroundColor: '#06b6d4',
  },
  confirmBtnDisabled: {
    opacity: 0.7,
  },
  confirmBtnText: {
    color: '#09090b',
    fontSize: 14,
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confirmBtnTextLoading: {
    color: '#09090b',
    fontSize: 13,
    fontWeight: '600',
  },
});
