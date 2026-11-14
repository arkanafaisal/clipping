import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';
import { PRIME_CLIP_DOWNLOAD_OPTS, PROXY_FULL_VIDEO_YTDL_OPTS } from '../../constants/ytdlp';
import { isPythonInitialized, getNativeRunnerInfo, executePythonScript } from '../../../modules/python-runner';
import { ApiError } from './errors';
import { DEV_API_BASE_URL } from './client';
import { getValidCookiesPath } from './cookies';
import {
  SHARED_CLIPPING_OUTPUT_DIR,
  INTERNAL_CLIPPING_OUTPUT_DIR,
  getClipOutputFilePath,
  getClipInternalOutputFilePath,
  getFullVideoFilePath,
  getFullVideoProxyFilePath,
} from './paths';
import { DOWNLOADED_CLIPS_CACHE } from './fileResolver';
import {
  getCachedDownloadStreamUrl,
  saveCachedDownloadStreamUrl,
  clearCachedDownloadStreamUrl,
} from './downloadStreamCache';

/**
 * Mendownload rentang klip tertentu secara dinamis dengan kualitas prime dan stream reconnect.
 * Mendukung dual-storage: mencoba shared storage (/storage/emulated/0/clipping) terlebih dahulu,
 * dan otomatis beralih ke internal sandbox storage jika terkendala izin akses penyimpanan (Permission Denied).
 * Non-blocking: berjalan di background tanpa menghambat thread interaksi UI.
 */
export async function downloadClip(
  videoId: string,
  start: number,
  end: number,
  rank?: number | string,
  progressPath?: string,
  qualityId?: string
): Promise<{ status: string; output_path: string; fileUri: string; stream_url?: string }> {
  // Kandidat 1: Shared Storage (/storage/emulated/0/clipping/output/...)
  // Kandidat 2: Internal Sandbox Storage (/data/user/0/com.clipping.app/files/clipping/output/...)
  const candidates = [
    getClipOutputFilePath(videoId, start, end, rank),
    getClipInternalOutputFilePath(videoId, start, end, rank),
  ];

  const cachedStreamUrl = await getCachedDownloadStreamUrl(videoId, qualityId);
  const cookiePath = await getValidCookiesPath();
  let lastError: any = null;

  for (let c = 0; c < candidates.length; c++) {
    const { fileUri, nativePath } = candidates[c];
    const isShared = c === 0;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 menit timeout download klip

    // Simpan cache metadata video_info.json murni di internal sandbox privat
    // agar pembacaan & penulisan JSON tidak melanggar Scoped Storage Android di shared storage
    const internalVideoDir = `${INTERNAL_CLIPPING_OUTPUT_DIR}/${videoId}`;
    const infoJsonPath = `${internalVideoDir}/video_info.json`;

    try {
      const internalDirUri = `file://${internalVideoDir}`;
      const dirInfo = await FileSystem.getInfoAsync(internalDirUri);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(internalDirUri, { intermediates: true });
      }
    } catch {}

    const nativeInfo = getNativeRunnerInfo();
    const nativeFfmpeg = nativeInfo?.ffmpegExists ? nativeInfo.ffmpegPath : undefined;

    const clipYdlOpts = {
      ...PRIME_CLIP_DOWNLOAD_OPTS,
      load_info_filename: infoJsonPath,
      writeinfojson: false, // Matikan pembuatan file .info.json di shared storage agar folder bersih & tidak ditolak izin storage
      ...(nativeFfmpeg ? { ffmpeg_location: nativeFfmpeg } : {}),
    };

    if (!isShared) {
      try {
        const internalDirUri = `file://${INTERNAL_CLIPPING_OUTPUT_DIR}/${videoId}`;
        const dirInfo = await FileSystem.getInfoAsync(internalDirUri);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(internalDirUri, { intermediates: true });
        }
      } catch {}
    }

    // Cek apakah file fisik full video sudah ada di shared storage untuk pemotongan lokal super cepat
    const fullVideo = getFullVideoFilePath(videoId);
    let sourceVideoPath: string | undefined = undefined;
    try {
      const fullInfo = await FileSystem.getInfoAsync(fullVideo.fileUri);
      if (fullInfo.exists && ((fullInfo as any).size === undefined || (fullInfo as any).size > 0)) {
        sourceVideoPath = fullVideo.nativePath;
      }
    } catch {}

    try {
      let data: any = null;
      const isNative = Platform.OS === 'android' && isPythonInitialized();

      if (isNative) {
        data = await executePythonScript('utils.clip_downloader', 'download_clip_direct', {
          video_id: videoId,
          start,
          end,
          output_path: nativePath,
          ydl_opts: clipYdlOpts,
          stream_url: cachedStreamUrl || undefined,
          cookie_path: cookiePath,
          progress_path: progressPath,
          source_video_path: sourceVideoPath,
          quality_id: qualityId || undefined,
        });
      } else {
        // Fallback ke DEV_API_BASE_URL (port 3006 / Termux) jika mode dev
        const response = await fetch(`${DEV_API_BASE_URL}/api/download-clip`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            video_id: videoId,
            start,
            end,
            output_path: nativePath,
            stream_url: cachedStreamUrl || undefined,
            cookie_path: cookiePath,
            ydl_opts: clipYdlOpts,
            progress_path: progressPath,
            source_video_path: sourceVideoPath,
            quality_id: qualityId || undefined,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        data = await response.json().catch(() => ({}));
      }

      const payload = (data?.data && typeof data.data === 'object') ? data.data : data;

      // Tangkap download stream URL dari response skrip dan simpan jika baru / berbeda
      if (payload?.stream_url && payload.stream_url !== cachedStreamUrl) {
        await saveCachedDownloadStreamUrl(videoId, payload.stream_url, qualityId);
      }

      if (!payload || payload.status !== 'success') {
        const rawError = payload?.traceback || payload?.error || (payload ? JSON.stringify(payload, null, 2) : 'Gagal mengunduh klip');
        const lowerRaw = rawError.toLowerCase();

        const isPermissionError =
          lowerRaw.includes('permission denied') ||
          lowerRaw.includes('operation not permitted') ||
          lowerRaw.includes('not permitted') ||
          lowerRaw.includes('errno 13') ||
          lowerRaw.includes('errno 1');

        // Jika permission/EPERM error pada shared storage dan masih ada internal sandbox fallback, coba fallback
        if (isPermissionError && isShared) {
          console.warn(`[DownloadClip] Permission/EPERM error pada shared path ${nativePath}, mencoba internal sandbox fallback...`);
          continue;
        }

        // Bersihkan cache URL stream & file info JSON agar request berikutnya tidak terjebak cache lama
        await clearCachedDownloadStreamUrl(videoId);
        FileSystem.deleteAsync(`file://${infoJsonPath}`, { idempotent: true }).catch(() => {});

        let code = payload?.code || data?.code || data?.message || 'DOWNLOAD_FAILED';

        if (isPermissionError) {
          code = 'STORAGE_PERMISSION_DENIED';
        } else if (lowerRaw.includes('requested format is not available') || lowerRaw.includes('format is not available')) {
          code = 'FORMAT_NOT_AVAILABLE';
        } else if (lowerRaw.includes('sign in to confirm') || lowerRaw.includes('bot verification')) {
          code = 'BOT_DETECTED';
        }

        throw new ApiError(code, rawError);
      }

      // Tandai pada in-memory cache untuk kedua URI (shared dan internal)
      DOWNLOADED_CLIPS_CACHE.set(fileUri, true);
      DOWNLOADED_CLIPS_CACHE.set(candidates[0].fileUri, true);

      // Sinkronisasi otomatis ke Shared Storage jika tadi disimpan di internal sandbox
      if (fileUri !== candidates[0].fileUri) {
        try {
          const sharedTargetUri = candidates[0].fileUri;
          const targetDir = `file://${SHARED_CLIPPING_OUTPUT_DIR}/${videoId}`;
          const targetDirInfo = await FileSystem.getInfoAsync(targetDir);
          if (!targetDirInfo.exists) {
            await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });
          }
          await FileSystem.copyAsync({
            from: fileUri,
            to: sharedTargetUri,
          });
          console.log(`[DownloadClip] Berhasil menduplikasi klip ke shared storage: ${sharedTargetUri}`);
        } catch (copyErr) {
          console.warn('[DownloadClip] Gagal menyalin ke shared storage:', copyErr);
        }
      }

      // Sinkronisasi file klip ke Galeri/Shared Storage perangkat via MediaStore (sesuai Rule 20)
      try {
        const { status } = await MediaLibrary.getPermissionsAsync();
        if (status === 'granted') {
          await MediaLibrary.createAssetAsync(fileUri);
        } else {
          const req = await MediaLibrary.requestPermissionsAsync();
          if (req.status === 'granted') {
            await MediaLibrary.createAssetAsync(fileUri);
          }
        }
      } catch (mediaErr) {
        console.warn('[DownloadClip] Gagal mendaftarkan klip ke MediaLibrary:', mediaErr);
      }

      return {
        status: 'success',
        output_path: nativePath,
        fileUri,
        stream_url: data.stream_url,
      };
    } catch (error: any) {
      clearTimeout(timeoutId);
      lastError = error;
      const lowerErr = (error.message || '').toLowerCase() + ' ' + (error.rawError || '').toLowerCase();
      const isErrPermission =
        lowerErr.includes('permission denied') ||
        lowerErr.includes('operation not permitted') ||
        lowerErr.includes('not permitted') ||
        lowerErr.includes('errno 13') ||
        lowerErr.includes('errno 1');

      if (isErrPermission && isShared) {
        console.warn(`[DownloadClip] Error permission pada ${nativePath}, beralih ke internal sandbox...`);
        continue;
      }
      if (error instanceof ApiError) throw error;
      let code = 'DOWNLOAD_FAILED';
      if (isErrPermission) {
        code = 'STORAGE_PERMISSION_DENIED';
      } else if (error.name === 'AbortError') {
        code = 'NETWORK_TIMEOUT';
      }
      throw new ApiError(code, error.message);
    }
  }

  throw lastError || new ApiError('DOWNLOAD_FAILED', 'Gagal mengunduh klip video.');
}

/**
 * Mendownload satu video penuh YouTube secara utuh ke shared storage:
 * /storage/emulated/0/clipping/output/<videoId>/full.mp4
 * Digunakan untuk mode offline playback dan pemotongan klip instan 0ms secara lokal.
 */
export async function downloadFullVideo(
  videoId: string,
  onProgress?: (info: { stage: string; code: string; percent: number }) => void,
  qualityId?: string
): Promise<{ status: string; output_path: string; fileUri: string; proxy_output_path?: string; proxyFileUri?: string }> {
  const { fileUri, nativePath } = getFullVideoFilePath(videoId);
  const { fileUri: proxyFileUri, nativePath: proxyNativePath } = getFullVideoProxyFilePath(videoId);
  const targetDirUri = `file://${SHARED_CLIPPING_OUTPUT_DIR}/${videoId}`;

  try {
    const dirInfo = await FileSystem.getInfoAsync(targetDirUri);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(targetDirUri, { intermediates: true });
    }
  } catch {}

  const cookiePath = await getValidCookiesPath();
  const progressFile = `${FileSystem.cacheDirectory}full_progress_${videoId}.json`;
  const nativeProgressPath = progressFile.replace('file://', '');

  const nativeInfo = getNativeRunnerInfo();
  const nativeFfmpeg = nativeInfo?.ffmpegExists ? nativeInfo.ffmpegPath : undefined;

  const ydlOpts = {
    ...PRIME_CLIP_DOWNLOAD_OPTS,
    writeinfojson: false,
    ...(nativeFfmpeg ? { ffmpeg_location: nativeFfmpeg } : {}),
    ...(qualityId ? { quality_id: qualityId } : {}),
  };

  let isPolling = true;
  const pollInterval = setInterval(async () => {
    if (!isPolling) return;
    try {
      const pInfo = await FileSystem.getInfoAsync(progressFile);
      if (pInfo.exists) {
        const raw = await FileSystem.readAsStringAsync(progressFile);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.stage && onProgress) {
            onProgress(parsed);
          }
        }
      }
    } catch {}
  }, 300);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 menit timeout untuk full video

  try {
    let data: any = null;
    const isNative = Platform.OS === 'android' && isPythonInitialized();

    if (isNative) {
      data = await executePythonScript('utils.clip_downloader', 'download_full_video_direct', {
        video_id: videoId,
        output_path: nativePath,
        cookie_path: cookiePath,
        ydl_opts: ydlOpts,
        progress_path: nativeProgressPath,
        proxy_output_path: proxyNativePath,
        proxy_ydl_opts: PROXY_FULL_VIDEO_YTDL_OPTS,
        quality_id: qualityId || undefined,
      });
    } else {
      const response = await fetch(`${DEV_API_BASE_URL}/api/download-full-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_id: videoId,
          output_path: nativePath,
          cookie_path: cookiePath,
          ydl_opts: ydlOpts,
          progress_path: nativeProgressPath,
          proxy_output_path: proxyNativePath,
          proxy_ydl_opts: PROXY_FULL_VIDEO_YTDL_OPTS,
          quality_id: qualityId || undefined,
        }),
        signal: controller.signal,
      });
      data = await response.json().catch(() => ({}));
    }

    clearTimeout(timeoutId);
    isPolling = false;
    clearInterval(pollInterval);
    FileSystem.deleteAsync(progressFile, { idempotent: true }).catch(() => {});

    const payload = (data?.data && typeof data.data === 'object') ? data.data : data;

    if (!payload || payload.status !== 'success') {
      const rawError = payload?.error || (payload ? JSON.stringify(payload, null, 2) : 'Gagal mengunduh full video');
      let code = payload?.code || data?.code || 'DOWNLOAD_FAILED';
      throw new ApiError(code, rawError);
    }

    return {
      status: 'success',
      output_path: nativePath,
      fileUri,
      proxy_output_path: proxyNativePath,
      proxyFileUri,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    isPolling = false;
    clearInterval(pollInterval);
    FileSystem.deleteAsync(progressFile, { idempotent: true }).catch(() => {});
    if (err instanceof ApiError) throw err;
    throw new ApiError(err.name === 'AbortError' ? 'TIMEOUT' : 'DOWNLOAD_FAILED', err.message);
  }
}
