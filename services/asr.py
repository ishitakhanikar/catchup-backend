import os
from groq import Groq

def transcribe_audio(audio_path: str) -> dict:
    print(f"Transcribing {audio_path} via Groq Cloud API...")
    
    # Initialize Groq client
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise Exception("GROQ_API_KEY environment variable is extremely required.")
    
    client = Groq(api_key=api_key)
    
    with open(audio_path, "rb") as file:
        transcription = client.audio.transcriptions.create(
            file=(os.path.basename(audio_path), file.read()),
            model="whisper-large-v3",
            prompt="This is a meeting that contains English, Hindi, and Hinglish. Please transcribe accurately.",
            response_format="verbose_json",
        )
        
    return {"text": transcription.text}
