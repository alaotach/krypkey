import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { SecureStorage } from '../../utils/storage';
import { Alert } from 'react-native';

export default function ScanScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    getCameraPermissions();
  }, []);

  const handleBarcodeScanned = async ({ data }: { type: string; data: string }) => {
    try {
      setScanned(true);
      setIsLoading(true);
  
      // Decode QR data
      const qrData = JSON.parse(atob(data));
      if (qrData.type !== 'extension_auth') {
        throw new Error('Invalid QR code');
      }
  
      // Get user data including privateKey
      const username = await SecureStorage.get('USERNAME');
      const deviceInfo = await SecureStorage.get('DEVICE_NAME');
      const authToken = await SecureStorage.get('AUTH_TOKEN');
      const privateKey = await SecureStorage.get('PRIVATE_KEY');
  
      console.log('Retrieved from storage - username:', username);
      console.log('Retrieved from storage - privateKey:', privateKey ? 'exists' : 'missing');
    
      if (!authToken) {
        router.push('/(auth)/create');
        return;
      }
    
      if (!privateKey) {
        Alert.alert('Error', 'Private key not found');
        return;
      }
    
      // Send the session ID, username, device name, and private key to authenticate
      const authResponse = await axios.post(
        'http://192.168.179.248:5000/api/sessions/authenticate',
        {
          sessionId: qrData.sessionId,
          username,
          privateKey, // This is the critical part - ensure privateKey is included
          deviceName: deviceInfo || 'Mobile Device'
        },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
    
      if (authResponse.data.token) {
        await SecureStorage.set('AUTH_TOKEN', authResponse.data.token);
        
        // Check for pending passwords that need to be synced
        setSyncing(true);
        await syncPendingPasswords(qrData.sessionId, authResponse.data.token, privateKey, username);
        setSyncing(false);
        
        Alert.alert('Success', 'Authentication successful');
        router.push('/(tabs)/passwords');
      } else {
        throw new Error('No token received');
      }
    } catch (error: any) {
      console.error('QR scan error:', error);
      
      if (error.response?.status === 404) {
        Alert.alert('Error', 'Session not found or expired. Please try again.');
      } else if (error.response?.status === 401 || error.response?.status === 403) {
        await SecureStorage.remove('AUTH_TOKEN');
        Alert.alert('Session Expired', 'Please login again');
        router.replace('/(auth)/create');
      } else {
        Alert.alert('Error', 'Failed to authenticate. Please try again.');
      }
    } finally {
      setIsLoading(false);
      setScanned(false);
    }
  };
  
  // Update the syncPendingPasswords function to handle encryption properly

const syncPendingPasswords = async (sessionId: string, token: string, privateKey: string, username: string) => {
  try {
    // Fetch pending passwords for this session
    const pendingResponse = await axios.get(
      'http://192.168.179.248:5000/api/sessions/pending-passwords',
      {
        params: { sessionId, username },
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const pendingPasswords = pendingResponse.data.pendingPasswords;
    
    if (!pendingPasswords || pendingPasswords.length === 0) {
      // No pending passwords to sync
      return;
    }
    
    console.log(`Found ${pendingPasswords.length} pending passwords to sync`);
    
    // For each pending password
    const passwordIds = [];
    for (const pendingPassword of pendingPasswords) {
      try {
        // Try to decrypt if it's encrypted with session token
        let password = pendingPassword.password;
        try {
          if (password.includes(',')) {
            // This looks like XOR encryption from the extension
            const dataArray = password.split(',').map(Number);
            const keyData = Array.from(new TextEncoder().encode(token));
            const decrypted = new Uint8Array(dataArray.length);
            
            for (let i = 0; i < dataArray.length; i++) {
              decrypted[i] = dataArray[i] ^ keyData[i % keyData.length];
            }
            
            password = new TextDecoder().decode(decrypted);
          }
        } catch (error) {
          console.log('Not encrypted with XOR or decryption failed');
        }
        
        // Try to decrypt with AES if XOR fails and it has a colon
        try {
          if (password.includes(':')) {
            // This looks like AES encryption with IV from the server
            const [ivHex, encrypted] = password.split(':');
            const iv = Buffer.from(ivHex, 'hex');
            // Use CryptoJS to handle the decryption
            // You'll need to implement this based on your server-side encryption
          }
        } catch (error) {
          console.log('Not encrypted with AES or decryption failed');
        }
        
        // Add the password to the user's account
        await axios.post(
          'http://192.168.179.248:5000/api/users/add-password',
          {
            username,
            title: pendingPassword.title,
            password,
            privateKey
          },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        passwordIds.push(pendingPassword._id);
      } catch (err) {
        console.error('Error syncing password:', err);
      }
    }
    
    // Mark the passwords as saved
    if (passwordIds.length > 0) {
      await axios.post(
        'http://192.168.179.248:5000/api/sessions/mark-saved',
        {
          sessionId,
          passwordIds
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
    }
    
    Alert.alert('Sync Complete', `Successfully synced ${passwordIds.length} password(s)`);
  } catch (error) {
    console.error('Error syncing pending passwords:', error);
    Alert.alert('Sync Error', 'Some passwords may not have been synced successfully');
  }
};

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>No access to camera</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.text}>
            {syncing ? 'Syncing passwords...' : 'Authenticating...'}
          </Text>
        </View>
      ) : (
        <>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
          />
          <View style={styles.overlay}>
            <Text style={styles.scanText}>
              Scan QR code from extension
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1b1e',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  scanText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 16,
    borderRadius: 8,
  }
});