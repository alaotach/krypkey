import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList, ListRenderItem, ActivityIndicator } from 'react-native';
import { Key, Plus, Eye, EyeOff } from 'lucide-react-native';
import { SecureStorage } from '../../utils/storage';

interface Password {
  id: string;
  title: string;
  password: string;
}

interface ShowPasswords {
  [key: string]: boolean;
}

export default function PasswordsTab() {
  const [passwords, setPasswords] = useState<Password[]>([]);
  const [showAdd, setShowAdd] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [showPasswords, setShowPasswords] = useState<ShowPasswords>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPasswords();
  }, []);

  const loadPasswords = async () => {
    try {
      const storedPasswords = await SecureStorage.get('PASSWORDS');
      if (storedPasswords) {
        setPasswords(JSON.parse(storedPasswords));
      }
    } catch (error) {
      console.error('Error loading passwords:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const savePasswords = async (updatedPasswords: Password[]) => {
    try {
      await SecureStorage.set('PASSWORDS', JSON.stringify(updatedPasswords));
    } catch (error) {
      console.error('Error saving passwords:', error);
    }
  };

  const addPassword = async (): Promise<void> => {
    if (newTitle && newPassword) {
      const updatedPasswords = [
        ...passwords,
        {
          id: Date.now().toString(),
          title: newTitle,
          password: newPassword,
        },
      ];
      setPasswords(updatedPasswords);
      await savePasswords(updatedPasswords);
      setNewTitle('');
      setNewPassword('');
      setShowAdd(false);
    }
  };


  const togglePasswordVisibility = (id: string): void => {
    setShowPasswords({
      ...showPasswords,
      [id]: !showPasswords[id],
    });
  };

  const renderItem: ListRenderItem<Password> = ({ item }) => (
    <View style={styles.passwordItem}>
      <View style={styles.passwordHeader}>
        <Key size={20} color="#4F46E5" />
        <Text style={styles.passwordTitle}>{item.title}</Text>
      </View>
      <View style={styles.passwordContent}>
        <Text style={styles.passwordText}>
          {showPasswords[item.id] ? item.password : '•'.repeat(item.password.length)}
        </Text>
        <TouchableOpacity onPress={() => togglePasswordVisibility(item.id)}>
          {showPasswords[item.id] ? (
            <EyeOff size={20} color="#6b7280" />
          ) : (
            <Eye size={20} color="#6b7280" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Loading passwords...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Passwords</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowAdd(!showAdd)}
        >
          <Plus size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {showAdd && (
        <View style={styles.addContainer}>
          <TextInput
            style={styles.input}
            placeholder="Title"
            placeholderTextColor="#6b7280"
            value={newTitle}
            onChangeText={setNewTitle}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#6b7280"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
          />
          <TouchableOpacity 
            style={styles.saveButton}
            onPress={addPassword}
          >
            <Text style={styles.saveButtonText}>Save Password</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList<Password>
        data={passwords}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
      />

      {passwords.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            No passwords saved yet. Tap the + button to add one.
          </Text>
        </View>
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  container: {
    flex: 1,
    backgroundColor: '#1a1b1e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  addButton: {
    backgroundColor: '#4F46E5',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addContainer: {
    backgroundColor: '#27272a',
    padding: 20,
    margin: 20,
    borderRadius: 12,
    gap: 12,
  },
  input: {
    backgroundColor: '#1a1b1e',
    padding: 12,
    borderRadius: 8,
    color: '#fff',
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#4F46E5',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 20,
    gap: 12,
  },
  passwordItem: {
    backgroundColor: '#27272a',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  passwordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  passwordTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  passwordContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  passwordText: {
    color: '#9ca3af',
    fontSize: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyStateText: {
    color: '#6b7280',
    fontSize: 16,
    textAlign: 'center',
  },
});