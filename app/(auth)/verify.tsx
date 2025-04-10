import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, TextInput, Modal, Button, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SecureStorage } from '../../utils/storage';
import axios from 'axios';

interface RouteParams {
  mnemonic: string;
  privateKey: string | null;
}

export default function VerifyMnemonic() {
  const { mnemonic, privateKey } = useLocalSearchParams<RouteParams>();
  const router = useRouter();
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [shuffledWords, setShuffledWords] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationIndexes] = useState<number[]>([2, 5, 8, 11]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    const setupMnemonic = async () => {
      try {
        let mnemonicToUse = mnemonic;
        
        // If no mnemonic is passed as a param (user chose not to save it),
        // retrieve it from secure storage
        if (!mnemonicToUse) {
          mnemonicToUse = await SecureStorage.get('MNEMONIC');
          if (!mnemonicToUse) {
            setError('No mnemonic found. Please go back and try again.');
            return;
          }
        }
        
        const words = mnemonicToUse.split(' ');
        setShuffledWords([...words].sort(() => Math.random() - 0.5));
      } catch (error) {
        console.error('Error setting up verification:', error);
        setError('Failed to setup verification. Please try again.');
      }
    };
    
    setupMnemonic();
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
      
      let mnemonicToVerify = mnemonic;
      
      if (!mnemonicToVerify) {
        mnemonicToVerify = await SecureStorage.get('MNEMONIC');
        if (!mnemonicToVerify) {
          setError('Could not retrieve mnemonic for verification.');
          return;
        }
      }
  
      const originalWords = mnemonicToVerify.split(' ');
      const isCorrect = verificationIndexes.every((index, i) => 
        originalWords[index] === selectedWords[i]
      );
      
      if (isCorrect) {
        await SecureStorage.set('WALLET_CREATED', 'true');
        setIsModalVisible(true);
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

  const checkUsernameAvailability = async () => {
    try {
      const response = await axios.post('http://192.168.179.248:5000/api/users/check-username', { username });
      if (response.data.message === 'Username available') {
        return true;
      } else {
        setModalError('Username already taken. Please choose a different username.');
        return false;
      }
    } catch (error) {
      console.error('Error checking username:', error);
      setModalError('Failed to check username. Please try again.');
      return false;
    }
  };

  const saveUserData = async () => {
    try {
      if (password !== confirmPassword) {
        setModalError('Passwords do not match. Please try again.');
        return;
      }
  
      if (!(await checkUsernameAvailability())) {
        return;
      }
  
      setIsLoading(true);
      
      // Get mnemonic from params or storage if necessary
      let mnemonicToUse = mnemonic;
      if (!mnemonicToUse) {
        mnemonicToUse = await SecureStorage.get('MNEMONIC');
      }
      
      // Get private key from params or storage if necessary
      let privateKeyToUse = privateKey;
      if (!privateKeyToUse) {
        privateKeyToUse = await SecureStorage.get('PRIVATE_KEY');
      }
      
      // Create user first
      await axios.post('http://192.168.179.248:5000/api/users/create', {
        username,
        password,
        mnemonic: mnemonicToUse,
        privateKey: privateKeyToUse,
      });
  
      // Then login to get token
      const loginResponse = await axios.post('http://192.168.179.248:5000/api/users/login', {
        username,
        password,
        private_key: privateKeyToUse
      });
  
      if (loginResponse.data.token) {
        await SecureStorage.set('AUTH_TOKEN', loginResponse.data.token);
        await SecureStorage.set('USERNAME', username);
        await SecureStorage.set('PASSWORD', password);
        await SecureStorage.set('WALLET_CREATED', 'true');
        router.replace('/(tabs)/passwords');
      } else {
        throw new Error('No auth token received');
      }
  
    } catch (error: any) {
      console.error('Error saving user data:', error.response?.data || error);
      setModalError(error.response?.data?.message || 'Failed to save user data. Please try again.');
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

      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter Username and Password</Text>
            {modalError && <Text style={styles.modalErrorText}>{modalError}</Text>}
            <TextInput
              style={styles.input}
              placeholder="Username"
              value={username}
              onChangeText={setUsername}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
            <View style={styles.modalButtons}>
              <Button title="Cancel" onPress={() => setIsModalVisible(false)} />
              <Button title="OK" onPress={saveUserData} />
            </View>
          </View>
        </View>
      </Modal>
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
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  modalErrorText: {
    color: '#ef4444',
    fontSize: 14,
    marginBottom: 10,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    padding: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
});