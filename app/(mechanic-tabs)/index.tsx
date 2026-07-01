import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import authService from '../../services/authService';

interface DashboardStats {
  total_inspections: number;
  good_condition: number;
  poor_condition: number;
  critical_condition: number;
  pending_reviews: number;
  assigned_tasks: number;
}

export default function MechanicDashboardScreen() {
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserData();
    fetchDashboardStats();
  }, []);

  const loadUserData = async () => {
    const user = await authService.getUserData();
    setUserData(user);
  };

  const fetchDashboardStats = async () => {
    try {
      const token = await authService.getToken();
      if (!token) {
        // No token – redirect to login
        router.replace('/login');
        return;
      }
      
      const response = await fetch('http://10.65.49.24:8000/api/mechanic/dashboard-stats', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        // Unauthorized – likely logged out, redirect to login
        router.replace('/login');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard stats');
      }
      
      const data = await response.json();
      
      if (data.success && data.stats) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.avatarContainer}>
                <Text style={styles.avatarText}>
                  {(userData?.name || 'M').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.headerText}>
                <Text style={styles.mechanicName}>{userData?.name || 'Mechanic'}</Text>
                <Text style={styles.mechanicId}>ROLE: MECHANIC</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity onPress={handleLogout} style={styles.iconButton}>
                <Ionicons name="log-out-outline" size={22} color="#0F172A" />
              </TouchableOpacity>
            </View>
          </View>

        {/* Modern Welcome Hero */}
          <View style={styles.heroCard}>
            <View style={styles.heroContent}>
              <Text style={styles.heroGreeting}>Hello, {userData?.name?.split(' ')[0] || 'Mechanic'}! 👋</Text>
              <Text style={styles.heroSubtitle}>Ready for your shift today?</Text>
            </View>
            <TouchableOpacity 
              style={styles.heroButton}
              onPress={() => router.push('/(mechanic-tabs)/face-attendance' as any)}
            >
              <Ionicons name="scan-outline" size={20} color="#FFFFFF" />
              <Text style={styles.heroButtonText}>Log Attendance</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#10B981" />
            </View>
          ) : (
            <View style={styles.statsContainer}>
              <Text style={styles.sectionTitle}>Overview</Text>
              
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <View style={[styles.statIconContainer, { backgroundColor: '#F0FDF4' }]}>
                    <Ionicons name="clipboard" size={24} color="#10B981" />
                  </View>
                  <Text style={styles.statValue}>{stats?.total_inspections || 0}</Text>
                  <Text style={styles.statLabel}>Total Inspections</Text>
                </View>

                <View style={styles.statCard}>
                  <View style={[styles.statIconContainer, { backgroundColor: '#EFF6FF' }]}>
                    <Ionicons name="list" size={24} color="#3B82F6" />
                  </View>
                  <Text style={styles.statValue}>{stats?.assigned_tasks || 0}</Text>
                  <Text style={styles.statLabel}>Assigned Tasks</Text>
                </View>

                <View style={styles.statCard}>
                  <View style={[styles.statIconContainer, { backgroundColor: '#FFFBEB' }]}>
                    <Ionicons name="time" size={24} color="#F59E0B" />
                  </View>
                  <Text style={styles.statValue}>{stats?.pending_reviews || 0}</Text>
                  <Text style={styles.statLabel}>Pending Reviews</Text>
                </View>

                <View style={styles.statCard}>
                  <View style={[styles.statIconContainer, { backgroundColor: '#FEF2F2' }]}>
                    <Ionicons name="warning" size={24} color="#DC2626" />
                  </View>
                  <Text style={styles.statValue}>{stats?.critical_condition || 0}</Text>
                  <Text style={styles.statLabel}>Critical Issues</Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  safeArea: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 20,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  headerText: { marginLeft: 12 },
  mechanicName: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  mechanicId: { fontSize: 11, color: '#64748B', fontWeight: '700', marginTop: 1, letterSpacing: 0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  
  heroCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  heroContent: {
    flex: 1,
    marginRight: 16,
  },
  heroGreeting: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
  heroButton: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
  },
  heroButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },

  statsContainer: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '47%',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
    alignItems: 'flex-start',
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 80,
  }
});
