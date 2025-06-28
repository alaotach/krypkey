from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import httpx
import io
import logging
import os
import sys
import audio_converter

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("voice_api_wrapper")

# Create FastAPI app
app = FastAPI(title="Voice Auth API Wrapper")

# Add CORS middleware to allow requests from mobile app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your app's origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure the upstream voice API server URL
VOICE_API_URL = os.environ.get("VOICE_API_URL", "http://localhost:8000")

@app.post("/register")
async def register(user_id: str = Form(...), file: UploadFile = File(...)):
    """
    Register a user's voice sample after ensuring proper format
    """
    try:
        logger.info(f"Received registration request for user {user_id}")
        content = await file.read()
        
        # Convert audio to proper format
        logger.info("Converting audio format...")
        wav_buffer = audio_converter.ensure_wav_format(content)
        
        # Forward to the actual voice API
        logger.info(f"Forwarding to voice API at {VOICE_API_URL}/register")
        async with httpx.AsyncClient(timeout=30.0) as client:
            files = {"file": ("audio.wav", wav_buffer.getvalue(), "audio/wav")}
            data = {"user_id": user_id}
            response = await client.post(f"{VOICE_API_URL}/register", files=files, data=data)
            
            if response.status_code != 200:
                logger.error(f"Voice API returned error: {response.text}")
                return HTTPException(status_code=response.status_code, detail=response.text)
                
            logger.info("Registration successful")
            return response.json()
            
    except Exception as e:
        logger.exception("Registration failed")
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

@app.post("/verify")
async def verify(user_id: str = Form(...), file: UploadFile = File(...)):
    """
    Verify a user's voice after ensuring proper format
    """
    try:
        logger.info(f"Received verification request for user {user_id}")
        content = await file.read()
        
        # Convert audio to proper format
        logger.info("Converting audio format...")
        wav_buffer = audio_converter.ensure_wav_format(content)
        
        # Forward to the actual voice API
        logger.info(f"Forwarding to voice API at {VOICE_API_URL}/verify")
        async with httpx.AsyncClient(timeout=30.0) as client:
            files = {"file": ("audio.wav", wav_buffer.getvalue(), "audio/wav")}
            data = {"user_id": user_id}
            response = await client.post(f"{VOICE_API_URL}/verify", files=files, data=data)
            
            if response.status_code != 200:
                logger.error(f"Voice API returned error: {response.text}")
                return HTTPException(status_code=response.status_code, detail=response.text)
                
            logger.info("Verification request processed")
            result = response.json()
            logger.info(f"Verification result: {result}")
            return result
            
    except Exception as e:
        logger.exception("Verification failed")
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")

@app.get("/health")
async def health():
    """
    Check if the wrapper and voice API are healthy
    """
    try:
        # Check if the voice API is up
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{VOICE_API_URL}/")
            
            if response.status_code == 200:
                return {"status": "ok", "voice_api": "connected", "version": "1.0.0"}
            else:
                return {"status": "degraded", "voice_api": "error", "detail": response.text}
    except Exception as e:
        return {"status": "degraded", "voice_api": "disconnected", "detail": str(e)}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8080"))
    uvicorn.run("voice_api_wrapper:app", host="0.0.0.0", port=port, reload=True)
