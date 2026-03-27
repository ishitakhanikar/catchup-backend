import ffmpeg
import os
import shutil

def get_ffmpeg_cmd():
    if shutil.which("ffmpeg"):
        return "ffmpeg"
    elif os.path.exists("/opt/homebrew/bin/ffmpeg"):
        return "/opt/homebrew/bin/ffmpeg"
    elif os.path.exists("/usr/local/bin/ffmpeg"):
        return "/usr/local/bin/ffmpeg"
    return "ffmpeg"

def convert_audio(input_path: str) -> str:
    """
    Compresses audio to extremely lightweight 32kbps mono mp3 format 
    to safely bypass the 25MB API limits for 2-hour long meetings.
    """
    base, _ = os.path.splitext(input_path)
    output_path = f"{base}_compressed.mp3"
        
    try:
        (
            ffmpeg
            .input(input_path)
            .output(output_path, format='mp3', acodec='libmp3lame', ac=1, ar='16000', audio_bitrate='32k')
            .overwrite_output()
            .run(cmd=get_ffmpeg_cmd(), quiet=True)
        )
        return output_path
    except ffmpeg.Error as e:
        print("FFmpeg compression error:", e.stderr)
        raise Exception("Audio compression failed.")
