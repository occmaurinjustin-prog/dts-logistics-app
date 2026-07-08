import { AppAlert } from '@/components/AppAlert';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { DriverProfile } from '../services/driverService';

interface CurrentDeliveryCardProps {
  driver: DriverProfile | null;
  onComplete?: () => void;
}

export default function CurrentDeliveryCard({ driver, onComplete }: CurrentDeliveryCardProps) {
  const router = useRouter();
  const currentDelivery = driver?.current_delivery;

  if (!currentDelivery) return null;

  const handleNavigate = () => {
    router.push('/(tabs)/navigation');
  };

  const handleComplete = () => {
    AppAlert.alert(
      'Complete Delivery',
      'Have you completed this delivery?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          style: 'default',
          onPress: () => {
            onComplete?.();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="bicycle" size={20} color="#F59E0B" />
          <Text style={styles.headerTitle}>Current Delivery</Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>In Transit</Text>
        </View>
      </View>

      {/* Waybill */}
      <View style={styles.trackingRow}>
        <Ionicons name="barcode-outline" size={16} color="#6B7280" />
        <Text style={styles.trackingNumber}>
          #{currentDelivery.waybill}
        </Text>
      </View>

      {/* Customer */}
      <View style={styles.infoRow}>
        <Ionicons name="person-outline" size={16} color="#6B7280" />
        <Text style={styles.infoText}>{currentDelivery.client_name}</Text>
      </View>

      {/* Pickup Address */}
      <View style={styles.addressSection}>
        <View style={styles.addressDot}>
          <Ionicons name="arrow-up" size={12} color="#FFFFFF" />
        </View>
        <View style={styles.addressContent}>
          <Text style={styles.addressLabel}>Pickup</Text>
          <Text style={styles.addressText} numberOfLines={2}>
            {currentDelivery.pickup_address}
          </Text>
        </View>
      </View>

      {/* Arrow connector */}
      <View style={styles.arrowConnector}>
        <View style={styles.connectorLine} />
        <Ionicons name="arrow-down" size={16} color="#D1D5DB" />
      </View>

      {/* Delivery Address */}
      <View style={styles.addressSection}>
        <View style={[styles.addressDot, styles.deliveryDot]}>
          <Ionicons name="arrow-down" size={12} color="#FFFFFF" />
        </View>
        <View style={styles.addressContent}>
          <Text style={styles.addressLabel}>Delivery</Text>
          <Text style={styles.addressText} numberOfLines={2}>
            {currentDelivery.delivery_address}
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.navigateButton}
          onPress={handleNavigate}
          activeOpacity={0.7}
        >
          <Ionicons name="navigate" size={18} color="#FFFFFF" />
          <Text style={styles.navigateButtonText}>Continue Navigation</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.completeButton}
          onPress={handleComplete}
          activeOpacity={0.7}
        >
          <Ionicons name="checkmark-circle" size={18} color="#10B981" />
          <Text style={styles.completeButtonText}>Complete</Text>
        </TouchableOpacity>
      </View>

      {/* Warning Message */}
      <View style={styles.warningBox}>
        <Ionicons name="information-circle" size={16} color="#F59E0B" />
        <Text style={styles.warningText}>
          You cannot accept new deliveries while this delivery is in progress.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  statusBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
  },
  trackingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  trackingNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#4B5563',
  },
  addressSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 4,
  },
  addressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  deliveryDot: {
    backgroundColor: '#EF4444',
  },
  addressContent: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 2,
  },
  addressText: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
  },
  arrowConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 11,
    marginVertical: 4,
  },
  connectorLine: {
    width: 2,
    height: 20,
    backgroundColor: '#E5E7EB',
    marginRight: 5,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  navigateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  navigateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  completeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
  },
});
