/**
 * Konfigurasi Tetap (Fixed Constants) untuk Google Drive Downloader.
 * Sesuai arsitektur True Pass-Through (Rule 16):
 * Backend Python tidak menyimpan URL, headers, atau timeout secara hardcoded.
 * Seluruh parameter pengunduhan dikirim secara dinamis dari Frontend ke Backend.
 */

export interface GDriveDownloadConfig {
  urlTemplates: string[];
  headers: Record<string, string>;
  timeout: number;
}

export const DEFAULT_GDRIVE_DOWNLOAD_CONFIG: GDriveDownloadConfig = {
  urlTemplates: [
    'https://drive.usercontent.google.com/download?id={file_id}&export=download&authuser=0&confirm=t',
    'https://drive.google.com/uc?export=download&id={file_id}&confirm=t',
    'https://drive.google.com/uc?id={file_id}&export=download',
  ],
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  },
  timeout: 30,
};
