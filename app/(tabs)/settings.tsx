import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { LogOut, Shield, Info } from 'lucide-react-native';

export default function SettingsTab() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Shield size={40} color="#4F46E5" />
        <Text style={styles.title}>SecureVault</Text>
        <Text style={styles.version}>Version 1.0.0</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <View style={styles.cardItem}>
            <Info size={20} color="#4F46E5" />
            <Text style={styles.cardText}>
              SecureVault is a secure password manager that uses encryption to protect your data.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={() => router.replace('/')}
        >
          <LogOut size={20} color="#991b1b" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1b1e',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
  },
  version: {
    color: '#6b7280',
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#27272a',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  cardText: {
    color: '#fff',
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27272a',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  logoutText: {
    color: '#991b1b',
    fontSize: 16,
    fontWeight: '600',
  },
});