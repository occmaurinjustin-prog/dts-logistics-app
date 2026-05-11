import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { driverService } from '../services/driverService';

export default function TruckInformationScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [truckInfo, setTruckInfo] = useState({
    plateNumber: '',
    vehicleType: '',
    capacity: '',
    condition: '',
    lastMaintenance: '',
    nextInspection: '',
    insuranceStatus: ''
  });

  const handleBack = () => {
    router.back();
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTruckInfo();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchTruckInfo();
    
    // Set up periodic refresh every 30 seconds to check for truck assignment changes
    const interval = setInterval(() => {
      fetchTruckInfo();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchTruckInfo = async () => {
    try {
      if (!refreshing) {
        setLoading(true);
      }
      const truckData = await driverService.getDriverTruckInfo();
      
      if (truckData) {
        setTruckInfo({
          plateNumber: truckData.plate_number || 'N/A',
          vehicleType: truckData.vehicle_type || 'N/A',
          capacity: truckData.capacity || 'N/A',
          condition: truckData.condition || 'Good',
          lastMaintenance: truckData.last_maintenance || 'N/A',
          nextInspection: truckData.next_inspection || 'N/A',
          insuranceStatus: truckData.insurance_status || 'N/A'
        });
        setLastUpdated(new Date());
      } else {
        // Set default values if no data available
        setTruckInfo({
          plateNumber: 'No truck assigned',
          vehicleType: 'N/A',
          capacity: 'N/A',
          condition: 'Unknown',
          lastMaintenance: 'N/A',
          nextInspection: 'N/A',
          insuranceStatus: 'N/A'
        });
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Error fetching truck info:', error);
      // Set error state
      setTruckInfo({
        plateNumber: 'Error loading data',
        vehicleType: 'N/A',
        capacity: 'N/A',
        condition: 'Unknown',
        lastMaintenance: 'N/A',
        nextInspection: 'N/A',
        insuranceStatus: 'N/A'
      });
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Truck Information</Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#22C55E" />
            <Text style={styles.loadingText}>Loading truck information...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Custom Header with Back Button */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Truck Information</Text>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
            <Ionicons name="refresh" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#22C55E']}
              tintColor="#22C55E"
            />
          }
        >
          
          {/* Last Updated Timestamp */}
          {lastUpdated && (
            <View style={styles.timestampContainer}>
              <Text style={styles.timestampText}>
                Last updated: {lastUpdated.toLocaleTimeString()}
              </Text>
            </View>
          )}

          {/* Truck Information Card */}
          <View style={styles.infoCard}>
            <View style={styles.cardHeader}>
              <View style={styles.truckIconContainer}>
                <Ionicons name="car-outline" size={32} color="#22C55E" />
              </View>
              <Text style={styles.cardTitle}>Vehicle Details</Text>
            </View>

            {/* Plate Number */}
            <View style={styles.infoRow}>
              <View style={styles.infoLabelContainer}>
                <Ionicons name="card-outline" size={20} color="#6B7280" />
                <Text style={styles.infoLabel}>Plate Number</Text>
              </View>
              <Text style={styles.infoValue}>{truckInfo.plateNumber}</Text>
            </View>

            {/* Vehicle Type */}
            <View style={styles.infoRow}>
              <View style={styles.infoLabelContainer}>
                <Ionicons name="car-outline" size={20} color="#6B7280" />
                <Text style={styles.infoLabel}>Vehicle Type</Text>
              </View>
              <Text style={styles.infoValue}>{truckInfo.vehicleType}</Text>
            </View>

            {/* Capacity Tons */}
            <View style={styles.infoRow}>
              <View style={styles.infoLabelContainer}>
                <Ionicons name="scale-outline" size={20} color="#6B7280" />
                <Text style={styles.infoLabel}>Capacity (Tons)</Text>
              </View>
              <Text style={styles.infoValue}>{truckInfo.capacity}</Text>
            </View>

            {/* Condition */}
            <View style={styles.infoRow}>
              <View style={styles.infoLabelContainer}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#6B7280" />
                <Text style={styles.infoLabel}>Condition</Text>
              </View>
              <View style={[
                styles.conditionBadge,
                truckInfo.condition === 'Good' && styles.conditionGood,
                truckInfo.condition === 'Fair' && styles.conditionFair,
                truckInfo.condition === 'Poor' && styles.conditionPoor
              ]}>
                <Text style={[
                  styles.conditionText,
                  truckInfo.condition === 'Good' && styles.conditionTextGood,
                  truckInfo.condition === 'Fair' && styles.conditionTextFair,
                  truckInfo.condition === 'Poor' && styles.conditionTextPoor
                ]}>
                  {truckInfo.condition}
                </Text>
              </View>
            </View>
          </View>

          {/* Additional Information Section */}
          <View style={styles.additionalInfoCard}>
            <Text style={styles.sectionTitle}>Additional Information</Text>
            
            <View style={styles.infoItem}>
              <Text style={styles.infoItemLabel}>Last Maintenance</Text>
              <Text style={styles.infoItemValue}>{truckInfo.lastMaintenance}</Text>
            </View>
            
            <View style={styles.infoItem}>
              <Text style={styles.infoItemLabel}>Next Inspection Due</Text>
              <Text style={styles.infoItemValue}>{truckInfo.nextInspection}</Text>
            </View>
            
            <View style={styles.infoItem}>
              <Text style={styles.infoItemLabel}>Insurance Status</Text>
              <Text style={styles.infoItemValue}>{truckInfo.insuranceStatus}</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="document-text-outline" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>View Maintenance History</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]}>
              <Ionicons name="build-outline" size={20} color="#22C55E" />
              <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>Report Issue</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  safeArea: {
    flex: 1,
    paddingTop: 55,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#22C55E',
  },
  backButton: {
    padding: 8,
  },
  refreshButton: {
    padding: 8,
  },
  timestampContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  timestampText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },

  // Info Card Styles
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  truckIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },

  // Info Row Styles
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginLeft: 12,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },

  // Condition Badge Styles
  conditionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  conditionGood: {
    backgroundColor: '#DCFCE7',
  },
  conditionFair: {
    backgroundColor: '#FEF3C7',
  },
  conditionPoor: {
    backgroundColor: '#FEE2E2',
  },
  conditionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  conditionTextGood: {
    color: '#16A34A',
  },
  conditionTextFair: {
    color: '#D97706',
  },
  conditionTextPoor: {
    color: '#DC2626',
  },

  // Additional Info Card
  additionalInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoItemLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  infoItemValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },

  // Action Buttons
  actionButtons: {
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22C55E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    justifyContent: 'center',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#22C55E',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryButtonText: {
    color: '#22C55E',
  },

  // Loading Styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
});

TruckInformationScreen.options = {
  title: 'Truck Information',
  headerShown: false, // Hide default header to use custom header only
};
