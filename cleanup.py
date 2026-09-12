import os
import time
import shutil
import threading

def run_cleanup_daemon(output_dir="output", max_age_seconds=3600, check_interval=300):
    """
    Berjalan di background, mengecek dan menghapus file/folder di output_dir
    yang modification time (mtime)-nya sudah melewati max_age_seconds.
    """
    while True:
        try:
            if os.path.exists(output_dir):
                current_time = time.time()
                for item in os.listdir(output_dir):
                    item_path = os.path.join(output_dir, item)
                    try:
                        mtime = os.path.getmtime(item_path)
                        if current_time - mtime > max_age_seconds:
                            if os.path.isdir(item_path):
                                shutil.rmtree(item_path)
                            else:
                                os.remove(item_path)
                            print(f"[CLEANUP] Deleted old item: {item_path}")
                    except Exception as e:
                        print(f"[CLEANUP] Error deleting {item_path}: {e}")
        except Exception as e:
            print(f"[CLEANUP] Error in cleanup daemon: {e}")
            
        try:
            from history_manager import clean_old_history
            clean_old_history(max_age_seconds)
        except Exception as e:
            print(f"[CLEANUP] Error cleaning history json: {e}")
            
        time.sleep(check_interval)

def start_cleanup_thread(output_dir="output", max_age_seconds=3600, check_interval=300):
    thread = threading.Thread(
        target=run_cleanup_daemon, 
        args=(output_dir, max_age_seconds, check_interval),
        daemon=True
    )
    thread.start()
    print(f"[CLEANUP] Daemon started. Checking '{output_dir}' every {check_interval}s for items older than {max_age_seconds}s.")
