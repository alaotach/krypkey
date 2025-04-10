import 'react-native-get-random-values';
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { generateMnemonic } from 'bip39';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import CryptoJS from 'react-native-crypto-js';
import { SecureStorage } from '../../utils/storage';
import { Wallet } from 'ethers';
import { Eye, EyeOff, Copy } from 'lucide-react-native';
import axios from 'axios';

// Initialize Buffer
if (typeof global.Buffer === 'undefined') {
  global.Buffer = require('buffer').Buffer;
}

// Storage keys
const STORAGE_KEYS = {
  MNEMONIC: '@secure_storage_mnemonic',
  SALT: '@secure_storage_salt'
};

// Helper function to encrypt data
const encryptData = (data: string, salt: string): string => {
  return CryptoJS.AES.encrypt(data, salt).toString();
};

// Helper function to generate random salt
const generateSalt = (): string => {
  return CryptoJS.lib.WordArray.random(128 / 8).toString();
};

export default function CreateWallet() {
  const [mnemonic, setMnemonic] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [privateKey, setPrivateKey] = useState('');
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const router = useRouter();

  const handleCopyPrivateKey = async () => {
    try {
      await Clipboard.setStringAsync(privateKey);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  useEffect(() => {
    generateAndStoreMnemonic();
  }, []);

  const generateAndStoreMnemonic = async () => {
    try {
      setIsLoading(true);
      setError(null);
      

      // Generate mnemonic and salt
      const phrase = generateMnemonic();
      const wallet = Wallet.fromPhrase(phrase);
      await SecureStorage.set('MNEMONIC', phrase);
      await SecureStorage.set('PRIVATE_KEY', wallet.privateKey);
      await SecureStorage.set('WALLET_CREATED', 'true');
      setMnemonic(phrase);
      setPrivateKey(wallet.privateKey);
    } catch (error) {
      console.error('Error generating mnemonic:', error);
      setError('Failed to generate wallet. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = async () => {
    Alert.alert(
      'Save Private Key',
      'Do you want us to save your private key?',
      [
        {
          text: 'No',
          onPress: async () => {
            await saveUserData(null, null);
          },
          style: 'cancel',
        },
        {
          text: 'Yes',
          onPress: async () => {
            await saveUserData(privateKey, mnemonic);
          },
        },
      ],
      { cancelable: false }
    );
  };

  const saveUserData = async (key: string | null, mnemonic: string | null) => {
    try {
      setIsLoading(true);
      router.replace({
        pathname: '/verify',
        params: { mnemonic: mnemonic, privateKey: key },
      });
    } catch (error) {
      console.error('Error saving user data:', error);
      setError('Failed to save user data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Generating your secure wallet...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.button} onPress={generateAndStoreMnemonic}>
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const words = mnemonic.split(' ');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Recovery Phrase</Text>
      <Text style={styles.description}>
        Write down these 12 words in order and keep them safe. This phrase is the only way to recover your wallet.
      </Text>

      <ScrollView style={styles.mnemonicContainer}>
        <View style={styles.wordsGrid}>
          {words.map((word, index) => (
            <View key={index} style={styles.wordContainer}>
              <Text style={styles.wordNumber}>{index + 1}.</Text>
              <Text style={styles.word}>{word}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.privateKeyContainer}>
        <Text style={styles.subtitle}>Private Key</Text>
        <View style={styles.privateKeyActions}>
          <TouchableOpacity 
            style={styles.copyButton}
            onPress={handleCopyPrivateKey}
          >
            <Copy size={20} color={copySuccess ? "#4ade80" : "#6b7280"} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.visibilityToggle}
            onPress={() => setShowPrivateKey(!showPrivateKey)}
          >
            {showPrivateKey ? (
              <EyeOff size={20} color="#6b7280" />
            ) : (
              <Eye size={20} color="#6b7280" />
            )}
          </TouchableOpacity>
        </View>
        
        <View style={styles.privateKeyBox}>
          <Text style={styles.privateKeyText}>
            {showPrivateKey ? privateKey : '••••••••••••••••'}
          </Text>
        </View>
      </View>

      <View style={styles.warningContainer}>
        <Text style={styles.warningText}>
          Never share your recovery phrase or private key with anyone!
        </Text>
      </View>

      <TouchableOpacity 
        style={styles.button}
        onPress={handleContinue}
      >
        <Text style={styles.buttonText}>I've Written It Down</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  privateKeyContainer: {
    position: 'relative',
    marginVertical: 20,
  },
  privateKeyActions: {
    position: 'absolute',
    right: 12,
    top: 8,
    flexDirection: 'column',
    gap: 10,
    zIndex: 1,
    // backgroundColor: '#27272a',
    borderRadius: 8,
    padding: 4,
  },
  copyButton: {
    padding: 4,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  privateKeyBox: {
    backgroundColor: '#27272a',
    padding: 12,
    paddingRight: 48, // Make space for icons
    borderRadius: 8,
    marginTop: 8,
  },
  privateKeyText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'monospace',
  },
  visibilityToggle: {
    padding: 4,
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
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#1a1b1e',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  description: {
    fontSize: 16,
    color: '#9ca3af',
    marginBottom: 30,
  },
  mnemonicContainer: {
    flex: 1,
    marginBottom: 15,
  },
  wordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  wordContainer: {
    width: '48%',
    flexDirection: 'row',
    backgroundColor: '#27272a',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  wordNumber: {
    color: '#6b7280',
    marginRight: 8,
    fontSize: 14,
  },
  word: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  warningContainer: {
    backgroundColor: '#991b1b',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  warningText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#4F46E5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});