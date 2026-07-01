import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { driverService } from '../services/driverService';
import { maintenanceService } from '../services/maintenanceService';

export default function MaintenanceScreen() {
  const router = useRouter();
  
  // Maintenance report state
  const [reportForm, setReportForm] = useState<{
    truckId: number;
    issueTitle: string;
    issueDescription: string;
    priorityLevel: 'low' | 'medium' | 'high' | 'emergency';
  }>({
    truckId: 0,
    issueTitle: '',
    issueDescription: '',
    priorityLevel: 'medium',
  });
  const [reportStatus, setReportStatus] = useState('pending');
  const [showMaintenanceHistory, setShowMaintenanceHistory] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Truck information state for auto-fill
  const [truckInfo, setTruckInfo] = useState({
    truckId: 0,
    uniqueId: '',
  });
  const [loadingTruckInfo, setLoadingTruckInfo] = useState(true);

  // Fetch truck information on component mount
  useEffect(() => {
    fetchTruckInfo();
  }, []);

  const fetchTruckInfo = async () => {
    try {
      setLoadingTruckInfo(true);
      const truckData = await driverService.getDriverTruckInfo();
      
      if (truckData) {
        const truckId = truckData.truck_id || 0;
        const uniqueId = truckData.unique_id || '';
        
        setTruckInfo({
          truckId,
          uniqueId,
        });
        
        // Auto-fill form with truck information
        setReportForm(prev => ({
          ...prev,
          truckId,
        }));
      } else {
        // Set default values if no truck assigned
        setTruckInfo({
          truckId: 0,
          uniqueId: '',
        });
        setReportForm(prev => ({
          ...prev,
          truckId: 0,
        }));
      }
    } catch (error) {
      console.error('Error fetching truck info:', error);
      setTruckInfo({
        truckId: 0,
        uniqueId: '',
      });
    } finally {
      setLoadingTruckInfo(false);
    }
  };
  
  // Maintenance history state
  const [maintenanceHistory, setMaintenanceHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const handleBack = () => {
    router.back();
  };

  // Fetch maintenance history
  const fetchMaintenanceHistory = async () => {
    setLoadingHistory(true);
    try {
      const reports = await maintenanceService.getMaintenanceReports();
      setMaintenanceHistory(reports);
    } catch (error) {
      console.error('Error fetching maintenance history:', error);
      alert('Failed to load maintenance history');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Open maintenance history modal and fetch data
  const openMaintenanceHistory = () => {
    setShowMaintenanceHistory(true);
    fetchMaintenanceHistory();
  };

  const handleSubmitReport = async () => {
    // Validate form
    if (!reportForm.issueTitle.trim() || !reportForm.issueDescription.trim()) {
      alert('Please fill in all issue details before submitting.');
      return;
    }

    // Check if truck information is available
    if (!truckInfo.truckId || truckInfo.truckId === 0) {
      alert('Unable to submit report. Truck information is not available.');
      return;
    }

    setIsSubmitting(true);
    
    // Prepare submission data with only truck_id
    const submissionData = {
      truckId: reportForm.truckId,
      issueTitle: reportForm.issueTitle.trim(),
      issueDescription: reportForm.issueDescription.trim(),
      priorityLevel: reportForm.priorityLevel,
    };

    try {
      console.log('Submitting maintenance report:', submissionData);
      
      // Submit to API
      const response = await maintenanceService.submitMaintenanceReport(submissionData);
      
      if (response.success) {
        setReportStatus('in-review');
        alert('Maintenance report submitted successfully! Report ID: ' + response.report?.id);
        
        // Reset form fields (except truck info)
        setReportForm(prev => ({
          ...prev,
          issueTitle: '',
          issueDescription: '',
          priorityLevel: 'medium',
        }));
        
        // Reset status after showing success
        setTimeout(() => {
          setReportStatus('pending');
        }, 3000);
      } else {
        alert('Failed to submit report: ' + response.message);
      }
    } catch (error) {
      console.error('Error submitting maintenance report:', error);
      alert('Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header with Back Button */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Maintenance Reports</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          

          {/* Maintenance Report Form */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Maintenance Report Form</Text>
            
            {/* Truck Information Section */}
            <View style={styles.truckInfoHeader}>
              <Text style={styles.subsectionTitle}>Truck Information</Text>
              <TouchableOpacity onPress={fetchTruckInfo} style={styles.refreshButton}>
                <Ionicons name="refresh" size={16} color="#10B981" />
              </TouchableOpacity>
            </View>
            
            {loadingTruckInfo ? (
              <View style={[styles.reportInput, styles.loadingContainer]}>
                <ActivityIndicator size="small" color="#10B981" />
                <Text style={styles.loadingText}>Loading truck information...</Text>
              </View>
            ) : (
              <>
                <View style={[styles.reportInput, styles.displayField]}>
                  <Ionicons name="card-outline" size={20} color="#6B7280" style={styles.fieldIcon} />
                  <View>
                    <Text style={styles.fieldLabel}>Unique ID</Text>
                    <Text style={styles.fieldValue}>{truckInfo.uniqueId || 'N/A'}</Text>
                  </View>
                </View>
                
              </>
            )}

            {/* Issue Details Section */}
            <Text style={[styles.subsectionTitle, { marginTop: 20 }]}>Issue Details</Text>
            
            <TextInput
              style={styles.reportInput}
              placeholder="Issue Title"
              value={reportForm.issueTitle}
              onChangeText={(text: string) => setReportForm({...reportForm, issueTitle: text})}
            />
            
            
            
            <TextInput
              style={[styles.reportInput, styles.reportTextarea]}
              placeholder="Please provide a detailed description of the issue. Include any symptoms, when it started, and any warning lights or unusual sounds."
              value={reportForm.issueDescription}
              onChangeText={(text: string) => setReportForm({...reportForm, issueDescription: text})}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
            
            

            {/* Priority Level Section */}
            <Text style={[styles.subsectionTitle, { marginTop: 20 }]}>Priority Level</Text>
            
            <View style={styles.priorityContainer}>
              {['Low', 'Medium', 'High', 'Emergency'].map((priority, index) => {
                const priorityColors: Record<string, { bg: string; border: string; text: string; active: string }> = {
                  'Low': { bg: '#F0FDF4', border: '#BBF7D0', text: '#166534', active: '#22C55E' },
                  'Medium': { bg: '#FEF3C7', border: '#FDE68A', text: '#92400E', active: '#F59E0B' },
                  'High': { bg: '#FEE2E2', border: '#FECACA', text: '#991B1B', active: '#EF4444' },
                  'Emergency': { bg: '#FEE2E2', border: '#FCA5A5', text: '#7F1D1D', active: '#DC2626' }
                };
                const colors = priorityColors[priority];
                const isActive = reportForm.priorityLevel === priority.toLowerCase();
                
                return (
                  <TouchableOpacity
                    key={priority}
                    style={[
                      styles.priorityButton,
                      {
                        backgroundColor: isActive ? colors.active : colors.bg,
                        borderColor: isActive ? colors.active : colors.border,
                        borderWidth: 1.5,
                        marginLeft: index === 0 ? 0 : 4,
                        marginRight: index === 3 ? 0 : 4,
                      }
                    ]}
                    onPress={() => setReportForm({...reportForm, priorityLevel: priority.toLowerCase() as 'low' | 'medium' | 'high' | 'emergency'})}
                  >
                    <Text style={[
                      styles.priorityButtonText,
                      {
                        color: isActive ? '#FFFFFF' : colors.text,
                        fontWeight: isActive ? '700' : '600'
                      }
                    ]}>
                      {priority}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            
            <TouchableOpacity
              style={[styles.reportButton, isSubmitting && styles.reportButtonDisabled]}
              onPress={handleSubmitReport}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Text style={styles.reportButtonText}>Submitting...</Text>
              ) : (
                <Text style={styles.reportButtonText}>Submit Report</Text>
              )}
            </TouchableOpacity>
            
            {/* Report Status Badge */}
            {reportStatus !== 'pending' && (
              <View style={[
                styles.statusBadge,
                reportStatus === 'in-review' && styles.statusBadgeInReview,
                reportStatus === 'approved' && styles.statusBadgeApproved,
                reportStatus === 'fixed' && styles.statusBadgeFixed
              ]}>
                <Text style={[
                  styles.statusBadgeText,
                  reportStatus === 'in-review' && styles.statusBadgeTextInReview,
                  reportStatus === 'approved' && styles.statusBadgeTextApproved,
                  reportStatus === 'fixed' && styles.statusBadgeTextFixed
                ]}>
                  {reportStatus === 'in-review' && 'In Review'}
                  {reportStatus === 'approved' && 'Approved'}
                  {reportStatus === 'fixed' && 'Fixed'}
                </Text>
              </View>
            )}
          </View>

          {/* View History Button */}
          <TouchableOpacity
            style={styles.historyButton}
            onPress={openMaintenanceHistory}
          >
            <Ionicons name="time-outline" size={20} color="#FFFFFF" />
            <Text style={styles.historyButtonText}>View Maintenance History</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      {/* Maintenance History Modal */}
      {showMaintenanceHistory && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowMaintenanceHistory(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Maintenance History</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionTitle}>Previous Reports</Text>
              
              {loadingHistory ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#10B981" />
                  <Text style={styles.loadingText}>Loading maintenance history...</Text>
                </View>
              ) : maintenanceHistory.length === 0 ? (
                <View style={styles.emptyHistoryContainer}>
                  <Ionicons name="clipboard-outline" size={48} color="#9CA3AF" />
                  <Text style={styles.emptyHistoryText}>No maintenance history found</Text>
                  <Text style={styles.emptyHistorySubtext}>Your submitted reports will appear here</Text>
                </View>
              ) : (
                maintenanceHistory.map((report) => (
                  <View key={report.id} style={styles.historyCard}>
                    <View style={styles.historyHeader}>
                      <View>
                        <Text style={styles.historyId}>Report ID: #{report.id}</Text>
                        <Text style={styles.historyTruck}>Unique ID: {report.unique_id || 'N/A'}</Text>
                        <Text style={styles.historyDate}>
                          {new Date(report.created_at).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </Text>
                      </View>
                      <View style={[
                        styles.statusBadge,
                        report.status === 'pending' && styles.statusBadgePending,
                        report.status === 'in_review' && styles.statusBadgeInReview,
                        report.status === 'approved' && styles.statusBadgeApproved,
                        report.status === 'in_progress' && styles.statusBadgeRepairOngoing,
                        report.status === 'completed' && styles.statusBadgeFixed,
                        report.status === 'rejected' && styles.statusBadgeRejected
                      ]}>
                        <Text style={[
                          styles.statusBadgeText,
                          report.status === 'pending' && styles.statusBadgeTextPending,
                          report.status === 'in_review' && styles.statusBadgeTextInReview,
                          report.status === 'approved' && styles.statusBadgeTextApproved,
                          report.status === 'in_progress' && styles.statusBadgeTextRepairOngoing,
                          report.status === 'completed' && styles.statusBadgeTextFixed,
                          report.status === 'rejected' && styles.statusBadgeTextRejected
                        ]}>
                          {report.status === 'pending' && 'Pending'}
                          {report.status === 'in_review' && 'In Review'}
                          {report.status === 'approved' && 'Approved'}
                          {report.status === 'in_progress' && 'In Progress'}
                          {report.status === 'completed' && 'Completed'}
                          {report.status === 'rejected' && 'Rejected'}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.historyDetails}>
                      <Text style={styles.historyIssue}>{report.issue_title}</Text>
                      <Text style={styles.historyDescription}>{report.issue_description}</Text>
                      <View style={styles.historyMeta}>
                        <Text style={styles.historyPriority}>
                          Priority: {report.priority_level?.toUpperCase()}
                        </Text>
                        {report.mechanic && (
                          <Text style={styles.historyMechanic}>Mechanic: {report.mechanic}</Text>
                        )}
                      </View>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },

  // Modern Header Styles
  modernHeader: {
    height: 180,
    borderRadius: 20,
    padding: 20,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    alignItems: 'center',
  },
  modernHeaderText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 10,
    marginBottom: 6,
  },
  modernSubText: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.9,
  },

  // Form Styles
  formSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 14,
  },
  subsectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  truckInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  refreshButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
  },
  reportInput: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    fontSize: 13,
    color: '#0F172A',
  },
  displayField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldIcon: {
    marginRight: 10,
  },
  fieldLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  fieldValue: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '700',
    marginTop: 1,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  reportTextarea: {
    height: 110,
    paddingTop: 12,
    fontSize: 13,
    lineHeight: 18,
  },
  exampleText: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginBottom: 6,
  },
  priorityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  priorityButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
  },
  priorityButtonActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  priorityButtonText: {
    fontSize: 11,
    fontWeight: '700',
  },
  priorityButtonTextActive: {
    color: '#FFFFFF',
  },
  reportButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  reportButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  reportButtonDisabled: {
    backgroundColor: '#94A3B8',
    opacity: 0.7,
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    gap: 8,
  },
  historyButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Modal Styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '92%',
    maxHeight: '82%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalContent: {
    padding: 16,
  },

  // Status Badge Styles
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusBadgePending: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeInReview: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeApproved: {
    backgroundColor: '#ECFDF5',
  },
  statusBadgeRepairOngoing: {
    backgroundColor: '#FFF7ED',
  },
  statusBadgeFixed: {
    backgroundColor: '#ECFDF5',
  },
  statusBadgeRejected: {
    backgroundColor: '#FEF2F2',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  statusBadgeTextPending: {
    color: '#D97706',
  },
  statusBadgeTextInReview: {
    color: '#D97706',
  },
  statusBadgeTextApproved: {
    color: '#10B981',
  },
  statusBadgeTextRepairOngoing: {
    color: '#EA580C',
  },
  statusBadgeTextFixed: {
    color: '#10B981',
  },
  statusBadgeTextRejected: {
    color: '#EF4444',
  },

  // Maintenance History Styles
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  historyId: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
  },
  historyTruck: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
    marginTop: 2,
  },
  historyIssue: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
    marginBottom: 4,
  },
  historyDate: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '500',
  },
  historyMechanic: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  historyDetails: {
    // Keep consistent
  },
  emptyHistoryContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyHistoryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 10,
  },
  emptyHistorySubtext: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
    textAlign: 'center',
  },
  historyDescription: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
    lineHeight: 18,
  },
  historyMeta: {
    marginTop: 10,
    gap: 4,
  },
  historyPriority: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
  },
});

MaintenanceScreen.options = {
  title: 'Maintenance Reports',
  headerShown: false, // Hide default header to use custom header only
};
