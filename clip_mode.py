from state_manager import (
    user_states,
    STATE_IDLE, 
    STATE_WAITING_URL, 
    STATE_WAITING_COUNT, 
    STATE_WAITING_OFFSET,
    STATE_WAITING_SORT,
    STATE_WAITING_CONFIRM,
    STATE_WAITING_NEXT_CLIP
)
from heatmap import get_top_clips
from downloader import download_single_clip
import os
import re

def handle_clip_mode(client, ev, text, text_lower, sender_jid, current_state):
    """
    Menangani semua logika tanya-jawab dan validasi khusus untuk fitur kliping.
    Mengembalikan True jika input diproses oleh mode ini.
    """
    
    # Pendeteksian awal untuk masuk ke mode
    if text_lower == "!clip":
        user_states[sender_jid]["state"] = STATE_WAITING_URL
        client.reply_message("✂️ Entering Clip Mode!\nPlease paste your YouTube Link:", ev)
        return True
        
    # Jika masih di General Menu (IDLE), hiraukan dan kembalikan False agar bot merespons Help Menu
    if current_state == STATE_IDLE:
        return False
        
    # --- LOGIKA TANYA JAWAB (STATE MACHINE) ---
    
    if current_state == STATE_WAITING_URL:
        if " " in text or not text.startswith("https://") or not ("youtube.com" in text or "youtu.be" in text):
            client.reply_message("❌ Invalid YouTube Link! It must start with 'https://' and contain no spaces.\nPlease send the link again:", ev)
            return True
            
        user_states[sender_jid]["url"] = text
        user_states[sender_jid]["state"] = STATE_WAITING_COUNT
        client.reply_message("How many clips?", ev)
        return True
        
    elif current_state == STATE_WAITING_COUNT:
        if not text.isdigit() or not (1 <= int(text) <= 25):
            client.reply_message("❌ Invalid count! Please enter a number between 1 and 25:", ev)
            return True
            
        user_states[sender_jid]["count"] = text
        user_states[sender_jid]["state"] = STATE_WAITING_OFFSET
        client.reply_message("How much offset in seconds?", ev)
        return True
        
    elif current_state == STATE_WAITING_OFFSET:
        # Validasi: Harus angka, maksimal 30
        if not text.isdigit() or not (0 <= int(text) <= 30):
            client.reply_message("❌ Invalid offset! Please enter a number between 0 and 30:", ev)
            return True
            
        user_states[sender_jid]["offset"] = text
        user_states[sender_jid]["state"] = STATE_WAITING_SORT
        
        client.reply_message("Sort by total views? (yes/no)", ev)
        return True
        
    elif current_state == STATE_WAITING_SORT:
        if text_lower in ["y", "ya", "yes", "ok"]:
            user_states[sender_jid]["sort_by_point"] = True
        elif text_lower in ["n", "no", "tidak", "batal"]:
            user_states[sender_jid]["sort_by_point"] = False
        else:
            client.reply_message("❌ Please type *yes* or *no*:", ev)
            return True
            
        user_states[sender_jid]["state"] = STATE_WAITING_CONFIRM
        
        # Kirim rangkuman untuk meminta persetujuan
        url = user_states[sender_jid]["url"]
        count = user_states[sender_jid]["count"]
        offset = user_states[sender_jid]["offset"]
        sort_pref = "By Points" if user_states[sender_jid]["sort_by_point"] else "Chronological (By Time)"
        
        summary = (
            "✅ *Input Summary*:\n"
            f"🔗 URL: {url}\n"
            f"✂️ Clips: {count}\n"
            f"⏱️ Offset: {offset}s\n"
            f"🔄 Sorting: {sort_pref}\n\n"
            "Proceed? (yes/no)"
        )
        client.reply_message(summary, ev)
        return True
        
    elif current_state == STATE_WAITING_CONFIRM:
        if text_lower in ["y", "ya", "yes", "ok"]:
            client.reply_message("🔍 Fetching heatmap data from YouTube... Please wait.", ev)
            
            url = user_states[sender_jid]["url"]
            count = int(user_states[sender_jid]["count"])
            offset = int(user_states[sender_jid]["offset"])
            
            try:
                clips, title = get_top_clips(url, count, offset)
                
                if not clips:
                    # Gagal mendapatkan heatmap, minta ulangi link
                    user_states[sender_jid]["state"] = STATE_WAITING_URL
                    client.reply_message("❌ Failed to find heatmap data. The video might not have 'most replayed' data.\nPlease provide a different YouTube Link:", ev)
                    return True
                
                # Sukses!
                msg = f"✅ Heatmap Data Found!\n\n🎬 *{title}*\n"
                
                def format_time(seconds):
                    h = int(seconds // 3600)
                    m = int((seconds % 3600) // 60)
                    s = int(seconds % 60)
                    return f"{h:02d}:{m:02d}:{s:02d}"
                
                # Jika user memilih sort_by_point = False, urutkan ulang clips secara kronologis (berdasarkan waktu)
                if not user_states[sender_jid]["sort_by_point"]:
                    clips.sort(key=lambda x: x['start_time'])
                    
                # Format ulang rank jika sudah diurutkan kronologis agar visual rank-nya sesuai urutan waktu
                for idx, c in enumerate(clips, start=1):
                    if not user_states[sender_jid]["sort_by_point"]:
                        # Tampilkan urutan waktu sebagai nomor biasa, atau biarkan rank aslinya terlihat
                        c['display_rank'] = idx
                    else:
                        c['display_rank'] = c['rank']
                        
                for c in clips:
                    start_str = format_time(c['start_time'])
                    end_str = format_time(c['end_time'])
                    msg += f"{c['display_rank']}. {start_str} - {end_str} ({c['value']:.3f} point)\n"
                
                msg += "\nDownloading the first clip (Rank 1)... Please wait."
                client.reply_message(msg, ev)
                
                # Setup cache untuk next clip
                user_states[sender_jid]["clips"] = clips
                user_states[sender_jid]["video_title"] = title
                user_states[sender_jid]["current_clip_index"] = 0
                user_states[sender_jid]["state"] = STATE_WAITING_NEXT_CLIP
                
                # Langsung jalankan perintah "next" untuk klip pertama
                return handle_clip_mode(client, ev, "next", "next", sender_jid, STATE_WAITING_NEXT_CLIP)
                
            except Exception as e:
                user_states[sender_jid]["state"] = STATE_WAITING_URL
                client.reply_message(f"❌ An error occurred: {str(e)}\nPlease provide a different YouTube Link:", ev)
                
            return True
            
        elif text_lower in ["n", "no", "batal"]:
            from state_manager import clear_state
            clear_state(sender_jid)
            client.reply_message("Process cancelled. Returned to General Menu.", ev)
            return True
            
        else:
            client.reply_message("Please type *yes* or *no*.", ev)
            return True
            
    elif current_state == STATE_WAITING_NEXT_CLIP:
        if text_lower in ["next", "lanjut", "y", "yes"]:
            idx = user_states[sender_jid]["current_clip_index"]
            clips = user_states[sender_jid]["clips"]
            
            if idx >= len(clips):
                client.reply_message("✅ All clips have been downloaded and sent. Returned to General Menu.", ev)
                from state_manager import clear_state
                clear_state(sender_jid)
                return True
                
            clip = clips[idx]
            url = user_states[sender_jid]["url"]
            title = user_states[sender_jid]["video_title"]
            
            # Buat safe folder
            def sanitize_filename(name):
                return re.sub(r'[\\/*?:"<>|]', "", name).strip()
            safe_title = sanitize_filename(title) if title else "YouTube_Clips"
            output_dir = os.path.join(os.getcwd(), safe_title)
            if not os.path.exists(output_dir):
                os.makedirs(output_dir)
                
            # Info sedang memproses
            if idx > 0: # Klip pertama sudah diberi tahu di blok konfirmasi
                client.reply_message(f"⏳ Downloading Clip {idx+1}/{len(clips)} (Rank {clip['rank']}). This may take a few seconds...", ev)
            
            # Download
            filepath = download_single_clip(url, output_dir, clip, idx, len(clips))
            
            if filepath and os.path.exists(filepath):
                # Kirim videonya ke user
                caption = f"🎬 {title}\n⭐ Rank {clip['rank']}"
                try:
                    from neonize.proto.waE2E.WAWebProtobufsE2E_pb2 import Message, VideoMessage, ContextInfo
                    
                    with open(filepath, "rb") as f:
                        buff = f.read()
                        
                    upload = client.upload(buff)
                    
                    msg = Message(
                        videoMessage=VideoMessage(
                            URL=upload.url,
                            caption=caption,
                            seconds=int(clip['duration']),
                            directPath=upload.DirectPath,
                            fileEncSHA256=upload.FileEncSHA256,
                            fileLength=upload.FileLength,
                            fileSHA256=upload.FileSHA256,
                            mediaKey=upload.MediaKey,
                            mimetype="video/mp4",
                            contextInfo=ContextInfo()
                        )
                    )
                    
                    if ev.Message:
                        msg.videoMessage.contextInfo.MergeFrom(client._make_quoted_message(ev))
                        
                    client.send_message(ev.Info.MessageSource.Chat, msg)
                    
                except Exception as e:
                    import traceback
                    tb = traceback.format_exc()
                    print("[ERROR SENDING VIDEO]\n", tb)
                    client.reply_message(f"❌ Failed to send video: {str(e)}", ev)
                    return True
                
                user_states[sender_jid]["current_clip_index"] += 1
                
                if user_states[sender_jid]["current_clip_index"] < len(clips):
                    client.reply_message("✅ Video sent! Type *next* for the next clip, or *!exit* to stop.", ev)
                else:
                    client.reply_message("✅ All clips have been sent! Returned to General Menu.", ev)
                    from state_manager import clear_state
                    clear_state(sender_jid)
            else:
                client.reply_message("❌ Failed to download this clip. Type *next* to try the next clip, or *!exit* to stop.", ev)
                user_states[sender_jid]["current_clip_index"] += 1
                
            return True
        else:
            client.reply_message("Type *next* to download the next clip, or *!exit* to stop.", ev)
            return True
            
    return False
