import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Switch, Alert, Platform } from 'react-native';
import { SecureStorage } from '../../utils/storage';
import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { Shield } from 'lucide-react-native';
import axios from 'axios';
import KrypKeyAutofillService from '../../utils/KrypKeyAutofillService';
import { ScrollView } from 'react-native';
import Haptics from 'expo-haptics';


export default function SettingsTab() {
  const router = useRouter();
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [isFingerprintSupported, setIsFingerprintSupported] = useState(false);
  const [isFaceSupported, setIsFaceSupported] = useState(false);
  const [isIrisSupported, setIsIrisSupported] = useState(false);
  const [isFingerprintEnabled, setIsFingerprintEnabled] = useState(false);
  const [isFaceEnabled, setIsFaceEnabled] = useState(false);
  const [isIrisEnabled, setIsIrisEnabled] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [duressEnabled, setDuressEnabled] = useState(false);
  const [duressButtonPressCount, setDuressButtonPressCount] = useState(0);
  const [lastDuressPress, setLastDuressPress] = useState(0);
  const [isAutofillSupported, setIsAutofillSupported] = useState(false);
  const [isAutofillEnabled, setIsAutofillEnabled] = useState(false);
  const loadSessions = async () => {
    try {
      const username = await SecureStorage.get('USERNAME');
      const response = await axios.get('http://192.168.73.248:5000/api/sessions/list', {
        params: { username }
      });
      setSessions(response.data);
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };
  
  interface Session {
    id: string;
    deviceName: string;
    createdAt: string;
  };
  // Add to useEffect
  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      checkBiometricSupport();
      loadBiometricSettings();
      const duressEnabled = await SecureStorage.get('DURESS_ENABLED');
      setDuressEnabled(duressEnabled === 'true');
      checkAutofillSupport();
    };
    loadSettings();
  }, []);
  const checkAutofillSupport = async () => {
    // Only Android 8.0 (API level 26) and higher supports Autofill
    const isSupported = Platform.OS === 'android' && Platform.Version >= 26;
    setIsAutofillSupported(isSupported);

    if (isSupported) {
      const enabled = await KrypKeyAutofillService.isAutofillEnabled();
      setIsAutofillEnabled(enabled);
    }
  };

  const handleToggleAutofill = async (value: boolean) => {
    try {
      if (value) {
        const success = await KrypKeyAutofillService.enableAutofill();
        if (success) {
          setIsAutofillEnabled(true);
          Alert.alert(
            'Autofill Enabled', 
            'KrypKey is now set as your autofill service. You can now autofill passwords in other apps.'
          );
        }
      } else {
        // To disable, we just update our preference
        await SecureStorage.set('AUTOFILL_ENABLED', 'false');
        setIsAutofillEnabled(false);
        Alert.alert(
          'Autofill Disabled',
          'To completely disable autofill, go to Android Settings > System > Languages & input > Advanced > Autofill service and select "None".'
        );
      }
    } catch (error) {
      console.error('Error toggling autofill:', error);
      Alert.alert('Error', 'Failed to update autofill settings.');
    }
  };

  const checkBiometricSupport = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
    setIsBiometricSupported(compatible && supportedTypes.length > 0);
    setIsFingerprintSupported(supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT));
    setIsFaceSupported(supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION));
    setIsIrisSupported(supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS));
  };

  const loadBiometricSettings = async () => {
    const fingerprint = await SecureStorage.get('FINGERPRINT');
    const face = await SecureStorage.get('FACE');
    const iris = await SecureStorage.get('IRIS');
    setIsFingerprintEnabled(fingerprint === 'true');
    setIsFaceEnabled(face === 'true');
    setIsIrisEnabled(iris === 'true');
  };

  // Add this function to your SettingsTab component
const handleRemoveSession = async (sessionId: string) => {
  try {
    const authToken = await SecureStorage.get('AUTH_TOKEN');
    
    if (!authToken) {
      Alert.alert('Authentication Error', 'You need to be logged in to remove sessions.');
      return;
    }
    
    // Show confirmation dialog
    Alert.alert(
      'Remove Session',
      'Are you sure you want to remove this session?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            // Send request to remove the session
            const response = await axios.post(
              'http://192.168.73.248:5000/api/sessions/delete',
              { sessionId },
              {
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                  'Content-Type': 'application/json'
                }
              }
            );
            
            if (response.status === 200) {
              // Update the sessions list by removing the deleted session
              setSessions(prevSessions => 
                prevSessions.filter(session => session.id !== sessionId)
              );
              
              Alert.alert('Success', 'Session removed successfully');
            }
          }
        }
      ]
    );
  } catch (error) {
    console.error('Error removing session:', error);
    Alert.alert('Error', 'Failed to remove session. Please try again.');
  }
};

  const handleToggleFingerprint = async (value: boolean) => {
    if (value) {
      const hasEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasEnrolled) {
        Alert.alert('Biometric Setup', 'No fingerprints are enrolled. Please enroll a fingerprint in your device settings first.');
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to enable fingerprint',
        fallbackLabel: 'Use Passcode',
      });

      if (result.success) {
        await SecureStorage.set('FINGERPRINT', 'true');
        setIsFingerprintEnabled(true);
        Alert.alert('Biometric Setup', 'Fingerprint authentication has been enabled.');
      } else {
        Alert.alert('Biometric Setup', 'Fingerprint authentication setup failed. Please try again.');
      }
    } else {
      await SecureStorage.set('FINGERPRINT', 'false');
      setIsFingerprintEnabled(false);
      Alert.alert('Biometric Setup', 'Fingerprint authentication has been disabled.');
    }
  };

  const handleToggleFace = async (value: boolean) => {
    if (value) {
      const hasEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasEnrolled) {
        Alert.alert('Biometric Setup', 'No face data is enrolled. Please enroll face data in your device settings first.');
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to enable face recognition',
        fallbackLabel: 'Use Passcode',
      });

      if (result.success) {
        await SecureStorage.set('FACE', 'true');
        setIsFaceEnabled(true);
        Alert.alert('Biometric Setup', 'Face recognition has been enabled.');
      } else {
        Alert.alert('Biometric Setup', 'Face recognition setup failed. Please try again.');
      }
    } else {
      await SecureStorage.set('FACE', 'false');
      setIsFaceEnabled(false);
      Alert.alert('Biometric Setup', 'Face recognition has been disabled.');
    }
  };

  const handleToggleIris = async (value: boolean) => {
    if (value) {
      const hasEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasEnrolled) {
        Alert.alert('Biometric Setup', 'No iris data is enrolled. Please enroll iris data in your device settings first.');
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to enable iris recognition',
        fallbackLabel: 'Use Passcode',
      });

      if (result.success) {
        await SecureStorage.set('IRIS', 'true');
        setIsIrisEnabled(true);
        Alert.alert('Biometric Setup', 'Iris recognition has been enabled.');
      } else {
        Alert.alert('Biometric Setup', 'Iris recognition setup failed. Please try again.');
      }
    } else {
      await SecureStorage.set('IRIS', 'false');
      setIsIrisEnabled(false);
      Alert.alert('Biometric Setup', 'Iris recognition has been disabled.');
    }
  };

  const handleLogout = async () => {
    try {
      await SecureStorage.set('WALLET_CREATED', 'false');
      console.error('Logged out');
      await SecureStorage.clear();
      await SecureStorage.set('WALLET_CREATED', 'false');
      // await Updates.reloadAsync();
      router.replace('/');
    } catch (error) {
      console.error('Error logging out:', error);
      Alert.alert('Error', 'Failed to log out. Please try again.');
    }
  };

  const handleSecurityTitlePress = () => {
    const now = Date.now();
    
    // Reset counter if it's been more than 2 seconds since last press
    if (now - lastDuressPress > 2000) {
      setDuressButtonPressCount(1);
    } else {
      setDuressButtonPressCount(prev => prev + 1);
    }
    
    setLastDuressPress(now);
    
    // After 5 quick taps on "Security", show duress toggle
    if (duressButtonPressCount === 4) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Add modal or section with duress mode toggle
      Alert.alert(
        'Advanced Security',
        'Enable duress mode for protection against forced access?',
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Configure',
            onPress: () => {
              Alert.alert(
                'Duress Mode',
                'When enabled, pressing both volume buttons for 5 seconds will switch to fake data mode. This protects your real passwords if someone forces you to open the app.',
                [
                  {
                    text: 'Cancel',
                    style: 'cancel'
                  },
                  {
                    text: 'Enable',
                    onPress: async () => {
                      await SecureStorage.set('DURESS_ENABLED', 'true');
                      setDuressEnabled(true);
                      Alert.alert(
                        'Duress Mode Enabled',
                        'To activate in an emergency, press and hold both volume buttons for 5 seconds.'
                      );
                    }
                  }
                ]
              );
            }
          }
        ]
      );
    }
  };

  const handleToggleDuressMode = async (value: boolean) => {
    try {
      await SecureStorage.set('DURESS_ENABLED', value ? 'true' : 'false');
      setDuressEnabled(value);
      
      if (value) {
        Alert.alert(
          'Duress Mode Enabled',
          'To activate in an emergency, press and hold both volume buttons for 5 seconds.'
        );
      } else {
        Alert.alert('Duress Mode Disabled');
      }
    } catch (error) {
      console.error('Error toggling duress mode:', error);
      Alert.alert('Error', 'Failed to update duress mode setting.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Shield size={40} color="#4F46E5" />
        <Text style={styles.title}>KrypKey</Text>
        <Text style={styles.version}>Version 1.0.0</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <View style={styles.cardItem}>
            <Info size={20} color="#4F46E5" />
            <Text style={styles.cardText}>
              Krypkey is a secure password manager that uses encryption to protect your data.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
      <Text 
        style={styles.sectionTitle} 
        onPress={handleSecurityTitlePress}
      >
        Security
      </Text>
        {isAutofillSupported && (
              <View style={styles.securityOption}>
                <Text style={styles.securityOptionText}>Autofill Service</Text>
                <Switch
                  value={isAutofillEnabled}
                  onValueChange={handleToggleAutofill}
                  trackColor={{ false: '#27272a', true: '#4F46E5' }}
                  thumbColor={isAutofillEnabled ? '#fff' : '#f4f3f4'}
                />
              </View>
            )}

        {isBiometricSupported && (
          <>
            {isFingerprintSupported && (
              <View style={styles.biometricToggle}>
                <Fingerprint size={20} color="#4F46E5" />
                <Text style={styles.biometricText}>Fingerprint Authentication</Text>
                <Switch
                  value={isFingerprintEnabled}
                  onValueChange={handleToggleFingerprint}
                />
              </View>
            )}
            {isFaceSupported && (
              <View style={styles.biometricToggle}>
                <Smile size={20} color="#4F46E5" />
                <Text style={styles.biometricText}>Face Recognition</Text>
                <Switch
                  value={isFaceEnabled}
                  onValueChange={handleToggleFace}
                />
              </View>
            )}
            {isIrisSupported && (
              <View style={styles.biometricToggle}>
                <Eye size={20} color="#4F46E5" />
                <Text style={styles.biometricText}>Iris Recognition</Text>
                <Switch
                  value={isIrisEnabled}
                  onValueChange={handleToggleIris}
                />
              </View>
            )}
            {isAutofillSupported && (
          <Text style={styles.securityNote}>
            Autofill allows KrypKey to fill passwords in other apps automatically.
            {isAutofillEnabled ? '' : ' Enable this option to set KrypKey as your autofill provider.'}
          </Text>
        )}
            
          </>
        )}
        
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Active Sessions</Text>
        {sessions.map(session => (
          <View key={session.id} style={styles.sessionItem}>
            <View style={styles.sessionInfo}>
              <Monitor size={20} color="#4F46E5" />
              <View>
                <Text style={styles.deviceName}>{session.deviceName}</Text>
                <Text style={styles.sessionDate}>
                  {new Date(session.createdAt).toLocaleDateString()}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => handleRemoveSession(session.id)}
              style={styles.removeButton}
            >
              <Text style={styles.removeText}>Remove</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <LogOut size={20} color="#991b1b" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#27272a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  sessionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deviceName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  sessionDate: {
    color: '#6b7280',
    fontSize: 12,
  },
  removeButton: {
    backgroundColor: '#991b1b',
    padding: 8,
    borderRadius: 6,
  },
  removeText: {
    color: '#fff',
    fontSize: 14,
  },
  container: {
    flex: 1,
    backgroundColor: '#1a1b1e',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
  },
  version: {
    color: '#6b7280',
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#27272a',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  cardText: {
    color: '#fff',
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  biometricToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27272a',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 12,
  },
  biometricText: {
    color: '#4F46E5',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27272a',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  logoutText: {
    color: '#991b1b',
    fontSize: 16,
    fontWeight: '600',
  },
  securityToggle: {
    backgroundColor: '#27272a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  securityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 12,
  },
  securityOptionText: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
  },
  securityNote: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
    marginLeft: 8,
    fontStyle: 'italic',
  }
});