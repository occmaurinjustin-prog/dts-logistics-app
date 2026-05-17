import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import ExpoGoMap from '../../components/ExpoGoMap';
import { driverService } from '../../services/driverService';

type NavigationPhase = 'preview' | 'pickup' | 'delivery' | 'complete';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Bottom sheet snap points (in pixels from bottom)
const SNAP_POINTS = {
  COLLAPSED: 120,  // Just the drag handle + mini content visible
  DOWN: 80,        // Almost fully collapsed
  HALF: SCREEN_HEIGHT * 0.45,  // Half expanded
};

const API_BASE_URL = Platform.OS === 'web' 
  ? 'http://localhost:8000/api'
  : 'http://10.26.16.24:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Stable hash function for consistent distance/duration values
const hashCode = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

interface NavigationStop {
  id: number;
  delivery_id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distance: string;
  duration: string;
  instruction: string;
  icon: string;
  type: 'pickup' | 'delivery';
  customer?: string;
  contact?: string;
  tracking_number?: string;
  status?: string;
}

export default function NavigationScreen() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [navSteps, setNavSteps] = useState<NavigationStop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // NEW: Grouped deliveries and navigation phase
  const [deliveries, setDeliveries] = useState<NavigationStop[][]>([]);
  const [currentDeliveryIndex, setCurrentDeliveryIndex] = useState(0);
  const [navigationPhase, setNavigationPhase] = useState<NavigationPhase>('preview');

  // GPS Location State
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  
  // Bottom Sheet Animation State
  const sheetPosition = useRef(new Animated.Value(SNAP_POINTS.COLLAPSED)).current;
  const [currentSnapPoint, setCurrentSnapPoint] = useState('COLLAPSED');
  
  // PanResponder for bottom sheet gestures
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to vertical gestures
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        // User starts dragging
        sheetPosition.stopAnimation();
        sheetPosition.extractOffset();
      },
      onPanResponderMove: (_, gestureState) => {
        // User is dragging - smooth animation with setValue
        const newHeight = SNAP_POINTS.COLLAPSED - gestureState.dy;
        const constrainedHeight = Math.max(SNAP_POINTS.DOWN, Math.min(SNAP_POINTS.HALF, newHeight));
        sheetPosition.setValue(constrainedHeight);
      },
      onPanResponderRelease: (_, gestureState) => {
        // User releases the drag
        sheetPosition.flattenOffset();
        const currentHeight = SNAP_POINTS.COLLAPSED - gestureState.dy;
        const velocity = gestureState.vy;
        
        let targetSnapPoint;
        
        // Determine snap point based on velocity and position
        if (velocity > 0.5) {
          // Swiping down
          targetSnapPoint = currentHeight > SNAP_POINTS.HALF * 0.7 ? SNAP_POINTS.HALF : SNAP_POINTS.DOWN;
        } else if (velocity < -0.5) {
          // Swiping up
          targetSnapPoint = currentHeight < SNAP_POINTS.HALF * 0.3 ? SNAP_POINTS.COLLAPSED : SNAP_POINTS.HALF;
        } else {
          // Based on position
          if (currentHeight > SNAP_POINTS.HALF * 0.7) {
            targetSnapPoint = SNAP_POINTS.HALF;
          } else if (currentHeight < SNAP_POINTS.DOWN * 1.2) {
            targetSnapPoint = SNAP_POINTS.DOWN;
          } else {
            targetSnapPoint = SNAP_POINTS.COLLAPSED;
          }
        }
        
        // Animate to target snap point with smooth spring animation
        Animated.spring(sheetPosition, {
          toValue: targetSnapPoint,
          useNativeDriver: false,
          tension: 30,  // Much lower tension for smoother animation
          friction: 10, // Higher friction for more damping
        }).start();
        
        // Update current snap point state
        if (targetSnapPoint === SNAP_POINTS.HALF) {
          setCurrentSnapPoint('HALF');
        } else if (targetSnapPoint === SNAP_POINTS.DOWN) {
          setCurrentSnapPoint('DOWN');
        } else {
          setCurrentSnapPoint('COLLAPSED');
        }
      },
    })
  ).current;
  
  // Throttling refs for API calls
  const lastDeliveryFetchRef = useRef<number>(0);
  const DELIVERY_FETCH_INTERVAL = 60000; // Only fetch deliveries every 60 seconds max

  // Fetch real delivery data - grouped by delivery
  const fetchDeliveries = useCallback(async () => {
    // Throttle: only fetch every 60 seconds unless manually refreshing
    const now = Date.now();
    const timeSinceLastFetch = now - lastDeliveryFetchRef.current;
    if (timeSinceLastFetch < DELIVERY_FETCH_INTERVAL && !refreshing) {
      console.log('Skipping delivery fetch, last fetch was', Math.round(timeSinceLastFetch/1000), 'seconds ago');
      return;
    }
    
    console.log('Fetching deliveries (refresh)...');
    lastDeliveryFetchRef.current = now;
    
    try {
      setRefreshing(true);
      const response = await api.get('/deliveries');
      console.log('Deliveries fetched:', response.data.success, response.data.deliveries?.length || 0, 'deliveries');

      if (response.data.success && response.data.deliveries?.length > 0) {
        // Filter active deliveries
        const activeDeliveries = response.data.deliveries.filter((d: any) =>
          d.delivery_status === 'Assigned' || d.delivery_status === 'In Transit' ||
          d.delivery_status === 'assigned' || d.delivery_status === 'in_transit' ||
          d.delivery_status === 'pending' || d.delivery_status === 'picked_up'
        );

        // Group stops by delivery_id - each delivery has pickup + delivery
        const groupedDeliveries: NavigationStop[][] = [];
        let globalStopId = 1; // Global ID counter to ensure uniqueness

        activeDeliveries.forEach((delivery: any) => {
          const deliveryStops: NavigationStop[] = [];

          // Add pickup stop
          if (delivery.pickup_address) {
            const pickupLat = delivery.pickup_latitude || 0;
            const pickupLng = delivery.pickup_longitude || 0;

            deliveryStops.push({
              id: globalStopId++,
              name: 'Pickup Location',
              address: delivery.pickup_address,
              latitude: pickupLat,
              longitude: pickupLng,
              distance: `${(hashCode(delivery.tracking_number || 'pickup') % 50 + 10) / 10} km`,
              duration: `${(hashCode(delivery.tracking_number || 'pickup') % 15 + 5)} min`,
              instruction: `Pick up ${delivery.item_description || 'items'} from ${delivery.client?.client_name || 'customer'}`,
              icon: 'arrow-up',
              type: 'pickup',
              customer: delivery.client?.client_name || delivery.customer,
              contact: delivery.contact || '+63 912 345 6789',
              tracking_number: delivery.tracking_number,
              delivery_id: delivery.delivery_id || delivery.id,
              status: delivery.delivery_status,
            });
          }

          // Add delivery step
          if (delivery.delivery_address || delivery.address) {
            const deliveryLat = delivery.delivery_latitude || delivery.latitude || 0;
            const deliveryLng = delivery.delivery_longitude || delivery.longitude || 0;

            deliveryStops.push({
              id: globalStopId++,
              name: 'Delivery Location',
              address: delivery.delivery_address || delivery.address,
              latitude: deliveryLat,
              longitude: deliveryLng,
              distance: `${(hashCode(delivery.tracking_number || 'delivery') % 80 + 20) / 10} km`,
              duration: `${(hashCode(delivery.tracking_number || 'delivery') % 20 + 10)} min`,
              instruction: `Deliver to ${delivery.delivery_address || delivery.address}`,
              icon: 'location',
              type: 'delivery',
              customer: delivery.client?.client_name || delivery.customer,
              contact: delivery.contact || '+63 923 456 7890',
              tracking_number: delivery.tracking_number,
              delivery_id: delivery.delivery_id || delivery.id,
              status: delivery.delivery_status,
            });
          }

          if (deliveryStops.length > 0) {
            groupedDeliveries.push(deliveryStops);
          }
        });

        // Flatten for backward compatibility with step list
        const allSteps = groupedDeliveries.flat();
        setNavSteps(allSteps);
        setDeliveries(groupedDeliveries);

        if (allSteps.length > 0) {
          setCurrentStep(0);
          setCurrentDeliveryIndex(0);
          
          // Set initial navigation phase from API (default to pickup if not set)
          const firstDelivery = activeDeliveries[0];
          if (firstDelivery?.navigation_phase) {
            setNavigationPhase(firstDelivery.navigation_phase);
          } else if (firstDelivery?.status === 'in_transit') {
            setNavigationPhase('delivery');
          }
        }
      }
    } catch (error) {
      console.error('Error fetching deliveries:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []); // Empty deps - only fetch on mount or manual refresh

  useEffect(() => {
    fetchDeliveries();
    
    // Get initial location immediately
    const getInitialLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const currentLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setLocation(currentLocation);
          console.log('Initial GPS:', currentLocation.coords.latitude, currentLocation.coords.longitude);
        }
      } catch (error) {
        console.log('Initial location error:', error);
      }
    };
    
    getInitialLocation();
  }, [fetchDeliveries]);

  // Ref for location update interval
  const locationUpdateInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSentLocation = useRef<Location.LocationObject | null>(null);

  // Request GPS Permission & Start Tracking
  const startGPSTracking = async () => {
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        Alert.alert('Permission Required', 'GPS permission is needed for navigation.');
        return;
      }

      // Check if GPS is enabled
      const enabled = await Location.hasServicesEnabledAsync();
      setGpsEnabled(enabled);

      if (!enabled) {
        Alert.alert('GPS Disabled', 'Please enable GPS location services on your phone.');
        return;
      }

      // Start watching position with smoother updates
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 5, // Update every 5 meters for smoother experience
          timeInterval: 3000, // Minimum 3 seconds between updates
        },
        (newLocation: Location.LocationObject) => {
          setLocation(newLocation);
          lastSentLocation.current = newLocation;
          console.log('GPS Update:', newLocation.coords.latitude, newLocation.coords.longitude);
        }
      );

      // Send location to backend every 10 seconds
      locationUpdateInterval.current = setInterval(() => {
        if (lastSentLocation.current) {
          const { latitude, longitude, speed, heading } = lastSentLocation.current.coords;
          driverService.updateLocation(latitude, longitude, speed || 0, heading || 0)
            .then(() => {
              console.log('Location sent to server:', latitude, longitude);
            })
            .catch((err: Error) => {
              console.error('Failed to send location:', err);
            });
        }
      }, 10000); // 10 seconds

    } catch (error) {
      console.error('GPS Error:', error);
      Alert.alert('GPS Error', 'Unable to start GPS tracking.');
    }
  };

  const stopGPSTracking = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    if (locationUpdateInterval.current) {
      clearInterval(locationUpdateInterval.current);
      locationUpdateInterval.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopGPSTracking();
    };
  }, []);

  // Get current delivery stops (pickup + delivery pair)
  const currentDeliveryStops = useMemo(() => {
    if (deliveries.length === 0 || currentDeliveryIndex >= deliveries.length) {
      return [];
    }
    return deliveries[currentDeliveryIndex].map((step) => ({
      id: step.id,
      latitude: step.latitude,
      longitude: step.longitude,
      name: step.name,
      type: step.type,
      address: step.address,
    }));
  }, [deliveries, currentDeliveryIndex]);

  // Memoize stops for map - only show current delivery based on phase
  const mapStops = useMemo(() => {
    return currentDeliveryStops;
  }, [currentDeliveryStops]);

  const currentStop = navSteps[currentStep] || null;

  // Start navigation - begin with pickup phase
  const handleStartNavigation = async () => {
    await startGPSTracking();
    setIsNavigating(true);
    setNavigationPhase('pickup');
  };

  const handleStopNavigation = () => {
    stopGPSTracking();
    setIsNavigating(false);
    setNavigationPhase('preview');
    setCurrentStep(0);
  };

  const getIconName = (icon: string): any => {
    switch (icon) {
      case 'arrow-up': return 'arrow-up';
      case 'arrow-back': return 'arrow-back';
      case 'arrow-forward': return 'arrow-forward';
      case 'location': return 'location';
      default: return 'navigate';
    }
  };

  const handleNextStep = () => {
    if (currentStep < navSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  // Complete current step and update delivery status with phase management
  const handleCompleteStep = async () => {
    if (!currentStop || deliveries.length === 0) {
      Alert.alert('Error', 'No active stop or delivery found.');
      return;
    }

    try {
      const currentDelivery = deliveries[currentDeliveryIndex];
      const currentStopInDelivery = currentDelivery?.find(s => s.id === currentStop.id);

      if (!currentStopInDelivery) {
        Alert.alert('Error', 'Could not find the current stop in delivery.');
        return;
      }

      if (currentStopInDelivery?.type === 'pickup') {
        // Just picked up - move to delivery phase
        console.log('Confirming pickup for delivery:', currentStop.delivery_id);
        const response = await api.put(`/deliveries/${currentStop.delivery_id}/status`, {
          delivery_status: 'in_transit',
          navigation_phase: 'delivery'
        });
        console.log('Pickup confirmed:', response.data);

        // Move to delivery step in current delivery
        const deliveryStepIndex = currentDelivery.findIndex(s => s.type === 'delivery');
        if (deliveryStepIndex >= 0) {
          // Find global step index
          const globalIndex = navSteps.findIndex(s => s.id === currentDelivery[deliveryStepIndex].id);
          setCurrentStep(globalIndex);
        }

        // Switch to delivery phase on map
        setNavigationPhase('delivery');

        Alert.alert(
          '✅ Pickup Complete',
          'Item picked up! Now navigate to delivery location.',
          [{ text: 'OK' }]
        );
      } else {
        // Delivery complete
        await api.put(`/deliveries/${currentStop.delivery_id}/status`, {
          delivery_status: 'delivered'
        });

        // Check if there are more deliveries
        if (currentDeliveryIndex < deliveries.length - 1) {
          // Move to next delivery
          setCurrentDeliveryIndex(prev => prev + 1);
          // Find first step of next delivery
          const nextDelivery = deliveries[currentDeliveryIndex + 1];
          if (nextDelivery && nextDelivery.length > 0) {
            const nextGlobalIndex = navSteps.findIndex(s => s.id === nextDelivery[0].id);
            setCurrentStep(nextGlobalIndex >= 0 ? nextGlobalIndex : currentStep + 1);
          }
          // Reset to pickup phase for next delivery
          setNavigationPhase('pickup');

          Alert.alert(
            '✅ Delivery Complete',
            'Moving to next delivery!',
            [{ text: 'OK' }]
          );
        } else {
          // All deliveries complete
          setNavigationPhase('complete');
          setIsNavigating(false);

          // Refresh data to check for new deliveries instead of redirecting
          Alert.alert(
            '🎉 All Deliveries Complete!',
            'Great job! You have completed all deliveries.\n\nChecking for new assignments...',
            [{ 
              text: 'OK', 
              onPress: () => {
                // Force refresh deliveries data
                lastDeliveryFetchRef.current = 0; // Reset throttle timer
                fetchDeliveries();
              }
            }]
          );
          
          // Also auto-refresh after 3 seconds in case they dismiss alert quickly
          setTimeout(() => {
            lastDeliveryFetchRef.current = 0; // Reset throttle timer
            fetchDeliveries();
          }, 3000);
        }
      }
    } catch (error) {
      console.error('Failed to complete step:', error);
      Alert.alert('Error', 'Failed to update status. Please try again.');
    }
  };

  // Show loading state
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading navigation...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show empty state if no deliveries
  if (navSteps.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.modernHeader}>
          <TouchableOpacity style={styles.headerBackButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color="#070907" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Navigation</Text>
            <Text style={[styles.headerEta, { color: '#070907' }]}>No active route</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView
          style={{ flex: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchDeliveries} colors={['#16A34A']} tintColor="#16A34A" />}
          contentContainerStyle={styles.emptyScrollContent}
        >
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrapper}>
              <View style={styles.emptyIconBg}>
                <Ionicons name="navigate-circle-outline" size={64} color="#16A34A" />
              </View>
              <View style={styles.emptyPulseRing} />
            </View>
            <Text style={styles.emptyTitle}>No Active Deliveries</Text>
            <Text style={styles.emptyText}>
              You're all caught up! No assigned deliveries to navigate to right now.
            </Text>
            <View style={styles.emptyStatsRow}>
              <View style={styles.emptyStatItem}>
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text style={styles.emptyStatText}>Ready to go</Text>
              </View>
              <View style={styles.emptyStatDivider} />
              <View style={styles.emptyStatItem}>
                <Ionicons name="time-outline" size={20} color="#FFFFFF" />
                <Text style={styles.emptyStatText}>Waiting for orders</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.emptyActionButton}
              onPress={() => router.push('/deliveries')}
              activeOpacity={0.8}
            >
              <Ionicons name="cube" size={20} color="#FFFFFF" />
              <Text style={styles.emptyActionText}>View Deliveries</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Get current navigation instruction based on phase
  const getNavigationInstruction = () => {
    if (navigationPhase === 'pickup') {
      return {
        text: 'Head to pickup location',
        distance: currentStop?.distance || '0 km',
        street: currentStop?.address?.split(',')[0] || 'Pickup point',
        icon: 'arrow-up-circle' as const,
        color: '#16A34A',
      };
    } else if (navigationPhase === 'delivery') {
      return {
        text: 'Deliver to destination',
        distance: currentStop?.distance || '0 km',
        street: currentStop?.address?.split(',')[0] || 'Delivery point',
        icon: 'location' as const,
        color: '#EF4444',
      };
    }
    return {
      text: 'Ready to navigate',
      distance: '',
      street: currentStop?.address?.split(',')[0] || 'Select a destination',
      icon: 'navigate' as const,
      color: '#3B82F6',
    };
  };

  const navInstruction = getNavigationInstruction();

  return (
    <SafeAreaView style={styles.container}>
      {/* Minimal Header */}
      <View style={styles.modernHeader}>
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={28} color="#1F2937" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Navigation</Text>
          <Text style={styles.headerEta}>
            {isNavigating ? `ETA ${currentStop?.duration || '10 min'}` : 'Ready'}
          </Text>
        </View>
        <TouchableOpacity style={styles.headerVoiceButton}>
          <Ionicons name="volume-high" size={22} color="#16A34A" />
        </TouchableOpacity>
      </View>

      {/* Full-Width Map with Overlay Cards */}
      <View style={styles.mapSection}>
        <ExpoGoMap
          stops={mapStops}
          currentLocation={location}
          isNavigating={isNavigating}
          navigationPhase={navigationPhase}
          showRouteLine={isNavigating}
          heading={location?.coords?.heading || null}
        />

        {/* Floating Navigation Instruction Card */}
        <View style={styles.navOverlayCard}>
          <View style={[styles.navIconContainer, { backgroundColor: navInstruction.color }]}>
            <Ionicons name={navInstruction.icon} size={32} color="#FFFFFF" />
          </View>
          <View style={styles.navContent}>
            <Text style={styles.navInstruction} numberOfLines={1}>
              {navInstruction.text}
            </Text>
            <Text style={styles.navStreet} numberOfLines={1}>
              {navInstruction.street}
            </Text>
            {navInstruction.distance && (
              <View style={styles.navDistanceBadge}>
                <Ionicons name="navigate" size={12} color="#FFFFFF" />
                <Text style={styles.navDistanceText}>{navInstruction.distance}</Text>
              </View>
            )}
          </View>
          <View style={styles.navArrow}>
            <Ionicons name="chevron-forward" size={24} color="#94A3B8" />
          </View>
        </View>

        {/* Floating Voice Toggle Button */}
        <TouchableOpacity style={styles.voiceFab}>
          <Ionicons name={isNavigating ? "volume-high" : "volume-mute"} size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Bottom Sheet - Progress & Controls */}
      <Animated.View
        style={[
          styles.bottomSheet,
          {
            height: sheetPosition.interpolate({
              inputRange: [SNAP_POINTS.DOWN, SNAP_POINTS.COLLAPSED, SNAP_POINTS.HALF],
              outputRange: [SNAP_POINTS.DOWN + 50, SNAP_POINTS.COLLAPSED + 50, SNAP_POINTS.HALF],
              extrapolate: 'clamp',
            }),
          },
        ]}
      >
        {/* Drag Handle */}
        <View style={styles.dragHandleContainer} {...panResponder.panHandlers}>
          <View style={styles.dragHandle} />
        </View>

        {/* Route Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View style={[
              styles.progressFill,
              { width: navigationPhase === 'preview' ? '0%' : navigationPhase === 'pickup' ? '30%' : navigationPhase === 'delivery' ? '70%' : '100%' }
            ]} />
          </View>
          <View style={styles.progressLabels}>
            <View style={styles.progressStep}>
              <View style={[styles.progressDot, navigationPhase !== 'preview' && styles.progressDotActive]}>
                <Ionicons name="checkmark" size={12} color="#FFFFFF" />
              </View>
              <Text style={[styles.progressLabel, navigationPhase !== 'preview' && styles.progressLabelActive]}>Pickup</Text>
            </View>
            <View style={styles.progressStep}>
              <View style={[styles.progressDot, (navigationPhase === 'delivery' || navigationPhase === 'complete') && styles.progressDotActive]}>
                <Ionicons name="checkmark" size={12} color="#FFFFFF" />
              </View>
              <Text style={[styles.progressLabel, (navigationPhase === 'delivery' || navigationPhase === 'complete') && styles.progressLabelActive]}>Delivery</Text>
            </View>
            <View style={styles.progressStep}>
              <View style={[styles.progressDot, navigationPhase === 'complete' && styles.progressDotActive]}>
                <Ionicons name="checkmark" size={12} color="#FFFFFF" />
              </View>
              <Text style={[styles.progressLabel, navigationPhase === 'complete' && styles.progressLabelActive]}>Complete</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        {!isNavigating ? (
          navigationPhase === 'complete' ? (
            // Show Go Home button when all deliveries complete
            <TouchableOpacity
              style={[styles.startNavButton, { backgroundColor: '#16A34A' }]}
              onPress={() => router.replace('/')}
              activeOpacity={0.9}
            >
              <View style={[styles.startNavIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Ionicons name="home" size={28} color="#FFFFFF" />
              </View>
              <View style={styles.startNavText}>
                <Text style={styles.startNavTitle}>Go Home</Text>
                <Text style={styles.startNavSubtitle}>All deliveries completed</Text>
              </View>
              <Ionicons name="arrow-forward" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            // Show Start Navigation button when not navigating and not complete
            <TouchableOpacity
              style={styles.startNavButton}
              onPress={handleStartNavigation}
              activeOpacity={0.9}
            >
              <View style={styles.startNavIcon}>
                <Ionicons name="navigate" size={28} color="#FFFFFF" />
              </View>
              <View style={styles.startNavText}>
                <Text style={styles.startNavTitle}>Start Navigation</Text>
                <Text style={styles.startNavSubtitle}>Follow the blue route line</Text>
              </View>
              <Ionicons name="arrow-forward" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )
        ) : (
          <View style={styles.activeNavControls}>
            <TouchableOpacity
              style={styles.completeNavButton}
              onPress={handleCompleteStep}
            >
              <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
              <Text style={styles.completeNavText}>
                {currentStop?.type === 'pickup' ? 'Confirm Pickup' : 'Confirm Delivery'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Delivery Info Card */}
        <View style={styles.deliveryInfoCard}>
          <View style={styles.deliveryInfoRow}>
            <Ionicons name={currentStop?.type === 'pickup' ? 'cube' : 'home'} size={20} color="#64748B" />
            <View style={styles.deliveryInfoContent}>
              <Text style={styles.deliveryInfoLabel}>
                {currentStop?.type === 'pickup' ? 'Pickup from' : 'Deliver to'}
              </Text>
              <Text style={styles.deliveryInfoValue} numberOfLines={1}>
                {currentStop?.customer || 'Customer'}
              </Text>
            </View>
          </View>
          <View style={styles.deliveryDivider} />
          <View style={styles.deliveryInfoRow}>
            <Ionicons name="location" size={20} color="#64748B" />
            <View style={styles.deliveryInfoContent}>
              <Text style={styles.deliveryInfoLabel}>Address</Text>
              <Text style={styles.deliveryInfoValue} numberOfLines={2}>
                {currentStop?.address || 'Address not available'}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // Loading State
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#e3e2fa',
    fontWeight: '500',
  },

  // Empty State (keep existing styles)
  emptyScrollContent: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  emptyIconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyIconBg: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3BC240',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  emptyPulseRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: '#3BC240',
    backgroundColor: 'transparent',
  },
  emptyTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#070907',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  emptyText: {
    fontSize: 16,
    color: '#070907',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  emptyStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3BC240',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#3BC240',
  },
  emptyStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyStatText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyStatDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3BC240',
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
    shadowColor: '#3BC240',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  emptyActionText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },

  // Modern Minimal Header
  modernHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#3BC240',
  },
  headerBackButton: {
    padding: 4,
    width: 40,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#e3e2fa',
    letterSpacing: -0.3,
  },
  headerEta: {
    fontSize: 13,
    color: '#070907',
    fontWeight: '600',
    marginTop: 2,
  },
  headerVoiceButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#070907',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Map Section with Overlays
  mapSection: {
    flex: 1,
    position: 'relative',
  },

  // Navigation Overlay Card (Glassmorphism)
  navOverlayCard: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 80,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    shadowColor: '#3BC240',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#3BC240',
  },
  navIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  navContent: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  navInstruction: {
    fontSize: 16,
    fontWeight: '700',
    color: '#070907',
    marginBottom: 2,
  },
  navStreet: {
    fontSize: 14,
    color: '#070907',
    fontWeight: '500',
    marginBottom: 6,
  },
  navDistanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#3BC240',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  navDistanceText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  navArrow: {
    marginLeft: 4,
  },

  // Voice FAB
  voiceFab: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#3BC240',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3BC240',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },

  // Bottom Sheet
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    shadowColor: '#3BC240',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 12,
  },

  // Drag Handle
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dragHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#070907',
    borderRadius: 2,
  },

  // Progress Bar
  progressContainer: {
    marginBottom: 20,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#453c59',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3BC240',
    borderRadius: 3,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressStep: {
    alignItems: 'center',
    gap: 6,
  },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#070907',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressDotActive: {
    backgroundColor: '#3BC240',
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  progressLabelActive: {
    color: '#070907',
  },

  // Start Navigation Button
  startNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3BC240',
    borderRadius: 16,
    padding: 6,
    marginBottom: 16,
    shadowColor: '#3BC240',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  startNavIcon: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: 'rgba(227, 226, 250, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  startNavText: {
    flex: 1,
    marginLeft: 14,
  },
  startNavTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  startNavSubtitle: {
    fontSize: 13,
    color: 'rgba(227, 226, 250, 0.8)',
    marginTop: 2,
  },

  // Active Navigation Controls
  activeNavControls: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  completeNavButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#3BC240',
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: '#3BC240',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  completeNavText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Delivery Info Card
  deliveryInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  deliveryInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  deliveryInfoContent: {
    flex: 1,
  },
  deliveryInfoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#070907',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  deliveryInfoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#070907',
    lineHeight: 20,
  },
  deliveryDivider: {
    height: 1,
    backgroundColor: '#3BC240',
    marginVertical: 12,
  },
});
