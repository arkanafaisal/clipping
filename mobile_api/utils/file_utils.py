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
