import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
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
              <Ionicons name="arrow-back" size={22} color="#23423B" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Truck Information</Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0F6B5A" />
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
            <Ionicons name="arrow-back" size={22} color="#23423B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Truck Information</Text>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
            <Ionicons name="refresh" size={20} color="#23423B" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#0F6B5A']}
              tintColor="#0F6B5A"
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
                <Ionicons name="car-outline" size={32} color="#0F6B5A" />
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
              <Ionicons name="build-outline" size={20} color="#0F6B5A" />
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
    backgroundColor: '#DDE9E3',
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 0 : 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#D8E7E1',
  },
  backButton: {
    padding: 4,
  },
  refreshButton: {
    padding: 4,
  },
  timestampContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    marginTop: 14,
    marginBottom: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D8E7E1',
  },
  timestampText: {
    fontSize: 11,
    color: '#9AB7AF',
    fontWeight: '500',
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#23423B',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },

  // Info Card Styles
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#D8E7E1',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  truckIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E3F2EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#23423B',
  },

  // Info Row Styles
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF4F1',
  },
  infoLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4F6C66',
    marginLeft: 10,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#23423B',
  },

  // Condition Badge Styles
  conditionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  conditionGood: {
    backgroundColor: '#E3F2EB',
  },
  conditionFair: {
    backgroundColor: '#FEF3C7',
  },
  conditionPoor: {
    backgroundColor: '#FEF2F2',
  },
  conditionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  conditionTextGood: {
    color: '#0F6B5A',
  },
  conditionTextFair: {
    color: '#D97706',
  },
  conditionTextPoor: {
    color: '#EF4444',
  },

  // Additional Info Card
  additionalInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#D8E7E1',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#23423B',
    marginBottom: 14,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF4F1',
  },
  infoItemLabel: {
    fontSize: 12,
    color: '#6F8B84',
    fontWeight: '500',
  },
  infoItemValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#23423B',
  },

  // Action Buttons
  actionButtons: {
    marginBottom: 24,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F6B5A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    justifyContent: 'center',
    gap: 6,
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0F6B5A',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: '#0F6B5A',
  },

  // Loading Styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#DDE9E3',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#6F8B84',
    fontWeight: '500',
  },
});

TruckInformationScreen.options = {
  title: 'Truck Information',
  headerShown: false, // Hide default header to use custom header only
};
