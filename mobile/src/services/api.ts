/**
 * API Service Barrel Export
 * Menyediakan akses modular terpusat ke seluruh domain fungsional API:
 * - types: Definisi tipe data & antarmuka bersama
 * - errors: Kamus error & custom error class ApiError
 * - client: Base URL & utilitas ping status server
 * - paths: Generator nama file & alokasi direktori penyimpanan
 * - fileResolver: Pengecekan keberadaan & resolver URI file fisik lokal
 * - cookies: Manajemen & sinkronisasi file cookies Google Drive
 * - youtubeStream: Ekstraksi metadata YouTube & arsitektur caching kualitas video
 * - downloadStreamCache: Manajemen caching URL stream khusus download
 * - downloader: Pengunduh klip dinamis & full video
 * - subtitles: Parser subtitle VTT/JSON3 & persistensi subtitle per-klip
 * - templates: Konfigurasi template layout klip & video global config
 * - subtitleBurner: Ekstraksi & penempelan subtitle permanen (burn-in via FFmpeg)
 */

export * from './api';
