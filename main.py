from utils.heatmap import get_top_clips, VIDEO_URL
from utils.downloader import download_clips

def main():
    print("=== Aplikasi YT Clipper Automatis ===")
    
    # 1. Input Konfigurasi
    input_url = input(f"Masukkan URL YouTube (Kosongkan untuk default): ").strip()
    if not input_url:
        input_url = VIDEO_URL
        
    input_num = input("Masukkan jumlah klip (Kosongkan untuk default 10): ").strip()
    num_clips = int(input_num) if input_num.isdigit() else 10
    
    input_offset = input("Masukkan detik offset awal & akhir (Kosongkan untuk default 0): ").strip()
    offset = int(input_offset) if input_offset.isdigit() else 0
    
    # 2. Ambil Data Heatmap
    print("\n[Langkah 1/2] Mengekstrak Heatmap...")
    raw_clips, video_title = get_top_clips(input_url, num_clips=num_clips, offset=offset)
    
    if not raw_clips:
        print("Tidak ada klip yang diekstrak. Berhenti.")
        return
        
    # 3. Tanya Pengguna untuk Download
    pilihan = input("\nApakah Anda ingin langsung mengunduh klip-klip tersebut? (y/n): ").strip().lower()
    
    if pilihan == 'y':
        # Batch size bisa disesuaikan, misalnya 5 agar tidak lag dan tidak kena limit
        print("\n[Langkah 2/2] Memulai proses pengunduhan aman...")
        download_clips(input_url, video_title, raw_clips, batch_size=5, sleep_time=10)
    else:
        print("Proses dihentikan. Anda masih bisa mengunduhnya di lain waktu menggunakan array `raw_clips`.")

if __name__ == "__main__":
    main()
