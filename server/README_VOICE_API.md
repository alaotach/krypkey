# Voice Authentication API Wrapper

This wrapper helps handle format issues between the KrypKey app and the voice authentication service.

## Setup

1. Install Python dependencies:
```bash
pip install fastapi uvicorn python-multipart httpx numpy soundfile librosa
```

2. Install FFmpeg for better audio conversion:
- Windows: Download from https://ffmpeg.org/download.html and add to PATH
- macOS: `brew install ffmpeg`
- Linux: `apt-get install ffmpeg` or equivalent for your distribution

## Running the Wrapper

1. Start the main voice authentication server first (SpeechBrain-based)

2. Then run this wrapper:
```bash
python voice_api_wrapper.py
```

3. The wrapper will run on port 8080 by default
   - The mobile app should be configured to use this wrapper at http://localhost:8080/
   - The wrapper will forward requests to the voice API at http://localhost:8000/

## Environment Variables

- `VOICE_API_URL`: URL of the actual voice authentication API (default: http://localhost:8000)
- `PORT`: Port for this wrapper to listen on (default: 8080)

## Troubleshooting

If you see format conversion errors, make sure:
1. FFmpeg is installed and accessible from PATH
2. The librosa and soundfile Python packages are installed
3. The audio file from the mobile app is being properly recorded
