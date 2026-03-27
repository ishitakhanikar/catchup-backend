from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import uvicorn
import shutil
import os

from services.audio import convert_audio
from services.asr import transcribe_audio
from services.nlp import clean_transcript
from services.retrieval import build_vector_store, retrieve_relevant_chunks
from services.llm import generate_structured_mom
from services.pdf import create_pdf

app = FastAPI(title="MoM Generator API", description="AI-powered Minutes of Meeting using ASR and LangChain")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allowed for Chrome Extension interactions
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("temp", exist_ok=True)
os.makedirs("output", exist_ok=True)

@app.post("/api/v1/generate-mom")
async def generate_mom(
    audio: UploadFile = File(...),
    agenda: str = Form(...)
):
    """
    Core pipeline endpoint for MoM generation
    """
    try:
        # 1. Save input file
        input_path = f"temp/{audio.filename}"
        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(audio.file, buffer)
            
        # 2. Audio Processing (Convert to standardized format 16kHz wav)
        std_audio_path = convert_audio(input_path)
        
        # 3. Speech-to-Text
        raw_transcript = transcribe_audio(std_audio_path)
        
        # 4. Transcript Cleaning
        clean_text = clean_transcript(raw_transcript)
        
        # 5. Information Retrieval
        # Parse agenda items and embed chunks
        agenda_items = [item.strip() for item in agenda.split("\n") if item.strip()]
        if not agenda_items:
            raise HTTPException(status_code=400, detail="Agenda cannot be empty.")
            
        vector_store = build_vector_store(clean_text)
        retrieved_context = retrieve_relevant_chunks(vector_store, agenda_items)
        
        # 6. LangChain Refinement
        mom_data = generate_structured_mom(retrieved_context, agenda)
        
        # 7. PDF Generation
        pdf_path = create_pdf(mom_data)
        
        # Clean up temp files
        os.remove(input_path)
        if std_audio_path != input_path:
            os.remove(std_audio_path)
            
        # Return PDF to frontend
        return FileResponse(
            pdf_path, 
            media_type="application/pdf", 
            filename="Minutes_of_Meeting.pdf"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
