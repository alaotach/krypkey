import { Platform } from 'react-native';
import { SecureStorage } from './storage';
import { EncryptionService } from './encryption';

// Types for password entries
interface AutofillCredential {
  id: string;
  title: string;
  domain: string;
  username: string;
  password: string;
  lastUsed?: Date;
}

/**
 * KrypKeyAutofillService - Provides autofill functionality for the KrypKey app
 * 
 * This service manages autofill suggestions and integrates with the OS-level
 * autofill systems when available.
 */
export class KrypKeyAutofillService {
  private static instance: KrypKeyAutofillService;
  private credentials: AutofillCredential[] = [];
  private isInitialized = false;
  
  // Make this a singleton
  private constructor() {}
  
  public static getInstance(): KrypKeyAutofillService {
    if (!KrypKeyAutofillService.instance) {
      KrypKeyAutofillService.instance = new KrypKeyAutofillService();
    }
    return KrypKeyAutofillService.instance;
  }
  
  /**
   * Initialize the autofill service by loading saved credentials
   */
  public async initialize(): Promise<void> {
    try {
      if (this.isInitialized) return;
      
      // Load credentials from secure storage
      const encryptedData = await SecureStorage.get('AUTOFILL_CREDENTIALS');
      if (encryptedData) {
        const privateKey = await SecureStorage.get('PRIVATE_KEY');
        if (privateKey) {
          const decryptedData = await EncryptionService.decrypt(encryptedData, privateKey);
          this.credentials = JSON.parse(decryptedData);
        }
      }
      
      // Register with system autofill service if available
      if (Platform.OS === 'android' && Platform.Version >= 26) {
        this.registerAndroidAutofillService();
      } else if (Platform.OS === 'ios' && parseInt(Platform.Version, 10) >= 12) {
        this.registeriOSAutofillService();
      }
      
      this.isInitialized = true;
      console.log('KrypKey Autofill Service initialized');
    } catch (error) {
      console.error('Failed to initialize autofill service:', error);
      throw error;
    }
  }
  
  /**
   * Save credentials to be used later for autofill
   */
  public async saveCredential(credential: Omit<AutofillCredential, 'id' | 'lastUsed'>): Promise<string> {
    try {
      // Check if similar credential exists
      const similarCredential = this.findSimilarCredential(credential);
      
      if (similarCredential) {
        // Update the existing credential instead of creating a new one
        await this.updateCredential(similarCredential.id, credential);
        return similarCredential.id;
      }
      
      // If no similar credential was found, create a new one
      const newCredential: AutofillCredential = {
        ...credential,
        id: Date.now().toString(),
        lastUsed: new Date()
      };
      
      this.credentials.push(newCredential);
      await this.persistCredentials();
      
      return newCredential.id;
    } catch (error) {
      console.error('Failed to save credential:', error);
      throw error;
    }
  }
  
  /**
   * Find a similar credential based on domain and username
   * @param credential The credential to check for similarities
   * @returns The similar credential if found, otherwise null
   */
  private findSimilarCredential(credential: Omit<AutofillCredential, 'id' | 'lastUsed'>): AutofillCredential | null {
    const normalizedDomain = this.normalizeDomain(credential.domain);
    
    // First try to find a credential with the exact domain and username
    const exactMatch = this.credentials.find(cred => 
      this.normalizeDomain(cred.domain) === normalizedDomain && 
      cred.username.toLowerCase() === credential.username.toLowerCase()
    );
    
    if (exactMatch) {
      return exactMatch;
    }
    
    // If no exact match, look for a credential with a similar domain and the same username
    return this.credentials.find(cred => {
      const credDomain = this.normalizeDomain(cred.domain);
      return (credDomain.includes(normalizedDomain) || 
              normalizedDomain.includes(credDomain)) &&
              cred.username.toLowerCase() === credential.username.toLowerCase();
    }) || null;
  }
  
  /**
   * Update an existing credential with new information
   * @param id The ID of the credential to update
   * @param newData The new data to update the credential with
   */
  public async updateCredential(id: string, newData: Partial<Omit<AutofillCredential, 'id'>>): Promise<boolean> {
    try {
      const index = this.credentials.findIndex(cred => cred.id === id);
      if (index === -1) {
        return false;
      }
      
      // Update the credential with new data
      this.credentials[index] = {
        ...this.credentials[index],
        ...newData,
        lastUsed: new Date()
      };
      
      await this.persistCredentials();
      return true;
    } catch (error) {
      console.error('Failed to update credential:', error);
      throw error;
    }
  }
  
  /**
   * Find credentials matching a domain
   */
  public findCredentialsForDomain(domain: string): AutofillCredential[] {
    // Normalize domain (remove protocol, www, etc.)
    const normalizedDomain = this.normalizeDomain(domain);
    
    // Find exact and partial matches
    return this.credentials.filter(cred => {
      const credDomain = this.normalizeDomain(cred.domain);
      return credDomain.includes(normalizedDomain) || normalizedDomain.includes(credDomain);
    });
  }
  
  /**
   * Update a credential after it's been used
   */
  public async updateLastUsed(id: string): Promise<void> {
    const index = this.credentials.findIndex(cred => cred.id === id);
    if (index !== -1) {
      this.credentials[index].lastUsed = new Date();
      await this.persistCredentials();
    }
  }
  
  /**
   * Delete a saved credential
   */
  public async deleteCredential(id: string): Promise<boolean> {
    const initialLength = this.credentials.length;
    this.credentials = this.credentials.filter(cred => cred.id !== id);
    
    if (initialLength !== this.credentials.length) {
      await this.persistCredentials();
      return true;
    }
    return false;
  }
  
  /**
   * Check if autofill is supported on the current device
   */
  public isAutofillSupported(): boolean {
    if (Platform.OS === 'android') {
      return Platform.Version >= 26; // Android O (8.0) and up
    } else if (Platform.OS === 'ios') {
      return parseInt(Platform.Version, 10) >= 12; // iOS 12 and up
    }
    return false;
  }
  
  /**
   * Get all saved credentials
   */
  public getAllCredentials(): AutofillCredential[] {
    return [...this.credentials];
  }
  
  /**
   * Save credentials to secure storage
   */
  private async persistCredentials(): Promise<void> {
    try {
      const privateKey = await SecureStorage.get('PRIVATE_KEY');
      if (privateKey) {
        const jsonData = JSON.stringify(this.credentials);
        const encryptedData = await EncryptionService.encrypt(jsonData, privateKey);
        await SecureStorage.set('AUTOFILL_CREDENTIALS', encryptedData);
      }
    } catch (error) {
      console.error('Failed to persist credentials:', error);
      throw error;
    }
  }
  
  /**
   * Normalize a domain for comparison
   */
  private normalizeDomain(domain: string): string {
    // Remove protocol (http://, https://)
    let normalized = domain.replace(/^(https?:\/\/)?(www\.)?/i, '');
    
    // Remove path, query string, etc.
    normalized = normalized.split('/')[0];
    
    return normalized.toLowerCase();
  }
  
  /**
   * Register with Android's Autofill Framework
   * Note: This is a placeholder implementation. Actual implementation would require 
   * native modules and Android-specific code.
   */
  private registerAndroidAutofillService(): void {
    // This would typically be implemented in a native module
    console.log('Android Autofill Service registration placeholder');
  }
  
  /**
   * Register with iOS Password AutoFill
   * Note: This is a placeholder implementation. Actual implementation would require
   * native modules and iOS-specific code.
   */
  private registeriOSAutofillService(): void {
    // This would typically be implemented in a native module
    console.log('iOS Password AutoFill registration placeholder');
  }
  
  /**
   * Demo method to simulate autofill for a given app or website
   */
  public simulateAutofill(domain: string): { username: string, password: string } | null {
    const matches = this.findCredentialsForDomain(domain);
    
    if (matches.length === 0) {
      return null;
    }
    
    // Sort by last used (most recent first)
    matches.sort((a, b) => {
      const dateA = a.lastUsed ? new Date(a.lastUsed) : new Date(0);
      const dateB = b.lastUsed ? new Date(b.lastUsed) : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
    
    const bestMatch = matches[0];
    
    // In a real implementation, we would update lastUsed and persist changes
    this.updateLastUsed(bestMatch.id).catch(console.error);
    
    return {
      username: bestMatch.username,
      password: bestMatch.password
    };
  }
}

// Export a singleton instance
export const autofillService = KrypKeyAutofillService.getInstance();
