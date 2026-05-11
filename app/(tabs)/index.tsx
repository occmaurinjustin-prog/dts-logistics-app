import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
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
import ExpoGoMap from '../../components/ExpoGoMap';
import authService from '../../services/authService';

const { width } = Dimensions.get('window');

// API Configuration
const YOUR_COMPUTER_IP = '10.26.16.24';
const getApiBaseUrl = () => {
  if (Platform.OS === 'android') {
    return `http://${YOUR_COMPUTER_IP}:8000/api`;
  }
  return 'http://localhost:8000/api';
};
const API_BASE_URL = getApiBaseUrl();

// Types
interface Delivery {
  id: string;
  tracking_number: string;
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
  
  // Stable empty stops array for mini map (prevents re-render/reset)
  const miniMapStops = useMemo(() => [], []);

  // Fetch driver data
  const loadUserData = async () => {
    const user = await authService.getUserData();
    setUserData(user);
  };

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
        
        // Transform API data to match expected format
        const transformedDeliveries = response.data.deliveries.map((delivery: any) => ({
          id: delivery.id?.toString() || delivery.tracking_number,
          tracking_number: delivery.tracking_number,
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
    fetchAllDeliveries().then(() => setLoading(false));
  }, [fetchAllDeliveries]);

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
      <StatusBar barStyle="light-content" backgroundColor="#706883" />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e3e2fa" />
          }
        >
          {/* PREMIUM HEADER */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.avatarContainer}>
                <Text style={styles.avatarText}>
                  {(userData?.name || 'D').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.headerText}>
                <Text style={styles.driverName}>{userData?.name || 'Driver'}</Text>
                <Text style={styles.driverId}>ID: DRV-{userData?.id?.toString().padStart(4, '0') || '0001'}</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.notificationButton}>
                <Ionicons name="notifications-outline" size={22} color="#e3e2fa" />
                {activeDeliveries.length > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>{activeDeliveries.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.onlineToggle, { backgroundColor: isOnline ? '#3BC240' : '#3BC240' }]}
                onPress={() => setIsOnline(!isOnline)}
              >
                <Text style={styles.onlineToggleText}>{isOnline ? 'ONLINE' : 'OFFLINE'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* LIVE INDICATOR */}
          <View style={styles.liveIndicator}>
            <View style={styles.pulseDot} />
            <Text style={styles.liveText}>LIVE</Text>
            <View style={styles.liveDivider} />
            <Text style={styles.liveSubtext}>Updated {formatTimeAgo()}</Text>
            {!isOnline && (
              <>
                <View style={styles.liveDivider} />
                <Text style={styles.offlineText}>OFFLINE MODE</Text>
              </>
            )}
          </View>

          {/* LIVE DELIVERY STATUS CARD */}
          <View style={styles.statusSection}>
            <Text style={styles.sectionLabel}>CURRENT DELIVERY</Text>
            
            {!currentDelivery ? (
              <View style={styles.emptyStatusCard}>
                <View style={styles.emptyStatusIcon}>
                  <Ionicons name="cube-outline" size={32} color="#e3e2fa" />
                </View>
                <Text style={styles.emptyStatusTitle}>No Active Delivery</Text>
                <Text style={styles.emptyStatusSubtitle}>You're ready for the next assignment</Text>
                <TouchableOpacity style={styles.browseButton} onPress={navigateToDeliveries}>
                  <Text style={styles.browseButtonText}>Browse Deliveries</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.activeStatusCard}>
                <View style={styles.statusCardHeader}>
                  <View style={styles.trackingBadge}>
                    <Text style={styles.trackingBadgeText}>#{currentDelivery.tracking_number}</Text>
                  </View>
                  <View style={[styles.statusBadge, {
                    backgroundColor: currentDelivery.delivery_status === 'in_transit' ? '#7059BC' : '#453c59'
                  }]}>
                    <Text style={styles.statusBadgeText}>{getStatusLabel(currentDelivery.delivery_status)}</Text>
                  </View>
                </View>

                <View style={styles.deliveryContentRow}>
                  {/* LEFT: Route Info */}
                  <View style={styles.routeInfoContainer}>
                    <View style={styles.routeContainer}>
                      <View style={styles.routePoint}>
                        <View style={styles.routeDot}>
                          <View style={styles.routeDotInner} />
                        </View>
                        <View style={styles.routeLine} />
                        <View style={styles.routeInfo}>
                          <Text style={styles.routeLabel}>PICKUP</Text>
                          <Text style={styles.routeAddress} numberOfLines={1}>
                            {currentDelivery.pickup_address}
                          </Text>
                        </View>
                      </View>
                      
                      <View style={styles.routePoint}>
                        <View style={[styles.routeDot, { backgroundColor: '#3BC240' }]}>
                          <Ionicons name="location" size={12} color="#FFFFFF" />
                        </View>
                        <View style={styles.routeInfo}>
                          <Text style={styles.routeLabel}>DROPOFF</Text>
                          <Text style={styles.routeAddress} numberOfLines={1}>
                            {currentDelivery.delivery_address}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {currentDelivery.eta && (
                      <View style={styles.etaContainer}>
                        <Ionicons name="time-outline" size={16} color="#e3e2fa" />
                        <Text style={styles.etaText}>ETA {currentDelivery.eta}</Text>
                      </View>
                    )}
                  </View>

                  {/* RIGHT: Mini Leaflet Map - Half width */}
                  <View style={styles.miniMapHalfContainer}>
                    <ExpoGoMap
                      stops={miniMapStops}
                      currentLocation={currentLocation}
                      isNavigating={false}
                    />
                    <View style={styles.liveMapBadge}>
                      <View style={styles.liveMapPulse} />
                      <Text style={styles.liveMapText}>LIVE</Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity style={styles.actionButton} onPress={navigateToNavigation}>
                  <Text style={styles.actionButtonText}>
                    {currentDelivery.delivery_status === 'in_transit' ? 'Continue Delivery' : 'Start Delivery'}
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* QUICK ACTIONS ROW */}
          <View style={styles.quickActionsSection}>
            <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
            <View style={styles.actionsRow}>
              <ActionButton
                icon="map-outline"
                label="Routes"
                onPress={openRoutes}
              />
              <ActionButton
                icon="navigate-outline"
                label="Navigation"
                onPress={navigateToNavigation}
              />
              <ActionButton
                icon="cube-outline"
                label="Assigned"
                badge={activeDeliveries.length > 0 ? activeDeliveries.length : undefined}
                onPress={navigateToDeliveries}
              />
              <ActionButton
                icon="list-outline"
                label="Total"
                onPress={navigateToTotalDeliveries}
              />
            </View>
          </View>

          {/* ASSIGNED DELIVERIES */}
          {activeDeliveries.length > 0 && (
            <View style={styles.assignedSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>ASSIGNED ({activeDeliveries.length})</Text>
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
                    <Text style={styles.assignedTracking}>#{delivery.tracking_number}</Text>
                    <Text style={styles.assignedCustomer}>{delivery.customer}</Text>
                    <View style={styles.assignedMeta}>
                      <Ionicons name="location-outline" size={12} color="#e3e2fa" />
                      <Text style={styles.assignedAddress} numberOfLines={1}>
                        {delivery.delivery_address}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.assignedRight}>
                    <View style={[styles.assignedStatus, {
                      backgroundColor: delivery.delivery_status === 'in_transit' ? '#7059BC' : '#453c59'
                    }]}>
                      <Text style={[styles.assignedStatusText, {
                        color: '#e3e2fa'
                      }]}>
                        {delivery.delivery_status === 'in_transit' ? 'TRANSIT' : 'READY'}
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
            <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
            
            {completedDeliveries.length === 0 ? (
              <View style={styles.emptyHistory}>
                <Ionicons name="time-outline" size={24} color="#e3e2fa" />
                <Text style={styles.emptyHistoryText}>No completed deliveries yet</Text>
              </View>
            ) : (
              <View style={styles.timeline}>
                {completedDeliveries.slice(0, 5).map((delivery, index) => (
                  <View key={delivery.id} style={styles.timelineItem}>
                    <View style={styles.timelineLeft}>
                      <View style={[styles.timelineDot, index === 0 && styles.timelineDotRecent]} />
                      {index < completedDeliveries.slice(0, 5).length - 1 && (
                        <View style={styles.timelineLine} />
                      )}
                    </View>
                    <View style={styles.timelineContent}>
                      <View style={styles.timelineHeader}>
                        <Text style={styles.timelineTracking}>#{delivery.tracking_number}</Text>
                        <View style={styles.deliveredBadge}>
                          <Text style={styles.deliveredBadgeText}>DELIVERED</Text>
                        </View>
                      </View>
                      <Text style={styles.timelineCustomer}>{delivery.customer}</Text>
                      <View style={styles.timelineMeta}>
                        <Ionicons name="location-outline" size={12} color="#e3e2fa" />
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
  // Core
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#706883',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#e3e2fa',
    fontWeight: '500',
  },
  bottomSpacing: {
    height: 100,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f7f3f3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3BC240',
  },
  headerText: {
    marginLeft: 14,
  },
  driverName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3BC240',
    letterSpacing: -0.3,
  },
  driverId: {
    fontSize: 12,
    color: '#3BC240',
    marginTop: 2,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3BC240',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#3BC240',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  onlineToggle: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  onlineToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  // Live Indicator
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#07b413',
  },
  liveText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3BC240',
    letterSpacing: 1,
  },
  liveDivider: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e3e2fa',
  },
  liveSubtext: {
    fontSize: 12,
    color: '#070907',
    fontWeight: '500',
  },
  offlineText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF4444',
  },

  // Section Labels
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#070907',
    letterSpacing: 1.5,
    marginBottom: 12,
  },

  // Status Section
  statusSection: {
    marginBottom: 28,
  },
  
  // Empty Status Card
  emptyStatusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3BC240',
    borderStyle: 'dashed',
  },
  emptyStatusIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#3BC240',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyStatusTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#070907',
    marginBottom: 4,
  },
  emptyStatusSubtitle: {
    fontSize: 14,
    color: '#070907',
    marginBottom: 20,
  },
  browseButton: {
    backgroundColor: '#3BC240',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  browseButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Active Status Card
  activeStatusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#3BC240',
    shadowColor: '#3BC240',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  statusCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  
  // Delivery Content Row (Left: Info, Right: Map)
  deliveryContentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  routeInfoContainer: {
    flex: 1,
    minWidth: 0,
  },
  
  // Mini Map - Half of container width
  miniMapHalfContainer: {
    width: '48%',
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#3BC240',
  },
  miniMap: {
    width: '100%',
    height: '100%',
  },
  currentLocationMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentLocationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#007AFF',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  liveMapBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(47, 44, 61, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  liveMapPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3BC240',
  },
  liveMapText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#e3e2fa',
    letterSpacing: 0.5,
  },
  trackingBadge: {
    backgroundColor: '#3BC240',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  trackingBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  // Route
  routeContainer: {
    marginBottom: 16,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  routeDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3BC240',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  routeDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  routeLine: {
    position: 'absolute',
    left: 11,
    top: 24,
    width: 2,
    height: 24,
    backgroundColor: '#3BC240',
  },
  routeInfo: {
    flex: 1,
    paddingTop: 2,
  },
  routeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#070907',
    letterSpacing: 1,
    marginBottom: 2,
  },
  routeAddress: {
    fontSize: 15,
    fontWeight: '600',
    color: '#070907',
  },

  // ETA
  etaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3BC240',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  etaText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },

  // Action Button
  actionButton: {
    backgroundColor: '#3BC240',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Quick Actions
  quickActionsSection: {
    marginBottom: 28,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#3BC240',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#3BC240',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  actionCardPressed: {
    opacity: 0.6,
  },
  actionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#3BC240',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#070907',
    textAlign: 'center',
  },
  actionBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3BC240',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  actionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Assigned Section
  assignedSection: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#070907',
  },
  assignedCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#3BC240',
    shadowColor: '#3BC240',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  assignedCardFirst: {
    borderColor: '#3BC240',
    borderWidth: 2,
    shadowOpacity: 0.08,
  },
  assignedLeft: {
    flex: 1,
  },
  assignedTracking: {
    fontSize: 13,
    fontWeight: '700',
    color: '#070907',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  assignedCustomer: {
    fontSize: 15,
    fontWeight: '600',
    color: '#070907',
    marginBottom: 6,
  },
  assignedMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  assignedAddress: {
    fontSize: 13,
    color: '#070907',
    flex: 1,
  },
  assignedRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  assignedStatus: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 8,
  },
  assignedStatusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  assignedDistance: {
    fontSize: 13,
    fontWeight: '600',
    color: '#070907',
  },

  // History Section
  historySection: {
    marginBottom: 28,
  },
  emptyHistory: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    backgroundColor: '#f5f1f1',
    borderRadius: 16,
    gap: 8,
  },
  emptyHistoryText: {
    fontSize: 14,
    color: '#070907',
  },
  timeline: {
    backgroundColor: '#2F2C3D',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#7059BC',
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timelineLeft: {
    alignItems: 'center',
    marginRight: 14,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#453c59',
  },
  timelineDotRecent: {
    backgroundColor: '#7059BC',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#7059BC',
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    paddingTop: 2,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  timelineTracking: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e3e2fa',
  },
  deliveredBadge: {
    backgroundColor: '#453c59',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  deliveredBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7059BC',
    letterSpacing: 0.5,
  },
  timelineCustomer: {
    fontSize: 14,
    fontWeight: '500',
    color: '#e3e2fa',
    marginBottom: 4,
  },
  timelineMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  timelineAddress: {
    fontSize: 12,
    color: '#e3e2fa',
    flex: 1,
  },
  timelineTime: {
    fontSize: 12,
    color: '#e3e2fa',
    fontWeight: '500',
  },
});
