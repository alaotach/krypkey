import { Tabs } from 'expo-router';
import { Key, Settings } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: '#1a1b1e',
        },
        headerTintColor: '#fff',
        tabBarStyle: {
          backgroundColor: '#1a1b1e',
          borderTopColor: '#27272a',
        },
        tabBarActiveTintColor: '#4F46E5',
        tabBarInactiveTintColor: '#6b7280',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Passwords',
          tabBarIcon: ({ color }) => <Key size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Settings size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}