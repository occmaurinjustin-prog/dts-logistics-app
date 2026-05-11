import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import authService from '@/services/authService';

export const unstable_settings = {
  anchor: 'login',
};

// Auth provider to handle authentication state
function useProtectedRoute() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isReady, setIsReady] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Check auth status on mount and when segments change (navigation)
    const checkAuth = async () => {
      try {
        const authenticated = await authService.isAuthenticated();
        console.log('Auth check - isAuthenticated:', authenticated);
        setIsAuthenticated(authenticated);
      } catch (error) {
        console.error('Auth check error:', error);
        setIsAuthenticated(false);
      } finally {
        setIsReady(true);
      }
    };
    checkAuth();
  }, [segments]);

  useEffect(() => {
    if (!isReady || isAuthenticated === null) return; // Still loading

    const inAuthGroup = segments[0] === 'login';

    console.log('Navigation check - isAuthenticated:', isAuthenticated, 'inAuthGroup:', inAuthGroup, 'currentSegment:', segments[0]);

    if (!isAuthenticated && !inAuthGroup) {
      // Not authenticated, redirect to login
      console.log('Redirecting to login...');
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Authenticated but on login page, redirect to tabs
      console.log('Redirecting to tabs...');
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, segments, isReady]);

  return { isAuthenticated, isReady };
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, isReady } = useProtectedRoute();

  // Show loading while checking auth
  if (!isReady || isAuthenticated === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#1F2937" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="maintenance" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
        <Stack.Screen name="truckinformation" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
