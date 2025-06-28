import os
import io
import tempfile
import numpy as np
import soundfile as sf
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("audio_converter")

def ensure_wav_format(audio_bytes):
    """
    Ensures that audio data is in WAV format suitable for processing.
    Converts if necessary using soundfile.
    
    Args:
        audio_bytes: Raw bytes of the audio file
        
    Returns:
        BytesIO object containing properly formatted WAV data
    """
    try:
        # Try to read the audio as-is first
        try:
            with io.BytesIO(audio_bytes) as audio_buffer:
                data, sample_rate = sf.read(audio_buffer)
                logger.info(f"Successfully read audio with shape {data.shape} at {sample_rate}Hz")
        except Exception as e:
            logger.warning(f"Initial audio format not readable: {str(e)}")
            # If it fails, assume it's a format issue and try conversion
            
            # Save to a temp file first
            with tempfile.NamedTemporaryFile(suffix='.tmp', delete=False) as temp_file:
                temp_file.write(audio_bytes)
                temp_path = temp_file.name
                
            try:
                # Try to use ffmpeg or similar to convert (if available)
                import subprocess
                output_path = temp_path + ".wav"
                subprocess.run(['ffmpeg', '-i', temp_path, '-ar', '16000', '-ac', '1', output_path], 
                               check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                
                with open(output_path, 'rb') as f:
                    converted_bytes = f.read()
                    
                os.remove(output_path)
                os.remove(temp_path)
                
                # Verify the converted data
                with io.BytesIO(converted_bytes) as audio_buffer:
                    data, sample_rate = sf.read(audio_buffer)
                    logger.info(f"Successfully converted audio: shape={data.shape}, rate={sample_rate}Hz")
                    
                return io.BytesIO(converted_bytes)
            
            except (ImportError, subprocess.SubprocessError) as e:
                logger.error(f"FFmpeg conversion failed: {str(e)}")
                # Fallback to manual conversion if FFmpeg fails
                try:
                    # Try reading with a more forgiving library
                    import librosa
                    data, sample_rate = librosa.load(temp_path, sr=16000, mono=True)
                    logger.info(f"Loaded with librosa: shape={data.shape}, rate={sample_rate}Hz")
                    
                    # Convert to float32 and normalize
                    data = data.astype(np.float32)
                    
                    # Write to WAV format
                    output_buffer = io.BytesIO()
                    sf.write(output_buffer, data, sample_rate, format='WAV')
                    output_buffer.seek(0)
                    
                    os.remove(temp_path)
                    return output_buffer
                    
                except Exception as e2:
                    logger.error(f"Librosa conversion failed: {str(e2)}")
                    os.remove(temp_path)
                    raise ValueError(f"Audio format not supported and conversion failed: {str(e)} | {str(e2)}")
        
        # If initial read succeeded, ensure it's mono and 16kHz
        if len(data.shape) > 1 and data.shape[1] > 1:
            logger.info("Converting stereo to mono")
            data = np.mean(data, axis=1)
            
        if sample_rate != 16000:
            logger.info(f"Resampling from {sample_rate}Hz to 16000Hz")
            # Resample to 16kHz
            import librosa
            data = librosa.resample(data, orig_sr=sample_rate, target_sr=16000)
            sample_rate = 16000
        
        # Normalize audio if needed
        if np.max(np.abs(data)) > 1.0:
            data = data / np.max(np.abs(data))
        
        # Write to a new BytesIO buffer in WAV format
        output_buffer = io.BytesIO()
        sf.write(output_buffer, data, sample_rate, format='WAV', subtype='PCM_16')
        output_buffer.seek(0)
        
        return output_buffer
        
    except Exception as e:
        logger.error(f"Audio conversion failed: {str(e)}")
        raise ValueError(f"Failed to process audio: {str(e)}")
