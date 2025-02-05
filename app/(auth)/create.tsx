import 'react-native-get-random-values';
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { generateMnemonic } from 'bip39';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'react-native-crypto-js';
import { SecureStorage } from '../../utils/storage';

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
  const router = useRouter();

  useEffect(() => {
    generateAndStoreMnemonic();
  }, []);

  const generateAndStoreMnemonic = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Generate mnemonic and salt
      const phrase = generateMnemonic();
      await SecureStorage.set('MNEMONIC', phrase);
      await SecureStorage.set('WALLET_CREATED', 'true');
      setMnemonic(phrase);
    } catch (error) {
      console.error('Error generating mnemonic:', error);
      setError('Failed to generate wallet. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = async () => {
    try {
      router.push({ 
        pathname: '/verify',
        params: { mnemonic }
      });
    } catch (error) {
      console.error('Navigation error:', error);
      setError('Failed to proceed. Please try again.');
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

      <View style={styles.warningContainer}>
        <Text style={styles.warningText}>
          Never share your recovery phrase with anyone!
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
    marginBottom: 20,
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