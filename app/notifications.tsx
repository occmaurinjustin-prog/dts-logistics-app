import authService from '@/services/authService';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
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
      
      // Fetch maintenance reports from API
      const response = await fetch('https://consult-powwow-vexingly.ngrok-free.dev/api/driver/maintenance-reports', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const data = await response.json();
      
      if (data.success && data.reports) {
        // Transform maintenance reports into notifications
        const transformedNotifications: Notification[] = data.reports
          .filter((report: any) => ['approved', 'in_progress', 'completed'].includes(report.status))
          .map((report: any) => ({
            id: report.id.toString(),
            title: report.notification_title || 'Maintenance Update',
            message: report.notification_message || report.issue_title,
            type: report.notification_type || 'general',
            scheduledDate: report.scheduled_date || undefined,
            scheduledTime: report.scheduled_time || undefined,
            location: report.location || undefined,
            estimatedDuration: report.estimated_duration || undefined,
            priority: report.priority_level || 'medium',
            status: report.notification_status || 'unread',
            createdAt: report.created_at,
          }));

        setNotifications(transformedNotifications);
      } else {
        setNotifications([]);
      }
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
            <Ionicons name="arrow-back" size={22} color="#0F172A" />
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
              color="#0F172A" 
              style={refreshing ? { transform: [{ rotate: '180deg' }] } : {}}
            />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#10B981" />
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
    backgroundColor: '#F8FAFC',
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 0 : 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 4,
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  badge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  refreshButton: {
    padding: 4,
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
  notificationsList: {
    paddingVertical: 12,
  },
  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  unreadCard: {
    borderColor: '#10B981',
    borderWidth: 1.5,
    backgroundColor: '#ECFDF5',
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
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 8,
  },
  scheduleDetails: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  scheduleText: {
    fontSize: 11,
    color: '#475569',
    marginLeft: 6,
    fontWeight: '500',
  },
  notificationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notificationTime: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  priorityBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  notificationActions: {
    alignItems: 'center',
    marginLeft: 8,
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
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
