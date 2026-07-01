import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import authService from '../../services/authService';

interface MaintenanceAssignment {
  id: number;
  report_id: number;
  issue_title: string;
  issue_description: string;
  priority_level: string;
  status: string;
  created_at: string;
  repair_date: string;
  repair_time: string;
  repair_location: string;
  truck: {
    plate_number: string;
    vehicle_type: string;
    unique_id: string;
  };
  driver: {
    user: {
      firstname: string;
      lastname: string;
    };
  };
}

export default function MechanicAssignmentsScreen() {
  const router = useRouter();
  const [assignments, setAssignments] = useState<MaintenanceAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const token = await authService.getToken();
      
      const response = await fetch('http://10.65.49.24:8000/api/mechanic/assignments', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch assignments');
      }

      const data = await response.json();
      
      if (data.success && data.assignments) {
        setAssignments(data.assignments);
      } else {
        setAssignments([]);
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
      Alert.alert('Error', 'Failed to load assignments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAssignments();
  };

  const handleUpdateStatus = async (maintenanceId: number, status: string) => {
    try {
      const token = await authService.getToken();
      
      const response = await fetch(`http://10.65.49.24:8000/api/mechanic/assignments/${maintenanceId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      const data = await response.json();
      
      if (data.success) {
        Alert.alert('Success', data.message);
        fetchAssignments(); // Refresh the list
      } else {
        Alert.alert('Error', data.message || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'emergency': return '#DC2626';
      case 'high': return '#F59E0B';
      case 'medium': return '#3B82F6';
      case 'low': return '#6B7280';
      default: return '#6B7280';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#10B981';
      case 'scheduled': return '#10B981';
      case 'in_progress': return '#F59E0B';
      case 'completed': return '#6B7280';
      default: return '#6B7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return 'Scheduled';
      case 'scheduled': return 'Scheduled';
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
      default: return status;
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

  const filteredAssignments = assignments.filter(assignment => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'scheduled') return assignment.status === 'scheduled' || assignment.status === 'approved';
    return assignment.status === filterStatus;
  });

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Assignments</Text>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
            <Ionicons 
              name="refresh" 
              size={20} 
              color="#0F172A" 
              style={refreshing ? { transform: [{ rotate: '180deg' }] } : {}}
            />
          </TouchableOpacity>
        </View>

        {/* Filters */}
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
            {['all', 'scheduled', 'in_progress', 'completed'].map(status => (
              <TouchableOpacity 
                 key={status}
                 style={[styles.filterChip, filterStatus === status && styles.filterChipActive]}
                 onPress={() => setFilterStatus(status)}
              >
                 <Text style={[styles.filterChipText, filterStatus === status && styles.filterChipTextActive]}>
                   {status === 'all' ? 'All' : status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1)}
                 </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#10B981" />
              <Text style={styles.loadingText}>Loading assignments...</Text>
            </View>
          ) : filteredAssignments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="build-outline" size={64} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No Assignments</Text>
              <Text style={styles.emptyMessage}>
                {filterStatus === 'all' 
                  ? 'You have no maintenance assignments at the moment.' 
                  : `No ${filterStatus.replace('_', ' ')} assignments found.`}
              </Text>
            </View>
          ) : (
            <View style={styles.assignmentsList}>
              {filteredAssignments.map((assignment) => (
                <TouchableOpacity
                  key={assignment.id}
                  style={styles.assignmentCard}
                  activeOpacity={0.7}
                  onLongPress={() => Alert.alert(
                    'Quick Info', 
                    `Issue: ${assignment.issue_title}\nPriority: ${assignment.priority_level.toUpperCase()}\nStatus: ${getStatusText(assignment.status)}`
                  )}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.truckInfo}>
                      <View style={styles.uniqueIdBadge}>
                        <Text style={styles.uniqueIdText}>{assignment.truck?.unique_id || 'N/A'}</Text>
                      </View>
                      <Text style={styles.plateNumber}>{assignment.truck?.plate_number || 'N/A'}</Text>
                    </View>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: `${getStatusColor(assignment.status)}20` }
                    ]}>
                      <Text style={[
                        styles.statusText,
                        { color: getStatusColor(assignment.status) }
                      ]}>
                        {getStatusText(assignment.status)}
                      </Text>
                    </View>
                  </View>

                  {/* Progress Bar */}
                  <View style={styles.progressBarContainer}>
                    <View style={[
                      styles.progressBarFill, 
                      { 
                        width: `${assignment.status === 'completed' ? 100 : assignment.status === 'in_progress' ? 50 : 25}%`,
                        backgroundColor: getStatusColor(assignment.status) 
                      }
                    ]} />
                  </View>

                  <Text style={styles.issueTitle}>{assignment.issue_title}</Text>
                  <Text style={styles.issueDescription} numberOfLines={2}>
                    {assignment.issue_description}
                  </Text>

                  {assignment.repair_date && (
                    <View style={styles.scheduleDetails}>
                      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                        <View style={{flex: 1}}>
                          <View style={styles.scheduleItem}>
                            <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                            <Text style={styles.scheduleText}>
                              {formatDate(assignment.repair_date)}
                            </Text>
                          </View>
                          <View style={styles.scheduleItem}>
                            <Ionicons name="time-outline" size={14} color="#6B7280" />
                            <Text style={styles.scheduleText}>
                              {assignment.repair_time}
                            </Text>
                          </View>
                          <View style={styles.scheduleItem}>
                            <Ionicons name="location-outline" size={14} color="#6B7280" />
                            <Text style={styles.scheduleText}>
                              {assignment.repair_location}
                            </Text>
                          </View>
                        </View>
                        {/* Tooltip Icon */}
                        <TouchableOpacity 
                          style={styles.tooltipIcon}
                          onPress={() => Alert.alert(
                            'Assignment Details', 
                            `Title: ${assignment.issue_title}\nStart Date: ${formatDate(assignment.repair_date)}\nTime: ${assignment.repair_time}\nLocation: ${assignment.repair_location}\nStatus: ${getStatusText(assignment.status)}\nPriority: ${assignment.priority_level.toUpperCase()}`
                          )}
                        >
                          <Ionicons name="information-circle-outline" size={24} color="#94A3B8" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  <View style={styles.cardFooter}>
                    <View style={[
                      styles.priorityBadge,
                      { backgroundColor: `${getPriorityColor(assignment.priority_level)}20` }
                    ]}>
                      <Text style={[
                        styles.priorityText,
                        { color: getPriorityColor(assignment.priority_level) }
                      ]}>
                        {assignment.priority_level.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.createdAt}>
                      {formatDate(assignment.created_at)}
                    </Text>
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.actionButtons}>
                    { (assignment.status === 'scheduled' || assignment.status === 'approved') && (
                      <TouchableOpacity
                        style={[styles.actionButton, styles.startButton]}
                        onPress={() => handleUpdateStatus(assignment.id, 'in_progress')}
                      >
                        <Ionicons name="play" size={16} color="#FFFFFF" />
                        <Text style={styles.actionButtonText}>Start Repair</Text>
                      </TouchableOpacity>
                    )}
                    {assignment.status === 'in_progress' && (
                      <TouchableOpacity
                        style={[styles.actionButton, styles.completeButton]}
                        onPress={() => handleUpdateStatus(assignment.id, 'completed')}
                      >
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                        <Text style={styles.actionButtonText}>Complete Repair</Text>
                      </TouchableOpacity>
                    )}
                    {assignment.status === 'completed' && (
                      <View style={[styles.actionButton, styles.completedButton]}>
                        <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                        <Text style={[styles.actionButtonText, styles.completedButtonText]}>Completed</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  refreshButton: {
    padding: 8,
  },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  filterScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#10B981',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
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
    color: '#64748B',
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
    color: '#0F172A',
    marginTop: 12,
  },
  emptyMessage: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 6,
    textAlign: 'center',
  },
  assignmentsList: {
    paddingVertical: 12,
  },
  assignmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  uniqueIdText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
    fontFamily: 'monospace',
  },
  plateNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
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
  issueTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  issueDescription: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 12,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  scheduleDetails: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  scheduleText: {
    fontSize: 11,
    color: '#475569',
    marginLeft: 6,
    fontWeight: '500',
  },
  tooltipIcon: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  createdAt: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  actionButtons: {
    marginTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  startButton: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  completeButton: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  completedButton: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  completedButtonText: {
    color: '#10B981',
  },
});
