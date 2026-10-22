import React, { useState, useMemo } from 'react';
import { StyleSheet, View, Text, Pressable, TextInput, Platform } from 'react-native';
import { VideoView } from 'expo-video';
import { Camera, CameraOff, Plus, Minus } from 'lucide-react-native';

export interface FacecamConfig {
  enabled: boolean;
  zoom: number;   // 1.0 s/d 4.0 (100% - 400%)
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

type EditFieldType = 'zoom' | 'cropX' | 'cropY' | null;

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

  // State mode input manual saat angka disentuh/diklik
  const [activeEditField, setActiveEditField] = useState<EditFieldType>(null);
  const [tempInputValue, setTempInputValue] = useState<string>('');

  // Kalkulasi framing zoom & crop (resolusi 16:9 dipotong presisi ke viewport 4:3)
  const facecamVideoStyle = useMemo(() => {
    const zoom = Math.max(1.0, Math.min(4.0, config.zoom || 2.0));
    const cropX = Math.max(0, Math.min(100, config.cropX ?? 80));
    const cropY = Math.max(0, Math.min(100, config.cropY ?? 20));
    const w = facecamLayout.width || 140;
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

  // Memulai mode input manual saat angka ditekan
  const handleStartEdit = (field: 'zoom' | 'cropX' | 'cropY') => {
    setActiveEditField(field);
    if (field === 'zoom') {
      setTempInputValue(Math.round((config.zoom || 2.0) * 100).toString());
    } else if (field === 'cropX') {
      setTempInputValue((config.cropX ?? 80).toString());
    } else if (field === 'cropY') {
      setTempInputValue((config.cropY ?? 20).toString());
    }
  };

  // Menyimpan hasil input manual saat blur atau submit
  const handleCommitEdit = () => {
    if (!activeEditField) return;
    const cleanStr = tempInputValue.replace(/[^0-9]/g, '');
    const num = parseInt(cleanStr, 10);

    if (!isNaN(num)) {
      if (activeEditField === 'zoom') {
        const clamped = Math.max(100, Math.min(400, num));
        onUpdateConfig({ zoom: clamped / 100 });
      } else if (activeEditField === 'cropX') {
        const clamped = Math.max(0, Math.min(100, num));
        onUpdateConfig({ cropX: clamped });
      } else if (activeEditField === 'cropY') {
        const clamped = Math.max(0, Math.min(100, num));
        onUpdateConfig({ cropY: clamped });
      }
    }
    setActiveEditField(null);
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
            <CameraOff size={18} color="rgba(255, 255, 255, 0.25)" />
            <Text style={styles.disabledText}>Facecam OFF</Text>
          </View>
        )}

        {/* Badge Rasio 4:3 */}
        <View style={styles.ratioBadge}>
          <Text style={styles.ratioBadgeText}>4:3</Text>
        </View>
      </View>

      {/* 2. PANEL PENGATURAN ULTRA KOMPAK (Docked Right) */}
      <View style={styles.controlsPanel}>
        {/* Header: Judul & Toggle ON/OFF */}
        <View style={styles.headerRow}>
          <View style={styles.titleRow}>
            <Camera size={11} color="#38bdf8" />
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
            {/* Zoom Stepper & Inline Input */}
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>ZOOM</Text>
              <View style={styles.stepperGroup}>
                <Pressable
                  style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.5 }]}
                  onPress={() => handleStepZoom(-25)}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Minus size={9} color="#ffffff" />
                </Pressable>

                {activeEditField === 'zoom' ? (
                  <TextInput
                    style={styles.fieldInput}
                    value={tempInputValue}
                    onChangeText={setTempInputValue}
                    onBlur={handleCommitEdit}
                    onSubmitEditing={handleCommitEdit}
                    keyboardType="number-pad"
                    autoFocus
                    selectTextOnFocus
                    maxLength={3}
                  />
                ) : (
                  <Pressable
                    style={styles.valueBtn}
                    onPress={() => handleStartEdit('zoom')}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <Text style={styles.settingValue}>
                      {Math.round((config.zoom || 2.0) * 100)}%
                    </Text>
                  </Pressable>
                )}

                <Pressable
                  style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.5 }]}
                  onPress={() => handleStepZoom(25)}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Plus size={9} color="#ffffff" />
                </Pressable>
              </View>
            </View>

            {/* Pos X Stepper & Inline Input */}
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>POS X</Text>
              <View style={styles.stepperGroup}>
                <Pressable
                  style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.5 }]}
                  onPress={() => handleStepCropX(-5)}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Minus size={9} color="#ffffff" />
                </Pressable>

                {activeEditField === 'cropX' ? (
                  <TextInput
                    style={styles.fieldInput}
                    value={tempInputValue}
                    onChangeText={setTempInputValue}
                    onBlur={handleCommitEdit}
                    onSubmitEditing={handleCommitEdit}
                    keyboardType="number-pad"
                    autoFocus
                    selectTextOnFocus
                    maxLength={3}
                  />
                ) : (
                  <Pressable
                    style={styles.valueBtn}
                    onPress={() => handleStartEdit('cropX')}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <Text style={styles.settingValue}>
                      {config.cropX ?? 80}%
                    </Text>
                  </Pressable>
                )}

                <Pressable
                  style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.5 }]}
                  onPress={() => handleStepCropX(5)}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Plus size={9} color="#ffffff" />
                </Pressable>
              </View>
            </View>

            {/* Pos Y Stepper & Inline Input */}
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>POS Y</Text>
              <View style={styles.stepperGroup}>
                <Pressable
                  style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.5 }]}
                  onPress={() => handleStepCropY(-5)}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Minus size={9} color="#ffffff" />
                </Pressable>

                {activeEditField === 'cropY' ? (
                  <TextInput
                    style={styles.fieldInput}
                    value={tempInputValue}
                    onChangeText={setTempInputValue}
                    onBlur={handleCommitEdit}
                    onSubmitEditing={handleCommitEdit}
                    keyboardType="number-pad"
                    autoFocus
                    selectTextOnFocus
                    maxLength={3}
                  />
                ) : (
                  <Pressable
                    style={styles.valueBtn}
                    onPress={() => handleStartEdit('cropY')}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <Text style={styles.settingValue}>
                      {config.cropY ?? 20}%
                    </Text>
                  </Pressable>
                )}

                <Pressable
                  style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.5 }]}
                  onPress={() => handleStepCropY(5)}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Plus size={9} color="#ffffff" />
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.inactiveContainer}>
            <Text style={styles.inactiveDesc} numberOfLines={2}>
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
    maxHeight: 135,
    minHeight: 95,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 8,
    backgroundColor: '#050505',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  facecamBox: {
    height: '100%',
    maxHeight: 125,
    aspectRatio: 4 / 3,
    borderRadius: 6,
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
    gap: 3,
  },
  disabledText: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 9,
    fontWeight: '700',
  },
  ratioBadge: {
    position: 'absolute',
    top: 3,
    left: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  ratioBadgeText: {
    color: '#38bdf8',
    fontSize: 8,
    fontWeight: '800',
  },
  controlsPanel: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    justifyContent: 'center',
    gap: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  titleText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  toggleBtn: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
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
    fontSize: 8,
    fontWeight: '800',
  },
  toggleBtnTextActive: {
    color: '#34d399',
  },
  toggleBtnTextInactive: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  activeSettingsList: {
    gap: 2.5,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111111',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  settingLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 8.5,
    fontWeight: '700',
    width: 32,
  },
  stepperGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  stepBtn: {
    width: 17,
    height: 17,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueBtn: {
    minWidth: 32,
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 3,
    paddingHorizontal: 2,
  },
  settingValue: {
    color: '#ffffff',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '800',
    textAlign: 'center',
  },
  fieldInput: {
    minWidth: 32,
    height: 17,
    backgroundColor: '#18181b',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#38bdf8',
    color: '#38bdf8',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: 1,
    paddingVertical: 0,
  },
  inactiveContainer: {
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 2,
  },
  inactiveDesc: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 8.5,
    lineHeight: 11,
  },
  activateBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: 'rgba(56, 189, 248, 0.4)',
    borderWidth: 1,
    borderRadius: 4,
    paddingVertical: 3.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activateBtnText: {
    color: '#38bdf8',
    fontSize: 9,
    fontWeight: '700',
  },
});
