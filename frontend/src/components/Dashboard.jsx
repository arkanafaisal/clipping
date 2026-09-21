import { useState, useEffect } from 'react';
import { Play, Plus, Trash2, MessageCircle, Copy, Download } from 'lucide-react';

function formatTimeWithMs(seconds) {
  if (seconds === undefined || seconds === null) return '00:00:00.000';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  const pad = (num, len = 2) => num.toString().padStart(len, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
}

export default function Dashboard({ onOpenWorkshop }) {
  const [workshops, setWorkshops] = useState([]);
  const [urlInput, setUrlInput] = useState('');
  const [countInput, setCountInput] = useState('50'); // Jadikan string sementara untuk mempermudah pengetikan
  const [error, setError] = useState('');
  
  // Import Modal State
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('workshops_list');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Sort descending based on lastUpdated (if missing, assume 0)
      parsed.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
      setWorkshops(parsed);
    }
  }, []);

  const updateLastSeenAndOpen = (videoId, count) => {
    // Update lastUpdated di local storage
    const saved = JSON.parse(localStorage.getItem('workshops_list') || '[]');
    const existingIndex = saved.findIndex(w => w.videoId === videoId);
    if (existingIndex >= 0) {
      saved[existingIndex].lastUpdated = Date.now();
      localStorage.setItem('workshops_list', JSON.stringify(saved));
    }
    // Teruskan ke App.jsx
    onOpenWorkshop(videoId, count);
  };

  const extractVideoId = (url) => {
    // Regex standar industri untuk mencakup semua format YouTube (termasuk shorts dan live)
    const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regExp);
    if (match && match[1].length === 11) return match[1];

    // Fallback: Jika user iseng hanya menempelkan 11 karakter ID murni
    if (url.trim().length === 11) return url.trim();

    return null;
  };

  const handleExportWorkshop = (ws, e) => {
    e.stopPropagation();
    const videoId = ws.videoId;
    const draft = localStorage.getItem(`clips_draft_${videoId}`);
    const heatmap = localStorage.getItem(`heatmap_cache_${videoId}`);
    
    const payload = {
      workshop: ws,
      draft: draft,
      heatmap: heatmap
    };
    
    const jsonStr = JSON.stringify(payload);
    
    // Fallback untuk akses via IP (HTTP) yang memblokir navigator.clipboard
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(jsonStr)
        .then(() => alert(`Data Workshop (Video: ${ws.videoId}) berhasil disalin ke clipboard!\n\nPaste teks tersebut di VPS Prod Anda.`))
        .catch(() => alert('Gagal menyalin ke clipboard. Coba gunakan browser yang mendukung fitur clipboard.'));
    } else {
      // Cara tradisional (textarea fallback)
      const textArea = document.createElement("textarea");
      textArea.value = jsonStr;
      
      // Agar layar tidak melompat ke bawah
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.position = "fixed";

      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        const successful = document.execCommand('copy');
        if (successful) {
          alert(`Data Workshop (Video: ${ws.videoId}) berhasil disalin ke clipboard (Via Fallback)!\n\nPaste teks tersebut di VPS Prod Anda.`);
        } else {
          alert('Gagal menyalin otomatis. Anda mungkin harus mengunduh file JSON.');
        }
      } catch (err) {
        alert("Browser Anda menolak fitur Copy. Silakan coba buka via 'localhost' alih-alih IP.");
      }
      document.body.removeChild(textArea);
    }
  };

  const handleImportWorkshop = () => {
    setImportText('');
    setImportModalOpen(true);
  };

  const processImport = () => {
    const input = importText.trim();
    if (!input) return;
    
    try {
      const data = JSON.parse(input);
      if (!data.workshop || !data.workshop.videoId) {
        throw new Error('Data tidak valid. Harus berisi data workshop.');
      }
      
      const videoId = data.workshop.videoId;
      
      // Update workshops_list
      const saved = JSON.parse(localStorage.getItem('workshops_list') || '[]');
      const existingIndex = saved.findIndex(w => w.videoId === videoId);
      if (existingIndex >= 0) {
        saved[existingIndex] = data.workshop;
      } else {
        saved.push(data.workshop);
      }
      localStorage.setItem('workshops_list', JSON.stringify(saved));
      
      // Update draft and heatmap
      if (data.draft) localStorage.setItem(`clips_draft_${videoId}`, data.draft);
      if (data.heatmap) localStorage.setItem(`heatmap_cache_${videoId}`, data.heatmap);
      
      alert('Workshop berhasil di-import secara ajaib! Halaman akan dimuat ulang.');
      window.location.reload();
    } catch(err) {
      alert('Gagal! Format data yang Anda paste salah atau terpotong.');
      console.error(err);
    }
  };

  const handleCreate = (e) => {
    e.preventDefault();
    setError('');

    if (!urlInput) {
      setError('Masukkan link YouTube terlebih dahulu.');
      return;
    }

    const videoId = extractVideoId(urlInput);
    if (!videoId) {
      setError('Format Link YouTube tidak valid.');
      return;
    }

    const finalCount = parseInt(countInput, 10) || 50;

    // Check if exists
    const exists = workshops.find(w => w.videoId === videoId);
    if (exists) {
      // Jika sudah ada, buka workshop tersebut dan perbarui jumlah klipnya
      updateLastSeenAndOpen(videoId, finalCount);
      return;
    }

    // Jika baru, lempar ke App router (nanti Feed.jsx yang akan menambahkannya ke workshops_list)
    onOpenWorkshop(videoId, finalCount);
  };

  const handleEditCount = (videoId, currentCount, e) => {
    e.stopPropagation();
    const input = window.prompt("Masukkan jumlah klip baru untuk ditampilkan (maks 100):", currentCount);
    if (input !== null) {
      const newCount = parseInt(input, 10);
      if (!isNaN(newCount) && newCount > 0) {
        const newWorkshops = workshops.map(w => {
          if (w.videoId === videoId) return { ...w, count: newCount };
          return w;
        });
        setWorkshops(newWorkshops);
        localStorage.setItem('workshops_list', JSON.stringify(newWorkshops));
      } else {
        alert("Jumlah klip tidak valid.");
      }
    }
  };

  const handleDelete = (videoId, e) => {
    e.stopPropagation(); // Mencegah klik masuk ke Feed
    const confirm = window.confirm('Yakin ingin menghapus draf ini?');
    if (confirm) {
      const newWorkshops = workshops.filter(w => w.videoId !== videoId);
      setWorkshops(newWorkshops);
      localStorage.setItem('workshops_list', JSON.stringify(newWorkshops));
      localStorage.removeItem(`clips_draft_${videoId}`);
    }
  };

  const handleBulkWA = (videoId, e) => {
    e.stopPropagation();

    const stored = localStorage.getItem(`clips_draft_${videoId}`);
    if (!stored) {
      alert("Tidak ada draft klip untuk video ini.");
      return;
    }

    try {
      const clips = JSON.parse(stored);
      const doneClips = clips
        .filter(c => c.status === 'done')
        .sort((a, b) => a.start - b.start);

      if (doneClips.length === 0) {
        alert("Tidak ada klip yang ditandai Selesai (Hijau) pada video ini.");
        return;
      }

      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      let command = `!download ${videoUrl}\n`;

      doneClips.forEach(c => {
        command += `${formatTimeWithMs(c.start)} - ${formatTimeWithMs(c.end)}\n`;
      });

      const encodedCommand = encodeURIComponent(command.trim());
      const BOT_NUMBER = "6285742923730";
      const waUrl = BOT_NUMBER ? `https://wa.me/${BOT_NUMBER}?text=${encodedCommand}` : `https://wa.me/?text=${encodedCommand}`;

      window.open(waUrl, '_blank');
    } catch (err) {
      console.error(err);
      alert("Gagal membaca draft klip.");
    }
  };

  return (
    <div className="w-full min-h-screen bg-neutral-950 p-4 md:p-12 overflow-y-auto hide-scrollbar relative">
      
      {/* Import Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-white/10 p-6 rounded-2xl w-full max-w-lg flex flex-col shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Import Workshop</h3>
            <p className="text-sm text-white/60 mb-4">Paste data JSON panjang yang telah Anda salin dari PC Lokal di sini.</p>
            <textarea
              className="w-full h-48 bg-black/50 border border-white/10 rounded-lg p-3 text-white/80 font-mono text-xs focus:outline-none focus:border-red-500 transition-colors resize-none mb-6"
              placeholder='{"workshop": {...}, "draft": "[...]", "heatmap": "[...]"}'
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              autoFocus
            ></textarea>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setImportModalOpen(false)} 
                className="px-5 py-2.5 rounded-lg text-sm font-bold text-white/50 hover:bg-white/5 transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={processImport} 
                className="px-5 py-2.5 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-500 transition-colors"
              >
                Simpan & Reload
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-10 md:space-y-12">

        {/* HEADER & FORM */}
        <div className="flex flex-col lg:flex-row gap-8 justify-between items-start lg:items-end">
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-red-500 to-rose-400 bg-clip-text text-transparent">
              Clipping Workshop
            </h1>
            <p className="text-white/50 text-sm md:text-base font-medium">Buat dan kelola video klip dari AI Heatmap</p>
          </div>

          <form onSubmit={handleCreate} className="w-full lg:w-max bg-neutral-900/80 backdrop-blur-xl border border-white/10 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row gap-4 shadow-2xl">
            <div className="flex-1 min-w-0 w-full sm:min-w-[280px]">
              <label className="text-[11px] text-white/50 font-bold uppercase tracking-wider mb-1.5 block">Link YouTube</label>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full truncate bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500/70 transition-all placeholder:text-white/20"
              />
            </div>
            <div className="w-full min-w-0 sm:w-[100px]">
              <label className="text-[11px] text-white/50 font-bold uppercase tracking-wider mb-1.5 block">Klip</label>
              <input
                type="number"
                min="1"
                max="100"
                value={countInput}
                onChange={(e) => setCountInput(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500/70 transition-all"
              />
            </div>
            <div className="flex items-end">
              <button type="submit" className="w-full sm:w-auto bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-[0_4px_20px_rgba(220,38,38,0.4)]">
                <Plus size={18} strokeWidth={3} /> BUAT
              </button>
            </div>
          </form>
        </div>

        {error && (
          <div className="bg-red-950/50 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        {/* WORKSHOP GRID */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl md:text-2xl font-bold text-white/80">Proyek Tersimpan</h2>
              <div className="bg-white/10 px-2.5 py-0.5 rounded-full text-xs font-bold text-white/60">{workshops.length}</div>
            </div>
            
            <button 
              onClick={handleImportWorkshop} 
              className="w-full sm:w-auto flex justify-center items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white/80 px-4 py-3 sm:py-2 rounded-lg text-xs font-bold transition-all shadow-lg active:scale-95"
            >
              <Download size={14} /> IMPORT WORKSHOP
            </button>
          </div>

          {workshops.length === 0 ? (
            <div className="text-center py-24 bg-neutral-900/30 border border-white/5 rounded-3xl border-dashed">
              <p className="text-white/40 font-medium">Belum ada workshop. Buat satu di atas!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {workshops.map((ws) => {
                let doneCount = 0;
                const stored = localStorage.getItem(`clips_draft_${ws.videoId}`);
                if (stored) {
                  try {
                    const clips = JSON.parse(stored);
                    doneCount = clips.filter(c => c.status === 'done').length;
                  } catch (e) {}
                }
                
                return (
                  <div
                    key={ws.videoId}
                    onClick={() => updateLastSeenAndOpen(ws.videoId, ws.count || 50)}
                    className="group relative bg-neutral-900/60 border border-white/10 rounded-2xl overflow-hidden hover:bg-neutral-800/80 hover:border-white/20 transition-all cursor-pointer shadow-lg hover:shadow-2xl hover:-translate-y-1.5"
                  >
                    {/* Thumbnail Container */}
                    <div className="relative aspect-video w-full bg-black overflow-hidden border-b border-white/10">
                      <img
                        src={`https://img.youtube.com/vi/${ws.videoId}/mqdefault.jpg`}
                        alt={ws.title || "YouTube Thumbnail"}
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent"></div>
  
                      {/* Play Overlay */}
                      <div className="absolute inset-0 flex justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="bg-red-600/90 p-4 rounded-full shadow-[0_0_30px_rgba(220,38,38,0.6)] backdrop-blur-sm transform scale-90 group-hover:scale-100 transition-transform">
                          <Play fill="white" size={24} />
                        </div>
                      </div>
                    </div>
  
                    {/* Card Content */}
                    <div className="p-5 flex flex-col justify-between min-h-[110px]">
                      <h3 className="text-white font-bold text-sm md:text-base leading-snug line-clamp-2 mb-3 group-hover:text-red-400 transition-colors">
                        {ws.title || `Video ID: ${ws.videoId}`}
                      </h3>
  
                      <div className="flex items-center gap-6 mt-auto overflow-x-auto hide-scrollbar snap-x pb-1">
                        <div className="flex gap-2 shrink-0 snap-start">
                          <div
                            onClick={(e) => handleEditCount(ws.videoId, ws.count || 50, e)} 
                            className="inline-flex items-center gap-1.5 bg-black/50 px-2.5 py-1 rounded-md border border-white/5 cursor-pointer hover:bg-white/10 transition-colors"
                            title="Edit Jumlah Klip"
                          >
                            <span className="text-[11px] font-bold uppercase tracking-wider text-white/40">KLIP</span>
                            <span className="text-sm font-black text-emerald-400">{ws.count || 50}</span>
                          </div>
                          <div className="inline-flex items-center gap-1.5 bg-black/50 px-2.5 py-1 rounded-md border border-white/5" title="Selesai Ditandai">
                            <span className="text-sm font-black text-blue-400">{doneCount}</span>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-white/40">DONE</span>
                          </div>
                        </div>
  
                        {/* Actions */}
                        <div className="flex gap-2 shrink-0 ml-auto snap-end">
                          <button
                            onClick={(e) => handleExportWorkshop(ws, e)}
                            className="p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors"
                            title="Copy Data Workshop (Export)"
                          >
                            <Copy size={18} />
                          </button>
                          <button
                            onClick={(e) => handleBulkWA(ws.videoId, e)}
                            className="p-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 rounded-md transition-colors"
                            title="Kirim Semua Klip Selesai ke WA"
                          >
                            <MessageCircle size={18} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(ws.videoId, e);
                            }}
                            className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded-md transition-colors"
                            title="Hapus Draft"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
