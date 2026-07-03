import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  : 'http://10.65.49.24:8000/api';

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

// Calculate Haversine distance in meters
const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

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
  waybill?: string;
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

  // Proof of Delivery (POD) states
  const [podModalVisible, setPodModalVisible] = useState(false);
  const [podImage, setPodImage] = useState<string | null>(null);
  const [podRemarks, setPodRemarks] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // GPS Location State
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  // Live Route Status
  const [liveDistance, setLiveDistance] = useState<string | null>(null);
  const [liveDuration, setLiveDuration] = useState<string | null>(null);

  // Arrival Validation
  const ARRIVAL_RADIUS = 50; // meters
  const [distanceToDestination, setDistanceToDestination] = useState<number | null>(null);
  const [hasArrived, setHasArrived] = useState(false);

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
      console.log('Skipping delivery fetch, last fetch was', Math.round(timeSinceLastFetch / 1000), 'seconds ago');
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
              distance: `${(hashCode(delivery.waybill || 'pickup') % 50 + 10) / 10} km`,
              duration: `${(hashCode(delivery.waybill || 'pickup') % 15 + 5)} min`,
              instruction: `Pick up ${delivery.item_description || 'items'} from ${delivery.client?.client_name || 'customer'}`,
              icon: 'arrow-up',
              type: 'pickup',
              customer: delivery.client?.client_name || delivery.customer,
              contact: delivery.contact || '+63 912 345 6789',
              waybill: delivery.waybill,
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
              distance: `${(hashCode(delivery.waybill || 'delivery') % 80 + 20) / 10} km`,
              duration: `${(hashCode(delivery.waybill || 'delivery') % 20 + 10)} min`,
              instruction: `Deliver to ${delivery.delivery_address || delivery.address}`,
              icon: 'location',
              type: 'delivery',
              customer: delivery.client?.client_name || delivery.customer,
              contact: delivery.contact || '+63 923 456 7890',
              waybill: delivery.waybill,
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
          // Read local persistent state
          const savedStateStr = await AsyncStorage.getItem('@driver_navigation_state');
          let localPhase: NavigationPhase = 'preview';
          let localIndex = 0;
          let localStep = 0;
          let localIsNavigating = false;

          if (savedStateStr) {
            try {
              const savedState = JSON.parse(savedStateStr);
              localPhase = savedState.navigationPhase || 'preview';
              localIndex = savedState.currentDeliveryIndex || 0;
              localStep = savedState.currentStep || 0;
              localIsNavigating = savedState.isNavigating || false;
            } catch (e) {
              console.log('Error parsing saved navigation state', e);
            }
          }

          const firstDelivery = activeDeliveries[0];
          const backendStatus = firstDelivery?.delivery_status || firstDelivery?.status;

          // Backend priority: if backend says it's in transit, force delivery phase
          if (backendStatus === 'in_transit' || backendStatus === 'In Transit' || backendStatus === 'picked_up') {
            setNavigationPhase('delivery');
            setCurrentDeliveryIndex(0);
            setCurrentStep(1); // 1 is typically the delivery stop
            setIsNavigating(true);
          } else if (firstDelivery?.navigation_phase) {
            setNavigationPhase(firstDelivery.navigation_phase);
            setCurrentDeliveryIndex(0);
            setCurrentStep(0);
          } else {
            // Apply local state if backend is still just 'assigned' or similar
            setNavigationPhase(localPhase);
            setCurrentDeliveryIndex(localIndex);
            setCurrentStep(localStep);
            setIsNavigating(localIsNavigating);
          }
        } else {
          // No deliveries, clear state
          await AsyncStorage.removeItem('@driver_navigation_state');
          setNavigationPhase('preview');
          setCurrentDeliveryIndex(0);
          setCurrentStep(0);
          setIsNavigating(false);
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

  // Save navigation state whenever important variables change
  useEffect(() => {
    const saveState = async () => {
      try {
        const stateToSave = {
          navigationPhase,
          currentDeliveryIndex,
          currentStep,
          isNavigating,
        };
        await AsyncStorage.setItem('@driver_navigation_state', JSON.stringify(stateToSave));
      } catch (e) {
        console.error('Failed to save navigation state', e);
      }
    };

    saveState();
  }, [navigationPhase, currentDeliveryIndex, currentStep, isNavigating]);

  // Ref for location update interval
  const locationUpdateInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSentLocation = useRef<Location.LocationObject | null>(null);

  // Driver Stops Tracking Refs
  const stopStartTime = useRef<number | null>(null);
  const hasActiveStop = useRef<boolean>(false);
  const lastMovingLocation = useRef<Location.LocationObject | null>(null);

  // Restore stop state on mount
  useEffect(() => {
    const loadStopState = async () => {
      try {
        const active = await AsyncStorage.getItem('@driver_has_active_stop');
        if (active === 'true') hasActiveStop.current = true;

        const startTime = await AsyncStorage.getItem('@driver_stop_start_time');
        if (startTime) stopStartTime.current = parseInt(startTime, 10);
      } catch (e) {
        console.error('Failed to load stop state', e);
      }
    };
    loadStopState();
  }, []);

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
        async (newLocation: Location.LocationObject) => {
          setLocation(newLocation);
          lastSentLocation.current = newLocation;
          console.log('GPS Update:', newLocation.coords.latitude, newLocation.coords.longitude);

          // --- Driver Stop Tracking Logic ---
          const currentSpeed = newLocation.coords.speed || 0; // speed is in m/s
          const speedThreshold = 0.55; // ~2 km/h

          let distanceMoved = 0;
          if (lastMovingLocation.current) {
            distanceMoved = getDistanceInMeters(
              lastMovingLocation.current.coords.latitude,
              lastMovingLocation.current.coords.longitude,
              newLocation.coords.latitude,
              newLocation.coords.longitude
            );
          }

          const isMoving = currentSpeed > speedThreshold || distanceMoved > 10;

          if (isMoving) {
            // Driver is moving
            lastMovingLocation.current = newLocation;

            if (stopStartTime.current !== null) {
              stopStartTime.current = null;
              AsyncStorage.removeItem('@driver_stop_start_time');
            }

            if (hasActiveStop.current) {
              // End the stop
              hasActiveStop.current = false;
              AsyncStorage.removeItem('@driver_has_active_stop');
              try {
                await api.post('/driver/stops/end', {
                  resumed_at: new Date().toISOString()
                });
                console.log('Driver stop ended successfully');
              } catch (e) {
                console.error('Failed to end driver stop:', e);
              }
            }
          } else {
            // Driver is stopped
            const now = Date.now();
            if (stopStartTime.current === null) {
              stopStartTime.current = now;
              AsyncStorage.setItem('@driver_stop_start_time', now.toString());
            } else {
              const timeStopped = now - stopStartTime.current;
             // const threeMinutes = 3 * 60 * 1000; // 3 minutes
              const threeMinutes = 10 * 1000; // 10 seconds for testing

              if (timeStopped >= threeMinutes && !hasActiveStop.current) {
                // Record the stop
                hasActiveStop.current = true;
                AsyncStorage.setItem('@driver_has_active_stop', 'true');
                try {
                  // Attempt to get the address
                  let address = '';
                  try {
                    const geocode = await Location.reverseGeocodeAsync({
                      latitude: newLocation.coords.latitude,
                      longitude: newLocation.coords.longitude
                    });
                    if (geocode && geocode.length > 0) {
                      const place = geocode[0];
                      address = `${place.name || place.streetNumber || ''} ${place.street || ''}, ${place.city || place.subregion || ''}, ${place.region || ''}`.trim().replace(/^,|,$/g, '').trim();
                    }
                  } catch (geoError) {
                    console.error('Reverse geocoding failed:', geoError);
                  }

                  await api.post('/driver/stops/start', {
                    latitude: newLocation.coords.latitude,
                    longitude: newLocation.coords.longitude,
                    address: address,
                    stopped_at: new Date(stopStartTime.current).toISOString()
                  });
                  console.log('Driver stop started successfully');
                } catch (e) {
                  console.error('Failed to start driver stop:', e);
                }
              }
            }
          }
          // ------------------------------------

          // Real-time route update: when location changes, the map will automatically update
          // because we pass location as a prop to ExpoGoMap
        }
      );

      // Send location to backend every 10 seconds
      locationUpdateInterval.current = setInterval(async () => {
        try {
          // Check if GPS is still enabled on the device
          const enabled = await Location.hasServicesEnabledAsync();
          setGpsEnabled(enabled);

          if (lastSentLocation.current) {
            const { latitude, longitude, speed, heading } = lastSentLocation.current.coords;
            driverService.updateLocation(latitude, longitude, speed || 0, heading || 0, enabled)
              .then(() => {
                console.log('Location sent to server:', latitude, longitude, 'gpsEnabled:', enabled);
              })
              .catch((err: Error) => {
                console.error('Failed to send location:', err);
              });

            // --- Driver Stop Timer Check ---
            // Even if watchPositionAsync doesn't fire (because device is perfectly still),
            // this interval will check if the 3-minute threshold has been reached.
            if (stopStartTime.current !== null && !hasActiveStop.current) {
              const now = Date.now();
              const timeStopped = now - stopStartTime.current;
              // const threeMinutes = 3 * 60 * 1000; // 3 minutes
              const threeMinutes = 10 * 1000; // 10 seconds for testing

              if (timeStopped >= threeMinutes) {
                hasActiveStop.current = true;
                AsyncStorage.setItem('@driver_has_active_stop', 'true');

                // Fetch address
                Location.reverseGeocodeAsync({ latitude, longitude })
                  .then((geocode) => {
                    let address = '';
                    if (geocode && geocode.length > 0) {
                      const place = geocode[0];
                      address = `${place.name || place.streetNumber || ''} ${place.street || ''}, ${place.city || place.subregion || ''}, ${place.region || ''}`.trim().replace(/^,|,$/g, '').trim();
                    }
                    return api.post('/driver/stops/start', {
                      latitude: latitude,
                      longitude: longitude,
                      address: address,
                      stopped_at: new Date(stopStartTime.current as number).toISOString()
                    });
                  })
                  .then(() => console.log('Driver stop started successfully via interval'))
                  .catch(e => console.error('Failed to start driver stop via interval:', e));
              }
            }
          }
        } catch (e) {
          console.error('Error in location update interval:', e);
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

  // Real-time route update: when location changes during navigation, trigger map refresh
  useEffect(() => {
    if (isNavigating && location && navigationPhase !== 'complete') {
      console.log('Location changed during navigation, updating route');
      // The ExpoGoMap component will automatically re-render with new location
      // This ensures the route line updates in real-time as driver moves
    }
  }, [location, isNavigating, navigationPhase]);

  // Monitor distance for arrival validation
  useEffect(() => {
    if (!location || !currentStop || !isNavigating || navigationPhase === 'complete') {
      return;
    }

    const dist = getDistanceInMeters(
      location.coords.latitude,
      location.coords.longitude,
      currentStop.latitude,
      currentStop.longitude
    );

    setDistanceToDestination(dist);
    setHasArrived(dist <= ARRIVAL_RADIUS);
  }, [location, currentStop, isNavigating, navigationPhase]);

  // Get current delivery stops (pickup + delivery pair)
  const currentDeliveryStops = useMemo(() => {
    if (deliveries.length === 0 || currentDeliveryIndex >= deliveries.length) {
      return [];
    }
    return deliveries[currentDeliveryIndex].map((step) => ({
      id: step.id,
      latitude: parseFloat(step.latitude as any) || 0,
      longitude: parseFloat(step.longitude as any) || 0,
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
    setLiveDistance(null);
    setLiveDuration(null);
  };

  const handleStopNavigation = () => {
    stopGPSTracking();
    setIsNavigating(false);
    setNavigationPhase('preview');
    setCurrentStep(0);
    setLiveDistance(null);
    setLiveDuration(null);
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

  // Camera & Gallery permissions & action handlers
  const handleTakePhoto = async () => {
    try {
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      if (cameraPermission.status !== 'granted') {
        Alert.alert('Permission Required', 'We need access to your camera to take a proof of delivery photo.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPodImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'An error occurred while taking a photo.');
    }
  };

  const handleChooseFromGallery = async () => {
    try {
      const galleryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (galleryPermission.status !== 'granted') {
        Alert.alert('Permission Required', 'We need access to your library to choose a proof of delivery photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPodImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Gallery error:', error);
      Alert.alert('Error', 'An error occurred while choosing a photo.');
    }
  };

  // Submit Proof of Delivery & mark delivery as completed
  const handleFinalConfirmDelivery = async () => {
    if (!currentStop) {
      Alert.alert('Error', 'No active stop found.');
      return;
    }

    if (!podImage) {
      Alert.alert('Upload Required', 'Please upload proof of delivery before confirming.');
      return;
    }

    try {
      setIsUploading(true);

      const formData = new FormData();
      formData.append('_method', 'PUT'); // Method spoofing for Laravel multipart PUT file uploads
      formData.append('delivery_status', 'delivered');

      if (podRemarks.trim()) {
        formData.append('remarks', podRemarks.trim());
      }

      if (location?.coords) {
        formData.append('actual_delivery_latitude', location.coords.latitude.toString());
        formData.append('actual_delivery_longitude', location.coords.longitude.toString());
      }

      // Format proof image for React Native upload
      const filename = podImage.split('/').pop() || 'proof.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const fileType = match ? `image/${match[1]}` : `image/jpeg`;

      formData.append('proof_image', {
        uri: Platform.OS === 'ios' ? podImage.replace('file://', '') : podImage,
        name: filename,
        type: fileType,
      } as any);

      console.log('Uploading Proof of Delivery (POD) for delivery_id:', currentStop.delivery_id);

      const response = await api.post(`/deliveries/${currentStop.delivery_id}/status`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('POD Upload Response:', response.data);

      if (response.data.success) {
        // Close modal first
        setPodModalVisible(false);
        setIsUploading(false);

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

          // Refresh data to check for new deliveries
          Alert.alert(
            '🎉 All Deliveries Complete!',
            'Great job! You have completed all deliveries.\n\nChecking for new assignments...',
            [{
              text: 'OK',
              onPress: () => {
                lastDeliveryFetchRef.current = 0; // Reset throttle timer
                fetchDeliveries();
              }
            }]
          );

          setTimeout(() => {
            lastDeliveryFetchRef.current = 0; // Reset throttle timer
            fetchDeliveries();
          }, 3000);
        }
      } else {
        Alert.alert('Error', response.data.message || 'Failed to submit proof. Please try again.');
        setIsUploading(false);
      }
    } catch (error: any) {
      console.error('POD submit error:', error);
      const errorMsg = error.response?.data?.message || 'Failed to upload proof of delivery. Please try again.';
      Alert.alert('Submission Failed', errorMsg);
      setIsUploading(false);
    }
  };

  // Complete current step and update delivery status with phase management
  const handleCompleteStep = async () => {
    if (!currentStop || deliveries.length === 0) {
      Alert.alert('Error', 'No active stop or delivery found.');
      return;
    }

    // Strict Arrival Validation
    if (distanceToDestination !== null && distanceToDestination > ARRIVAL_RADIUS) {
      Alert.alert(
        "Not Yet Arrived",
        `You must arrive at the destination before confirming.\n\nYou are currently ${Math.round(distanceToDestination)} meters away.`
      );
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
        setLiveDistance(null);
        setLiveDuration(null);

        Alert.alert(
          '✅ Pickup Complete',
          'Item picked up! Now navigate to delivery location.',
          [{ text: 'OK' }]
        );
      } else {
        // Intercept delivery completion and open custom POD modal
        setPodImage(null);
        setPodRemarks('');
        setPodModalVisible(true);
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
          <ActivityIndicator size="large" color="#2A9D8F" />
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
        distance: liveDistance || currentStop?.distance || '0 km',
        street: currentStop?.address?.split(',')[0] || 'Pickup point',
        icon: 'arrow-up-circle' as const,
        color: '#16A34A',
      };
    } else if (navigationPhase === 'delivery') {
      return {
        text: 'Deliver to destination',
        distance: liveDistance || currentStop?.distance || '0 km',
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
      color: '#2A9D8F',
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
            {isNavigating ? `ETA ${liveDuration || currentStop?.duration || '10 min'}` : 'Ready'}
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
          isGpsEnabled={gpsEnabled}
          onRouteUpdate={(distance, duration) => {
            setLiveDistance(distance);
            setLiveDuration(duration);
          }}
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
            <Ionicons name="chevron-forward" size={24} color="#9AB7AF" />
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
          <View style={{ marginBottom: 12 }}>
            {distanceToDestination !== null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8, gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: hasArrived ? '#0F6B5A' : '#EF4444' }} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: hasArrived ? '#0F6B5A' : '#EF4444' }}>
                  {hasArrived ? 'Arrived at Destination' : `Not Arrived - ${Math.round(distanceToDestination)}m remaining`}
                </Text>
              </View>
            )}
            <View style={[styles.activeNavControls, { marginBottom: 0 }]}>
              <TouchableOpacity
                style={[
                  styles.completeNavButton,
                  !hasArrived && { backgroundColor: '#9AB7AF' }
                ]}
                onPress={handleCompleteStep}
                disabled={!hasArrived}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
                <Text style={styles.completeNavText}>
                  {currentStop?.type === 'pickup' ? 'Confirm Pickup' : 'Confirm Delivery'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Delivery Info Card */}
        <View style={styles.deliveryInfoCard}>
          <View style={styles.deliveryInfoRow}>
            <Ionicons name={currentStop?.type === 'pickup' ? 'cube' : 'home'} size={20} color="#6F8B84" />
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
            <Ionicons name="location" size={20} color="#6F8B84" />
            <View style={styles.deliveryInfoContent}>
              <Text style={styles.deliveryInfoLabel}>Address</Text>
              <Text style={styles.deliveryInfoValue} numberOfLines={2}>
                {currentStop?.address || 'Address not available'}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Proof of Delivery (POD) Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={podModalVisible}
        onRequestClose={() => {
          if (!isUploading) setPodModalVisible(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContentContainer}>
            {/* Modal Drag Indicator / Accent Bar */}
            <View style={styles.modalAccentBar} />

            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Proof of Delivery (POD)</Text>
                <Text style={styles.modalSubtitle}>Waybill: #{currentStop?.waybill || 'N/A'}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setPodModalVisible(false)}
                disabled={isUploading}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={22} color="#6F8B84" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
              {/* Photo Upload Area (Required) */}
              <Text style={styles.fieldLabel}>
                Proof Image <Text style={{ color: '#EF4444' }}>* (Required)</Text>
              </Text>

              {podImage ? (
                <View style={styles.previewImageContainer}>
                  <Image source={{ uri: podImage }} style={styles.previewImage} />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => setPodImage(null)}
                    disabled={isUploading}
                  >
                    <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.imageSelectorContainer}>
                  <TouchableOpacity
                    style={styles.selectorButton}
                    onPress={handleTakePhoto}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.selectorIconBg, { backgroundColor: 'rgba(22, 163, 74, 0.1)' }]}>
                      <Ionicons name="camera" size={28} color="#16A34A" />
                    </View>
                    <Text style={styles.selectorText}>Take Photo</Text>
                  </TouchableOpacity>

                  <View style={styles.selectorDivider} />

                  <TouchableOpacity
                    style={styles.selectorButton}
                    onPress={handleChooseFromGallery}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.selectorIconBg, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                      <Ionicons name="images" size={28} color="#2A9D8F" />
                    </View>
                    <Text style={styles.selectorText}>From Gallery</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Remarks / Notes (Optional) */}
              <Text style={styles.fieldLabel}>Remarks / Notes <Text style={styles.optionalLabel}>(Optional)</Text></Text>
              <TextInput
                style={styles.remarksInput}
                placeholder="e.g. Received by John Doe, packages in excellent condition..."
                placeholderTextColor="#9AB7AF"
                multiline={true}
                numberOfLines={3}
                value={podRemarks}
                onChangeText={setPodRemarks}
                editable={!isUploading}
              />

              {/* Info Badges (GPS Lock & Timestamp) */}
              <View style={styles.infoBadgesRow}>
                <View style={styles.infoBadge}>
                  <Ionicons
                    name={location ? "location" : "location-outline"}
                    size={14}
                    color={location ? "#16A34A" : "#9AB7AF"}
                  />
                  <Text style={[styles.infoBadgeText, location && { color: '#16A34A', fontWeight: '600' }]}>
                    {location
                      ? `GPS Locked (${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)})`
                      : 'GPS Unavailable'
                    }
                  </Text>
                </View>

                <View style={styles.infoBadge}>
                  <Ionicons name="time-outline" size={14} color="#2A9D8F" />
                  <Text style={styles.infoBadgeText}>
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (Auto)
                  </Text>
                </View>
              </View>
            </ScrollView>

            {/* Modal Action Buttons */}
            <View style={styles.modalActionButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setPodModalVisible(false)}
                disabled={isUploading}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalSubmitButton,
                  (!podImage || isUploading) && styles.modalSubmitButtonDisabled
                ]}
                onPress={handleFinalConfirmDelivery}
                disabled={!podImage || isUploading}
                activeOpacity={0.9}
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-done" size={20} color="#FFFFFF" />
                    <Text style={styles.modalSubmitButtonText}>Confirm Delivery</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#DDE9E3',
  },

  // Loading State
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#DDE9E3',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6F8B84',
    fontWeight: '600',
  },

  // Empty State (keep existing styles)
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
  emptyIconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyIconBg: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#D8E7E1',
  },
  emptyPulseRing: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 1.5,
    borderColor: '#D8E7E1',
    backgroundColor: 'transparent',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#23423B',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#6F8B84',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  emptyStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DDE9E3',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#D8E7E1',
  },
  emptyStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emptyStatText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6F8B84',
  },
  emptyStatDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#D8E7E1',
    marginHorizontal: 12,
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F6B5A',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  emptyActionText: {
    color: '#FFFFFF',
    fontSize: 14,
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
    borderBottomColor: '#D8E7E1',
  },
  headerBackButton: {
    padding: 4,
    width: 40,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#23423B',
  },
  headerEta: {
    fontSize: 11,
    color: '#6F8B84',
    fontWeight: '600',
    marginTop: 2,
  },
  headerVoiceButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#EEF4F1',
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
    right: 72,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#D8E7E1',
  },
  navIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  navContent: {
    flex: 1,
    marginLeft: 10,
    marginRight: 6,
  },
  navInstruction: {
    fontSize: 13,
    fontWeight: '800',
    color: '#23423B',
    marginBottom: 2,
  },
  navStreet: {
    fontSize: 11,
    color: '#6F8B84',
    fontWeight: '600',
    marginBottom: 4,
  },
  navDistanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#E3F2EB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 3,
  },
  navDistanceText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F6B5A',
  },
  navArrow: {
    marginLeft: 2,
  },

  // Voice FAB
  voiceFab: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#0F6B5A',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0F6B5A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },

  // Bottom Sheet
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 12,
  },

  // Drag Handle
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  dragHandle: {
    width: 32,
    height: 4,
    backgroundColor: '#D8E7E1',
    borderRadius: 2,
  },

  // Progress Bar
  progressContainer: {
    marginBottom: 16,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#EEF4F1',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0F6B5A',
    borderRadius: 2,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressStep: {
    alignItems: 'center',
    gap: 4,
  },
  progressDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#D8E7E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressDotActive: {
    backgroundColor: '#0F6B5A',
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9AB7AF',
  },
  progressLabelActive: {
    color: '#23423B',
    fontWeight: '800',
  },

  // Start Navigation Button
  startNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F6B5A',
    borderRadius: 12,
    padding: 6,
    marginBottom: 12,
  },
  startNavIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  startNavText: {
    flex: 1,
    marginLeft: 10,
  },
  startNavTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  startNavSubtitle: {
    fontSize: 11,
    color: '#9AB7AF',
    marginTop: 1,
  },

  // Active Navigation Controls
  activeNavControls: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  completeNavButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0F6B5A',
    paddingVertical: 14,
    borderRadius: 10,
  },
  completeNavText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Delivery Info Card
  deliveryInfoCard: {
    backgroundColor: '#DDE9E3',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#D8E7E1',
  },
  deliveryInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  deliveryInfoContent: {
    flex: 1,
  },
  deliveryInfoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9AB7AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  deliveryInfoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#23423B',
    lineHeight: 18,
  },
  deliveryDivider: {
    height: 1,
    backgroundColor: '#D8E7E1',
    marginVertical: 10,
  },

  // Proof of Delivery Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContentContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '90%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 24,
  },
  modalAccentBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D8E7E1',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#23423B',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#6F8B84',
    marginTop: 2,
    fontWeight: '600',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EEF4F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScrollContent: {
    paddingBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#35645A',
    marginBottom: 8,
    marginTop: 4,
  },
  optionalLabel: {
    fontSize: 11,
    color: '#9AB7AF',
    fontWeight: '500',
  },
  imageSelectorContainer: {
    flexDirection: 'row',
    backgroundColor: '#DDE9E3',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#D8E7E1',
    borderStyle: 'dashed',
    paddingVertical: 24,
    paddingHorizontal: 12,
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 16,
  },
  selectorButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  selectorText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F6C66',
  },
  selectorDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#D8E7E1',
  },
  previewImageContainer: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D8E7E1',
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  remarksInput: {
    backgroundColor: '#DDE9E3',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D8E7E1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#23423B',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  infoBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF4F1',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
    gap: 4,
  },
  infoBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6F8B84',
  },
  modalActionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#EEF4F1',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4F6C66',
  },
  modalSubmitButton: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: '#0F6B5A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modalSubmitButtonDisabled: {
    backgroundColor: '#9AB7AF',
  },
  modalSubmitButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
