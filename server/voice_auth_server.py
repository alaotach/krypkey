from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
import torchaudio
import torch
import io
import os
import warnings
import numpy as np
import tempfile
from pymongo import MongoClient
from bson.binary import Binary
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("voice_auth_server")

# Suppress specific deprecation warnings
warnings.filterwarnings("ignore", category=FutureWarning, 
                      message=".*torch.cuda.amp.custom_fwd.*")
warnings.filterwarnings("ignore", category=UserWarning, 
                      module="speechbrain.utils.parameter_transfer")
warnings.filterwarnings("ignore", category=UserWarning, 
                      module="inspect", message=".*Module 'speechbrain.pretrained' was deprecated.*")

# Initialize FastAPI app
app = FastAPI(title="Voice Authentication API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your app's origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
MONGODB_URI = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")
client = MongoClient(MONGODB_URI)
db = client["voice_auth"]
collection = db["users"]

# Load models
try:
    # Try to import with the updated path
    from speechbrain.inference.speaker import SpeakerRecognition
    from speechbrain.inference.ASR import EncoderDecoderASR

    # Load models with progress reporting
    logger.info("Loading speaker verification model...")
    verification = SpeakerRecognition.from_hparams(
        source="speechbrain/spkrec-ecapa-voxceleb", 
        savedir="./pretrained_ecapa"
    )
    
    logger.info("Loading ASR model for transcription...")
    asr = EncoderDecoderASR.from_hparams(
        source="speechbrain/asr-crdnn-rnnlm-librispeech", 
        savedir="./pretrained_asr"
    )
    logger.info("All models loaded successfully!")
except ImportError as e:
    logger.error(f"Error importing SpeechBrain: {e}")
    # Try the deprecated path as fallback
    try:
        from speechbrain.pretrained import SpeakerRecognition
        from speechbrain.pretrained.interfaces import EncoderDecoderASR
        
        logger.info("Loading models using deprecated imports...")
        verification = SpeakerRecognition.from_hparams(
            source="speechbrain/spkrec-ecapa-voxceleb", 
            savedir="./pretrained_ecapa"
        )
        asr = EncoderDecoderASR.from_hparams(
            source="speechbrain/asr-crdnn-rnnlm-librispeech", 
            savedir="./pretrained_asr"
        )
        logger.info("Models loaded using deprecated imports!")
    except Exception as e2:
        logger.critical(f"Critical error loading models: {e2}")
        raise

# Import speech recognition if available
try:
    import speech_recognition as sr
    GOOGLE_SR_AVAILABLE = True
    logger.info("Google Speech Recognition is available")
except ImportError:
    GOOGLE_SR_AVAILABLE = False
    logger.warning("Google Speech Recognition is NOT available")

def extract_embedding(signal):
    """Extract voice embedding from audio signal"""
    try:
        return verification.encode_batch(signal).squeeze(0).detach()
    except Exception as e:
        logger.error(f"Error extracting embedding: {e}")
        raise

def transcribe_with_google(audio_data):
    """Transcribe audio using Google Speech Recognition API"""
    if not GOOGLE_SR_AVAILABLE:
        return None
        
    recognizer = sr.Recognizer()
    
    # Create a temporary WAV file with proper formatting
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
        temp_filename = temp_file.name
        
        # Make sure we're saving with the right parameters - 16kHz mono WAV
        # Explicitly reshape if needed to ensure we have the right channel format
        if len(audio_data.shape) > 1 and audio_data.shape[0] > 1:
            audio_data = audio_data[0].unsqueeze(0)  # Take first channel only
        
        # Ensure it's using the right sample rate and bit depth
        torchaudio.save(temp_filename, audio_data, sample_rate=16000)
    
    try:
        # Load audio file with SpeechRecognition
        with sr.AudioFile(temp_filename) as source:
            # Adjust recognition parameters
            audio = recognizer.record(source)
            
            # Use Google Speech Recognition with additional parameters
            transcript = recognizer.recognize_google(audio, language="en-US")
            return transcript.lower()
    except Exception as e:
        logger.error(f"Google Speech Recognition error: {e}")
        return None
    finally:
        # Clean up temporary file
        if os.path.exists(temp_filename):
            os.remove(temp_filename)

def transcribe_audio(signal, fs):
    """Transcribe audio using SpeechBrain ASR"""
    try:
        result = asr.transcribe_batch(signal, torch.tensor([fs]))
        
        # Handle different return types - may be string or list
        if isinstance(result, list):
            return result[0] if result else ""
        elif isinstance(result, str):
            return result
        else:
            # For any other type, convert to string
            return str(result)
    except Exception as e:
        logger.error(f"Error transcribing audio: {e}")
        return ""

@app.get("/")
async def health_check():
    """Simple API health check endpoint"""
    return {
        "status": "ok", 
        "service": "Voice Authentication API",
        "version": "1.0.0",
        "models_loaded": {
            "speaker_verification": verification is not None,
            "asr": asr is not None,
            "google_sr": GOOGLE_SR_AVAILABLE
        }
    }

@app.post("/register")
async def register_user(user_id: str = Form(...), file: UploadFile = File(...)):
    """Register a user's voice sample"""
    logger.info(f"Registration request received for user_id: {user_id}")
    
    try:
        # Read the audio file
        audio_bytes = await file.read()
        logger.info(f"Audio file received, size: {len(audio_bytes)} bytes")
        
        # Save to a temporary file with the correct extension
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
            tmp_file_name = tmp_file.name
            tmp_file.write(audio_bytes)
            logger.info(f"Audio saved to temporary file: {tmp_file_name}")
            
        # Try loading the audio
        try:
            # Load from the temporary file which has proper metadata
            signal, fs = torchaudio.load(tmp_file_name)
            logger.info(f"Audio loaded: shape={signal.shape}, sample_rate={fs}")
        except Exception as e:
            logger.error(f"Error loading audio: {e}")
            return {"error": f"Could not read audio file: {str(e)}", "verified": False}
        finally:
            # Clean up
            if os.path.exists(tmp_file_name):
                os.remove(tmp_file_name)
        
        # Extract embedding
        embedding = extract_embedding(signal)
        logger.info(f"Embedding extracted, shape: {embedding.shape}")
        
        # Try Google Speech Recognition first, then fall back to SpeechBrain
        transcript = transcribe_with_google(signal)
        if not transcript:
            transcript = transcribe_audio(signal, fs).strip().lower()
        else:
            transcript = transcript.strip().lower()
            
        logger.info(f"Transcript: {transcript}")

        # Convert to numpy and then to binary
        embedding_np = embedding.cpu().numpy()
        embedding_binary = Binary(embedding_np.tobytes())

        # Store in DB
        collection.replace_one(
            {"user_id": user_id},
            {
                "user_id": user_id,
                "embedding": embedding_binary,
                "phrase": transcript
            },
            upsert=True
        )
        logger.info(f"User {user_id} registration successful")

        return {
            "message": f"User {user_id} registered successfully.",
            "stored_phrase": transcript,
            "verified": True
        }
    except Exception as e:
        logger.error(f"Registration error: {e}")
        # If we encounter any error, provide detailed information
        return {
            "error": f"Error processing audio: {str(e)}",
            "file_info": {
                "filename": file.filename,
                "content_type": file.content_type,
                "file_size": len(audio_bytes) if 'audio_bytes' in locals() else "unknown"
            },
            "verified": False
        }

@app.post("/verify")
async def verify_user(user_id: str = Form(...), file: UploadFile = File(...)):
    """Verify a user's voice against their stored reference"""
    logger.info(f"Verification request received for user_id: {user_id}")
    
    user_doc = collection.find_one({"user_id": user_id})
    if not user_doc:
        logger.warning(f"User {user_id} not found")
        return {"error": "User not found.", "verified": False}

    try:
        # Read the audio file
        audio_bytes = await file.read()
        logger.info(f"Audio file received, size: {len(audio_bytes)} bytes")
        
        # Save to a temporary file with the correct extension
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
            tmp_file_name = tmp_file.name
            tmp_file.write(audio_bytes)
            logger.info(f"Audio saved to temporary file: {tmp_file_name}")
            
        # Load from the temporary file which has proper metadata
        signal, fs = torchaudio.load(tmp_file_name)
        logger.info(f"Audio loaded: shape={signal.shape}, sample_rate={fs}")
        
        # Clean up
        if os.path.exists(tmp_file_name):
            os.remove(tmp_file_name)

        # Get embedding
        uploaded_embedding = extract_embedding(signal)
        logger.info(f"Embedding extracted, shape: {uploaded_embedding.shape}")
        
        # Try Google Speech Recognition first, then fall back to SpeechBrain
        transcript = transcribe_with_google(signal)
        if not transcript:
            transcript = transcribe_audio(signal, fs).strip().lower()
        else:
            transcript = transcript.strip().lower()
            
        logger.info(f"Transcript: {transcript}")

        # Reconstruct stored embedding
        try:
            stored_embedding_bytes = user_doc["embedding"]
            logger.info(f"Retrieved stored embedding, type: {type(stored_embedding_bytes)}")
            
            # Convert Binary to numpy array with correct shape
            np_array = np.frombuffer(stored_embedding_bytes, dtype=np.float32)
            logger.info(f"Converted to numpy array, shape: {np_array.shape}")
            
            # Get the correct embedding size from the uploaded embedding
            embedding_size = uploaded_embedding.shape[0]
            
            # Reshape np_array to match embedding size
            stored_embedding = torch.from_numpy(np_array).reshape(1, -1)
            logger.info(f"Reshaped stored embedding: {stored_embedding.shape}")
            
            # Reshape uploaded embedding to match
            uploaded_embedding = uploaded_embedding.reshape(1, -1)
            
            # Calculate similarity with explicit dimensions
            similarity = torch.nn.functional.cosine_similarity(
                stored_embedding, uploaded_embedding, dim=1
            ).item()
            
            logger.info(f"Similarity score: {similarity}")
            
            # Dynamic threshold based on similarity score
            speaker_match = similarity > 0.75  # More strict threshold for security
        except Exception as e:
            logger.error(f"Error processing embeddings: {e}")
            return {
                "error": f"Error processing embeddings: {str(e)}",
                "embedding_info": {
                    "stored_type": str(type(user_doc["embedding"])),
                    "uploaded_shape": uploaded_embedding.shape,
                    "exception": str(e)
                },
                "verified": False
            }

        # Compare phrase (optional verification)
        expected_phrase = user_doc["phrase"]
        if isinstance(expected_phrase, str):
            # It's already a string
            pass
        elif isinstance(expected_phrase, (list, tuple)) and len(expected_phrase) > 0:
            # Extract the first element if it's a list/tuple
            if isinstance(expected_phrase[0], str):
                expected_phrase = expected_phrase[0]
            elif isinstance(expected_phrase[0], (list, tuple)) and len(expected_phrase[0]) > 0:
                expected_phrase = expected_phrase[0][0] if isinstance(expected_phrase[0][0], str) else str(expected_phrase[0][0])
        else:
            # Convert to string for comparison
            expected_phrase = str(expected_phrase)
            
        logger.info(f"Expected phrase: '{expected_phrase}', Spoken phrase: '{transcript}'")
            
        # Compare using a more lenient method - check if major words are present
        expected_words = set(expected_phrase.lower().split())
        transcript_words = set(transcript.lower().split())
        common_words = expected_words.intersection(transcript_words)
        
        # If at least 50% of the expected words are present, consider it a match
        # This makes the phrase verification more lenient
        if len(expected_words) > 0:
            phrase_match_ratio = len(common_words) / len(expected_words)
            phrase_match = phrase_match_ratio >= 0.5
        else:
            phrase_match = True  # No phrase to match

        # For simplicity, only use voice biometrics and ignore phrase for now
        # This is more user-friendly but less secure
        verified = speaker_match

        return {
            "verified": verified,
            "speaker_match": speaker_match,
            "phrase_match": phrase_match,
            "similarity_score": round(similarity, 4),
            "spoken_phrase": transcript,
            "expected_phrase": expected_phrase
        }
    except Exception as e:
        logger.error(f"Verification error: {e}")
        return {
            "error": f"Error during verification: {str(e)}",
            "verified": False
        }

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8000"))
    host = os.environ.get("HOST", "0.0.0.0")
    
    # Create directories for models if they don't exist
    for dir_path in ["./pretrained_ecapa", "./pretrained_asr"]:
        if not os.path.exists(dir_path):
            os.makedirs(dir_path)
    
    # Log startup information
    logger.info(f"Starting voice authentication server on {host}:{port}")
    
    uvicorn.run(app, host=host, port=port)
