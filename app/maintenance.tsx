import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  
  // Truck information state for auto-fill
  const [truckInfo, setTruckInfo] = useState({
    truckId: 0,
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
        
        setTruckInfo({
          truckId,
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
      setSubmitMessage('Please fill in all issue details before submitting.');
      setSubmitSuccess(false);
      setTimeout(() => setSubmitMessage(''), 3000);
      return;
    }

    // Check if truck information is available
    if (!truckInfo.truckId || truckInfo.truckId === 0) {
      setSubmitMessage('Unable to submit report. Truck information is not available.');
      setSubmitSuccess(false);
      setTimeout(() => setSubmitMessage(''), 3000);
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage('');
    
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
        setSubmitSuccess(true);
        setSubmitMessage('Maintenance report submitted successfully! Report ID: ' + response.report?.id);
        
        // Reset form fields (except truck info)
        setReportForm(prev => ({
          ...prev,
          issueTitle: '',
          issueDescription: '',
          priorityLevel: 'medium',
        }));
        
        // Hide success message after 3 seconds
        setTimeout(() => {
          setSubmitSuccess(false);
          setSubmitMessage('');
          setReportStatus('pending');
        }, 3000);
      } else {
        setSubmitSuccess(false);
        setSubmitMessage('Failed to submit report: ' + response.message);
        setTimeout(() => setSubmitMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error submitting maintenance report:', error);
      setSubmitSuccess(false);
      setSubmitMessage('Failed to submit report. Please try again.');
      setTimeout(() => setSubmitMessage(''), 3000);
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
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
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
                <Ionicons name="refresh" size={16} color="#22C55E" />
              </TouchableOpacity>
            </View>
            
            {loadingTruckInfo ? (
              <View style={[styles.reportInput, styles.loadingContainer]}>
                <ActivityIndicator size="small" color="#22C55E" />
                <Text style={styles.loadingText}>Loading truck information...</Text>
              </View>
            ) : (
              <>
                <View style={[styles.reportInput, styles.displayField]}>
                  <Ionicons name="card-outline" size={20} color="#6B7280" style={styles.fieldIcon} />
                  <View>
                    <Text style={styles.fieldLabel}>Truck ID</Text>
                    <Text style={styles.fieldValue}>{truckInfo.truckId}</Text>
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
            
            {/* Submit Success/Error Message */}
            {submitMessage !== '' && (
              <View style={[
                styles.submitMessageContainer,
                submitSuccess ? styles.submitMessageSuccess : styles.submitMessageError
              ]}>
                <Ionicons 
                  name={submitSuccess ? "checkmark-circle" : "alert-circle"} 
                  size={20} 
                  color={submitSuccess ? "#16A34A" : "#DC2626"} 
                />
                <Text style={[
                  styles.submitMessageText,
                  submitSuccess ? styles.submitMessageTextSuccess : styles.submitMessageTextError
                ]}>
                  {submitMessage}
                </Text>
              </View>
            )}
            
            {/* Report Status Badge */}
            {reportStatus !== 'pending' && !submitSuccess && (
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
                  <ActivityIndicator size="large" color="#3BC240" />
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
                        <Text style={styles.historyTruck}>Truck ID: {report.truck_id || 'N/A'}</Text>
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

  // Modern Header Styles
  modernHeader: {
    height: 200,
    borderRadius: 28,
    padding: 24,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 5,
    marginBottom: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    alignItems: 'center',
  },
  modernHeaderText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 12,
    marginBottom: 8,
  },
  modernSubText: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
  },

  // Form Styles
  formSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  truckInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F0FDF4',
  },
  reportInput: {
    height: 54,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 16,
  },
  displayField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldIcon: {
    marginRight: 12,
  },
  fieldLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  fieldValue: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
    marginTop: 2,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6B7280',
  },
  reportTextarea: {
    height: 140,
    paddingTop: 16,
    fontSize: 15,
    lineHeight: 20,
  },
  exampleText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  priorityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  priorityButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  priorityButtonActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  priorityButtonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  priorityButtonTextActive: {
    color: '#FFFFFF',
  },
  reportButton: {
    height: 56,
    borderRadius: 18,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
  },
  reportButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  reportButtonDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.7,
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3BC240',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  historyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },

  // Modal Styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalContent: {
    padding: 20,
  },

  // Status Badge Styles
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 14,
  },
  statusBadgePending: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeInReview: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeApproved: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgeRepairOngoing: {
    backgroundColor: '#FB923C',
  },
  statusBadgeFixed: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgeRejected: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statusBadgeTextPending: {
    color: '#D97706',
  },
  statusBadgeTextInReview: {
    color: '#D97706',
  },
  statusBadgeTextApproved: {
    color: '#16A34A',
  },
  statusBadgeTextRepairOngoing: {
    color: '#DC2626',
  },
  statusBadgeTextFixed: {
    color: '#16A34A',
  },
  statusBadgeTextRejected: {
    color: '#DC2626',
  },

  // Maintenance History Styles
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyId: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  historyTruck: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  historyIssue: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  historyDate: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  historyMechanic: {
    fontSize: 12,
    color: '#6B7280',
  },
  historyDetails: {
    // Add any additional styling if needed
  },
  emptyHistoryContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyHistoryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
  },
  emptyHistorySubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  historyDescription: {
    fontSize: 13,
    color: '#374151',
    marginTop: 8,
    lineHeight: 18,
  },
  historyMeta: {
    marginTop: 12,
    gap: 8,
  },
  historyPriority: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  submitMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
  },
  submitMessageSuccess: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  submitMessageError: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  submitMessageText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  submitMessageTextSuccess: {
    color: '#166534',
  },
  submitMessageTextError: {
    color: '#991B1B',
  },
});

MaintenanceScreen.options = {
  title: 'Maintenance Reports',
  headerShown: false, // Hide default header to use custom header only
};
