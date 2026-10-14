import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Animated,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  CheckCircle2,
  AlertCircle,
  Info,
  X,
} from 'lucide-react-native';

export type ToastType = 'info' | 'success' | 'error' | 'loading';

export interface ToastConfig {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
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

export const ToastContainer: React.FC = () => {
  const [toast, setToast] = useState<ToastConfig | null>(null);
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

  if (!toast) return null;

  const renderIcon = () => {
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
          <Text style={styles.titleText}>{toast.title}</Text>
          {toast.message ? <Text style={styles.messageText}>{toast.message}</Text> : null}
        </View>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => ToastManager.hide()}
          activeOpacity={0.7}
        >
          <X size={14} color="rgba(255, 255, 255, 0.5)" />
        </TouchableOpacity>
      </View>
    </Animated.View>
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
  closeBtn: {
    padding: 4,
    marginLeft: 6,
  },
});
