import os
import subprocess
import uuid

def download_youtube_clip(video_id: str, start: float, end: float, output_dir: str = "temp") -> str:
    """
    Downloads a specific section of a YouTube video using yt-dlp and ffmpeg.
    Returns the absolute path to the downloaded file.
    """
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    section = f"*{start}-{end}"
    
    unique_id = str(uuid.uuid4())[:8]
    output_filename = f"{video_id}_{start}_{end}_{unique_id}.mp4"
    output_path = os.path.join(output_dir, output_filename)
    
    cookies_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'cookies.txt')

    cmd = [
        "yt-dlp",
        f"https://www.youtube.com/watch?v={video_id}",
        "--download-sections", section,
        "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "-o", output_path,
        "--force-overwrites"
    ]
    
    if os.path.exists(cookies_path):
        cmd.extend(["--cookies", cookies_path])

    try:
        print(f"[CLIP DOWNLOADER] Running command: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        print(f"[CLIP DOWNLOADER] Success. Saved to {output_path}")
        return os.path.abspath(output_path)
    except subprocess.CalledProcessError as e:
        print(f"[CLIP DOWNLOADER ERROR] yt-dlp failed with code {e.returncode}")
        print(f"STDOUT: {e.stdout}")
        print(f"STDERR: {e.stderr}")
        raise Exception(f"Failed to download clip: {e.stderr}")
