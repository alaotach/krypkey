import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, Animated,
  Dimensions,
  Platform, } from 'react-native';
import { ShieldPlus, Fingerprint, Lock, UserX } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, {
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withRepeat,
  useSharedValue,
  Easing,
  FadeInUp,
} from 'react-native-reanimated';
import { ImageBackground } from 'react-native';
import { SharedValue } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { SecureStorage } from '../utils/storage';
import * as LocalAuthentication from 'expo-local-authentication';
import axios from 'axios';
import * as Haptics from 'expo-haptics';
import { AppState, AppStateStatus } from 'react-native';
// import { Video } from 'expo-av';
// import { BlurView } from 'expo-blur';

// const { width } = Dimensions.get('window');
const ReanimatedTouchableOpacity = Reanimated.createAnimatedComponent(TouchableOpacity);

export default function Welcome() {
  const router = useRouter();
  const [walletExists, setWalletExists] = useState(false);
  const [fingerprintEnabled, setFingerprintEnabled] = useState(false);
  const [faceEnabled, setFaceEnabled] = useState(false);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showSessionInput, setShowSessionInput] = useState(false);
  const [sessionIdInput, setSessionIdInput] = useState('');
  const [snowflakes, setSnowflakes] = useState([]);

  const [duressEnabled, setDuressEnabled] = useState(false);
  const [duressMode, setDuressMode] = useState(false);
  const [volumeButtonCount, setVolumeButtonCount] = useState(0);
  const [lastVolumeButtonTime, setLastVolumeButtonTime] = useState(0);
  const appState = React.useRef(AppState.currentState);
  const [tapCount, setTapCount] = useState(0);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [wrongPasswordAttempts, setWrongPasswordAttempts] = useState(0);

  const fadeAnim = useSharedValue(0);
  const slideAnim = useSharedValue(50);
  const shakeAnim = useSharedValue(0);
  const glowAnim = useSharedValue(1);
  const neonAnim = useSharedValue(1);
  const backgroundImage1 = 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=1200&auto=format&fit=crop&q=60&ixlib=rb-4.0.3';
  const backgroundImage2 = 'https://images.unsplash.com/photo-1475274047050-1d0c0975c63e?w=1200&auto=format&fit=crop&q=60&ixlib=rb-4.0.3';
  const backgroundOpacity = useSharedValue(0);

  const handleLogoTap = () => {
    const now = Date.now();
    
    // Reset counter if it's been more than 2 seconds since last tap
    if (now - lastTapTime > 2000) {
      setTapCount(1);
    } else {
      setTapCount(prev => prev + 1);
    }
    
    setLastTapTime(now);
    
    // If user has tapped 5 times in quick succession and duress is enabled
    if (tapCount >= 4 && duressEnabled) {
      // Provide haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // If already in duress mode, attempt to exit
      if (duressMode) {
        // Attempt to exit duress mode
        deactivateDuressMode();
      } else {
        // Toggle duress mode (activation only)
        toggleDuressMode();
      }
      setTapCount(0);
    }
  };

  const toggleDuressMode = async () => {
    try {
      const newDuressMode = !duressMode;
      setDuressMode(newDuressMode);
      
      // Provide subtle haptic feedback to confirm the change
      Haptics.impactAsync(
        newDuressMode 
          ? Haptics.ImpactFeedbackStyle.Heavy 
          : Haptics.ImpactFeedbackStyle.Light
      );
      
      // Use proper key access
      await SecureStorage.set('DURESS_MODE_ACTIVE', newDuressMode ? 'true' : 'false');
      
      console.log(`Duress mode ${newDuressMode ? 'activated' : 'deactivated'}`);
    } catch (error) {
      console.error('Error toggling duress mode:', error);
    }
  };

  const checkDuressMode = async () => {
    try {
      // Use proper key access from the STORAGE_KEYS object
      const isDuressEnabled = await SecureStorage.get('DURESS_ENABLED') || 'false';
      const isDuressActive = await SecureStorage.get('DURESS_MODE_ACTIVE') || 'false';
      
      setDuressEnabled(isDuressEnabled === 'true');
      setDuressMode(isDuressActive === 'true');
    } catch (error) {
      console.error('Error checking duress mode:', error);
      // Set default values on error
      setDuressEnabled(false);
      setDuressMode(false);
    }
  };

  useEffect(() => {
    // Create snowflakes
    const generateSnowflakes = () => {
      const flakes = [];
      for (let i = 0; i < 30; i++) {
        flakes.push({
          id: i,
          x: Math.random() * Dimensions.get('window').width,
          y: Math.random() * Dimensions.get('window').height,
          size: Math.random() * 6 + 2,
          speed: Math.random() * 2 + 1,
          opacity: Math.random() * 0.7 + 0.3
        });
      }
      setSnowflakes(flakes);
    };
    
    generateSnowflakes();
    
    // Animate snowflakes
    const snowflakeInterval = setInterval(() => {
      setSnowflakes(prevFlakes => 
        prevFlakes.map(flake => ({
          ...flake,
          y: (flake.y + flake.speed) % Dimensions.get('window').height,
          x: flake.x + Math.sin(flake.y / 50) * 0.5
        }))
      );
    }, 50);
    
    return () => clearInterval(snowflakeInterval);
  }, []);

  // useEffect(() => {
  //   // Set up the volume button listener
  //   const cleanupListener = setupVolumeButtonListener();
    
  //   return () => {
  //     // Clean up listeners when component unmounts
  //     cleanupListener();
  //   };
  // }, [duressEnabled, volumeButtonCount, lastVolumeButtonTime]);
  

  useEffect(() => {
    setTimeout(() => {
      checkWalletExists();
      setIsLoading(false);
      fadeAnim.value = withTiming(1, { duration: 500 });
      slideAnim.value = withSpring(0);
      
      // Start continuous animations
      glowAnim.value = withRepeat(
        withSequence(
          withTiming(1.3, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1, // Infinite repeat
        true // Reverse on repeat
      );
      
      neonAnim.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      
      // Add background image crossfade animation
      backgroundOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 5000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 5000, easing: Easing.inOut(Easing.ease) })
        ),
        -1, // Infinite repeat
        true // Reverse on repeat
      );
    }, 1000);
  }, []);
  const backgroundStyle1 = useAnimatedStyle(() => {
    return {
      opacity: 1 - backgroundOpacity.value,
    };
  });
  
  const backgroundStyle2 = useAnimatedStyle(() => {
    return {
      opacity: backgroundOpacity.value,
    };
  });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: fadeAnim.value,
      transform: [
        { translateY: slideAnim.value },
        { translateX: shakeAnim.value }
      ],
    };
  });
  
  const glowStyle = useAnimatedStyle(() => {
    return {
      style: {
        shadowColor: "#4F46E5",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6 * glowAnim.value,
        shadowRadius: 15 * glowAnim.value,
        elevation: 8 * glowAnim.value,
        padding: 5,
      },
    };
  });
  // ...existing code...
  const neonTextStyle = useAnimatedStyle(() => {
    const fontFamilyValue = 
      Platform.OS === 'ios' 
        ? 'System' 
        : Platform.OS === 'android' 
        ? 'Roboto' 
        : 'System';
  
    return {
      style: {
        color: '#fff',
        fontSize: 32,
        fontWeight: 'bold',
        marginTop: 20,
        fontFamily: fontFamilyValue,
        textShadowColor: "#4F46E5",
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10 * neonAnim.value,
      },
    };
  });

  const deactivateDuressMode = async () => {
    try {
      // Check if we're currently in duress mode
      if (!duressMode) return;
      
      // Use alert with custom input handling based on platform
      if (Platform.OS === 'ios') {
        // iOS supports Alert.prompt natively
        Alert.prompt(
          'Security Check',  // Use a generic title to avoid revealing purpose
          'Please enter your password to continue',
          [
            {
              text: 'Cancel',
              onPress: () => console.log('Cancelled'),
              style: 'cancel',
            },
            {
              text: 'Continue',
              onPress: (deactivationPassword) => verifyAndDeactivate(deactivationPassword),
            }
          ],
          'secure-text'
        );
      } else {
        // For Android: show a custom modal for password input
        Alert.alert(
          'Security Check',
          'Authentication required to continue',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Continue',
              onPress: () => {
                // For Android, we need a custom password input
              // Since we can't show an input in Alert directly, we'll use fingerprint if available
              if (fingerprintEnabled) {
                performBiometricCheck();
              } else {
                // In a real app, you would show a Modal with TextInput here
                Alert.alert(
                  'Enter Password',
                  'Please enter your password:',
                  [
                    {
                      text: 'Cancel',
                      style: 'cancel'
                    },
                    {
                      text: 'Submit',
                      onPress: () => {
                        // This is a placeholder - in a real app, you'd get the password from a TextInput
                        const mockPassword = password; // Use the current password field's value
                        verifyAndDeactivate(mockPassword);
                      }
                    }
                  ]
                );
              }
            }
          }
        ]
      );
    }
  } catch (error) {
    console.error('Error deactivating duress mode:', error);
    Alert.alert('Operation Failed', 'Please try again later.');
  }
};

const verifyAndDeactivate = async (password) => {
  try {
    console.log("Verifying password for duress mode deactivation");
    const storedPassword = await SecureStorage.get('PASSWORD');
    
    if (password === storedPassword) {
      // If correct password, proceed with fingerprint check if enabled
      if (fingerprintEnabled) {
        performBiometricCheck();
      } else {
        // Password only verification completed successfully
        completeDeactivation();
      }
    } else {
      // Wrong password - show generic error after a delay
      console.log("Password verification failed");
      setTimeout(() => {
        Alert.alert('Authentication Failed', 'Please check your credentials and try again.');
      }, 1000);
    }
  } catch (error) {
    console.error('Error in verification:', error);
    Alert.alert('Verification Failed', 'Please try again later.');
  }
};
  
const performBiometricCheck = async () => {
  try {
    console.log("Performing biometric check for duress deactivation");
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to continue',
      fallbackLabel: 'Use Passcode',
    });
    
    if (result.success) {
      console.log("Biometric authentication successful");
      completeDeactivation();
    } else {
      console.log('Biometric verification failed');
      Alert.alert('Authentication Failed', 'Biometric verification unsuccessful.');
    }
  } catch (error) {
    console.error('Error during biometric check:', error);
    Alert.alert('Biometric Check Failed', 'Please try again later.');
  }
};
  
const completeDeactivation = async () => {
  try {
    console.log("Completing duress mode deactivation");
    await SecureStorage.set('DURESS_MODE_ACTIVE', 'false');
    setDuressMode(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Subtly indicate success without explicitly mentioning duress mode
    Alert.alert('Security Update', 'Your security settings have been updated successfully.');
  } catch (error) {
    console.error('Error completing deactivation:', error);
    Alert.alert('Update Failed', 'Could not update security settings.');
  }
};

  const checkWalletExists = async () => {
    try {
      // Use proper key access
      const walletCreated = await SecureStorage.get('WALLET_CREATED') || 'false';
      const fingerprint = await SecureStorage.get('FINGERPRINT') || 'false';
      const face = await SecureStorage.get('FACE') || 'false';
      const isDuressEnabled = await SecureStorage.get('DURESS_ENABLED') || 'false';
      const isDuressActive = await SecureStorage.get('DURESS_MODE_ACTIVE') || 'false';
      
      setWalletExists(walletCreated === 'true');
      setFingerprintEnabled(fingerprint === 'true');
      setFaceEnabled(face === 'true');
      setDuressEnabled(isDuressEnabled === 'true');
      setDuressMode(isDuressActive === 'true');
    } catch (error) {
      console.error('Error checking wallet existence:', error);
      // Set default values on error
      setWalletExists(false);
      setFingerprintEnabled(false);
      setFaceEnabled(false);
      setDuressEnabled(false);
      setDuressMode(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      const storedPassword = await SecureStorage.get('PASSWORD');
      const isDuressActive = await SecureStorage.get('DURESS_MODE_ACTIVE');
      
      // If duress mode is already active, allow any password to work
      if (isDuressActive === 'true') {
        console.log("Duress mode already active, allowing any password");
        
        // Continue with login using the stored credentials
        const username = await SecureStorage.get('USERNAME');
        const private_key = await SecureStorage.get('PRIVATE_KEY');
        const response = await axios.post('http://192.168.179.248:5000/api/users/login', {
          username,
          password: storedPassword, // Use the real password for API auth
          private_key
        });
        
        const { token } = response.data;
        await SecureStorage.set('AUTH_TOKEN', token);
        await checkPendingSessions();
        
        // Keep duress mode active
        await SecureStorage.set('DURESS_MODE_ACTIVE', 'true');
        setDuressMode(true);
        
        // Redirect to passwords screen
        router.replace('/(tabs)/passwords');
        return;
      }
      
      // Check if we've reached the threshold for duress mode activation
      if (wrongPasswordAttempts >= 2 && duressEnabled && !duressMode) {
        console.log("Activating duress mode and logging in automatically");
        await toggleDuressMode(); // Activate duress mode
        
        // Continue with login using the stored credentials
        const username = await SecureStorage.get('USERNAME');
        const private_key = await SecureStorage.get('PRIVATE_KEY');
        const response = await axios.post('http://192.168.179.248:5000/api/users/login', {
          username,
          password: storedPassword,
          private_key
        });
        
        const { token } = response.data;
        await SecureStorage.set('AUTH_TOKEN', token);
        await checkPendingSessions();
        
        // Make sure duress mode is set for the password screen
        await SecureStorage.set('DURESS_MODE_ACTIVE', 'true');
        
        // Redirect to passwords screen
        router.replace('/(tabs)/passwords');
        return;
      }
      
      // Original logic for correct password
      if (storedPassword === password) {
        // Reset wrong password attempts on success
        setWrongPasswordAttempts(0);
        
        // Continue with your existing login logic
        const username = await SecureStorage.get('USERNAME');
        const private_key = await SecureStorage.get('PRIVATE_KEY');
        const response = await axios.post('http://192.168.179.248:5000/api/users/login', {
          username,
          password: storedPassword,
          private_key
        });
        
        const { token } = response.data;
        await SecureStorage.set('AUTH_TOKEN', token);
        
        // After login success, check if we have any pending sessions
        await checkPendingSessions();
        
        // Store duress mode state for the password screen to use
        if (duressMode) {
          await SecureStorage.set('DURESS_MODE_ACTIVE', 'true');
        }
        
        router.replace('/(tabs)/passwords');
      } else {
        // Increment wrong password attempts
        const newAttempts = wrongPasswordAttempts + 1;
        setWrongPasswordAttempts(newAttempts);
        
        setError('Incorrect password. Please try again.');
        shakeAnim.value = withSequence(
          withTiming(-10, { duration: 100 }),
          withTiming(10, { duration: 100 }),
          withTiming(-10, { duration: 100 }),
          withTiming(10, { duration: 100 }),
          withTiming(0, { duration: 100 })
        );
      }
    } catch (error) {
      console.error('Error logging in:', error);
      setError('Failed to log in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Add a new function to check for pending sessions
  const checkPendingSessions = async () => {
    try {
      const username = await SecureStorage.get('USERNAME');
      const authToken = await SecureStorage.get('AUTH_TOKEN');
      
      if (!username || !authToken) return;
      
      // Get list of sessions for this user with pending passwords
      const response = await axios.get('http://192.168.179.248:5000/api/sessions/list', {
        params: { username, pendingOnly: true },
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      const sessionsWithPending = response.data?.filter(
        session => session.pendingPasswords && session.pendingPasswords.length > 0
      );
      
      if (sessionsWithPending && sessionsWithPending.length > 0) {
        Alert.alert(
          'Pending Passwords Found',
          `Found ${sessionsWithPending.length} session(s) with pending passwords. Would you like to process them now?`,
          [
            {
              text: 'Later',
              style: 'cancel'
            },
            {
              text: 'Yes',
              onPress: () => processPendingSessions(sessionsWithPending)
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error checking pending sessions:', error);
    }
  };
  
  // Function to process all pending sessions
  const processPendingSessions = async (sessions) => {
    try {
      setIsLoading(true);
      const privateKey = await SecureStorage.get('PRIVATE_KEY');
      const authToken = await SecureStorage.get('AUTH_TOKEN');
      const username = await SecureStorage.get('USERNAME');
      
      if (!privateKey || !authToken || !username) {
        throw new Error('Missing required authentication data');
      }
      
      let totalProcessed = 0;
      
      for (const session of sessions) {
        try {
          const processedCount = await processPendingPasswordsForSession(
            session.sessionId, 
            authToken, 
            privateKey,
            username
          );
          totalProcessed += processedCount;
        } catch (sessionError) {
          console.error(`Error processing session ${session.sessionId}:`, sessionError);
        }
      }
      
      if (totalProcessed > 0) {
        Alert.alert('Success', `Successfully processed ${totalProcessed} pending password(s)`);
        await SecureStorage.set('PASSWORDS_UPDATED', 'true');
      } else {
        Alert.alert('No Changes', 'No new passwords were processed');
      }
    } catch (error) {
      console.error('Error processing pending sessions:', error);
      Alert.alert('Error', 'Failed to process pending passwords');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Add a new function to toggle session input visibility
  const toggleSessionInput = () => {
    setShowSessionInput(!showSessionInput);
    if (showSessionInput) {
      setSessionIdInput('');
    }
  };
  
  // Add a new function to manually authenticate a session by ID
  const handleManualSessionAuth = async () => {
    if (!sessionIdInput || sessionIdInput.length < 8) {
      Alert.alert('Invalid Input', 'Please enter a valid session ID');
      return;
    }
    
    setIsLoading(true);
    try {
      const privateKey = await SecureStorage.get('PRIVATE_KEY');
      const authToken = await SecureStorage.get('AUTH_TOKEN');
      const username = await SecureStorage.get('USERNAME');
      
      if (!privateKey || !authToken || !username) {
        throw new Error('Missing required authentication data');
      }
      
      // Authenticate the session
      await axios.post(
        'http://192.168.179.248:5000/api/sessions/authenticate', 
        {
          sessionId: sessionIdInput,
          username,
          privateKey,
          deviceName: 'Mobile App'
        },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Process any pending passwords
      const passwordCount = await processPendingPasswordsForSession(
        sessionIdInput,
        authToken,
        privateKey,
        username
      );
      
      if (passwordCount > 0) {
        Alert.alert(
          'Success', 
          `Authenticated successfully and synced ${passwordCount} passwords!`,
          [{ text: 'OK', onPress: () => router.replace('/(tabs)/passwords') }]
        );
      } else {
        Alert.alert(
          'Success', 
          'Browser extension authenticated successfully!',
          [{ text: 'OK', onPress: () => router.replace('/(tabs)/passwords') }]
        );
      }
    } catch (error) {
      console.error('Error authenticating session:', error);
      Alert.alert('Authentication Failed', 'Failed to authenticate browser extension session. Please try again.');
    } finally {
      setIsLoading(false);
      setSessionIdInput('');
      setShowSessionInput(false);
    }
  };
  
  // Process pending passwords for a specific session
  const processPendingPasswordsForSession = async (
    sessionId: string,
    authToken: string,
    privateKey: string,
    username: string
  ) => {
    console.log('Processing pending passwords for session:', sessionId);
    
    try {
      // Use the server-side processing endpoint to handle all encryption/decryption
      const processResponse = await axios.post(
        'http://192.168.179.248:5000/api/sessions/process-passwords',
        {
          sessionId,
          username,
          privateKey
        },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const { processedCount, message } = processResponse.data;
      console.log(message);
      
      return processedCount || 0;
    } catch (error) {
      console.error('Error processing pending passwords:', error);
      throw error;
    }
  };

  const handleFingerprintLogin = async () => {
    try {
      // Check if duress mode is already active
      const isDuressActive = await SecureStorage.get('DURESS_MODE_ACTIVE');
      
      if (isDuressActive === 'true') {
        // If duress mode is already active, skip biometric check
        console.log("Duress mode already active, bypassing biometric check");
        
        // Use stored credentials for API auth
        const username = await SecureStorage.get('USERNAME');
        const storedPassword = await SecureStorage.get('PASSWORD');
        const private_key = await SecureStorage.get('PRIVATE_KEY');
        
        const response = await axios.post('http://192.168.179.248:5000/api/users/login', {
          username,
          password: storedPassword,
          private_key
        });
        
        const { token } = response.data;
        await SecureStorage.set('AUTH_TOKEN', token);
        await checkPendingSessions();
        
        // Keep duress mode active
        setDuressMode(true);
        
        router.replace('/(tabs)/passwords');
        return;
      }
      
      // Continue with normal biometric flow if duress mode isn't active
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to log in',
        fallbackLabel: 'Use Passcode',
      });
  
      if (result.success) {
        // Reset wrong attempts on success
        setWrongPasswordAttempts(0);
        
        // Continue with your existing login logic
        const username = await SecureStorage.get('USERNAME');
        const storedPassword = await SecureStorage.get('PASSWORD');
        const private_key = await SecureStorage.get('PRIVATE_KEY');
        const response = await axios.post('http://192.168.179.248:5000/api/users/login', {
          username,
          password: storedPassword,
          private_key
        });
  
        const { token } = response.data;
        await SecureStorage.set('AUTH_TOKEN', token);
        
        // After login success, check if we have any pending sessions
        await checkPendingSessions();
        
        // Store duress mode state for the password screen to use
        if (duressMode) {
          await SecureStorage.set('DURESS_MODE_ACTIVE', 'true');
        }
        
        router.replace('/(tabs)/passwords');
      } else {
        // Increment wrong attempts
        const newAttempts = wrongPasswordAttempts + 1;
        setWrongPasswordAttempts(newAttempts);
        
        // Check if we've reached the threshold for duress mode activation
        if (newAttempts >= 2 && duressEnabled && !duressMode) {
          console.log("Activating duress mode and logging in automatically after biometric failure");
          await toggleDuressMode(); // Activate duress mode
          
          // Auto login with stored credentials
          const username = await SecureStorage.get('USERNAME');
          const storedPassword = await SecureStorage.get('PASSWORD');
          const private_key = await SecureStorage.get('PRIVATE_KEY');
          
          const response = await axios.post('http://192.168.179.248:5000/api/users/login', {
            username,
            password: storedPassword,
            private_key
          });
          
          const { token } = response.data;
          await SecureStorage.set('AUTH_TOKEN', token);
          await checkPendingSessions();
          
          // Make sure duress mode is set for the password screen
          await SecureStorage.set('DURESS_MODE_ACTIVE', 'true');
          
          router.replace('/(tabs)/passwords');
        } else {
          Alert.alert('Authentication Failed', 'Fingerprint authentication failed. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error with fingerprint authentication:', error);
      Alert.alert('Authentication Error', 'An error occurred during fingerprint authentication. Please try again.');
    }
  };

  

  const handleFaceLogin = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to log in',
        fallbackLabel: 'Use Passcode',
      });

      if (result.success) {
        const username = await SecureStorage.get('USERNAME');
        const storedPassword = await SecureStorage.get('PASSWORD');
        const private_key = await SecureStorage.get('PRIVATE_KEY');
        const response = await axios.post('http://192.168.179.248:5000/api/users/login', {
          username,
          password: storedPassword,
          private_key
        });

        const { token } = response.data;
        await SecureStorage.set('AUTH_TOKEN', token);
        
        // After login success, check if we have any pending sessions
        await checkPendingSessions();
        
        router.replace('/(tabs)/passwords');
      } else {
        Alert.alert('Authentication Failed', 'Face authentication failed. Please try again.');
      }
    } catch (error) {
      console.error('Error with face authentication:', error);
      Alert.alert('Authentication Error', 'An error occurred during face authentication. Please try again.');
    }
  };

  const handleDeleteAccount = async () => {
    try {
      let identifier = await SecureStorage.get('USERNAME');
      if (!identifier) {
        identifier = await SecureStorage.get('PRIVATE_KEY');
        if (!identifier) {
          Alert.alert('Error', 'No username or private key found.');
          return;
        }
      }

      setIsLoading(true);
      const authToken = await SecureStorage.get('AUTH_TOKEN');
      await axios.post('http://192.168.179.248:5000/api/users/delete', { identifier }, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
    } catch (error) {
      console.error('Error deleting account from database:', error);
    } finally {
      await SecureStorage.set('WALLET_CREATED', 'false');
      await SecureStorage.clear();
      Alert.alert('Account Deleted', 'Your account has been deleted successfully.');
      router.replace('/');
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Checking Wallet...</Text>
      </View>
    );
  }

if (walletExists) {
  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={handleLogoTap}
      style={{flex: 1, width: '100%'}}
    >
      <LinearGradient
        colors={['#0a0b16', '#1a1b2e']}
        style={styles.container}
      >
      {/* <Reanimated.View style={[styles.backgroundContainer, backgroundStyle1]}>
        <ImageBackground 
          source={{ uri: backgroundImage1 }} 
          style={styles.backgroundImage} 
          // blurRadius={5}
        />
      </Reanimated.View>

      <Reanimated.View style={[styles.backgroundContainer, backgroundStyle2]}>
        <ImageBackground 
          source={{ uri: backgroundImage2 }} 
          style={styles.backgroundImage} 
          // blurRadius={5}
        />
      </Reanimated.View> */}
      {/* <Video
          source={{
            uri: 'https://www.pexels.com/download/video/856309/?fps=30.0&h=720&w=1280',
          }}
          style={styles.backgroundVideo}
          resizeMode="cover"
          shouldPlay
          isLooping
          isMuted
        /> */}

      {snowflakes.map(flake => (
        <View
          key={flake.id}
          style={{
            position: 'absolute',
            left: flake.x,
            top: flake.y,
            width: flake.size,
            height: flake.size,
            borderRadius: flake.size / 2,
            backgroundColor: 'rgba(255, 255, 255, ' + flake.opacity + ')',
          }}
        />
      ))}

      {/* Keep only one Reanimated.View for your content */}
      <Reanimated.View style={[styles.content, animatedStyle]}>
        <View style={styles.header}>
        <TouchableOpacity 
          activeOpacity={0.8}
          onPress={handleLogoTap}
        >
          <Reanimated.View 
            style={[
              glowStyle.style, 
              styles.logoContainer,
              duressMode && duressEnabled ? { borderColor: 'rgba(239, 68, 68, 0.4)' } : {}
            ]}
          >
            <ShieldPlus size={80} color={duressMode && duressEnabled ? "#FCA5A5" : "#A5F3FC"} />
          </Reanimated.View>
        </TouchableOpacity>
          <Reanimated.Text style={[styles.title, neonTextStyle.style]}>
            KrypKey
          </Reanimated.Text>
          <Text style={styles.subtitle}>Secure Password Manager</Text>
          <View style={styles.frostLine} />
        </View>

        {error && (
          <Reanimated.View style={[styles.errorContainer, animatedStyle]}>
            <Text style={styles.errorText}>{error}</Text>
          </Reanimated.View>
        )}

        {duressEnabled && (
          <Text style={[
            styles.duressHint, 
            duressMode ? {color: 'rgba(252, 165, 165, 0.6)'} : {}
          ]}>
            {duressMode 
              ? "Duress mode active" 
              : "Tap shield 5x for duress mode"}
          </Text>
        )}
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor="#6b7280"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <Lock style={styles.inputIcon} size={20} color="#4F46E5" />
        </View>

        <ReanimatedTouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleLogin}
        >
          <Text style={styles.buttonText}>Log In</Text>
        </ReanimatedTouchableOpacity>

        {fingerprintEnabled && (
          <TouchableOpacity
            style={[styles.button, styles.biometricButton]}
            onPress={handleFingerprintLogin}
          >
            <Fingerprint size={20} color="#fff" />
            <Text style={styles.buttonText}>Login with Fingerprint</Text>
          </TouchableOpacity>
        )}

        {faceEnabled && (
          <TouchableOpacity
            style={[styles.button, styles.primaryButton, styles.biometricButton]}
            onPress={handleFaceLogin}
          >
            <Text style={styles.buttonText}>Log In with Face</Text>
          </TouchableOpacity>
        )}

        {/* Manual session ID entry UI */}
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={toggleSessionInput}
        >
          <Text style={styles.buttonText}>
            {showSessionInput ? "Hide Connection" : "Connect Browser Extension"}
          </Text>
        </TouchableOpacity>

        {showSessionInput && (
          <Reanimated.View style={styles.sessionInputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Enter Session ID"
              placeholderTextColor="#6b7280"
              value={sessionIdInput}
              onChangeText={setSessionIdInput}
            />
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={handleManualSessionAuth}
            >
              <Text style={styles.buttonText}>Connect</Text>
            </TouchableOpacity>
          </Reanimated.View>
        )}

      <TouchableOpacity 
        onPress={handleDeleteAccount} 
        activeOpacity={0.7} 
        style={styles.deleteButtonContainer}>
        <LinearGradient 
          colors={["#ff3131", "#8B0000"]} 
          style={styles.hexagon}>
          <Text style={styles.text}>Delete</Text>
        </LinearGradient>
      </TouchableOpacity>
      </Reanimated.View>
    </LinearGradient>
  </TouchableOpacity>
  );
  }

  return (
    <LinearGradient
      colors={['#0a0b16', '#1a1b2e']}
      style={styles.container}
    >
      <Reanimated.View style={[styles.content, animatedStyle]}>
        <View style={styles.header}>
          <Reanimated.View style={glowStyle}>
            <ShieldPlus size={80} color="#4F46E5" />
          </Reanimated.View>
          <Reanimated.Text style={[styles.title, neonTextStyle]}>KrypKey</Reanimated.Text>
          <Text style={styles.subtitle}>Your Secure Password Manager</Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={() => router.push('/create')}
          >
            <Text style={styles.buttonText}>Create New Wallet</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.outlineButton]}
            onPress={() => router.push('/restore')}
          >
            <Text style={styles.outlineButtonText}>
              Restore Existing Wallet
            </Text>
          </TouchableOpacity>
        </View>
      </Reanimated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  duressHint: {
    fontSize: 12,
    color: 'rgba(209, 213, 253, 0.5)',
    marginTop: 4,
  },
  deleteButtonContainer: {
  width: 100,
  marginTop: 20,
  height: 55,
},
  container: {
    flex: 1,
    ...(Platform.OS === 'web' ? { height: Dimensions.get('window').height } : {}),
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    width: 100,
    height: 60,
    backgroundColor: "rgba(255, 50, 50, 0.6)",
    borderRadius: 15,
    shadowColor: "#ff3131",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20, // Soft blur for the glow
  },
  hexagon: {
    width: 100,
    height: 55,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#ff3131",
    borderRadius: 10,
    shadowColor: "#ff3131",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15, // Increased for more glow
    backgroundColor: 'rgba(153, 27, 27, 0.4)', // More translucent for glass effect
  },
  text: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
    textTransform: "uppercase",
  },


  backgroundVideo: {
    ...StyleSheet.absoluteFillObject,
    // Rotate 90 degrees
    opacity: 0.4,
  },
  backgroundContainer: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  backgroundImage: {
    flex: 1,
    width: null,
    height: null,
    resizeMode: 'contain',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 11, 22, 0.75)', // Dark overlay to improve contrast
  },
  // Update content style to be more transparent
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    // backgroundColor: 'rgba(16, 20, 40, 0.5)', // More visible blue tint
    borderRadius: 20,
    borderWidth: 0,
    // borderColor: 'rgba(165, 243, 252, 0.3)', // Light blue border for frost effect
    shadowColor: "#A5F3FC", 
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 30,
    backdropFilter: Platform.OS === 'web' ? 'blur(15px)' : undefined,
  },
  frostLine: {
    height: 1,
    width: '80%',
    backgroundColor: 'rgba(165, 243, 252, 0.6)',
    marginTop: 15,
    shadowColor: "#A5F3FC",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  logoContainer: {
    backgroundColor: 'rgba(165, 243, 252, 0.1)',
    borderRadius: 40,
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(165, 243, 252, 0.4)',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    padding: 20,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: "#A5F3FC",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#E0F2FE', // Slightly blue tinted white
    marginTop: 20,
    fontFamily: Platform.OS === 'ios' ? 'System' : 
               Platform.OS === 'android' ? 'Roboto' : 'System',
    textShadowColor: "#A5F3FC",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  subtitle: {
    fontSize: 16,
    color: '#d1d5fd', // Slightly bluer tint
    marginTop: 10,
    textShadowColor: "#A5F3FC", // Ice blue shadow
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
    position: 'relative',
  },
  input: {
    width: '100%',
    backgroundColor: 'rgba(26, 27, 46, 0.6)',
    borderColor: 'rgba(165, 243, 252, 0.5)',
    borderWidth: 2,
    borderRadius: 12,
    padding: 15,
    color: '#fff',
    paddingRight: 40,
    shadowColor: "#A5F3FC",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 50,
  },
  inputIcon: {
    position: 'absolute',
    right: 15,
    top: 15,
  },
  buttonContainer: {
    width: '100%',
    gap: 16,
  },
  button: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButton: {
    backgroundColor: 'rgba(79, 70, 229, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(165, 243, 252, 0.6)',
    shadowColor: "#A5F3FC",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 80,
  },
  biometricButton: {
    backgroundColor: 'rgba(45, 45, 74, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(165, 243, 252, 0.6)',
    shadowColor: "#A5F3FC",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 12,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#4F46E5',
  },
  deleteButton: {
    backgroundColor: '#991b1b',
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: "#4F46E5",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8, // Neon glow
  },
  outlineButtonText: {
    color: '#4F46E5',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: '#ef4444',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
    width: '100%',
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
  },
  sessionInputContainer: {
    width: '100%',
    marginTop: 10,
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  
});