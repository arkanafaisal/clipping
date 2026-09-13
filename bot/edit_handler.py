import re
import os
import threading
import subprocess
import time
import shutil
from bot.history_manager import get_clip_history, save_clip_history, find_existing_clip
from bot.reply_handler import parse_time_to_seconds
from utils.downloader import download_single_clip, format_time_filename
from neonize.proto.waE2E.WAWebProtobufsE2E_pb2 import Message, VideoMessage, ContextInfo

def parse_time_with_sign(time_str):
    sign = 1
    if time_str.startswith('+'):
        time_str = time_str[1:]
    elif time_str.startswith('-'):
        sign = -1
        time_str = time_str[1:]
    return sign * parse_time_to_seconds(time_str)

def handle_edit_command(client, ev, text, sender_jid):
    # Parse format strict menggunakan flag param: --start/-s dan --end/-e
    if not text.lower().startswith("!edit"):
        return True
        
    val1 = 0
    val2 = 0
    
    s_match = re.search(r"(?:--start|-s)\s+([+-]?\S+)", text, re.IGNORECASE)
    e_match = re.search(r"(?:--end|-e)\s+([+-]?\S+)", text, re.IGNORECASE)
    
    if not s_match and not e_match:
        client.send_message(ev.Info.MessageSource.Chat, "❌ Format salah.\nGunakan parameter `--start` / `-s` atau `--end` / `-e`.\nContoh: `!edit -s 5 -e -10`")
        return True

    try:
        if s_match:
            val1 = parse_time_with_sign(s_match.group(1))
        if e_match:
            val2 = parse_time_with_sign(e_match.group(1))
    except Exception:
        client.send_message(ev.Info.MessageSource.Chat, "❌ Format waktu tidak valid. Pastikan menulis angka dengan benar.")
        return True

    # Get quoted message stanza ID
    context_info = ev.Message.extendedTextMessage.contextInfo
    if not context_info:
        client.send_message(ev.Info.MessageSource.Chat, "❌ Mohon balas (reply) pesan video klip yang ingin diedit.")
        return True
        
    stanza_id = getattr(context_info, 'stanzaId', getattr(context_info, 'stanzaID', None))
    
    if not stanza_id:
        client.send_message(ev.Info.MessageSource.Chat, "❌ Mohon balas (reply) pesan video klip yang ingin diedit.")
        return True

    history = get_clip_history(stanza_id)
    if not history:
        client.send_message(ev.Info.MessageSource.Chat, "❌ Video ini sudah kedaluwarsa dari database (di atas 1 jam) atau bukan klip dari bot.")
        return True

    url = history["url"]
    orig_start = history["start"]
    orig_end = history["end"]
    local_path = history["local_path"]
    # Hitung waktu baru secara relatif
    # val1 > 0 berarti extend awal (mundur), val1 < 0 berarti crop awal (maju)
    new_start = max(0, orig_start - val1)
    
    # val2 > 0 berarti extend akhir (maju), val2 < 0 berarti crop akhir (mundur)
    new_end = orig_end + val2
    
    if new_start >= new_end:
        client.send_message(ev.Info.MessageSource.Chat, "❌ Pemotongan terlalu besar, durasi klip menjadi nol atau negatif.")
        return True

    def format_time(seconds):
        h = seconds // 3600
        m = (seconds % 3600) // 60
        s = seconds % 60
        if h > 0:
            return f"{h:02d}:{m:02d}:{s:02d}"
        return f"{m:02d}:{s:02d}"
        
    new_start_str = format_time(new_start)
    new_end_str = format_time(new_end)

    def run_fetch(url, output_dir, start_t, end_t, target_path):
        clip_info = {
            'rank': 999,
            'start_time': start_t,
            'end_time': end_t
        }
        try:
            # Gunakan downloader yang sudah ada
            downloaded = download_single_clip(url, output_dir, clip_info, 0, 1)
            if downloaded and os.path.exists(downloaded):
                if downloaded != target_path:
                    # os.replace aman di Windows meskipun file tujuan sudah ada
                    os.replace(downloaded, target_path)
        except Exception as e:
            print(f"[EDIT FETCH] Gagal mengunduh atau merename: {e}")

    def process_edit():
        client.send_message(ev.Info.MessageSource.Chat, "⏳ Memproses klip video...")
        
        output_dir = os.path.dirname(local_path)
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        # Cek apakah hasil akhir edit ini sudah pernah diproses dan ada file lokalnya
        existing_local = find_existing_clip(url, new_start, new_end)
        
        unique_id = int(time.time())
        start_str = format_time_filename(new_start)
        end_str = format_time_filename(new_end)
        new_filepath = os.path.join(output_dir, f"{start_str} - {end_str}.mp4")

        if existing_local and os.path.exists(existing_local):
            if existing_local != new_filepath:
                shutil.copy2(existing_local, new_filepath)
        else:
            if not os.path.exists(local_path):
                # Fallback ke Full Fetch dari YT
                run_fetch(url, output_dir, new_start, new_end, new_filepath)
            else:
                parts = []
                
                # Phase 1: Prefix (Jika val1 > 0)
                if val1 > 0:
                    prefix_path = os.path.join(output_dir, f"prefix_{unique_id}.mp4")
                    run_fetch(url, output_dir, new_start, orig_start, prefix_path)
                    if os.path.exists(prefix_path):
                        parts.append(prefix_path)
                        
                # Phase 2: Base / Cropped Base
                base_start = max(new_start, orig_start)
                base_end = min(new_end, orig_end)
                if base_start > orig_start or base_end < orig_end:
                    cropped_base = os.path.join(output_dir, f"base_{unique_id}.mp4")
                    rel_start = base_start - orig_start
                    duration = base_end - base_start
                    cmd = [
                        "ffmpeg", "-y",
                        "-ss", str(rel_start),
                        "-i", local_path,
                        "-to", str(duration),
                        "-c:v", "libx264", "-preset", "ultrafast",
                        "-c:a", "aac",
                        cropped_base
                    ]
                    try:
                        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                        if os.path.exists(cropped_base):
                            parts.append(cropped_base)
                    except Exception as e:
                        print(f"[EDIT] Gagal memotong base: {e}")
                else:
                    parts.append(local_path)
                    
                # Phase 3: Suffix (Jika val2 > 0)
                if val2 > 0:
                    suffix_path = os.path.join(output_dir, f"suffix_{unique_id}.mp4")
                    run_fetch(url, output_dir, orig_end, new_end, suffix_path)
                    if os.path.exists(suffix_path):
                        parts.append(suffix_path)
                        
                # Phase 4: Penggabungan (Concat)
                if len(parts) == 1:
                    shutil.copy2(parts[0], new_filepath)
                elif len(parts) > 1:
                    list_file = os.path.join(output_dir, f"list_{unique_id}.txt")
                    with open(list_file, 'w', encoding='utf-8') as f:
                        for p in parts:
                            # Escape single quotes for ffmpeg concat demuxer
                            safe_name = os.path.basename(p).replace("'", "'\\''")
                            f.write(f"file '{safe_name}'\n")
                            
                    concat_cmd = [
                        "ffmpeg", "-y",
                        "-f", "concat", "-safe", "0",
                        "-i", os.path.basename(list_file),
                        "-c", "copy",
                        os.path.basename(new_filepath)
                    ]
                    try:
                        # cwd=output_dir sangat penting
                        result = subprocess.run(concat_cmd, cwd=output_dir, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
                    except subprocess.CalledProcessError as e:
                        print(f"[EDIT] Gagal concat (Exit {e.returncode}): {e.stderr}")
                        
                    # Cleanup file temporary
                    if os.path.exists(list_file):
                        os.remove(list_file)
                    for p in parts:
                        if p != local_path and os.path.exists(p):
                            os.remove(p)

        # Kirim hasil video
        if os.path.exists(new_filepath):
            try:
                with open(new_filepath, 'rb') as f:
                    buff = f.read()
                
                upload = client.upload(buff)
                
                msg_proto = Message(
                    videoMessage=VideoMessage(
                        URL=upload.url,
                        seconds=new_end - new_start,
                        directPath=upload.DirectPath,
                        fileEncSHA256=upload.FileEncSHA256,
                        fileLength=upload.FileLength,
                        fileSHA256=upload.FileSHA256,
                        mediaKey=upload.MediaKey,
                        mimetype="video/mp4",
                        caption=f"⏱ {new_start_str} - {new_end_str}",
                        contextInfo=ContextInfo()
                    )
                )
                
                if ev.Message:
                    msg_proto.videoMessage.contextInfo.MergeFrom(client._make_quoted_message(ev))
                    
                response = client.send_message(ev.Info.MessageSource.Chat, msg_proto)
                
                if response and hasattr(response, 'ID'):
                    save_clip_history(response.ID, url, new_start, new_end, new_filepath)
                    
            except Exception as e:
                client.send_message(ev.Info.MessageSource.Chat, f"❌ Failed to send edited video: {str(e)}")
        else:
            client.send_message(ev.Info.MessageSource.Chat, "❌ Gagal memproses video klip.")

    threading.Thread(target=process_edit, daemon=True).start()
    return True

def handle_subtitle_command(client, ev, text, sender_jid):
    if not (text.lower().startswith("!subtitle") or text.lower().startswith("!caption")):
        return False
        
    context_info = ev.Message.extendedTextMessage.contextInfo
    if not context_info:
        client.send_message(ev.Info.MessageSource.Chat, "❌ Mohon balas (reply) pesan video klip yang ingin diekstrak subtitle-nya.")
        return True
        
    stanza_id = getattr(context_info, 'stanzaId', getattr(context_info, 'stanzaID', None))
    if not stanza_id:
        client.send_message(ev.Info.MessageSource.Chat, "❌ Mohon balas (reply) pesan video klip dari bot.")
        return True

    from bot.history_manager import get_clip_history
    history = get_clip_history(stanza_id)
    if not history:
        client.send_message(ev.Info.MessageSource.Chat, "❌ Video ini sudah kedaluwarsa dari database (di atas 1 jam) atau bukan klip dari bot.")
        return True

    url = history["url"]
    start_time = history["start"]
    end_time = history["end"]

    def process_subtitle():
        client.send_message(ev.Info.MessageSource.Chat, "⏳ Mengekstrak transkrip dari YouTube...")
        from subtitle_handler import extract_subtitle
        text_result, err = extract_subtitle(url, start_time, end_time)
        if err:
            client.send_message(ev.Info.MessageSource.Chat, err)
        else:
            client.send_message(ev.Info.MessageSource.Chat, f"📝 *Transkrip*\n\n{text_result}")

    threading.Thread(target=process_subtitle, daemon=True).start()
    return True
