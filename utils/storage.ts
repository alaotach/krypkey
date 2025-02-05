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

  static async set(key: StorageKey, value: string): Promise<void> {
    try {
      // Remove @ symbol from keys for SecureStore compatibility
      const safeKey = STORAGE_KEYS[key].replace('@', '');
      
      if (await isSecureStoreAvailable()) {
        await SecureStore.setItemAsync(safeKey, value);
      } else {
        const encryptedValue = await this.encrypt(value);
        await AsyncStorage.setItem(safeKey, encryptedValue);
      }
    } catch (error) {
      console.error(`Error storing ${key}:`, error);
      throw new Error(`Storage error: ${error.message}`);
    }
  }

  static async get(key: StorageKey): Promise<string | null> {
    try {
      const safeKey = STORAGE_KEYS[key].replace('@', '');
      
      if (await isSecureStoreAvailable()) {
        return await SecureStore.getItemAsync(safeKey);
      } else {
        const encryptedValue = await AsyncStorage.getItem(safeKey);
        if (!encryptedValue) return null;
        return await this.decrypt(encryptedValue);
      }
    } catch (error) {
      console.error(`Error retrieving ${key}:`, error);
      throw new Error(`Retrieval error: ${error.message}`);
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
      const keys = Object.values(STORAGE_KEYS);
      if (await isSecureStoreAvailable()) {
        await Promise.all(keys.map(key => SecureStore.deleteItemAsync(key)));
      } else {
        await AsyncStorage.multiRemove(keys);
      }
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw new Error(`Clear error: ${error.message}`);
    }
  }
}