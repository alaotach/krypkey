import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import CryptoJS from 'react-native-crypto-js';
import { STORAGE_KEYS, StorageKey } from '../constants/Storage';

const ENCRYPTION_KEY = 'haha'; // Move to .env in production

const isSecureStoreAvailable = async (): Promise<boolean> => {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
};

export class SecureStorage {
  private static async encrypt(value: string): Promise<string> {
    return CryptoJS.AES.encrypt(value, ENCRYPTION_KEY).toString();
  }

  private static async decrypt(value: string): Promise<string> {
    const bytes = CryptoJS.AES.decrypt(value, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  static async set(key: StorageKey | string, value: string): Promise<void> {
    try {
      // Handle keys directly (string literals)
      let storageKey = typeof key === 'string' ? 
        // If passed as string literal, look up in STORAGE_KEYS
        STORAGE_KEYS[key as StorageKey] || key : 
        // If passed as StorageKey enum value, get the actual storage key
        STORAGE_KEYS[key];
      
      if (!storageKey) {
        console.warn(`Storage key not found: ${key}, using as direct key`);
        storageKey = key.toString();
      }
      
      const safeKey = storageKey.replace('@', '');
      
      if (await isSecureStoreAvailable()) {
        await SecureStore.setItemAsync(safeKey, value);
      } else {
        const encryptedValue = await this.encrypt(value);
        await AsyncStorage.setItem(safeKey, encryptedValue);
      }
    } catch (error) {
      console.error(`Error storing ${key}:`, error);
      // Don't throw, just log the error
    }
  }

  static async get(key: StorageKey | string): Promise<string | null> {
    try {
      // Handle keys directly (string literals)
      let storageKey = typeof key === 'string' ? 
        // If passed as string literal (e.g., 'DURESS_ENABLED'), look up in STORAGE_KEYS
        STORAGE_KEYS[key as StorageKey] || key : 
        // If passed as StorageKey enum value, get the actual storage key
        STORAGE_KEYS[key];
      
      if (!storageKey) {
        console.warn(`Storage key not found: ${key}, using as direct key`);
        storageKey = key.toString();
      }
      
      const safeKey = storageKey.replace('@', '');
      
      if (await isSecureStoreAvailable()) {
        return await SecureStore.getItemAsync(safeKey);
      } else {
        const encryptedValue = await AsyncStorage.getItem(safeKey);
        if (!encryptedValue) return null;
        return await this.decrypt(encryptedValue);
      }
    } catch (error) {
      console.error(`Error retrieving ${key}:`, error);
      return null; // Return null instead of throwing to avoid crashing
    }
  }

  static async remove(key: StorageKey): Promise<void> {
    try {
      if (await isSecureStoreAvailable()) {
        await SecureStore.deleteItemAsync(STORAGE_KEYS[key]);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS[key]);
      }
    } catch (error) {
      console.error(`Error removing ${key}:`, error);
      throw new Error(`Removal error: ${error.message}`);
    }
  }

  static async clear(): Promise<void> {
    try {
      const keys = Object.values(STORAGE_KEYS).map(key => key.replace('@', ''));
      if (await isSecureStoreAvailable()) {
        await Promise.all(keys.map(key => SecureStore.deleteItemAsync(key)));
      } else {
        await AsyncStorage.multiRemove(keys);
      }

      // Set default values after clearing storage
      await SecureStorage.set('WALLET_CREATED', 'false');
      await SecureStorage.set('THEME', 'light');
      await SecureStorage.set('LANGUAGE', 'en');
      await SecureStorage.set('BIOMETRICS_ENABLED', 'false');
      await SecureStorage.set('USERNAME', '');
      await SecureStorage.set('PRIVATE_KEY', '');
      await SecureStorage.set('MNEMONIC', '');
      await SecureStorage.set('PASSWORD', '');
      await SecureStorage.set('IRIS', 'false');
      await SecureStorage.set('FACE', 'false');
      await SecureStorage.set('FINGERPRINT', 'false');
      await SecureStorage.set('DURESS_ENABLED', 'false');
      await SecureStorage.set('DURESS_MODE_ACTIVE', 'false');
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw new Error(`Clear error: ${error.message}`);
    }
  }
}