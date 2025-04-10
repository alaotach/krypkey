import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { validateMnemonic } from 'bip39';
import { useRouter } from 'expo-router';
import { SecureStorage } from '../../utils/storage';
import { Wallet } from 'ethers';
import axios from 'axios';

export default function RestoreWallet(): JSX.Element {
  const [restoreMethod, setRestoreMethod] = useState<'mnemonic' | 'privateKey'>('mnemonic');
  const [words, setWords] = useState<string[]>(Array(12).fill(''));
  const [privateKey, setPrivateKey] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleWordChange = (text: string, index: number): void => {
    const newWords = [...words];
    newWords[index] = text.toLowerCase().trim();
    setWords(newWords);
    setError(null);
  };

  const checkUsernameAvailability = async (username: string): Promise<boolean> => {
    try {
      const response = await axios.post('http://192.168.73.248:5000/api/users/check-username', { username });
      if (response.data.message === 'Username available') {
        return true;
      } else {
        setError('Username already taken. Please choose a different username.');
        return false;
      }
    } catch (error) {
      console.error('Error checking username:', error);
      setError('Failed to check username. Please try again.');
      return false;
    }
  };

  const handleRestore = async (): Promise<void> => {
    try {
      setError(null);
      
      if ((await checkUsernameAvailability(username))) {
        setError('Username not found.');
        return;
      }
      setIsLoading(true);
  
      // Restore wallet logic
      if (restoreMethod === 'mnemonic') {
        const mnemonic = words.join(' ');
        if (!validateMnemonic(mnemonic)) {
          setError('Invalid recovery phrase. Please check your words and try again.');
          return;
        }
        const wallet = Wallet.fromPhrase(mnemonic);
        await SecureStorage.set('MNEMONIC', mnemonic);
        await SecureStorage.set('PRIVATE_KEY', wallet.privateKey);
      } else {
        try {
          const wallet = new Wallet(privateKey);
          await SecureStorage.set('PRIVATE_KEY', wallet.privateKey);
        } catch (e) {
          setError('Invalid private key format');
          return;
        }
      }
  
      // Login to get auth token
      const private_key = await SecureStorage.get('PRIVATE_KEY');
      const response = await axios.post('http://192.168.73.248:5000/api/users/login', {
        username,
        password,
        private_key
      });
  
      if (response.data.token) {
        await SecureStorage.set('AUTH_TOKEN', response.data.token);
        await SecureStorage.set('USERNAME', username);
        await SecureStorage.set('PASSWORD', password);
        await SecureStorage.set('WALLET_CREATED', 'true');
        router.replace('/(tabs)/passwords');
      } else {
        throw new Error('No auth token received');
      }
  
    } catch (error: any) {
      console.error('Restore error:', error);
      if (error.response?.status === 401) {
        setError('Invalid username or password');
      } else {
        setError('Failed to restore wallet. Please try again.');
      }
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
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <Text style={styles.title}>Restore Your Wallet</Text>
        
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, restoreMethod === 'mnemonic' && styles.activeTab]}
            onPress={() => setRestoreMethod('mnemonic')}
          >
            <Text style={[styles.tabText, restoreMethod === 'mnemonic' && styles.activeTabText]}>
              Recovery Phrase
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, restoreMethod === 'privateKey' && styles.activeTab]}
            onPress={() => setRestoreMethod('privateKey')}
          >
            <Text style={[styles.tabText, restoreMethod === 'privateKey' && styles.activeTabText]}>
              Private Key
            </Text>
          </TouchableOpacity>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        {restoreMethod === 'mnemonic' ? (
          <>
            <Text style={styles.description}>
              Enter your 12-word recovery phrase in the correct order.
            </Text>
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
          </>
        ) : (
          <>
            <Text style={styles.description}>
              Enter your private key to restore your wallet.
            </Text>
            <View style={styles.privateKeyContainer}>
              <TextInput
                style={styles.privateKeyInput}
                value={privateKey}
                onChangeText={setPrivateKey}
                placeholder="Enter your private key"
                placeholderTextColor="#6b7280"
                autoCapitalize="none"
                autoCorrect={false}
                multiline
              />
            </View>
          </>
        )}

        <Text style={styles.description}>
          Enter your username and password.
        </Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="Username"
          placeholderTextColor="#6b7280"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Login Password"
          placeholderTextColor="#6b7280"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />

        <TouchableOpacity 
          style={[
            styles.button,
            ((restoreMethod === 'mnemonic' && !words.every(word => word.length > 0)) ||
             (restoreMethod === 'privateKey' && !privateKey) ||
             !username || !password) && styles.disabledButton,
          ]}
          onPress={handleRestore}
          disabled={
            (restoreMethod === 'mnemonic' && !words.every(word => word.length > 0)) ||
            (restoreMethod === 'privateKey' && !privateKey) ||
            !username || !password ||
            isLoading
          }
        >
          <Text style={styles.buttonText}>Restore Wallet</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#1a1b1e',
    padding: 20,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    backgroundColor: '#27272a',
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#4F46E5',
  },
  tabText: {
    color: '#9ca3af',
    fontSize: 16,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 24,
  },
  description: {
    fontSize: 16,
    color: '#9ca3af',
    marginBottom: 24,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
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
  privateKeyContainer: {
    marginBottom: 30,
  },
  privateKeyInput: {
    backgroundColor: '#27272a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    height: 100,
    textAlignVertical: 'top',
  },
  input: {
    backgroundColor: '#27272a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
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
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
});