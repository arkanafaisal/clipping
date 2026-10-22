import React, { useState, useMemo } from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { VideoView } from 'expo-video';
import { Camera, CameraOff, Plus, Minus } from 'lucide-react-native';

export interface FacecamConfig {
  enabled: boolean;
  zoom: number;   // 1.0 s/d 5.0 (100% - 500%)
  cropX: number;  // 0 - 100 (%)
  cropY: number;  // 0 - 100 (%)
}

export const DEFAULT_FACECAM_CONFIG: FacecamConfig = {
  enabled: false,
  zoom: 2.0,
  cropX: 80,
  cropY: 20,
};

export interface FacecamHighlightSectionProps {
  facecamPlayer: any;
  config: FacecamConfig;
  onUpdateConfig: (updates: Partial<FacecamConfig>) => void;
  hasPlayableSource: boolean;
}

export const FacecamHighlightSection: React.FC<FacecamHighlightSectionProps> = ({
  facecamPlayer,
  config,
  onUpdateConfig,
  hasPlayableSource,
}) => {
  const [facecamLayout, setFacecamLayout] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // Kalkulasi framing zoom & crop persis sesuai algoritma teruji (resolusi 16:9 dipotong ke viewport 4:3)
  const facecamVideoStyle = useMemo(() => {
    const zoom = Math.max(1.0, Math.min(5.0, config.zoom || 2.0));
    const cropX = Math.max(0, Math.min(100, config.cropX ?? 80));
    const cropY = Math.max(0, Math.min(100, config.cropY ?? 20));
    const w = facecamLayout.width || 160;
    const h = facecamLayout.height || (w * 0.75);

    // Dimensi video 16:9 penuh agar native player tidak memotong gambar sebelum scaling
    const baseVideoWidth = h * (16 / 9);
    const scaledWidth = baseVideoWidth * zoom;
    const scaledHeight = h * zoom;

    const maxShiftX = Math.max(0, (scaledWidth - w) / 2);
    const maxShiftY = Math.max(0, (scaledHeight - h) / 2);

    const left = (w - scaledWidth) / 2 + ((50 - cropX) / 50) * maxShiftX;
    const top = (h - scaledHeight) / 2 + ((50 - cropY) / 50) * maxShiftY;

    return {
      position: 'absolute' as const,
      width: scaledWidth,
      height: scaledHeight,
      left,
      top,
    };
  }, [config.zoom, config.cropX, config.cropY, facecamLayout]);

  const handleStepZoom = (deltaPercent: number) => {
    const current = Math.round((config.zoom || 2.0) * 100);
    const next = Math.max(100, Math.min(400, current + deltaPercent));
    onUpdateConfig({ zoom: next / 100 });
  };

  const handleStepCropX = (delta: number) => {
    const current = config.cropX ?? 80;
    const next = Math.max(0, Math.min(100, current + delta));
    onUpdateConfig({ cropX: next });
  };

  const handleStepCropY = (delta: number) => {
    const current = config.cropY ?? 20;
    const next = Math.max(0, Math.min(100, current + delta));
    onUpdateConfig({ cropY: next });
  };

  const handleToggleEnabled = () => {
    onUpdateConfig({ enabled: !config.enabled });
  };

  return (
    <View style={styles.container}>
      {/* 1. VIEWPORT FACECAM (4:3 Landscape, Docked Left) */}
      <View
        style={styles.facecamBox}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (width > 0 && height > 0) {
            setFacecamLayout({ width, height });
          }
        }}
      >
        {config.enabled && hasPlayableSource && facecamPlayer ? (
          <VideoView
            style={facecamVideoStyle}
            player={facecamPlayer}
            contentFit="cover"
            nativeControls={false}
            surfaceType="textureView"
          />
        ) : (
          <View style={styles.disabledBox}>
            <CameraOff size={22} color="rgba(255, 255, 255, 0.25)" />
            <Text style={styles.disabledText}>Facecam OFF</Text>
          </View>
        )}

        {/* Badge Rasio 4:3 */}
        <View style={styles.ratioBadge}>
          <Text style={styles.ratioBadgeText}>4:3</Text>
        </View>
      </View>

      {/* 2. PANEL PENGATURAN (Docked Right) */}
      <View style={styles.controlsPanel}>
        {/* Header: Judul & Toggle ON/OFF */}
        <View style={styles.headerRow}>
          <View style={styles.titleRow}>
            <Camera size={13} color="#38bdf8" />
            <Text style={styles.titleText}>Facecam</Text>
          </View>
          <Pressable
            style={[styles.toggleBtn, config.enabled ? styles.toggleBtnActive : styles.toggleBtnInactive]}
            onPress={handleToggleEnabled}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={[styles.toggleBtnText, config.enabled ? styles.toggleBtnTextActive : styles.toggleBtnTextInactive]}>
              {config.enabled ? 'ON' : 'OFF'}
            </Text>
          </Pressable>
        </View>

        {config.enabled ? (
          <View style={styles.activeSettingsList}>
            {/* Zoom Stepper */}
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>ZOOM</Text>
              <View style={styles.stepperGroup}>
                <Pressable
                  style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.5 }]}
                  onPress={() => handleStepZoom(-25)}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Minus size={11} color="#ffffff" />
                </Pressable>
                <Text style={styles.settingValue}>{Math.round((config.zoom || 2.0) * 100)}%</Text>
                <Pressable
                  style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.5 }]}
                  onPress={() => handleStepZoom(25)}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Plus size={11} color="#ffffff" />
                </Pressable>
              </View>
            </View>

            {/* Pos X Stepper */}
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>POS X</Text>
              <View style={styles.stepperGroup}>
                <Pressable
                  style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.5 }]}
                  onPress={() => handleStepCropX(-5)}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Minus size={11} color="#ffffff" />
                </Pressable>
                <Text style={styles.settingValue}>{config.cropX ?? 80}%</Text>
                <Pressable
                  style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.5 }]}
                  onPress={() => handleStepCropX(5)}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Plus size={11} color="#ffffff" />
                </Pressable>
              </View>
            </View>

            {/* Pos Y Stepper */}
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>POS Y</Text>
              <View style={styles.stepperGroup}>
                <Pressable
                  style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.5 }]}
                  onPress={() => handleStepCropY(-5)}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Minus size={11} color="#ffffff" />
                </Pressable>
                <Text style={styles.settingValue}>{config.cropY ?? 20}%</Text>
                <Pressable
                  style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.5 }]}
                  onPress={() => handleStepCropY(5)}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Plus size={11} color="#ffffff" />
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.inactiveContainer}>
            <Text style={styles.inactiveDesc}>
              Hemat performa decoding HP jika lag.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.activateBtn, pressed && { opacity: 0.7 }]}
              onPress={handleToggleEnabled}
            >
              <Text style={styles.activateBtnText}>Tampilkan</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flex: 1,
    maxHeight: 155,
    minHeight: 110,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 12,
    backgroundColor: '#050505',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  facecamBox: {
    height: '100%',
    maxHeight: 140,
    aspectRatio: 4 / 3,
    borderRadius: 8,
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  disabledText: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 10,
    fontWeight: '700',
  },
  ratioBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  ratioBadgeText: {
    color: '#38bdf8',
    fontSize: 9,
    fontWeight: '800',
  },
  controlsPanel: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    gap: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  titleText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  toggleBtn: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  toggleBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10b981',
  },
  toggleBtnInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  toggleBtnText: {
    fontSize: 9,
    fontWeight: '800',
  },
  toggleBtnTextActive: {
    color: '#34d399',
  },
  toggleBtnTextInactive: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  activeSettingsList: {
    gap: 3,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111111',
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  settingLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 9,
    fontWeight: '700',
    width: 38,
  },
  stepperGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepBtn: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingValue: {
    color: '#ffffff',
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '800',
    minWidth: 36,
    textAlign: 'center',
  },
  inactiveContainer: {
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 4,
  },
  inactiveDesc: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 9,
    lineHeight: 12,
  },
  activateBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: 'rgba(56, 189, 248, 0.4)',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activateBtnText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '700',
  },
});
