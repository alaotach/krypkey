import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { validateMnemonic } from 'bip39';
import { useRouter } from 'expo-router';
import { SecureStorage } from '../../utils/storage';

export default function RestoreWallet(): JSX.Element {
  const [words, setWords] = useState<string[]>(Array(12).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleWordChange = (text: string, index: number): void => {
    const newWords = [...words];
    newWords[index] = text.toLowerCase().trim();
    setWords(newWords);
    setError(null);
  };

  const handleRestore = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const mnemonic = words.join(' ');
      if (!validateMnemonic(mnemonic)) {
        setError('Invalid recovery phrase. Please check your words and try again.');
        return;
      }

      // Store mnemonic securely
      await SecureStorage.set('MNEMONIC', mnemonic);
      await SecureStorage.set('WALLET_CREATED', 'true');
      
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Restore error:', error);
      setError('Failed to restore wallet. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Restoring your wallet...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Restore Your Wallet</Text>
      <Text style={styles.description}>
        Enter your 12-word recovery phrase in the correct order to restore your wallet.
      </Text>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.wordsGrid}>
        {words.map((word, index) => (
          <View key={index} style={styles.wordInputContainer}>
            <Text style={styles.wordNumber}>{index + 1}.</Text>
            <TextInput
              style={styles.wordInput}
              value={word}
              onChangeText={(text: string) => handleWordChange(text, index)}
              placeholder={`Word ${index + 1}`}
              placeholderTextColor="#6b7280"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        ))}
      </View>

      <TouchableOpacity 
        style={[
          styles.button,
          !words.every(word => word.length > 0) && styles.disabledButton,
        ]}
        onPress={handleRestore}
        disabled={!words.every(word => word.length > 0) || isLoading}
      >
        <Text style={styles.buttonText}>Restore Wallet</Text>
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
    fontSize: 14,
    marginBottom: 16,
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
  wordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 30,
  },
  wordInputContainer: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wordNumber: {
    color: '#6b7280',
    fontSize: 14,
  },
  wordInput: {
    flex: 1,
    backgroundColor: '#27272a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#4F46E5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});