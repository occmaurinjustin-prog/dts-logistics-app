import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import authService from '../../services/authService';

interface InspectionReport {
  id: number;
  inspection_date: string;
  overall_condition: string;
  mileage: number;
  issue_title: string;
  issue_description: string;
  status: string;
  created_at: string;
  truck: {
    truck_id: number;
    plate_number: string;
    unique_id: string;
    vehicle_type: string;
  };
}

interface Truck {
  truck_id: number;
  plate_number: string;
  unique_id: string;
  vehicle_type: string;
}

export default function InspectionReportsScreen() {
  const router = useRouter();
  const [reports, setReports] = useState<InspectionReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null);
  const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().split('T')[0]);
  const [overallCondition, setOverallCondition] = useState('good');
  const [mileage, setMileage] = useState('');
  const [issueTitle, setIssueTitle] = useState('');
  const [issueDescription, setIssueDescription] = useState('');

  useEffect(() => {
    fetchReports();
  }, []);

  useEffect(() => {
    if (showFormModal) {
      fetchTrucks();
    }
  }, [showFormModal]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const token = await authService.getToken();
      
      const response = await fetch('https://consult-powwow-vexingly.ngrok-free.dev/api/mechanic/inspection-reports', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch inspection reports');
      }

      const data = await response.json();
      
      if (data.success && data.reports) {
        setReports(data.reports);
      } else {
        setReports([]);
      }
    } catch (error) {
      console.error('Error fetching inspection reports:', error);
      Alert.alert('Error', 'Failed to load inspection reports');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchReports();
  };

  const fetchTrucks = async () => {
    try {
      const token = await authService.getToken();
      
      const response = await fetch('https://consult-powwow-vexingly.ngrok-free.dev/api/mechanic/trucks', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch trucks');
      }

      const data = await response.json();
      
      if (data.success && data.trucks) {
        setTrucks(data.trucks);
      }
    } catch (error) {
      console.error('Error fetching trucks:', error);
      Alert.alert('Error', 'Failed to load trucks');
    }
  };

  const handleSubmit = async () => {
    if (!selectedTruck) {
      Alert.alert('Error', 'Please select a truck');
      return;
    }

    if (!inspectionDate) {
      Alert.alert('Error', 'Please select inspection date');
      return;
    }

    if (!overallCondition) {
      Alert.alert('Error', 'Please select overall condition');
      return;
    }

    if (overallCondition !== 'good' && (!issueTitle.trim() || !issueDescription.trim())) {
      Alert.alert('Error', `Please provide an issue title and description for a '${overallCondition}' condition.`);
      return;
    }

    setFormLoading(true);

    try {
      const token = await authService.getToken();
      
      const response = await fetch('https://consult-powwow-vexingly.ngrok-free.dev/api/mechanic/inspection-reports', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          truck_id: selectedTruck.truck_id,
          inspection_date: inspectionDate,
          overall_condition: overallCondition,
          mileage: mileage ? parseFloat(mileage) : null,
          issue_title: overallCondition === 'good' ? '' : issueTitle.trim(),
          issue_description: overallCondition === 'good' ? '' : issueDescription.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit inspection report');
      }

      const data = await response.json();
      
      if (data.success) {
        Alert.alert('Success', 'Inspection report submitted successfully');
        setShowFormModal(false);
        // Reset form
        setSelectedTruck(null);
        setInspectionDate(new Date().toISOString().split('T')[0]);
        setOverallCondition('good');
        setMileage('');
        setIssueTitle('');
        setIssueDescription('');
        fetchReports();
      } else {
        Alert.alert('Error', data.message || 'Failed to submit inspection report');
      }
    } catch (error) {
      console.error('Error submitting inspection report:', error);
      Alert.alert('Error', 'Failed to submit inspection report');
    } finally {
      setFormLoading(false);
    }
  };

  const conditions = [
    { value: 'good', label: 'Good', color: '#0F6B5A' },
    { value: 'fair', label: 'Fair', color: '#F59E0B' },
    { value: 'poor', label: 'Poor', color: '#F97316' },
    { value: 'critical', label: 'Critical', color: '#DC2626' },
  ];

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'good': return '#0F6B5A';
      case 'fair': return '#F59E0B';
      case 'poor': return '#F97316';
      case 'critical': return '#DC2626';
      default: return '#6B7280';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'reviewed': return '#2A9D8F';
      case 'scheduled': return '#0F6B5A';
      case 'completed': return '#6B7280';
      default: return '#6B7280';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Inspection Reports</Text>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
            <Ionicons 
              name="refresh" 
              size={20} 
              color="#23423B" 
              style={refreshing ? { transform: [{ rotate: '180deg' }] } : {}}
            />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0F6B5A" />
              <Text style={styles.loadingText}>Loading inspection reports...</Text>
            </View>
          ) : reports.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="clipboard-outline" size={64} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No Inspection Reports</Text>
              <Text style={styles.emptyMessage}>You haven't submitted any inspection reports yet.</Text>
            </View>
          ) : (
            <View style={styles.reportsList}>
              {reports.map((report) => (
                <TouchableOpacity
                  key={report.id}
                  style={styles.reportCard}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.truckInfo}>
                      <View style={styles.uniqueIdBadge}>
                        <Text style={styles.uniqueIdText}>{report.truck?.unique_id || 'N/A'}</Text>
                      </View>
                      <Text style={styles.plateNumber}>{report.truck?.plate_number || 'N/A'}</Text>
                    </View>
                    <View style={[
                      styles.conditionBadge,
                      { backgroundColor: `${getConditionColor(report.overall_condition)}20` }
                    ]}>
                      <Text style={[
                        styles.conditionText,
                        { color: getConditionColor(report.overall_condition) }
                      ]}>
                        {report.overall_condition?.toUpperCase() || 'N/A'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.dateRow}>
                    <Ionicons name="calendar-outline" size={14} color="#6F8B84" />
                    <Text style={styles.dateText}>
                      Inspection Date: {formatDate(report.inspection_date)}
                    </Text>
                  </View>

                  {report.mileage && (
                    <View style={styles.mileageRow}>
                      <Ionicons name="speedometer-outline" size={14} color="#6F8B84" />
                      <Text style={styles.mileageText}>
                        Mileage: {report.mileage.toLocaleString()} km
                      </Text>
                    </View>
                  )}

                  {report.issue_title && (
                    <Text style={styles.findingsText} numberOfLines={1}>
                      <Text style={{fontWeight: 'bold'}}>Issue:</Text> {report.issue_title}
                    </Text>
                  )}
                  {report.issue_description && (
                    <Text style={styles.findingsText} numberOfLines={2}>
                      {report.issue_description}
                    </Text>
                  )}

                  <View style={styles.cardFooter}>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: `${getStatusColor(report.status)}20` }
                    ]}>
                      <Text style={[
                        styles.statusText,
                        { color: getStatusColor(report.status) }
                      ]}>
                        {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                      </Text>
                    </View>
                    <Text style={styles.createdAt}>
                      {formatDate(report.created_at)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Add New Report Button */}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowFormModal(true)}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
          <Text style={styles.addButtonText}>New Inspection</Text>
        </TouchableOpacity>

        {/* New Inspection Modal */}
        <Modal
          visible={showFormModal}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <SafeAreaView style={styles.modalSafeArea}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalKeyboardView}
            >
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowFormModal(false)} style={styles.modalCloseButton}>
                  <Ionicons name="close" size={24} color="#23423B" />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>New Inspection</Text>
                <View style={styles.modalSpacer} />
              </View>

              <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
                {/* Truck Selection */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Select Truck</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.truckList}>
                    {trucks.map((truck) => (
                      <TouchableOpacity
                        key={truck.truck_id}
                        style={[
                          styles.truckCard,
                          selectedTruck?.truck_id === truck.truck_id && styles.truckCardSelected,
                        ]}
                        onPress={() => setSelectedTruck(truck)}
                      >
                        <View style={styles.uniqueIdBadge}>
                          <Text style={styles.uniqueIdText}>{truck.unique_id}</Text>
                        </View>
                        <Text style={styles.plateNumber}>{truck.plate_number}</Text>
                        <Text style={styles.vehicleType}>{truck.vehicle_type}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Inspection Date */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Inspection Date</Text>
                  <TextInput
                    style={styles.input}
                    value={inspectionDate}
                    onChangeText={setInspectionDate}
                    placeholder="YYYY-MM-DD"
                  />
                </View>

                {/* Overall Condition */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Overall Condition</Text>
                  <View style={styles.conditionGrid}>
                    {conditions.map((condition) => (
                      <TouchableOpacity
                        key={condition.value}
                        style={[
                          styles.conditionCard,
                          overallCondition === condition.value && styles.conditionCardSelected,
                          overallCondition === condition.value && { borderColor: condition.color },
                        ]}
                        onPress={() => setOverallCondition(condition.value)}
                      >
                        <View style={[
                          styles.conditionDot,
                          { backgroundColor: condition.color }
                        ]} />
                        <Text style={[
                          styles.conditionLabel,
                          overallCondition === condition.value && styles.conditionLabelSelected,
                        ]}>
                          {condition.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Mileage */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Mileage (km)</Text>
                  <TextInput
                    style={styles.input}
                    value={mileage}
                    onChangeText={setMileage}
                    placeholder="Enter current mileage"
                    keyboardType="numeric"
                  />
                </View>

                {/* Conditional Issue Fields */}
                {overallCondition !== 'good' && (
                  <>
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>Issue Title <Text style={{color: '#EF4444'}}>*</Text></Text>
                      <TextInput
                        style={styles.input}
                        value={issueTitle}
                        onChangeText={setIssueTitle}
                        placeholder="Short title for the issue..."
                      />
                    </View>

                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>Issue Description <Text style={{color: '#EF4444'}}>*</Text></Text>
                      <TextInput
                        style={[styles.input, styles.textArea]}
                        value={issueDescription}
                        onChangeText={setIssueDescription}
                        placeholder="Provide a detailed description of the issue..."
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                      />
                    </View>
                  </>
                )}

                {/* Submit Button */}
                <TouchableOpacity
                  style={[styles.submitButton, formLoading && styles.submitButtonDisabled]}
                  onPress={handleSubmit}
                  disabled={formLoading}
                >
                  {formLoading ? (
                    <Text style={styles.submitButtonText}>Submitting...</Text>
                  ) : (
                    <Text style={styles.submitButtonText}>Submit Inspection</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#D8E7E1',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#23423B',
  },
  refreshButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 80,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 12,
    color: '#6F8B84',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 80,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#23423B',
    marginTop: 12,
  },
  emptyMessage: {
    fontSize: 13,
    color: '#6F8B84',
    marginTop: 6,
    textAlign: 'center',
  },
  reportsList: {
    paddingVertical: 12,
  },
  reportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  truckInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  uniqueIdBadge: {
    backgroundColor: '#EEF4F1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  uniqueIdText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#23423B',
    fontFamily: 'monospace',
  },
  plateNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4F6C66',
  },
  conditionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  conditionText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateText: {
    fontSize: 12,
    color: '#6F8B84',
    marginLeft: 6,
    fontWeight: '500',
  },
  mileageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  mileageText: {
    fontSize: 12,
    color: '#6F8B84',
    marginLeft: 6,
    fontWeight: '500',
  },
  findingsText: {
    fontSize: 13,
    color: '#4F6C66',
    lineHeight: 18,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  createdAt: {
    fontSize: 11,
    color: '#9AB7AF',
    fontWeight: '500',
  },
  addButton: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    backgroundColor: '#0F6B5A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#0F6B5A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: '#DDE9E3',
  },
  modalKeyboardView: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#D8E7E1',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#23423B',
  },
  modalSpacer: {
    width: 32,
  },
  modalScrollView: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  modalSection: {
    marginTop: 20,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#23423B',
    marginBottom: 12,
  },
  truckList: {
    flexDirection: 'row',
  },
  truckCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#D8E7E1',
    minWidth: 120,
  },
  truckCardSelected: {
    borderColor: '#0F6B5A',
    backgroundColor: '#F0FDF4',
  },
  vehicleType: {
    fontSize: 11,
    color: '#6F8B84',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#D8E7E1',
    fontSize: 14,
    color: '#23423B',
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  conditionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  conditionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 2,
    borderColor: '#D8E7E1',
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 80,
  },
  conditionCardSelected: {
    borderWidth: 2,
  },
  conditionDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  conditionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6F8B84',
  },
  conditionLabelSelected: {
    color: '#23423B',
  },
  submitButton: {
    backgroundColor: '#0F6B5A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
