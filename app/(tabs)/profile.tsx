import authService from '@/services/authService';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

const getApiBaseUrl = () => {
  if (Platform.OS === 'android') {
    return `https://consult-powwow-vexingly.ngrok-free.dev/api`;
  }
  return 'https://consult-powwow-vexingly.ngrok-free.dev/api';
};

export default function ProfileScreen() {
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);


  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const user = await authService.getUserData();
      console.log('Loaded user data:', user);
      setUserData(user);

      // Also fetch fresh data from API
      try {
        const response = await fetch(`${getApiBaseUrl()}/me`, {
          headers: {
            'Authorization': `Bearer ${await authService.getToken()}`,
            'Content-Type': 'application/json',
          },
        });
        const data = await response.json();
        if (data.success && data.user) {
          console.log('Fresh user data from API:', data.user);
          setUserData(data.user);
          await authService.saveUserData(data.user);
        }
      } catch (apiError) {
        console.log('Could not fetch fresh data from API, using cached data');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleLogout = async () => {
    console.log('Logout button clicked');

    // Check if running on web
    const isWeb = Platform.OS === 'web';

    if (isWeb && typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const confirmed = window.confirm('Are you sure you want to logout?');
      if (!confirmed) {
        console.log('Logout cancelled by user');
        return;
      }
      console.log('User confirmed logout, proceeding...');
      await performLogout();
    } else {
      // For mobile (Android/iOS), use Alert.alert
      Alert.alert(
        'Logout',
        'Are you sure you want to logout?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Logout',
            style: 'destructive',
            onPress: async () => {
              console.log('User confirmed logout on mobile');
              await performLogout();
            },
          },
        ]
      );
    }
  };

  const performLogout = async () => {
    console.log('Starting logout process...');
    try {
      await authService.logout();
      console.log('Logout API call completed');
      await authService.clearStorage();
      console.log('Storage cleared');

      // Force reload the page to reset all state
      const isWeb = Platform.OS === 'web';
      if (isWeb && typeof window !== 'undefined' && typeof window.location?.href === 'string') {
        console.log('Reloading page for web');
        window.location.href = '/login';
      } else {
        console.log('Navigating to login for mobile');
        router.replace('/login');
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Force reload anyway
      const isWeb = Platform.OS === 'web';
      if (isWeb && typeof window !== 'undefined' && typeof window.location?.href === 'string') {
        window.location.href = '/login';
      } else {
        router.replace('/login');
      }
    }
  };

  const menuItems = [
    {
      icon: 'build-outline', label: 'Maintenance Reports', onPress: () => {
        console.log('Maintenance Reports clicked, navigating to dashboard');
        router.push('/maintenance');
      }
    },
    {
      icon: 'car-outline', label: 'Truck Information', onPress: () => {
        console.log('Truck Information clicked, navigating to truck info');
        router.push('/truckinformation');
      }
    },
    {
      icon: 'notifications-outline', label: 'Notifications', onPress: () => {
        console.log('Notifications clicked, navigating to notifications');
        router.push('/notifications');
      }
    },
    {
      icon: 'alert-circle-outline', label: 'Emergency Rescue', onPress: () => {
        router.push('/rescue-request');
      }
    },
    {
      icon: 'time-outline', label: 'Rescue History', onPress: () => {
        router.push('/rescue-history');
      }
    },
    {
      icon: 'lock-closed-outline', label: 'Change Password', onPress: () => {
        router.push('/change-password');
      }
    },
    { icon: 'settings-outline', label: 'Settings', onPress: () => { } },
  ];

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
      <SafeAreaView style={styles.safeArea}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Modern Profile Header */}
          <View
            style={[styles.modernHeader, { backgroundColor: '#0F172A' }]}
          >
            <View style={styles.headerContent}>
              <TouchableOpacity onPress={pickImage} style={styles.profileImageContainer} disabled={isUploading}>
                <View style={styles.profileImage}>
                  {isUploading ? (
                    <ActivityIndicator size="small" color="#10B981" />
                  ) : userData?.profile_image ? (
                    <Image
                      source={{ uri: userData.profile_image && typeof userData.profile_image === 'string' && userData.profile_image.startsWith('http') ? userData.profile_image : `https://consult-powwow-vexingly.ngrok-free.dev/storage/${userData.profile_image}` }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <Ionicons name="person" size={32} color="#10B981" />
                  )}
                  <View style={styles.editBadge}>
                    <Ionicons name="camera" size={12} color="#FFFFFF" />
                  </View>
                </View>
              </TouchableOpacity>
              <View style={styles.driverInfo}>
                <Text style={styles.driverName}>
                  {userData?.firstname && userData?.lastname ? `${userData.firstname} ${userData.lastname}` : userData?.username || userData?.name || 'Driver'}
                </Text>
                <Text style={styles.driverEmail}>{userData?.email || 'driver@example.com'}</Text>

                {userData?.profile_image && !isUploading && (
                  <TouchableOpacity onPress={removeProfileImage} style={styles.removePhotoBtn}>
                    <Text style={styles.removePhotoText}>Remove Photo</Text>
                  </TouchableOpacity>
                )}

                <View style={styles.driverBadge}>
                  <Ionicons name="shield-checkmark" size={10} color="#10B981" />
                  <Text style={styles.driverBadgeText}>Verified Driver</Text>
                </View>
              </View>
            </View>
          </View>


          {/* Menu Items */}
          <View style={styles.menuSection}>
            <Text style={styles.sectionTitle}>Account & Fleet Settings</Text>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.menuItem}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <View style={styles.menuItemLeft}>
                  <View style={styles.menuIcon}>
                    <Ionicons name={item.icon as any} size={18} color="#0F172A" />
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemText}>{item.label}</Text>
                    {item.label === 'Maintenance Reports' && (
                      <Text style={styles.menuItemSubtitle}>Track maintenance requests</Text>
                    )}
                    {item.label === 'Notifications' && (
                      <Text style={styles.menuItemSubtitle}>Manage alerts</Text>
                    )}
                    {item.label === 'Truck Information' && (
                      <Text style={styles.menuItemSubtitle}>View truck details</Text>
                    )}
                    {item.label === 'Settings' && (
                      <Text style={styles.menuItemSubtitle}>App preferences</Text>
                    )}
                    {item.label === 'Emergency Rescue' && (
                      <Text style={styles.menuItemSubtitle}>Request roadside assistance</Text>
                    )}
                    {item.label === 'Rescue History' && (
                      <Text style={styles.menuItemSubtitle}>View past emergencies</Text>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={14} color="#94A3B8" />
              </TouchableOpacity>
            ))}
          </View>

          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={18} color="#EF4444" />
            <Text style={styles.logoutButtonText}>Log Out from Device</Text>
          </TouchableOpacity>

          {/* Version Info */}
          <Text style={styles.versionText}>Logistics Driver App • Version 1.0.0</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 0 : 16,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },

  // Modern Header Styles
  modernHeader: {
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginBottom: 20,
    marginTop: Platform.OS === 'ios' ? 16 : 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImageContainer: {
    marginRight: 16,
  },
  profileImage: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  editBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#10B981',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  removePhotoBtn: {
    marginTop: 4,
  },
  removePhotoText: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '600',
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  driverEmail: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '500',
  },
  driverBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 8,
    alignSelf: 'flex-start',
    gap: 4,
  },
  driverBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563EB',
  },

  // Driving Stats Grid
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  statLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 1,
  },

  // Menu Items Styles
  menuSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  menuItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  menuItemSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    paddingVertical: 14,
    marginBottom: 20,
    gap: 6,
  },
  logoutButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
  },
  versionText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    fontWeight: '500',
    marginBottom: 32,
  },
});
