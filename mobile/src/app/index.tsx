import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { RefreshCw, AlertTriangle, Trash2, Terminal, Wifi, Smartphone } from 'lucide-react-native';
import { startPythonServer } from '../../modules/python-runner';

interface LogItem {
  id: number;
  time: string;
  level: 'INFO' | 'ERROR' | 'WARN';
  message: string;
}

export default function HomeScreen() {
  // Dapatkan IP laptop tempat Expo berjalan secara otomatis jika dibutuhkan fallback
  const autoLaptopIp = Constants.expoConfig?.hostUri
    ? Constants.expoConfig.hostUri.split(':')[0]
    : '192.168.100.7';

  // Default langsung ke HP Localhost 127.0.0.1:8080
  const [serverHost, setServerHost] = useState<string>('http://127.0.0.1:8080');
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [autoPoll, setAutoPoll] = useState<boolean>(true);

  const scrollViewRef = useRef<ScrollView>(null);

  // Otomatis nyalakan Python server lokal saat aplikasi HP dibuka
  useEffect(() => {
    try {
      const res = startPythonServer();
      console.log('[Native] Python Server start response:', res);
    } catch (e) {
      console.log('[Native] startPythonServer:', e);
    }
  }, []);

  // Ping Server to check health & latency
  const checkServerHealth = async () => {
    const startTime = Date.now();
    try {
      const res = await fetch(`${serverHost}/ping`, { method: 'GET' });
      const elapsed = Date.now() - startTime;
      if (res.ok) {
        const data = await res.json();
        setServerOnline(true);
        setLatency(elapsed);
        setServerInfo(data);
      } else {
        setServerOnline(false);
      }
    } catch (err) {
      setServerOnline(false);
      setLatency(null);
    }
  };

  // Fetch Logs from Python Server
  const fetchLogs = async () => {
    try {
      const res = await fetch(`${serverHost}/logs`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.logs)) {
          setLogs(data.logs);
        }
      }
    } catch (err) {
      // Ignored if offline
    }
  };

  // Trigger simulated error to test error capture
  const handleTriggerTestError = async () => {
    setLoadingAction('error');
    try {
      const res = await fetch(`${serverHost}/test-error`);
      const data = await res.json();
      console.log('Test error response:', data);
      await fetchLogs();
    } catch (err) {
      console.log('Error triggering test:', err);
    } finally {
      setLoadingAction(null);
    }
  };

  // Clear logs buffer
  const handleClearLogs = async () => {
    setLoadingAction('clear');
    try {
      await fetch(`${serverHost}/clear-logs`, { method: 'POST' });
      setLogs([]);
    } catch (err) {
      console.log('Error clearing logs:', err);
    } finally {
      setLoadingAction(null);
    }
  };

  // Polling loop
  useEffect(() => {
    checkServerHealth();
    fetchLogs();

    if (!autoPoll) return;

    const interval = setInterval(() => {
      checkServerHealth();
      fetchLogs();
    }, 2000);

    return () => clearInterval(interval);
  }, [autoPoll]);

  return (
    <SafeAreaView style={styles.container}>
      {/* 1. Header Bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appTitle}>CLIPPING MOBILE</Text>
          <Text style={styles.appSubtitle}>Local Python Server Monitor</Text>
        </View>

        {/* Status Badge */}
        <View
          style={[
            styles.statusBadge,
            serverOnline === true
              ? styles.statusOnline
              : serverOnline === false
              ? styles.statusOffline
              : styles.statusChecking,
          ]}
        >
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor:
                  serverOnline === true ? '#10b981' : serverOnline === false ? '#ef4444' : '#f59e0b',
              },
            ]}
          />
          <Text style={styles.statusText}>
            {serverOnline === true ? 'ONLINE' : serverOnline === false ? 'OFFLINE' : 'CHECKING...'}
          </Text>
        </View>
      </View>

      {/* 2. Server Info Card */}
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Target Host:</Text>
          <Text style={styles.cardValue}>{serverHost}</Text>
        </View>

        {/* Quick Host Switcher Buttons */}
        <View style={styles.hostSwitchRow}>
          <TouchableOpacity
            style={[
              styles.hostSwitchBtn,
              serverHost.includes(autoLaptopIp) && styles.hostSwitchBtnActive,
            ]}
            onPress={() => setServerHost(`http://${autoLaptopIp}:8080`)}
            activeOpacity={0.8}
          >
            <Wifi size={13} color={serverHost.includes(autoLaptopIp) ? '#ffffff' : '#888888'} />
            <Text
              style={[
                styles.hostSwitchText,
                serverHost.includes(autoLaptopIp) && styles.hostSwitchTextActive,
              ]}
            >
              Laptop ({autoLaptopIp})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.hostSwitchBtn,
              serverHost.includes('127.0.0.1') && styles.hostSwitchBtnActive,
            ]}
            onPress={() => setServerHost('http://127.0.0.1:8080')}
            activeOpacity={0.8}
          >
            <Smartphone size={13} color={serverHost.includes('127.0.0.1') ? '#ffffff' : '#888888'} />
            <Text
              style={[
                styles.hostSwitchText,
                serverHost.includes('127.0.0.1') && styles.hostSwitchTextActive,
              ]}
            >
              HP (127.0.0.1)
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Latency / Ping:</Text>
          <Text style={[styles.cardValue, { color: latency !== null ? '#10b981' : '#6b7280' }]}>
            {latency !== null ? `${latency} ms` : 'Tidak terhubung'}
          </Text>
        </View>
        {serverInfo && (
          <>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Python Version:</Text>
              <Text style={styles.cardValue}>{serverInfo.python_version || 'N/A'}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Uptime Server:</Text>
              <Text style={styles.cardValue}>{serverInfo.uptime_seconds} detik</Text>
            </View>
          </>
        )}
      </View>

      {/* 3. Action Buttons */}
      <View style={styles.buttonGroup}>
        <TouchableOpacity
          style={[styles.actionButton, styles.btnPing]}
          onPress={checkServerHealth}
          activeOpacity={0.8}
        >
          <RefreshCw size={16} color="#ffffff" />
          <Text style={styles.btnText}>Ping Server</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.btnError]}
          onPress={handleTriggerTestError}
          disabled={loadingAction === 'error'}
          activeOpacity={0.8}
        >
          {loadingAction === 'error' ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <AlertTriangle size={16} color="#ffffff" />
          )}
          <Text style={styles.btnText}>Test Error</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.btnClear]}
          onPress={handleClearLogs}
          disabled={loadingAction === 'clear'}
          activeOpacity={0.8}
        >
          <Trash2 size={16} color="#9ca3af" />
          <Text style={[styles.btnText, { color: '#9ca3af' }]}>Clear</Text>
        </TouchableOpacity>
      </View>

      {/* 4. Terminal Logs View */}
      <View style={styles.terminalContainer}>
        <View style={styles.terminalHeader}>
          <View style={styles.terminalHeaderLeft}>
            <Terminal size={16} color="#10b981" />
            <Text style={styles.terminalTitle}>Runtime Logs & Tracebacks</Text>
          </View>
          <View style={styles.logCountBadge}>
            <Text style={styles.logCountText}>{logs.length} logs</Text>
          </View>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.terminalBody}
          contentContainerStyle={styles.terminalContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {logs.length === 0 ? (
            <Text style={styles.emptyLogText}>
              Belum ada log dari server Python...{'\n'}
              (Jika server belum aktif, buka server.py atau jalankan di Development Build)
            </Text>
          ) : (
            logs.map((item) => {
              const isError = item.level === 'ERROR';
              const isWarn = item.level === 'WARN';

              return (
                <View key={item.id} style={styles.logRow}>
                  <Text style={styles.logTime}>{item.time}</Text>
                  <Text
                    style={[
                      styles.logLevel,
                      isError
                        ? styles.logLevelError
                        : isWarn
                        ? styles.logLevelWarn
                        : styles.logLevelInfo,
                    ]}
                  >
                    [{item.level}]
                  </Text>
                  <Text
                    style={[
                      styles.logMessage,
                      isError ? styles.logMsgError : isWarn ? styles.logMsgWarn : styles.logMsgInfo,
                    ]}
                  >
                    {item.message}
                  </Text>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  appTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1,
  },
  appSubtitle: {
    fontSize: 12,
    color: '#a3a3a3',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusOnline: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  statusOffline: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  statusChecking: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#171717',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#262626',
    marginBottom: 14,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  cardLabel: {
    fontSize: 13,
    color: '#888888',
  },
  cardValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  hostSwitchRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 8,
  },
  hostSwitchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#262626',
    borderWidth: 1,
    borderColor: '#383838',
  },
  hostSwitchBtnActive: {
    backgroundColor: '#2563eb',
    borderColor: '#3b82f6',
  },
  hostSwitchText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9ca3af',
  },
  hostSwitchTextActive: {
    color: '#ffffff',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  btnPing: {
    backgroundColor: '#2563eb',
  },
  btnError: {
    backgroundColor: '#dc2626',
  },
  btnClear: {
    backgroundColor: '#262626',
    flex: 0.7,
  },
  btnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  terminalContainer: {
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#262626',
    overflow: 'hidden',
    marginBottom: 10,
  },
  terminalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#121212',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  terminalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  terminalTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e5e5e5',
  },
  logCountBadge: {
    backgroundColor: '#262626',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  logCountText: {
    fontSize: 10,
    color: '#a3a3a3',
    fontWeight: '600',
  },
  terminalBody: {
    flex: 1,
    padding: 10,
  },
  terminalContent: {
    paddingBottom: 20,
  },
  emptyLogText: {
    color: '#525252',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 40,
    lineHeight: 18,
  },
  logRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 6,
    alignItems: 'flex-start',
  },
  logTime: {
    fontSize: 11,
    color: '#525252',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginRight: 6,
  },
  logLevel: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginRight: 6,
  },
  logLevelInfo: {
    color: '#10b981',
  },
  logLevelError: {
    color: '#ef4444',
  },
  logLevelWarn: {
    color: '#f59e0b',
  },
  logMessage: {
    flex: 1,
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  logMsgInfo: {
    color: '#e5e5e5',
  },
  logMsgError: {
    color: '#f87171',
  },
  logMsgWarn: {
    color: '#fbbf24',
  },
});
