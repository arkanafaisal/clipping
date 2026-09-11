from heatmap import get_top_clips
import os
import threading

def handle_heatmap_request(client, ev, text, sender_jid):
    """
    Memproses link YouTube dan argumen opsional untuk langsung menghasilkan heatmap.
    """
    parts = text.split()
    if not parts:
        return False
        
    url = parts[0]
    if not url.startswith("https://") or not ("youtube.com" in url or "youtu.be" in url):
        return False
        
    # Defaults
    count = 10
    offset = 0
    sort_by_point = False
    
    # Parse arguments manually
    idx = 1
    error_msg = ""
    while idx < len(parts):
        arg = parts[idx]
        if arg in ("--clip", "-c"):
            if idx + 1 < len(parts) and parts[idx+1].isdigit():
                count = int(parts[idx+1])
                if not (1 <= count <= 50):
                    error_msg = "❌ Invalid count! Please enter a number between 1 and 50."
                    break
                idx += 2
            else:
                error_msg = f"❌ Missing or invalid value for {arg}. Example: {arg} 10"
                break
        elif arg in ("--offset", "-o"):
            if idx + 1 < len(parts):
                try:
                    offset = int(parts[idx+1])
                    if not (-30 <= offset <= 30):
                        error_msg = "❌ Invalid offset! Please enter a number between -30 and 30."
                        break
                    idx += 2
                except ValueError:
                    error_msg = f"❌ Missing or invalid value for {arg}. Example: {arg} 5 or {arg} -5"
                    break
            else:
                error_msg = f"❌ Missing or invalid value for {arg}. Example: {arg} 5 or {arg} -5"
                break
        elif arg in ("--views", "-v", "-s"):
            sort_by_point = True
            idx += 1
        else:
            error_msg = f"❌ Unknown parameter: {arg}\nAvailable params: --clip/-c <num>, --offset/-o <num>, --views/-v/-s"
            break
            
    if error_msg:
        client.send_message(ev.Info.MessageSource.Chat, error_msg)
        return True

    # Async processing
    def process_heatmap_async():
        try:
            clips, title = get_top_clips(url, count, offset)
            
            if not clips:
                client.send_message(
                    ev.Info.MessageSource.Chat, 
                    "❌ Failed to fetch heatmap data for the link. The video might be blocked, private, or has no heatmap."
                )
                return
            
            msg = f"🔗 {url}\n🎬 *{title}*\n\n"
            
            def format_time(seconds):
                h = int(seconds // 3600)
                m = int((seconds % 3600) // 60)
                s = int(seconds % 60)
                return f"{h:02d}:{m:02d}:{s:02d}"
            
            if not sort_by_point:
                clips.sort(key=lambda x: x['start_time'])
                
            for idx, c in enumerate(clips, start=1):
                if not sort_by_point:
                    c['display_rank'] = idx
                else:
                    c['display_rank'] = c['rank']
                    
            for c in clips:
                start_str = format_time(c['start_time'])
                end_str = format_time(c['end_time'])
                msg += f"{c['display_rank']}. {start_str} - {end_str}\n"
            
            client.send_message(ev.Info.MessageSource.Chat, msg)
            
        except Exception as e:
            client.send_message(ev.Info.MessageSource.Chat, f"❌ An error occurred: {str(e)}\nPlease provide a different YouTube Link:")
            
    threading.Thread(target=process_heatmap_async, daemon=True).start()
    return True
