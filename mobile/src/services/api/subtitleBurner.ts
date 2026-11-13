import { Platform } from 'react-native';
import { isPythonInitialized, getNativeRunnerInfo, executePythonScript } from '../../../modules/python-runner';
import { ApiError } from './errors';
import { DEV_API_BASE_URL } from './client';
import { INTERNAL_CLIPPING_OUTPUT_DIR, getSubtitledClipOutputFilePath } from './paths';
import { BurnSubtitlesParams, BurnSubtitlesResult } from './types';

/**
 * Mengekspor klip baru dengan subtitle dan template layout yang tertempel permanen (burn-in via FFmpeg).
 * Video klip asli yang sudah di-download tetap utuh di lokasinya.
 */
export async function burnClipSubtitles({
  videoId,
  start,
  end,
  inputVideoPath,
  outputVideoPath,
  subtitleData,
  templateData,
  duration,
}: BurnSubtitlesParams): Promise<BurnSubtitlesResult> {
  const finalOutputPath = outputVideoPath || getSubtitledClipOutputFilePath(videoId, start, end).nativePath;
  const clipDuration = duration ?? (end - start);

  const nativeInfo = getNativeRunnerInfo();
  const nativeFfmpeg = nativeInfo?.ffmpegExists ? nativeInfo.ffmpegPath : undefined;
  const isNative = Platform.OS === 'android' && isPythonInitialized();

  const progressPath = `${INTERNAL_CLIPPING_OUTPUT_DIR}/${videoId}/burn_progress.json`;

  let data: any = null;

  if (isNative) {
    data = await executePythonScript('utils.subtitle_burner', 'burn_subtitles_to_video', {
      input_video_path: inputVideoPath,
      output_video_path: finalOutputPath,
      subtitle_data: subtitleData,
      template_data: templateData,
      ffmpeg_bin: nativeFfmpeg,
      progress_path: progressPath,
      duration: clipDuration,
    });
  } else {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000);
    try {
      const response = await fetch(`${DEV_API_BASE_URL}/api/burn-subtitles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input_video_path: inputVideoPath,
          output_video_path: finalOutputPath,
          subtitle_data: subtitleData,
          template_data: templateData,
          ffmpeg_bin: nativeFfmpeg,
          progress_path: progressPath,
          duration: clipDuration,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      data = await response.json().catch(() => ({}));
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  const payload = (data?.data && typeof data.data === 'object') ? data.data : data;

  if (!payload || payload.status !== 'success') {
    const rawError = payload?.traceback || payload?.error || (payload ? JSON.stringify(payload, null, 2) : 'Gagal menempelkan subtitle');
    const code = payload?.code || 'FFMPEG_BURN_ERROR';
    throw new ApiError(code, rawError);
  }

  return {
    status: 'success',
    outputPath: payload.output_path || finalOutputPath,
  };
}
