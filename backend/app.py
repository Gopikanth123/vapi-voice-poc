"""
Vapi WebSocket Voice Assistant — FastAPI Backend
Creates a Vapi call with WebSocket transport and returns the connection URL.
"""

import os
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Vapi Voice Assistant")

# CORS — allow frontend to call backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

VAPI_API_KEY = os.getenv("VAPI_API_KEY", "")
VAPI_ASSISTANT_ID = os.getenv("VAPI_ASSISTANT_ID", "001414ad-ad65-405d-ad5b-1e016bb782eb")
VAPI_BASE_URL = "https://api.vapi.ai"


@app.post("/call")
async def create_call():
    """
    Creates a new Vapi call with WebSocket transport.
    Returns the websocketCallUrl for the frontend to connect to.
    """
    if not VAPI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="VAPI_API_KEY is not set. Add it to backend/.env"
        )

    payload = {
        "assistantId": VAPI_ASSISTANT_ID,
        "transport": {
            "provider": "vapi.websocket",
            "audioFormat": {
                "format": "pcm_s16le",
                "container": "raw",
                "sampleRate": 16000,
            },
        },
    }

    headers = {
        "Authorization": f"Bearer {VAPI_API_KEY}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                f"{VAPI_BASE_URL}/call",
                json=payload,
                headers=headers,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"Vapi API error: {e.response.text}",
            )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to reach Vapi API: {str(e)}",
            )

    data = response.json()

    # Extract the WebSocket URL
    websocket_url = data.get("transport", {}).get("websocketCallUrl")
    if not websocket_url:
        raise HTTPException(
            status_code=500,
            detail=f"No websocketCallUrl in Vapi response. Full response: {data}",
        )

    return {
        "websocketCallUrl": websocket_url,
        "callId": data.get("id"),
    }


@app.get("/health")
async def health():
    return {"status": "ok", "api_key_set": bool(VAPI_API_KEY)}


# Serve frontend static files
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
if os.path.isdir(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

    @app.get("/")
    async def serve_frontend():
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
