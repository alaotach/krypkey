# Voice Authentication Server

This server provides voice biometric authentication services for the KrypKey application.

## Features

- Voice enrollment (registration)
- Voice verification
- Speech-to-text transcription
- MongoDB storage for voice profiles

## Quick Start

### With Docker (Recommended)

1. Make sure Docker and Docker Compose are installed
2. Run the following command:

```bash
docker-compose up
```

This will start both the voice authentication server and MongoDB.

### Without Docker

1. Install MongoDB and make sure it's running
2. Install Python 3.9+ and the required dependencies:

```bash
pip install -r requirements-voice.txt
```

3. Run the server:

```bash
python voice_auth_server.py
```

## API Endpoints

### `GET /`

Health check endpoint

### `POST /register`

Register a new voice profile

**Parameters**:
- `user_id` (form): User ID
- `file` (form): WAV audio file of the user speaking a passphrase

**Returns**:
- Registration result with transcript of spoken phrase

### `POST /verify`

Verify a voice against a stored profile

**Parameters**:
- `user_id` (form): User ID
- `file` (form): WAV audio file to verify

**Returns**:
- Verification result with similarity score

## Environment Variables

- `PORT`: Server port (default: 8000)
- `HOST`: Server host (default: 0.0.0.0)
- `MONGODB_URI`: MongoDB connection URI (default: mongodb://localhost:27017)

## Troubleshooting

### Audio Format Issues

The server expects WAV files with these characteristics:
- Sample Rate: 16kHz
- Channels: 1 (Mono)
- Bit Depth: 16-bit

If you're having issues with audio format, use FFmpeg to convert your audio:

```bash
ffmpeg -i input.mp3 -ar 16000 -ac 1 -c:a pcm_s16le output.wav
```

### Model Download Issues

On first run, the server will download pretrained models which may take some time. Make sure you have a stable internet connection.

If model downloads fail, try manually downloading from:
- https://huggingface.co/speechbrain/spkrec-ecapa-voxceleb
- https://huggingface.co/speechbrain/asr-crdnn-rnnlm-librispeech
