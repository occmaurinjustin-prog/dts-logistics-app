import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
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
import authService from '@/services/authService';

const getApiBaseUrl = () => {
  if (Platform.OS === 'android') {
    return `http://10.65.49.24:8000/api`;
  }
  return 'http://localhost:8000/api';
};

export default function RescueHistoryScreen() {
  const router = useRouter();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const token = await authService.getToken();
      
      const response = await fetch(`${getApiBaseUrl()}/rescue/driver/history`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Fetch error:', response.status, errText);
        throw new Error('Failed to fetch rescue history');
      }

      const data = await response.json();
      setHistory(data.data || []);
    } catch (error) {
      console.error('Error fetching rescue history:', error);
      Alert.alert('Error', 'Failed to load rescue history');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rescue History</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.loadingText}>Loading history...</Text>
          </View>
        ) : history.length === 0 ? (
          <View style={styles.centerContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="shield-checkmark" size={40} color="#10B981" />
            </View>
            <Text style={styles.emptyTitle}>No Rescue History</Text>
            <Text style={styles.emptyText}>You haven't requested any emergency rescues.</Text>
          </View>
        ) : (
          history.map(rescue => (
            <View key={rescue.rescue_id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.categoryBadge}>
                  <Ionicons name="build" size={12} color="#FFFFFF" style={{marginRight: 4}} />
                  <Text style={styles.categoryText}>{rescue.issue_category}</Text>
                </View>
                <Text style={styles.statusText}>RESOLVED</Text>
              </View>
              
              <Text style={styles.description}>{rescue.description || 'No description provided'}</Text>
              
              <View style={styles.detailsRow}>
                <Ionicons name="location" size={14} color="#64748B" />
                <Text style={styles.detailsText} numberOfLines={1}>{rescue.address || 'GPS Location'}</Text>
              </View>
              
              {rescue.mechanic && (
                <View style={styles.detailsRow}>
                  <Ionicons name="person" size={14} color="#64748B" />
                  <Text style={styles.detailsText}>Mechanic: {rescue.mechanic.username}</Text>
                </View>
              )}

              {rescue.parts && rescue.parts.length > 0 && (
                <View style={styles.partsContainer}>
                  <Text style={styles.partsTitle}>Parts Used:</Text>
                  {rescue.parts.map((part: any, index: number) => (
                    <View key={index} style={styles.partRow}>
                      <Text style={styles.partName}>• {part.part_name || 'Part'}</Text>
                      <Text style={styles.partQty}>Qty: {part.pivot?.quantity || 1}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.divider} />
              
              <Text style={styles.dateText}>{formatDate(rescue.created_at)}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: Platform.OS === 'ios' ? 0 : 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  centerContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  emptyText: {
    color: '#64748B',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  statusText: {
    color: '#10B981',
    fontWeight: '800',
    fontSize: 12,
  },
  description: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
    marginBottom: 12,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailsText: {
    color: '#64748B',
    fontSize: 13,
    marginLeft: 6,
    flex: 1,
  },
  partsContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  partsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  partRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  partName: {
    fontSize: 12,
    color: '#64748B',
  },
  partQty: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },
  dateText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
    textAlign: 'right',
  },
});
