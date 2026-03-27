import re

FILLER_WORDS = ["uh", "um", "like", "you know"]

def clean_transcript(raw_result: dict) -> str:
    """
    Cleans transcript by removing common filler words and normalizing punctuation.
    """
    text = raw_result.get("text", "")
    
    for filler in FILLER_WORDS:
        pattern = r'\b' + filler + r'\b'
        text = re.sub(pattern, '', text, flags=re.IGNORECASE)
    
    text = re.sub(r'\s+', ' ', text).strip()
    return text
