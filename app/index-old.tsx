import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Shield } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SecureStorage } from '../utils/storage';
import * as LocalAuthentication from 'expo-local-authentication';
import axios from 'axios';

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

  useEffect(() => {
    checkWalletExists();
  }, []);

  const checkWalletExists = async () => {
    try {
      const walletCreated = await SecureStorage.get('WALLET_CREATED');
      const fingerprint = await SecureStorage.get('FINGERPRINT');
      const face = await SecureStorage.get('FACE');
      setWalletExists(walletCreated === 'true');
      setFingerprintEnabled(fingerprint === 'true');
      setFaceEnabled(face === 'true');
    } catch (error) {
      console.error('Error checking wallet existence:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      const storedPassword = await SecureStorage.get('PASSWORD');
      if (storedPassword === password) {
        // Make login request to server to get JWT token
        const username = await SecureStorage.get('USERNAME');
        const private_key = await SecureStorage.get('PRIVATE_KEY');
        const response = await axios.post('http://192.168.1.7:5000/api/users/login', {
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
        setError('Incorrect password. Please try again.');
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
      const response = await axios.get('http://192.168.1.7:5000/api/sessions/list', {
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
        'http://192.168.1.7:5000/api/sessions/authenticate', 
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
        'http://192.168.1.7:5000/api/sessions/process-passwords',
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
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to log in',
        fallbackLabel: 'Use Passcode',
      });

      if (result.success) {
        const username = await SecureStorage.get('USERNAME');
        const storedPassword = await SecureStorage.get('PASSWORD');
        const private_key = await SecureStorage.get('PRIVATE_KEY');
        const response = await axios.post('http://192.168.1.7:5000/api/users/login', {
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
        Alert.alert('Authentication Failed', 'Fingerprint authentication failed. Please try again.');
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
        const response = await axios.post('http://192.168.1.7:5000/api/users/login', {
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
      await axios.post('http://192.168.1.7:5000/api/users/delete', { identifier }, {
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
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Checking wallet...</Text>
      </View>
    );
  }

  if (walletExists) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Shield size={80} color="#4F46E5" />
          <Text style={styles.title}>KrypKey</Text>
          <Text style={styles.subtitle}>Enter your password to log in</Text>
        </View>
        
        {error && <Text style={styles.errorText}>{error}</Text>}

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#6b7280"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity 
          style={[styles.button, styles.primaryButton]}
          onPress={handleLogin}
        >
          <Text style={styles.buttonText}>Log In</Text>
        </TouchableOpacity>

        {fingerprintEnabled && (
          <TouchableOpacity 
            style={[styles.button, styles.primaryButton, styles.biometricButton]}
            onPress={handleFingerprintLogin}
          >
            <Text style={styles.buttonText}>Log In with Fingerprint</Text>
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
        
        {/* Add the manual session ID entry UI */}
        <TouchableOpacity 
          style={[styles.button, styles.linkButton]}
          onPress={() => setShowSessionInput(!showSessionInput)}
        >
          <Text style={styles.linkButtonText}>
            {showSessionInput ? 'Hide Session Input' : 'Connect Browser Extension'}
          </Text>
        </TouchableOpacity>
        
        {showSessionInput && (
          <View style={styles.sessionInputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Enter Session ID from browser extension"
              placeholderTextColor="#6b7280"
              value={sessionIdInput}
              onChangeText={setSessionIdInput}
            />
            <TouchableOpacity 
              style={[styles.button, styles.primaryButton]}
              onPress={handleManualSessionAuth}
              disabled={!sessionIdInput}
            >
              <Text style={styles.buttonText}>Connect Browser</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity 
          style={[styles.button, styles.deleteButton]}
          onPress={handleDeleteAccount}
        >
          <Text style={styles.buttonText}>Delete Account</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Shield size={80} color="#4F46E5" />
        <Text style={styles.title}>KrypKey</Text>
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
          style={[styles.button, styles.secondaryButton]}
          onPress={() => router.push('/restore')}
        >
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>
            Restore Existing Wallet
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1b1e',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 10,
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
  },
  primaryButton: {
    backgroundColor: '#4F46E5',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#4F46E5',
  },
  biometricButton: {
    marginTop: 10,
  },
  deleteButton: {
    marginTop: 20,
    backgroundColor: '#991b1b',
  },
  linkButton: {
    marginTop: 20,
    backgroundColor: 'transparent',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButtonText: {
    color: '#4F46E5',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#4F46E5',
  },
  input: {
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 8,
    marginBottom: 15,
    color: '#fff',
    backgroundColor: '#27272a',
  },
  sessionInputContainer: {
    width: '100%',
    marginTop: 10,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
});