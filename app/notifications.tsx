import authService from '@/services/authService';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
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

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'maintenance' | 'schedule' | 'general' | 'urgent';
  scheduledDate?: string;
  scheduledTime?: string;
  location?: string;
  estimatedDuration?: string;
  priority?: 'low' | 'medium' | 'high' | 'emergency';
  status: 'unread' | 'read';
  createdAt: string;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const token = await authService.getToken();
      
      // Mock data for now - replace with actual API call
      const mockNotifications: Notification[] = [
        {
          id: '1',
          title: 'Truck Maintenance Scheduled',
          message: 'Your truck TRK-102 is scheduled for preventive maintenance on May 15, 2026 at 9:00 AM.',
          type: 'maintenance',
          scheduledDate: 'May 15, 2026',
          scheduledTime: '9:00 AM',
          location: 'DTS Main Workshop',
          estimatedDuration: '2-3 hours',
          priority: 'medium',
          status: 'unread',
          createdAt: '2026-05-09T10:30:00Z'
        },
        {
          id: '2',
          title: 'Urgent: Brake Inspection Required',
          message: 'Please bring your truck for immediate brake inspection. Safety concern detected.',
          type: 'urgent',
          scheduledDate: 'May 10, 2026',
          scheduledTime: '2:00 PM',
          location: 'DTS Emergency Bay',
          estimatedDuration: '1 hour',
          priority: 'emergency',
          status: 'unread',
          createdAt: '2026-05-09T08:15:00Z'
        },
        {
          id: '3',
          title: 'Schedule Change Notice',
          message: 'Your maintenance schedule has been moved to May 20, 2026 due to parts availability.',
          type: 'schedule',
          scheduledDate: 'May 20, 2026',
          scheduledTime: '10:00 AM',
          location: 'DTS Main Workshop',
          estimatedDuration: '3 hours',
          priority: 'low',
          status: 'read',
          createdAt: '2026-05-08T16:45:00Z'
        },
        {
          id: '4',
          title: 'Maintenance Complete',
          message: 'Your truck maintenance has been completed. Vehicle is ready for pickup.',
          type: 'general',
          priority: 'low',
          status: 'read',
          createdAt: '2026-05-07T14:20:00Z'
        }
      ];

      setNotifications(mockNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      Alert.alert('Error', 'Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const handleBack = () => {
    router.back();
  };

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === notificationId 
          ? { ...notif, status: 'read' as const }
          : notif
      )
    );
  };

  const deleteNotification = (notificationId: string) => {
    Alert.alert(
      'Delete Notification',
      'Are you sure you want to delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
          }
        }
      ]
    );
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'maintenance':
        return 'build-outline';
      case 'schedule':
        return 'calendar-outline';
      case 'urgent':
        return 'alert-circle-outline';
      default:
        return 'notifications-outline';
    }
  };

  const getNotificationColor = (type: string, priority?: string) => {
    if (priority === 'emergency') return '#DC2626';
    if (priority === 'high') return '#F59E0B';
    
    switch (type) {
      case 'maintenance':
        return '#22C55E';
      case 'schedule':
        return '#3B82F6';
      case 'urgent':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getPriorityBadgeColor = (priority?: string) => {
    switch (priority) {
      case 'emergency':
        return '#FEE2E2';
      case 'high':
        return '#FEF3C7';
      case 'medium':
        return '#DBEAFE';
      case 'low':
        return '#F3F4F6';
      default:
        return '#F3F4F6';
    }
  };

  const getPriorityBadgeTextColor = (priority?: string) => {
    switch (priority) {
      case 'emergency':
        return '#DC2626';
      case 'high':
        return '#D97706';
      case 'medium':
        return '#1D4ED8';
      case 'low':
        return '#6B7280';
      default:
        return '#6B7280';
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
  };

  const unreadCount = notifications.filter(n => n.status === 'unread').length;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Notifications</Text>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
            <Ionicons 
              name="refresh" 
              size={20} 
              color="#FFFFFF" 
              style={refreshing ? { transform: [{ rotate: '180deg' }] } : {}}
            />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#22C55E" />
              <Text style={styles.loadingText}>Loading notifications...</Text>
            </View>
          ) : notifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={64} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No Notifications</Text>
              <Text style={styles.emptyMessage}>You're all caught up! No new notifications.</Text>
            </View>
          ) : (
            <View style={styles.notificationsList}>
              {notifications.map((notification) => (
                <TouchableOpacity
                  key={notification.id}
                  style={[
                    styles.notificationCard,
                    notification.status === 'unread' && styles.unreadCard
                  ]}
                  onPress={() => markAsRead(notification.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.notificationHeader}>
                    <View style={styles.notificationLeft}>
                      <View style={[
                        styles.iconContainer,
                        { backgroundColor: `${getNotificationColor(notification.type, notification.priority)}20` }
                      ]}>
                        <Ionicons 
                          name={getNotificationIcon(notification.type) as any}
                          size={20} 
                          color={getNotificationColor(notification.type, notification.priority)}
                        />
                      </View>
                      <View style={styles.notificationContent}>
                        <Text style={styles.notificationTitle}>{notification.title}</Text>
                        <Text style={styles.notificationMessage}>{notification.message}</Text>
                        
                        {/* Schedule Details */}
                        {(notification.scheduledDate || notification.scheduledTime || notification.location) && (
                          <View style={styles.scheduleDetails}>
                            {notification.scheduledDate && (
                              <View style={styles.scheduleItem}>
                                <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                                <Text style={styles.scheduleText}>{notification.scheduledDate}</Text>
                              </View>
                            )}
                            {notification.scheduledTime && (
                              <View style={styles.scheduleItem}>
                                <Ionicons name="time-outline" size={14} color="#6B7280" />
                                <Text style={styles.scheduleText}>{notification.scheduledTime}</Text>
                              </View>
                            )}
                            {notification.location && (
                              <View style={styles.scheduleItem}>
                                <Ionicons name="location-outline" size={14} color="#6B7280" />
                                <Text style={styles.scheduleText}>{notification.location}</Text>
                              </View>
                            )}
                            {notification.estimatedDuration && (
                              <View style={styles.scheduleItem}>
                                <Ionicons name="hourglass-outline" size={14} color="#6B7280" />
                                <Text style={styles.scheduleText}>{notification.estimatedDuration}</Text>
                              </View>
                            )}
                          </View>
                        )}
                        
                        <View style={styles.notificationFooter}>
                          <Text style={styles.notificationTime}>
                            {formatDateTime(notification.createdAt)}
                          </Text>
                          {notification.priority && (
                            <View style={[
                              styles.priorityBadge,
                              { backgroundColor: getPriorityBadgeColor(notification.priority) }
                            ]}>
                              <Text style={[
                                styles.priorityBadgeText,
                                { color: getPriorityBadgeTextColor(notification.priority) }
                              ]}>
                                {notification.priority.toUpperCase()}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                    
                    <View style={styles.notificationActions}>
                      {notification.status === 'unread' && (
                        <View style={styles.unreadIndicator} />
                      )}
                      <TouchableOpacity
                        onPress={() => deleteNotification(notification.id)}
                        style={styles.deleteButton}
                      >
                        <Ionicons name="close" size={16} color="#9CA3AF" />
                      </TouchableOpacity>
                    </View>
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
    backgroundColor: '#F5F7FA',
  },
  safeArea: {
    flex: 1,
    paddingTop: 55,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#22C55E',
  },
  backButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  badge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  refreshButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
  },
  emptyMessage: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  notificationsList: {
    paddingVertical: 8,
  },
  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  unreadCard: {
    borderColor: '#22C55E',
    borderWidth: 1.5,
    backgroundColor: '#F0FDF4',
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  notificationLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 8,
  },
  scheduleDetails: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  scheduleText: {
    fontSize: 12,
    color: '#374151',
    marginLeft: 6,
  },
  notificationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notificationTime: {
    fontSize: 12,
    color: '#6B7280',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  priorityBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  notificationActions: {
    alignItems: 'center',
    marginLeft: 8,
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
    marginBottom: 8,
  },
  deleteButton: {
    padding: 4,
  },
});

// Configure screen options for Expo Router
NotificationsScreen.options = {
  title: 'Notifications',
  headerShown: false, // Hide default header to use custom header only
};

<Stack.Screen name="maintenance" options={{ headerShown: false }} />
