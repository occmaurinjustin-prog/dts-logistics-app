import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import authService from '../../services/authService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 12;
const GRID_PADDING = 20;
const QUICK_ACTION_SIZE = (SCREEN_WIDTH - GRID_PADDING * 2 - CARD_GAP * 3) / 4;

// ── Types ──────────────────────────────────────────────
interface DashboardStats {
  total_inspections: number;
  good_condition: number;
  poor_condition: number;
  critical_condition: number;
  pending_reviews: number;
  assigned_tasks: number;
  completed_rescues?: number;
}

interface RescueAssignment {
  rescue_id: number;
  status: string;
  issue_category: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  created_at: string;
  driver?: { user?: { firstname?: string; lastname?: string; profile_image?: string } };
  truck?: { plate_number?: string };
}

// ── API Config ─────────────────────────────────────────
const API_BASE = Platform.OS === 'android' ? 'http://10.65.49.24:8000/api' : 'http://localhost:8000/api';

// ── Animated Pressable ─────────────────────────────────
const PressableCard = ({ children, onPress, style }: any) => {
  const scale = useRef(new Animated.Value(1)).current;
  const handleIn = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  const handleOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  return (
    <TouchableOpacity activeOpacity={1} onPressIn={handleIn} onPressOut={handleOut} onPress={onPress}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </TouchableOpacity>
  );
};

// ── Quick Action Button ────────────────────────────────
const QuickAction = ({ icon, label, color, bg, onPress }: { icon: string; label: string; color: string; bg: string; onPress: () => void }) => (
  <PressableCard onPress={onPress} style={[s.qaCard, { width: QUICK_ACTION_SIZE }]}>  
    <View style={[s.qaIcon, { backgroundColor: bg }]}>  
      <Ionicons name={icon as any} size={20} color={color} />
    </View>
    <Text style={s.qaLabel} numberOfLines={1}>{label}</Text>
  </PressableCard>
);

// ── Chip ───────────────────────────────────────────────
const Chip = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <View style={s.chip}>
    <Text style={[s.chipValue, { color }]}>{value}</Text>
    <Text style={s.chipLabel}>{label}</Text>
  </View>
);

// ── Timeline Item ──────────────────────────────────────
const TimelineItem = ({ time, title, isLast, color }: { time: string; title: string; isLast?: boolean; color: string }) => (
  <View style={s.tlRow}>
    <View style={s.tlLeft}>
      <View style={[s.tlDot, { backgroundColor: color }]} />
      {!isLast && <View style={s.tlLine} />}
    </View>
    <View style={s.tlContent}>
      <Text style={s.tlTime}>{time}</Text>
      <Text style={s.tlTitle}>{title}</Text>
    </View>
  </View>
);

// ═══════════════════════════════════════════════════════
//  MAIN SCREEN
// ═══════════════════════════════════════════════════════
export default function MechanicDashboardScreen() {
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [rescues, setRescues] = useState<RescueAssignment[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fade‑in animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    loadAll();
  }, []);

  // Polling every 15s for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAllData();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchAllData = async () => {
    await Promise.all([fetchDashboardStats(), fetchRescues(), fetchAssignments(), fetchInspections(), fetchTrucks()]);
  };

  const loadAll = async () => {
    await loadUserData();
    await fetchAllData();
    setLoading(false);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  };

  const loadUserData = async () => {
    const user = await authService.getUserData();
    setUserData(user);
  };

  const fetchDashboardStats = async () => {
    try {
      const token = await authService.getToken();
      if (!token) { router.replace('/login'); return; }
      const res = await fetch(`${API_BASE}/mechanic/dashboard-stats`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.status === 401) { router.replace('/login'); return; }
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      if (data.success && data.stats) setStats(data.stats);
    } catch (e) {
      console.error('Stats error:', e);
    }
  };

  const fetchRescues = async () => {
    try {
      const token = await authService.getToken();
      if (!token) return;
      const res = await fetch(`${API_BASE}/rescue/mechanic/assignments`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setRescues(data.data || []);
      }
    } catch (e) {
      console.error('Rescue error:', e);
    }
  };

  const fetchAssignments = async () => {
    try {
      const token = await authService.getToken();
      if (!token) return;
      const res = await fetch(`${API_BASE}/mechanic/assignments`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setAssignments(data.assignments || []);
      }
    } catch (e) {
      console.error('Assignments error:', e);
    }
  };

  const fetchInspections = async () => {
    try {
      const token = await authService.getToken();
      if (!token) return;
      const res = await fetch(`${API_BASE}/mechanic/inspection-reports`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setInspections(data.reports || []);
      }
    } catch (e) {
      console.error('Inspections error:', e);
    }
  };

  const fetchTrucks = async () => {
    try {
      const token = await authService.getToken();
      if (!token) return;
      const res = await fetch(`${API_BASE}/mechanic/trucks`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setTrucks(data.trucks || []);
      }
    } catch (e) {
      console.error('Trucks error:', e);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
  }, []);

  const handleLogout = async () => {
    await authService.logout();
    router.replace('/login');
  };

  // ── Derived Data ──

  // Active rescue
  const activeRescue = rescues.find(r => ['assigned', 'en_route', 'arrived'].includes(r.status));

  // Recent rescues (all, most recent first, limit 5)
  const recentRescues = rescues.slice(0, 5);

  // User info
  const firstName = userData?.name?.split(' ')[0] || 'Mechanic';
  const initials = (userData?.name || 'M').charAt(0).toUpperCase();
  const baseUrl = API_BASE.replace('/api', '');
  const profileImageUrl = userData?.profile_image 
    ? (userData.profile_image.startsWith('http') ? userData.profile_image : `${baseUrl}/storage/${userData.profile_image}`)
    : null;

  // Performance
  const completedToday = stats?.good_condition ?? 0;
  const totalToday = stats?.total_inspections ?? 0;
  const progressPct = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

  // Today's Schedule — from real maintenance assignments (sorted by repair_date/time)
  const todayStr = new Date().toISOString().split('T')[0];
  const todaySchedule = assignments
    .filter(a => {
      if (!a.repair_date) return false;
      return a.repair_date.startsWith(todayStr);
    })
    .sort((a, b) => (a.repair_time || '').localeCompare(b.repair_time || ''))
    .slice(0, 6);

  // Only show tasks actually scheduled for today
  const scheduleItems = todaySchedule;

  const getScheduleColor = (status: string) => {
    if (status === 'completed') return '#0F6B5A';
    if (status === 'in_progress') return '#F59E0B';
    if (status === 'scheduled') return '#0EA5E9';
    return '#2D8C73';
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '--:--';
    return timeStr.substring(0, 5);
  };

  // Recent Activities — combine latest inspections + rescues into a single timeline
  const recentActivities: { time: string; title: string; color: string }[] = [];

  // Add recent inspections
  inspections.slice(0, 3).forEach(insp => {
    const ago = getTimeAgo(insp.created_at);
    const condLabel = insp.overall_condition === 'critical' ? '⚠️ Critical' : insp.overall_condition === 'poor' ? 'Poor Condition' : 'Inspection';
    recentActivities.push({
      time: ago,
      title: `${condLabel} — ${insp.truck?.plate_number || 'Truck'}`,
      color: insp.overall_condition === 'critical' ? '#EF4444' : insp.overall_condition === 'poor' ? '#F59E0B' : '#0EA5E9',
    });
  });

  // Add recent rescues
  rescues.slice(0, 3).forEach(r => {
    const ago = getTimeAgo(r.created_at);
    const statusLabel = r.status === 'resolved' ? 'Rescue Resolved' : r.status === 'en_route' ? 'En Route' : r.status === 'arrived' ? 'On Site' : 'Rescue Assigned';
    recentActivities.push({
      time: ago,
      title: `${statusLabel} — ${r.issue_category}`,
      color: r.status === 'resolved' ? '#0F6B5A' : '#EF4444',
    });
  });

  // Sort by most recent (approximation: shorter "ago" text first)
  recentActivities.sort((a, b) => a.time.localeCompare(b.time));
  const displayActivities = recentActivities.slice(0, 5);

  // Fleet Overview — from real truck data
  const fleetAvailable = trucks.filter(t => t.condition === 'good' || t.condition === 'operational').length;
  const fleetRepair = trucks.filter(t => t.condition === 'fair' || t.condition === 'poor').length;
  const fleetCritical = trucks.filter(t => t.condition === 'critical').length;
  const fleetTotal = trucks.length;

  // Rescue status badge helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved': return { bg: '#E3F2EB', color: '#166534', label: 'Resolved' };
      case 'assigned': return { bg: '#FEF3C7', color: '#92400E', label: 'Assigned' };
      case 'en_route': return { bg: '#DBEAFE', color: '#1E40AF', label: 'En Route' };
      case 'arrived': return { bg: '#E0E7FF', color: '#3730A3', label: 'On Site' };
      default: return { bg: '#EEF4F1', color: '#4F6C66', label: status };
    }
  };

  // ── Loading State ──
  if (loading) {
    return (
      <View style={s.loadingScreen}>
        <StatusBar barStyle="dark-content" backgroundColor="#DDE9E3" />
        <ActivityIndicator size="large" color="#0F6B5A" />
        <Text style={s.loadingText}>Loading dashboard…</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#DDE9E3" />
      <SafeAreaView style={s.safe} edges={['top']}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {/* ─── HEADER ─── */}
          <View style={s.header}>
            <View style={s.headerLeft}>
              <View style={s.avatar}>
                {profileImageUrl ? (
                  <Image source={{ uri: profileImageUrl }} style={s.avatarImage} />
                ) : (
                  <Text style={s.avatarText}>{initials}</Text>
                )}
                <View style={s.onlineDot} />
              </View>
              <View style={s.headerInfo}>
                <Text style={s.headerName}>{userData?.name || 'Mechanic'}</Text>
                <Text style={s.headerRole}>MECHANIC</Text>
              </View>
            </View>
            <View style={s.headerActions}>
              <TouchableOpacity style={s.headerBtn} onPress={() => router.push('/(mechanic-tabs)/profile' as any)}>
                <Ionicons name="notifications-outline" size={20} color="#23423B" />
              </TouchableOpacity>
              <TouchableOpacity style={s.headerBtn} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={20} color="#23423B" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0F6B5A" colors={['#0F6B5A']} />}
          >
            {/* ─── SECTION 1: CURRENT ASSIGNMENT ─── */}
            {activeRescue ? (
              <PressableCard
                onPress={() => router.push('/(mechanic-tabs)/assignments' as any)}
                style={s.heroCard}
              >
                <View style={s.heroTop}>
                  <View style={s.heroLive}>
                    <View style={s.liveDot} />
                    <Text style={s.liveText}>ACTIVE RESCUE</Text>
                  </View>
                  <View style={[s.priorityBadge, { backgroundColor: activeRescue.status === 'assigned' ? '#FEF3C7' : '#DCFCE7' }]}>
                    <Text style={[s.priorityText, { color: activeRescue.status === 'assigned' ? '#92400E' : '#166534' }]}>
                      {activeRescue.status.toUpperCase().replace('_', ' ')}
                    </Text>
                  </View>
                </View>
                <View style={s.heroBody}>
                  <View style={s.heroMeta}>
                    <Ionicons name="car-sport" size={16} color="#9AB7AF" />
                    <Text style={s.heroMetaText}>{activeRescue.truck?.plate_number || 'N/A'}</Text>
                  </View>
                  <View style={s.heroMeta}>
                    <Ionicons name="person" size={16} color="#9AB7AF" />
                    <Text style={s.heroMetaText}>
                      {activeRescue.driver?.user ? `${activeRescue.driver.user.firstname || ''} ${activeRescue.driver.user.lastname || ''}`.trim() : 'Driver'}
                    </Text>
                  </View>
                  <View style={s.heroMeta}>
                    <Ionicons name="construct" size={16} color="#9AB7AF" />
                    <Text style={s.heroMetaText}>{activeRescue.issue_category}</Text>
                  </View>
                  {activeRescue.address && (
                    <View style={s.heroMeta}>
                      <Ionicons name="location" size={16} color="#9AB7AF" />
                      <Text style={s.heroMetaText} numberOfLines={1}>{activeRescue.address}</Text>
                    </View>
                  )}
                </View>
                <View style={s.heroAction}>
                  <Text style={s.heroActionText}>View Assignment</Text>
                  <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
                </View>
              </PressableCard>
            ) : (
              <View style={s.heroEmpty}>
                <View style={s.heroEmptyIcon}>
                  <Ionicons name="checkmark-circle" size={32} color="#0F6B5A" />
                </View>
                <Text style={s.heroEmptyTitle}>All Clear</Text>
                <Text style={s.heroEmptySub}>No active assignment right now</Text>
              </View>
            )}

            {/* ─── SECTION 2: QUICK ACTIONS ─── */}
            <Text style={s.sectionTitle}>Quick Actions</Text>
            <View style={s.qaGrid}>
              <QuickAction icon="scan-outline" label="Attendance" color="#2D8C73" bg="#E8F3EF" onPress={() => router.push('/(mechanic-tabs)/face-attendance' as any)} />
              <QuickAction icon="search-outline" label="Inspection" color="#0EA5E9" bg="#E0F2FE" onPress={() => router.push('/(mechanic-tabs)/inspection-reports' as any)} />
              <QuickAction icon="warning-outline" label="Rescues" color="#F59E0B" bg="#FEF3C7" onPress={() => router.push('/(mechanic-tabs)/assignments' as any)} />
              <QuickAction icon="clipboard-outline" label="Tasks" color="#0F6B5A" bg="#E3F2EB" onPress={() => router.push('/(mechanic-tabs)/assignments' as any)} />
            </View>
        

            {/* ─── SECTION 3: TODAY'S SUMMARY ─── */}
            <Text style={s.sectionTitle}>Today's Summary</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipScroll}>
              <Chip label="Inspections" value={stats?.total_inspections ?? 0} color="#0EA5E9" />
              <Chip label="Assigned" value={stats?.assigned_tasks ?? 0} color="#2D8C73" />
              <Chip label="Pending" value={stats?.pending_reviews ?? 0} color="#F59E0B" />
              <Chip label="Critical" value={stats?.critical_condition ?? 0} color="#EF4444" />
              <Chip label="Good" value={stats?.good_condition ?? 0} color="#0F6B5A" />
              <Chip label="Rescues" value={stats?.completed_rescues ?? 0} color="#8B5CF6" />
            </ScrollView>

            {/* ─── SECTION 4: TODAY'S SCHEDULE (REAL-TIME) ─── */}
            <Text style={s.sectionTitle}>Today's Schedule</Text>
            <View style={s.card}>
              {scheduleItems.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                  <Ionicons name="calendar-outline" size={28} color="#C7DDD5" />
                  <Text style={{ fontSize: 13, color: '#9AB7AF', fontWeight: '600', marginTop: 8 }}>No scheduled tasks today</Text>
                </View>
              ) : (
                scheduleItems.map((task, idx) => (
                  <TimelineItem
                    key={task.id || idx}
                    time={formatTime(task.repair_time)}
                    title={`${task.issue_title || 'Maintenance'} — ${task.truck?.plate_number || 'Truck'}`}
                    color={getScheduleColor(task.status)}
                    isLast={idx === scheduleItems.length - 1}
                  />
                ))
              )}
            </View>

            {/* ─── SECTION 5: RECENT RESCUE REQUESTS (REAL-TIME) ─── */}
            <Text style={s.sectionTitle}>Recent Rescues</Text>
            {recentRescues.length === 0 ? (
              <View style={[s.card, { alignItems: 'center', paddingVertical: 20 }]}>
                <Ionicons name="shield-checkmark-outline" size={28} color="#C7DDD5" />
                <Text style={{ fontSize: 13, color: '#9AB7AF', fontWeight: '600', marginTop: 8 }}>No rescue requests</Text>
              </View>
            ) : (
              recentRescues.map(r => {
                const badge = getStatusBadge(r.status);
                const driverImage = r.driver?.user?.profile_image 
                  ? (r.driver.user.profile_image.startsWith('http') ? r.driver.user.profile_image : `${baseUrl}/storage/${r.driver.user.profile_image}`)
                  : null;

                return (
                  <PressableCard key={r.rescue_id} onPress={() => router.push('/(mechanic-tabs)/assignments' as any)} style={s.rescueCard}>
                    <View style={s.rescueRow}>
                      <View style={[s.rescueAvatar, driverImage ? { backgroundColor: 'transparent' } : {}]}>
                        {driverImage ? (
                          <Image source={{ uri: driverImage }} style={{ width: '100%', height: '100%', borderRadius: 20 }} />
                        ) : (
                          <Ionicons name="person" size={18} color="#6F8B84" />
                        )}
                      </View>
                      <View style={s.rescueInfo}>
                        <Text style={s.rescueName}>
                          {r.driver?.user ? `${r.driver.user.firstname || ''} ${r.driver.user.lastname || ''}`.trim() : 'Driver'}
                        </Text>
                        <Text style={s.rescueMeta}>{r.truck?.plate_number || 'N/A'} · {r.issue_category}</Text>
                      </View>
                      <View style={[s.rescueBadge, { backgroundColor: badge.bg }]}>
                        <Text style={[s.rescueBadgeText, { color: badge.color }]}>{badge.label}</Text>
                      </View>
                    </View>
                  </PressableCard>
                );
              })
            )}

            {/* ─── SECTION 6: RECENT ACTIVITIES (REAL-TIME) ─── */}
            <Text style={s.sectionTitle}>Recent Activities</Text>
            <View style={s.card}>
              {displayActivities.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                  <Ionicons name="pulse-outline" size={28} color="#C7DDD5" />
                  <Text style={{ fontSize: 13, color: '#9AB7AF', fontWeight: '600', marginTop: 8 }}>No recent activity</Text>
                </View>
              ) : (
                displayActivities.map((activity, idx) => (
                  <TimelineItem
                    key={idx}
                    time={activity.time}
                    title={activity.title}
                    color={activity.color}
                    isLast={idx === displayActivities.length - 1}
                  />
                ))
              )}
            </View>

            {/* ─── SECTION 7: PERFORMANCE ─── */}
            <Text style={s.sectionTitle}>Performance</Text>
            <View style={s.perfCard}>
              <View style={s.perfCircleWrap}>
                <View style={s.perfCircle}>
                  <Text style={s.perfPct}>{progressPct}%</Text>
                  <Text style={s.perfPctSub}>Done</Text>
                </View>
              </View>
              <View style={s.perfDetails}>
                <Text style={s.perfTitle}>Today's Work</Text>
                <Text style={s.perfSub}>{completedToday} of {totalToday} jobs completed</Text>
                <View style={s.perfBar}>
                  <View style={[s.perfBarFill, { width: `${progressPct}%` }]} />
                </View>
              </View>
            </View>

            {/* ─── SECTION 8: FLEET OVERVIEW (REAL-TIME) ─── */}
            <Text style={s.sectionTitle}>Fleet Overview</Text>
            <View style={s.fleetGrid}>
              <View style={s.fleetCard}>
                <Ionicons name="car" size={20} color="#0F6B5A" />
                <Text style={s.fleetValue}>{fleetAvailable}</Text>
                <Text style={s.fleetLabel}>Available</Text>
              </View>
              <View style={s.fleetCard}>
                <Ionicons name="build" size={20} color="#F59E0B" />
                <Text style={s.fleetValue}>{fleetRepair}</Text>
                <Text style={s.fleetLabel}>Under Repair</Text>
              </View>
              <View style={s.fleetCard}>
                <Ionicons name="alert-circle" size={20} color="#EF4444" />
                <Text style={s.fleetValue}>{fleetCritical}</Text>
                <Text style={s.fleetLabel}>Critical</Text>
              </View>
              <View style={s.fleetCard}>
                <Ionicons name="speedometer" size={20} color="#2D8C73" />
                <Text style={s.fleetValue}>{fleetTotal}</Text>
                <Text style={s.fleetLabel}>Total Fleet</Text>
              </View>
            </View>

            <View style={{ height: 32 }} />
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

// ── Helper: time ago ───────────────────────────────────
function getTimeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const now = new Date();
  const past = new Date(dateStr);
  const diffMs = now.getTime() - past.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ═══════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════
const s = StyleSheet.create({
  // Root
  root: { flex: 1, backgroundColor: '#DDE9E3' },
  safe: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: GRID_PADDING, paddingTop: 8, paddingBottom: 100 },

  // Loading
  loadingScreen: { flex: 1, backgroundColor: '#DDE9E3', justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 14, color: '#9AB7AF', fontWeight: '600' },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: GRID_PADDING, paddingTop: 16, paddingBottom: 16, backgroundColor: '#DDE9E3', zIndex: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#0F6B5A',
    justifyContent: 'center', alignItems: 'center', position: 'relative',
  },
  avatarImage: { width: 44, height: 44, borderRadius: 22 },
  avatarText: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0, width: 12, height: 12,
    borderRadius: 6, backgroundColor: '#22C55E', borderWidth: 2, borderColor: '#DDE9E3',
  },
  headerInfo: { marginLeft: 12 },
  headerName: { fontSize: 16, fontWeight: '700', color: '#23423B', letterSpacing: -0.3 },
  headerRole: { fontSize: 10, fontWeight: '800', color: '#9AB7AF', letterSpacing: 1, marginTop: 1 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#EEF4F1',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },

  // Hero – Active Assignment
  heroCard: {
    backgroundColor: '#0F6B5A', borderRadius: 20, padding: 20, marginBottom: 24,
    shadowColor: '#23423B', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 10,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  heroLive: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  liveText: { fontSize: 11, fontWeight: '800', color: '#EF4444', letterSpacing: 1 },
  priorityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  priorityText: { fontSize: 11, fontWeight: '700' },
  heroBody: { gap: 10, marginBottom: 20 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroMetaText: { fontSize: 14, color: '#C7DDD5', fontWeight: '500', flex: 1 },
  heroAction: {
    backgroundColor: '#0F6B5A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 14, gap: 6,
  },
  heroActionText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  // Hero – Empty
  heroEmpty: {
    backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 32, alignItems: 'center',
    marginBottom: 24, borderWidth: 1, borderColor: '#EEF4F1',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2,
  },
  heroEmptyIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#E3F2EB',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  heroEmptyTitle: { fontSize: 17, fontWeight: '700', color: '#23423B', marginBottom: 4 },
  heroEmptySub: { fontSize: 13, color: '#9AB7AF', fontWeight: '500' },

  // Section
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#23423B', marginBottom: 12, letterSpacing: -0.3 },

  // Quick Actions
  qaGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  qaCard: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: 14,
    backgroundColor: '#FFFFFF', borderRadius: 16,
    borderWidth: 1, borderColor: '#EEF4F1',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  qaIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  qaLabel: { fontSize: 11, fontWeight: '700', color: '#4F6C66', letterSpacing: -0.2 },

  // Chips
  chipScroll: { gap: 10, paddingBottom: 4, marginBottom: 24 },
  chip: {
    height: 70, width: 100, backgroundColor: '#FFFFFF', borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#EEF4F1',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1,
  },
  chipValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  chipLabel: { fontSize: 10, fontWeight: '700', color: '#9AB7AF', marginTop: 2, letterSpacing: 0.2, textTransform: 'uppercase' },

  // Card (generic white)
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, marginBottom: 24,
    borderWidth: 1, borderColor: '#EEF4F1',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },

  // Timeline
  tlRow: { flexDirection: 'row', minHeight: 52 },
  tlLeft: { width: 28, alignItems: 'center' },
  tlDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  tlLine: { width: 2, flex: 1, backgroundColor: '#D8E7E1', marginVertical: 4 },
  tlContent: { flex: 1, paddingLeft: 10, paddingBottom: 16 },
  tlTime: { fontSize: 11, fontWeight: '700', color: '#9AB7AF', marginBottom: 2, letterSpacing: 0.3 },
  tlTitle: { fontSize: 14, fontWeight: '600', color: '#23423B' },

  // Rescue Cards
  rescueCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#EEF4F1',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  rescueRow: { flexDirection: 'row', alignItems: 'center' },
  rescueAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#EEF4F1',
    justifyContent: 'center', alignItems: 'center',
  },
  rescueInfo: { flex: 1, marginLeft: 12 },
  rescueName: { fontSize: 14, fontWeight: '700', color: '#23423B' },
  rescueMeta: { fontSize: 12, color: '#9AB7AF', fontWeight: '500', marginTop: 2 },
  rescueBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  rescueBadgeText: { fontSize: 11, fontWeight: '700' },

  // Performance
  perfCard: {
    backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20, marginBottom: 24,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#EEF4F1',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  perfCircleWrap: { marginRight: 20 },
  perfCircle: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 4, borderColor: '#0F6B5A',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#E3F2EB',
  },
  perfPct: { fontSize: 18, fontWeight: '800', color: '#23423B', letterSpacing: -0.5 },
  perfPctSub: { fontSize: 10, fontWeight: '700', color: '#9AB7AF', marginTop: -2 },
  perfDetails: { flex: 1 },
  perfTitle: { fontSize: 15, fontWeight: '700', color: '#23423B', marginBottom: 4 },
  perfSub: { fontSize: 12, color: '#9AB7AF', fontWeight: '500', marginBottom: 10 },
  perfBar: { height: 6, backgroundColor: '#EEF4F1', borderRadius: 3, overflow: 'hidden' },
  perfBarFill: { height: 6, backgroundColor: '#0F6B5A', borderRadius: 3 },

  // Fleet
  fleetGrid: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  fleetCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#EEF4F1',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1,
  },
  fleetValue: { fontSize: 20, fontWeight: '800', color: '#23423B', marginTop: 6, letterSpacing: -0.5 },
  fleetLabel: { fontSize: 10, fontWeight: '700', color: '#9AB7AF', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },
});
