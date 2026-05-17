import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Modal,
    Platform,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// API URL - same as deliveries
const API_BASE_URL = Platform.OS === 'web' 
  ? 'http://localhost:8000/api'
  : 'http://10.26.16.24:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface Stop {
  id: number;
  sequence: number;
  type: 'pickup' | 'delivery';
  address: string;
  delivery_address: string;
  customer: string;
  contact: string;
  status: string;
  estimated_arrival: string;
  weight: string;
  tracking_number: string;
  notes?: string;
}

interface Route {
  id: string;
  name: string;
  date: string;
  total_stops: number;
  completed_stops: number;
  in_progress: number;
  status: string;
  estimated_time: string;
  total_distance: string;
  start_address: string;
  end_address: string;
  stops: Stop[];
}

// Transform delivery data into route stops
const transformDeliveriesToRoute = (deliveries: any[]): Route | null => {
  if (!deliveries || deliveries.length === 0) return null;

  // Filter only assigned/in_transit deliveries for active route
  const activeDeliveries = deliveries.filter(d =>
    d.delivery_status === 'Assigned' || d.delivery_status === 'In Transit' ||
    d.delivery_status === 'assigned' || d.delivery_status === 'in_transit'
  );

  if (activeDeliveries.length === 0) return null;

  // Create stops from deliveries (pickup + delivery for each)
  const stops: Stop[] = [];
  let stopId = 1;

  activeDeliveries.forEach((delivery, index) => {
    // Use navigation_phase from API (fallback to status check for backwards compatibility)
    const navPhase = delivery.navigation_phase || (delivery.delivery_status === 'in_transit' ? 'delivery' : 'pickup');
    const pickupCompleted = navPhase === 'delivery' || delivery.delivery_status === 'delivered';
    
    // Add pickup stop
    if (delivery.pickup_address) {
      stops.push({
        id: stopId++,
        sequence: stopId - 1,
        type: 'pickup',
        address: delivery.pickup_address,
        delivery_address: delivery.pickup_address,
        customer: delivery.client_name || delivery.customer || delivery.requested_by || `Delivery ${index + 1}`,
        contact: delivery.contact || '+63 912 345 6789',
        status: pickupCompleted ? 'completed' : 'pending',
        estimated_arrival: delivery.eta || new Date(Date.now() + index * 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        weight: delivery.weight || `${delivery.weight_tons} tons`,
        tracking_number: delivery.tracking_number || `DEL${String(index + 1).padStart(3, '0')}`,
        notes: `Pick up: ${delivery.item_description || 'Items'}`,
      });
    }

    // Add delivery stop
    if (delivery.delivery_address || delivery.address) {
      stops.push({
        id: stopId++,
        sequence: stopId - 1,
        type: 'delivery',
        address: delivery.delivery_address || delivery.address,
        delivery_address: delivery.delivery_address || delivery.address,
        customer: delivery.client_name || delivery.customer || delivery.requested_by || `Delivery ${index + 1}`,
        contact: delivery.contact || '+63 923 456 7890',
        status: delivery.delivery_status === 'delivered' ? 'completed' : (pickupCompleted && index === 0 ? 'in_progress' : 'pending'),
        estimated_arrival: delivery.eta || new Date(Date.now() + (index + 1) * 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        weight: delivery.weight || `${delivery.weight_tons} tons`,
        tracking_number: delivery.tracking_number || `DEL${String(index + 1).padStart(3, '0')}`,
        notes: delivery.notes || `Deliver to: ${delivery.delivery_address || delivery.address}`,
      });
    }
  });

  // Calculate total estimated time based on number of stops
  const totalMinutes = stops.length * 45; // 45 min per stop estimate
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const estimatedTime = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  // Estimate distance (rough calculation)
  const estimatedDistance = `${(stops.length * 12.5).toFixed(1)} km`;

  const completedStops = stops.filter(s => s.status === 'completed').length;

  return {
    id: `route-${new Date().toISOString().split('T')[0]}`,
    name: `Today's Delivery Route`,
    date: new Date().toISOString().split('T')[0],
    total_stops: stops.length,
    completed_stops: completedStops,
    in_progress: stops.filter(s => s.status === 'in_progress').length,
    status: completedStops === stops.length ? 'completed' : 'active',
    estimated_time: estimatedTime,
    total_distance: estimatedDistance,
    start_address: stops[0]?.address || 'Starting Point',
    end_address: stops[stops.length - 1]?.address || 'Final Destination',
    stops: stops,
  };
};

export default function RouteScreen() {
  const router = useRouter();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<string>('');
  const [activeStop, setActiveStop] = useState<number>(0);
  const [showFullMap, setShowFullMap] = useState(false);

  const fetchRoutes = useCallback(async () => {
    console.log('Fetching routes...');
    try {
      setRefreshing(true);
      // Fetch real deliveries from API
      const response = await api.get('/deliveries');
      console.log('Routes fetched:', response.data.success, response.data.deliveries?.length || 0, 'deliveries');
      
      if (response.data.success && response.data.deliveries?.length > 0) {
        const route = transformDeliveriesToRoute(response.data.deliveries);
        if (route) {
          setRoutes([route]);
          setSelectedRoute(route.id);
          // Set active stop to first non-completed stop
          const firstPending = route.stops.findIndex(s => s.status === 'pending' || s.status === 'in_progress');
          setActiveStop(firstPending >= 0 ? firstPending : 0);
        } else {
          setRoutes([]);
        }
      } else {
        setRoutes([]);
      }
    } catch (error) {
      console.error('Error fetching deliveries:', error);
      setRoutes([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  const onRefresh = useCallback(() => {
    console.log('Pull-to-refresh triggered on route screen');
    fetchRoutes();
  }, [fetchRoutes]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#10B981';
      case 'in_transit':
      case 'in_progress':
        return '#F59E0B';
      case 'active':
        return '#3B82F6';
      case 'pending':
        return '#6B7280';
      default:
        return '#6B7280';
    }
  };

  const getStopIcon = (type: string, status: string, index: number) => {
    if (status === 'completed') {
      return <Ionicons name="checkmark-circle" size={24} color="#10B981" />;
    }
    if (type === 'pickup') {
      return <Ionicons name="arrow-up-circle" size={24} color="#3B82F6" />;
    }
    return <Ionicons name="location" size={24} color={index === activeStop ? '#F59E0B' : '#6B7280'} />;
  };

  const selectedRouteData = routes.find(r => r.id === selectedRoute);

  const renderStop = (stop: Stop, index: number, totalStops: number) => {
    const isActive = index === activeStop;
    const isCompleted = stop.status === 'completed';
    const isLast = index === totalStops - 1;

    return (
      <View key={stop.id} style={styles.stopItem}>
        {/* Timeline Line */}
        <View style={styles.timelineContainer}>
          <View style={[
            styles.timelineDot,
            isCompleted && styles.timelineDotCompleted,
            isActive && styles.timelineDotActive,
          ]}>
            <Text style={[
              styles.timelineNumber,
              (isCompleted || isActive) && styles.timelineNumberActive,
            ]}>
              {index + 1}
            </Text>
          </View>
          {!isLast && (
            <View style={[
              styles.timelineLine,
              isCompleted && styles.timelineLineCompleted,
            ]} />
          )}
        </View>

        {/* Stop Card */}
        <View style={[
          styles.stopCard,
          isActive && styles.stopCardActive,
          isCompleted && styles.stopCardCompleted,
        ]}>
          {/* Stop Header */}
          <View style={styles.stopHeader}>
            <View style={styles.stopTypeContainer}>
              <View style={[
                styles.stopTypeBadge,
                stop.type === 'pickup' ? styles.pickupBadge : styles.deliveryBadge,
              ]}>
                <Ionicons 
                  name={stop.type === 'pickup' ? 'arrow-up' : 'arrow-down'} 
                  size={12} 
                  color="#FFFFFF" 
                />
                <Text style={styles.stopTypeText}>
                  {stop.type === 'pickup' ? 'PICKUP' : 'DELIVERY'}
                </Text>
              </View>
              <Text style={styles.stopTime}>{stop.estimated_arrival}</Text>
            </View>
            {isActive && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>CURRENT</Text>
              </View>
            )}
          </View>

          {/* Customer Info */}
          <Text style={styles.stopCustomer}>{stop.customer}</Text>
          
          {/* Address */}
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={16} color="#6B7280" />
            <Text style={styles.stopAddress} numberOfLines={2}>
              {stop.type === 'pickup' ? stop.address : stop.delivery_address}
            </Text>
          </View>

          {/* Contact */}
          <View style={styles.contactRow}>
            <Ionicons name="call-outline" size={14} color="#6B7280" />
            <Text style={styles.stopContact}>{stop.contact}</Text>
          </View>

          {/* Weight & Tracking */}
          <View style={styles.stopMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="cube-outline" size={14} color="#6B7280" />
              <Text style={styles.metaText}>{stop.weight}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="barcode-outline" size={14} color="#6B7280" />
              <Text style={styles.metaText}>#{stop.tracking_number}</Text>
            </View>
          </View>

          {/* Notes */}
          {stop.notes && (
            <View style={styles.notesContainer}>
              <Ionicons name="information-circle-outline" size={14} color="#F59E0B" />
              <Text style={styles.notesText}>{stop.notes}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  // Show loading state
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading route...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show empty state if no route
  if (!selectedRouteData || routes.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.headerTitle}>Routes</Text>
              <Text style={styles.headerSubtitle}>No active deliveries</Text>
            </View>
          </View>
        </View>
        <ScrollView 
          style={styles.scrollView}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3B82F6']} tintColor="#3B82F6" />}
          contentContainerStyle={styles.emptyScrollContent}
        >
          <View style={styles.emptyContainer}>
            <Ionicons name="map-outline" size={80} color="#3BC240" />
            <Text style={styles.emptyTitle}>No Active Route</Text>
            <Text style={styles.emptyText}>
              You don't have any assigned deliveries yet.{'\n'}
              Check the Deliveries tab for pending assignments.
            </Text>
            <TouchableOpacity 
              style={styles.emptyActionButton}
              onPress={() => router.push('/deliveries')}
            >
              <Text style={styles.emptyActionText}>Go to Deliveries</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Routes</Text>
            <Text style={styles.headerSubtitle}>{selectedRouteData?.name || 'Today\'s Route'}</Text>
          </View>
          <TouchableOpacity style={styles.mapButton} onPress={() => router.push('/navigation')}>
            <Ionicons name="map-outline" size={20} color="#FFFFFF" />
            <Text style={styles.mapButtonText}>Map</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3B82F6']} tintColor="#3B82F6" />}
      >
        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Ionicons name="navigate-circle" size={32} color="#3B82F6" />
            <View style={styles.summaryTitleContainer}>
              <Text style={styles.summaryTitle}>Route Summary</Text>
              <Text style={styles.summaryDate}>{selectedRouteData?.date}</Text>
            </View>
          </View>

          <View style={styles.summaryStats}>
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="cube" size={20} color="#3B82F6" />
              </View>
              <Text style={styles.statValue}>{selectedRouteData?.total_stops || 0}</Text>
              <Text style={styles.statLabel}>Stops</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="time" size={20} color="#F59E0B" />
              </View>
              <Text style={styles.statValue}>{selectedRouteData?.estimated_time || '0m'}</Text>
              <Text style={styles.statLabel}>Est. Time</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="speedometer" size={20} color="#10B981" />
              </View>
              <Text style={styles.statValue}>{selectedRouteData?.total_distance || '0 km'}</Text>
              <Text style={styles.statLabel}>Distance</Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressText}>Progress</Text>
              <Text style={styles.progressPercent}>
                {selectedRouteData?.total_stops 
                  ? Math.round(((selectedRouteData?.completed_stops || 0) / selectedRouteData.total_stops) * 100)
                  : 0}%
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill,
                  { width: `${selectedRouteData?.total_stops 
                    ? ((selectedRouteData?.completed_stops || 0) / selectedRouteData.total_stops) * 100 
                    : 0}%` }
                ]} 
              />
            </View>
          </View>
        </View>

        {/* Stops Section */}
        <View style={styles.stopsSection}>
          <View style={styles.stopsHeader}>
            <Text style={styles.stopsTitle}>Delivery Stops</Text>
            <Text style={styles.stopsCount}>{selectedRouteData?.stops?.length || 0} stops</Text>
          </View>

          <View style={styles.stopsList}>
            {selectedRouteData?.stops?.map((stop, index) => 
              renderStop(stop, index, selectedRouteData?.stops?.length || 0)
            )}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity 
            style={styles.primaryActionButton}
            onPress={() => router.push('/navigation')}
          >
            <Ionicons name="navigate" size={24} color="#FFFFFF" />
            <Text style={styles.primaryActionText}>Start Navigation</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.secondaryActionButton}
            onPress={() => setShowFullMap(true)}
          >
            <Ionicons name="map-outline" size={20} color="#3BC240" />
            <Text style={styles.secondaryActionText}>View Full Map</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Fullscreen Map Modal */}
      <Modal
        visible={showFullMap}
        animationType="slide"
        onRequestClose={() => setShowFullMap(false)}
      >
        <View style={styles.fullscreenMapContainer}>
          {/* Modal Header */}
          <View style={styles.fullscreenMapHeader}>
            <TouchableOpacity onPress={() => setShowFullMap(false)} style={styles.closeMapButton}>
              <Ionicons name="close" size={28} color="#e3e2fa" />
            </TouchableOpacity>
            <Text style={styles.fullscreenMapTitle}>Route Map</Text>
            <View style={{ width: 44 }} />
          </View>

          {/* Simple Map Placeholder - Shows stops list as map view */}
          <ScrollView style={styles.fullscreenMapContent}>
            <View style={styles.mapLegend}>
              <View style={styles.mapLegendItem}>
                <View style={[styles.mapLegendDot, { backgroundColor: '#7059BC' }]} />
                <Text style={styles.mapLegendText}>Pickup</Text>
              </View>
              <View style={styles.mapLegendItem}>
                <View style={[styles.mapLegendDot, { backgroundColor: '#e3e2fa' }]} />
                <Text style={styles.mapLegendText}>Delivery</Text>
              </View>
              <View style={styles.mapLegendItem}>
                <View style={[styles.mapLegendDot, { backgroundColor: '#453c59' }]} />
                <Text style={styles.mapLegendText}>Completed</Text>
              </View>
            </View>

            {/* Stops List in Map Order */}
            <View style={styles.mapStopsList}>
              {selectedRouteData?.stops?.map((stop, index) => (
                <View key={stop.id} style={styles.mapStopItem}>
                  <View style={[
                    styles.mapStopNumber,
                    stop.status === 'completed' && { backgroundColor: '#453c59' },
                    stop.type === 'pickup' && { backgroundColor: '#7059BC' },
                    stop.type === 'delivery' && { backgroundColor: '#e3e2fa' },
                  ]}>
                    <Text style={[
                      styles.mapStopNumberText,
                      stop.type === 'delivery' && { color: '#2F2C3D' },
                    ]}>{index + 1}</Text>
                  </View>
                  <View style={styles.mapStopContent}>
                    <Text style={styles.mapStopType}>{stop.type.toUpperCase()}</Text>
                    <Text style={styles.mapStopCustomer}>{stop.customer}</Text>
                    <Text style={styles.mapStopAddress}>{stop.address}</Text>
                  </View>
                  <Ionicons 
                    name={stop.status === 'completed' ? 'checkmark-circle' : 'location'} 
                    size={24} 
                    color={stop.status === 'completed' ? '#453c59' : '#7059BC'} 
                  />
                </View>
              ))}
            </View>

            {/* Navigate Button */}
            <TouchableOpacity 
              style={styles.fullscreenNavigateButton}
              onPress={() => {
                setShowFullMap(false);
                router.push('/navigation');
              }}
            >
              <Ionicons name="navigate" size={24} color="#e3e2fa" />
              <Text style={styles.fullscreenNavigateText}>Start Navigation</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#070907',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#070907',
    fontWeight: '500',
  },

  // Header
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3BC240',
    shadowColor: '#3BC240',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#070907',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#070907',
    marginTop: 4,
    fontWeight: '500',
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    shadowColor: '#070907',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  mapButtonText: {
    color: '#070907',
    fontSize: 14,
    fontWeight: '700',
  },

  scrollView: {
    flex: 1,
  },

  // Summary Card
  summaryCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#3BC240',
    shadowColor: '#3BC240',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  summaryTitleContainer: {
    marginLeft: 12,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#070907',
  },
  summaryDate: {
    fontSize: 14,
    color: '#070907',
    marginTop: 2,
    fontWeight: '500',
  },

  // Stats
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#070907',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#070907',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 50,
    backgroundColor: '#070907',
  },

  // Progress
  progressContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#070907',
  },
  progressPercent: {
    fontSize: 16,
    fontWeight: '800',
    color: '#070907',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3BC240',
    borderRadius: 4,
  },

  // Stops Section
  stopsSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  stopsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  stopsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#070907',
  },
  stopsCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#070907',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3BC240',
  },
  stopsList: {
    gap: 0,
  },

  // Stop Item
  stopItem: {
    flexDirection: 'row',
  },
  timelineContainer: {
    alignItems: 'center',
    width: 40,
    marginRight: 12,
  },
  timelineDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#3BC240',
    shadowColor: '#3BC240',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  timelineDotActive: {
    backgroundColor: '#FFFFFF',
  },
  timelineDotCompleted: {
    backgroundColor: '#FFFFFF',
  },
  timelineNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: '#070907',
  },
  timelineNumberActive: {
    color: '#070907',
  },
  timelineLine: {
    width: 3,
    flex: 1,
    backgroundColor: '#3BC240',
    marginTop: -4,
  },
  timelineLineCompleted: {
    backgroundColor: '#3BC240',
  },

  // Stop Card
  stopCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#3BC240',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#3BC240',
  },
  stopCardActive: {
    borderColor: '#3BC240',
    borderWidth: 2,
    shadowColor: '#3BC240',
    shadowOpacity: 0.15,
  },
  stopCardCompleted: {
    borderColor: '#453c59',
    opacity: 0.8,
  },
  stopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stopTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stopTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  pickupBadge: {
    backgroundColor: '#3BC240',
  },
  deliveryBadge: {
    backgroundColor: '#3BC240',
  },
  stopTypeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  stopTime: {
    fontSize: 13,
    fontWeight: '600',
    color: '#070907',
  },
  activeBadge: {
    backgroundColor: '#070907',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  stopCustomer: {
    fontSize: 17,
    fontWeight: '700',
    color: '#070907',
    marginBottom: 8,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  stopAddress: {
    flex: 1,
    fontSize: 14,
    color: '#070907',
    lineHeight: 20,
    fontWeight: '500',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  stopContact: {
    fontSize: 13,
    color: '#070907',
    fontWeight: '500',
  },
  stopMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    color: '#070907',
    fontWeight: '600',
  },
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#3BC240',
  },
  notesText: {
    flex: 1,
    fontSize: 12,
    color: '#070907',
    fontWeight: '500',
    lineHeight: 18,
  },

  // Action Buttons
  actionContainer: {
    padding: 16,
    gap: 12,
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3BC240',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
    shadowColor: '#3BC240',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  secondaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    borderWidth: 2,
    borderColor: '#3BC240',
    shadowColor: '#3BC240',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  secondaryActionText: {
    color: '#3BC240',
    fontSize: 15,
    fontWeight: '700',
  },
  bottomSpacing: {
    height: 100,
  },

  // Empty State Styles
  emptyScrollContent: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#070907',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#070907',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyActionButton: {
    backgroundColor: '#3BC240',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#3BC240',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  emptyActionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Fullscreen Map Modal Styles
  fullscreenMapContainer: {
    flex: 1,
    backgroundColor: '#2F2C3D',
  },
  fullscreenMapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#2F2C3D',
    borderBottomWidth: 1,
    borderBottomColor: '#7059BC',
  },
  closeMapButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#453c59',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenMapTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#e3e2fa',
  },
  fullscreenMapContent: {
    flex: 1,
    backgroundColor: '#2F2C3D',
    padding: 20,
  },
  mapLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 24,
    paddingVertical: 16,
    backgroundColor: '#453c59',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#7059BC',
  },
  mapLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mapLegendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  mapLegendText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e3e2fa',
  },
  mapStopsList: {
    gap: 12,
    marginBottom: 24,
  },
  mapStopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#453c59',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#7059BC',
  },
  mapStopNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7059BC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  mapStopNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e3e2fa',
  },
  mapStopContent: {
    flex: 1,
  },
  mapStopType: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7059BC',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mapStopCustomer: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e3e2fa',
    marginBottom: 4,
  },
  mapStopAddress: {
    fontSize: 13,
    color: '#e3e2fa',
    lineHeight: 18,
  },
  fullscreenNavigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3BC240',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
    marginBottom: 40,
    shadowColor: '#3BC240',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  fullscreenNavigateText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
