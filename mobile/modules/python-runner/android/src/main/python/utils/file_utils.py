import os
import re
import glob

def sanitize_filename(name):
    return re.sub(r'[\\/*?:"<>|]', "", name).strip()

def format_time_filename(seconds):
    hours = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    # Menggunakan titik (.) karena titik dua (:) ilegal di nama file Windows
    return f"{hours:02d}.{mins:02d}.{secs:02d}"

def get_output_filename(folder, rank, start_time, end_time, base_ext='.mp4'):
    start_str = format_time_filename(start_time)
    end_str = format_time_filename(end_time)
    time_suffix = f"{start_str} - {end_str}"
    
    existing_files = glob.glob(os.path.join(folder, f"*{time_suffix}*.mp4"))
    
    if existing_files:
        return os.path.basename(existing_files[0]), True
            
    return f"{time_suffix}{base_ext}", False


def verify_storage(root_path: str = "/storage/emulated/0/clipping"):
    """
    Memverifikasi hak akses baca dan tulis fisik ke direktori storage via kernel OS.
    Menulis dan membaca hello.txt secara nyata ke disk.
    """
    import time
    clean_root = root_path.rstrip("/\\")
    subdirs = ["output", "scripts", "libs", "cache"]
    try:
        os.makedirs(clean_root, exist_ok=True)
        for s in subdirs:
            os.makedirs(os.path.join(clean_root, s), exist_ok=True)
        
        test_file = os.path.join(clean_root, "hello.txt")
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        content = f"Hello from Clipping! Physical disk write verified at {timestamp}"
        
        with open(test_file, "w", encoding="utf-8") as f:
            f.write(content)
            
        with open(test_file, "r", encoding="utf-8") as f:
            read_back = f.read()
            
        if read_back.strip() == content.strip():
            return {
                "status": "success",
                "success": True,
                "canWrite": True,
                "canRead": True,
                "message": "Akses Read & Write fisik ke shared storage 100% Berhasil!",
                "testFileUri": test_file,
                "contentRead": read_back
            }
        else:
            return {
                "status": "error",
                "success": False,
                "canWrite": True,
                "canRead": False,
                "message": "Konten file yang dibaca tidak cocok dengan yang ditulis fisik."
            }
    except Exception as e:
        import traceback
        return {
            "status": "error",
            "success": False,
            "canWrite": False,
            "canRead": False,
            "message": f"Gagal verifikasi storage fisik: {str(e)}",
            "error": str(e),
            "traceback": traceback.format_exc()
        }

