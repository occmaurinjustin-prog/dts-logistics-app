import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    Platform,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import ExpoGoMap from '../../components/ExpoGoMap';
import authService from '../../services/authService';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

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
  distance?: string;
  created_at?: string;
}

interface ActionButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  badge?: number;
  onPress: () => void;
}

function ActionButton({ icon, label, badge, onPress }: ActionButtonProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <TouchableOpacity
      style={[styles.actionCard, pressed && styles.actionCardPressed]}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      activeOpacity={1}
    >
      <View style={styles.actionIconContainer}>
        <Ionicons name={icon} size={22} color="#070907" />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
      {badge !== undefined && badge > 0 && (
        <View style={styles.actionBadge}>
          <Text style={styles.actionBadgeText}>{badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [recentDeliveries, setRecentDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isOnline, setIsOnline] = useState(true);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [driverStatus, setDriverStatus] = useState<any>(null);

  // Stable empty stops array for mini map (prevents re-render/reset)
  const miniMapStops = useMemo(() => [], []);

  // Fetch driver data
  const loadUserData = async () => {
    const user = await authService.getUserData();
    setUserData(user);
  };

  const fetchDriverStatus = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      const response = await axios.get(`${API_BASE_URL}/driver/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.data && response.data.success) {
        setDriverStatus(response.data);
      }
    } catch (error) {
      console.error('Error fetching driver status:', error);
    }
  }, []);

  // Fetch ALL deliveries from API (active + completed)
  const fetchAllDeliveries = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        console.log('No auth token found');
        return;
      }

      // Fetch all driver deliveries - same endpoint as deliveries.tsx
      const response = await axios.get(`${API_BASE_URL}/deliveries`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data && response.data.success && response.data.deliveries) {
        console.log('All deliveries fetched:', response.data.deliveries.length);
        
        setDeliveries(response.data.deliveries || []);
        
        // Transform API data to match expected format
        const transformedDeliveries = response.data.deliveries.map((delivery: any) => ({
          id: delivery.id?.toString() || delivery.waybill,
          waybill: delivery.waybill,
          status: delivery.delivery_status,
          pickup_address: delivery.pickup_address,
          delivery_address: delivery.delivery_address,
          customer: delivery.client?.client_name || delivery.customer || 'Unknown',
          item_description: delivery.item_description,
          priority: delivery.priority,
          eta: delivery.estimated_delivery_time,
          distance: delivery.distance,
          created_at: delivery.created_at,
          originalData: delivery,
        }));
        
        console.log('Statuses:', transformedDeliveries.map((d: Delivery) => d.status));
        
        // Split into active and completed
        const active = transformedDeliveries.filter((d: Delivery) => {
          const s = d.status?.toLowerCase().replace(/[_-]/g, '');
          return s === 'intransit' || s === 'assigned' || s === 'pending' || s === 'pickedup' || s === 'outfordelivery' || s === 'ready' || s === 'in transit';
        });
        const completed = transformedDeliveries.filter((d: Delivery) => {
          const s = d.status?.toLowerCase().replace(/[_-]/g, '');
          return s === 'delivered' || s === 'completed' || s === 'done' || s === 'finished' || s === 'success';
        });
        
        console.log('Active:', active.length, 'Completed:', completed.length);
        
        setDeliveries(active);
        setRecentDeliveries(completed);
        setLastUpdated(new Date());
        setSecondsAgo(0);
        setIsOnline(true);
      } else {
        console.log('API response format:', response.data);
      }
    } catch (error) {
      console.error('Error fetching deliveries:', error);
      setIsOnline(false);
    }
  }, []);

  // Initial load - fetch all deliveries
  useEffect(() => {
    loadUserData();
    fetchDriverStatus();
    fetchAllDeliveries().then(() => setLoading(false));
  }, [fetchAllDeliveries, fetchDriverStatus]);

  // Real-time polling every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAllDeliveries();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchAllDeliveries]);

  // Update seconds ago counter
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsAgo(prev => prev + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Track real-time location for mini map
  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    const startLocationTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      locationSubscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 20000, distanceInterval: 10 },
        (location) => {
          setCurrentLocation(location);
        }
      );
    };

    startLocationTracking();
    return () => locationSubscription?.remove();
  }, []);

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAllDeliveries();
    setRefreshing(false);
  }, [fetchAllDeliveries]);

  const handleLogout = async () => {
    await authService.logout();
    router.replace('/login');
  };

  const navigateToDeliveries = () => router.push('/deliveries');
  const navigateToNavigation = () => router.push('/navigation');
  const navigateToRoutes = () => router.push('/route');
  const navigateToProfile = () => router.push('/modal');
  const navigateToTotalDeliveries = () => router.push('/deliveries');
  
  // Routes function - opens routes with current delivery if available
  const openRoutes = () => {
    if (currentDelivery) {
      router.push({
        pathname: '/route',
        params: { 
          deliveryId: currentDelivery.id,
          pickup: currentDelivery.pickup_address,
          dropoff: currentDelivery.delivery_address 
        }
      });
    } else {
      router.push('/route');
    }
  };

  // Active deliveries already filtered from fetchAllDeliveries
  const activeDeliveries = deliveries;
  const currentDelivery = activeDeliveries[0];
  
  // Completed deliveries from fetchAllDeliveries
  const completedDeliveries = recentDeliveries;

  const getStatusLabel = (status: string) => {
    const s = status?.toLowerCase().replace('_', '').replace('-', '');
    switch (s) {
      case 'intransit': return 'In Transit';
      case 'assigned': return 'Assigned';
      case 'delivered': return 'Delivered';
      case 'completed': return 'Completed';
      case 'pending': return 'Pending';
      case 'pickedup': return 'Picked Up';
      default: return status || 'Pending';
    }
  };

  const formatTimeAgo = () => {
    if (secondsAgo < 5) return 'just now';
    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;
    return `${Math.floor(secondsAgo / 3600)}h ago`;
  };

  const baseUrl = API_BASE_URL.replace('/api', '');
  const profileImageUrl = userData?.profile_image 
    ? (userData.profile_image.startsWith('http') ? userData.profile_image : `${baseUrl}/storage/${userData.profile_image}`)
    : null;

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#e3e2fa" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* PREMIUM ENTERPRISE HEADER */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.avatarContainer, profileImageUrl ? { backgroundColor: 'transparent' } : {}]}>
              {profileImageUrl ? (
                <Image source={{ uri: profileImageUrl }} style={{ width: 48, height: 48, borderRadius: 24 }} />
              ) : (
                <Text style={styles.avatarText}>
                  {userData?.firstname ? userData.firstname.charAt(0).toUpperCase() : (userData?.name || 'D').charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
            <View style={styles.headerText}>
              <Text style={styles.driverName}>
                {userData?.firstname && userData?.lastname 
                  ? `${userData.firstname} ${userData.lastname}` 
                  : (userData?.name || 'Driver Partner')}
              </Text>
              <Text style={styles.driverId}>ID: DRV-{userData?.id?.toString().padStart(4, '0') || '0028'}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.notificationButton}>
              <Ionicons name="notifications-outline" size={20} color="#0F172A" />
              {activeDeliveries.length > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>{activeDeliveries.length}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.onlineToggle, { backgroundColor: isOnline ? '#10B981' : '#64748B' }]}
              onPress={() => setIsOnline(!isOnline)}
            >
              <View style={styles.onlineToggleRow}>
                <View style={[styles.statusDot, { backgroundColor: isOnline ? '#FFFFFF' : '#CBD5E1' }]} />
                <Text style={styles.onlineToggleText}>{isOnline ? 'ONLINE' : 'OFFLINE'}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3BC240" />
          }
        >

          {/* DYNAMIC DRIVE TARGET & PERFORMANCE STATS */}
          <View style={styles.statsSection}>
            <Text style={styles.sectionLabel}>TODAY'S DRIVE TARGET</Text>
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <View style={[styles.statIconWrapper, { backgroundColor: '#ECFDF5' }]}>
                  <Ionicons name="checkmark-done-circle" size={20} color="#10B981" />
                </View>
                <Text style={styles.statVal}>{completedDeliveries.length}</Text>
                <Text style={styles.statLbl}>Delivered</Text>
              </View>

              <View style={styles.statCard}>
                <View style={[styles.statIconWrapper, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="alert-circle" size={20} color="#EF4444" />
                </View>
                <Text style={styles.statVal}>{activeDeliveries.length}</Text>
                <Text style={styles.statLbl}>Remaining</Text>
              </View>

              <View style={styles.statCard}>
                <View style={[styles.statIconWrapper, { backgroundColor: '#EEF2FF' }]}>
                  <Ionicons name="trending-up" size={20} color="#6366F1" />
                </View>
                <Text style={styles.statVal}>
                  {completedDeliveries.length + activeDeliveries.length > 0
                    ? `${Math.round((completedDeliveries.length / (completedDeliveries.length + activeDeliveries.length)) * 100)}%`
                    : '100%'}
                </Text>
                <Text style={styles.statLbl}>Success Rate</Text>
              </View>
            </View>
          </View>

          {/* SPEEDOMETER & VEHICLE DRIVE HUB */}
          <View style={styles.speedSection}>
            <View style={styles.speedHeaderRow}>
              <Text style={styles.sectionLabel}>VIRTUAL DRIVE HUB</Text>
              <View style={styles.speedBadge}>
                <Ionicons name="car-sport" size={12} color="#10B981" />
                <Text style={styles.speedBadgeText}>Fleet Connected</Text>
              </View>
            </View>
            <View style={styles.speedHubCard}>
              <View style={styles.speedHubLeft}>
                <View style={styles.speedDial}>
                  <Text style={styles.speedNum}>{currentDelivery?.status === 'in_transit' ? '45' : '0'}</Text>
                  <Text style={styles.speedUnit}>KM/H</Text>
                </View>
                <View style={styles.speedLimitSign}>
                  <Text style={styles.speedLimitText}>60</Text>
                  <Text style={styles.speedLimitSub}>LIMIT</Text>
                </View>
              </View>
              <View style={styles.speedHubRight}>
                <View style={styles.hubInfoRow}>
                  <Ionicons name="barcode" size={16} color="#64748B" />
                  <View style={styles.hubInfoCol}>
                    <Text style={styles.hubInfoLabel}>TRUCK PLATE</Text>
                    <Text style={styles.hubInfoVal}>{userData?.driver?.truck?.plate_number || 'A12-3456'}</Text>
                  </View>
                </View>
                <View style={styles.hubDivider} />
                <View style={styles.hubInfoRow}>
                  <Ionicons name="speedometer-outline" size={16} color="#64748B" />
                  <View style={styles.hubInfoCol}>
                    <Text style={styles.hubInfoLabel}>TOTAL ODOMETER</Text>
                    <Text style={styles.hubInfoVal}>14,285 KM</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* LIVE DELIVERY STATUS CARD */}
          <View style={styles.statusSection}>
            <Text style={styles.sectionLabel}>CURRENT SHIPMENT</Text>
            
            {!currentDelivery ? (
              <View style={styles.emptyStatusCard}>
                <View style={styles.emptyStatusIcon}>
                  <Ionicons name="cube" size={28} color="#10B981" />
                </View>
                <Text style={styles.emptyStatusTitle}>All Shipments Completed</Text>
                <Text style={styles.emptyStatusSubtitle}>You are currently standby for new dispatch assignments</Text>
                <TouchableOpacity style={styles.browseButton} onPress={navigateToDeliveries}>
                  <Text style={styles.browseButtonText}>View Shipments</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.activeStatusCard}>
                <View style={styles.statusCardHeader}>
                  <View style={styles.trackingBadge}>
                    <Text style={styles.trackingBadgeText}>Waybill #{currentDelivery.waybill}</Text>
                  </View>
                  <View style={[styles.statusBadge, {
                    backgroundColor: currentDelivery.status === 'in_transit' ? '#FEE2E2' : '#EFF6FF'
                  }]}>
                    <Text style={[styles.statusBadgeText, {
                      color: currentDelivery.status === 'in_transit' ? '#EF4444' : '#3B82F6'
                    }]}>{getStatusLabel(currentDelivery.status).toUpperCase()}</Text>
                  </View>
                </View>

                <View style={styles.deliveryContentRow}>
                  {/* LEFT: Route Info */}
                  <View style={styles.routeInfoContainer}>
                    <View style={styles.routeContainer}>
                      <View style={styles.routePoint}>
                        <View style={[styles.routeDot, { backgroundColor: '#6366F1' }]}>
                          <View style={styles.routeDotInner} />
                        </View>
                        <View style={styles.routeLine} />
                        <View style={styles.routeInfo}>
                          <Text style={styles.routeLabel}>PICKUP POINT</Text>
                          <Text style={styles.routeAddress} numberOfLines={1}>
                            {currentDelivery.pickup_address}
                          </Text>
                        </View>
                      </View>
                      
                      <View style={styles.routePoint}>
                        <View style={[styles.routeDot, { backgroundColor: '#0F172A' }]}>
                          <Ionicons name="location" size={10} color="#FFFFFF" />
                        </View>
                        <View style={styles.routeInfo}>
                          <Text style={styles.routeLabel}>DELIVERY POINT</Text>
                          <Text style={styles.routeAddress} numberOfLines={1}>
                            {currentDelivery.delivery_address}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {currentDelivery.eta && (
                      <View style={styles.etaContainer}>
                        <Ionicons name="time" size={14} color="#6366F1" />
                        <Text style={styles.etaText}>ETA {currentDelivery.eta}</Text>
                      </View>
                    )}
                  </View>

                  {/* RIGHT: Mini Leaflet Map */}
                  <View style={styles.miniMapHalfContainer}>
                    <ExpoGoMap
                      stops={miniMapStops}
                      currentLocation={currentLocation}
                      isNavigating={false}
                    />
                    <View style={styles.liveMapBadge}>
                      <View style={styles.liveMapPulse} />
                      <Text style={styles.liveMapText}>MAP</Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity style={styles.actionButton} onPress={navigateToNavigation}>
                  <Text style={styles.actionButtonText}>
                    {currentDelivery.status === 'in_transit' ? 'Continue Navigation' : 'Commence Delivery'}
                  </Text>
                  <Ionicons name="chevron-forward-circle" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* QUICK ACTIONS ROW */}
          <View style={styles.quickActionsSection}>
            <Text style={styles.sectionLabel}>QUICK COMMANDS</Text>
            <View style={styles.actionsRow}>
              <ActionButton
                icon="map"
                label="Active Route"
                onPress={openRoutes}
              />
              <ActionButton
                icon="navigate"
                label="Nav Hub"
                onPress={navigateToNavigation}
              />
              <ActionButton
                icon="cube"
                label="Assigned"
                badge={activeDeliveries.length > 0 ? activeDeliveries.length : undefined}
                onPress={navigateToDeliveries}
              />
              <ActionButton
                icon="list"
                label="Shipments"
                onPress={navigateToTotalDeliveries}
              />
            </View>
          </View>

          {/* DRIVER STATS / RESCUES */}
          {driverStatus?.rescue_stats && (
            <View style={[styles.quickActionsSection, { marginTop: 12 }]}>
              <Text style={styles.sectionLabel}>EMERGENCY RESCUES</Text>
              <View style={styles.actionsRow}>
                <ActionButton
                  icon="warning"
                  label="Active Rescue"
                  badge={driverStatus.rescue_stats.active > 0 ? driverStatus.rescue_stats.active : undefined}
                  onPress={() => router.push('/rescue-request')}
                />
                <ActionButton
                  icon="time"
                  label="Rescue History"
                  badge={driverStatus.rescue_stats.completed > 0 ? driverStatus.rescue_stats.completed : undefined}
                  onPress={() => router.push('/rescue-history')}
                />
              </View>
            </View>
          )}

          {/* ASSIGNED DELIVERIES */}
          {activeDeliveries.length > 0 && (
            <View style={styles.assignedSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>ASSIGNED JOBS ({activeDeliveries.length})</Text>
                <TouchableOpacity onPress={navigateToDeliveries}>
                  <Text style={styles.seeAllText}>View All</Text>
                </TouchableOpacity>
              </View>
              
              {activeDeliveries.slice(0, 3).map((delivery, index) => (
                <TouchableOpacity 
                  key={delivery.id} 
                  style={[styles.assignedCard, index === 0 && styles.assignedCardFirst]}
                  onPress={navigateToNavigation}
                >
                  <View style={styles.assignedLeft}>
                    <Text style={styles.assignedTracking}>WAYBILL #{delivery.waybill}</Text>
                    <Text style={styles.assignedCustomer}>{delivery.customer}</Text>
                    <View style={styles.assignedMeta}>
                      <Ionicons name="location" size={13} color="#64748B" />
                      <Text style={styles.assignedAddress} numberOfLines={1}>
                        {delivery.delivery_address}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.assignedRight}>
                    <View style={[styles.assignedStatus, {
                      backgroundColor: delivery.status === 'in_transit' ? '#FEE2E2' : '#F1F5F9'
                    }]}>
                      <Text style={[styles.assignedStatusText, {
                        color: delivery.status === 'in_transit' ? '#EF4444' : '#64748B'
                      }]}>
                        {delivery.status === 'in_transit' ? 'TRANSIT' : 'READY'}
                      </Text>
                    </View>
                    {delivery.distance && (
                      <Text style={styles.assignedDistance}>{delivery.distance}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* RECENT ACTIVITY / HISTORY */}
          <View style={styles.historySection}>
            <Text style={styles.sectionLabel}>COMPLETED RUNS</Text>
            
            {completedDeliveries.length === 0 ? (
              <View style={styles.emptyHistory}>
                <Ionicons name="checkmark-done" size={20} color="#64748B" />
                <Text style={styles.emptyHistoryText}>No deliveries completed today</Text>
              </View>
            ) : (
              <View style={styles.timeline}>
                {completedDeliveries.slice(0, 5).map((delivery, index) => (
                  <View key={delivery.id} style={styles.timelineItem}>
                    <View style={styles.timelineLeft}>
                      <View style={styles.timelineDot} />
                      {index < completedDeliveries.slice(0, 5).length - 1 && (
                        <View style={styles.timelineLine} />
                      )}
                    </View>
                    <View style={styles.timelineContent}>
                      <View style={styles.timelineHeader}>
                        <Text style={styles.timelineTracking}>WAYBILL #{delivery.waybill}</Text>
                        <View style={styles.deliveredBadge}>
                          <Text style={styles.deliveredBadgeText}>COMPLETED</Text>
                        </View>
                      </View>
                      <Text style={styles.timelineCustomer}>{delivery.customer}</Text>
                      <View style={styles.timelineMeta}>
                        <Ionicons name="location" size={13} color="#64748B" />
                        <Text style={styles.timelineAddress} numberOfLines={1}>
                          {delivery.delivery_address}
                        </Text>
                      </View>
                      <Text style={styles.timelineTime}>
                        {delivery.created_at ? new Date(delivery.created_at).toLocaleDateString() : 'Today'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Bottom Spacing */}
          <View style={styles.bottomSpacing} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Core layout
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#64748B',
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 40,
  },

  // Header styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: '#F8FAFC',
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerText: {
    marginLeft: 12,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  driverId: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
    marginTop: 1,
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  onlineToggle: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  onlineToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  onlineToggleText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  // Daily target section
  statsSection: {
    marginBottom: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  statIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  statLbl: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },

  // Speedometer hub
  speedSection: {
    marginBottom: 24,
  },
  speedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  speedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  speedBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#10B981',
  },
  speedHubCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  speedHubLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRightWidth: 1,
    borderRightColor: '#F1F5F9',
    paddingRight: 16,
  },
  speedDial: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  speedNum: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  speedUnit: {
    fontSize: 8,
    fontWeight: '700',
    color: '#64748B',
  },
  speedLimitSign: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#EF4444',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  speedLimitText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
    lineHeight: 14,
  },
  speedLimitSub: {
    fontSize: 6,
    fontWeight: '800',
    color: '#64748B',
  },
  speedHubRight: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: 16,
    gap: 12,
  },
  hubInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hubInfoCol: {
    flex: 1,
  },
  hubInfoLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  hubInfoVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  hubDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },

  // Section labels
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1.5,
    marginBottom: 8,
  },

  // Status section & empty states
  statusSection: {
    marginBottom: 24,
  },
  emptyStatusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
  },
  emptyStatusIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyStatusTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  emptyStatusSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  browseButton: {
    backgroundColor: '#DDE9E3',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  browseButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Active status card
  activeStatusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statusCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  trackingBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  trackingBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  deliveryContentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    marginBottom: 16,
    gap: 12,
  },
  routeInfoContainer: {
    flex: 1.1,
    minWidth: 0,
    justifyContent: 'space-between',
  },
  routeContainer: {
    marginBottom: 8,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  routeDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  routeDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  routeLine: {
    position: 'absolute',
    left: 9,
    top: 20,
    width: 2,
    height: 20,
    backgroundColor: '#E2E8F0',
  },
  routeInfo: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 1,
  },
  routeAddress: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  etaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    gap: 6,
  },
  etaText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6366F1',
  },
  miniMapHalfContainer: {
    flex: 0.9,
    height: 115,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  liveMapBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 3,
  },
  liveMapPulse: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#0F172A',
  },
  liveMapText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  actionButton: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Action cards
  quickActionsSection: {
    marginBottom: 24,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  actionCardPressed: {
    opacity: 0.7,
  },
  actionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'center',
  },
  actionBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  actionBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Assigned jobs list
  assignedSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
  },
  assignedCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  assignedCardFirst: {
    borderColor: '#10B981',
    borderWidth: 1.5,
  },
  assignedLeft: {
    flex: 1,
  },
  assignedTracking: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 3,
  },
  assignedCustomer: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  assignedMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  assignedAddress: {
    fontSize: 12,
    color: '#64748B',
    flex: 1,
  },
  assignedRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  assignedStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  assignedStatusText: {
    fontSize: 9,
    fontWeight: '800',
  },
  assignedDistance: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },

  // History timeline
  historySection: {
    marginBottom: 24,
  },
  emptyHistory: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  emptyHistoryText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  timeline: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineLeft: {
    alignItems: 'center',
    marginRight: 12,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0F172A',
    marginTop: 4,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#F1F5F9',
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  timelineTracking: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
  deliveredBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  deliveredBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#10B981',
  },
  timelineCustomer: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  timelineMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  timelineAddress: {
    fontSize: 12,
    color: '#64748B',
    flex: 1,
  },
  timelineTime: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
});
