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

      // Sajikan file hasil ekspor video dari folder out/
      server.middlewares.use('/out', (req, res, next) => {
        try {
          const filePath = path.resolve(
            __dirname,
            'out',
            decodeURIComponent((req.url || '').replace(/^\//, ''))
          );
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const stat = fs.statSync(filePath);
            res.writeHead(200, {
              'Content-Type': 'video/mp4',
              'Content-Length': stat.size,
            });
            fs.createReadStream(filePath).pipe(res);
            return;
          }
        } catch (e) {}
        next();
      });

      // Memicu ekspor video Remotion langsung dari Web UI
      server.middlewares.use('/api/render', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const { momentId, style } = JSON.parse(body || '{}');
              const dataPath = path.resolve(__dirname, 'src/data.json');
              const metadata = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

              if (momentId) {
                metadata.activeMomentId = momentId;
              }
              if (style) {
                metadata.activeStyle = style;
              }
              fs.writeFileSync(dataPath, JSON.stringify(metadata, null, 2), 'utf-8');

              const moment =
                (metadata.moments || []).find(
                  (m: any) =>
                    m.id === momentId ||
                    m.name === momentId ||
                    m.path === momentId
                ) || metadata.moments?.[0];

              const compositionId =
                style === 'roulette-quiz' ? 'RouletteQuiz' : 'MemeDiscovery';
              const cleanMomentSlug =
                moment?.path ||
                (moment?.name ? moment.name.replace(/\s+/g, '-') : 'output');
              const outputDir = path.resolve(__dirname, 'out');
              fs.mkdirSync(outputDir, { recursive: true });
              const outputFile = path.join(outputDir, `${cleanMomentSlug}.mp4`);
              const outputRelPath = `out/${cleanMomentSlug}.mp4`;

              console.log(
                `\n🎬 [Render API] Memulai rendering video: ${compositionId} -> ${outputRelPath}...`
              );

              const { spawn } = await import('child_process');
              const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
              const renderProcess = spawn(
                npxCmd,
                [
                  'remotion',
                  'render',
                  'src/remotion/index.ts',
                  compositionId,
                  outputFile,
                ],
                { cwd: __dirname, stdio: ['ignore', 'pipe', 'pipe'] }
              );

              let stdoutData = '';
              let stderrData = '';
              renderProcess.stdout.on('data', (chunk) => {
                stdoutData += chunk.toString();
              });
              renderProcess.stderr.on('data', (chunk) => {
                stderrData += chunk.toString();
              });

              renderProcess.on('close', (code) => {
                if (code === 0) {
                  console.log(
                    `✅ [Render API] Berhasil merender video: ${outputFile}`
                  );
                  res.setHeader('Content-Type', 'application/json');
                  res.end(
                    JSON.stringify({
                      success: true,
                      outputPath: outputRelPath,
                      fullPath: outputFile,
                    })
                  );
                } else {
                  console.error(
                    `❌ [Render API] Gagal render: exit code ${code}`
                  );
                  console.error(stderrData || stdoutData);
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(
                    JSON.stringify({
                      success: false,
                      error: `Render gagal dengan kode keluar ${code}`,
                      details: stderrData || stdoutData,
                    })
                  );
                }
              });
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
