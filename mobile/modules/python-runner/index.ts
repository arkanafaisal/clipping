import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

let NativePythonRunner: any = null;

try {
  if (Platform.OS === 'android') {
    NativePythonRunner = requireNativeModule('PythonRunner');
  }
} catch (e) {
  console.log('[PythonRunner] Native module not loaded yet:', e);
}

export function startPythonServer(): string {
  if (NativePythonRunner && typeof NativePythonRunner.startServer === 'function') {
    return NativePythonRunner.startServer();
  }
  return 'FALLBACK';
}

export function isPythonRunning(): boolean {
  if (NativePythonRunner && typeof NativePythonRunner.isServerRunning === 'function') {
    return NativePythonRunner.isServerRunning();
  }
  return false;
}

export function getPythonLastError(): string | null {
  if (NativePythonRunner && typeof NativePythonRunner.getLastError === 'function') {
    return NativePythonRunner.getLastError();
  }
  return null;
}

export const SERVER_HOST = 'http://127.0.0.1:8080';
