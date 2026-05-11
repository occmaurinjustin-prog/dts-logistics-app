import authService from '@/services/authService';
import driverService, { DriverProfile } from '@/services/driverService';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

// API Configuration
// For physical Android device, use your computer's IP
const YOUR_COMPUTER_IP = '10.26.16.24';

const getApiBaseUrl = () => {
  if (Platform.OS === 'android') {
    // Physical Android device uses your computer's IP
    return `http://${YOUR_COMPUTER_IP}:8000/api`;
  }
  // iOS simulator and web use localhost
  return 'http://localhost:8000/api';
};

const API_BASE_URL = getApiBaseUrl();

export default function DeliveriesScreen() {
  try {
    const [selectedTab, setSelectedTab] = useState<'active' | 'completed'>('active');
    const [selectedDelivery, setSelectedDelivery] = useState<any>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [deliveries, setDeliveries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);

    // Fetch deliveries from API
    const fetchDeliveries = useCallback(async (showLoading = true) => {
      if (showLoading) setLoading(true);
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
          id: `#${delivery.tracking_number}`,
          tracking_number: delivery.tracking_number,
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
          completedAt: delivery.delivery_status === 'delivered' ? new Date(delivery.updated_at).toLocaleTimeString() : null,
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
        Alert.alert(
          'Network Error', 
          'Cannot connect to server. Please check:\n\n1. Is your Laravel backend running?\n2. Is your phone on the same WiFi as your computer?\n3. Check API URL in authService.ts\n\nRun: php artisan serve --host=0.0.0.0',
          [{ text: 'OK' }]
        );
      } else if (error.response?.status === 401) {
        setIsAuthenticated(false);
        // Check what token we have
        const currentToken = await AsyncStorage.getItem('authToken');
        console.log('Current token (first 50 chars):', currentToken?.substring(0, 50));
        Alert.alert(
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
        Alert.alert(
          'Server Error', 
          serverMessage,
          [{ text: 'OK' }]
        );
      } else {
        // Other errors
        Alert.alert(
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

  // Initial fetch
  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  // Auto-refresh every 5 seconds for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDeliveries(false);
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchDeliveries]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDeliveries(false);
  }, [fetchDeliveries]);

  // Filter deliveries based on tab
  // Driver only sees deliveries AFTER admin sends them (status: Assigned, In Transit)
  const activeDeliveries = deliveries.filter(d => 
    d.status === 'Assigned' || d.status === 'In Transit'
  );
  
  const completedDeliveries = deliveries.filter(d => 
    d.status === 'Delivered' || d.status === 'Cancelled'
  );

  const openDetailModal = (delivery: any) => {
    setSelectedDelivery(delivery);
    setShowDetailModal(true);
  };

  // Helper function to perform the actual API call
  const performStartDelivery = async (delivery: any) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        Alert.alert('Error', 'Not authenticated');
        return;
      }

      console.log('Starting delivery...', delivery.originalData?.delivery_id);
      
      const response = await axios.put(
        `${API_BASE_URL}/deliveries/${delivery.originalData.delivery_id}/status`,
        { delivery_status: 'in_transit' },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success) {
        Alert.alert('Success', 'Delivery started! Status changed to In Transit');
        fetchDeliveries();
      } else {
        Alert.alert('Error', response.data.message || 'Failed to start delivery');
      }
    } catch (error: any) {
      console.error('Error starting delivery:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to start delivery');
    }
  };

  // Start delivery - change status from assigned/approved to in_transit
  const startDelivery = async (delivery: any) => {
    console.log('startDelivery called! Status:', delivery.status);

    // Check if driver is busy
    if (driverService.isDriverBusy(driverProfile?.status)) {
      Alert.alert(
        'Driver Busy',
        `You are currently ${driverService.getStatusDisplay(driverProfile?.status)} and cannot start a new delivery. Please complete your current delivery first.`,
        [
          { text: 'View Current Delivery', onPress: () => setSelectedTab('active') },
          { text: 'OK', style: 'cancel' }
        ]
      );
      return;
    }
    
    // Check if can start
    const canStart = delivery.status === 'Assigned' || delivery.status === 'Approved' ||
                     delivery.originalData?.delivery_status === 'assigned' || delivery.originalData?.delivery_status === 'approved';
    
    if (!canStart) {
      const msg = `Cannot start: Status is "${delivery.status}". Only Assigned or Approved can be started.`;
      console.log(msg);
      Alert.alert('Cannot Start', msg);
      return;
    }

    // Show confirmation dialog
    const confirmMsg = `Start delivery ${delivery.tracking_number}?`;
    
    // Check if running on web with confirm dialog available
    const isWeb = Platform.OS === 'web';
    if (isWeb && typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const confirmed = window.confirm(confirmMsg);
      if (!confirmed) {
        console.log('Start delivery cancelled');
        return;
      }
      await performStartDelivery(delivery);
    } else {
      // For mobile, use Alert.alert
      Alert.alert(
        'Start Delivery',
        confirmMsg,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              console.log('Start delivery cancelled');
            }
          },
          {
            text: 'Start',
            style: 'default',
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
        <View style={styles.deliveryIcon}>
          <Ionicons name="cube-outline" size={24} color="#070907" />
        </View>
        <View style={styles.deliveryInfo}>
          <Text style={styles.deliveryId}>{delivery.id}</Text>
          <Text style={[styles.deliveryStatus, { color: getStatusColor(delivery.status) }]}>
            {delivery.status}
          </Text>
        </View>
      </View>
      <View style={styles.deliveryDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="person-outline" size={16} color="#e3e2fa" />
          <Text style={styles.detailText}>{delivery.customer}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={16} color="#e3e2fa" />
          <Text style={styles.detailText} numberOfLines={1}>{delivery.address}</Text>
        </View>
        {delivery.eta && (
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={16} color="#e3e2fa" />
            <Text style={styles.detailText}>ETA: {delivery.eta}</Text>
          </View>
        )}
        {delivery.completedAt && (
          <View style={styles.detailRow}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#e3e2fa" />
            <Text style={styles.detailText}>Completed at {delivery.completedAt}</Text>
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
          disabled={delivery.status === 'In Transit' || delivery.status === 'in_transit' || delivery.status === 'Delivered'}
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
        <View style={[styles.cardStatusBadge, { backgroundColor: '#10B98120' }]}>
          <Text style={[styles.cardStatusText, { color: '#10B981' }]}>Completed</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.title}>Deliveries</Text>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'active' && styles.activeTab]}
            onPress={() => setSelectedTab('active')}
          >
            <Text style={[styles.tabText, selectedTab === 'active' && styles.activeTabText]}>
              Active
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'completed' && styles.activeTab]}
            onPress={() => setSelectedTab('completed')}
          >
            <Text style={[styles.tabText, selectedTab === 'completed' && styles.activeTabText]}>
              Completed
            </Text>
          </TouchableOpacity>
        </View>

        {loading && deliveries.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={styles.loadingText}>Loading deliveries...</Text>
          </View>
        ) : isAuthenticated === false ? (
          <ScrollView 
            style={styles.scrollView} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.notLoggedInContainer}
          >
            <View style={styles.emptyContainer}>
              <Ionicons name="lock-closed-outline" size={64} color="#e3e2fa" />
              <Text style={[styles.emptyTitle, { color: '#e3e2fa' }]}>Not Logged In</Text>
              <Text style={styles.emptyText}>Please login to view your assigned deliveries</Text>
              <TouchableOpacity 
                style={styles.loginButton}
                onPress={async () => {
                  await AsyncStorage.clear();
                  await authService.clearStorage();
                  Alert.alert('Storage Cleared', 'Redirecting to login...');
                  setIsAuthenticated(false);
                  // Redirect to login page
                  if (typeof window !== 'undefined') {
                    window.location.href = '/login';
                  }
                }}
              >
                <Text style={styles.loginButtonText}>Clear & Re-login</Text>
              </TouchableOpacity>
              
              {/* Debug button */}
              <TouchableOpacity 
                style={[styles.loginButton, { backgroundColor: '#6B7280', marginTop: 10 }]}
                onPress={async () => {
                  await authService.debugStorage();
                  const token = await AsyncStorage.getItem('authToken');
                  Alert.alert('Debug Info', `Token exists: ${!!token}\nToken start: ${token?.substring(0, 20) || 'none'}...`);
                }}
              >
                <Text style={styles.loginButtonText}>Debug Storage</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          <ScrollView 
            style={styles.scrollView} 
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {/* Last updated indicator */}
            <View style={styles.updateIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.updateText}>Live • {lastUpdated.toLocaleTimeString()}</Text>
            </View>
            
            {selectedTab === 'active' ? (
            <>
              {activeDeliveries.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="cube-outline" size={64} color="#3BC240" />
                  <Text style={styles.emptyTitle}>No Active Deliveries</Text>
                  <Text style={styles.emptyText}>New deliveries will appear here when assigned</Text>
                </View>
              ) : (
                activeDeliveries.map((delivery, index) => renderDeliveryCard(delivery, index))
              )}
            </>
          ) : (
            <>
              {completedDeliveries.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="checkmark-circle-outline" size={64} color="#e3e2fa" />
                  <Text style={styles.emptyTitle}>No Completed Deliveries</Text>
                  <Text style={styles.emptyText}>Finished deliveries will appear here</Text>
                </View>
              ) : (
                completedDeliveries.map((delivery, index) => renderDeliveryCard(delivery, index))
              )}
            </>
          )}
        </ScrollView>
      )}
      </SafeAreaView>

      {/* Delivery Detail Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showDetailModal}
        onRequestClose={closeDetailModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalIcon}>
                  <Ionicons name="cube-outline" size={24} color="#070907" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>#{selectedDelivery?.tracking_number}</Text>
                  <Text style={styles.modalDate}>{formatDate(selectedDelivery?.created_at)}</Text>
                </View>
              </View>
              <View style={styles.modalHeaderRight}>
                {selectedDelivery?.status && (
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedDelivery.status) + '20' }]}>
                    <Text style={[styles.statusBadgeText, { color: getStatusColor(selectedDelivery.status) }]}>
                      {selectedDelivery.status}
                    </Text>
                  </View>
                )}
                <TouchableOpacity onPress={closeDetailModal} style={styles.closeButton}>
                  <Ionicons name="close-outline" size={24} color="#e3e2fa" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* Info Grid */}
              <View style={styles.infoGrid}>
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>Client</Text>
                  <Text style={styles.infoValue}>{selectedDelivery?.client_name || selectedDelivery?.customer}</Text>
                </View>
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>Driver</Text>
                  <Text style={styles.infoValue}>{selectedDelivery?.driver_name || selectedDelivery?.driver}</Text>
                </View>
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>Weight</Text>
                  <Text style={styles.infoValue}>{selectedDelivery?.weight || selectedDelivery?.weight_tons + ' tons'}</Text>
                </View>
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>Priority</Text>
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
                    <Ionicons name="location-outline" size={18} color="#e3e2fa" />
                    <Text style={styles.addressLabel}>Pickup Address</Text>
                  </View>
                  <Text style={styles.addressText}>{selectedDelivery?.pickup_address}</Text>
                </View>

                <View style={styles.addressArrow}>
                  <Ionicons name="arrow-down-outline" size={20} color="#e3e2fa" />
                </View>

                <View style={styles.addressCard}>
                  <View style={styles.addressHeader}>
                    <Ionicons name="navigate-outline" size={18} color="#e3e2fa" />
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

              {/* Requested By */}
              <View style={styles.requestedByContainer}>
                <Text style={styles.requestedByText}>
                  Requested by {selectedDelivery?.requested_by}
                </Text>
              </View>
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.closeModalButton} onPress={closeDetailModal}>
                <Text style={styles.closeModalButtonText}>Close</Text>
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
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3BC240',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#070907',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#3BC240',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#3BC240',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#070907',
  },
  activeTabText: {
    color: '#3BC240',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  deliveryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#3BC240',
    marginBottom: 16,
    shadowColor: '#3BC240',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  deliveryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  deliveryIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderColor: '#3BC240',
    borderWidth: 1,
    shadowColor: '#3BC240',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  deliveryInfo: {
    flex: 1,
  },
  deliveryId: {
    fontSize: 17,
    fontWeight: '700',
    color: '#070907',
    letterSpacing: 0.3,
  },
  deliveryStatus: {
    fontSize: 13,
    marginTop: 4,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  deliveryDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
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
    gap: 10,
    marginTop: 12,
  },
  startButton: {
    backgroundColor: '#3BC240',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '48%',
    minHeight: 56,
    shadowColor: '#3BC240',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  inTransitButton: {
    backgroundColor: '#3BC240',
    shadowColor: '#3BC240',
  },
  actionButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '48%',
    minHeight: 56,
    borderColor: '#3BC240',
    borderWidth: 1,
    shadowColor: '#3BC240',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  actionButtonText: {
    color: '#3BC240',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  // Modal Styles - Ultra Enhanced with Glassmorphism
  modalOverlay: {
    flex: 1,

    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#3BC240',
    borderRadius: 24,
    width: '100%',
    maxWidth: 440,
    maxHeight: '88%',
    shadowColor: '#3BC240',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 15,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#3BC240',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#FFFFFF',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderColor: '#3BC240',
    borderWidth: 1,
    shadowColor: '#3BC240',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#070907',
    letterSpacing: 0,
  },
  modalDate: {
    fontSize: 13,
    color: '#070907',
    marginTop: 4,
    fontWeight: '600',
  },
  modalHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#070907',
    borderWidth: 1,
    borderColor: '#7059BC',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#3BC240',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  modalContent: {
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  infoCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#3BC240',
    shadowColor: '#3BC240',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  infoLabel: {
    fontSize: 11,
    color: '#070907',
    marginBottom: 8,
    textTransform: 'uppercase',
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#070907',
    letterSpacing: -0.3,
  },
  addressSection: {
    marginBottom: 20,
  },
  addressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#3BC240',
    marginBottom: 16,
    shadowColor: '#3BC240',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  addressLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#070907',
  },
  addressText: {
    fontSize: 14,
    color: '#070907',
    lineHeight: 20,
  },
  addressArrow: {
    alignItems: 'center',
    marginVertical: 8,
  },
  descriptionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#3BC240',
    marginBottom: 16,
  },
  descriptionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#070907',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  descriptionText: {
    fontSize: 15,
    color: '#070907',
    lineHeight: 22,
    fontWeight: '600',
  },
  requestedByContainer: {
    paddingVertical: 8,
  },
  requestedByText: {
    fontSize: 13,
    color: '#070907',
  },
  modalFooter: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
  },
  closeModalButton: {
    backgroundColor: '#3BC240',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3BC240',
  },
  closeModalButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  // Loading & Empty State Styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#070907',
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#070907',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#070907',
    textAlign: 'center',
  },
  // Live Update Indicator
  updateIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  updateText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  // Card Status Badge
  cardStatusBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  cardStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  // Not Logged In State
  notLoggedInContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  loginButton: {
    marginTop: 20,
    backgroundColor: '#6366F1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
