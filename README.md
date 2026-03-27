<div align="center">
  <h1>🎙️ CatchUp! AI Meeting Minutes</h1>
  <p><i>A hyper-optimized, cloud-native Chrome Extension that transforms messy human meetings into perfectly structured PDF agendas in seconds.</i></p>
</div>

---

## Overview

**CatchUp!** is an AI-powered Minute of Meeting (MoM) generator. Built with a **Chrome Extension Service-Worker frontend** and a **FastAPI containerized backend**, it orchestrates the lightning-fast Groq Cloud API to transcribe, analyze, and beautifully format completely unscripted, overlapping, and chaotic meeting audio into structured, actionable PDF artifacts.

## System Architecture 

![Architecture](https://img.shields.io/badge/Architecture-Cloud_Native-blue) 
![Stack](https://img.shields.io/badge/Stack-FastAPI%20|%20Manifest%20V3%20|%20Groq%20API-success)

The system operates across three seamlessly integrated layers:
1. **The Client (Manifest V3 Chrome Extension):** Built natively with JavaScript and CSS glassmorphism, capturing microphone streams invisibly via Chrome `offscreen` documents. It relies on advanced IPC multiplexing to send real-time `FFT` Audio array data to the UI while piping compressed Blobs to the cloud across persistent background Service Workers.
2. **The Cloud Middleware (FastAPI):** An ultra-lightweight, memory-safe backend running on Railway's micro-containers. It ingests the raw user audio, drastically compresses the media tracks leveraging low-level `ffmpeg` bindings, and constructs strict contextual prompts.
3. **The LLM Brain (Groq API):** Offloads all heavy neural network computation natively to Groq LPUs. Relies on `whisper-large-v3` for flawlessly accurate, multilingual speech-to-text, and `llama-3.1-8b-instant` to read and parse the entire transcript recursively against the user's agenda block.

---

## Optimizations & Engineering Feats

We specifically refactored this codebase to eradicate the massive bottlenecks associated with traditional AI audio pipelines. 

### 1. Zero-OOM Context Smasher (Removed RAG)
Traditional applications use PyTorch-heavy libraries like `FAISS` and `sentence-transformers` to chunk and embed transcripts. This bloated the Docker image by **3.5 Gigabytes** and frequently triggered Out-of-Memory (OOM) Linux Kernel `SIGKILL` signals on our 500MB free-tier server.
**The Fix:** We completely eradicated PyTorch and Local Vector databases from the backend. Instead, we pipe the entire raw transcript payload exclusively into LLaMA 3.1's massive **128,000 Token Context Window**.
- **Result:** Docker image size dropped by 90%. Server RAM usage instantly crashed from ~510MB to **<50MB**. The backend is now strictly structurally immune to Out-of-Memory limits.

### 2. Extreme 32kbps Payload Compression
Groq Cloud strictly limits audio payloads to **25MB**. A standard 20-minute meeting recorded in 16kHz WAV format inflates to over 46MB, aggressively crashing the backend with `413 Request Entity Too Large` errors.
**The Fix:** The FastAPI server now routes all incoming media through an aggressive, multi-threaded `ffmpeg` pipeline built on the `libmp3lame` codec. It forces the audio down to a pristine `32kbps Mono MP3` standard.
- **Result:** A massive 24-minute chaotic meeting audio file shrinks from 46MB down to an ultra-light **5.7MB**. This flawlessly guarantees that meetings up to **1 Hour and 40 Minutes** will perfectly bypass the 25MB Groq wall in a single, unchunked API blast.

### 3. Service Worker Mutiny & Headless Downloads
DOM-level Network APIs force users to keep the Chrome popup window open, which ruins the UX for 40-second cloud transcription cycles. 
**The Fix:** We fundamentally restructured the manifest permissions to hand the audio payloads exclusively to the invisible `background.js` Service Worker. We bypassed the fatal `FileReader` Manifest V3 crashes by writing a custom byte-array `Uint8` interpreter loop to cleanly structure the PDF Blobs and interface natively with `chrome.downloads.download`.
- **Result:** Users can initiate large meeting summaries, completely close the extension, and change tabs. The MoM is completely robust against DOM destruction, downloading silently in the background and firing OS-level notifications upon completion. We also wired a native `AbortController` into the fetch API, allowing instantaneous server-side cancellation without destroying local microphone Blob data.

---

## Tech Stack Setup

### Backend (FastAPI) Requirements
- Python 3.10+
- `ffmpeg` installed locally on the OS (`brew install ffmpeg` or `apt-get install ffmpeg`)
- Groq API Key

### Installation

1. Clone the repository and navigate to the backend directory.
2. Initialize virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
3. Set your Environment Variables in a `.env` file:
   ```env
   GROQ_API_KEY=gsk_your_key_here
   ```
4. Start the server locally:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
*(Deploy instantly on Railway/Render using the provided ultra-lightweight CPU-agnostic `Dockerfile`)*

## Extension Installation
1. Navigate to `chrome://extensions/` in Chrome.
2. Toggle **Developer mode** in the upper-right corner.
3. Click **Load unpacked** and select the `/extension` directory.
4. Pin the CatchUp! icon to your browser bar.

## Usage Guide
1. **Agenda Input:** Open CatchUp! and copy/paste your core topics into the Agenda text area. Hit *Set as default* if it's a recurring meeting format.
2. **Audio Input:**
   - Go to the *Record* tab to capture a live standup.
   - Go to the *Upload File* tab to submit long, pre-recorded MP3/MP4/WAV artifacts.
3. Click **Generate MoM**, and feel free to minimize the window. 
4. The system will crunch the audio, validate it against your agenda, and seamlessly push a beautifully parsed PDF format down to your local Downloads folder.
