import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import authService from '@/services/authService';
import { useEffect, useState } from 'react';

export default function Index() {
  const [targetRoute, setTargetRoute] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const isAuth = await authService.isAuthenticated();
      if (!isAuth) {
        setTargetRoute('/login');
        return;
      }
      
      const user = await authService.getUserData();
      if (user?.role === 'mechanic') {
        if (user?.requires_face_registration) {
          setTargetRoute('/face-registration');
        } else {
          setTargetRoute('/(mechanic-tabs)');
        }
      } else {
        setTargetRoute('/(tabs)');
      }
    };
    
    checkAuth();
  }, []);

  if (!targetRoute) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return <Redirect href={targetRoute as any} />;
}
