import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="create"
        options={{
          title: 'Create Wallet'
        }}
      />
      <Stack.Screen 
        name="restore"
        options={{
          title: 'Restore Wallet'
        }}
      />
      <Stack.Screen 
        name="verify"
        options={{
          title: 'Verify Recovery Phrase'
        }}
      />
    </Stack>
  );
}