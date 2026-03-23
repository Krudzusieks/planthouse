import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const currentRoute = segments[0];
    const publicRoutes = ['index', 'login', 'register'];
    const isOnPublicRoute = publicRoutes.includes(currentRoute);

    if (!session && !isOnPublicRoute) {
      router.replace('/login');
    } else if (session && isOnPublicRoute) {
      router.replace('/home');
    }
  }, [session, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0E1A12', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#4CAF50" size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="home" />
      <Stack.Screen name="plant-categories" />
      <Stack.Screen name="plants" />
      <Stack.Screen name="plants_show" />
      <Stack.Screen name="plant-batches" />
      <Stack.Screen name="batch-show" />
      <Stack.Screen name="locations" />
      <Stack.Screen name="scanner" />
      <Stack.Screen name="workers" />
      <Stack.Screen name="jobs" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}