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

export function isPythonInitialized(): boolean {
  if (NativePythonRunner && typeof NativePythonRunner.isInitialized === 'function') {
    return NativePythonRunner.isInitialized();
  }
  return false;
}

export function getPythonLastError(): string | null {
  if (NativePythonRunner && typeof NativePythonRunner.getLastError === 'function') {
    return NativePythonRunner.getLastError();
  }
  return null;
}

export function setupPythonPaths(customRootPath: string): string {
  if (NativePythonRunner && typeof NativePythonRunner.setupPaths === 'function') {
    return NativePythonRunner.setupPaths(customRootPath);
  }
  return 'FALLBACK';
}

export async function executePythonScript(
  moduleName: string,
  funcName: string,
  args: Record<string, any> = {}
): Promise<any> {
  if (!NativePythonRunner || typeof NativePythonRunner.executeScript !== 'function') {
    throw new Error('Native PythonRunner module is not available on this platform.');
  }

  const argsJson = JSON.stringify(args);
  try {
    const rawResult = await NativePythonRunner.executeScript(moduleName, funcName, argsJson);
    try {
      return JSON.parse(rawResult);
    } catch {
      return rawResult;
    }
  } catch (nativeErr: any) {
    return {
      status: 'error',
      code: nativeErr.code || 'NATIVE_EXECUTION_ERROR',
      error: nativeErr.message || String(nativeErr),
      traceback: nativeErr.stack || String(nativeErr),
    };
  }
}

export interface NativeRunnerInfo {
  nativeLibDir: string;
  ffmpegPath: string;
  ffmpegExists: boolean;
  ffmpegCanExecute: boolean;
}

export function getNativeRunnerInfo(): NativeRunnerInfo | null {
  if (NativePythonRunner && typeof NativePythonRunner.getNativeInfo === 'function') {
    try {
      return NativePythonRunner.getNativeInfo() as NativeRunnerInfo;
    } catch {
      return null;
    }
  }
  return null;
}
export function checkStoragePermission(): boolean {
  if (NativePythonRunner && typeof NativePythonRunner.checkStoragePermission === 'function') {
    try {
      return Boolean(NativePythonRunner.checkStoragePermission());
    } catch {
      return false;
    }
  }
  return true;
}

export function requestStoragePermission(): boolean {
  if (NativePythonRunner && typeof NativePythonRunner.requestStoragePermission === 'function') {
    try {
      return Boolean(NativePythonRunner.requestStoragePermission());
    } catch {
      return false;
    }
  }
  return false;
}

