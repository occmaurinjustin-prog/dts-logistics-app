import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import 'react-native-reanimated';

// Create a client
const queryClient = new QueryClient();

import { useColorScheme } from '@/hooks/use-color-scheme';
import authService from '@/services/authService';

export const unstable_settings = {
  anchor: 'login',
};

// Auth provider to handle authentication state
function useProtectedRoute() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [requiresFaceRegistration, setRequiresFaceRegistration] = useState<boolean>(false);
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(false);
  const [isReady, setIsReady] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Check auth status on mount and when segments change (navigation)
    const checkAuth = async () => {
      try {
        const authenticated = await authService.isAuthenticated();
        console.log('Auth check - isAuthenticated:', authenticated);
        
        if (authenticated) {
          const user = await authService.getUserData();
          setUserRole(user?.role || null);
          setRequiresFaceRegistration(user?.requires_face_registration === true);
          setMustChangePassword(user?.must_change_password === true);
        } else {
          setUserRole(null);
          setRequiresFaceRegistration(false);
          setMustChangePassword(false);
        }
        
        setIsAuthenticated(authenticated);
      } catch (error) {
        console.error('Auth check error:', error);
        setUserRole(null);
        setRequiresFaceRegistration(false);
        setMustChangePassword(false);
        setIsAuthenticated(false);
      } finally {
        setIsReady(true);
      }
    };
    checkAuth();
  }, [segments]);

  useEffect(() => {
    if (!isReady || isAuthenticated === null) return; // Still loading

    const currentSegment = segments[0];
    const inAuthGroup = currentSegment === 'login';

    console.log('Navigation check - isAuthenticated:', isAuthenticated, 'inAuthGroup:', inAuthGroup, 'currentSegment:', currentSegment, 'userRole:', userRole);

    if (!isAuthenticated && !inAuthGroup) {
      // Not authenticated, redirect to login
      console.log('Redirecting to login...');
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Authenticated but on login page, redirect to tabs
      let targetRoute = userRole === 'mechanic' ? '/(mechanic-tabs)' : '/(tabs)';
      
      if (userRole === 'mechanic' && requiresFaceRegistration) {
        targetRoute = '/face-registration';
      }
      
      console.log(`Redirecting to ${targetRoute}...`);
      router.replace(targetRoute as any);
    }
  }, [isAuthenticated, userRole, requiresFaceRegistration, segments, isReady]);

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
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          {/* <Stack.Protected guard={user.role === "driver"}>
            
            </Stack.Protected> */}
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="face-registration" options={{ headerShown: false }} />
          <Stack.Screen name="dashboard" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(mechanic-tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="maintenance" options={{ headerShown: false }} />
          <Stack.Screen name="notifications" options={{ headerShown: false }} />
          <Stack.Screen name="truckinformation" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
