module.exports = {
  apps: [{
    name: "clipping",
    script: "bot.py",
    interpreter: "python3",
    // Menangkap log secara real-time
    env: {
      PYTHONUNBUFFERED: "1"
    },
    // Auto-restart jika script crash atau terhenti
    autorestart: true,
    // Batas memori maksimal sebelum pm2 me-restart bot secara paksa
    // Karena VPS Anda punya RAM 8GB, kita berikan ruang kosong yang luas hingga 6GB
    max_memory_restart: "6G",
    // Tidak me-restart saat ada file yang berubah (agar aman saat ffmpeg men-download video)
    watch: false,
    // Restart logic jika terjadi error beruntun
    max_restarts: 10,
    restart_delay: 5000 // Jeda 5 detik sebelum mencoba menyalakan ulang
  }]
};
