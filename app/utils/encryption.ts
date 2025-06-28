import CryptoJS from 'crypto-js';

export const EncryptionService = {
  /**
   * Encrypts data using the user's private key
   * @param data - The data to encrypt
   * @param privateKey - The private key for encryption
   * @returns The encrypted data as a string
   */
  encryptWithPrivateKey: (data: string, privateKey: string): string => {
    try {
      // Create a predictable IV from the private key
      const ivWords = CryptoJS.SHA256(privateKey).words.slice(0, 4);
      const iv = CryptoJS.lib.WordArray.create(ivWords);
      
      // Create encryption key from private key
      const key = CryptoJS.SHA256(privateKey);
      
      // Encrypt using AES-CBC mode
      const encrypted = CryptoJS.AES.encrypt(data, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });
      
      // Return as IV:encryptedData format (same as server)
      return iv.toString() + ':' + encrypted.toString();
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data with private key');
    }
  },

  /**
   * Decrypts data using the user's private key
   * @param encryptedData - The encrypted data
   * @param privateKey - The private key for decryption
   * @returns The decrypted data
   */
  decryptWithPrivateKey: (encryptedData: string, privateKey: string): string => {
    try {
      const [ivHex, encrypted] = encryptedData.split(':');
      if (!ivHex || !encrypted) {
        throw new Error('Invalid encrypted data format');
      }
      
      // Create IV from the hex string
      const iv = CryptoJS.enc.Hex.parse(ivHex);
      
      // Create decryption key from private key
      const key = CryptoJS.SHA256(privateKey);
      
      // Decrypt using AES-CBC mode
      const decrypted = CryptoJS.AES.decrypt(encrypted, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });
      
      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data with private key');
    }
  },

  /**
   * Encrypts data with session token using XOR encryption
   * @param data - The data to encrypt
   * @param token - The session token
   * @returns The encrypted data as comma-separated numbers
   */
  encryptWithSessionToken: (data: string, token: string): string => {
    try {
      // Simple XOR encryption (matches the browser extension implementation)
      const dataArray = Array.from(new TextEncoder().encode(data));
      const keyData = Array.from(new TextEncoder().encode(token));
      const encrypted = new Uint8Array(dataArray.length);
      
      for (let i = 0; i < dataArray.length; i++) {
        encrypted[i] = dataArray[i] ^ keyData[i % keyData.length];
      }
      
      return Array.from(encrypted).join(',');
    } catch (error) {
      console.error('Session encryption error:', error);
      throw new Error('Failed to encrypt data with session token');
    }
  },

  /**
   * Decrypts data encrypted with session token
   * @param encryptedData - The encrypted data as comma-separated numbers
   * @param token - The session token
   * @returns The decrypted data
   */
  decryptWithSessionToken: (encryptedData: string, token: string): string => {
    try {
      if (!encryptedData.includes(',')) {
        throw new Error('Invalid encrypted data format');
      }
      
      const dataArray = encryptedData.split(',').map(Number);
      const keyData = Array.from(new TextEncoder().encode(token));
      const decrypted = new Uint8Array(dataArray.length);
      
      for (let i = 0; i < dataArray.length; i++) {
        decrypted[i] = dataArray[i] ^ keyData[i % keyData.length];
      }
      
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('Session token decryption error:', error);
      throw new Error('Failed to decrypt with session token');
    }
  },
  
  /**
   * Creates a hash of a string for password verification
   * @param str - The string to hash
   * @returns The SHA-256 hash of the string
   */
  hashString: (str: string): string => {
    try {
      return CryptoJS.SHA256(str).toString();
    } catch (error) {
      console.error('Hashing error:', error);
      throw new Error('Failed to hash string');
    }
  }
};