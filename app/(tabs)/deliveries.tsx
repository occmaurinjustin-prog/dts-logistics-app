import { AppAlert } from '@/components/AppAlert';
import authService from '@/services/authService';
import driverService, { DriverProfile } from '@/services/driverService';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useInfiniteQuery } from '@tanstack/react-query';
import axios from 'axios';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

// API Configuration
// For physical Android device, use your computer's IP
const YOUR_COMPUTER_IP = '10.65.49.24';

const getApiBaseUrl = () => {
  if (Platform.OS === 'android') {
    // Physical Android device uses your computer's IP
    return `https://consult-powwow-vexingly.ngrok-free.dev/api`;
  }
  // iOS simulator and web use localhost
  return 'https://consult-powwow-vexingly.ngrok-free.dev/api';
};

const API_BASE_URL = getApiBaseUrl();

export default function DeliveriesScreen() {
  try {
    const [selectedTab, setSelectedTab] = useState<'active' | 'completed'>('active');
    const [startingDeliveryId, setStartingDeliveryId] = useState<string | null>(null);
    const [selectedDelivery, setSelectedDelivery] = useState<any>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [deliveries, setDeliveries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);

    // TanStack Query for Infinite Scroll of Completed Deliveries
    const fetchCompletedDeliveries = async ({ pageParam = 1 }) => {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) throw new Error('No auth token');
      
      const response = await axios.get(`${API_BASE_URL}/deliveries`, {
        params: {
          status: 'completed',
          page: pageParam,
          per_page: 10
        },
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.data.success) {
        return response.data; // Expected: { success, data, current_page, last_page, ... }
      } else {
        throw new Error(response.data.message || 'API error');
      }
    };

    const {
      data: infiniteData,
      fetchNextPage,
      hasNextPage,
      isFetchingNextPage,
      isError,
      refetch: refetchCompleted,
      isFetching: isFetchingCompleted
    } = useInfiniteQuery({
      queryKey: ['completed-deliveries'],
      queryFn: fetchCompletedDeliveries,
      initialPageParam: 1,
      getNextPageParam: (lastPage) => {
        if (lastPage.current_page < lastPage.last_page) {
          return lastPage.current_page + 1;
        }
        return undefined;
      },
      enabled: selectedTab === 'completed' && isAuthenticated === true,
    });

    // Flatten pages for rendering
    const mappedCompletedDeliveries = infiniteData ? infiniteData.pages.flatMap((page) => {
      return page.data.map((delivery: any) => ({
        id: `#${delivery.waybill}`,
        waybill: delivery.waybill,
        address: delivery.delivery_address,
        pickup_address: delivery.pickup_address,
        customer: delivery.client?.client_name || 'Unknown',
        client_name: delivery.client?.client_name || 'Unknown',
        driver: delivery.driver?.user?.firstname + ' ' + delivery.driver?.user?.lastname || 'Unassigned',
        driver_name: delivery.driver?.user?.firstname + ' ' + delivery.driver?.user?.lastname || 'Unassigned',
        status: delivery.delivery_status === 'in_transit' ? 'In Transit' :
                delivery.delivery_status === 'delivered' ? 'Delivered' :
                delivery.delivery_status === 'cancelled' ? 'Cancelled' :
                delivery.delivery_status === 'pending' ? 'Pending' :
                delivery.delivery_status === 'assigned' ? 'Assigned' :
                delivery.delivery_status === 'approved' ? 'Approved' : delivery.delivery_status,
        priority: delivery.priority?.toUpperCase() || 'MEDIUM',
        weight_tons: delivery.weight_tons,
        weight: `${delivery.weight_tons} tons`,
        eta: delivery.estimated_delivery_time,
        created_at: delivery.created_at,
        item_description: delivery.item_description,
        requested_by: delivery.user?.username || 'Unknown',
        completedAt: (delivery.delivery_status === 'delivered' || delivery.delivery_status === 'Delivered') && delivery.updated_at 
          ? new Date(delivery.updated_at).toLocaleTimeString() 
          : null,
        podImage: delivery.proof_image_url || delivery.proof_image || delivery.pod_image || null,
        originalData: delivery,
      }));
    }) : [];

    // Fetch active deliveries from API
    const fetchDeliveries = useCallback(async (showLoading = true) => {
      if (showLoading && selectedTab === 'active') setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      
      if (!token) {
        console.log('No auth token found');
        setDeliveries([]);
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }
      
      setIsAuthenticated(true);

      // Fetch driver profile to check status
      const profile = await driverService.getDriverProfile();
      setDriverProfile(profile);
      
      const response = await axios.get(`${API_BASE_URL}/deliveries`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.data.success) {
        // Transform API data to match the expected format
        const transformedDeliveries = response.data.deliveries.map((delivery: any) => ({
          id: `#${delivery.waybill}`,
          waybill: delivery.waybill,
          address: delivery.delivery_address,
          pickup_address: delivery.pickup_address,
          customer: delivery.client?.client_name || 'Unknown',
          client_name: delivery.client?.client_name || 'Unknown',
          driver: delivery.driver?.user?.firstname + ' ' + delivery.driver?.user?.lastname || 'Unassigned',
          driver_name: delivery.driver?.user?.firstname + ' ' + delivery.driver?.user?.lastname || 'Unassigned',
          status: delivery.delivery_status === 'in_transit' ? 'In Transit' :
                  delivery.delivery_status === 'delivered' ? 'Delivered' :
                  delivery.delivery_status === 'pending' ? 'Pending' :
                  delivery.delivery_status === 'assigned' ? 'Assigned' :
                  delivery.delivery_status === 'approved' ? 'Approved' : delivery.delivery_status,
          priority: delivery.priority?.toUpperCase() || 'MEDIUM',
          weight_tons: delivery.weight_tons,
          weight: `${delivery.weight_tons} tons`,
          eta: delivery.estimated_delivery_time,
          created_at: delivery.created_at,
          item_description: delivery.item_description,
          requested_by: delivery.user?.username || 'Unknown',
          completedAt: (delivery.delivery_status === 'delivered' || delivery.delivery_status === 'Delivered') && delivery.updated_at 
            ? new Date(delivery.updated_at).toLocaleTimeString() 
            : null,
          podImage: delivery.proof_image_url || delivery.proof_image || delivery.pod_image || null,
          // Keep original data for reference
          originalData: delivery,
        }));
        
        setDeliveries(transformedDeliveries);
        setLastUpdated(new Date());
      } else {
        console.error('API returned error:', response.data);
      }
    } catch (error: any) {
      console.error('Error fetching deliveries:', error);
      console.error('Error message:', error.message);
      console.error('Error code:', error.code);
      
      // Network error (no response from server)
      if (!error.response) {
        console.error('Network error - no response from server');
        AppAlert.alert(
          'Network Error', 
          'Cannot connect to server. Please check:\n\n1. Is your Laravel backend running?\n2. Is your phone on the same WiFi as your computer?\n3. Check API URL in authService.ts\n\nRun: php artisan serve --host=0.0.0.0',
          [{ text: 'OK' }]
        );
      } else if (error.response?.status === 401) {
        setIsAuthenticated(false);
        // Check what token we have
        const currentToken = await AsyncStorage.getItem('authToken');
        console.log('Current token (first 50 chars):', currentToken?.substring(0, 50));
        AppAlert.alert(
          'Session Expired', 
          'Your login session is invalid. Please clear storage and login again.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Clear & Login', 
              onPress: async () => {
                await AsyncStorage.clear();
                await authService.clearStorage();
                setIsAuthenticated(false);
                // Redirect to login
                if (typeof window !== 'undefined') {
                  window.location.href = '/login';
                }
              }
            }
          ]
        );
      } else if (error.response?.status === 500) {
        // Server error - show the error message
        const serverMessage = error.response?.data?.message || 'Server error. Please check if the backend is running properly.';
        console.error('Server error:', serverMessage);
        AppAlert.alert(
          'Server Error', 
          serverMessage,
          [{ text: 'OK' }]
        );
      } else {
        // Other errors
        AppAlert.alert(
          'Error', 
          `Failed to load deliveries. Status: ${error.response?.status || 'Unknown'}`,
          [{ text: 'OK' }]
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial fetch for Active tab
  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  // Auto-refresh every 5 seconds for real-time updates on active tab
  useEffect(() => {
    const interval = setInterval(() => {
      if (selectedTab === 'active') {
        fetchDeliveries(false);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchDeliveries, selectedTab]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (selectedTab === 'active') {
      fetchDeliveries(false);
    } else {
      refetchCompleted().finally(() => setRefreshing(false));
    }
  }, [fetchDeliveries, selectedTab, refetchCompleted]);

  // Filter deliveries based on tab (only applies to active now)
  // Driver only sees deliveries AFTER admin sends them (status: Assigned, In Transit)
  const activeDeliveries = deliveries.filter(d => 
    d.status === 'Assigned' || d.status === 'In Transit'
  );
  
  const completedDeliveries = mappedCompletedDeliveries;

  const handleEndReached = () => {
    if (selectedTab === 'completed' && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const renderFooter = () => {
    if (selectedTab !== 'completed' || !isFetchingNextPage) return null;
    return (
      <View style={{ paddingVertical: 20 }}>
        <ActivityIndicator size="small" color="#10B981" />
      </View>
    );
  };

  const openDetailModal = (delivery: any) => {
    setSelectedDelivery(delivery);
    setShowDetailModal(true);
  };

  // Helper function to perform the actual API call
  const performStartDelivery = async (delivery: any) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        AppAlert.alert('Error', 'Not authenticated');
        return;
      }

      console.log('Starting delivery...', delivery.originalData?.delivery_id);
      
      // FIXED: Only set to in_transit if driver is actually in navigation and has confirmed pickup
      // This should NOT be used here - status should only change in navigation.tsx after confirm pickup
      const response = await axios.put(
        `${API_BASE_URL}/deliveries/${delivery.originalData.delivery_id}/status`,
        { delivery_status: 'assigned' }, // Keep as assigned until driver confirms pickup in navigation
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success) {
        AppAlert.alert('Success', 'Delivery started! Navigate to pickup location.');
        fetchDeliveries();
      } else {
        AppAlert.alert('Error', response.data.message || 'Failed to start delivery');
      }
    } catch (error: any) {
      console.error('Error starting delivery:', error);
      AppAlert.alert('Error', error.response?.data?.message || 'Failed to start delivery');
    } finally {
      setStartingDeliveryId(null);
    }
  };

  // Start delivery - change status from assigned/approved to in_transit
  const startDelivery = async (delivery: any) => {
    // Mark this delivery as starting to disable the button instantly
    setStartingDeliveryId(delivery.id ?? delivery.delivery_id ?? String(delivery.originalData?.delivery_id));
    console.log('startDelivery called! Status:', delivery.status);

    // Check if driver is busy
    if (driverService.isDriverBusy(driverProfile?.status)) {
      AppAlert.alert(
        'Driver Busy',
        `You are currently ${driverService.getStatusDisplay(driverProfile?.status)} and cannot start a new delivery. Please complete your current delivery first.`,
        [
          { text: 'View Current Delivery', onPress: () => setSelectedTab('active') },
          { text: 'OK', style: 'cancel' }
        ]
      );
      setStartingDeliveryId(null);
      return;
    }
    
    // Check if can start
    const canStart = delivery.status === 'Assigned' || delivery.status === 'Approved' ||
                     delivery.originalData?.delivery_status === 'assigned' || delivery.originalData?.delivery_status === 'approved';
    
    if (!canStart) {
      const msg = `Cannot start: Status is "${delivery.status}". Only Assigned or Approved can be started.`;
      console.log(msg);
      AppAlert.alert('Cannot Start', msg);
      setStartingDeliveryId(null);
      return;
    }

    // Show confirmation dialog
    const confirmMsg = `Start delivery ${delivery.waybill}?`;
    
    // Check if running on web with confirm dialog available
    const isWeb = Platform.OS === 'web';
    if (isWeb && typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const confirmed = window.confirm(confirmMsg);
      if (!confirmed) {
        console.log('Start delivery cancelled');
        setStartingDeliveryId(null);
        return;
      }
      await performStartDelivery(delivery);
    } else {
      // For mobile, use Alert.alert
      // After API call finishes, clear the loading flag
      AppAlert.alert(
        'Start Delivery',
        confirmMsg,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              console.log('Start delivery cancelled');
              setStartingDeliveryId(null);
            }
          },
          {
            text: 'Start',
            style: 'default',
            // Ensure flag cleared whether user confirms or cancels
            onPress: () => {
              performStartDelivery(delivery);
            }
          }
        ]
      );
    }
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setTimeout(() => setSelectedDelivery(null), 300);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved': return '#6366F1';
      case 'Delivered': return '#10B981';
      case 'Pending': return '#F59E0B';
      case 'In Progress': return '#3B82F6';
      default: return '#6B7280';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderDeliveryCard = (delivery: any, index: number) => (
    <View key={index} style={styles.deliveryCard}>
      <View style={styles.deliveryHeader}>
        <View style={[styles.deliveryIcon, { backgroundColor: '#ECFDF5' }]}>
          <Ionicons name="cube" size={18} color="#10B981" />
        </View>
        <View style={styles.deliveryInfo}>
          <Text style={styles.deliveryId}>Waybill #{delivery.waybill}</Text>
          <Text style={[styles.deliveryStatus, { 
            color: delivery.status === 'In Transit' || delivery.status === 'In Progress' ? '#EF4444' : 
                   delivery.status === 'Delivered' ? '#10B981' : '#3B82F6' 
          }]}>
            {delivery.status}
          </Text>
        </View>
      </View>
      <View style={styles.deliveryDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="person-outline" size={14} color="#64748B" />
          <Text style={styles.detailText}>{delivery.customer}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={14} color="#64748B" />
          <Text style={styles.detailText} numberOfLines={1}>{delivery.address}</Text>
        </View>
        {delivery.eta && (
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={14} color="#64748B" />
            <Text style={styles.detailText}>ETA: {delivery.eta}</Text>
          </View>
        )}
        {delivery.completedAt && (
          <View style={styles.detailRow}>
            <Ionicons name="checkmark-circle-outline" size={14} color="#10B981" />
            <Text style={[styles.detailText, { color: '#10B981' }]}>Completed at {delivery.completedAt}</Text>
          </View>
        )}
      </View>
      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={[
            styles.startButton,
            (delivery.status === 'In Transit' || delivery.status === 'in_transit') && styles.inTransitButton
          ]}
          onPress={() => {
            console.log('Start button clicked! Status:', delivery.status);
            startDelivery(delivery);
          }}
          disabled={
            delivery.status === 'In Transit' ||
            delivery.status === 'in_transit' ||
            delivery.status === 'Delivered' ||
            startingDeliveryId === (delivery.id ?? delivery.delivery_id ?? String(delivery.originalData?.delivery_id))
          }
        >
          <Text style={styles.startButtonText}>
            {delivery.status === 'In Transit' || delivery.status === 'in_transit' 
              ? 'In Transit' 
              : delivery.status === 'Delivered' 
                ? 'Delivered' 
                : 'Start Delivery'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => openDetailModal(delivery)}
        >
          <Text style={styles.actionButtonText}>View Details</Text>
        </TouchableOpacity>
      </View>
      
      {/* Show status badge on card for delivered items */}
      {delivery.status === 'Delivered' && (
        <View style={[styles.cardStatusBadge, { backgroundColor: '#D1FAE5' }]}>
          <Text style={[styles.cardStatusText, { color: '#10B981' }]}>Completed</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.title}>Shipments</Text>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'active' && styles.activeTab]}
            onPress={() => setSelectedTab('active')}
          >
            <Text style={[styles.tabText, selectedTab === 'active' && styles.activeTabText]}>
              Active ({activeDeliveries.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'completed' && styles.activeTab]}
            onPress={() => setSelectedTab('completed')}
          >
            <Text style={[styles.tabText, selectedTab === 'completed' && styles.activeTabText]}>
              Completed ({completedDeliveries.length})
            </Text>
          </TouchableOpacity>
        </View>

        {loading && deliveries.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.loadingText}>Synchronizing shipments...</Text>
          </View>
        ) : isAuthenticated === false ? (
          <ScrollView 
            style={styles.scrollView} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.notLoggedInContainer}
          >
            <View style={styles.emptyContainer}>
              <Ionicons name="lock-closed-outline" size={60} color="#94A3B8" />
              <Text style={[styles.emptyTitle, { color: '#0F172A' }]}>Not Logged In</Text>
              <Text style={styles.emptyText}>Please login to view your assigned deliveries</Text>
              <TouchableOpacity 
                style={styles.loginButton}
                onPress={async () => {
                  await AsyncStorage.clear();
                  await authService.clearStorage();
                  AppAlert.alert('Storage Cleared', 'Redirecting to login...');
                  setIsAuthenticated(false);
                  if (typeof window !== 'undefined') {
                    window.location.href = '/login';
                  }
                }}
              >
                <Text style={styles.loginButtonText}>Clear & Re-login</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.loginButton, { backgroundColor: '#64748B', marginTop: 10 }]}
                onPress={async () => {
                  await authService.debugStorage();
                  const token = await AsyncStorage.getItem('authToken');
                  AppAlert.alert('Debug Info', `Token exists: ${!!token}\nToken start: ${token?.substring(0, 20) || 'none'}...`);
                }}
              >
                <Text style={styles.loginButtonText}>Debug Storage</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          <FlatList
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            data={selectedTab === 'active' ? activeDeliveries : completedDeliveries}
            keyExtractor={(item, index) => item.originalData?.id?.toString() || index.toString()}
            renderItem={({ item, index }) => renderDeliveryCard(item, index)}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            ListFooterComponent={renderFooter}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />
            }
            ListHeaderComponent={
              <View style={styles.updateIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.updateText}>System Sync • {lastUpdated.toLocaleTimeString()}</Text>
              </View>
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons 
                  name={selectedTab === 'active' ? "cube-outline" : "checkmark-circle-outline"} 
                  size={60} 
                  color="#94A3B8" 
                />
                <Text style={styles.emptyTitle}>
                  {selectedTab === 'active' ? "No Active Deliveries" : "No Completed Deliveries"}
                </Text>
                <Text style={styles.emptyText}>
                  {selectedTab === 'active' ? "New deliveries will appear here when assigned" : "Finished deliveries will appear here"}
                </Text>
              </View>
            }
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        )}
      </SafeAreaView>

      {/* Delivery Detail Modal */}
      <Modal animationType="slide" transparent={true} visible={showDetailModal} onRequestClose={closeDetailModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={[styles.modalIcon, { backgroundColor: '#ECFDF5' }]}>
                  <Ionicons name="cube" size={20} color="#10B981" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Waybill #{selectedDelivery?.waybill}</Text>
                  <Text style={styles.modalDate}>{formatDate(selectedDelivery?.created_at)}</Text>
                </View>
              </View>
              <View style={styles.modalHeaderRight}>
                {selectedDelivery?.status && (
                  <View style={[styles.statusBadge, { 
                    backgroundColor: selectedDelivery.status === 'Delivered' ? '#D1FAE5' : '#EFF6FF'
                  }]}>
                    <Text style={[styles.statusBadgeText, { 
                      color: selectedDelivery.status === 'Delivered' ? '#10B981' : '#2563EB' 
                    }]}>
                      {selectedDelivery.status}
                    </Text>
                  </View>
                )}
                <TouchableOpacity onPress={closeDetailModal} style={styles.closeButton}>
                  <Ionicons name="close-outline" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* Info Grid */}
              <View style={styles.infoGrid}>
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>Client Partner</Text>
                  <Text style={styles.infoValue}>{selectedDelivery?.client_name || selectedDelivery?.customer}</Text>
                </View>
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>Assigned Driver</Text>
                  <Text style={styles.infoValue}>{selectedDelivery?.driver_name || selectedDelivery?.driver}</Text>
                </View>
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>Cargo Weight</Text>
                  <Text style={styles.infoValue}>{selectedDelivery?.weight || selectedDelivery?.weight_tons + ' tons'}</Text>
                </View>
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>Priority Level</Text>
                  <Text style={[styles.infoValue, { 
                    color: selectedDelivery?.priority === 'HIGH' ? '#EF4444' : 
                           selectedDelivery?.priority === 'MEDIUM' ? '#F59E0B' : '#10B981'
                  }]}>
                    {selectedDelivery?.priority}
                  </Text>
                </View>
              </View>

              {/* Addresses */}
              <View style={styles.addressSection}>
                <View style={styles.addressCard}>
                  <View style={styles.addressHeader}>
                    <Ionicons name="location-outline" size={16} color="#6366F1" />
                    <Text style={styles.addressLabel}>Pickup Location</Text>
                  </View>
                  <Text style={styles.addressText}>{selectedDelivery?.pickup_address}</Text>
                </View>

                <View style={styles.addressArrow}>
                  <Ionicons name="arrow-down-outline" size={18} color="#94A3B8" />
                </View>

                <View style={styles.addressCard}>
                  <View style={styles.addressHeader}>
                    <Ionicons name="navigate-outline" size={16} color="#10B981" />
                    <Text style={styles.addressLabel}>Delivery Address</Text>
                  </View>
                  <Text style={styles.addressText}>{selectedDelivery?.address}</Text>
                </View>
              </View>

              {/* Item Description */}
              <View style={styles.descriptionCard}>
                <Text style={styles.descriptionLabel}>Item Description</Text>
                <Text style={styles.descriptionText}>{selectedDelivery?.item_description}</Text>
              </View>

              {/* Proof of Delivery Image */}
              {selectedDelivery?.status === 'Delivered' && selectedDelivery?.podImage && (
                <View style={styles.descriptionCard}>
                  <Text style={styles.descriptionLabel}>Proof of Delivery</Text>
                  {(() => {
                    // Helper to ensure the image URI is absolute
                    const getAbsoluteUrl = (uri: string | undefined) => {
                      if (!uri) return null;
                      // If already an absolute URL, return as is
                      if (uri.startsWith('http://') || uri.startsWith('https://')) {
                        return uri;
                      }
                      // Otherwise prepend the API base URL (adjust as needed)
                      const API_BASE_URL = Platform.OS === 'web' ? 'https://consult-powwow-vexingly.ngrok-free.dev' : 'https://consult-powwow-vexingly.ngrok-free.dev';
                      // Ensure no leading slash duplication
                      const cleanUri = uri.startsWith('/') ? uri.slice(1) : uri;
                      return `${API_BASE_URL}/${cleanUri}`;
                    };
                    const imageUrl = getAbsoluteUrl(selectedDelivery?.podImage);
                    return imageUrl ? (
                      <Image
                        source={{ uri: imageUrl }}
                        style={{ width: '100%', height: 200, borderRadius: 8, marginTop: 8 }}
                        resizeMode="cover"
                      />
                    ) : (
                      <Text style={styles.emptyText}>Proof of Delivery image not available</Text>
                    );
                  })()}
                </View>
              )}

              {/* Requested By */}
              <View style={styles.requestedByContainer}>
                <Text style={styles.requestedByText}>
                  Dispatched under authorization of: {selectedDelivery?.requested_by}
                </Text>
              </View>
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.closeModalButton} onPress={closeDetailModal}>
                <Text style={styles.closeModalButtonText}>Dismiss View</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
  } catch (error: any) {
    console.error('CRITICAL ERROR in DeliveriesScreen:', error);
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#10B981',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  activeTabText: {
    color: '#10B981',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  deliveryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
  },
  deliveryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  deliveryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  deliveryInfo: {
    flex: 1,
  },
  deliveryId: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  deliveryStatus: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  deliveryDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailText: {
    fontSize: 14,
    color: '#070907',
    marginLeft: 10,
    flex: 1,
    fontWeight: '500',
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  startButton: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  inTransitButton: {
    backgroundColor: '#EF4444',
  },
  actionButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    borderColor: '#E2E8F0',
    borderWidth: 1,
  },
  actionButtonText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalDate: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '600',
  },
  modalHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  closeButton: {
    padding: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  modalContent: {
    padding: 16,
    backgroundColor: '#F8FAFC',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  infoCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoLabel: {
    fontSize: 9,
    color: '#94A3B8',
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  addressSection: {
    marginBottom: 16,
  },
  addressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  addressLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  addressText: {
    fontSize: 13,
    color: '#0F172A',
    lineHeight: 18,
    fontWeight: '600',
  },
  addressArrow: {
    alignItems: 'center',
    marginVertical: 4,
  },
  descriptionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  descriptionLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  descriptionText: {
    fontSize: 13,
    color: '#0F172A',
    lineHeight: 18,
    fontWeight: '600',
  },
  requestedByContainer: {
    paddingVertical: 4,
    alignItems: 'center',
  },
  requestedByText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  closeModalButton: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeModalButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Loading & Empty State Styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  // Live Update Indicator
  updateIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  updateText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  // Card Status Badge
  cardStatusBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  cardStatusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  // Not Logged In State
  notLoggedInContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  loginButton: {
    marginTop: 16,
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
