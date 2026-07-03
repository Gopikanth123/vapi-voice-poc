# Vapi Voice Assistant — WebSocket POC

A complete, branded web experience for your Vapi AI assistant. No expiring URLs, no Vapi branding — just your own premium voice interface.

## Architecture

```
Frontend (HTML/JS) → POST /call → FastAPI Backend → Vapi API
                   ↓
            websocketCallUrl
                   ↓
         WebSocket (wss://api.vapi.ai/...)
                   ↓
        🎤 Stream mic audio → Vapi → 🔊 Play AI audio
```

## Quick Start

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure API key
copy .env.example .env
# Edit .env and add your VAPI_API_KEY
```

### 2. Start Backend

```bash
cd backend
uvicorn app:app --reload --port 8000
```

### 3. Open Frontend

Open `frontend/index.html` in your browser.

> **Note:** For full AudioWorklet support, you may need to serve the frontend via the FastAPI server. Once the backend is running, visit `http://localhost:8000` — it serves the frontend automatically.

### 4. Use

1. Click **Start Conversation**
2. Allow microphone access
3. Speak to the AI assistant
4. View the live transcript
5. Click **End Conversation** when done

## Configuration

Edit `backend/.env`:

```
VAPI_API_KEY=your_vapi_private_api_key
VAPI_ASSISTANT_ID=001414ad-ad65-405d-ad5b-1e016bb782eb
```

## Project Structure

```
vapi_connection/
├── backend/
│   ├── app.py              # FastAPI server
│   ├── requirements.txt    # Python deps
│   ├── .env.example        # API key template
│   └── .env                # Your actual API key (git-ignored)
│
├── frontend/
│   ├── index.html          # Premium UI
│   ├── style.css           # Advanced animations
│   ├── app.js              # WebSocket + UI orchestration
│   └── audio.js            # Mic capture + audio playback
│
└── README.md
```

## Features

- ✅ WebSocket audio streaming (no phone numbers)
- ✅ Real-time microphone capture via AudioWorklet
- ✅ AI audio playback via Web Audio API
- ✅ Live transcript with typing animation
- ✅ Animated particle background
- ✅ Circular waveform visualizer
- ✅ Sound wave bars
- ✅ Floating gradient blobs
- ✅ Call timer
- ✅ Status indicators (Listening / Speaking / Connecting)
- ✅ Glassmorphism dark theme
- ✅ Fully responsive
- ✅ Zero dependencies frontend (vanilla JS)
