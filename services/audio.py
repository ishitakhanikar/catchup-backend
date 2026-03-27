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
    Converts audio to 16000Hz mono wav format suitable for Whisper ASR.
    """
    base, ext = os.path.splitext(input_path)
    if ext == '.wav':
        # Even if it's wav we ensure 16k mono
        output_path = f"{base}_16k.wav"
    else:
        output_path = f"{base}.wav"
        
    try:
        (
            ffmpeg
            .input(input_path)
            .output(output_path, ac=1, ar='16000') # 1 channel, 16kHz
            .overwrite_output()
            .run(cmd=get_ffmpeg_cmd(), quiet=True)
        )
        return output_path
    except ffmpeg.Error as e:
        print("FFprobe error:", e.stderr)
        raise Exception("Audio conversion failed.")
