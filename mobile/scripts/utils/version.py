"""
Version indicator untuk direktori backend Python scripts.
File ini diperbarui HANYA jika ada modifikasi pada file-file skrip di dalam folder scripts/.
"""
import os
import json
import hashlib

SCRIPTS_VERSION = "1.0.0"


def get_scripts_version(**kwargs) -> str:
    """
    Mengembalikan versi skrip dan hash ringkas dari file-file di utils/.
    Dipanggil dari frontend untuk mendeteksi apakah skrip di HP sudah tersinkronisasi.
    """
    current_dir = os.path.dirname(os.path.abspath(__file__))
    file_hashes = []
    try:
        for fname in sorted(os.listdir(current_dir)):
            if fname.endswith(".py") and fname != "version.py":
                fpath = os.path.join(current_dir, fname)
                try:
                    with open(fpath, "rb") as f:
                        file_hashes.append(hashlib.md5(f.read()).hexdigest()[:8])
                except Exception:
                    pass
        combined_hash = hashlib.md5("".join(file_hashes).encode()).hexdigest()[:8] if file_hashes else "none"
    except Exception:
        combined_hash = "unknown"

    return json.dumps({
        "status": "success",
        "version": SCRIPTS_VERSION,
        "hash": combined_hash,
    })


if __name__ == "__main__":
    print(get_scripts_version())
