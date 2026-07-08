import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  ActivityIndicator,
} from 'react-native';
import authService from '../../services/authService';

const getApiBaseUrl = () => {
  if (Platform.OS === 'android') {
    return `https://consult-powwow-vexingly.ngrok-free.dev/api`;
  }
  return 'https://consult-powwow-vexingly.ngrok-free.dev/api';
};

export default function MechanicAttendanceHistory() {
  const router = useRouter();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const user = await authService.getUserData();
      if (!user) return;

      const token = await authService.getToken();
      const response = await fetch(`${getApiBaseUrl()}/attendance/history?user_id=${user.user_id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (data.success && data.data) {
        setHistory(data.data);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Present': return { bg: '#E3F2EB', text: '#0F6B5A', border: '#D1E8E0' };
      case 'Late': return { bg: '#FFF7ED', text: '#C2410C', border: '#FFEDD5' };
      case 'Half Day': return { bg: '#EFF6FF', text: '#1D4ED8', border: '#DBEAFE' };
      case 'Absent': return { bg: '#FEF2F2', text: '#EF4444', border: '#FEE2E2' };
      default: return { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' };
    }
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return '--:--';
    const [hours, minutes] = timeString.split(':');
    let h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12; 
    return `${h}:${minutes} ${ampm}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#DDE9E3" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#23423B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Attendance History</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#0F6B5A" />
            <Text style={styles.loadingText}>Loading history...</Text>
          </View>
        ) : history.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="calendar-outline" size={64} color="#9AB7AF" />
            <Text style={styles.emptyText}>No attendance records found</Text>
          </View>
        ) : (
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {history.map((record, index) => {
              const colors = getStatusColor(record.status);
              
              return (
                <View key={index} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.dateContainer}>
                      <Ionicons name="calendar" size={16} color="#6F8B84" />
                      <Text style={styles.dateText}>{formatDate(record.attendance_date)}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                      <Text style={[styles.statusText, { color: colors.text }]}>{record.status}</Text>
                    </View>
                  </View>

                  <View style={styles.timeGrid}>
                    <View style={styles.timeColumn}>
                      <Text style={styles.timeLabel}>Morning In</Text>
                      <Text style={styles.timeValue}>{formatTime(record.morning_in)}</Text>
                    </View>
                    <View style={styles.timeColumn}>
                      <Text style={styles.timeLabel}>Morning Out</Text>
                      <Text style={styles.timeValue}>{formatTime(record.morning_out)}</Text>
                    </View>
                    <View style={styles.timeColumn}>
                      <Text style={styles.timeLabel}>Afternoon In</Text>
                      <Text style={styles.timeValue}>{formatTime(record.afternoon_in)}</Text>
                    </View>
                    <View style={styles.timeColumn}>
                      <Text style={styles.timeLabel}>Afternoon Out</Text>
                      <Text style={styles.timeValue}>{formatTime(record.afternoon_out)}</Text>
                    </View>
                  </View>

                  <View style={styles.statsContainer}>
                    <View style={styles.statBox}>
                      <Text style={styles.statValue}>{Number(record.total_work_hours || 0).toFixed(1)}</Text>
                      <Text style={styles.statLabel}>Total Hrs</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={[styles.statValue, { color: record.late_minutes > 0 ? '#C2410C' : '#23423B' }]}>
                        {record.late_minutes || 0}
                      </Text>
                      <Text style={styles.statLabel}>Late Mins</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={[styles.statValue, { color: record.undertime_minutes > 0 ? '#1D4ED8' : '#23423B' }]}>
                        {record.undertime_minutes || 0}
                      </Text>
                      <Text style={styles.statLabel}>Under Mins</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#DDE9E3' },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#D8E7E1',
    backgroundColor: '#DDE9E3',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#23423B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#23423B',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6F8B84',
    fontWeight: '600',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6F8B84',
    fontWeight: '600',
  },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#D8E7E1',
    shadowColor: '#23423B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#23423B',
    marginLeft: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  timeColumn: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
  },
  timeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    padding: 12,
    gap: 12,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderRadius: 12,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#23423B',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
});
