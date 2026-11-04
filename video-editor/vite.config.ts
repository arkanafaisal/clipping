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
