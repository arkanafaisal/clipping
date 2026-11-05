import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';

function saveDataPlugin(): Plugin {
  return {
    name: 'save-data-plugin',
    configureServer(server) {
      server.middlewares.use('/api/save-data', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const dataPath = path.resolve(__dirname, 'src/data.json');
              fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err?.message || 'Error saving data' }));
            }
          });
        } else {
          res.statusCode = 405;
          res.end('Method Not Allowed');
        }
      });

      // Deteksi & download otomatis image.jpg dari Google Drive saat reload
      server.middlewares.use('/api/check-image', async (req, res) => {
        if (req.method === 'GET' || req.method === 'POST') {
          try {
            const { syncMomentImage } = await import('./scripts/gdrive.js');
            const result = await syncMomentImage();
            const dataPath = path.resolve(__dirname, 'src/data.json');
            const updatedData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: true,
                downloaded: result?.downloaded ?? false,
                metadata: updatedData,
              })
            );
          } catch (err: any) {
            console.warn('Sync image warning:', err?.message);
            const dataPath = path.resolve(__dirname, 'src/data.json');
            const currentData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: false,
                error: err?.message,
                metadata: currentData,
              })
            );
          }
        } else {
          res.statusCode = 405;
          res.end('Method Not Allowed');
        }
      });

      // Deteksi & download otomatis full.mp4 dari Google Drive saat reload
      server.middlewares.use('/api/check-video', async (req, res) => {
        if (req.method === 'GET' || req.method === 'POST') {
          try {
            const { syncMomentVideo } = await import('./scripts/gdrive.js');
            const result = await syncMomentVideo();
            const dataPath = path.resolve(__dirname, 'src/data.json');
            const updatedData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: true,
                downloaded: result?.downloaded ?? false,
                metadata: updatedData,
              })
            );
          } catch (err: any) {
            console.warn('Sync video warning:', err?.message);
            const dataPath = path.resolve(__dirname, 'src/data.json');
            const currentData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: false,
                error: err?.message,
                metadata: currentData,
              })
            );
          }
        } else {
          res.statusCode = 405;
          res.end('Method Not Allowed');
        }
      });

      // Deteksi & download otomatis semua aset (video full.mp4 + kartu image.jpg) saat reload
      server.middlewares.use('/api/check-assets', async (req, res) => {
        if (req.method === 'GET' || req.method === 'POST') {
          try {
            const { ensureMomentAssets } = await import('./scripts/gdrive.js');
            const result = await ensureMomentAssets();
            const dataPath = path.resolve(__dirname, 'src/data.json');
            const updatedData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: true,
                imageDownloaded: result?.image?.downloaded ?? false,
                videoDownloaded: result?.video?.downloaded ?? false,
                metadata: updatedData,
              })
            );
          } catch (err: any) {
            console.warn('Ensure assets warning:', err?.message);
            const dataPath = path.resolve(__dirname, 'src/data.json');
            const currentData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: false,
                error: err?.message,
                metadata: currentData,
              })
            );
          }
        } else {
          res.statusCode = 405;
          res.end('Method Not Allowed');
        }
      });

      // Mengambil daftar folder dari root Google Drive untuk dashboard
      server.middlewares.use('/api/folders', async (req, res) => {
        if (req.method === 'GET') {
          try {
            const { listRootFolders } = await import('./scripts/gdrive.js');
            const folders = await listRootFolders();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, folders }));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err?.message, folders: [] }));
          }
        } else {
          res.statusCode = 405;
          res.end('Method Not Allowed');
        }
      });

      // Memilih momen: inisialisasi di data.json jika belum ada & unduh asetnya
      server.middlewares.use('/api/select-moment', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const { folderId, folderName } = JSON.parse(body);
              const { initOrEnsureMoment } = await import('./scripts/gdrive.js');
              const result = await initOrEnsureMoment(folderId, folderName);
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  success: true,
                  moment: result.moment,
                  metadata: result.metadata,
                })
              );
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err?.message }));
            }
          });
        } else {
          res.statusCode = 405;
          res.end('Method Not Allowed');
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), saveDataPlugin()],
  server: {
    port: 5174,
  },
});
