import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SecureStorage } from '../../utils/storage';

interface RouteParams {
  mnemonic: string;
}

export default function VerifyMnemonic() {
  const { mnemonic } = useLocalSearchParams<RouteParams>();
  const router = useRouter();
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [shuffledWords, setShuffledWords] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationIndexes] = useState<number[]>([2, 5, 8, 11]);

  useEffect(() => {
    if (!mnemonic) {
      setError('No mnemonic provided');
      return;
    }
    const words = mnemonic.split(' ');
    setShuffledWords([...words].sort(() => Math.random() - 0.5));
  }, [mnemonic]);

  const handleWordSelect = (word: string): void => {
    if (selectedWords.includes(word)) {
      setSelectedWords(selectedWords.filter(w => w !== word));
    } else if (selectedWords.length < verificationIndexes.length) {
      setSelectedWords([...selectedWords, word]);
    }
    setError(null);
  };

  const verifyWords = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      if (!mnemonic) {
        setError('Invalid mnemonic');
        return;
      }

      const originalWords = mnemonic.split(' ');
      const isCorrect = verificationIndexes.every((index, i) => 
        originalWords[index] === selectedWords[i]
      );
      
      if (isCorrect) {
        await SecureStorage.set('MNEMONIC', mnemonic);
        await SecureStorage.set('WALLET_CREATED', 'true');
        router.replace('/(tabs)');
      } else {
        setSelectedWords([]);
        setError('Incorrect words selected. Please try again.');
      }
    } catch (error) {
      console.error('Verification error:', error);
      setError('Failed to verify phrase. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Verifying...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify Your Recovery Phrase</Text>
      <Text style={styles.description}>
        Select the words in the correct order for positions: {verificationIndexes.map(i => i + 1).join(', ')}
      </Text>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.selectedWordsContainer}>
        {verificationIndexes.map((_, index) => (
          <View key={index} style={styles.wordSlot}>
            <Text style={styles.wordSlotText}>
              {selectedWords[index] || `Word ${verificationIndexes[index] + 1}`}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.wordsGrid}>
        {shuffledWords.map((word, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.wordButton,
              selectedWords.includes(word) && styles.selectedWord,
            ]}
            onPress={() => handleWordSelect(word)}
            disabled={isLoading}
          >
            <Text style={styles.wordButtonText}>{word}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity 
        style={[
          styles.verifyButton,
          selectedWords.length !== verificationIndexes.length && styles.disabledButton,
        ]}
        onPress={verifyWords}
        disabled={selectedWords.length !== verificationIndexes.length || isLoading}
      >
        <Text style={styles.verifyButtonText}>Verify</Text>
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
  selectedWordsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 30,
  },
  wordSlot: {
    flex: 1,
    minWidth: '48%',
    padding: 12,
    backgroundColor: '#27272a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4F46E5',
  },
  wordSlotText: {
    color: '#9ca3af',
    textAlign: 'center',
  },
  wordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 30,
  },
  wordButton: {
    padding: 12,
    backgroundColor: '#27272a',
    borderRadius: 8,
    minWidth: '30%',
  },
  selectedWord: {
    backgroundColor: '#4F46E5',
  },
  wordButtonText: {
    color: '#fff',
    textAlign: 'center',
  },
  verifyButton: {
    backgroundColor: '#4F46E5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});