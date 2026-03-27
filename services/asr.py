import whisper
import os

MODEL_NAME = os.getenv("WHISPER_MODEL", "base")
print(f"Loading Whisper model {MODEL_NAME}...")
try:
    model = whisper.load_model(MODEL_NAME)
except Exception as e:
    print(f"Warning: Could not load Whisper model. {e}")
    model = None

def transcribe_audio(audio_path: str) -> dict:
    if not model:
        raise Exception("Whisper model not initialized.")
    print(f"Transcribing {audio_path}...")
    prompt = "This is a meeting that contains English, Hindi, and Hinglish. Please transcribe accurately."
    result = model.transcribe(audio_path, initial_prompt=prompt)
    return result
