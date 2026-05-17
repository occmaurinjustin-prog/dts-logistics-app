import authService from '@/services/authService';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

export default function ProfileScreen() {
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);

  
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
        const response = await fetch('http://localhost:8000/api/me', {
          headers: {
            'Authorization': `Bearer ${await authService.getToken()}`,
            'Content-Type': 'application/json',
          },
        });
        const data = await response.json();
        if (data.success && data.user) {
          console.log('Fresh user data from API:', data.user);
          setUserData(data.user);
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
    { icon: 'person-outline', label: 'Edit Profile', onPress: () => {} },
    { icon: 'document-text-outline', label: 'Delivery History', onPress: () => {} },
    { icon: 'build-outline', label: 'Maintenance Reports', onPress: () => {
                console.log('Maintenance Reports clicked, navigating to dashboard');
                router.push('/maintenance');
              } },
    { icon: 'car-outline', label: 'Truck Information', onPress: () => {
                console.log('Truck Information clicked, navigating to truck info');
                router.push('/truckinformation');
              } },
        { icon: 'notifications-outline', label: 'Notifications', onPress: () => {
                    console.log('Notifications clicked, navigating to notifications');
                    router.push('/notifications');
                  } },
    { icon: 'help-circle-outline', label: 'Help & Support', onPress: () => {} },
    { icon: 'settings-outline', label: 'Settings', onPress: () => {} },
  ];

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Modern Profile Header with Gradient */}
          <LinearGradient
            colors={['#22C55E', '#16A34A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.modernHeader}
          >
            <View style={styles.headerContent}>
              <View style={styles.profileImageContainer}>
                <View style={styles.profileImage}>
                  <Ionicons name="person" size={36} color="#FFFFFF" />
                </View>
              </View>
              <View style={styles.driverInfo}>
                <Text style={styles.driverName}>
                  {userData?.firstname && userData?.lastname ? `${userData.firstname} ${userData.lastname}` : userData?.username || userData?.name || 'Driver'}
                </Text>
                <Text style={styles.driverEmail}>{userData?.email || 'driver@example.com'}</Text>
                <View style={styles.driverBadge}>
                  <Text style={styles.driverBadgeText}>Driver</Text>
                </View>
              </View>
            </View>
          </LinearGradient>

          {/* Menu Items */}
          <View style={styles.menuSection}>
            <Text style={styles.sectionTitle}>Account</Text>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.menuItem}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <View style={styles.menuItemLeft}>
                  <View style={styles.menuIcon}>
                    <Ionicons name={item.icon as any} size={20} color="#111827" />
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemText}>{item.label}</Text>
                    {item.label === 'Delivery History' && (
                      <Text style={styles.menuItemSubtitle}>View past deliveries</Text>
                    )}
                    {item.label === 'Maintenance Reports' && (
                      <Text style={styles.menuItemSubtitle}>Track maintenance requests</Text>
                    )}
                    {item.label === 'Notifications' && (
                      <Text style={styles.menuItemSubtitle}>Manage alerts</Text>
                    )}
                    {item.label === 'Help & Support' && (
                      <Text style={styles.menuItemSubtitle}>Get assistance</Text>
                    )}
                    {item.label === 'Truck Information' && (
                      <Text style={styles.menuItemSubtitle}>View truck details</Text>
                    )}
                    {item.label === 'Settings' && (
                      <Text style={styles.menuItemSubtitle}>App preferences</Text>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
              </TouchableOpacity>
            ))}
          </View>

          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out" size={20} color="#FFFFFF" />
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>

          {/* Version Info */}
          <Text style={styles.versionText}>Version 1.0.0</Text>
        </ScrollView>
      </SafeAreaView>
      
          </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    position: 'relative',
  },
  safeArea: {
    flex: 1,
    paddingTop: 55,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },

  // Modern Header Styles
  modernHeader: {
    height: 230,
    borderRadius: 28,
    padding: 24,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 5,
    marginBottom: 24,
  },
  headerContent: {
    alignItems: 'center',
  },
  profileImageContainer: {
    marginBottom: 18,
  },
  profileImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: '#22C55E',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverInfo: {
    alignItems: 'center',
  },
  driverName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  driverEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  driverBadge: {
    width: 'auto',
    paddingHorizontal: 14,
    height: 32,
    borderRadius: 20,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16A34A',
  },

  // Menu Items Styles
  menuSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 14,
  },
  menuItem: {
    height: 72,
    backgroundColor: 'white',
    borderRadius: 20,
    paddingHorizontal: 18,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  menuItemSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3BC240',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  versionText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },

  // Modal Styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalContent: {
    padding: 20,
  },

  // Maintenance Report Styles
  maintenanceDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 14,
    textAlign: 'center',
  },
  reportInput: {
    height: 54,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 16,
  },
  reportTextarea: {
    height: 120,
    paddingTop: 16,
  },
  reportButton: {
    height: 56,
    borderRadius: 18,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
  },
  reportButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 14,
  },
  statusBadgeInReview: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeApproved: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgeFixed: {
    backgroundColor: '#EDE9FE',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statusBadgeTextInReview: {
    color: '#D97706',
  },
  statusBadgeTextApproved: {
    color: '#16A34A',
  },
  statusBadgeTextFixed: {
    color: '#7C3AED',
  },

  // Enhanced Modal Styles
  exampleText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  priorityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  priorityButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  priorityButtonActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  priorityButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  priorityButtonTextActive: {
    color: '#FFFFFF',
  },

  // Maintenance History Styles
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyId: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  historyTruck: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  historyIssue: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  historyDate: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  historyMechanic: {
    fontSize: 12,
    color: '#6B7280',
  },
  statusBadgePending: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeRepairOngoing: {
    backgroundColor: '#FB923C',
  },
  statusBadgeRejected: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgeTextPending: {
    color: '#D97706',
  },
  statusBadgeTextRepairOngoing: {
    color: '#DC2626',
  },
  statusBadgeTextRejected: {
    color: '#DC2626',
  },
});
