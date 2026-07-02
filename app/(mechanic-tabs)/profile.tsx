import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  Alert,
  Image,
  ActivityIndicator
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import authService from '../../services/authService';

const getApiBaseUrl = () => {
  if (Platform.OS === 'android') {
    return `http://10.65.49.24:8000/api`;
  }
  return 'http://localhost:8000/api';
};

export default function MechanicProfileScreen() {
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    const user = await authService.getUserData();
    setUserData(user);
    
    // Fetch fresh data from API to get the latest profile image if exists
    try {
      const response = await fetch(`${getApiBaseUrl()}/me`, {
        headers: {
          'Authorization': `Bearer ${await authService.getToken()}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (data.success && data.user) {
        setUserData(data.user);
        await authService.saveUserData(data.user);
      }
    } catch (e) {
      console.log('Could not fetch fresh user data');
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    router.replace('/login');
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
      console.error(error);
    }
  };

  const uploadImage = async (uri: string) => {
    setIsUploading(true);
    try {
      const token = await authService.getToken();
      
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'profile.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;
      
      formData.append('image', {
        uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
        name: filename,
        type,
      } as any);

      const response = await fetch(`${getApiBaseUrl()}/user/profile-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });
      
      const data = await response.json();
      
      if (data.success) {
        Alert.alert('Success', 'Profile image updated!');
        setUserData(data.user);
        await authService.saveUserData(data.user);
      } else {
        Alert.alert('Error', data.message || 'Failed to upload image');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to upload image. Please try again.');
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const removeProfileImage = async () => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove your profile photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: async () => {
            setIsUploading(true);
            try {
              const token = await authService.getToken();
              const response = await fetch(`${getApiBaseUrl()}/user/profile-image`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Accept': 'application/json',
                },
              });
              
              const data = await response.json();
              if (data.success) {
                Alert.alert('Success', 'Profile image removed!');
                setUserData(data.user);
                await authService.saveUserData(data.user);
              } else {
                Alert.alert('Error', data.message || 'Failed to remove image');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to remove image');
            } finally {
              setIsUploading(false);
            }
          }
        }
      ]
    );
  };


  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Profile</Text>
          </View>

          <View style={styles.profileSection}>
            <TouchableOpacity onPress={pickImage} style={styles.avatarContainer} disabled={isUploading}>
              <View style={styles.avatarLarge}>
                {isUploading ? (
                  <ActivityIndicator size="large" color="#0F172A" />
                ) : userData?.profile_image ? (
                  <Image 
                    source={{ uri: userData.profile_image.startsWith('http') ? userData.profile_image : `http://10.65.49.24:8000/storage/${userData.profile_image}` }} 
                    style={styles.avatarImage} 
                  />
                ) : (
                  <Text style={styles.avatarTextLarge}>
                    {(userData?.name || userData?.username || 'M').charAt(0).toUpperCase()}
                  </Text>
                )}
                <View style={styles.editBadge}>
                  <Ionicons name="camera" size={16} color="#FFFFFF" />
                </View>
              </View>
            </TouchableOpacity>
            {userData?.profile_image && !isUploading && (
              <TouchableOpacity onPress={removeProfileImage} style={styles.removePhotoBtn}>
                <Text style={styles.removePhotoText}>Remove Photo</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.profileName}>{userData?.name || 'Mechanic Name'}</Text>
            <Text style={styles.profileRole}>ROLE: MECHANIC</Text>
            <Text style={styles.profileUsername}>@{userData?.username || 'username'}</Text>
          </View>

          <View style={styles.actionsSection}>
            <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/change-password')}>
              <Ionicons name="lock-closed-outline" size={24} color="#64748B" />
              <Text style={[styles.actionButtonText, { color: '#64748B' }]}>Change Password</Text>
            </TouchableOpacity>
            
            <View style={styles.divider} />
            
            <TouchableOpacity style={styles.actionButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={24} color="#EF4444" />
              <Text style={styles.actionButtonText}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  safeArea: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12 },
  header: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarImage: {
    width: 92,
    height: 92,
    borderRadius: 46,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#10B981',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarTextLarge: {
    fontSize: 40,
    fontWeight: '800',
    color: '#0F172A',
  },
  removePhotoBtn: {
    marginBottom: 16,
    marginTop: -8,
  },
  removePhotoText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
    letterSpacing: 1,
    marginBottom: 4,
  },
  profileUsername: {
    fontSize: 14,
    color: '#64748B',
  },
  actionsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
    marginLeft: 12,
  },
});
