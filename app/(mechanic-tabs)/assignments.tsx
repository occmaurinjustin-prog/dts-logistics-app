import { AppAlert } from '@/components/AppAlert';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  RefreshControl
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
  const [activeTab, setActiveTab] = useState<'maintenance' | 'rescue'>('maintenance');
  const [showPartsModal, setShowPartsModal] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [selectedParts, setSelectedParts] = useState<{Inventory_id: number, quantity: number, name: string}[]>([]);

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const token = await authService.getToken();
      
      const response = await fetch('https://consult-powwow-vexingly.ngrok-free.dev/api/mechanic/assignments', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const rescueResponse = await fetch('https://consult-powwow-vexingly.ngrok-free.dev/api/rescue/mechanic/assignments', {
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
      const rescueData = await rescueResponse.json();
      
      let allAssignments: any[] = [];
      
      if (rescueData.data) {
        // Tag rescue assignments
        const rescues = rescueData.data.map((r: any) => ({ ...r, is_rescue: true }));
        allAssignments = [...allAssignments, ...rescues];
      }

      if (data.success && data.assignments) {
        allAssignments = [...allAssignments, ...data.assignments];
      }
      
      setAssignments(allAssignments);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      AppAlert.alert('Error', 'Failed to load assignments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  
  const fetchInventory = async () => {
    try {
      const token = await authService.getToken();
      const response = await fetch('https://consult-powwow-vexingly.ngrok-free.dev/api/mechanic/inventory', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) setInventory(data.parts);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const openPartsModal = (assignmentId: number) => {
    setSelectedAssignmentId(assignmentId);
    setSelectedParts([]);
    setShowPartsModal(true);
  };

  const handleTogglePart = (part: any) => {
    if (part.quantity <= 0) {
      AppAlert.alert('Out of Stock', 'This part is currently out of stock.');
      return;
    }
    const existing = selectedParts.find(p => p.Inventory_id === part.Inventory_id);
    if (existing) {
      setSelectedParts(selectedParts.filter(p => p.Inventory_id !== part.Inventory_id));
    } else {
      setSelectedParts([...selectedParts, { Inventory_id: part.Inventory_id, quantity: 1, name: part.part_name }]);
    }
  };

  const handleUpdateQuantity = (partId: number, change: number) => {
    const part = inventory.find(p => p.Inventory_id === partId);
    const maxStock = part ? part.quantity : 999;

    setSelectedParts(selectedParts.map(p => {
      if (p.Inventory_id === partId) {
        const newQ = Math.max(1, Math.min(p.quantity + change, maxStock));
        return { ...p, quantity: newQ };
      }
      return p;
    }));
  };

  const submitCompletion = async () => {
    if (!selectedAssignmentId) return;
    try {
      setLoading(true);
      setShowPartsModal(false);
      const token = await authService.getToken();
      
      const payload = {
        status: 'completed',
        parts_used: selectedParts.map(p => ({ Inventory_id: p.Inventory_id, quantity: p.quantity }))
      };

      const response = await fetch(`https://consult-powwow-vexingly.ngrok-free.dev/api/mechanic/assignments/${selectedAssignmentId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      
      if (data.success) {
        AppAlert.alert('Success', 'Maintenance completed successfully');
        fetchAssignments();
      } else {
        AppAlert.alert('Error', data.message || 'Failed to complete maintenance');
      }
    } catch (error) {
      console.error('Error completing:', error);
      AppAlert.alert('Error', 'Failed to complete maintenance');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAssignments();
  };

  const handleUpdateStatus = async (maintenanceId: number, status: string) => {
    try {
      const token = await authService.getToken();
      
      const response = await fetch(`https://consult-powwow-vexingly.ngrok-free.dev/api/mechanic/assignments/${maintenanceId}/status`, {
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
        AppAlert.alert('Success', data.message);
        fetchAssignments(); // Refresh the list
      } else {
        AppAlert.alert('Error', data.message || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      AppAlert.alert('Error', 'Failed to update status');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'emergency': return '#DC2626';
      case 'high': return '#F59E0B';
      case 'medium': return '#2A9D8F';
      case 'low': return '#6B7280';
      default: return '#6B7280';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#0F6B5A';
      case 'scheduled': return '#0F6B5A';
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
    // Filter by tab type first
    if (activeTab === 'maintenance' && assignment.is_rescue) return false;
    if (activeTab === 'rescue' && !assignment.is_rescue) return false;

    if (filterStatus === 'all') return true;
    
    if (filterStatus === 'scheduled') {
        return assignment.status === 'scheduled' || assignment.status === 'approved' || assignment.status === 'pending' || assignment.status === 'assigned';
    }
    if (filterStatus === 'in_progress') {
        return assignment.status === 'in_progress' || assignment.status === 'en_route' || assignment.status === 'arrived';
    }
    if (filterStatus === 'completed') {
        return assignment.status === 'completed' || assignment.status === 'resolved';
    }
    
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
              color="#23423B" 
              style={refreshing ? { transform: [{ rotate: '180deg' }] } : {}}
            />
          </TouchableOpacity>
        </View>

        {/* Type Tabs */}
        <View style={styles.typeTabsContainer}>
          <TouchableOpacity 
            style={[styles.typeTab, activeTab === 'maintenance' && styles.typeTabActive]}
            onPress={() => setActiveTab('maintenance')}
          >
            <Ionicons name="build" size={16} color={activeTab === 'maintenance' ? '#FFFFFF' : '#6F8B84'} style={{marginRight: 6}} />
            <Text style={[styles.typeTabText, activeTab === 'maintenance' && styles.typeTabTextActive]}>Maintenance</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.typeTab, activeTab === 'rescue' && styles.typeTabActive]}
            onPress={() => setActiveTab('rescue')}
          >
            <Ionicons name="warning" size={16} color={activeTab === 'rescue' ? '#FFFFFF' : '#6F8B84'} style={{marginRight: 6}} />
            <Text style={[styles.typeTabText, activeTab === 'rescue' && styles.typeTabTextActive]}>Rescue</Text>
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

        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#0F6B5A']} // Android
              tintColor="#0F6B5A" // iOS
            />
          }
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0F6B5A" />
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
              {filteredAssignments.map((assignment) => {
                if (assignment.is_rescue) {
                    const isResolved = assignment.status === 'resolved';
                    const mainColor = isResolved ? '#0F6B5A' : '#EF4444';
                    const bgColor = isResolved ? '#BFE8D8' : '#FEE2E2';

                    return (
                        <TouchableOpacity
                            key={`rescue-${assignment.rescue_id}`}
                            style={[styles.assignmentCard, { borderColor: mainColor, borderWidth: 2 }]}
                            activeOpacity={0.7}
                            onPress={() => router.push({ pathname: '/rescue-mission', params: { id: assignment.rescue_id } })}
                        >
                            <View style={styles.cardHeader}>
                                <View style={styles.truckInfo}>
                                    <Ionicons name={isResolved ? "checkmark-circle" : "warning"} size={16} color={mainColor} style={{marginRight: 6}} />
                                    <Text style={[styles.plateNumber, {color: mainColor, fontWeight: 'bold'}]}>
                                        {isResolved ? 'RESCUE COMPLETED' : 'EMERGENCY RESCUE'}
                                    </Text>
                                </View>
                                <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
                                    <Text style={[styles.statusText, { color: mainColor }]}>{(assignment.status || 'UNKNOWN').toUpperCase()}</Text>
                                </View>
                            </View>
                            <Text style={styles.issueTitle}>{assignment.issue_category}</Text>
                            <Text style={styles.issueDescription} numberOfLines={2}>{assignment.description || 'No description provided'}</Text>
                            <View style={styles.cardFooter}>
                                <Text style={styles.createdAt}>{formatDate(assignment.created_at)}</Text>
                                <Text style={[styles.priorityText, {color: mainColor, fontWeight: 'bold'}]}>VIEW MISSION</Text>
                            </View>
                        </TouchableOpacity>
                    );
                }

                return (
                <TouchableOpacity
                  key={`maint-${assignment.id}`}
                  style={styles.assignmentCard}
                  activeOpacity={0.7}
                  onLongPress={() => AppAlert.alert(
                    'Quick Info', 
                    `Issue: ${assignment.issue_title || 'N/A'}\nPriority: ${(assignment.priority_level || 'low').toUpperCase()}\nStatus: ${getStatusText(assignment.status)}`
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
                          onPress={() => AppAlert.alert(
                            'Assignment Details', 
                            `Title: ${assignment.issue_title || 'N/A'}\nStart Date: ${formatDate(assignment.repair_date)}\nTime: ${assignment.repair_time || 'N/A'}\nLocation: ${assignment.repair_location || 'N/A'}\nStatus: ${getStatusText(assignment.status)}\nPriority: ${(assignment.priority_level || 'low').toUpperCase()}`
                          )}
                        >
                          <Ionicons name="information-circle-outline" size={24} color="#9AB7AF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  <View style={styles.cardFooter}>
                    <View style={[
                      styles.priorityBadge,
                      { backgroundColor: `${getPriorityColor(assignment.priority_level)}20` }
                    ]}>
                      <Text style={[styles.priorityText, { color: getPriorityColor(assignment.priority_level) }]}>
                        {(assignment.priority_level || 'low').toUpperCase()}
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
                        onPress={() => openPartsModal(assignment.id)}
                      >
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                        <Text style={styles.actionButtonText}>Complete Repair</Text>
                      </TouchableOpacity>
                    )}
                    {assignment.status === 'completed' && (
                      <View style={[styles.actionButton, styles.completedButton]}>
                        <Ionicons name="checkmark-circle" size={16} color="#0F6B5A" />
                        <Text style={[styles.actionButtonText, styles.completedButtonText]}>Completed</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );})}
            </View>
          )}
        </ScrollView>
      
      {/* Parts Modal */}
      <Modal visible={showPartsModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Parts Used</Text>
            <Text style={styles.modalSubtitle}>Did you use any parts for this repair?</Text>
            
            <ScrollView style={styles.inventoryList}>
              {inventory.map(part => {
                const isSelected = selectedParts.find(p => p.Inventory_id === part.Inventory_id);
                return (
                  <View key={part.Inventory_id} style={[styles.partItem, isSelected && styles.partItemSelected]}>
                    <TouchableOpacity 
                      style={[styles.partInfo, part.quantity <= 0 && { opacity: 0.5 }]}
                      onPress={() => handleTogglePart(part)}
                      disabled={part.quantity <= 0}
                    >
                      <Ionicons 
                        name={isSelected ? "checkmark-circle" : "ellipse-outline"} 
                        size={24} 
                        color={isSelected ? "#0F6B5A" : "#D1D5DB"} 
                      />
                      <View style={{marginLeft: 12, flex: 1}}>
                        <Text style={styles.partName}>{part.part_name}</Text>
                        <Text style={styles.partStock}>Stock: {part.quantity} {part.unit}</Text>
                      </View>
                    </TouchableOpacity>

                    {isSelected && (
                      <View style={styles.quantityControl}>
                        <TouchableOpacity 
                          style={styles.qtyBtn}
                          onPress={() => handleUpdateQuantity(part.Inventory_id, -1)}
                        >
                          <Ionicons name="remove" size={16} color="#0F6B5A" />
                        </TouchableOpacity>
                        <Text style={styles.qtyText}>{isSelected.quantity}</Text>
                        <TouchableOpacity 
                          style={styles.qtyBtn}
                          onPress={() => handleUpdateQuantity(part.Inventory_id, 1)}
                        >
                          <Ionicons name="add" size={16} color="#0F6B5A" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowPartsModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalSubmitBtn, loading && { opacity: 0.7 }]} 
                onPress={submitCompletion}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalSubmitText}>Complete Repair</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  typeTabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#D8E7E1',
    gap: 12,
  },
  typeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#EEF4F1',
    borderRadius: 12,
  },
  typeTabActive: {
    backgroundColor: '#0F6B5A',
  },
  typeTabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6F8B84',
  },
  typeTabTextActive: {
    color: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#23423B',
  },
  refreshButton: {
    padding: 8,
  },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#D8E7E1',
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
    backgroundColor: '#EEF4F1',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#0F6B5A',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4F6C66',
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
  assignmentsList: {
    paddingVertical: 12,
  },
  assignmentCard: {
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
    color: '#23423B',
    marginBottom: 6,
  },
  issueDescription: {
    fontSize: 12,
    color: '#6F8B84',
    lineHeight: 18,
    marginBottom: 12,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#EEF4F1',
    borderRadius: 3,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  scheduleDetails: {
    backgroundColor: '#DDE9E3',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#D8E7E1',
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  scheduleText: {
    fontSize: 11,
    color: '#4F6C66',
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
    color: '#9AB7AF',
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
    backgroundColor: '#0F6B5A',
    borderColor: '#0F6B5A',
  },
  completeButton: {
    backgroundColor: '#2A9D8F',
    borderColor: '#2A9D8F',
  },
  completedButton: {
    backgroundColor: '#EEF4F1',
    borderColor: '#D8E7E1',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#23423B', marginBottom: 4 },
  modalSubtitle: { fontSize: 14, color: '#6F8B84', marginBottom: 16 },
  inventoryList: { maxHeight: 400 },
  partItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#EEF4F1', marginBottom: 12 },
  partItemSelected: { borderColor: '#0F6B5A', backgroundColor: '#F0FDF4' },
  partInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  partName: { fontSize: 15, fontWeight: '600', color: '#23423B' },
  partStock: { fontSize: 12, color: '#6F8B84' },
  quantityControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#DDE9E3' },
  qtyBtn: { padding: 8 },
  qtyText: { width: 30, textAlign: 'center', fontWeight: '700', color: '#0F6B5A' },
  modalActions: { flexDirection: 'row', marginTop: 24, gap: 12 },
  modalCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#EEF4F1', alignItems: 'center' },
  modalCancelText: { color: '#4F6C66', fontWeight: '700', fontSize: 15 },
  modalSubmitBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: '#0F6B5A', alignItems: 'center' },
  modalSubmitText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  completedButtonText: {
    color: '#0F6B5A',
  },
});
