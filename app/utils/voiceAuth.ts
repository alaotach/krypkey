import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import axios from 'axios';
import { Platform } from 'react-native';
import { SecureStorage } from './storage';

// Voice authentication API base URL
const API_BASE_URL = 'http://192.168.80.248:8000';

export interface VoiceAuthResult {
  success: boolean;
  message: string;
  score?: number;
}

/**
 * Record audio for authentication
 * @param durationMs Duration of recording in milliseconds
 * @returns Path to the recorded audio file
 */
export const recordVoiceAuth = async (durationMs = 5000): Promise<string> => {
  try {
    // Request permissions
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) {
      throw new Error('Audio recording permission not granted');
    }

    // Configure audio
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    // Create recording with WAV format options for better compatibility
    const { recording } = await Audio.Recording.createAsync({
      android: {
        extension: '.wav',
        outputFormat: Audio.AndroidOutputFormat.DEFAULT, // Important: Use DEFAULT not MPEG_4
        audioEncoder: Audio.AndroidAudioEncoder.PCM_16BIT, // Important: Use PCM_16BIT not AAC
        sampleRate: 16000,
        numberOfChannels: 1,
        bitRate: 256000, // Higher bitrate for better quality
      },
      ios: {
        extension: '.wav',
        audioQuality: Audio.IOSAudioQuality.MAX, // Use maximum quality for iOS
        sampleRate: 16000,
        numberOfChannels: 1,
        bitRate: 256000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
      web: {
        mimeType: 'audio/wav',
        bitsPerSecond: 256000,
      }
    });
    
    console.log('Recording started');
    
    // Record for specified duration
    await new Promise(resolve => setTimeout(resolve, durationMs));
    
    // Stop recording
    await recording.stopAndUnloadAsync();
    console.log('Recording stopped');
    
    // Get recording URI
    const uri = recording.getURI();
    if (!uri) {
      throw new Error('Failed to get recording URI');
    }

    console.log('Recording URI:', uri);
    
    // Convert to WAV if needed (for Android)
    if (Platform.OS === 'android') {
      // Create a WAV file name
      const wavUri = `${FileSystem.cacheDirectory}voice_${Date.now()}.wav`;
      
      try {
        // Copy the original file to one with .wav extension
        await FileSystem.copyAsync({
          from: uri,
          to: wavUri
        });
        
        console.log('Converted to WAV:', wavUri);
        return wavUri;
      } catch (error) {
        console.error('Error converting to WAV:', error);
        // Fall back to original file if conversion fails
        return uri;
      }
    }

    return uri;
  } catch (error) {
    console.error('Error recording voice:', error);
    throw error;
  }
};

/**
 * Play an audio file for verification
 * @param audioUri URI of the audio file to play
 * @returns The sound object that can be used to control playback
 */
export const playAudio = async (audioUri: string): Promise<Audio.Sound> => {
  try {
    console.log(`Playing audio file from: ${audioUri}`);
    
    // Check if the file exists
    const fileInfo = await FileSystem.getInfoAsync(audioUri);
    if (!fileInfo.exists) {
      throw new Error(`Audio file does not exist at ${audioUri}`);
    }
    
    // Load the sound file
    const { sound } = await Audio.Sound.createAsync(
      { uri: audioUri },
      { shouldPlay: true, volume: 1.0 }
    );
    
    // Set up completion handler
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        console.log('Audio playback finished');
        sound.unloadAsync();
      }
    });
    
    return sound;
  } catch (error) {
    console.error('Error playing audio:', error);
    throw error;
  }
};

/**
 * Register a user's voice with the authentication service
 * @param userId User ID to register
 * @param audioUri Path to the audio file
 * @returns Result of the registration
 */
export const registerVoice = async (userId: string, audioUri: string): Promise<VoiceAuthResult> => {
  try {
    console.log(`Registering voice for user ${userId} with file ${audioUri}`);
    
    // Check if the file exists and get its info
    const fileInfo = await FileSystem.getInfoAsync(audioUri);
    if (!fileInfo.exists) {
      throw new Error(`Audio file does not exist at ${audioUri}`);
    }
    
    console.log('Audio file info:', fileInfo);
    
    // In React Native, we can't use Blob directly like in the browser
    const formData = new FormData();
    formData.append('user_id', userId);
    
    // Include a passphrase field explicitly to help the server process speech
    formData.append('passphrase', 'My voice is my passport, verify me');
    
    // Add specific file type information for better processing
    formData.append('file', {
      uri: Platform.OS === 'ios' ? audioUri.replace('file://', '') : audioUri,
      type: 'audio/wav',
      name: 'voice_registration.wav'
    } as any);
    
    console.log('Sending registration request to:', `${API_BASE_URL}/register`);
    
    // Send registration request with timeout and retry logic
    let attempts = 0;
    const maxAttempts = 2;
    
    while (attempts < maxAttempts) {
      try {
        const response = await axios.post(`${API_BASE_URL}/register`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Accept': 'application/json'
          },
          transformRequest: (data) => data,
          timeout: 10000 // 10 second timeout
        });
        
        console.log('Registration response:', response.data);
        
        // Check if we got a valid response
        if (response.data && (response.data.message || response.data.stored_phrase)) {
          // Store the voice authentication flag and user ID
          await SecureStorage.set('VOICE_AUTH_ENABLED', 'true');
          await SecureStorage.set('VOICE_AUTH_USER_ID', userId);
          
          return {
            success: true,
            message: 'Voice registration successful',
            score: response.data.similarity_score || 0
          };
        } else {
          throw new Error('Invalid server response format');
        }
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw error; // Re-throw if we've exhausted our attempts
        }
        console.log(`Registration attempt ${attempts} failed, retrying...`);
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    throw new Error('Failed after multiple attempts');
  } catch (error) {
    console.error('Error registering voice:', error);
    
    // Enhanced error logging
    if (axios.isAxiosError(error)) {
      console.error('API error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers,
      });
    }
    
    let errorMessage = 'Failed to register voice';
    if (axios.isAxiosError(error) && error.response?.data?.detail) {
      errorMessage = error.response.data.detail;
    }
    
    return {
      success: false,
      message: errorMessage
    };
  }
};

/**
 * Verify a user's voice against their registered sample
 * @param userId User ID to verify
 * @param audioUri Path to the audio file
 * @returns Result of the verification
 */
export const verifyVoice = async (userId: string, audioUri: string): Promise<VoiceAuthResult> => {
  try {
    console.log(`Verifying voice for user ${userId} with file ${audioUri}`);
    
    // Check if the file exists and get its info
    const fileInfo = await FileSystem.getInfoAsync(audioUri);
    if (!fileInfo.exists) {
      throw new Error(`Audio file does not exist at ${audioUri}`);
    }
    
    console.log('Audio file info:', fileInfo);
    
    // Create form data directly with the file URI
    const formData = new FormData();
    formData.append('user_id', userId);
    
    // Include a passphrase field explicitly to help the server process speech
    formData.append('passphrase', 'My voice is my passport, verify me');
    
    // Append the file using the URI directly
    formData.append('file', {
      uri: Platform.OS === 'ios' ? audioUri.replace('file://', '') : audioUri,
      type: 'audio/wav',
      name: 'voice_verification.wav'
    } as any);
    
    console.log('Sending verification request to:', `${API_BASE_URL}/verify`);
    
    // Send verification request with timeout
    const response = await axios.post(`${API_BASE_URL}/verify`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Accept': 'application/json'
      },
      transformRequest: (data) => data,
      timeout: 10000 // 10 second timeout
    });

    console.log('Verification response:', response.data);

    // More flexible response handling
    const isMatch = response.data.verified === true || 
                   response.data.similarity_score > 0.75 ||
                   (response.data.message && response.data.message.includes('successful'));
    
    return {
      success: isMatch,
      message: isMatch ? 'Voice verification successful' : 'Voice does not match',
      score: response.data.similarity_score || 0
    };
  } catch (error) {
    console.error('Error verifying voice:', error);
    
    // Enhanced error logging
    if (axios.isAxiosError(error)) {
      console.error('API error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
    }
    
    let errorMessage = 'Failed to verify voice';
    if (axios.isAxiosError(error) && error.response?.data?.detail) {
      errorMessage = error.response.data.detail;
    }
    
    return {
      success: false,
      message: errorMessage
    };
  }
};

/**
 * Check if voice authentication is enabled for the user
 */
export const isVoiceAuthEnabled = async (): Promise<boolean> => {
  try {
    const enabled = await SecureStorage.get('VOICE_AUTH_ENABLED');
    return enabled === 'true';
  } catch (error) {
    console.error('Error checking voice auth status:', error);
    return false;
  }
};

/**
 * Run a voice authentication test to verify functionality
 * @param userId User ID to test with
 * @returns Results of both positive and negative tests
 */
export const runVoiceAuthTest = async (userId: string): Promise<{
  registrationResult: VoiceAuthResult;
  positiveTestResult: VoiceAuthResult;
  negativeTestResult: VoiceAuthResult;
}> => {
  try {
    console.log('Starting voice authentication test for user:', userId);
    
    // 1. Record registration sample
    console.log('Recording registration sample...');
    const registrationAudio = await recordVoiceAuth(5000);
    console.log('Registration recording completed:', registrationAudio);
    
    // 2. Register the voice
    console.log('Registering voice...');
    const registrationResult = await registerVoice(userId, registrationAudio);
    console.log('Registration result:', registrationResult);
    
    // Small delay to ensure registration is processed
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 3. Verify with the same audio (positive test)
    console.log('Running positive verification test...');
    const positiveTestResult = await verifyVoice(userId, registrationAudio);
    console.log('Positive test result:', positiveTestResult);
    
    // 4. Record a different audio sample
    console.log('Recording different sample for negative test...');
    const differentAudio = await recordVoiceAuth(5000);
    console.log('Different recording completed:', differentAudio);
    
    // 5. Verify with the different audio (negative test)
    console.log('Running negative verification test...');
    const negativeTestResult = await verifyVoice(userId, differentAudio);
    console.log('Negative test result:', negativeTestResult);
    
    return {
      registrationResult,
      positiveTestResult,
      negativeTestResult
    };
  } catch (error) {
    console.error('Voice authentication test error:', error);
    throw error;
  }
};
