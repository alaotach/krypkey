import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Modal, ScrollView, SafeAreaView } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Download, AlertTriangle, CheckCircle, Laptop, Smartphone, FileDown, X } from 'lucide-react-native';
import axios from 'axios';
import { SecureStorage } from '../../utils/storage';

// Instructions modal component for better UX
const InstructionsModal = ({ visible, onClose, onContinue }) => {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>How to Export Passwords</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.scrollContent}>
            <View style={styles.instructionSection}>
              <View style={styles.sectionHeader}>
                <Laptop size={24} color="#4F46E5" />
                <Text style={styles.sectionTitle}>From Desktop Chrome</Text>
              </View>
              <View style={styles.stepContainer}>
                <Text style={styles.stepNumber}>1</Text>
                <Text style={styles.stepText}>Open Chrome on your computer</Text>
              </View>
              <View style={styles.stepContainer}>
                <Text style={styles.stepNumber}>2</Text>
                <Text style={styles.stepText}>Go to chrome://settings/passwords</Text>
              </View>
              <View style={styles.stepContainer}>
                <Text style={styles.stepNumber}>3</Text>
                <Text style={styles.stepText}>Click ⋮ (menu)</Text>
              </View>
              <View style={styles.stepContainer}>
                <Text style={styles.stepNumber}>4</Text>
                <Text style={styles.stepText}>Click "Export passwords"</Text>
              </View>
              <View style={styles.stepContainer}>
                <Text style={styles.stepNumber}>5</Text>
                <Text style={styles.stepText}>Save the CSV file</Text>
              </View>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.instructionSection}>
              <View style={styles.sectionHeader}>
                <Smartphone size={24} color="#4F46E5" />
                <Text style={styles.sectionTitle}>From Google Password Manager</Text>
              </View>
              <View style={styles.stepContainer}>
                <Text style={styles.stepNumber}>1</Text>
                <Text style={styles.stepText}>Open Google Password Manager app</Text>
              </View>
              <View style={styles.stepContainer}>
                <Text style={styles.stepNumber}>2</Text>
                <Text style={styles.stepText}>Tap the Settings gear icon (⚙️)</Text>
              </View>
              <View style={styles.stepContainer}>
                <Text style={styles.stepNumber}>3</Text>
                <Text style={styles.stepText}>Select "Export passwords"</Text>
              </View>
              <View style={styles.stepContainer}>
                <Text style={styles.stepNumber}>4</Text>
                <Text style={styles.stepText}>Confirm with your screen lock</Text>
              </View>
              <View style={styles.stepContainer}>
                <Text style={styles.stepNumber}>5</Text>
                <Text style={styles.stepText}>Choose where to save the CSV file</Text>
              </View>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.instructionSection}>
              <View style={styles.sectionHeader}>
                <Smartphone size={24} color="#4F46E5" />
                <Text style={styles.sectionTitle}>From Chrome Mobile App</Text>
              </View>
              <View style={styles.stepContainer}>
                <Text style={styles.stepNumber}>1</Text>
                <Text style={styles.stepText}>Open Chrome app</Text>
              </View>
              <View style={styles.stepContainer}>
                <Text style={styles.stepNumber}>2</Text>
                <Text style={styles.stepText}>Tap ⋮ (menu) > Settings</Text>
              </View>
              <View style={styles.stepContainer}>
                <Text style={styles.stepNumber}>3</Text>
                <Text style={styles.stepText}>Tap "Passwords"</Text>
              </View>
              <View style={styles.stepContainer}>
                <Text style={styles.stepNumber}>4</Text>
                <Text style={styles.stepText}>Tap ⋮ (menu) > Export passwords</Text>
              </View>
              <View style={styles.stepContainer}>
                <Text style={styles.stepNumber}>5</Text>
                <Text style={styles.stepText}>Confirm with your screen lock</Text>
              </View>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.instructionSection}>
              <View style={styles.sectionHeader}>
                <FileDown size={24} color="#4F46E5" />
                <Text style={styles.sectionTitle}>After Exporting</Text>
              </View>
              <View style={styles.stepContainer}>
                <Text style={styles.stepNumber}>1</Text>
                <Text style={styles.stepText}>Transfer the CSV file to this device if needed</Text>
              </View>
              <View style={styles.stepContainer}>
                <Text style={styles.stepNumber}>2</Text>
                <Text style={styles.stepText}>Select the file in the next step</Text>
              </View>
            </View>
          </ScrollView>
          
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.continueButton} onPress={onContinue}>
              <Text style={styles.continueButtonText}>Select File</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

// Function to parse CSV data from Chrome password export
const parseCSV = (csvText: string): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    try {
      // Split by line breaks to get rows
      const rows = csvText.split(/\r?\n/);
      
      // Get headers (first row)
      const headers = rows[0].split(',').map(header => 
        // Remove quotes if present
        header.replace(/^"(.*)"$/, '$1')
      );
      
      // Check if this is a valid Chrome password export
      const requiredHeaders = ['name', 'url', 'username', 'password'];
      const hasRequiredHeaders = requiredHeaders.every(header => 
        headers.some(h => h.toLowerCase().includes(header))
      );
      
      if (!hasRequiredHeaders) {
        console.error('Invalid CSV format - missing required headers');
        reject(new Error('The CSV file does not appear to be a valid Chrome password export. Please make sure you exported passwords from Chrome.'));
        return;
      }
      
      // Find the indices of the important columns
      const urlIndex = headers.findIndex(h => h.toLowerCase().includes('url'));
      const nameIndex = headers.findIndex(h => h.toLowerCase().includes('name'));
      const usernameIndex = headers.findIndex(h => h.toLowerCase().includes('username'));
      const passwordIndex = headers.findIndex(h => h.toLowerCase().includes('password'));
      
      if (urlIndex === -1 || nameIndex === -1 || usernameIndex === -1 || passwordIndex === -1) {
        reject(new Error('Could not find required columns in the CSV file.'));
        return;
      }
      
      // Parse data rows (skip header)
      const passwordEntries = [];
      for (let i = 1; i < rows.length; i++) {
        // Skip empty rows
        if (!rows[i] || rows[i].trim() === '') continue;
        
        // Handle fields with commas inside quotes properly
        const fields = [];
        let currentField = '';
        let inQuotes = false;
        
        for (const char of rows[i]) {
          if (char === '"') {
            inQuotes = !inQuotes;
            currentField += char;
          } else if (char === ',' && !inQuotes) {
            fields.push(currentField);
            currentField = '';
          } else {
            currentField += char;
          }
        }
        
        // Add the last field
        fields.push(currentField);
        
        // Skip rows with wrong number of columns
        if (fields.length < headers.length) continue;
        
        // Extract fields, removing quotes
        const url = fields[urlIndex].replace(/^"(.*)"$/, '$1');
        const name = fields[nameIndex].replace(/^"(.*)"$/, '$1');
        const username = fields[usernameIndex].replace(/^"(.*)"$/, '$1');
        const password = fields[passwordIndex].replace(/^"(.*)"$/, '$1');
        
        // Skip entries with empty passwords or URLs
        if (!url || !password) continue;
        
        // Extract the website domain name for display
        let displayName = name;
        let websiteDomain = "";
        
        try {
          if (url) {
            // Parse URL to get just the domain
            const urlObj = new URL(url);
            websiteDomain = urlObj.hostname.replace(/^www\./, '');
            
            // If no name is provided, use the domain as the display name
            if (!displayName || displayName.trim() === '') {
              displayName = websiteDomain;
            }
          }
        } catch (e) {
          // If URL parsing fails, just use the raw URL
          websiteDomain = url;
          if (!displayName || displayName.trim() === '') {
            displayName = url;
          }
        }
        
        // Create a standardized structure matching what the api/users/add-password endpoint expects
        passwordEntries.push({
          title: displayName,
          category: 'login',
          loginUsername: username,
          password: password,
          website: url,             // Store the full URL for reference
          websiteDomain: websiteDomain,  // Store the domain for display
          notes: `Imported from Chrome on ${new Date().toLocaleDateString()}`
        });
      }
      
      console.log(`Successfully parsed ${passwordEntries.length} passwords from CSV`);
      resolve(passwordEntries);
    } catch (error) {
      console.error('Error parsing CSV:', error);
      reject(new Error('Failed to parse the CSV file. The file may be corrupted or in an incorrect format.'));
    }
  });
};

// Function to save parsed passwords to storage
const savePasswords = async (passwords: any[]): Promise<number> => {
  try {
    console.log(`Saving ${passwords.length} passwords to server...`);
    
    // Get the authentication token from secure storage
    const authToken = await SecureStorage.get('AUTH_TOKEN');
    const username = await SecureStorage.get('USERNAME');
    const privateKey = await SecureStorage.get('PRIVATE_KEY');
    
    if (!authToken) {
      throw new Error('You are not logged in. Please log in and try again.');
    }
    
    if (!username || !privateKey) {
      throw new Error('Missing user credentials. Please log in again.');
    }
    
    // Process passwords in batches to avoid overwhelming the server
    const batchSize = 5;
    let successCount = 0;
    let failureCount = 0;
    
    // Display progress alert
    Alert.alert(
      'Import In Progress',
      `Importing ${passwords.length} passwords. This may take a moment.`
    );
    
    for (let i = 0; i < passwords.length; i += batchSize) {
      const batch = passwords.slice(i, i + batchSize);
      
      // Process batch sequentially to avoid rate limiting
      for (const passwordData of batch) {
        try {
          console.log(`Adding password: ${passwordData.title}`);
          
          // Add the password using the existing endpoint
          await axios.post(
            'http://192.168.179.248:5000/api/users/add-password',
            {
              username,
              privateKey,
              ...passwordData,
              dateCreated: new Date().toISOString(),
              lastModified: new Date().toISOString()
            },
            {
              headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          successCount++;
        } catch (error) {
          console.error('Error adding password:', error);
          failureCount++;
        }
        
        // Short delay between requests to prevent overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    // Set flag to indicate passwords have been updated
    await SecureStorage.set('PASSWORDS_UPDATED', 'true');
    
    if (failureCount > 0) {
      console.warn(`${failureCount} passwords failed to import`);
    }
    
    return successCount;
  } catch (error) {
    console.error('Error saving passwords to server:', error);
    
    // Handle different types of errors
    if (axios.isAxiosError(error)) {
      if (error.response) {
        // The server responded with a status code outside the 2xx range
        console.error('Server error response:', error.response.data);
        throw new Error(error.response.data.message || 'Server error. Please try again later.');
      } else if (error.request) {
        // The request was made but no response was received
        throw new Error('No response from server. Check your internet connection.');
      }
    }
    
    throw new Error('Failed to save passwords to server. Please try again.');
  }
};

export default function ImportGooglePasswords() {
  const [isImporting, setIsImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Check login status when component mounts
  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const authToken = await SecureStorage.get('AUTH_TOKEN');
        setIsLoggedIn(!!authToken);
      } catch (err) {
        console.error('Error checking login status:', err);
        setIsLoggedIn(false);
      }
    };
    
    checkLoginStatus();
  }, []);

  const handleImport = async () => {
    try {
      setIsImporting(true);
      setError(null);
      setShowInstructions(true);
    } catch (error) {
      console.error('Import failed:', error);
      setError(error.message || 'Failed to import passwords');
      setIsImporting(false);
    }
  };

  const startImport = async () => {
    setShowInstructions(false);
    
    // Check if user is logged in
    if (!isLoggedIn) {
      setError('You must be logged in to import passwords. Please log in and try again.');
      setIsImporting(false);
      return;
    }
    
    try {
      // Pick CSV file with improved error handling
      // Check for the latest DocumentPicker API
      let fileUri = null;
      let fileName = "";
      
      try {
        // Try to use the DocumentPicker with better error handling
        const result = await DocumentPicker.getDocumentAsync({
          type: ["text/csv", "text/comma-separated-values"],
          copyToCacheDirectory: true
        });
        
        console.log("Document picker result:", JSON.stringify(result));
        
        // Handle different result formats (API might have changed)
        if (result.type === 'cancel' || !result) {
          setIsImporting(false);
          return;
        }
        
        // Check if it's the new API format (assets array)
        if (result.assets && Array.isArray(result.assets) && result.assets.length > 0) {
          const asset = result.assets[0];
          fileUri = asset.uri;
          fileName = asset.name || "file.csv";
        } 
        // Check if it's the old API format
        else if (result.uri) {
          fileUri = result.uri;
          fileName = result.name || "file.csv";
        } else {
          throw new Error("Could not access the selected file. Please try again.");
        }
      } catch (pickError) {
        console.error("Document picker error:", pickError);
        throw new Error("Failed to select a file. Please try again.");
      }

      if (!fileUri) {
        throw new Error("No file was selected or the file cannot be accessed.");
      }

      console.log(`Selected file: ${fileName}, URI: ${fileUri}`);
      
      // Read and parse CSV
      try {
        // Try to read the file directly
        let fileContent;
        
        try {
          // Direct reading with better error handling
          fileContent = await FileSystem.readAsStringAsync(fileUri)
            .catch(e => {
              console.error('File read error:', e);
              throw new Error('Could not read the selected file. Make sure it\'s a valid CSV file.');
            });
        } catch (firstReadError) {
          console.error("First read attempt failed:", firstReadError);
          setError('Could not read the selected file. Please try a different file.');
          throw firstReadError;
        }
        
        if (!fileContent || fileContent.trim() === '') {
          throw new Error('The selected file appears to be empty.');
        }

        console.log("File content retrieved, length:", fileContent.length);
        
        const passwords = await parseCSV(fileContent);
        console.log("Parsed passwords count:", passwords?.length || 0);

        // Show a confirmation dialog for large imports with more details
        if (passwords.length > 10) {
          const confirmImport = await new Promise<boolean>((resolve) => {
            Alert.alert(
              'Large Import',
              `You're about to import ${passwords.length} passwords. This will take approximately ${Math.ceil(passwords.length * 0.5)} seconds. Continue?`,
              [
                { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
                { text: 'Import', onPress: () => resolve(true) }
              ]
            );
          });
          
          if (!confirmImport) {
            setIsImporting(false);
            return;
          }
        }

        // Save passwords with progress updates
        const imported = await savePasswords(passwords);
        
        if (imported > 0) {
          setImportedCount(imported);
          
          const failedCount = passwords.length - imported;
          if (failedCount > 0) {
            Alert.alert(
              'Import Complete',
              `Successfully imported ${imported} passwords! ${failedCount} passwords couldn't be imported.`
            );
          } else {
            Alert.alert(
              'Import Complete',
              `Successfully imported all ${imported} passwords!`
            );
          }
        } else {
          setError('None of the passwords could be imported. Please check the format and try again.');
        }
        
      } catch (readError) {
        console.error('File processing error:', readError);
        let errorMessage = 'Failed to process the CSV file. ';
        
        if (readError.message?.includes('null') || readError.message?.includes('cast')) {
          errorMessage += 'The file format is not compatible.';
        } else if (readError.message?.includes('rejected')) {
          errorMessage += 'Please make sure the file is accessible and not corrupted.';
        } else {
          errorMessage += readError.message || 'Please try again with a different file.';
        }
        
        setError(errorMessage);
      }
    } catch (error) {
      console.error('Import process error:', error);
      setError('Import failed: ' + (error.message || 'Unknown error'));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Import From Chrome</Text>
        <Text style={styles.description}>
          Import your passwords from Chrome Browser by exporting them as a CSV file.
          Your passwords will be encrypted before being stored.
        </Text>

        {error ? (
          <View style={styles.errorContainer}>
            <AlertTriangle color="#ef4444" size={24} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {importedCount > 0 ? (
          <View style={styles.successContainer}>
            <CheckCircle color="#22c55e" size={24} />
            <Text style={styles.successText}>
              Successfully imported {importedCount} passwords
            </Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.importButton, isImporting && styles.buttonDisabled]}
          onPress={handleImport}
          disabled={isImporting}
        >
          <Download size={20} color="#fff" />
          <Text style={styles.importButtonText}>
            {isImporting ? 'Importing...' : 'Import from Chrome'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.helpText}>
          Need help? Check our guide on how to export passwords from Chrome.
        </Text>
        
        <InstructionsModal 
          visible={showInstructions}
          onClose={() => {
            setShowInstructions(false);
            setIsImporting(false);
          }}
          onContinue={startImport}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1b1e'
  },
  content: {
    padding: 20
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10
  },
  description: {
    color: '#9ca3af',
    marginBottom: 20
  },
  importButton: {
    backgroundColor: '#4F46E5',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8
  },
  successText: {
    color: '#22c55e',
    flex: 1
  },
  helpText: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 20,
    textAlign: 'center'
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1e1e1e',
    borderRadius: 16,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  scrollContent: {
    padding: 16,
  },
  instructionSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  stepContainer: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'center',
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
    marginRight: 12,
    overflow: 'hidden',
    lineHeight: 24,
  },
  stepText: {
    color: '#e2e2e2',
    fontSize: 16,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#555',
  },
  cancelButtonText: {
    color: '#ddd',
    fontWeight: '500',
  },
  continueButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  continueButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});