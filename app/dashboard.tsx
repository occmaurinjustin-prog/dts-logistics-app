import { AppAlert } from '@/components/AppAlert';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import CurrentDeliveryCard from '../components/CurrentDeliveryCard';
import DriverStatusIndicator from '../components/DriverStatusIndicator';
import authService from '../services/authService';
import driverService, { DriverProfile } from '../services/driverService';

// API Configuration
const YOUR_COMPUTER_IP = '10.65.49.24';
const getApiBaseUrl = () => {
  if (Platform.OS === 'android') {
    return `https://consult-powwow-vexingly.ngrok-free.dev/api`;
  }
  return 'https://consult-powwow-vexingly.ngrok-free.dev/api';
};
const API_BASE_URL = getApiBaseUrl();

// Types
interface Delivery {
  id: string;
  waybill: string;
  status: string;
  pickup_address: string;
  delivery_address: string;
  customer: string;
  item_description: string;
  priority: string;
  eta: string;
}

interface DashboardStats {
  active: number;
  completed: number;
  pending: number;
  today: number;
}

export default function DashboardScreen() {
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [stats, setStats] = useState<DashboardStats>({ active: 0, completed: 0, pending: 0, today: 0 });
  const [activeDeliveries, setActiveDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isOnline, setIsOnline] = useState(true);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);

  // Load user data and driver profile
  useEffect(() => {
    loadUserData();
    fetchDriverProfile();
  }, []);

  const loadUserData = async () => {
    const user = await authService.getUserData();
    setUserData(user);
  };

  // Fetch driver profile and status
  const fetchDriverProfile = async () => {
    try {
      const profile = await driverService.getDriverProfile();
      if (profile) {
        setDriverProfile(profile);
      }
    } catch (error) {
      console.error('Error fetching driver profile:', error);
    }
  };

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        setIsOnline(false);
        setLoading(false);
        return;
      }

      setIsOnline(true);
      const response = await axios.get(`${API_BASE_URL}/deliveries`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.data.success) {
        const deliveries = response.data.deliveries || [];
        
        // Calculate stats
        const today = new Date().toDateString();
        const todayDeliveries = deliveries.filter((d: any) => 
          new Date(d.created_at).toDateString() === today
        );
        
        setStats({
          active: deliveries.filter((d: any) => d.delivery_status === 'assigned' || d.delivery_status === 'in_transit').length,
          completed: deliveries.filter((d: any) => d.delivery_status === 'delivered').length,
          pending: deliveries.filter((d: any) => d.delivery_status === 'pending').length,
          today: todayDeliveries.length,
        });

        // Get active deliveries (max 3)
        const active = deliveries
          .filter((d: any) => d.delivery_status === 'assigned' || d.delivery_status === 'in_transit')
          .slice(0, 3)
          .map((d: any) => ({
            id: d.delivery_id,
            waybill: d.waybill,
            status: d.delivery_status === 'in_transit' ? 'In Transit' : 'Assigned',
            pickup_address: d.pickup_address,
            delivery_address: d.delivery_address,
            customer: d.client?.client_name || 'Unknown',
            item_description: d.item_description,
            priority: d.priority?.toUpperCase() || 'NORMAL',
            eta: new Date(d.estimated_delivery_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }));

        setActiveDeliveries(active);
        setLastUpdated(new Date());

        // Also fetch driver profile to get latest status
        await fetchDriverProfile();
      }
    } catch (error) {
      console.error('Dashboard fetch error:', error);
      setIsOnline(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Real-time updates every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboardData(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboardData(false);
  }, [fetchDashboardData]);

  const handleLogout = async () => {
    await authService.logout();
    router.replace('/login');
  };

  const handleDriverStatusPress = () => {
    if (driverService.isDriverBusy(driverProfile?.status)) {
      AppAlert.alert(
        'Driver Status: Busy',
        'You are currently in transit and cannot accept new deliveries. Complete your current delivery first.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleCompleteDelivery = () => {
    router.push('/(tabs)/navigation');
  };

  const navigateToDelivery = (deliveryId: string) => {
    router.push('/(tabs)/deliveries');
  };

  const navigateToNavigation = () => {
    router.push('/(tabs)/navigation');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In Transit': return '#000000';
      case 'Assigned': return '#666666';
      case 'Delivered': return '#999999';
      default: return '#000000';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return '#000000';
      case 'URGENT': return '#000000';
      case 'NORMAL': return '#666666';
      default: return '#666666';
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <SafeAreaView style={[styles.safeArea, styles.centerContent]}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading Dashboard...</Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>{(userData?.name || 'D').charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.headerText}>
              <Text style={styles.greeting}>Good day,</Text>
              <Text style={styles.driverName}>{userData?.name || 'Driver'}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            {/* Driver Status Indicator */}
            <DriverStatusIndicator
              status={driverProfile?.status}
              size="small"
              onPress={handleDriverStatusPress}
              style={styles.statusIndicatorMargin}
            />
            <View style={[styles.statusIndicator, { backgroundColor: isOnline ? '#FFFFFF' : '#666666' }]}>
              <Text style={styles.statusText}>{isOnline ? 'ONLINE' : 'OFFLINE'}</Text>
            </View>
            <TouchableOpacity onPress={handleLogout} style={styles.iconButton}>
              <Ionicons name="log-out-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />
          }
        >
          {/* Live Indicator */}
          <View style={styles.liveIndicator}>
            <View style={styles.pulseDot} />
            <Text style={styles.liveText}>REAL-TIME • Updated {lastUpdated.toLocaleTimeString()}</Text>
          </View>

          {/* Current Delivery Card - Shows when driver is busy */}
          {driverService.isDriverBusy(driverProfile?.status) && driverProfile?.current_delivery && (
            <CurrentDeliveryCard
              driver={driverProfile}
              onComplete={handleCompleteDelivery}
            />
          )}

          {/* Stats Grid - Minimal Black & White */}
          <View style={styles.statsGrid}>
            <View style={[styles.statBox, styles.statBoxBlack]}>
              <Text style={styles.statNumberWhite}>{stats.active}</Text>
              <Text style={styles.statLabelWhite}>Active</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxGray]}>
              <Text style={styles.statNumberDark}>{stats.today}</Text>
              <Text style={styles.statLabelDark}>Today</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxLight]}>
              <Text style={styles.statNumberDark}>{stats.completed}</Text>
              <Text style={styles.statLabelDark}>Done</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxBorder]}>
              <Text style={styles.statNumberDark}>{stats.pending}</Text>
              <Text style={styles.statLabelDark}>Pending</Text>
            </View>
          </View>

          {/* Quick Start Navigation */}
          {stats.active > 0 && (
            <TouchableOpacity style={styles.navigationCard} onPress={navigateToNavigation}>
              <View style={styles.navigationContent}>
                <View style={styles.navigationIcon}>
                  <Ionicons name="navigate" size={28} color="#FFFFFF" />
                </View>
                <View style={styles.navigationText}>
                  <Text style={styles.navigationTitle}>Start Navigation</Text>
                  <Text style={styles.navigationSubtitle}>{stats.active} active delivery{stats.active > 1 ? 'ies' : 'y'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          )}

          {/* Active Deliveries */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active Deliveries</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/deliveries')}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>

            {activeDeliveries.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="cube-outline" size={48} color="#CCCCCC" />
                <Text style={styles.emptyTitle}>No Active Deliveries</Text>
                <Text style={styles.emptySubtitle}>Pull down to refresh</Text>
              </View>
            ) : (
              activeDeliveries.map((delivery, index) => (
                <TouchableOpacity 
                  key={delivery.id} 
                  style={[styles.deliveryItem, index === 0 && styles.deliveryItemFirst]}
                  onPress={() => navigateToDelivery(delivery.id)}
                >
                  <View style={styles.deliveryRow}>
                    <View style={styles.deliveryMain}>
                      <View style={styles.deliveryHeaderRow}>
                        <Text style={styles.trackingNumber}>#{delivery.waybill}</Text>
                        <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(delivery.priority) }]}>
                          <Text style={styles.priorityText}>{delivery.priority}</Text>
                        </View>
                      </View>
                      <Text style={styles.customerName}>{delivery.customer}</Text>
                      <View style={styles.addressRow}>
                        <Ionicons name="location-outline" size={14} color="#666666" />
                        <Text style={styles.addressText} numberOfLines={1}>{delivery.delivery_address}</Text>
                      </View>
                    </View>
                    <View style={styles.deliveryMeta}>
                      <View style={[styles.statusDot, { backgroundColor: getStatusColor(delivery.status) }]} />
                      <Text style={styles.etaText}>{delivery.eta}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Recent Activity */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <View style={styles.activityCard}>
              <View style={styles.activityItem}>
                <View style={[styles.activityIcon, { backgroundColor: '#000000' }]}>
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>Completed Delivery</Text>
                  <Text style={styles.activityTime}>2 hours ago</Text>
                </View>
              </View>
              <View style={styles.activityDivider} />
              <View style={styles.activityItem}>
                <View style={[styles.activityIcon, { backgroundColor: '#666666' }]}>
                  <Ionicons name="cube" size={16} color="#FFFFFF" />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>New Assignment</Text>
                  <Text style={styles.activityTime}>5 hours ago</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Bottom Spacing */}
          <View style={styles.bottomSpacing} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Core
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  safeArea: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  bottomSpacing: {
    height: 40,
  },

  // Header - Premium Black
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: '#706883',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  headerText: {
    marginLeft: 12,
  },
  greeting: {
    fontSize: 13,
    color: '#999999',
    fontWeight: '400',
    letterSpacing: 0.3,
  },
  driverName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusIndicatorMargin: {
    marginRight: 8,
  },
  statusIndicator: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: 0.5,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Live Indicator
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  liveText: {
    fontSize: 11,
    color: '#999999',
    fontWeight: '500',
    letterSpacing: 0.5,
  },

  // Stats Grid - Minimal B&W
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statBox: {
    width: '48%',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  statBoxBlack: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#333333',
  },
  statBoxGray: {
    backgroundColor: '#F5F5F5',
  },
  statBoxLight: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  statBoxBorder: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#000000',
  },
  statNumberWhite: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  statNumberDark: {
    fontSize: 32,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -1,
  },
  statLabelWhite: {
    fontSize: 12,
    color: '#999999',
    marginTop: 4,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  statLabelDark: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
    fontWeight: '500',
    letterSpacing: 0.5,
  },

  // Navigation Card
  navigationCard: {
    backgroundColor: '#000000',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#333333',
  },
  navigationContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navigationIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  navigationText: {
    flex: 1,
    marginLeft: 16,
  },
  navigationTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  navigationSubtitle: {
    fontSize: 13,
    color: '#999999',
    marginTop: 2,
  },

  // Section
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  seeAllText: {
    fontSize: 13,
    color: '#999999',
    fontWeight: '500',
  },

  // Empty State
  emptyCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
    letterSpacing: 0.3,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#666666',
    marginTop: 4,
  },

  // Delivery Items
  deliveryItem: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  deliveryItemFirst: {
    borderColor: '#FFFFFF',
    borderWidth: 1.5,
  },
  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deliveryMain: {
    flex: 1,
  },
  deliveryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  trackingNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#CCCCCC',
    marginBottom: 6,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addressText: {
    fontSize: 12,
    color: '#666666',
    flex: 1,
  },
  deliveryMeta: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 6,
  },
  etaText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999999',
  },

  // Activity
  activityCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityContent: {
    marginLeft: 12,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  activityTime: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  activityDivider: {
    height: 1,
    backgroundColor: '#333333',
    marginLeft: 48,
  },
});
