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
  ? 'https://consult-powwow-vexingly.ngrok-free.dev/api'
  : 'https://consult-powwow-vexingly.ngrok-free.dev/api';

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
  waybill: string;
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
        waybill: delivery.waybill || `DEL${String(index + 1).padStart(3, '0')}`,
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
        waybill: delivery.waybill || `DEL${String(index + 1).padStart(3, '0')}`,
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
      return <Ionicons name="checkmark-circle" size={20} color="#10B981" />;
    }
    if (type === 'pickup') {
      return <Ionicons name="arrow-up-circle" size={20} color="#3B82F6" />;
    }
    return <Ionicons name="location" size={20} color={index === activeStop ? '#EF4444' : '#64748B'} />;
  };

  const selectedRouteData = routes.find(r => r.id === selectedRoute);

  const renderStop = (stop: Stop, index: number, totalStops: number) => {
    const isActive = index === activeStop;
    const isCompleted = stop.status === 'completed';
    const isLast = index === totalStops - 1;

    // Soft palette color scheme
    const themeColor = stop.type === 'pickup' ? '#2563EB' : '#059669';
    const badgeBg = stop.type === 'pickup' ? '#EFF6FF' : '#ECFDF5';

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
              isCompleted && { color: '#10B981' }
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
                  size={10} 
                  color={themeColor} 
                />
                <Text style={[styles.stopTypeText, { color: themeColor }]}>
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
            <Ionicons name="location-outline" size={14} color="#64748B" />
            <Text style={styles.stopAddress} numberOfLines={2}>
              {stop.type === 'pickup' ? stop.address : stop.delivery_address}
            </Text>
          </View>

          {/* Contact */}
          <View style={styles.contactRow}>
            <Ionicons name="call-outline" size={12} color="#64748B" />
            <Text style={styles.stopContact}>{stop.contact}</Text>
          </View>

          {/* Weight & Tracking */}
          <View style={styles.stopMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="cube-outline" size={12} color="#64748B" />
              <Text style={styles.metaText}>{stop.weight}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="barcode-outline" size={12} color="#64748B" />
              <Text style={styles.metaText}>#{stop.waybill}</Text>
            </View>
          </View>

          {/* Notes */}
          {stop.notes && (
            <View style={styles.notesContainer}>
              <Ionicons name="information-circle-outline" size={12} color="#F59E0B" />
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
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Synchronizing route...</Text>
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />}
          contentContainerStyle={styles.emptyScrollContent}
        >
          <View style={styles.emptyContainer}>
            <Ionicons name="map-outline" size={60} color="#94A3B8" />
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
            <Text style={styles.headerTitle}>Today's Route</Text>
            <Text style={styles.headerSubtitle}>{selectedRouteData?.name || 'Active Dispatch Stop List'}</Text>
          </View>
          <TouchableOpacity style={styles.mapButton} onPress={() => router.push('/navigation')}>
            <Ionicons name="map-outline" size={16} color="#FFFFFF" />
            <Text style={styles.mapButtonText}>Map HUD</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />}
      >
        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Ionicons name="navigate-circle" size={28} color="#10B981" />
            <View style={styles.summaryTitleContainer}>
              <Text style={styles.summaryTitle}>Route Dispatch Summary</Text>
              <Text style={styles.summaryDate}>{selectedRouteData?.date}</Text>
            </View>
          </View>

          <View style={styles.summaryStats}>
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="cube" size={16} color="#3B82F6" />
              </View>
              <Text style={styles.statValue}>{selectedRouteData?.total_stops || 0}</Text>
              <Text style={styles.statLabel}>Stops</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="time" size={16} color="#F59E0B" />
              </View>
              <Text style={styles.statValue}>{selectedRouteData?.estimated_time || '0m'}</Text>
              <Text style={styles.statLabel}>Est. Time</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="speedometer" size={16} color="#10B981" />
              </View>
              <Text style={styles.statValue}>{selectedRouteData?.total_distance || '0 km'}</Text>
              <Text style={styles.statLabel}>Distance</Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressText}>Route Completion Progress</Text>
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
            <Text style={styles.stopsTitle}>Route Stops List</Text>
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
            <Ionicons name="navigate" size={18} color="#FFFFFF" />
            <Text style={styles.primaryActionText}>Start Live Navigation</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.secondaryActionButton}
            onPress={() => setShowFullMap(true)}
          >
            <Ionicons name="map-outline" size={16} color="#0F172A" />
            <Text style={styles.secondaryActionText}>View Full Route Stops</Text>
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
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
            <Text style={styles.fullscreenMapTitle}>Route Stops Index</Text>
            <View style={{ width: 36 }} />
          </View>

          {/* Simple Map Placeholder - Shows stops list as map view */}
          <ScrollView style={styles.fullscreenMapContent}>
            <View style={styles.mapLegend}>
              <View style={styles.mapLegendItem}>
                <View style={[styles.mapLegendDot, { backgroundColor: '#3B82F6' }]} />
                <Text style={styles.mapLegendText}>Pickup Stop</Text>
              </View>
              <View style={styles.mapLegendItem}>
                <View style={[styles.mapLegendDot, { backgroundColor: '#10B981' }]} />
                <Text style={styles.mapLegendText}>Delivery Drop</Text>
              </View>
              <View style={styles.mapLegendItem}>
                <View style={[styles.mapLegendDot, { backgroundColor: '#94A3B8' }]} />
                <Text style={styles.mapLegendText}>Completed</Text>
              </View>
            </View>

            {/* Stops List in Map Order */}
            <View style={styles.mapStopsList}>
              {selectedRouteData?.stops?.map((stop, index) => (
                <View key={stop.id} style={styles.mapStopItem}>
                  <View style={[
                    styles.mapStopNumber,
                    stop.status === 'completed' && { backgroundColor: '#F1F5F9' },
                    stop.status !== 'completed' && stop.type === 'pickup' && { backgroundColor: '#EFF6FF' },
                    stop.status !== 'completed' && stop.type === 'delivery' && { backgroundColor: '#ECFDF5' },
                  ]}>
                    <Text style={[
                      styles.mapStopNumberText,
                      stop.status === 'completed' && { color: '#94A3B8' },
                      stop.status !== 'completed' && stop.type === 'pickup' && { color: '#2563EB' },
                      stop.status !== 'completed' && stop.type === 'delivery' && { color: '#047857' },
                    ]}>{index + 1}</Text>
                  </View>
                  <View style={styles.mapStopContent}>
                    <Text style={[
                      styles.mapStopType,
                      stop.type === 'pickup' ? { color: '#2563EB' } : { color: '#047857' }
                    ]}>{stop.type.toUpperCase()}</Text>
                    <Text style={styles.mapStopCustomer}>{stop.customer}</Text>
                    <Text style={styles.mapStopAddress}>{stop.address}</Text>
                  </View>
                  <Ionicons 
                    name={stop.status === 'completed' ? 'checkmark-circle' : 'location'} 
                    size={20} 
                    color={stop.status === 'completed' ? '#10B981' : '#64748B'} 
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
              <Ionicons name="navigate" size={18} color="#FFFFFF" />
              <Text style={styles.fullscreenNavigateText}>Launch Navigation HUD</Text>
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
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },

  // Header
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  mapButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  scrollView: {
    flex: 1,
  },

  // Summary Card
  summaryCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryTitleContainer: {
    marginLeft: 10,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  summaryDate: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },

  // Stats
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#E2E8F0',
  },

  // Progress
  progressContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: '800',
    color: '#10B981',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3,
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
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  stopsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  stopsCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
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
    width: 32,
    marginRight: 10,
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#CBD5E1',
    zIndex: 10,
  },
  timelineDotActive: {
    borderColor: '#10B981',
    backgroundColor: '#10B981',
  },
  timelineDotCompleted: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  timelineNumber: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  timelineNumberActive: {
    color: '#FFFFFF',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E2E8F0',
    marginTop: -2,
  },
  timelineLineCompleted: {
    backgroundColor: '#10B981',
  },

  // Stop Card
  stopCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stopCardActive: {
    borderColor: '#10B981',
    borderWidth: 1.5,
  },
  stopCardCompleted: {
    borderColor: '#E2E8F0',
    opacity: 0.75,
  },
  stopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stopTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stopTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
  },
  pickupBadge: {
    backgroundColor: '#EEF2F6',
  },
  deliveryBadge: {
    backgroundColor: '#ECFDF5',
  },
  stopTypeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  stopTime: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  activeBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activeBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  stopCustomer: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 4,
  },
  stopAddress: {
    flex: 1,
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    fontWeight: '600',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  stopContact: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  stopMeta: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  notesText: {
    flex: 1,
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    lineHeight: 16,
  },

  // Action Buttons
  actionContainer: {
    padding: 16,
    gap: 8,
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  secondaryActionText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '700',
  },
  bottomSpacing: {
    height: 80,
  },

  // Empty State Styles
  emptyScrollContent: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 16,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyActionButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // Fullscreen Map Modal Styles
  fullscreenMapContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  fullscreenMapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  closeMapButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenMapTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  fullscreenMapContent: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 16,
  },
  mapLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mapLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mapLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  mapLegendText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  mapStopsList: {
    gap: 10,
    marginBottom: 20,
  },
  mapStopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mapStopNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EEF2F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  mapStopNumberText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  mapStopContent: {
    flex: 1,
  },
  mapStopType: {
    fontSize: 9,
    fontWeight: '800',
    color: '#10B981',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mapStopCustomer: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  mapStopAddress: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },
  fullscreenNavigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
    marginBottom: 32,
  },
  fullscreenNavigateText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
